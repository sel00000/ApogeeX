import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { DataError, isMock, loadMeta, loadTargets } from './lib/data'
import { usePlayer } from './lib/usePlayer'
import { cancelPatch, loadPatchMeta, patchError, pollPatch, requestPatch, resolveName } from './lib/api'
import type { PatchJob } from './lib/api'
import { fmtRadec, parseCoords } from './lib/coords'
import type { Radec } from './lib/coords'
import { readView, writeView } from './lib/urlState'
import { LANG_KEY, appTitle, langMessage, readStoredLang, writeStoredLang } from './lib/lang'
import { missionFor } from './lib/missions'
import { useL } from './lib/i18n'
import { sesame } from './lib/sky'
import { useTime, visitIndexAt } from './store'
import type { TargetMeta, TargetsIndex } from './types'
import { Badge } from './components/Badge'
import { BlinkViewer } from './components/BlinkViewer'
import { Timeline } from './components/Timeline'
import { PatchInfo } from './components/PatchInfo'
import { Findings, Guides, MissionCard, SkyLocator } from './components/Rail'
import { embeddedShareURL, movingArchiveContext, notifyAnalysisURL, notifyShell, requestSkyModeFocus, focusMessage, selectionMessage, stageMessage } from './lib/integration'

const Scene3D = lazy(() => import('./components/Scene3D').then((m) => ({ default: m.Scene3D })))
const SkyPanel = lazy(() => import('./components/SkyPanel').then((m) => ({ default: m.SkyPanel })))
const AnalysisTabs = lazy(() => import('./components/AnalysisTabs').then((m) => ({ default: m.AnalysisTabs })))

type Load<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'error'; error: DataError }
type PatchReq = { c: Radec; fov: number; label?: string; retry?: boolean; frame?: string; coordinateEpoch?: string; observationMjd?: number; predictionMjd?: number; timeScale?: string; observer?: string }

const FOVS = [0.1, 0.2, 0.3]

function errOf(e: unknown): DataError {
  return e instanceof DataError ? e : new DataError('?', String(e))
}

function Failure({ title, error }: { title: string; error: DataError }) {
  const L = useL()
  return (
    <div className="failure" role="alert" data-testid="fetch-failed">
      <strong>{title}</strong>
      <div>{error.message}</div>
      <code>{error.url}</code>
      <p>{L('실제 데이터를 읽지 못했습니다. 대체 데이터는 표시하지 않습니다.', 'The real data could not be read. Nothing is substituted.')}</p>
    </div>
  )
}

/** Angular separation in degrees. */
function sep(a: Radec, b: Radec) {
  const r = Math.PI / 180
  const c = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r)
  return Math.acos(Math.max(-1, Math.min(1, c))) / r
}

function patchFromUrl(): PatchReq | null {
  const q = new URLSearchParams(window.location.search)
  const ra = q.get('ra')
  const dec = q.get('dec')
  if (ra === null || dec === null) return null
  const c = parseCoords(`${ra} ${dec}`)
  const fov = Number(q.get('fov') ?? 0.1)
  const field = Number.isFinite(fov) && fov >= .025 && fov <= .5 ? fov : .1
  const num = (key: string) => q.has(key) && Number.isFinite(Number(q.get(key))) ? Number(q.get(key)) : undefined
  return c ? { c, fov: field, label: q.get('label') ?? undefined, frame: q.get('frame') ?? 'ICRS', coordinateEpoch: q.get('coordinateEpoch') ?? undefined,
    observationMjd: num('observationMjd'), predictionMjd: num('predictionMjd') ?? num('epoch'), timeScale: q.get('timeScale') ?? undefined, observer: q.get('observer') ?? undefined } : null
}

