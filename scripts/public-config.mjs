import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function serviceAddress(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) return '';
  const local = trimmed.startsWith('/') && !trimmed.startsWith('//');
  let url;
  try { url = new URL(trimmed, local ? 'https://config.invalid' : undefined); }
  catch { throw new Error(`${name} must be an HTTPS service address or an absolute path.`); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, query parameters, fragments, or insecure remote HTTP.`);
  }
  return local ? url.pathname.replace(/\/$/, '') || '/' : url.href.replace(/\/$/, '');
}

async function savedConfig(root) {
  try { return JSON.parse(await readFile(join(root, 'deployment/public.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {}; }
}

/** The search box's language-model fallback (an "ask" function). Empty means the fallback is off. */
export function askAddress(saved, env = process.env) {
  return serviceAddress(env.SPHEREX_ASK_URL ?? saved?.askUrl ?? '', 'askUrl');
}

/** askUrl alone, for the local server's /config.json (same value as the built config.json). */
export async function publicAskUrl(root, env = process.env) {
  return askAddress(await savedConfig(root), env);
}

export async function publicConfig(root, env = process.env) {
  const saved = await savedConfig(root);
  return {
    version: '5.0.0',
    apiBase: serviceAddress(env.SPHEREX_API_BASE ?? saved.apiBase ?? '', 'apiBase'),
    askUrl: askAddress(saved, env),
    localServices: false,
  };
}
