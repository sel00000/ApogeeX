import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { createAsteroidApi, isLocalAsteroidRequest } from './asteroid-api.mjs';

const PREFIX = '/api/asteroid-analysis';
const INPUT = { target: '433', start: '2026-02-01', end: '2026-02-21', maxImages: 48 };

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;
  exitCode = null;
  signalCode = null;
  finish(code = 0, signal = null) {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.stdout.end();
    this.stderr.end();
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }
  kill(signal = 'SIGTERM') {
    this.killed = true;
    queueMicrotask(() => this.finish(null, signal));
    return true;
  }
}

async function fixture(overrides = {}) {
  const temporaryRoot = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryRoot, 'sky-asteroid-api-'));
  const calls = [];
  const exports = [];
  const api = createAsteroidApi({
    projectRoot: root,
    probePython: async () => ({ available: true, executable: 'python-test', args: [] }),
    spawnProcess: (executable, args, options) => {
      const child = new FakeChild();
      calls.push({ executable, args, options, child });
      return child;
    },
    exportResult: async options => {
      exports.push(options);
      await mkdir(options.destinationDir, { recursive: true });
      const result = { schema: 'spherex-asteroid-web-1', id: options.id,
        record: { origin: 'OBSERVED', diameter_km: null },
        coverage: { start: null, end: null }, counts: { exposures: 0, points: 0 },
        validation: null, assets: { report: 'report.md', observations: 'observations.csv', plots: [] } };
      await writeFile(join(options.destinationDir, 'result.json'), JSON.stringify(result));
      await writeFile(join(options.destinationDir, 'report.md'), 'Test-only export: no observations.');
      await writeFile(join(options.destinationDir, 'observations.csv'), 'obs_id,mjd_mid\n');
      await writeFile(join(options.destinationDir, 'private.txt'), 'must not be served');
      return result;
    },
    ...overrides,
  });
  const server = createServer(async (req, res) => {
    try {
      if (!(await api.handle(req, res, new URL(req.url, 'http://localhost')))) {
        res.writeHead(404); res.end('unhandled');
      }
    } catch (error) {
      res.writeHead(500); res.end(String(error));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => fetch(origin + PREFIX + path, options);
  const post = (input = INPUT, headers = {}) => request('/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
    body: JSON.stringify(input),
  });
  const stop = async () => {
    await api.close();
    await new Promise(done => server.close(done));
    const target = resolve(root);
    assert.ok(target.startsWith(temporaryRoot + sep));
    assert.ok(target.split(sep).at(-1).startsWith('sky-asteroid-api-'));
    await rm(target, { recursive: true, force: true });
  };
  return { root, calls, exports, api, server, origin, request, post, stop };
}

async function untilStatus(f, id, expected) {
  const deadline = Date.now() + 3000;
  let value;
  do {
    const response = await f.request(`/jobs/${id}`);
    assert.equal(response.status, 200);
    value = await response.json();
    if (expected.includes(value.status)) return value;
    await new Promise(done => setTimeout(done, 10));
  } while (Date.now() < deadline);
  assert.fail(`Expected ${expected.join('/')} but got ${JSON.stringify(value)}`);
}

test('capabilities report missing Python without spawning an analysis or hiding saved-site routes', async () => {
  const f = await fixture({ probePython: async () => ({ available: false, reason: 'Install asteroid dependencies.' }) });
  try {
    const cap = await (await f.request('/capabilities')).json();
    assert.equal(cap.available, false);
    assert.match(cap.reason, /dependencies/i);
    assert.equal(cap.maxImages, 360);
    assert.equal(f.calls.length, 0);
    const response = await f.post();
    assert.equal(response.status, 503);
    assert.equal(f.calls.length, 0);
    assert.equal(await (await fetch(f.origin + '/ordinary-static-file')).text(), 'unhandled');
  } finally { await f.stop(); }
});

test('mutation requests reject foreign origins, forged hosts, malformed targets and invalid date ranges', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post(INPUT, { Origin: 'https://another-site.example' })).status, 403);
    assert.equal((await f.post(INPUT, { Host: 'attacker.example', Origin: 'http://attacker.example' })).status, 403);
    for (const change of [
      { target: '../433' }, { target: '433; echo injected' }, { target: '' },
      { start: '2026-02-30' }, { start: '2026-03-01' }, { end: 'bad-date' },
      { maxImages: 0 }, { maxImages: 361 }, { maxImages: 1.5 },
    ]) {
      const response = await f.post({ ...INPUT, ...change });
      assert.equal(response.status, 400, JSON.stringify(change));
    }
    for (const value of [null, [], '433']) assert.equal((await f.post(value)).status, 400);
    assert.equal((await f.request('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await f.request('/jobs', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(INPUT) })).status, 415);
    assert.equal((await f.post({ ...INPUT, target: 'a'.repeat(20000) })).status, 413);
    assert.equal(f.calls.length, 0);
  } finally { await f.stop(); }
});

