"""Offline HTTP and real-process checks for bounded observation execution."""
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import server as api


class ObservationResources(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for name, value in (
            ('PATCH_DIR', self.root / 'patches'), ('CACHE_DIR', self.root / 'cache'),
            ('jobs', {}), ('work', queue.Queue(maxsize=2)), ('children', set()),
            ('active_job', None), ('resolve_busy', False),
            ('science_lock', threading.Lock()), ('shutting_down', threading.Event()),
            ('last_pruned', time.time()),
        ):
            helper = patch.object(api, name, value)
            helper.start()
            self.addCleanup(helper.stop)
        helper = patch.dict(os.environ, {'SPHEREX_MAX_FOV': '.5', 'SPHEREX_JOB_TIMEOUT_SECONDS': '1800', 'SPHEREX_MAX_RUNTIME_BYTES': ''})
        helper.start()
        self.addCleanup(helper.stop)
        helper = patch.object(api, 'missing_dependencies', return_value=[])
        helper.start()
        self.addCleanup(helper.stop)

    def child_script(self, script):
        helper = patch.object(api, '_child_command', return_value=[sys.executable, '-u', '-B', '-c', script])
        helper.start()
        self.addCleanup(helper.stop)

    def server(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        def close():
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)
        self.addCleanup(close)
        return f'http://127.0.0.1:{server.server_port}'

    def test_get_poll_does_not_admit_or_retry_work(self):
        base = self.server()
        with self.assertRaises(urllib.error.HTTPError) as failure:
            urllib.request.urlopen(base + '/api/patch?ra=1&dec=2&fov=0.1&retry=1')
        self.assertEqual(failure.exception.code, 404)
        self.assertFalse(api.jobs)
        self.assertTrue(api.work.empty())
        request = urllib.request.Request(base + '/api/patch', data=b'{"ra":1,"dec":2,"fov":0.1}',
                                         headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request) as response:
            self.assertEqual(json.load(response)['status'], 'queued')
        with urllib.request.urlopen(base + '/api/patch?ra=1&dec=2&fov=0.1') as response:
            self.assertEqual(json.load(response)['status'], 'queued')
        self.assertEqual(api.work.qsize(), 1)

    def test_optional_field_limit_rejects_without_cropping_or_enqueuing(self):
        with patch.dict(os.environ, {'SPHEREX_MAX_FOV': '.1'}):
            base = self.server()
            request = urllib.request.Request(base + '/api/patch', data=b'{"ra":1,"dec":2,"fov":0.2}',
                                             headers={'Content-Type': 'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as failure:
                urllib.request.urlopen(request)
            self.assertEqual(failure.exception.code, 422)
            self.assertIn('not cropped', json.load(failure.exception)['error'])
            self.assertFalse(api.jobs)
            self.assertTrue(api.work.empty())
            self.assertEqual(api.validate_input({'ra': 1, 'dec': 2, 'fov': .1}), (1, 2, .1))
            self.assertEqual(api.health()['maxFov'], .1)

    def test_child_preserves_input_and_progress_contract(self):
        self.child_script('''
import json, sys
v=json.load(sys.stdin)
print('A private diagnostic line, not an API event.', flush=True)
print('SPHEREX_OBSERVATION_EVENT='+json.dumps({'event':'progress','message':'working','done':2,'total':3}),flush=True)
print('SPHEREX_OBSERVATION_EVENT='+json.dumps({'event':'result','value':{'status':'ok','received':v}}),flush=True)
''')
        calls = []
        value = {'ra': 12.3456, 'dec': -23.45, 'fov': .125}
        result = api._run_child('patch', value, progress=lambda *args: calls.append(args), timeout=5)
        self.assertEqual(result['received'], value)
        self.assertEqual(calls, [('working', 2, 3)])
        self.assertFalse(api.children)

    def test_real_child_cli_rejects_invalid_input_without_opening_server(self):
        # Exercise the actual same-file CLI/protocol, before any science import.
        with self.assertRaises(api.JobError) as failure:
            api._run_child('patch', {'ra': 360, 'dec': 0, 'fov': .1}, timeout=5)
        self.assertEqual(failure.exception.status, 502)
        self.assertFalse(api.children)

    def test_busy_covers_queue_dequeue_before_process_start(self):
        api.patch_status(1, 2, .1)
        item = api.work.get_nowait()
        self.assertTrue(api.work.empty())
        self.assertTrue(api.health()['busy'])
        api.cancel_job(item[0])
        api.run_job(item)
        self.assertFalse(api.health()['busy'])

    def test_silent_child_is_killed_at_total_deadline(self):
        self.child_script('import time; time.sleep(30)')
        real_popen = subprocess.Popen
        started = []
        def launch(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            started.append(child)
            return child
        before = time.monotonic()
        with patch.object(api.subprocess, 'Popen', side_effect=launch):
            with self.assertRaises(api.JobError) as failure:
                api._run_child('patch', {}, timeout=.2)
        self.assertEqual(failure.exception.status, 504)
        self.assertLess(time.monotonic() - before, 5)
        self.assertIsNotNone(started[0].poll())
        self.assertFalse(api.children)

    def test_cancellation_releases_process_before_busy_becomes_false(self):
        self.child_script('import time; time.sleep(30)')
        result = api.patch_status(1, 2, .1)
        worker = threading.Thread(target=api.run_job, args=(api.work.get_nowait(),))
        worker.start()
        deadline = time.monotonic() + 3
        while not api.children and time.monotonic() < deadline:
            time.sleep(.01)
        self.assertTrue(api.health()['busy'])
        with api.lock:
            process = next(iter(api.children))
        self.assertEqual(api.cancel_job(result['id'])['status'], 'cancelled')
        worker.join(timeout=5)
        self.assertFalse(worker.is_alive())
        self.assertIsNotNone(process.poll())
        self.assertFalse(api.health()['busy'])
        self.assertEqual(api.jobs[result['id']]['status'], 'cancelled')

    def test_name_resolution_shares_the_science_slot(self):
        with api.science_lock:
            with self.assertRaises(api.JobError) as failure:
                api.resolve('Barnard')
        self.assertEqual(failure.exception.status, 429)
        with patch.object(api, '_run_child', return_value={'name': 'Barnard'}) as child:
            self.assertEqual(api.resolve(' Barnard '), {'name': 'Barnard'})
        child.assert_called_once_with('resolve', {'name': 'Barnard'}, timeout=60)
        self.assertFalse(api.health()['busy'])

    def test_cleanup_preserves_prior_and_published_generations(self):
        pid = api.patch_id(1, 2, .1)
        folder = api.PATCH_DIR / pid
        for generation in ('prior', 'published', 'incomplete'):
            path = folder / 'generations' / generation
            path.mkdir(parents=True)
            (path / 'frame.f32').write_bytes(b'fixture')
        (folder / 'meta.json').write_text(json.dumps({'visits': [{'f32': 'generations/published/frame.f32'}]}), encoding='utf-8')
        api._cleanup_incomplete(pid, {'prior'})
        self.assertTrue((folder / 'generations/prior/frame.f32').exists())
        self.assertTrue((folder / 'generations/published/frame.f32').exists())
        self.assertFalse((folder / 'generations/incomplete').exists())

    def test_resource_settings_are_bounded(self):
        for value in ('0', '-1', 'nan', 'inf', '1801'):
            with self.subTest(timeout=value), patch.dict(os.environ, {'SPHEREX_JOB_TIMEOUT_SECONDS': value}):
                with self.assertRaises(ValueError):
                    api.job_timeout_seconds()
        for value in ('0', '.6', 'nan'):
            with self.subTest(fov=value), patch.dict(os.environ, {'SPHEREX_MAX_FOV': value}):
                with self.assertRaises(ValueError):
                    api.maximum_fov()

    def test_full_storage_rejects_admission_and_preserves_fresh_results(self):
        result = api.PATCH_DIR / 'completed' / 'frame.f32'
        result.parent.mkdir(parents=True)
        result.write_bytes(b'x' * 32)
        with patch.dict(os.environ, {'SPHEREX_MAX_RUNTIME_BYTES': '16'}):
            with self.assertRaises(api.JobError) as failure:
                api.patch_status(1, 2, .1)
        self.assertEqual(failure.exception.status, 507)
        self.assertFalse(api.jobs)
        self.assertTrue(api.work.empty())
        self.assertEqual(result.read_bytes(), b'x' * 32)

    def test_disk_pressure_evicts_old_inactive_download_cache_only(self):
        old = api.CACHE_DIR / 'patches' / 'old' / 'download.fits'
        fresh = api.CACHE_DIR / 'patches' / 'fresh' / 'download.fits'
        result = api.PATCH_DIR / 'old' / 'frame.f32'
        original = self.root / 'source-model.fits'
        for file, content in ((old, b'o' * 128), (fresh, b'f' * 20), (result, b'r' * 20), (original, b'original')):
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(content)
        os.utime(old.parent, (time.time() - 120, time.time() - 120))
        with patch.dict(os.environ, {'SPHEREX_MAX_RUNTIME_BYTES': '100'}):
            api.enforce_runtime_budget(prune=True)
        self.assertFalse(old.exists())
        self.assertEqual(fresh.read_bytes(), b'f' * 20)
        self.assertEqual(result.read_bytes(), b'r' * 20)
        self.assertEqual(original.read_bytes(), b'original')

    def test_running_storage_limit_kills_child_and_reclaims_only_new_cache(self):
        pid = api.patch_id(1, 2, .1)
        cache = api.CACHE_DIR / 'patches' / pid
        prior = cache / 'prior.fits'
        prior.parent.mkdir(parents=True)
        prior.write_bytes(b'prior bytes')
        published = api.PATCH_DIR / pid / 'generations' / 'prior' / 'frame.f32'
        published.parent.mkdir(parents=True)
        published.write_bytes(b'published bytes')
        new_file = cache / 'new.fits'
        self.child_script(f'''from pathlib import Path
import time
Path({str(new_file)!r}).write_bytes(b'x' * 2048)
time.sleep(30)
''')
        api.jobs[pid] = {'status': 'queued'}
        with patch.dict(os.environ, {'SPHEREX_MAX_RUNTIME_BYTES': '1024'}):
            api.run_job((pid, 1, 2, .1))
        self.assertEqual(api.jobs[pid]['status'], 'failed')
        self.assertIn('storage limit', api.jobs[pid]['message'])
        self.assertFalse(api.children)
        self.assertFalse(new_file.exists())
        self.assertEqual(prior.read_bytes(), b'prior bytes')
        self.assertEqual(published.read_bytes(), b'published bytes')


if __name__ == '__main__':
    unittest.main()
