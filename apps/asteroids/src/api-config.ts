import {LocalError} from './i18n';
/// <reference types="vite/client" />
/** apiBase is a server origin/deployment prefix, never the /api route itself. */
export function normalizeApiBase(value: unknown, origin = typeof location === 'undefined' ? undefined : location.origin): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || /[\\\s\u0000]/.test(value)) throw new LocalError('api.badFormat');
  if(value.startsWith('//'))throw new LocalError('api.badFormat');
  const url = value.startsWith('/') ? new URL(value, origin) : new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || /%|(?:^|\/)\.\.(?:\/|$)/.test(value)) throw new LocalError('api.https');
  const path = url.pathname.replace(/\/+$/, '');
  if (/\/api$/.test(path)) throw new LocalError('api.noApi');
  return url.origin + path;
}

export interface ApiConfig { apiBase: string; localServices?: boolean; publicMode?: boolean }
let cached: {url: string; until: number; config: ApiConfig}|null = null;

export async function loadApiConfig(signal?: AbortSignal, force = false): Promise<ApiConfig> {
  signal?.throwIfAborted();
  const explicit = import.meta.env.VITE_API_BASE?.trim();
  if (explicit) return {apiBase: normalizeApiBase(explicit)};
  const url = new URL('../config.json', document.baseURI).href;
  if (!force && cached?.url === url && cached.until > Date.now()) return cached.config;
  let value: unknown;
  try {
    const response = await fetch(url, {cache:'no-cache', credentials:'omit', signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000)});
    if (!response.ok) return {apiBase:''};
    value = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    // Static files do not depend on this request; missing config preserves local API fallback.
    return {apiBase:''};
  }
  const data = value as {apiBase?: unknown; localServices?: unknown; publicMode?: unknown}|null;
  const config: ApiConfig = {apiBase: normalizeApiBase(data?.apiBase), ...(typeof data?.localServices === 'boolean' ? {localServices:data.localServices} : {}), ...(typeof data?.publicMode === 'boolean' ? {publicMode:data.publicMode} : {})};
  cached = {url, until:Date.now()+5000, config};
  return config;
}

type Session = {sessionToken: string|null; expiresAt: number};
const sessions = new Map<string, Session>();
const pendingSessions = new Map<string, Promise<Session>>();
function sessionKey(base: string) {return 'spherex-api-session:' + (base || location.origin);}
async function createSession(config: ApiConfig, key: string): Promise<Session> {
    const response = await fetch(config.apiBase+'/api/session', {credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    // A pre-integration local development server may not implement sessions.
    if(response.status===404 && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(config.apiBase)) return {sessionToken:null,expiresAt:Date.now()+60000};
    if (!response.ok) throw new LocalError('api.session',{s:response.status});
    const value = await response.json();
    let session: Session;
    if (value.publicMode === false) session={sessionToken:null,expiresAt:Date.now()+60000};
    else {
      const expiresAt = Date.parse(value.expiresAt);
      if(value.publicMode!==true || typeof value.sessionToken!=='string' || !/^[\x21-\x7e]{1,4096}$/.test(value.sessionToken) || !Number.isFinite(expiresAt) || expiresAt<=Date.now()) throw new LocalError('api.sessionBad');
      session={sessionToken:value.sessionToken,expiresAt};
    }
    sessions.set(key,session);
    try{sessionStorage.setItem(key,JSON.stringify(session));}catch{/* Optional persistence. */}
    return session;
}
export async function sessionHeaders(config: ApiConfig, signal?: AbortSignal): Promise<Record<string,string>> {
  signal?.throwIfAborted();
  if (!config.apiBase && !config.publicMode) return {};
  const key = sessionKey(config.apiBase);
  let session = sessions.get(key);
  if (!session) {try {const stored = sessionStorage.getItem(key);if(stored){const value=JSON.parse(stored);if((value.sessionToken===null||typeof value.sessionToken==='string'&&/^[\x21-\x7e]{1,4096}$/.test(value.sessionToken))&&Number.isFinite(value.expiresAt))session=value;}}catch{/* Optional persistence. */}}
  if (!session || session.expiresAt <= Date.now()+5000) {
    let pending=pendingSessions.get(key);
    if(!pending){pending=createSession(config,key).finally(()=>pendingSessions.delete(key));pendingSessions.set(key,pending);}
    // One caller cancelling does not change the owner session used by other callers.
    session=await new Promise<Session>((resolve,reject)=>{
      const abort=()=>{reject(signal?.reason);signal?.removeEventListener('abort',abort);};
      signal?.addEventListener('abort',abort,{once:true});
      pending!.then(value=>{signal?.removeEventListener('abort',abort);resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});
    });
  }
  signal?.throwIfAborted();
  return session.sessionToken ? {'X-Spherex-Session':session.sessionToken} : {};
}
export function forgetSession(config: ApiConfig) {
  const key=sessionKey(config.apiBase);sessions.delete(key);
  try{sessionStorage.removeItem(key);}catch{/* Optional persistence. */}
}