test('local execution excludes LAN clients and cross-site browser requests', () => {
  const local = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:4173' } };
  assert.equal(isLocalAsteroidRequest(local, true), true);
  assert.equal(isLocalAsteroidRequest({ ...local, socket: { remoteAddress: '192.168.1.10' } }, true), false);
  assert.equal(isLocalAsteroidRequest({ ...local, headers: { ...local.headers, 'sec-fetch-site': 'cross-site' } }, true), false);
  assert.equal(isLocalAsteroidRequest({ ...local, headers: { ...local.headers, 'sec-fetch-mode': 'no-cors' } }, true), false);
});

test('one job reserves the slot across concurrent requests and launches Python without a shell', async () => {
  const f = await fixture();
  try {
    const responses = await Promise.all([f.post(), f.post({ ...INPUT, target: '16' })]);
    assert.deepEqual(responses.map(r => r.status).sort(), [202, 409]);
    const accepted = await responses.find(r => r.status === 202).json();
    const busy = await responses.find(r => r.status === 409).json();
    assert.ok(accepted.id);
    // A second request may arrive while the first is checking dependencies, before a job id exists.
    if (busy.id !== undefined) assert.equal(busy.id, accepted.id);
    await untilStatus(f, accepted.id, ['running']);
    const activeConflict = await f.post({ ...INPUT, target: '16' });
    assert.equal(activeConflict.status, 409);
    assert.equal((await activeConflict.json()).id, accepted.id);
    assert.equal(f.calls.length, 1);
    const call = f.calls[0];
    assert.equal(call.executable, 'python-test');
    assert.notEqual(call.options.shell, true);
    assert.equal(call.options.windowsHide, true);
    assert.ok(call.args.includes('--target'));
    assert.ok(call.args.includes('--start'));
    assert.ok(call.args.includes('--end'));
    const output = call.args[call.args.indexOf('--output-dir') + 1];
    assert.ok(resolve(output).startsWith(resolve(f.root, 'var', 'jobs', 'asteroids') + sep));
    const cancelled = await f.request(`/jobs/${accepted.id}`, { method: 'DELETE', headers: { Origin: f.origin } });
    assert.equal(cancelled.status, 200);
    assert.equal((await untilStatus(f, accepted.id, ['cancelled'])).status, 'cancelled');
    assert.equal(call.child.killed, true);
  } finally { await f.stop(); }
});

