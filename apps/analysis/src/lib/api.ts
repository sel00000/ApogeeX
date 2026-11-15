// API_BASE is an optional server origin / deployment prefix, not an /api suffix.
import type { TargetMeta } from '../types'
import type { Radec } from './coords'
import { normalizeApiBase, patchMetaUrl } from './api-location'

const CONFIG_TTL_MS = 5000
let hostingMode: { url: string; expires: number; apiBase?: unknown; localServices?: boolean; publicMode?: boolean } | null = null
const pageURL = () => typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
type Service = { apiBase: string; sessionRequired: boolean }
const sessions = new Map<string, { token: string | null; expires: number }>()
const pendingSessions = new Map<string, Promise<{ token: string | null; expires: number }>>()

async function observationService(signal?: AbortSignal | null): Promise<Service> {
  // An explicit API deployment remains authoritative. The shell configuration is
  // one level above /analysis/, including on /repository/analysis/ Pages URLs.
  const explicit = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (explicit) return {apiBase:normalizeApiBase(explicit, pageURL()),sessionRequired:true}
  if (typeof document === 'undefined') return {apiBase:'',sessionRequired:false}
  signal?.throwIfAborted()
  const url = new URL('../config.json', document.baseURI).href
  if (hostingMode?.url !== url || Date.now() >= hostingMode.expires) {
    try {
      const response = await fetch(url, { cache: 'no-cache', signal })
      if (!response.ok) return {apiBase:'',sessionRequired:false}
      const config = await response.json()
      hostingMode = { url, expires: Date.now() + CONFIG_TTL_MS, apiBase: config?.apiBase, localServices: config?.localServices, publicMode: config?.publicMode === true }
    } catch (error) {
      if (signal?.aborted) throw error
      // Missing/unreadable config does not prove static hosting: preserve the
      // real API's validation, availability and network error handling below.
      return {apiBase:'',sessionRequired:false}
    }
  }
  signal?.throwIfAborted()
  const apiBase = normalizeApiBase(hostingMode.apiBase, pageURL())
  if (!apiBase && !hostingMode.publicMode && hostingMode.localServices === false) {
    throw new Error('현재 웹사이트에는 새 관측 자료를 처리하는 Python 분석 서버가 연결되어 있지 않습니다. 준비된 대상의 관측·분석 결과는 계속 볼 수 있습니다. 서버 연결 후 다시 시도하거나 로컬 프로그램에서 실행하세요.')
  }
  return {apiBase,sessionRequired:!!apiBase || !!hostingMode.publicMode}
}

function sessionKey(service: Service): string { return service.apiBase || new URL(pageURL()).origin }
const storageKey = (key: string) => 'spherex-api-session:' + key

function forgetSession(key: string) {
  sessions.delete(key)
  try { sessionStorage.removeItem(storageKey(key)) } catch { /* Optional browser storage. */ }
}

function waitForSession<T>(pending: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return pending
  signal.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const abort=()=>{reject(signal.reason);signal.removeEventListener('abort',abort)}
    signal.addEventListener('abort',abort,{once:true})
    pending.then(value=>{signal.removeEventListener('abort',abort);resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
  })
}

