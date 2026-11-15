import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { DataError, isMock, loadMeta, loadTargets } from './lib/data'
import { usePlayer } from './lib/usePlayer'
import { NO_SERVER_MESSAGE, cancelPatch, loadPatchMeta, patchError, pollPatch, requestPatch, resolveName } from './lib/api'
import { trueBlinkUrl } from './lib/trueblink'
import type { PatchJob } from './lib/api'
import { fmtRadec, parseCoords } from './lib/coords'
import type { Radec } from './lib/coords'
import { readView, writeView } from './lib/urlState'
import { LANG_KEY, appTitle, langMessage, readStoredLang, writeStoredLang } from './lib/lang'
import { errorText, useL } from './lib/i18n'
import { normalizeAnalysisTab } from './lib/workspaceState'
import { sesame } from './lib/sky'
import { useTime, visitIndexAt } from './store'
import type { TargetMeta, TargetsIndex } from './types'
import { BlinkViewer } from './components/BlinkViewer'
import { ObservationTimeline } from './free/ObservationTimeline'
import './free/free.css'
import './apogee-skin.css'
import { PatchInfo } from './components/PatchInfo'
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
      <div>{errorText(error.message, L)}</div>
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
  const L = useL()
  return <div className="fw-context"><div><h1>{meta.display_name}</h1></div><div className="fw-context-meta"><span className="fw-data-dot">SPHEREx</span><span>{meta.visits.length} {L('회 관측', 'observations')}</span></div></div>
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
  const tab = useTime((s) => s.tab)
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
    useTime.getState().setBlinkFps(1)
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
  const researchTab = normalizeAnalysisTab(m?.id ?? '', tab, isPatch)
  useEffect(() => {
    if (ui === 'research' && m && tab !== researchTab) setTab(researchTab)
    writeView({ ui, tab: ui === 'research' ? researchTab : null })
  }, [ui, m, tab, researchTab, setTab])
  useEffect(() => { if (m) useTime.getState().initComparison(m) }, [m])
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
    const previousTab = useTime.getState().tab
    setTarget(id)
    if (previousTab && (previousTab !== 'variable' || ['rw_aur','r_dra'].includes(id))) setTab(previousTab)
  }
  const near = patch && index.state === 'ok'
    ? index.value.targets.find((t) => t.ra !== undefined && sep(patch.c, { ra: t.ra, dec: t.dec! }) < patch.fov / 2)
    : undefined
  const busy = !!patch && !m && !jobErr && meta?.state !== 'ok'
  const activePane = stage === 'sky' ? 'sky' : ui === 'explore' ? 'observe' : researchTab
  const choosePane = (pane: string) => {
    useTime.getState().stop()
    if (pane === 'sky') { setStage('sky'); return }
    setStage('workbench')
    setUi(pane === 'observe' ? 'explore' : 'research')
    if (pane !== 'observe') setTab(pane as 'motion'|'variable'|'spectrum'|'provenance')
  }
  useEffect(() => { document.title = appTitle(lang) + (m ? ' · ' + m.display_name : '') }, [m, lang])
  useEffect(() => {
    if (m) notifyShell({ type: 'spherex-analysis-loaded', target: m.id, label: m.display_name, observations: m.visits.length })
  }, [m])

  return (
    <div className={`app free-workspace ui-${ui}${embedded ? ' embedded' : ''}`} data-tutorial="analysis-status" data-analysis-kind={patch ? 'patch' : 'target'} data-analysis-ready={m ? 'true' : 'false'}>
      {isMock && (
        <div className="mock-banner" data-testid="mock-banner">
          {L('모의 데이터: UI 개발용 가짜 영상·좌표입니다. 실제 SPHEREx 관측이 아닙니다.', 'Mock data: fake images and positions for UI development, not real SPHEREx observations.')}
        </div>
      )}
      <section className="fw-targetbar" aria-label={L('관측 대상 선택', 'Observation target')}>
        <label className="fw-target-select"><span>{L('관측 대상','Target')}</span><select aria-label={L('관측 대상','Target')} value={patch?'patch':targetId??''} disabled={index.state!=='ok'} onChange={e=>{openTarget(e.target.value);setStage('workbench')}}>
          {index.state!=='ok'&&<option value="">{L('불러오는 중…','Loading…')}</option>}
          {index.state==='ok'&&index.value.targets.map(t=><option key={t.id} value={t.id}>{t.display_name}{t.status!=='ok'?L(' · 자료 없음',' · unavailable'):''}</option>)}
          {patch&&<option value="patch">{patch.label??fmtRadec(patch.c)}</option>}
        </select></label>
        <SearchBar onPatch={(p)=>{useTime.getState().stop();setMovingContext(null);setPatch(p);setUi('explore');setStage('workbench')}} busy={busy} embedded={embedded}/>
        <div className="fw-utilities">{!embedded&&<div className="fw-language" role="group" aria-label="Language"><button aria-pressed={lang==='ko'} onClick={()=>chooseLang('ko')} data-testid="lang-ko">한</button><button aria-pressed={lang==='en'} onClick={()=>chooseLang('en')} data-testid="lang-en">EN</button></div>}<ShareButton/></div>
      </section>

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
              <div>{errorText(jobErr, L)}</div>
              <p>{L('실제 데이터를 읽지 못했습니다. 대체 데이터는 표시하지 않습니다.', 'The real data could not be read. Nothing is substituted.')}</p>
              {jobErr === NO_SERVER_MESSAGE && !(patch.frame && !['ICRS', 'ASTROM'].includes(patch.frame)) && <>
                <a className="ghost" data-testid="open-trueblink" href={trueBlinkUrl({ ra: patch.c.ra, dec: patch.c.dec, fovDeg: patch.fov, lang })} target="_blank" rel="noopener noreferrer">{L('이 좌표를 TrueBlink에서 열기', 'Open this place in TrueBlink')}</a>
                <p className="dim small">{L('TrueBlink는 팀원이 만든 사이트로, 어느 좌표든 아카이브에서 실제 SPHEREx 노출을 실시간으로 받아 옵니다. 새 탭에서 열립니다.', 'TrueBlink is our teammate\'s site. It fetches the real SPHEREx exposures of any place from the archive, live. It opens in a new tab.')}</p>
              </>}
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

      {(m || (stage === 'sky' && index.state === 'ok')) && <main className="fw-desk">
        {stage==='sky'?<div className="fw-context"><div><span className="fw-eyebrow">{L('자유 관측','FREE OBSERVATION')}</span><h1>{L('하늘에서 찾기','Explore the sky')}</h1></div></div>:m&&<StageHead meta={m}/>}
        <nav className="fw-modebar" aria-label={L('관측 도구','Observation tools')}>
          <div role="tablist" aria-label={L('작업 화면','Workspace view')}>
            {([['observe',L('관측','Observe')],...(!isPatch?[['spectrum',L('분광','Spectrum')],['motion',L('위치 분석','Positions')],...(['rw_aur','r_dra'].includes(m?.id??'')?[['variable',L('밝기 분석','Brightness')]]:[])]:[]),['provenance',L('자료','Data')]]).map(([id,label])=><button key={id} role="tab" data-testid={id==='observe'?'mode-explore':`atab-${id}`} data-tutorial={id==='observe'?undefined:`analysis-${id}`} aria-selected={activePane===id} className={activePane===id?'active':''} onClick={()=>choosePane(id)}>{label}</button>)}
          </div>
          <button className={`fw-sky-button${stage==='sky'?' active':''}`} aria-pressed={stage==='sky'} onClick={()=>choosePane('sky')} data-testid="stage-sky">◎ {L('천구 탐색','Sky map')}</button>
        </nav>
        {stage==='sky'&&index.state==='ok'&&<Suspense fallback={<p className="dim pad">{L('천구를 준비하는 중…','Preparing the sky…')}</p>}><SkyPanel index={index.value} embedded={embedded} currentId={m&&!isPatch?m.id:null} onOpenTarget={id=>{openTarget(id);choosePane('observe')}} onPatch={(c,fov,label)=>{setMovingContext(null);setPatch({c,fov,label});choosePane('observe')}}/></Suspense>}
        {stage==='workbench'&&m&&<>
          {activePane==='observe'?<>
            <div className="viewports fw-observation">
              <section className="viewport fw-image-panel" aria-label={L('SPHEREx 영상','SPHEREx images')}><h2 className="vp-title">{L('관측 영상','Observation image')}<span>SPHEREx</span></h2><BlinkViewer key={m.id} meta={m} compact/></section>
              <section className="viewport fw-space-panel" aria-label={L('3D 시공간 모형','3D space-time model')}><h2 className="vp-title">{isPatch?L('관측 영역','Observation field'):L('3D 시공간','3D space-time')}<span>{isPatch?'':L('위치 모델','Position model')}</span></h2>{isPatch?<PatchInfo meta={m}/>:<Suspense fallback={<div className="scene-loading">{L('3D를 준비하는 중…','Preparing 3D…')}</div>}><Scene3D key={m.id} meta={m} compact/></Suspense>}</section>
            </div>
            <ObservationTimeline meta={m}/>
          </>:<>
            <Suspense fallback={<p className="dim pad">{L('분석 도구를 여는 중…','Opening tools…')}</p>}><AnalysisTabs key={m.id} meta={m} standalone activeTab={researchTab}/></Suspense>
            {activePane!=='spectrum'&&activePane!=='provenance'&&<ObservationTimeline meta={m}/>}
          </>}
        </>}
      </main>}

    </div>
  )
}
