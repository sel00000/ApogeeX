import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const origin = 'https://jp-feynman.github.io';
const request = (path, options = {}) => fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(60_000) });
let healthy = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    const response = await request('/api/health');
    const body = await response.json();
    if (response.ok && body.status === 'ok' && body.observations) { healthy = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert.ok(healthy, 'Observation service must be available in the container.');
const config = await (await request('/config.json')).json();
assert.equal(config.publicMode, true);
const blocked = await request('/api/session', { headers: { Origin: 'https://untrusted.example' } });
assert.equal(blocked.status, 403);
const sessionResponse = await request('/api/session', { headers: { Origin: origin } });
assert.equal(sessionResponse.status, 200);
assert.equal(sessionResponse.headers.get('access-control-allow-origin'), origin);
const session = await sessionResponse.json();
assert.ok(typeof session.sessionToken === 'string' && session.sessionToken.length >= 24);
const headers = { Origin: origin, 'X-Spherex-Session': session.sessionToken, 'Content-Type': 'application/json' };
const capability = await request('/api/asteroid-analysis/capabilities', { headers });
assert.equal(capability.status, 200);
assert.equal((await capability.json()).available, true);
const tooLarge = await request('/api/patch', { method: 'POST', headers, body: JSON.stringify({ ra: 83.633, dec: 22.0145, fov: 0.5 }) });
assert.equal(tooLarge.status, 422, 'An oversized free-tier field must be rejected, never silently cropped.');
const unauthorized = await request('/api/patch', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ra: 83.633, dec: 22.0145, fov: 0.1 }) });
assert.equal(unauthorized.status, 401);
console.log('Public container smoke checks passed: Python availability, CORS, session, ownership gate and explicit field limit.');
console.log('This check does not run a live archive analysis or establish its peak memory requirement.');
