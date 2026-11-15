/** Explicit contract with the common portal. Coordinates carry their frame and epoch. */
export interface SelectionMessage {
  type: 'spherex-select-target'
  target?: string
  ra?: number
  dec?: number
  label?: string
  tab?: 'motion' | 'variable' | 'spectrum' | 'provenance'
  frame?: string
  coordinateEpoch?: string
  observationMjd?: number
  predictionMjd?: number
  timeScale?: string
  observer?: string
  fovDeg?: number
}

export function selectionMessage(value: unknown): SelectionMessage | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.type !== 'spherex-select-target') return null
  const target = typeof v.target === 'string' && /^[a-z0-9_-]{1,64}$/.test(v.target) ? v.target : undefined
  const coords = typeof v.ra === 'number' && Number.isFinite(v.ra) && v.ra >= 0 && v.ra < 360 &&
    typeof v.dec === 'number' && Number.isFinite(v.dec) && Math.abs(v.dec) <= 90
  if (!target && !coords) return null
  // Apparent directions must be converted by the sender before archive lookup.
  if (coords && v.frame !== undefined && !['ICRS', 'ASTROM'].includes(String(v.frame))) return null
  const tabs = ['motion', 'variable', 'spectrum', 'provenance']
  return {
    type: 'spherex-select-target', target,
    ...(coords ? { ra: v.ra as number, dec: v.dec as number } : {}),
    label: typeof v.label === 'string' ? v.label.slice(0, 160) : undefined,
    tab: typeof v.tab === 'string' && tabs.includes(v.tab) ? v.tab as SelectionMessage['tab'] : undefined,
    ...(typeof v.frame === 'string' ? { frame: v.frame } : {}),
    ...(typeof v.coordinateEpoch === 'string' ? { coordinateEpoch: v.coordinateEpoch.slice(0, 64) } : {}),
    ...(typeof v.observationMjd === 'number' && Number.isFinite(v.observationMjd) ? { observationMjd: v.observationMjd } : {}),
    ...(typeof v.predictionMjd === 'number' && Number.isFinite(v.predictionMjd) ? { predictionMjd: v.predictionMjd } : {}),
    ...(typeof v.timeScale === 'string' && ['UTC', 'TDB', 'TT'].includes(v.timeScale) ? { timeScale: v.timeScale } : {}),
    ...(typeof v.observer === 'string' ? { observer: v.observer.slice(0, 80) } : {}),
    ...(typeof v.fovDeg === 'number' && Number.isFinite(v.fovDeg) && v.fovDeg >= .025 && v.fovDeg <= .5 ? { fovDeg: v.fovDeg } : {}),
  }
}

export function notifyShell(message: Record<string, unknown>) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin)
}

/** Share the selected child state through its unified parent, without inventing a target. */
export function embeddedShareURL(href: string): string {
  const u = new URL(href)
  if (u.searchParams.get('embed') !== '1') return href
  u.searchParams.delete('embed')
  const query = u.searchParams.toString()
  u.pathname = u.pathname.replace(/\/analysis(?:\/(?:index\.html)?)?$/, '/')
  u.search = ''
  u.hash = `analysis${query ? '?' + query : ''}`
  return u.href
}

export function notifyAnalysisURL(href = window.location.href) {
  const u = new URL(href)
  if (u.searchParams.get('embed') !== '1') return
  u.searchParams.delete('embed')
  notifyShell({ type: 'spherex-analysis-url', query: u.searchParams.toString() })
}

/** The moving viewer passes two distinct MJDs; neither is the date of a new detection. */
export function movingArchiveContext(search: string) {
  const q = new URLSearchParams(search)
  if (q.get('moving') !== '1') return null
  const instant = (key: string) => {
    const raw = q.get(key)
    if (!raw?.trim()) return undefined
    const mjd = Number(raw)
    const date = new Date((mjd - 40587) * 86_400_000)
    if (!Number.isFinite(mjd) || mjd < 0 || !Number.isFinite(date.getTime())) return undefined
    return { mjd, utc: date.toISOString().slice(0, 19).replace('T', ' ') + ' UTC' }
  }
  return { epoch: instant('epoch'), observation: instant('observationMjd') }
}

/** The portal switches the analysis app between its Find (sky) and workbench stages without reloading it. */
export function stageMessage(value: unknown): 'sky' | 'workbench' | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.type !== 'spherex-analysis-stage') return null
  return v.stage === 'sky' || v.stage === 'workbench' ? v.stage : null
}

/** `{ type: 'spherex-analysis-focus', target: 'sky-mode' }` from the portal: focus the pressed view-switch segment of Find. */
export function focusMessage(value: unknown): 'sky-mode' | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.type !== 'spherex-analysis-focus') return null
  return v.target === 'sky-mode' ? 'sky-mode' : null
}

// A focus request that arrived before the Find stage was shown waits here until SkyPanel mounts.
let pendingSkyModeFocus = false
/** Moves focus to the pressed view-switch segment if it is on the page; otherwise keeps the request for later. */
export function requestSkyModeFocus(): void {
  pendingSkyModeFocus = true
  flushSkyModeFocus()
}
export function flushSkyModeFocus(): void {
  if (!pendingSkyModeFocus || typeof document === 'undefined') return
  const el = document.querySelector<HTMLElement>('[data-testid="sky-mode-spherex"]')
  if (!el) return
  el.focus()
  pendingSkyModeFocus = false
}
