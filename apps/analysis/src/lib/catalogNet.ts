// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// Small network helpers for the catalogue services: per-request timeout, caller AbortSignal,
// at most four requests in flight per host, and an ordered list of mirrors per service.
// Requests are plain GETs with no custom headers, so browsers send them without a CORS preflight.

export const DEFAULT_TIMEOUT_MS = 20000;
const MAX_PER_HOST = 4;

const active = new Map<string, number>();
const waiting = new Map<string, (() => void)[]>();

async function acquire(host: string): Promise<void> {
  const n = active.get(host) ?? 0;
  if (n < MAX_PER_HOST) {
    active.set(host, n + 1);
    return;
  }
  await new Promise<void>((resolve) => {
    const q = waiting.get(host) ?? [];
    q.push(resolve);
    waiting.set(host, q);
  });
}

function release(host: string): void {
  const q = waiting.get(host);
  const next = q?.shift();
  if (next) {
    next(); // slot passes straight to the next waiter
    return;
  }
  active.set(host, Math.max(0, (active.get(host) ?? 1) - 1));
}

export function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

function abortError(): Error {
  const e = new Error('Request aborted');
  e.name = 'AbortError';
  return e;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * GET a URL with a timeout. Rejects with AbortError when the caller's signal fires,
 * and with a plain Error ("timed out after N s", "HTTP 404") otherwise.
 * The body is read inside the timeout, so a stalled download cannot hang forever.
 */
export async function fetchWithTimeout<T>(
  url: string,
  read: (res: Response) => Promise<T>,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (opts.signal?.aborted) throw abortError();
  const host = hostOf(url);
  await acquire(host);
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, timeoutMs);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
    return await read(res);
  } catch (e) {
    if (opts.signal?.aborted) throw abortError();
    if (timedOut) throw new Error(`timed out after ${Math.round(timeoutMs / 1000)} s`);
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
    release(host);
  }
}

/**
 * Try each mirror URL in order and return the first success. Every failure is remembered, and when
 * all mirrors fail the thrown Error names the service and lists each host with its reason.
 * A caller abort stops immediately (AbortError), without trying further mirrors.
 */
export async function tryMirrors<T>(
  service: string,
  urls: string[],
  read: (res: Response, url: string) => Promise<T>,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const reasons: string[] = [];
  for (const url of urls) {
    try {
      return await fetchWithTimeout(url, (res) => read(res, url), opts);
    } catch (e) {
      if (isAbortError(e)) throw e;
      reasons.push(`${hostOf(url)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`${service} is unavailable (${reasons.join('; ')})`);
}

/** Read a text body, failing on HTTP errors (status 204 returns ''). */
export async function readText(res: Response): Promise<string> {
  if (res.status === 204) return '';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
