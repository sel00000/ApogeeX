import type { TargetMeta, TargetsIndex } from '../types'
import { mockMeta, mockTargets } from './mock'

export const isMock = new URLSearchParams(window.location.search).get('mock') === '1'

const base = `${import.meta.env.BASE_URL}data`

export class DataError extends Error {
  url: string
  constructor(url: string, message: string) {
    super(message)
    this.url = url
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-cache', signal })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new DataError(url, `네트워크 오류: ${(e as Error).message}`)
  }
  if (!res.ok) throw new DataError(url, `HTTP ${res.status}`)
  // dev servers / Pages may answer a missing file with an HTML fallback page
  if (!(res.headers.get('content-type') ?? '').includes('json'))
    throw new DataError(url, '준비된 관측 데이터 파일을 찾지 못했습니다.')
  try {
    return (await res.json()) as T
  } catch {
    throw new DataError(url, 'JSON 해석 실패')
  }
}

// No silent fallback: real mode only ever reads baked files; mock only with ?mock=1.
export function loadTargets(signal?: AbortSignal): Promise<TargetsIndex> {
  if (isMock) return Promise.resolve(mockTargets())
  return getJson<TargetsIndex>(`${base}/targets.json`, signal)
}

export function loadMeta(id: string, signal?: AbortSignal): Promise<TargetMeta> {
  if (!/^[a-z0-9_-]+$/.test(id)) return Promise.reject(new DataError('', '대상 식별자가 올바르지 않습니다.'))
  if (isMock) return Promise.resolve(mockMeta(id))
  return getJson<TargetMeta>(`${base}/${id}/meta.json`, signal)
}

export function frameUrl(id: string, png: string, root?: string): string {
  if (!root) return png.startsWith('data:') ? png : `${base}/${id}/${png}`
  // A dynamic frame must stay inside its validated result directory.
  if (/[\\\u0000-\u0020?#%]/.test(png) || png.split('/').some(part => part === '.' || part === '..')) throw new DataError(png, '관측 영상 경로가 올바르지 않습니다.')
  const parent = new URL(root, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI)
  const url = new URL(png, parent)
  if (!/^https?:$/.test(url.protocol) || url.origin !== parent.origin || !url.pathname.startsWith(parent.pathname) || url.username || url.password)
    throw new DataError(png, '관측 영상 경로가 올바르지 않습니다.')
  return /^https?:\/\//.test(root) ? url.href : url.pathname
}