function setUrl(params: Record<string, string>) {
  const u = new URL(window.location.href)
  for (const k of ['target', 'ra', 'dec', 'fov', 'q', 'label', 'frame', 'coordinateEpoch', 'observationMjd', 'predictionMjd', 'timeScale', 'observer']) u.searchParams.delete(k)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  window.history.replaceState(null, '', u)
  notifyAnalysisURL(u.href)
}

function SearchBar({ onPatch, busy, embedded }: { onPatch: (p: PatchReq) => void; busy: boolean; embedded: boolean }) {
  const L = useL()
  const [text, setText] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [fov, setFov] = useState(0.1)
  const [err, setErr] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const active = useRef<AbortController | null>(null)
  const cancel = () => { active.current?.abort(); active.current = null; setResolving(false) }
  useEffect(() => () => active.current?.abort(), [])
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    cancel()
    setErr(null)
    const c = parseCoords(text)
    if (c) return onPatch({ c, fov })
    if (!text.trim()) return setErr(L('좌표나 천체 이름을 입력하세요', 'Type coordinates or a name'))
    const controller = new AbortController()
    active.current = controller
    setResolving(true)
    try {
      // names resolve in the browser first (CDS Sesame, live); the search server is the fallback
      const s = await sesame(text.trim(), controller.signal).catch((error) => { if (controller.signal.aborted) throw error; return null })
      if (controller.signal.aborted) return
      if (s) onPatch({ c: { ra: s.ra, dec: s.dec }, fov, label: s.name, frame: 'ICRS', coordinateEpoch: 'J2000' })
      else {
        const r = await resolveName(text.trim(), controller.signal)
        if (!controller.signal.aborted) onPatch({ c: { ra: r.ra, dec: r.dec }, fov, label: r.name, frame: r.frame, coordinateEpoch: r.coordinateEpoch })
      }
    } catch (ex) {
      if (!controller.signal.aborted) setErr(L('이름을 찾지 못함: ', 'Name not found: ') + (ex as Error).message)
    } finally {
      if (active.current === controller) { active.current = null; setResolving(false) }
    }
  }
  useEffect(() => {
    if (!embedded && new URLSearchParams(window.location.search).get('q')) submit()
  }, []) // eslint-disable-line
  if (embedded) return <button className="ghost" data-tutorial="analysis-search" onClick={() => notifyShell({ type: 'spherex-open-search' })}>{L('천체 통합 검색', 'Search the sky')}</button>
  return (
    <form className="search" onSubmit={submit} data-testid="search" data-tutorial="analysis-search">
      <input
        value={text}
        onChange={(e) => { cancel(); setText(e.target.value) }}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}
        placeholder={L('천체 이름이나 좌표 (예: M42, 133.8 -7.2)', 'Name or coordinates (e.g. M42, 133.8 -7.2)')}
        aria-label={L('RA·Dec 좌표 또는 천체 이름', 'RA Dec coordinates or object name')}
      />
      <select value={fov} onChange={(e) => setFov(+e.target.value)} aria-label={L('시야', 'Field of view')}>
        {FOVS.map((f) => <option key={f} value={f}>{f}°</option>)}
      </select>
      <button type="submit" disabled={busy || resolving}>{resolving ? L('찾는 중…', 'Finding…') : L('보기', 'Show')}</button>
      {err && <span className="warn small search-err">{err}</span>}
    </form>
  )
}

function ShareButton() {
  const L = useL()
  const [done, setDone] = useState(false)
  const copy = async () => {
    const href = embeddedShareURL(window.location.href)
    try {
      await navigator.clipboard.writeText(href)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      window.prompt(L('이 주소를 복사하세요', 'Copy this address'), href)
    }
  }
  return <button className="ghost" onClick={copy} data-testid="share">{done ? L('복사했습니다', 'Copied') : L('링크 복사', 'Copy link')}</button>
}

