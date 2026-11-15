// Deployment bases contain an origin and optional path prefix, never an /api suffix.
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
const unsafePath = /[\\\u0000-\u0020?#%]/
const patchPath = /^\/(?:api\/observations\/)?data\/patches\/[a-z0-9_]+\/meta\.json$/

export function normalizeApiBase(value: unknown, pageURL = 'http://localhost/'): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new Error('분석 서버 주소 설정이 올바르지 않습니다.')
  const raw = value.trim()
  if (!raw) return ''
  if (unsafePath.test(raw) || raw.startsWith('//') || raw.split('/').some(part => part === '.' || part === '..'))
    throw new Error('분석 서버 주소 설정이 올바르지 않습니다.')
  let url: URL
  try { url = new URL(raw, raw.startsWith('/') ? new URL(pageURL).origin : undefined) }
  catch { throw new Error('분석 서버 주소 설정이 올바르지 않습니다.') }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && localHosts.has(url.hostname))) || url.username || url.password || /\/api\/?$/.test(url.pathname))
    throw new Error('분석 서버는 HTTPS 주소 또는 localhost 주소여야 하며 /api를 붙이지 않습니다.')
  const prefix = url.pathname.replace(/\/+$/, '')
  return url.origin + prefix
}

/** Accept backend route paths or absolute URLs within the configured API deployment. */
export function patchMetaUrl(value: string, apiBase: string, pageURL = 'http://localhost/'): string {
  const error = () => new Error('관측 결과 경로가 올바르지 않습니다.')
  if (typeof value !== 'string' || !value || unsafePath.test(value) || value.startsWith('//') || value.split('/').some(part => part === '.' || part === '..')) throw error()
  const base = new URL(apiBase || '/', pageURL)
  const prefix = base.pathname.replace(/\/+$/, '')
  let pathname: string
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    const url = new URL(value)
    if (url.origin !== base.origin || url.username || url.password || url.search || url.hash) throw error()
    pathname = url.pathname
  } else {
    pathname = '/' + value.replace(/^\/+/, '')
    // The API returns /api/... even when a reverse proxy adds a deployment prefix.
    if (patchPath.test(pathname)) pathname = prefix + pathname
  }
  if (!pathname.startsWith(prefix + '/') || !patchPath.test(pathname.slice(prefix.length))) throw error()
  return /^https?:\/\//.test(apiBase) ? base.origin + pathname : pathname
}