test('successful jobs export preserved results and expose only the declared report assets', async () => {
  const f = await fixture();
  try {
    const accepted = await (await f.post()).json();
    await untilStatus(f, accepted.id, ['running']);
    const call = f.calls[0];
    const output = call.args[call.args.indexOf('--output-dir') + 1];
    const sourceDir = join(output, '433');
    await mkdir(sourceDir, { recursive: true });
    call.child.stdout.write('Downloading observed spectra\n');
    call.child.stdout.write('SPHEREX_WEB_RESULT=' + JSON.stringify({ sourceDir }) + '\n');
    call.child.finish();
    const job = await untilStatus(f, accepted.id, ['completed']);
    assert.equal(f.exports.length, 1);
    assert.equal(resolve(f.exports[0].sourceDir), resolve(sourceDir));
    assert.equal(job.resultUrl, `${PREFIX}/jobs/${accepted.id}/result.json`);
    const resultResponse = await fetch(f.origin + job.resultUrl);
    assert.equal(resultResponse.status, 200);
    const result = await resultResponse.json();
    assert.equal(result.record.diameter_km, null);
    assert.equal(result.record.origin, 'OBSERVED');
    const report = await f.request(`/jobs/${accepted.id}/report.md`);
    assert.equal(report.status, 200);
    assert.match(await report.text(), /Test-only export/);
    const observations = await f.request(`/jobs/${accepted.id}/observations.csv`);
    assert.equal(observations.status, 200);
    assert.match(observations.headers.get('content-type'), /^text\/csv/);
    assert.equal(await observations.text(), 'obs_id,mjd_mid\n');
    const observationsHead = await f.request(`/jobs/${accepted.id}/observations.csv`, { method: 'HEAD' });
    assert.equal(observationsHead.status, 200);
    assert.equal(Number(observationsHead.headers.get('content-length')), Buffer.byteLength('obs_id,mjd_mid\n'));
    assert.equal(await observationsHead.text(), '');
    const privateFile = await f.request(`/jobs/${accepted.id}/private.txt`);
    assert.ok([403, 404].includes(privateFile.status));
    assert.equal((await f.request(`/jobs/${accepted.id}/missing.png`)).status, 404);
    assert.equal((await f.post({ ...INPUT, target: '16' })).status, 202);
  } finally { await f.stop(); }
});

test('failed processes preserve an actionable error and bounded progress logs without exporting results', async () => {
  const f = await fixture();
  try {
    const accepted = await (await f.post()).json();
    await untilStatus(f, accepted.id, ['running']);
    const child = f.calls[0].child;
    child.stdout.write(Array.from({ length: 600 }, (_, i) => `progress ${i}`).join('\n') + '\n');
    child.stderr.write('IRSA archive unavailable; try again later.\n');
    child.finish(1);
    const job = await untilStatus(f, accepted.id, ['failed']);
    assert.equal(f.exports.length, 0);
    assert.ok(job.error);
    assert.ok(job.logs.length < 600);
    assert.ok(job.logs.some(line => line.includes('IRSA archive unavailable')));
    assert.equal(job.resultUrl, undefined);
    assert.equal((await f.post({ ...INPUT, target: '16' })).status, 202);
  } finally { await f.stop(); }
});

test('a child cannot export a directory outside its isolated job outputs', async () => {
  const f = await fixture();
  try {
    const accepted = await (await f.post()).json();
    await untilStatus(f, accepted.id, ['running']);
    const child = f.calls[0].child;
    child.stdout.write('SPHEREX_WEB_RESULT=' + JSON.stringify({ sourceDir: f.root }) + '\n');
    child.finish();
    await untilStatus(f, accepted.id, ['failed']);
    assert.equal(f.exports.length, 0);
  } finally { await f.stop(); }
});

test('timeout terminates the worker and releases the slot; close cancels the next running worker', async () => {
  const f = await fixture({ timeoutMs: 100 });
  try {
    const first = await (await f.post()).json();
    const failed = await untilStatus(f, first.id, ['failed']);
    assert.match(failed.error, /timed? ?out|timeout|limit/i);
    assert.equal(f.calls[0].child.killed, true);
    const secondResponse = await f.post({ ...INPUT, target: '16' });
    assert.equal(secondResponse.status, 202);
    const second = await secondResponse.json();
    await untilStatus(f, second.id, ['running']);
    await f.api.close();
    assert.equal(f.calls[1].child.killed, true);
  } finally { await f.stop(); }
});

