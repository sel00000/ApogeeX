#!/usr/bin/env python3
"""Local observation worker: POST /api/patch starts/retries, GET polls.
Generated artifacts: /api/observations/data/patches/<id>/meta.json.
No application source, raw FITS cache, or arbitrary local files are public.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
import mimetypes
import os
import queue
import re
import shutil
import signal
import stat
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from runtime import PATCH_DIR, CACHE_DIR

MAX_QUEUE, MAX_JOBS, MAX_BODY = 8, 128, 8192
SUCCESS_TTL, EMPTY_TTL, FAILED_TTL = 24 * 3600, 15 * 60, 60
RETENTION_SECONDS = 7 * 24 * 3600
last_pruned = 0.0
jobs: dict[str, dict] = {}
work: queue.Queue = queue.Queue(maxsize=MAX_QUEUE)
lock = threading.RLock()
DEPENDENCIES = ('numpy', 'astropy', 'pyvo', 'requests', 'PIL', 'reproject', 'astroquery')
CHILD_EVENT = 'SPHEREX_OBSERVATION_EVENT='
science_lock = threading.Lock()
children: set[subprocess.Popen] = set()
active_job: str | None = None
resolve_busy = False
shutting_down = threading.Event()


class JobError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class JobCancelled(Exception):
    pass


def job_timeout_seconds() -> float:
    """A total wall-clock deadline, including archive waits and downloads."""
    value = float(os.environ.get('SPHEREX_JOB_TIMEOUT_SECONDS', '1800'))
    if not math.isfinite(value) or not 1 <= value <= 1800:
        raise ValueError('SPHEREX_JOB_TIMEOUT_SECONDS must be between 1 and 1800')
    return value


def maximum_fov() -> float:
    value = float(os.environ.get('SPHEREX_MAX_FOV', '.5'))
    if not math.isfinite(value) or not .025 <= value <= .5:
        raise ValueError('SPHEREX_MAX_FOV must be between 0.025 and 0.5 degrees')
    return value


def maximum_runtime_bytes() -> int | None:
    value = os.environ.get('SPHEREX_MAX_RUNTIME_BYTES', '').strip()
    if not value:
        return None
    if not re.fullmatch(r'[1-9][0-9]{0,12}', value) or int(value) > 1024 ** 4:
        raise ValueError('SPHEREX_MAX_RUNTIME_BYTES must be a positive byte count up to 1 TiB')
    return int(value)


def _runtime_files(directory: Path) -> list[tuple[Path, int]]:
    """Inventory only generated ordinary files; never follow links or junctions."""
    pending, found = [directory], []
    while pending:
        path = pending.pop()
        try:
            info = path.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            continue
        if stat.S_ISDIR(info.st_mode):
            pending.extend(path.iterdir())
        elif stat.S_ISREG(info.st_mode):
            found.append((path, info.st_size))
    return found


def runtime_bytes() -> int:
    _assert_runtime_roots()
    return sum(size for root in (PATCH_DIR, CACHE_DIR / 'patches') for _, size in _runtime_files(root))


def _assert_runtime_roots() -> None:
    for root in (PATCH_DIR, CACHE_DIR, CACHE_DIR / 'patches'):
        try:
            info = root.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise OSError('Observation runtime roots must not be symbolic links or junctions')


def _evict_inactive_cache(maximum: int) -> None:
    """Under disk pressure evict oldest generated download caches, not results."""
    base = CACHE_DIR / 'patches'
    if not base.exists():
        return
    info = base.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        return
    physical = base.resolve()
    candidates = []
    with lock:
        active = {pid for pid, state in jobs.items() if state['status'] in ('queued', 'running')}
        for child in base.iterdir():
            info = child.lstat()
            if child.name in active or not stat.S_ISDIR(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                continue
            if child.resolve().parent != physical:
                continue
            touched = max(info.st_mtime, jobs.get(child.name, {}).get('updatedAt', 0))
            if touched < time.time() - 60:
                candidates.append((touched, child))
        for _, child in sorted(candidates, key=lambda entry: entry[0]):
            if runtime_bytes() < maximum:
                break
            resolved = child.resolve()
            if resolved.parent == physical and not child.is_symlink():
                shutil.rmtree(resolved)


def enforce_runtime_budget(*, prune: bool = False) -> None:
    maximum = maximum_runtime_bytes()
    if maximum is None:
        return
    try:
        usage = runtime_bytes()
        if prune and usage >= maximum:
            # Existing retention protects fresh completed results. If old inactive
            # generated data cannot make enough room, refuse rather than delete it.
            prune_runtime()
            _evict_inactive_cache(maximum)
            usage = runtime_bytes()
    except OSError as error:
        raise JobError('Observation storage could not be checked. Try again later.', 503) from error
    if usage >= maximum:
        raise JobError('Observation storage limit reached. No field or scientific samples were reduced. Retry after old generated data is cleaned up or use a larger analysis server.', 507)


def missing_dependencies() -> list[str]:
    return [name for name in DEPENDENCIES if importlib.util.find_spec(name) is None]


def patch_id(ra: float, dec: float, fov: float) -> str:
    # Include the full supported field precision so unequal regions never share a cache key.
    return re.sub(r'[^0-9a-z_pm]', '', f'r{ra:.6f}_d{dec:+.6f}_f{fov:.6f}'.replace('+', 'p').replace('-', 'm').replace('.', '_'))


def validate_input(value: dict) -> tuple[float, float, float]:
    if not isinstance(value, dict):
        raise JobError('JSON object required')
    try:
        if any(isinstance(value.get(k), bool) for k in ('ra', 'dec', 'fov')):
            raise ValueError()
        ra, dec, fov = float(value['ra']), float(value['dec']), float(value.get('fov', .1))
    except (KeyError, TypeError, ValueError):
        raise JobError('RA, Dec and field must be finite numbers') from None
    if not all(math.isfinite(x) for x in (ra, dec, fov)) or not (0 <= ra < 360 and -90 <= dec <= 90 and .025 <= fov <= .5):
        raise JobError('RA 0–360°, Dec −90–90°, field 0.025–0.5°')
    if fov > maximum_fov():
        raise JobError(f'This server supports a field up to {maximum_fov():g}°. The requested field was not cropped. Choose a smaller field or use a larger analysis server.', 422)
    return ra, dec, fov


def _view(pid: str, state: dict) -> dict:
    return dict(id=pid, url=f'/api/observations/data/patches/{pid}/meta.json', **state, queue=work.qsize())


def _cached(pid: str, now: float) -> dict | None:
    path = PATCH_DIR / pid / 'meta.json'
    try:
        meta = json.loads(path.read_text(encoding='utf-8'))
        status = meta.get('status', 'done')
        if status == 'ok':
            status = 'done'
        if status not in ('done', 'no_data', 'fetch_failed'):
            return None
        ttl = SUCCESS_TTL if status == 'done' else EMPTY_TTL if status == 'no_data' else FAILED_TTL
        if now - path.stat().st_mtime > ttl or (status == 'done' and not meta.get('visits')):
            return None
        return dict(status=status, message=meta.get('status_detail', ''), cached=True, updatedAt=path.stat().st_mtime)
    except (OSError, ValueError, TypeError):
        return None


def prune_runtime(now: float | None = None) -> None:
    """Remove only old, inactive result/cache children inside the declared roots."""
    try:
        _assert_runtime_roots()
    except OSError:
        return
    now = time.time() if now is None else now
    with lock:
        active = {pid for pid, state in jobs.items() if state['status'] in ('queued', 'running')}
    for base in (PATCH_DIR, CACHE_DIR / 'patches'):
        if not base.is_dir():
            continue
        resolved_base = base.resolve()
        for child in base.iterdir():
            # Resolve and contain each recursive removal; never follow junctions/symlinks.
            try:
                info = child.lstat()
            except FileNotFoundError:
                continue
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                continue
            resolved = child.resolve()
            if child.name in active or child.is_symlink() or resolved.parent != resolved_base or not child.is_dir():
                continue
            try:
                meta = child / 'meta.json'
                touched = max(child.stat().st_mtime, meta.stat().st_mtime if meta.exists() else 0)
                if now - touched > RETENTION_SECONDS:
                    shutil.rmtree(resolved)
            except OSError:
                # A concurrently read or locked artifact can be retried at the next pass.
                continue


def patch_status(ra: float, dec: float, fov: float, retry: bool = False, *, create: bool = True) -> dict:
    global last_pruned
    ra, dec, fov = validate_input(dict(ra=ra, dec=dec, fov=fov))
    pid, now = patch_id(ra, dec, fov), time.time()
    with lock:
        if now - last_pruned > 3600:
            prune_runtime(now)
            last_pruned = now
        state = jobs.get(pid)
        if state and state['status'] in ('queued', 'running'):
            return _view(pid, state.copy())
        if state and state['status'] in ('failed', 'fetch_failed', 'cancelled') and not retry:
            return _view(pid, state.copy())
        cached = None if retry else _cached(pid, now)
        if cached:
            return _view(pid, cached)
        if not create:
            raise JobError('Observation job unavailable. Start or retry the request.', 404)
        enforce_runtime_budget(prune=True)
        missing = missing_dependencies()
        if missing:
            raise JobError('Observation dependencies unavailable: ' + ', '.join(missing) + '. Run project setup.', 503)
        if work.full():
            raise JobError('Observation queue is full. Try again after the current jobs finish.', 429)
        while len(jobs) >= MAX_JOBS:
            old = next((k for k, v in jobs.items() if v['status'] not in ('queued', 'running')), None)
            if old is None:
                raise JobError('Observation job capacity reached.', 429)
            jobs.pop(old)
        state = dict(status='queued', message='대기 중', done=0, total=0, createdAt=now, updatedAt=now)
        jobs[pid] = state
        work.put_nowait((pid, ra, dec, fov))
        return _view(pid, state.copy())


def cancel_job(pid: str) -> dict:
    with lock:
        state = jobs.get(pid)
        if not state:
            raise JobError('Observation job not found', 404)
        if state['status'] in ('queued', 'running'):
            state.update(status='cancelled', message='취소됨', updatedAt=time.time())
        return _view(pid, state.copy())


def _child_command(mode: str) -> list[str]:
    return [sys.executable, '-X', 'utf8', '-u', '-B', str(Path(__file__).resolve()), '--child', mode]


def _stop_process(child: subprocess.Popen) -> None:
    """Wait for actual exit before giving the single science slot to another job."""
    if child.poll() is None:
        try:
            child.terminate()
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)
        except ProcessLookupError:
            pass


def _run_child(mode: str, value: dict, *, progress=lambda *_: None,
               cancelled=lambda: False, timeout: float | None = None) -> dict:
    """Keep large scientific imports and arrays in one disposable child process.

    Reading stdout happens on a bounded queue so a silent archive or a blocked
    native computation cannot prevent the supervising thread enforcing timeout.
    Only structured events are consumed; arbitrary subprocess output is private.
    """
    if shutting_down.is_set() or cancelled():
        raise JobCancelled()
    deadline = time.monotonic() + (job_timeout_seconds() if timeout is None else timeout)
    next_storage_check = 0.0
    child = subprocess.Popen(_child_command(mode), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace',
                             bufsize=1, cwd=str(Path(__file__).resolve().parent), shell=False,
                             env={**os.environ, 'PYTHONUTF8': '1', 'PYTHONDONTWRITEBYTECODE': '1',
                                  'MPLBACKEND': 'Agg'})
    with lock:
        children.add(child)
    events: queue.Queue = queue.Queue(maxsize=32)
    reader_finished = threading.Event()
    stop_reader = threading.Event()

    def read_output():
        try:
            while not stop_reader.is_set():
                line = child.stdout.readline(8192)
                if not line:
                    break
                if not line.startswith(CHILD_EVENT):
                    continue
                try:
                    event = json.loads(line[len(CHILD_EVENT):])
                except (ValueError, TypeError):
                    continue
                while not stop_reader.is_set():
                    try:
                        events.put(event, timeout=.1)
                        break
                    except queue.Full:
                        continue
        finally:
            reader_finished.set()

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    result, failure = None, None
    try:
        child.stdin.write(json.dumps(value, allow_nan=False))
        child.stdin.close()
        while True:
            if shutting_down.is_set() or cancelled():
                raise JobCancelled()
            if time.monotonic() >= deadline:
                raise JobError('Observation analysis exceeded its total time limit. Retry with a smaller field or use a larger analysis server.', 504)
            if mode == 'patch' and time.monotonic() >= next_storage_check:
                enforce_runtime_budget()
                next_storage_check = time.monotonic() + 2
            try:
                event = events.get(timeout=.05)
            except queue.Empty:
                event = None
            if isinstance(event, dict):
                if event.get('event') == 'progress':
                    progress(str(event.get('message', ''))[:1200], int(event.get('done', 0)), int(event.get('total', 0)))
                elif event.get('event') == 'result' and isinstance(event.get('value'), dict):
                    result = event['value']
                elif event.get('event') == 'error':
                    failure = str(event.get('message', 'Observation worker failed.'))[:1200]
            code = child.poll()
            if code is not None and reader_finished.is_set() and events.empty():
                if code != 0 or failure or result is None:
                    # Full tracebacks and raw file paths are kept off the public API.
                    raise JobError(failure or 'Observation worker stopped before producing a result.', 502)
                if mode == 'patch':
                    enforce_runtime_budget()
                return result
    finally:
        stop_reader.set()
        _stop_process(child)
        reader.join(timeout=2)
        if child.stdin and not child.stdin.closed:
            child.stdin.close()
        child.stdout.close()
        with lock:
            children.discard(child)


def _generation_names(pid: str) -> set[str]:
    directory = PATCH_DIR / pid / 'generations'
    return {p.name for p in directory.iterdir() if p.is_dir()} if directory.is_dir() else set()


def _cleanup_new_cache(pid: str, existing: set[str]) -> None:
    directory = CACHE_DIR / 'patches' / pid
    physical = directory.resolve()
    if not physical.is_relative_to(CACHE_DIR.resolve()) or directory.is_symlink():
        return
    for file, _ in _runtime_files(directory):
        if file.relative_to(directory).as_posix() not in existing and file.resolve().is_relative_to(physical):
            file.unlink(missing_ok=True)


def _cleanup_incomplete(pid: str, existing: set[str]) -> None:
    """Preserve all prior generations and any newly atomically published one."""
    directory = PATCH_DIR / pid / 'generations'
    if not directory.is_dir():
        return
    physical = directory.resolve()
    if directory.is_symlink() or not physical.is_relative_to(PATCH_DIR.resolve()):
        return
    try:
        meta = json.loads((PATCH_DIR / pid / 'meta.json').read_text(encoding='utf-8'))
        if not isinstance(meta, dict) or not isinstance(meta.get('visits', []), list):
            return
        if any(not isinstance(visit, dict) or not isinstance(visit.get('f32_det', {}), dict)
               for visit in meta.get('visits', [])):
            return
        published = {part for visit in meta.get('visits', []) for value in
                     [visit.get('png', ''), visit.get('f32', ''), visit.get('diff_png', ''), *visit.get('f32_det', {}).values()]
                     if isinstance(value, str) and value.startswith('generations/')
                     for part in value.split('/')[1:2]}
    except FileNotFoundError:
        published = set()
    except (OSError, ValueError, TypeError):
        # Unreadable metadata must never authorize removing potentially published files.
        return
    for child in directory.iterdir():
        if child.name in existing | published or child.is_symlink() or not child.is_dir():
            continue
        resolved = child.resolve()
        if resolved.parent == physical:
            try:
                shutil.rmtree(resolved)
            except OSError:
                pass


def run_job(item: tuple) -> None:
    global active_job
    pid, ra, dec, fov = item
    with science_lock:
        with lock:
            if jobs.get(pid, {}).get('status') == 'cancelled' or shutting_down.is_set():
                return
            jobs[pid].update(status='running', updatedAt=time.time())
            active_job = pid

        def cancelled() -> bool:
            with lock:
                return jobs[pid]['status'] == 'cancelled'

        def progress(message: str, done: int, total: int) -> None:
            with lock:
                if jobs[pid]['status'] == 'cancelled':
                    raise JobCancelled()
                jobs[pid].update(status='running', message=message, done=done, total=total, updatedAt=time.time())

        previous_generations: set[str] | None = None
        previous_cache: set[str] | None = None
        storage_failure = False
        try:
            previous_generations = _generation_names(pid)
            if maximum_runtime_bytes() is not None:
                cache = CACHE_DIR / 'patches' / pid
                previous_cache = {file.relative_to(cache).as_posix() for file, _ in _runtime_files(cache)}
            result = _run_child('patch', dict(ra=ra, dec=dec, fov=fov), progress=progress, cancelled=cancelled)
            if result.get('status') not in ('ok', 'no_data', 'fetch_failed'):
                raise JobError('Observation worker returned an invalid result.', 502)
            with lock:
                if jobs[pid]['status'] != 'cancelled':
                    jobs[pid].update(status='done' if result['status'] == 'ok' else result['status'],
                                     message=result.get('detail', ''), updatedAt=time.time())
        except JobCancelled:
            with lock:
                jobs[pid].update(status='cancelled', message='취소됨', updatedAt=time.time())
        except Exception as error:
            storage_failure = isinstance(error, JobError) and error.status == 507
            with lock:
                if jobs[pid]['status'] != 'cancelled':
                    message = str(error) if isinstance(error, JobError) else 'Observation worker failed. Retry the request.'
                    jobs[pid].update(status='failed', message=message, updatedAt=time.time())
        finally:
            if previous_generations is not None:
                try:
                    _cleanup_incomplete(pid, previous_generations)
                except OSError:
                    pass
            if storage_failure and previous_cache is not None:
                try:
                    _cleanup_new_cache(pid, previous_cache)
                except OSError:
                    pass
            with lock:
                active_job = None


def worker() -> None:
    while True:
        item = work.get()
        try:
            run_job(item)
        finally:
            work.task_done()


def _resolve_science(name: str) -> dict:
    import bake
    value = bake.simbad_lookup(name)
    return dict(name=value['main_id'], ra=value['ra'], dec=value['dec'], frame='ICRS', coordinateEpoch='J2000',
                properMotion=dict(raCosDecMasYr=value.get('pmra'), decMasYr=value.get('pmdec')),
                note=f"SIMBAD [{value['server']}] ICRS catalogue coordinates, epoch J2000")


def resolve(name: str) -> dict:
    global resolve_busy
    if not isinstance(name, str) or not name.strip() or len(name) > 160:
        raise JobError('A target name of 1–160 characters is required')
    if not science_lock.acquire(blocking=False):
        raise JobError('An observation analysis is running. Try the name lookup after it finishes.', 429)
    with lock:
        resolve_busy = True
    try:
        return _run_child('resolve', dict(name=name.strip()), timeout=min(60, job_timeout_seconds()))
    finally:
        with lock:
            resolve_busy = False
        science_lock.release()


def health() -> dict:
    missing = missing_dependencies()
    with lock:
        pending = any(state['status'] in ('queued', 'running') for state in jobs.values())
        return dict(ok=True, available=not missing and not shutting_down.is_set(), missing=missing,
                    busy=pending or bool(children) or active_job is not None or resolve_busy or not work.empty(),
                    running=active_job, resolveBusy=resolve_busy, queue=work.qsize(), maxQueue=MAX_QUEUE,
                    maxFov=maximum_fov(), jobTimeoutSeconds=job_timeout_seconds(), maxRuntimeBytes=maximum_runtime_bytes())


def normalized_path(path: str) -> str:
    prefix = '/api/observations/'
    if path.startswith(prefix):
        rest = path[len(prefix):]
        return '/' + rest if rest.startswith('data/') else '/api/' + rest
    return path


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if code == 429:
            self.send_header('Retry-After', '5')
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _json(self, code: int, value: dict) -> None:
        self._send(code, json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8'), 'application/json; charset=utf-8')

    def _trusted_request(self) -> bool:
        if self.client_address[0] not in ('127.0.0.1', '::1', '::ffff:127.0.0.1') or self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return False
        try:
            if urlparse('http://' + self.headers.get('Host', '')).hostname not in ('localhost', '127.0.0.1', '::1'):
                return False
        except ValueError:
            return False
        origin = self.headers.get('Origin')
        if origin:
            allowed = set(filter(None, os.environ.get('SPHEREX_ALLOWED_ORIGINS', '').split(',')))
            try:
                if urlparse(origin).hostname not in ('localhost', '127.0.0.1', '::1') and origin not in allowed:
                    return False
            except ValueError:
                return False
        return True

    def _dispatch(self) -> None:
        if not self._trusted_request():
            return self._json(403, dict(error='Use the application gateway to access this local service.'))
        parsed = urlparse(self.path)
        path = normalized_path(unquote(parsed.path))
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
        try:
            if path == '/api/health' and self.command in ('GET', 'HEAD'):
                return self._json(200, health())
            if path == '/api/resolve' and self.command == 'GET':
                return self._json(200, resolve(query.get('name', '')))
            if path == '/api/patch' and self.command in ('GET', 'POST'):
                value = query if self.command == 'GET' else self._read_json()
                ra, dec, fov = validate_input(value)
                retry = value.get('retry') is True or value.get('retry') == '1'
                return self._json(200, patch_status(ra, dec, fov, retry=retry and self.command == 'POST', create=self.command == 'POST'))
            if path.startswith('/api/jobs/') and self.command == 'DELETE':
                return self._json(200, cancel_job(path.rsplit('/', 1)[1]))
            if self.command in ('GET', 'HEAD') and path.startswith('/data/patches/'):
                return self._artifact(path[len('/data/patches/'):])
            return self._json(404, dict(error='Unknown observation endpoint'))
        except JobError as error:
            return self._json(error.status, dict(error=str(error)))
        except (ValueError, KeyError, TypeError) as error:
            return self._json(400, dict(error=str(error)))
        except Exception as error:
            return self._json(502, dict(error=f'{type(error).__name__}: {error}'))

    def _read_json(self) -> dict:
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            raise JobError('Use Content-Type: application/json', 415)
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise JobError('Invalid content length') from None
        if not 0 < length <= MAX_BODY:
            raise JobError('Request body is empty or too large', 413)
        self.connection.settimeout(10)
        return json.loads(self.rfile.read(length))

    def _artifact(self, relative: str) -> None:
        if '\\' in relative or '\x00' in relative or any(p.startswith('.') for p in relative.split('/')):
            raise JobError('Invalid result path', 403)
        path = (PATCH_DIR / relative).resolve()
        if not path.is_relative_to(PATCH_DIR.resolve()) or path.suffix not in ('.json', '.png', '.f32') or not path.is_file():
            raise JobError('Result not found', 404)
        return self._send(200, path.read_bytes(), mimetypes.guess_type(path.name)[0] or 'application/octet-stream')

    do_GET = _dispatch
    do_HEAD = _dispatch
    do_POST = _dispatch
    do_DELETE = _dispatch

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write((fmt % args) + '\n')


def child_main(mode: str) -> int:
    """Private stdin/stdout protocol; this entry point does not open an HTTP port."""
    def emit(event: str, **value):
        print(CHILD_EVENT + json.dumps(dict(event=event, **value), ensure_ascii=False, allow_nan=False), flush=True)

    try:
        raw = sys.stdin.read(MAX_BODY + 1)
        if len(raw) > MAX_BODY:
            raise ValueError('Input too large')
        value = json.loads(raw)
        if mode == 'patch':
            ra, dec, fov = validate_input(value)
            import patch as pipeline
            result = pipeline.bake_patch(ra, dec, fov,
                                        lambda message, done, total: emit('progress', message=message, done=done, total=total))
        else:
            result = _resolve_science(value['name'])
        emit('result', value=result)
        return 0
    except Exception:
        emit('error', message='The observation worker could not complete the request. The archive may be unavailable; retry later.')
        return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--child', choices=('patch', 'resolve'), help=argparse.SUPPRESS)
    parser.add_argument('--host', default='127.0.0.1', choices=('127.0.0.1', 'localhost'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('SPHEREX_OBSERVATIONS_PORT', '8000')))
    args = parser.parse_args()
    if args.child:
        return child_main(args.child)
    # Invalid resource settings fail startup rather than leaving a broken worker.
    job_timeout_seconds()
    maximum_fov()
    maximum_runtime_bytes()
    def stop(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stop)
    threading.Thread(target=worker, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print('SPHEREX_OBSERVATIONS_READY=' + json.dumps(dict(port=server.server_port, host='127.0.0.1')), flush=True)
    print(f'Observation service: http://{args.host}:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutting_down.set()
        with lock:
            for state in jobs.values():
                if state['status'] in ('queued', 'running'):
                    state.update(status='cancelled', message='Server stopped.', updatedAt=time.time())
            running_children = list(children)
        for child in running_children:
            _stop_process(child)
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
