import { createHash, randomBytes } from 'node:crypto';

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const digest = token => createHash('sha256').update(token).digest('hex');
export function boundedNumber(value, fallback, min, max) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw Error(`Configuration must be between ${min} and ${max}.`);
  return number;
}

/** One lease covers dependency probes, observation jobs, asteroid jobs and scene generation. */
export function createAdmission() {
  let current = null;
  return {
    acquire(kind) {
      if (current) throw fail(429, 'Another analysis is running. Please wait for it to finish.', 'analysis_busy');
      const lease = { kind, startedAt: Date.now() };
      current = lease;
      let released = false;
      return () => { if (!released && current === lease) current = null; released = true; };
    },
    get busy() { return !!current; },
  };
}

/** Anonymous, bounded browser sessions are ownership tokens, not user accounts. */
export function createPublicAccess({ enabled = process.env.SPHEREX_PUBLIC_MODE === '1',
  origins = process.env.SPHEREX_ALLOWED_ORIGINS || '', trustProxy = process.env.SPHEREX_TRUST_PROXY === '1',
  now = Date.now, sessionTtlMs = 6 * 3600_000, maxSessions = 256, perIpLimit = 12, globalLimit = 120,
  maxFov = boundedNumber(process.env.SPHEREX_MAX_FOV, .5, .025, .5),
  jobTimeoutSeconds = boundedNumber(process.env.SPHEREX_JOB_TIMEOUT_SECONDS, 1800, 10, 1800) } = {}) {
  const allowed = new Set((enabled ? String(origins).split(',') : []).map(value => value.trim()).filter(Boolean).map(value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Public origins must be exact HTTPS origins (no paths or wildcards).');
    return url.origin;
  }));
  if (enabled && !allowed.size) throw Error('SPHEREX_PUBLIC_MODE=1 requires SPHEREX_ALLOWED_ORIGINS.');
  const sessions = new Map(), rates = new Map();
  let total = { time: now(), count: 0 };
  const limits = { maxConcurrentJobs: 1, maxFov, jobTimeoutSeconds, maxJobsPerHour:8, maxLookupsPerHour:120 };
  function sweep() {
    const time = now();
    for (const [key, session] of sessions) if (session.expires <= time) sessions.delete(key);
    for (const [key, rate] of rates) if (time - rate.time >= 3600_000) rates.delete(key);
    if (time - total.time >= 3600_000) total = { time, count: 0 };
  }
  function origin(req, required = true) {
    const value = req.headers.origin;
    if (typeof value === 'string' && allowed.has(value)) return value;
    // Same-origin GET fetches may omit Origin. Validate the browser's same-origin
    // assertion against the allowlist rather than trusting X-Forwarded-Host.
    if (!value && req.headers['sec-fetch-site'] === 'same-origin') {
      const candidate = `https://${req.headers.host || ''}`;
      if (allowed.has(candidate)) return candidate;
    }
    if (!value && !required) return '';
    throw fail(403, 'This website is not an allowed API origin.', 'origin_forbidden');
  }
  function cors(req, res) {
    if (!enabled) return false;
    const value = origin(req, req.method === 'OPTIONS');
    if (value) {
      res.setHeader('Access-Control-Allow-Origin', value);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Retry-After, Content-Range, Accept-Ranges');
    }
    if (req.method !== 'OPTIONS') return false;
    const method = req.headers['access-control-request-method'] || '';
    const headers = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
    if (!['GET','HEAD','POST','DELETE'].includes(method) || headers.some(x => !['content-type','x-spherex-session','range','if-none-match'].includes(x))) throw fail(403, 'This cross-origin request is not allowed.', 'cors_forbidden');
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-Spherex-Session, Range, If-None-Match', 'Access-Control-Max-Age': '600' });
    res.end(); return true;
  }
  function clientKey(req) {
    let address = req.socket?.remoteAddress || 'unknown';
    if (trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim();
      if (forwarded && /^[0-9a-fA-F:.]{3,64}$/.test(forwarded)) address = forwarded;
    }
    return digest(address);
  }
  function issue(req) {
    if (!enabled) return { publicMode: false, sessionToken: null, limits };
    origin(req); sweep();
    const key = clientKey(req), time = now();
    const rate = rates.get(key) || { time, count: 0 };
    if (sessions.size >= maxSessions || rate.count >= perIpLimit || total.count >= globalLimit || (!rates.has(key) && rates.size >= 1024)) throw fail(429, 'Session limit reached. Please try again later.', 'session_limit');
    rate.count++; total.count++; rates.set(key, rate);
    const token = randomBytes(32).toString('hex'), expires = time + sessionTtlMs;
    sessions.set(digest(token), { id: randomBytes(16).toString('hex'), expires, rateStart:time, jobs:0, lookups:0 });
    return { publicMode: true, sessionToken: token, expiresAt: new Date(expires).toISOString(), limits };
  }
  function session(req) {
    if (!enabled) return null;
    origin(req); sweep();
    const token = req.headers['x-spherex-session'];
    const value = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? sessions.get(digest(token)) : null;
    if (!value) throw fail(401, 'The analysis session expired. Please reconnect and try again.', 'session_required');
    return value.id;
  }
  function charge(id, kind = 'job') {
    if (!enabled) return;
    const value = [...sessions.values()].find(item => item.id === id);
    if (!value || value.expires <= now()) throw fail(401, 'The analysis session expired.', 'session_required');
    if (now() - value.rateStart >= 3600_000) { value.rateStart = now(); value.jobs = 0; value.lookups = 0; }
    const key = kind === 'lookup' ? 'lookups' : 'jobs', maximum = key === 'lookups' ? limits.maxLookupsPerHour : limits.maxJobsPerHour;
    if (value[key] >= maximum) throw fail(429, 'This session has reached its hourly analysis limit. Please try again later.', 'job_rate_limit');
    value[key]++;
  }
  return { enabled, limits, origin, cors, issue, session, charge };
}