test('no-observation returns remain no_data and do not publish a fabricated result', async () => {
  const f = await fixture();
  try {
    const accepted = await (await f.post()).json();
    f.calls[0].child.stdout.write('SPHEREX_WEB_STATUS=' + JSON.stringify({ status: 'no_data', code: 'no_observations', message: 'No SPHEREx exposures in the requested period.' }) + '\n');
    f.calls[0].child.finish(3);
    const job = await untilStatus(f, accepted.id, ['no_data']);
    assert.equal(job.errorCode, 'no_observations');
    assert.equal(job.resultUrl, undefined);
    assert.equal(f.exports.length, 0);
    assert.equal((await f.request(`/jobs/${accepted.id}/scene`, { method: 'POST', headers: { Origin: f.origin } })).status, 409);
  } finally { await f.stop(); }
});

async function completeFakeAnalysis(f) {
  const accepted = await (await f.post()).json();
  const call = f.calls.at(-1);
  const sourceDir = join(call.args[call.args.indexOf('--output-dir') + 1], '433');
  await mkdir(sourceDir, { recursive: true });
  call.child.stdout.write('SPHEREX_WEB_RESULT=' + JSON.stringify({ sourceDir }) + '\n');
  call.child.finish();
  return untilStatus(f, accepted.id, ['completed']);
}

async function untilScene(f, id, expected) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const job = await (await f.request(`/jobs/${id}`)).json();
    if (job.scene.status === expected) return job;
    await new Promise(done => setTimeout(done, 10));
  }
  assert.fail(`Scene did not become ${expected}`);
}

test('3D preparation receives raw data and database separately and serves only its finished assets', async () => {
  let received;
  const f = await fixture({ generateScene: async options => {
    received = options;
    await mkdir(join(options.destinationDir, 'cutouts'), { recursive: true });
    await writeFile(join(options.destinationDir, 'manifest.json'), '{"mode":"fixture"}');
    await writeFile(join(options.destinationDir, 'cutouts', 'sample.png'), Buffer.from([137, 80, 78, 71]));
    await writeFile(join(options.destinationDir, 'cutouts', 'A913 SF.png'), Buffer.from([137, 80, 78, 71]));
    await writeFile(join(options.destinationDir, 'private.txt'), 'not public');
  } });
  try {
    const job = await completeFakeAnalysis(f);
    assert.equal(job.scene.status, 'not_started');
    const response = await f.request(`/jobs/${job.id}/scene`, { method: 'POST', headers: { Origin: f.origin } });
    assert.equal(response.status, 202);
    const ready = await untilScene(f, job.id, 'completed');
    assert.equal(ready.status, 'completed');
    assert.ok(received.sourceDir.endsWith(sep + '433'));
    assert.equal(received.sourceRoot, resolve(received.sourceDir, '..'));
    assert.equal(received.dbPath, resolve(received.sourceRoot, '..', 'asteroids.sqlite'));
    assert.equal(ready.scene.url, `${PREFIX}/jobs/${job.id}/scene/`);
    assert.equal((await fetch(f.origin + ready.scene.url + 'manifest.json')).status, 200);
    assert.equal((await fetch(f.origin + ready.scene.url + 'cutouts/sample.png')).status, 200);
    assert.equal((await fetch(f.origin + ready.scene.url + 'cutouts/A913%20SF.png')).status, 200);
    assert.equal((await fetch(f.origin + ready.scene.url + 'cutouts/%2e%2e%2fprivate.txt')).status, 404);
    assert.equal((await fetch(f.origin + ready.scene.url + 'private.txt')).status, 404);
  } finally { await f.stop(); }
});

test('a failed or cancelled 3D generation does not invalidate the scientific result', async () => {
  const f = await fixture({ generateScene: async ({ signal }) => new Promise((resolveTask, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  try {
    const job = await completeFakeAnalysis(f);
    await f.request(`/jobs/${job.id}/scene`, { method: 'POST', headers: { Origin: f.origin } });
    await untilScene(f, job.id, 'running');
    const cancelled = await f.request(`/jobs/${job.id}/scene`, { method: 'DELETE', headers: { Origin: f.origin } });
    assert.equal(cancelled.status, 200);
    const state = await untilScene(f, job.id, 'cancelled');
    assert.equal(state.status, 'completed');
    assert.equal((await fetch(f.origin + state.resultUrl)).status, 200);
  } finally { await f.stop(); }
});
