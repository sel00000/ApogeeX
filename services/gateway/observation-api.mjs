import { bodyJson as readJson } from './asteroid-api.mjs';

const failure = (status, message, code) => Object.assign(new Error(message), { status, code });
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(body)); };

/** Public observation controls; exported artifacts are handled by the bounded proxy. */
export function createObservationApi({ base, access, admission, isAlive = () => true, stopWorker,
  fetchImpl = fetch, pollMs = 1000 } = {}) {
  const claims = new Map(), coordinates = new Map();
  let closed = false;
  const monitors = new Set();
  async function call(path, options = {}) {
    let response;
    try { response = await fetchImpl(new URL(path, base), { ...options, signal: AbortSignal.timeout(path.endsWith('/health') ? 5000 : 120_000) }); }
    catch { throw failure(502, 'Observation service could not be reached.', 'upstream_unavailable'); }
    const data = await response.json().catch(() => null);
    if (!data) throw failure(502, 'Observation service returned an invalid response.', 'upstream_invalid');
    if (!response.ok) throw failure(response.status, data.error || 'Observation request failed.', data.code);
    return data;
  }
  async function monitor(release) {
    // Keep the lease until the Python child actually exits, including the
    // terminate/kill grace period after cancellation. A lost worker is stopped
    // before release instead of allowing another large process to overlap it.
    const deadline = Date.now() + (access.limits.jobTimeoutSeconds + 30) * 1000;
    try {
      while (!closed) {
        if (!isAlive()) break;
        try { if ((await call('/api/observations/health')).busy === false) break; } catch { /* Retry until the process exits or the total deadline expires. */ }
        if (Date.now() > deadline) { await stopWorker?.(); if (!isAlive()) break; }
        await new Promise(resolve => { const timer = setTimeout(resolve, pollMs); timer.unref?.(); });
      }
    } finally { release(); }
  }
  function track(release) { const task = monitor(release); monitors.add(task); void task.finally(() => monitors.delete(task)); }
  function owner(id, session) {
    const claim = claims.get(id);
    if (!claim || claim.owner !== session) throw failure(404, 'Observation job not found.', 'job_not_found');
    claim.touched = Date.now(); return claim;
  }
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure(400, 'A coordinate object is required.');
    const { ra, dec, fov = .1 } = value;
    if (![ra,dec,fov].every(x => typeof x === 'number' && Number.isFinite(x)) || ra < 0 || ra >= 360 || dec < -90 || dec > 90 || fov < .025 || fov > .5) throw failure(400, 'Use finite RA [0,360), Dec [-90,90] and FOV [0.025,0.5] degrees.');
    if (fov > access.limits.maxFov) throw failure(422, `This test server accepts fields up to ${access.limits.maxFov} degrees. Select a smaller region; the requested field has not been cropped.`, 'field_limit');
    return { ra, dec, fov, retry: value.retry === true };
  }
  return {
    async handle(req, res, url) {
      if (!access.enabled) return false;
      const route = url.pathname.replace(/^\/api\/observations(?=\/|$)/, '/api');
      if (!['/api/patch','/api/resolve','/api/health'].includes(route) && !/^\/api\/jobs\/[a-z0-9_]+$/.test(route)) return false;
      if (closed) throw failure(503, 'Observation service is shutting down.');
      if (route === '/api/health') { send(res, 200, await call('/api/observations/health')); return true; }
      const session = access.session(req);
      if (route === '/api/resolve' && req.method === 'GET') {
        const name = url.searchParams.get('name');
        if (!name || name.length > 160) throw failure(400, 'Enter a target name of 1–160 characters.');
        const release = admission.acquire('target lookup');
        try { access.charge(session, 'lookup'); send(res, 200, await call(`/api/resolve?name=${encodeURIComponent(name)}`)); }
        finally { track(release); }
        return true;
      }
      if (route === '/api/patch' && ['GET','POST'].includes(req.method)) {
        const input = validate(req.method === 'POST' ? await readJson(req) : Object.fromEntries(['ra','dec','fov'].map(key => [key, url.searchParams.has(key) ? Number(url.searchParams.get(key)) : key === 'fov' ? .1 : NaN])));
        const coordinateKey = JSON.stringify([input.ra, input.dec, input.fov]);
        if (req.method === 'GET') {
          owner(coordinates.get(coordinateKey), session);
          send(res, 200, await call(`/api/patch?ra=${input.ra}&dec=${input.dec}&fov=${input.fov}`)); return true;
        }
        const release = admission.acquire('observation analysis');
        try {
          access.charge(session);
          const result = await call('/api/patch', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input) });
          if (typeof result.id !== 'string' || !/^[a-z0-9_]{1,120}$/.test(result.id)) throw failure(502, 'Observation service returned an unexpected job.', 'upstream_invalid');
          // Completed cached data can be requested again; the last explicitly
          // started request owns its controls. No other session can cancel it.
          if (claims.size >= 256) {
            const oldest = [...claims].sort((a,b) => a[1].touched-b[1].touched)[0];
            if (oldest) { claims.delete(oldest[0]); for (const [key, id] of coordinates) if (id === oldest[0]) coordinates.delete(key); }
          }
          for (const [key, id] of coordinates) if (id === result.id) coordinates.delete(key);
          if (coordinates.size >= 256) coordinates.delete(coordinates.keys().next().value);
          claims.set(result.id, { owner:session, touched:Date.now() });
          coordinates.set(coordinateKey, result.id);
          send(res, ['queued','running'].includes(result.status) ? 202 : 200, result);
        } finally { track(release); }
        return true;
      }
      const match = /^\/api\/jobs\/([a-z0-9_]+)$/.exec(route);
      if (match && req.method === 'DELETE') {
        owner(match[1], session);
        send(res, 200, await call(`/api/observations/jobs/${match[1]}`, { method:'DELETE' })); return true;
      }
      throw failure(405, 'Method not allowed.');
    },
    close() { closed = true; },
  };
}