function StageHead({ meta }: { meta: TargetMeta }) {
  const t = useTime((s) => s.tMjd)
  const k = visitIndexAt(meta, t)
  const v = meta.visits[k]
  const L = useL()
  const lang = useTime((s) => s.lang)
  const tag = meta.kind === 'patch' ? L('좌표 검색 영역', 'Searched patch') : missionFor(meta.id, false, lang)?.tag
  return (
    <div className="stage-head">
      <div>
        <h2 className="target-name">{meta.display_name}</h2>
        {tag && <p className="target-tag">{tag}</p>}
      </div>
      <div className="now-card" data-testid="now-card">
        <span className="now-date">{v.utc.slice(0, 10)}</span>
        <span className="now-meta">{L('관측', 'Visit')} {k + 1} / {meta.visits.length}</span>
      </div>
      <div className="prov-legend" aria-label={L('값의 출처 표시', 'Provenance of values')}>
        <Badge kind="spherex" /><Badge kind="catalog" /><Badge kind="model" />
      </div>
    </div>
  )
}

export default function App() {
  const [embedded] = useState(() => new URLSearchParams(window.location.search).get('embed') === '1')
  const [movingContext, setMovingContext] = useState(() => patchFromUrl() ? movingArchiveContext(window.location.search) : null)
  const [index, setIndex] = useState<Load<TargetsIndex>>({ state: 'loading' })
  const [meta, setMeta] = useState<Load<TargetMeta> | null>(null)
  const [patch, setPatch] = useState<PatchReq | null>(patchFromUrl)
  const [job, setJob] = useState<PatchJob | null>(null)
  const [jobErr, setJobErr] = useState<string | null>(null)
  const targetId = useTime((s) => s.targetId)
  const ui = useTime((s) => s.ui)
  const lang = useTime((s) => s.lang)
  const stage = useTime((s) => s.stage)
  const L = useL()
  const { setTarget, setTime, setUi, setTab, setLang, setStage } = useTime.getState()

  useEffect(() => {
    const onSelection = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      if (event.data?.type === 'spherex-analysis-pause') { useTime.getState().setSuspended(event.data.paused !== false); return }
      if (event.data?.type === 'spherex-analysis-resume') { useTime.getState().setSuspended(false); return }
      // the portal's language toggle (spec D1); target, time, tab and stage stay as they are
      const nextLang = langMessage(event.data)
      if (nextLang) { useTime.getState().setLang(nextLang); return }
      // the portal's menu switches between Find (sky) and the workbench without reloading this app
      // the portal asks for focus on Find's view switch (now, or once the Find stage is shown)
      if (focusMessage(event.data)) { requestSkyModeFocus(); return }
      const nextStage = stageMessage(event.data)
      if (nextStage) {
        // a changed stage reports its URL through writeView; an unchanged one reports it here
        if (useTime.getState().stage === nextStage) notifyAnalysisURL()
        else setStage(nextStage)
        return
      }
      const selection = selectionMessage(event.data)
      if (!selection) return
      setMovingContext(null)
      useTime.getState().stop()
      if (selection.target) { setPatch(null); setTarget(selection.target) }
      else if (selection.ra !== undefined && selection.dec !== undefined)
        setPatch({ c: { ra: selection.ra, dec: selection.dec }, fov: selection.fovDeg ?? .1, label: selection.label, frame: selection.frame,
          coordinateEpoch: selection.coordinateEpoch, observationMjd: selection.observationMjd, predictionMjd: selection.predictionMjd, timeScale: selection.timeScale, observer: selection.observer })
      setStage('workbench')
      if (selection.tab) { setUi('research'); setTab(selection.tab) }
    }
    window.addEventListener('message', onSelection)
    const onStorage = (e: StorageEvent) => { if (e.key === LANG_KEY) useTime.getState().setLang(readStoredLang()) }
    window.addEventListener('storage', onStorage)
    notifyShell({ type: 'spherex-analysis-ready' })
    return () => { window.removeEventListener('message', onSelection); window.removeEventListener('storage', onStorage); useTime.getState().stop(); useTime.getState().setSuspended(false) }
  }, [setTarget, setStage, setUi, setTab])

  useEffect(() => {
    if (movingContext) return
    const u = new URL(window.location.href)
    for (const key of ['moving', 'epoch']) u.searchParams.delete(key)
    window.history.replaceState(null, '', u)
    notifyAnalysisURL(u.href)
  }, [movingContext])

  // the view in the URL (mode, analysis tab, visit) is restored once
  const [initial] = useState(readView)
  useEffect(() => {
    setUi(initial.ui)
    setLang(initial.lang)
    setStage(initial.stage)
    if (initial.tab) setTab(initial.tab)
  }, [initial, setUi, setTab, setLang, setStage])
  useEffect(() => writeView({ ui }), [ui])
  useEffect(() => { writeView({ lang }); document.documentElement.lang = lang; document.title = appTitle(lang) }, [lang])
  // standalone, the app's own switch writes the shared key too (inside the portal only the portal writes it)
  const chooseLang = (l: 'ko' | 'en') => { setLang(l); if (!embedded) writeStoredLang(l) }
  useEffect(() => writeView({ stage }), [stage])

  useEffect(() => {
    const controller = new AbortController()
    loadTargets(controller.signal)
      .then((v) => {
        if (controller.signal.aborted) return
        setIndex({ state: 'ok', value: v })
        const fromUrl = new URLSearchParams(window.location.search).get('target')
        const first = v.targets.find((t) => t.id === fromUrl) ?? v.targets[0]
        if (first && !patchFromUrl()) setTarget(first.id)
        if (initial.tab) setTab(initial.tab)
      })
      .catch((e) => { if (!controller.signal.aborted) setIndex({ state: 'error', error: errOf(e) }) })
    return () => controller.abort()
  }, [setTarget, setTab, initial])

  const entry = !patch && index.state === 'ok' ? index.value.targets.find((t) => t.id === targetId) : undefined

  // pre-baked test target
  useEffect(() => {
    if (patch) return
    if (!entry || entry.status !== 'ok') return setMeta(null)
    let live = true
    const controller = new AbortController()
    setUrl({ target: entry.id })
    setMeta({ state: 'loading' })
    loadMeta(entry.id, controller.signal)
      .then((m) => {
        if (!live) return
        setMeta({ state: 'ok', value: m })
        const start = initial.visit !== null && initial.visit < m.visits.length && new URLSearchParams(window.location.search).get('target') === m.id ? initial.visit : 0
        if (m.visits.length) setTime(m.visits[start].mjd)
      })
      .catch((e) => live && setMeta({ state: 'error', error: errOf(e) }))
    return () => { live = false; controller.abort() }
  }, [entry, patch, setTime, initial])

  // coordinate search: start / poll the server job, then load the patch
  useEffect(() => {
    if (!patch) return
    let live = true
    let timer = 0
    const controller = new AbortController()
    const context = Object.fromEntries(Object.entries(patch).filter(([key, value]) => ['frame', 'coordinateEpoch', 'observationMjd', 'predictionMjd', 'timeScale', 'observer'].includes(key) && value !== undefined).map(([key, value]) => [key, String(value)]))
    setUrl({ ra: String(patch.c.ra), dec: String(patch.c.dec), fov: String(patch.fov), ...context, ...(patch.label ? { label: patch.label } : {}) })
    setMeta(null)
    setJob(null)
    setJobErr(null)
    if (patch.frame && !['ICRS', 'ASTROM'].includes(patch.frame)) {
      setJobErr(L('이동 천체의 겉보기 좌표는 고정 ICRS 영역으로 바로 분석할 수 없습니다. 소행성 분석에서 대상과 기간을 선택하거나, 천구에서 고정 영역을 선택하세요.', 'Apparent coordinates of a moving object cannot be treated as a fixed ICRS field. Select the object and dates in asteroid analysis, or select a fixed sky region.'))
      return () => controller.abort()
    }
    let started = false
    const poll = async () => {
      try {
        const j = started ? await pollPatch(patch.c, patch.fov, controller.signal) : await requestPatch(patch.c, patch.fov, patch.retry === true, controller.signal)
        started = true
        if (!live) return
        setJob(j)
        if (j.status === 'queued' || j.status === 'running') {
          timer = window.setTimeout(poll, 2000)
          return
        }
        const failure = patchError(j)
        if (failure) return setJobErr(failure)
        const m = await loadPatchMeta(j, controller.signal)
        if (!live) return
        setMeta({ state: 'ok', value: m })
        if (m.visits.length) setTime(m.visits[0].mjd)
      } catch (e) {
        if (live) setJobErr((e as Error).message)
      }
    }
    poll()
    return () => {
      live = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [patch, setTime])

  const m = meta?.state === 'ok' && meta.value?.visits?.length > 0 ? meta.value : null
  const isPatch = m?.kind === 'patch'
  usePlayer(m)

  // keep the visit in the URL so a copied link opens the same frame
  const tNow = useTime((s) => s.tMjd)
  const kNow = m ? visitIndexAt(m, tNow) : null
  useEffect(() => { if (kNow !== null) writeView({ visit: kNow }) }, [kNow])

  const openTarget = (id: string) => {
    // re-selecting the target already on screen keeps the current view (tab, time, mode)
    if (!patch && id === useTime.getState().targetId) return
    setMovingContext(null)
    setPatch(null)
    setTarget(id)
  }
  const near = patch && index.state === 'ok'
    ? index.value.targets.find((t) => t.ra !== undefined && sep(patch.c, { ra: t.ra, dec: t.dec! }) < patch.fov / 2)
    : undefined
  const busy = !!patch && !m && !jobErr && meta?.state !== 'ok'
  const openSky = () => setStage('sky')
  useEffect(() => {
    if (m) notifyShell({ type: 'spherex-analysis-loaded', target: m.id, label: m.display_name, observations: m.visits.length })
  }, [m])

  return (
    <div className={`app ui-${ui}${embedded ? ' embedded' : ''}`} data-tutorial="analysis-status" data-analysis-kind={patch ? 'patch' : 'target'} data-analysis-ready={m ? 'true' : 'false'}>
      {isMock && (
        <div className="mock-banner" data-testid="mock-banner">
          {L('모의 데이터: UI 개발용 가짜 영상·좌표입니다. 실제 SPHEREx 관측이 아닙니다.', 'Mock data: fake images and positions for UI development, not real SPHEREx observations.')}
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1 className="brand-title">{L('방구석 천문학자', 'Armchair Astronomer')}</h1>
        </div>
        <SearchBar onPatch={(p) => { setMovingContext(null); setPatch(p); setStage('workbench') }} busy={busy} embedded={embedded} />
        <div className="space-switch" role="group" aria-label={L('작업 공간', 'Workspace')}>
          <button className={stage === 'sky' ? 'on' : ''} aria-pressed={stage === 'sky'} onClick={openSky} data-testid="stage-sky" title={L('천구에서 천체를 고르고 NASA SPHEREx 영상을 불러옵니다', 'Pick a spot on the sky and load NASA SPHEREx images')}>
            <i aria-hidden>◎</i>{L('탐색', 'Find')}
          </button>
          <button className={stage !== 'sky' && ui === 'explore' ? 'on' : ''} aria-pressed={stage !== 'sky' && ui === 'explore'} onClick={() => { setUi('explore'); setStage('workbench') }} data-testid="mode-explore" title={L('영상과 3D로 변화를 살펴봅니다', 'Look for change in the images and in 3D')}>
            <i aria-hidden>◐</i>{L('관측', 'Observe')}
          </button>
          <button className={stage !== 'sky' && ui === 'research' ? 'on' : ''} aria-pressed={stage !== 'sky' && ui === 'research'} onClick={() => { setUi('research'); setStage('workbench') }} data-testid="mode-research" title={L('위치 측정·변광·분광·자료 출처 도구를 모두 엽니다', 'Open every tool: positions, variability, spectrum, provenance')}>
            <i aria-hidden>∿</i>{L('분석', 'Analyse')}
          </button>
        </div>
        <div className="top-right">
          {!embedded && <div className="mode-switch lang-switch" role="group" aria-label="Language">
            <button className={lang === 'ko' ? 'on' : ''} aria-pressed={lang === 'ko'} onClick={() => chooseLang('ko')} data-testid="lang-ko" lang="ko">한</button>
            <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => chooseLang('en')} data-testid="lang-en" lang="en">EN</button>
          </div>}
          <ShareButton />
        </div>
      </header>
      <nav className="target-strip tabs" role="tablist" aria-label={L('대회 시험 대상', 'Challenge targets')}>
        <span className="strip-label">{L('추천 대상', 'Featured')}</span>
        {index.state === 'ok' &&
          index.value.targets.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={!patch && t.id === targetId}
              className={!patch && t.id === targetId ? 'active' : ''}
              onClick={() => { openTarget(t.id); if (useTime.getState().stage === 'sky') setStage('workbench') }}
              data-testid={`tab-${t.id}`}
            >
              {t.display_name}
              {t.status !== 'ok' && <span className={`status status-${t.status}`}>{t.status === 'no_data' ? L('관측 없음', 'no data') : L('받기 실패', 'fetch failed')}</span>}
            </button>
          ))}
        {patch && <span className="tab-patch active" data-testid="tab-patch">◎ {patch.label ?? fmtRadec(patch.c)} · {patch.fov}°</span>}
      </nav>

      {movingContext && patch && <aside className="moving-context" data-testid="moving-archive-notice">
        <strong>{L('이동 천체에서 이어진 고정 좌표 조회', 'Fixed-coordinate archive search from a moving object')}</strong>
        <p>{L('전달된 하늘 좌표 주변의 보관 영상을 조회합니다. 이 화면은 천체의 시간별 위치를 추적하지 않으며, 영상 속 이동 검출을 뜻하지 않습니다.', 'This searches archived images around the supplied sky position. This view does not follow the object’s ephemeris or establish a moving-object detection.')}</p>
        {(movingContext.epoch || movingContext.observation) && <dl>
          {movingContext.epoch && <div><dt>{L('예측 위치 기준', 'Predicted position epoch')}</dt><dd>{movingContext.epoch.utc} <span>· MJD {movingContext.epoch.mjd}</span></dd></div>}
          {movingContext.observation && <div><dt>{L('전달된 관측 시각', 'Source observation time')}</dt><dd>{movingContext.observation.utc} <span>· MJD {movingContext.observation.mjd}</span></dd></div>}
        </dl>}
      </aside>}

      {index.state === 'loading' && <p className="dim pad">{L('대상 목록을 불러오는 중…', 'Loading targets…')}</p>}
      {index.state === 'error' && <Failure title={L('대상 목록을 불러오지 못함', 'Could not load the target list')} error={index.error} />}
      {entry && entry.status !== 'ok' && (
        <div className="failure" data-testid={entry.status}>
          <strong>{entry.display_name}: {entry.status === 'no_data' ? L('관측 데이터 없음', 'No observations') : L('데이터 받기 실패', 'Download failed')}</strong>
          {entry.status_detail && <div>{entry.status_detail}</div>}
        </div>
      )}
      {meta?.state === 'error' && <Failure title={L('대상 메타데이터를 불러오지 못함', 'Could not load target metadata')} error={meta.error} />}
      {meta?.state === 'loading' && <p className="dim pad">{entry?.display_name} {L('데이터를 불러오는 중…', 'loading…')}</p>}

      {patch && near && (
        <div className="control-note pad-x" data-testid="near-target">
          {L('이 좌표는 시험 대상 근처입니다:', 'These coordinates are near a challenge target:')} <b>{near.display_name}</b>{' '}
          <button className="link" onClick={() => openTarget(near.id)}>{L('분석된 화면(예측 위치·3D) 보기', 'Open its analysed view (predictions, 3D)')}</button>
        </div>
      )}
      {patch && !m && (
        <div className="job pad" data-testid="patch-job">
          {jobErr ? (
            <div className="failure" data-testid="fetch-failed">
              <strong>{L('이 좌표의 SPHEREx 영상을 만들지 못함', 'Could not build SPHEREx images for these coordinates')}</strong>
              <div>{jobErr}</div>
              <p>{L('실제 데이터를 읽지 못했습니다. 대체 데이터는 표시하지 않습니다.', 'The real data could not be read. Nothing is substituted.')}</p>
              {patch.frame && !['ICRS', 'ASTROM'].includes(patch.frame)
                ? <button className="ghost" onClick={() => notifyShell({ type:'spherex-navigate', view:'asteroids' })}>{L('소행성 분석으로', 'Open asteroid analysis')}</button>
                : <button className="ghost" onClick={() => setPatch({ ...patch, retry: true })}>{L('다시 시도', 'Try again')}</button>}
            </div>
          ) : meta?.state === 'ok' && meta.value.visits.length === 0 ? (
            <div className="failure" data-testid="no_data">
              <strong>{meta.value.display_name}: {L('SPHEREx 관측 없음', 'no SPHEREx observations')}</strong>
              <div>{meta.value.status_detail}</div>
              <button className="ghost" onClick={() => setPatch({ ...patch, retry: true })}>{L('자료 다시 확인', 'Check again')}</button>
            </div>
          ) : (
            <>
              <strong>{fmtRadec(patch.c)} · {L('시야', 'field')} {patch.fov}°</strong>
              <div>{job ? job.message : L('서버에 요청 중…', 'Asking the server…')}{job?.total ? ` ${job.done}/${job.total}` : ''}{job?.queue ? ` · ${L('대기열', 'queue')} ${job.queue}` : ''}</div>
              {job?.total ? <progress value={job.done} max={job.total} /> : <progress />}
              {job && ['queued', 'running'].includes(job.status) && <button className="ghost" onClick={() => {
                void cancelPatch(job.id).then(result => { setJob(result); setJobErr(patchError(result)) }).catch(error => setJobErr(String(error)))
              }}>{L('분석 요청 취소', 'Cancel request')}</button>}
              <p className="dim small">{L('IRSA에서 이 영역을 덮는 SPHEREx 영상을 찾아 받고, 같은 북쪽-위 격자로 맞추는 중입니다. 처음 보는 좌표는 몇 분 걸릴 수 있고, 한 번 만든 영역은 바로 열립니다.', 'Fetching the SPHEREx images that cover this patch from IRSA and putting them on a north-up grid. New coordinates can take a few minutes; patches made before open at once.')}</p>
            </>
          )}
        </div>
      )}

      {(m || (stage === 'sky' && index.state === 'ok')) && (
        <main className={`desk${stage === 'sky' ? ' desk-sky' : ''}`}>
          <section className="stage-col">
            {stage === 'sky' && index.state === 'ok' && (
              <Suspense fallback={<p className="dim">{L('천구를 준비하는 중…', 'Preparing the sky…')}</p>}><SkyPanel
                index={index.value}
                embedded={embedded}
                currentId={m && !isPatch ? m.id : null}
                onOpenTarget={(id) => { openTarget(id); setStage('workbench') }}
                onPatch={(c, fov, label) => { setMovingContext(null); setPatch({ c, fov, label }); setStage('workbench') }}
              /></Suspense>
            )}
            {stage === 'workbench' && m && <>
              <StageHead meta={m} />
              <div className="viewports">
                <section className="viewport" aria-label={L('SPHEREx 영상', 'SPHEREx images')}>
                  <h3 className="vp-title">{L('SPHEREx가 찍은 영상', 'What SPHEREx saw')} <span className="dim small">{L('북쪽 위, 동쪽 왼쪽, 픽셀 6.15″', 'north up, east left, 6.15″ pixels')}</span></h3>
                  <BlinkViewer key={m.id} meta={m} />
                </section>
                <section className="viewport" aria-label={L('3D 시공간 모형', '3D space-time model')}>
                  {isPatch ? (
                    <>
                      <h3 className="vp-title">{L('이 영역의 SPHEREx 관측', 'SPHEREx visits of this patch')}</h3>
                      <PatchInfo meta={m} />
                    </>
                  ) : (
                    <>
                      <h3 className="vp-title">{L('3D 시공간 모형', '3D space-time model')} <span className="dim small">{L('왼쪽 영상과 같은 시각·같은 시야', 'same moment and field as the image')}</span></h3>
                      <Suspense fallback={<div className="scene-loading">{L('같은 관측의 3D 시공간을 준비하는 중…', 'Preparing the same observations in 3D…')}</div>}><Scene3D key={m.id} meta={m} /></Suspense>
                    </>
                  )}
                </section>
              </div>
              <div data-tutorial="analysis-timeline"><Timeline meta={m} /></div>
              {ui === 'research' && isPatch && <p className="control-note" data-testid="patch-capabilities">{L('임의 좌표 영역은 영상 비교와 관측 출처를 제공합니다. 대상별 측광·스펙트럼·3D 예측은 준비된 대상에서 사용할 수 있습니다.', 'Arbitrary fields provide image comparison and observation provenance. Target photometry, spectra and 3D predictions are available for the prepared targets.')}</p>}
              {ui === 'research' && !isPatch && <Suspense fallback={<p className="dim">{L('분석 도구를 준비하는 중…', 'Preparing analysis tools…')}</p>}><AnalysisTabs key={m.id} meta={m} /></Suspense>}
            </>}
          </section>

          {stage !== 'sky' && <aside className="rail" aria-label={ui === 'explore' ? L('임무와 발견', 'Mission and findings') : L('발견과 안내', 'Findings and guides')}>
            {index.state === 'ok' && (
              <SkyLocator index={index.value} current={m && !isPatch ? m.id : null} patch={m && isPatch ? (m.center ?? null) : null} onPick={(id) => { openTarget(id); setStage('workbench') }} onOpenSky={openSky} />
            )}
            {m && ui === 'explore' && <MissionCard key={m.id} meta={m} />}
            {m && <Findings meta={m} />}
            <Guides open={ui === 'explore'} />
          </aside>}
        </main>
      )}
      <footer className="credit dim small">
        {L('영상: NASA/IPAC IRSA SPHEREx', 'Images: NASA/IPAC IRSA SPHEREx')}{m && <> ({m.provenance.collections.join(', ')})</>}. {L('위치·운동 값: Gaia DR3·SIMBAD·문헌.', 'Positions and motions: Gaia DR3, SIMBAD, literature.')}{' '}
        {L('전천 영상은 IRSA SPHEREx HiPS, Gaia 별은 VizieR에서 실시간으로 받습니다.', 'The all-sky map streams from the IRSA SPHEREx HiPS and Gaia stars from VizieR, live.')}{' '}
        {/* English: the teammate's Korean name keeps lang="ko" (spec D3 rule 7) */}
        {L('“같은 파장끼리 비교”, 임무 카드, 차가운 천체 필터, 천구 엔진(SkyGlobe)은 팀원 경보의 TrueBlink에서 가져왔습니다.', '') || <>Like-with-like blinking, mission cards, the cold-object filter and the globe engine (SkyGlobe) come from our teammate <span lang="ko">경보</span>'s TrueBlink.</>}
      </footer>
    </div>
  )
}