async function sessionHeaders(service: Service, signal?: AbortSignal | null): Promise<Record<string,string>> {
  if (!service.sessionRequired) return {}
  signal?.throwIfAborted()
  const key = sessionKey(service)
  let session = sessions.get(key)
  if (!session) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null')
      if (stored && (stored.sessionToken === null || typeof stored.sessionToken === 'string' && /^[\x21-\x7e]{1,4096}$/.test(stored.sessionToken)) && Number.isFinite(stored.expiresAt) && stored.expiresAt > Date.now()+5000)
        session = {token:stored.sessionToken,expires:stored.expiresAt}
    } catch { /* Optional browser storage. */ }
    if (session) sessions.set(key,session)
  }
  if (!session || session.expires <= Date.now() + 5000) {
    let pending = pendingSessions.get(key)
    if (!pending) {
      pending = (async()=>{
        let response: Response
        try { response = await fetch(`${service.apiBase}/api/session`, {cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}) }
        catch (error) {
          throw new Error(`관측 분석 서버의 세션에 연결할 수 없습니다. 다시 시도하세요. (${(error as Error).message})`)
        }
        const local = ['localhost','127.0.0.1','[::1]'].includes(new URL(key).hostname)
        let issued: {token:string|null;expires:number}
        if (response.status === 404 && local) issued = {token:null,expires:Date.now()+CONFIG_TTL_MS*2}
        else {
          const body = await response.json().catch(()=>null)
          if (!response.ok || !body) throw new Error(body?.error ?? `분석 서버 세션 응답 HTTP ${response.status}`)
          if (body.publicMode === false) issued = {token:null,expires:Date.now()+CONFIG_TTL_MS*2}
          else {
            const expires = typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : NaN
            if (body.publicMode !== true || typeof body.sessionToken !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(body.sessionToken) || !Number.isFinite(expires) || expires <= Date.now())
              throw new Error('분석 서버 세션 응답 형식이 올바르지 않습니다.')
            issued = {token:body.sessionToken,expires}
          }
        }
        sessions.set(key,issued)
        try { sessionStorage.setItem(storageKey(key),JSON.stringify({sessionToken:issued.token,expiresAt:issued.expires})) } catch { /* Optional browser storage. */ }
        return issued
      })()
      pendingSessions.set(key,pending)
      void pending.finally(()=>pendingSessions.delete(key)).catch(()=>{})
    }
    session = await waitForSession(pending,signal)
  }
  return session.token ? {'X-Spherex-Session':session.token} : {}
}

export interface PatchJob {
  id: string
  url: string
  status: 'queued' | 'running' | 'done' | 'no_data' | 'fetch_failed' | 'failed' | 'cancelled'
  message?: string
  done?: number
  total?: number
  queue?: number
}

export function patchError(job: PatchJob): string | null {
  return job.status === 'failed' || job.status === 'fetch_failed' || job.status === 'cancelled'
    ? job.message || '관측 자료를 받거나 처리하지 못했습니다. 다시 시도할 수 있습니다.' : null
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-cache', ...options })
  } catch (e) {
    if (options.signal?.aborted) throw e
    throw new Error(`관측 분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요. (${(e as Error).message})`)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw Object.assign(new Error(body?.error ?? `서버 응답 HTTP ${res.status}`),{status:res.status})
  return body as T
}

async function get<T>(path: string, options: RequestInit = {}): Promise<T> {
  const service = await observationService(options.signal)
  const headers = new Headers(options.headers)
  for (const [name,value] of Object.entries(await sessionHeaders(service,options.signal))) headers.set(name,value)
  try {
    return await fetchJson<T>(`${service.apiBase}${path}`, {...options,headers,credentials:'omit',redirect:'error'})
  } catch (error) {
    // Never replay a mutation automatically; the next explicit retry gets a fresh session.
    if ((error as {status?:number}).status === 401) forgetSession(sessionKey(service))
    throw error
  }
}

export const resolveName = (name: string, signal?: AbortSignal) =>
  get<{ name: string; ra: number; dec: number; note: string; frame: string; coordinateEpoch: string }>(`/api/resolve?name=${encodeURIComponent(name)}`, { signal })

export const requestPatch = (c: Radec, fov: number, retry = false, signal?: AbortSignal) =>
  get<PatchJob>('/api/patch', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ra: c.ra, dec: c.dec, fov, retry }) })

export const pollPatch = (c: Radec, fov: number, signal?: AbortSignal) =>
  get<PatchJob>(`/api/patch?ra=${c.ra}&dec=${c.dec}&fov=${fov}`, { signal })

export const cancelPatch = (id: string) => {
  if (!/^[a-z0-9_]+$/.test(id)) return Promise.reject(new Error('분석 작업 식별자가 올바르지 않습니다.'))
  return get<PatchJob>(`/api/observations/jobs/${id}`, { method:'DELETE' })
}

export async function loadPatchMeta(job: PatchJob, signal?: AbortSignal): Promise<TargetMeta> {
  const {apiBase} = await observationService(signal)
  const url = patchMetaUrl(job.url, apiBase, pageURL())
  const meta = await fetchJson<TargetMeta>(url, { signal })
  if (meta.status === 'fetch_failed') throw new Error(meta.status_detail || '관측 자료 다운로드에 실패했습니다.')
  if (!Array.isArray(meta.visits)) throw new Error('관측 결과 형식이 올바르지 않습니다.')
  meta.base = url.replace(/meta\.json$/, '')
  return meta
}
