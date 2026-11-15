import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, realpath, stat, rm, readdir, lstat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exportAsteroidResult } from './asteroid-export.mjs';
import { boundedNumber } from './public-access.mjs';
import { requireRuntimeSpace } from './runtime-budget.mjs';

const defaultProjectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PREFIX = '/api/asteroid-analysis';
const RESULT_MARKER = 'SPHEREX_WEB_RESULT=';
const STATUS_MARKER = 'SPHEREX_WEB_STATUS=';
const MAX_IMAGES = 360;
const MAX_BODY = 8192;
const MAX_LOG_LINES = 100;
const MAX_LOG_WIDTH = 1200;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const ASSETS = new Set(['result.json', 'report.md', 'observations.csv', 'spectrum.csv', 'components.csv', 'temporal.json', 'run.json',
  'spectrum.png', 'separation.png', 'residuals.png', 'reference_comparison.png', 'sky_track.png']);
const MIME = { '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.png': 'image/png' };

function json(res, status, value, extra = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...extra });
  res.end(JSON.stringify(value));
}

function loopback(address) {
  return address === '::1' || address === '127.0.0.1' || address === '::ffff:127.0.0.1';
}

/** Host checking also prevents a remote page from reaching this service through DNS rebinding. */
export function isLocalAsteroidRequest(req, mutation = false) {
  if (!loopback(req.socket?.remoteAddress)) return false;
  let local;
  try { local = new URL(`http://${req.headers.host || ''}`); } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(local.hostname) || local.username || local.password || local.pathname !== '/') return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).origin !== local.origin) return false; } catch { return false; }
  }
  // An Origin-less CLI request is allowed, but browser POSTs from another origin are not.
  if (mutation && req.headers['sec-fetch-mode'] === 'no-cors') return false;
  return true;
}

export function validateAsteroidJob(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A JSON object is required.');
  const target = typeof value.target === 'string' ? value.target.trim() : '';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()+-]{0,79}$/u.test(target)) {
    throw new Error('Enter a known asteroid name or number (up to 80 characters).');
  }
  function date(value, name) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must be YYYY-MM-DD.`);
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2100-12-31') {
      throw new Error(`${name} must be a valid date between 1900 and 2100.`);
    }
    return value;
  }
  const start = date(value.start, 'Start date');
  const end = date(value.end, 'End date');
  if (end <= start) throw new Error('End date must be after start date.');
  const maxImages = value.maxImages ?? 120;
  if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > MAX_IMAGES) throw new Error(`Maximum images must be an integer from 1 to ${MAX_IMAGES}.`);
  return { target, start, end, maxImages };
}

export function bodyJson(req) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
    req.resume();
    return Promise.reject(Object.assign(new Error('Use Content-Type: application/json.'), { status: 415 }));
  }
  if (Number(req.headers['content-length']) > MAX_BODY) {
    req.resume();
    return Promise.reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
  }
  return new Promise((resolveBody, rejectBody) => {
    let chunks = [], size = 0, done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAbort);
      if (error) { req.resume(); rejectBody(error); } else resolveBody(value);
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > MAX_BODY) return finish(Object.assign(new Error('Request body is too large.'), { status: 413 }));
      chunks.push(chunk);
    };
    const onEnd = () => {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish(Object.assign(new Error('Invalid JSON request.'), { status: 400 })); }
      chunks = [];
    };
    const onError = error => finish(error);
    const onAbort = () => finish(Object.assign(new Error('Request aborted.'), { status: 400 }));
    const timer = setTimeout(() => finish(Object.assign(new Error('Request body timed out.'), { status: 408 })), 10000);
    timer.unref?.();
    req.on('data', onData); req.on('end', onEnd); req.on('error', onError); req.on('aborted', onAbort);
  });
}

async function exists(path) { return access(path).then(() => true, () => false); }

/** Imports only: this does not run the pipeline or contact an archive. */
export async function probeAsteroidPython(projectRoot, { timeoutMs = 60000 } = {}) {
  const interpreterPath = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
  const local = join(projectRoot, '.venv-science', interpreterPath);
  const legacyLocal = join(projectRoot, '.venv-asteroid', interpreterPath);
  const candidates = [];
  if (process.env.SPHEREX_PYTHON) candidates.push({ executable: process.env.SPHEREX_PYTHON, args: [] });
  else {
    if (await exists(local)) candidates.push({ executable: local, args: [] });
    else if (await exists(legacyLocal)) candidates.push({ executable: legacyLocal, args: [] });
    candidates.push(...(process.platform === 'win32' ? [{ executable: 'py', args: ['-3'] }] : []), { executable: 'python', args: [] }, { executable: 'python3', args: [] });
  }
  const scienceRoot = join(projectRoot, 'services', 'asteroids');
  let reason = 'Python 3.11 or newer and the asteroid dependencies are required. Run npm run setup:asteroids.';
  for (const candidate of candidates) {
    const result = await new Promise(resolveProbe => {
      let stderr = '', settled = false, child;
      const finish = result => { if (!settled) { settled = true; clearTimeout(timer); resolveProbe(result); } };
      const timer = setTimeout(() => { child?.kill(); finish({ ok: false, error: 'Python dependency check timed out.' }); }, timeoutMs);
      timer.unref?.();
      try {
        child = spawn(candidate.executable, [...candidate.args, '-X', 'utf8', '-B', '-c',
          'import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"; import numpy, scipy, pandas, astropy, astroquery, matplotlib, sklearn, sbpy, synphot, yaml, requests; from src.integration.pipeline import run_analysis; print("SPHEREX_READY")'],
        { cwd: scienceRoot, env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', MPLBACKEND: 'Agg' }, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString('utf8')).slice(-2000); });
        child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(-3000); });
        child.once('error', error => finish({ ok: false, error: error.code === 'ENOENT' ? 'Python executable was not found.' : error.message }));
        child.once('close', code => finish({ ok: code === 0 && stdout.includes('SPHEREX_READY'), error: stderr.trim().split('\n').at(-1) || 'Python dependency check failed.' }));
      } catch (error) { finish({ ok: false, error: error.message }); }
    });
    if (result.ok) return { available: true, ...candidate };
    reason = `${result.error} Run npm run setup:asteroids.`;
    // A configured interpreter or an existing dedicated environment is authoritative.
    if (process.env.SPHEREX_PYTHON || candidate.executable === local || candidate.executable === legacyLocal) break;
  }
  return { available: false, reason };
}

export function createAsteroidApi({ projectRoot = defaultProjectRoot, probePython, spawnProcess = spawn,
  exportResult = exportAsteroidResult, generateScene, timeoutMs = 30 * 60 * 1000,
  sceneTimeoutMs = 30 * 60 * 1000, maxJobs = 25, access: publicAccess, admission,
  retentionMs = 6 * 3600_000 } = {}) {
  const root = resolve(projectRoot);
  const scienceRoot = join(root, 'services', 'asteroids');
  const jobsRoot = join(root, 'var', 'jobs', 'asteroids');
  const jobs = new Map();
  const publicMode = !!publicAccess?.enabled;
  if (publicMode && !admission) throw Error('Public analysis requires the shared admission controller.');
  const runtimeLimit = boundedNumber(process.env.SPHEREX_MAX_RUNTIME_BYTES, 512 * 1024 ** 2, 1024 ** 2, 8 * 1024 ** 3);
  if (publicMode) { timeoutMs = publicAccess.limits.jobTimeoutSeconds * 1000; sceneTimeoutMs = timeoutMs; maxJobs = Math.min(maxJobs, 8); }
  let activeJob = null, activeScene = null, starting = false, closed = false, probe = null, probedAt = 0;
  async function capabilities() {
    // Public dependency imports are expensive: cache a successful probe for this
    // process lifetime and never overlap it with a scientific worker.
    if (!probe || (!publicMode && Date.now() - probedAt > 30000)) {
      const release = publicMode ? admission?.acquire('asteroid dependencies') : null;
      probedAt = Date.now();
      probe = Promise.resolve().then(() => probePython ? probePython() : probeAsteroidPython(root))
        .catch(error => ({ available: false, reason: error.message })).finally(() => release?.());
    }
    return probe;
  }
  function view(job) {
    return { id: job.id, status: job.status, target: job.target, start: job.start, end: job.end, maxImages: job.maxImages,
      createdAt: job.createdAt, finishedAt: job.finishedAt, logs: [...job.logs], ...(job.error ? { error: job.error } : {}),
      ...(job.errorCode ? { errorCode: job.errorCode } : {}),
      scene: job.scene || { status: 'not_started' },
      ...(job.status === 'completed' ? { resultUrl: `${PREFIX}/jobs/${job.id}/result.json` } : {}) };
  }
  function log(job, text) {
    const clean = String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
    if (!clean) return;
    job.logs.push(clean.slice(0, MAX_LOG_WIDTH));
    if (job.logs.length > MAX_LOG_LINES) job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
  }
  function stop(job, status, reason) {
    if (!['queued', 'running'].includes(job.status)) return;
    job.status = status;
    job.finishedAt = new Date().toISOString();
    if (reason) { job.error = reason; log(job, reason); }
    clearTimeout(job.timer);
    job.child?.kill('SIGTERM');
    // On Windows kill terminates the process; the second attempt bounds POSIX shutdown too.
    if (job.child) {
      job.killTimer = setTimeout(() => job.child?.kill('SIGKILL'), 2000);
      job.killTimer.unref?.();
    }
  }
  async function removeJobDirectory(directory) {
    // Only UUID directories created under this API's runtime root are removable.
    const name = directory.slice(resolve(jobsRoot).length + 1);
    if (resolve(directory) !== join(resolve(jobsRoot), name) || !/^[a-f0-9-]{36}$/.test(name)) throw Error('Invalid cleanup directory.');
    const info = await lstat(directory).catch(() => null);
    if (info && info.isDirectory() && !info.isSymbolicLink()) await rm(directory, { recursive: true, force: true });
  }
  async function cleanup() {
    if (!publicMode) return;
    const entries = await readdir(jobsRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name) || entry.name === activeJob || entry.name === activeScene) continue;
      const directory = join(jobsRoot, entry.name), info = await lstat(directory).catch(() => null);
      const job = jobs.get(entry.name);
      const touched = job ? Date.parse(job.finishedAt || job.createdAt) : info?.mtimeMs;
      if (Number.isFinite(touched) && Date.now() - touched > retentionMs) { jobs.delete(entry.name); await removeJobDirectory(directory); }
    }
  }
  async function startJob(input, python, owner, release) {
    await cleanup();
    if (publicMode) await requireRuntimeSpace(join(root, 'var'), runtimeLimit);
    while (jobs.size >= maxJobs) {
      const removable = [...jobs.values()].find(job => job.id !== activeJob && job.id !== activeScene && !['queued', 'running'].includes(job.status));
      if (!removable) break;
      jobs.delete(removable.id);
      if (publicMode) await removeJobDirectory(removable.directory);
    }
    const id = randomUUID();
    const directory = join(jobsRoot, id);
    const output = join(directory, 'outputs');
    const bundle = join(directory, 'web');
    await mkdir(output, { recursive: true });
    if (closed) throw Object.assign(new Error('Analysis server is shutting down.'), { status: 503 });
    const job = { id, ...input, status: 'queued', createdAt: new Date().toISOString(), logs: [], directory, output, bundle,
      dbPath: join(directory, 'asteroids.sqlite'), python, owner, release, scene: { status: 'not_started' }, child: null };
    jobs.set(id, job);
    activeJob = id;
    const args = [...(python.args || []), '-X', 'utf8', '-u', '-B', join(scienceRoot, 'web_bridge.py'),
      '--target', input.target, '--start', input.start, '--end', input.end, '--max-images', String(input.maxImages),
      '--output-dir', output, '--db-path', job.dbPath, '--run-id', id];
    let sourceDir = null, reportedFailure = null, finished = false;
    const settle = async (code, error) => {
      if (finished) return;
      finished = true;
      clearTimeout(job.timer); clearTimeout(job.killTimer);
      clearInterval(job.storageTimer);
      if (job.status === 'running' || job.status === 'queued') {
        if (reportedFailure) {
          job.status = reportedFailure.status === 'no_data' ? 'no_data' : 'failed';
          job.errorCode = reportedFailure.code;
          job.error = reportedFailure.message;
          log(job, job.error);
        } else if (!error && code === 0 && sourceDir) {
          try {
            const physicalOutput = await realpath(output);
            const physicalSource = await realpath(sourceDir);
            if (!physicalSource.startsWith(physicalOutput + sep)) throw new Error('Python returned an invalid result directory.');
            await exportResult({ sourceDir: physicalSource, destinationDir: bundle, id, runId: id });
            job.sourceDir = physicalSource;
            if (job.status === 'running') { job.status = 'completed'; log(job, 'Analysis complete. Results are ready.'); }
          } catch (exportError) { if (job.status === 'running') { job.status = 'failed'; job.error = `Could not prepare results: ${exportError.message}`; log(job, job.error); } }
        } else {
          job.status = 'failed';
          job.error = error?.message || `Analysis process exited with code ${code ?? 'unknown'} without a complete result. See the progress log.`;
          log(job, job.error);
        }
      }
      job.finishedAt ||= new Date().toISOString();
      job.child = null;
      if (publicMode && job.status !== 'completed') await rm(join(job.directory, 'cache'), { recursive:true, force:true }).catch(() => {});
      if (activeJob === id) activeJob = null;
      job.release?.(); job.release = null;
    };
    try {
      job.child = spawnProcess(python.executable, args, { cwd: scienceRoot, shell: false, windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1', MPLBACKEND: 'Agg',
          ...(publicMode ? { SPHEREX_ASTEROID_CACHE_DIR:join(job.directory, 'cache') } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
      job.status = 'running';
      log(job, `Searching SPHEREx observations for ${input.target}: ${input.start} — ${input.end}.`);
      for (const stream of [job.child.stdout, job.child.stderr]) {
        let pending = '';
        const onLine = line => {
          if (stream === job.child?.stdout && line.startsWith(RESULT_MARKER)) {
            try {
              const candidate = JSON.parse(line.slice(RESULT_MARKER.length)).sourceDir;
              if (typeof candidate === 'string' && resolve(candidate).startsWith(resolve(output) + sep)) sourceDir = resolve(candidate);
            } catch { /* An invalid completion marker is treated as an incomplete job. */ }
          } else if (stream === job.child?.stdout && line.startsWith(STATUS_MARKER)) {
            try {
              const state = JSON.parse(line.slice(STATUS_MARKER.length));
              if (['no_data', 'failed', 'invalid_input'].includes(state.status) && typeof state.message === 'string') {
                reportedFailure = { status: state.status, code: String(state.code || state.status).slice(0, 80), message: state.message.slice(0, 2400) };
              }
            } catch { /* A malformed structured error is still an ordinary worker failure. */ }
          } else log(job, line);
        };
        stream?.setEncoding?.('utf8');
        stream?.on('data', chunk => {
          pending += chunk;
          const lines = pending.split(/\r?\n|\r/g);
          pending = lines.pop() || '';
          for (const line of lines) onLine(line);
          if (pending.length > 8192) { log(job, pending.slice(0, MAX_LOG_WIDTH)); pending = ''; }
        });
        stream?.on('end', () => { if (pending) onLine(pending); });
      }
      job.child.once('error', error => { void settle(null, error); });
      job.child.once('close', code => { void settle(code); });
      job.timer = setTimeout(() => stop(job, 'failed', `Analysis exceeded the ${Math.round(timeoutMs / 60000)}-minute limit. No incomplete result was published.`), timeoutMs);
      job.timer.unref?.();
      if (publicMode) {
        let checking = false;
        job.storageTimer = setInterval(async () => {
          if (checking || !['queued','running'].includes(job.status)) return;
          checking = true;
          try { await requireRuntimeSpace(join(root, 'var'), runtimeLimit); }
          catch (error) { stop(job, 'failed', error.message); }
          finally { checking = false; }
        }, 2000);
        job.storageTimer.unref?.();
      }
    } catch (error) { await settle(null, error); }
    return job;
  }
  function cancelScene(job, reason = '3D generation cancelled.') {
    if (job.scene?.status !== 'running') return;
    job.scene = { status: 'cancelled', error: reason };
    job.sceneController?.abort(new Error(reason));
    log(job, reason);
  }
  async function startScene(job) {
    if (job.scene?.status === 'completed') return;
    if (activeScene) throw Object.assign(new Error('Another 3D scene is already being prepared.'), { status: 409 });
    const release = publicMode ? admission?.acquire('asteroid 3D') : null;
    try { if (publicMode) publicAccess.charge(job.owner); } catch (error) { release?.(); throw error; }
    const controller = new AbortController();
    job.sceneController = controller;
    job.scene = { status: 'running', startedAt: new Date().toISOString() };
    activeScene = job.id;
    const destinationDir = join(job.directory, 'scene');
    const timer = setTimeout(() => cancelScene(job, '3D generation exceeded its time limit.'), sceneTimeoutMs);
    timer.unref?.();
    let checkingStorage = false;
    const storageTimer = publicMode ? setInterval(async () => {
      if (checkingStorage) return;
      checkingStorage = true;
      try { await requireRuntimeSpace(join(root,'var'), runtimeLimit); } catch (error) { cancelScene(job, error.message); }
      finally { checkingStorage = false; }
    },2000) : null;
    storageTimer?.unref?.();
    job.sceneTask = (async () => {
      try {
        if (publicMode) await requireRuntimeSpace(join(root,'var'), runtimeLimit);
        const physicalOutput = await realpath(job.output);
        const physicalSource = await realpath(job.sourceDir);
        if (!physicalSource.startsWith(physicalOutput + sep)) throw new Error('The analysis source escaped its job directory.');
        const generator = generateScene || (await import(pathToFileURL(join(root, 'apps', 'asteroids', 'scripts', 'generate-scene.mjs')).href)).generateScene;
        await generator({ sourceDir: physicalSource, sourceRoot: physicalOutput, dbPath: job.dbPath, destinationDir,
          python: job.python, signal: controller.signal, onLog: message => log(job, message) });
        if (controller.signal.aborted || closed) return;
        const [physicalScene, manifest] = await Promise.all([realpath(destinationDir), stat(join(destinationDir, 'manifest.json'))]);
        if (!physicalScene.startsWith(resolve(job.directory) + sep) || !manifest.isFile()) throw new Error('The 3D generator did not publish a valid manifest.');
        job.sceneDirectory = physicalScene;
        job.scene = { status: 'completed', url: `${PREFIX}/jobs/${job.id}/scene/`, finishedAt: new Date().toISOString() };
        log(job, '3D scene preparation complete. The scientific analysis result remains unchanged.');
      } catch (error) {
        if (!controller.signal.aborted) {
          job.scene = { status: 'failed', error: error.message };
          log(job, `3D preparation failed: ${error.message}`);
        }
      } finally {
        clearTimeout(timer);
        clearInterval(storageTimer);
        if (activeScene === job.id) activeScene = null;
        job.sceneController = null;
        release?.();
      }
    })();
  }
  async function serveScene(req, res, job, asset) {
    if (job.scene?.status !== 'completed' || !job.sceneDirectory) { json(res, 404, { error: '3D scene is not ready.' }); return; }
    try { asset = decodeURIComponent(asset); } catch { json(res, 400, { error: 'Invalid 3D asset encoding.' }); return; }
    if (!asset || asset.includes('\\') || asset.includes('\0') || asset.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))
      || !/\.(json|png|jpg|jpeg|webp)$/i.test(asset)) { json(res, 404, { error: 'Unknown 3D asset.' }); return; }
    const file = await realpath(join(job.sceneDirectory, asset));
    if (!file.startsWith(job.sceneDirectory + sep)) { json(res, 403, { error: 'Invalid 3D asset path.' }); return; }
    const info = await stat(file);
    if (!info.isFile()) { json(res, 404, { error: 'Unknown 3D asset.' }); return; }
    const mime = { ...MIME, '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': mime[extname(file).toLowerCase()], 'Content-Length': info.size,
      'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
  async function handle(req, res, url) {
    const path = url.pathname.replace(/^\/analysis\/api(?=\/|$)/, '/api');
    if (path !== PREFIX && !path.startsWith(PREFIX + '/')) return false;
    try {
      const route = path.slice(PREFIX.length);
      const mutation = !['GET', 'HEAD'].includes(req.method);
      const local = isLocalAsteroidRequest(req, mutation);
      // Exported scientific files are public; controls/status remain owned by
      // the session that created the job. Raw FITS, SQLite and cache paths have
      // no HTTP route.
      const artifact = ['GET','HEAD'].includes(req.method) && (/^\/jobs\/[a-f0-9-]{36}\/scene\/.+/.test(route) || /^\/jobs\/[a-f0-9-]{36}\/[A-Za-z0-9_.-]+$/.test(route));
      const owner = publicMode && !artifact && route !== '/capabilities' ? publicAccess.session(req) : null;
      if (route === '/capabilities' && req.method === 'GET') {
        if ((!local && !publicMode) || closed) json(res, 200, { available: false, code: closed ? 'server_stopped' : 'local_only', reason: 'New analyses are available only on this computer through the local web server.', maxImages: MAX_IMAGES });
        else {
          const state = await capabilities();
          json(res, 200, { available: !!state.available, code: state.available ? 'ready' : 'python_unavailable', ...(state.reason ? { reason: state.reason } : {}), maxImages: MAX_IMAGES,
            publicMode, ...(publicMode ? { limits: publicAccess.limits } : {}), ...(!publicMode && activeJob ? { activeJobId: activeJob } : {}) });
        }
        return true;
      }
      if (!local && !publicMode) { json(res, 403, { error: 'This analysis API only accepts local, same-origin requests.' }); return true; }
      if (closed) { json(res, 503, { error: 'Analysis server is shutting down.' }); return true; }
      if (route === '/jobs' && req.method === 'POST') {
        const input = validateAsteroidJob(await bodyJson(req));
        if (activeJob || starting) { json(res, publicMode ? 429 : 409, { error: 'Another analysis is already running.', ...(!publicMode && activeJob ? { id: activeJob } : {}) }); return true; }
        starting = true;
        try {
          const python = await capabilities();
          if (!python.available) { json(res, 503, { error: python.reason || 'Python analysis is unavailable. Run npm run setup:asteroids.' }); return true; }
          if (closed) { json(res, 503, { error: 'Analysis server is shutting down.' }); return true; }
          const release = publicMode ? admission?.acquire('asteroid analysis') : null;
          let job;
          try { if (publicMode) publicAccess.charge(owner); job = await startJob(input, python, owner, release); } catch (error) { release?.(); throw error; }
          json(res, 202, view(job));
        } finally { starting = false; }
        return true;
      }
      const sceneMatch = /^\/jobs\/([a-f0-9-]{36})\/scene(?:\/(.*))?$/.exec(route);
      if (sceneMatch) {
        const job = jobs.get(sceneMatch[1]);
        if (!job) { json(res, 404, { error: 'Analysis job not found.' }); return true; }
        const asset = sceneMatch[2];
        if (publicMode && asset === undefined && job.owner !== owner) { json(res, 404, { error: 'Analysis job not found.' }); return true; }
        if (asset !== undefined && ['GET', 'HEAD'].includes(req.method)) { await serveScene(req, res, job, asset); return true; }
        if (asset === undefined && req.method === 'POST') {
          if (job.status !== 'completed') { json(res, 409, { error: 'Complete the scientific analysis before preparing its 3D scene.' }); return true; }
          await startScene(job); json(res, 202, view(job)); return true;
        }
        if (asset === undefined && req.method === 'DELETE') { cancelScene(job); json(res, 200, view(job)); return true; }
        json(res, 405, { error: 'Method not allowed.' }); return true;
      }
      const match = /^\/jobs\/([a-f0-9-]{36})(?:\/([A-Za-z0-9_.-]+))?$/.exec(route);
      if (match) {
        const job = jobs.get(match[1]);
        if (!job) { json(res, 404, { error: 'Analysis job not found. The local server may have restarted.' }); return true; }
        const asset = match[2];
        if (publicMode && !asset && job.owner !== owner) { json(res, 404, { error: 'Analysis job not found.' }); return true; }
        if (!asset && req.method === 'GET') { json(res, 200, view(job)); return true; }
        if (!asset && req.method === 'DELETE') { stop(job, 'cancelled', 'Analysis cancelled.'); cancelScene(job); json(res, 200, view(job)); return true; }
        if (asset && ['GET', 'HEAD'].includes(req.method)) {
          if (job.status !== 'completed' || !ASSETS.has(asset)) { json(res, 404, { error: 'Result asset not available.' }); return true; }
          const file = join(job.bundle, asset);
          const [physicalBundle, physicalFile, info] = await Promise.all([realpath(job.bundle), realpath(file), stat(file)]);
          if (!physicalFile.startsWith(physicalBundle + sep) || !info.isFile()) { json(res, 403, { error: 'Invalid result asset.' }); return true; }
          res.writeHead(200, { 'Content-Type': MIME[extname(asset)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
          if (req.method === 'HEAD') res.end();
          else createReadStream(file).on('error', () => res.destroy()).pipe(res);
          return true;
        }
        json(res, 405, { error: 'Method not allowed.' }); return true;
      }
      if (route === '/jobs' || route === '/capabilities') json(res, 405, { error: 'Method not allowed.' });
      else json(res, 404, { error: 'Unknown asteroid analysis endpoint.' });
    } catch (error) {
      if (res.headersSent) res.destroy();
      else json(res, error.status || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : error.code ? 500 : 400), { error: error.message || 'Analysis request failed.', ...(error.status && error.code ? { code: error.code } : {}) });
    }
    return true;
  }
  async function close() {
    closed = true;
    clearInterval(cleanupTimer);
    const waits = [];
    for (const job of jobs.values()) {
      if (job.child) waits.push(new Promise(resolveExit => {
        const timer = setTimeout(resolveExit, 3000); timer.unref?.();
        job.child.once('close', () => { clearTimeout(timer); resolveExit(); });
      }));
      stop(job, 'cancelled', 'Local server stopped.');
      cancelScene(job, 'Local server stopped.');
      if (job.sceneTask) waits.push(job.sceneTask);
    }
    await Promise.all(waits);
  }
  const cleanupTimer = publicMode ? setInterval(() => { void cleanup().catch(() => {}); }, 600_000) : null;
  cleanupTimer?.unref?.();
  return { handle, close };
}
