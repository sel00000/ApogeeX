import { useEffect, useMemo, useRef, useState } from 'react'
import type { TargetMeta } from '../types'
import { RJ_K, onVisit, useTime, visitIndexAt } from '../store'
import { exaggerate, makeCube } from '../lib/cube'
import { autoStretch, diffImageData, diffScale, loadFrames, subtract, toImageData } from '../lib/frames'
import type { Frame } from '../lib/frames'
import { coldFrame, coldVisits, survival } from '../lib/cold'
import { frameViewport } from '../lib/viewport'
import { publishImage, clearImage } from '../lib/imageBridge'
import { Badge } from './Badge'
import { SpectralRuler } from './SpectralRuler'
import { dataText, useL } from '../lib/i18n'
import { gaiaCone, propagate, skyToGridPx } from '../lib/sky'
import type { Star } from '../lib/sky'
import { comparisonStatus } from '../lib/comparison'

const VARIABLE = new Set(['rw_aur', 'r_dra'])

const DISPLAY = 420 // on-screen frame size (CSS px)
// backing store at device resolution (≤3×) so the frame stays sharp on Retina screens
const DPR = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)))
const PX = DISPLAY * DPR
const ZOOMS = [1, 4, 8] as const
const PATCH_ZOOMS = [1, 2, 4] as const
const WIDE_ZOOMS = [1, 3, 6, 12] as const
const EXAGGERATIONS = [1, 5, 20, 100, 1000] as const

type Overlays = { circle: boolean; arrow: boolean; region: boolean; meas: boolean; track: boolean; compass: boolean; scalebar: boolean }
type Px = [number, number]

export function BlinkViewer({ meta,compact=false }: { meta: TargetMeta;compact?:boolean }) {
  const L = useL()
  const [comparing,setComparing]=useState(false),[wipe,setWipe]=useState(50)
  const wipeDrag=useRef(false)
  const wipeA=useRef<HTMLCanvasElement>(null),wipeB=useRef<HTMLCanvasElement>(null)
  const gaiaOn = useTime((s) => s.gaia)
  const setGaia = useTime.getState().setGaia
  const tMjd = useTime((s) => s.tMjd)
  const playing = useTime((s) => s.playing)
  const blinkFps = useTime((s) => s.blinkFps)
  const playMode = useTime((s) => s.playMode)
  const ab = useTime((s) => s.ab)
  const X = useTime((s) => s.exaggeration)
  const view = useTime((s) => s.view)
  const det = useTime((s) => s.det)
  const zoomPref = useTime((s) => s.zoom)
  const coldK = useTime((s) => s.coldK)
  const { play, stop, setAB, goToVisit, setExaggeration, setView, setDet, setZoom, setColdK } = useTime.getState()
  const [contrast, setContrast] = useState<'local' | 'frame'>('local')
  // display black level: 'dark' clips sky noise below +1σ to black (like other teams' viewers); 'full' shows it
  const [floor, setFloor] = useState<'dark' | 'full'>('dark')
  const [smooth, setSmooth] = useState(false) // crisp native pixels by default; smoothing is an opt-in display choice
  // a sky patch has no known target: no predicted positions, whole field by default
  const isPatch = meta.kind === 'patch'
  const [ov, setOv] = useState<Overlays>({ circle: !compact, arrow: !compact, region: false, meas: !compact, track: !compact, compass: true, scalebar: true })

  const vs = meta.visits ?? []
  const k = visitIndexAt(meta, tMjd)
  const visit = vs[k] ?? { utc: '', mjd: 0, detectors: [], wave_um: null, n_exp: 0, masked_frac: 0, pred_px: [0, 0], meas_px: null, meas_err_px: null, meas_note: '', irsa_uris: [], exposures: [] }
  const n = meta.wcs.size_px[0] // analysis grid (pred_px, meas_px live here)
  // wide context frames: same centre and pixel scale, bigger; pixel coords shift by `o`
  const wide = !isPatch && meta.wide ? meta.wide : null
  const N = wide ? wide.size_px[0] : n
  const o = wide ? wide.offset_px : 0
  const s = DISPLAY / N // CSS px per frame px at zoom 1
  const zooms: readonly number[] = isPatch ? PATCH_ZOOMS : wide ? WIDE_ZOOMS : ZOOMS
  const zoom = zoomPref !== null && zooms.includes(zoomPref) ? zoomPref : isPatch ? 1 : wide ? 6 : 4
  const between = !onVisit(meta, tMjd)
  const nextDays = k < vs.length - 1 ? vs[k + 1].mjd - tMjd : null
  const cold = useMemo(() => coldVisits(meta), [meta])
  const coldOn = view === 'cold' && cold.length > 0
  const shownView = coldOn ? 'cold' : view === 'diff' ? 'diff' : 'image'

  const wipeOn=compact&&comparing&&!playing&&shownView==='image'

  // raw frames (float32 MJy/sr); failures are shown, never replaced
  const [frames, setFrames] = useState<Frame[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    setFrames(null)
    setLoadErr(null)
    loadFrames(meta, det, !!wide, controller.signal).then((f) => live && setFrames(f)).catch((e) => live && setLoadErr(String(e)))
    return () => { live = false; controller.abort() }
  }, [meta, det, wide])

  // cold-object filter: D5 and D6 frames of the same visits, loaded only when the filter is on
  const [cf, setCf] = useState<{ d5: Frame[]; d6: Frame[] } | null>(null)
  useEffect(() => {
    if (!coldOn || cf) return
    let live = true
    const controller = new AbortController()
    Promise.all([loadFrames(meta, 5, !!wide, controller.signal), loadFrames(meta, 6, !!wide, controller.signal)])
      .then(([d5, d6]) => live && setCf({ d5, d6 }))
      .catch((e) => live && setLoadErr(String(e)))
    return () => { live = false; controller.abort() }
  }, [meta, wide, coldOn, cf])
  const coldFrames = useMemo(
    () => (cf ? vs.map((_, i) => (cold.includes(i) ? coldFrame(cf.d6[i], cf.d5[i], coldK) : new Float32Array(N * N).fill(NaN))) : null),
    [cf, coldK, cold, vs, N],
  )
  const shown = coldOn ? coldFrames : frames

  // Gaia DR3 stars, live from VizieR (positions only, [외부 카탈로그]); fetched once per target
  const [gaia, setGaiaData] = useState<{ state: 'idle' | 'loading' | 'ok' | 'error'; stars: Star[]; err?: string }>({ state: 'idle', stars: [] })
  const gaiaStarted = useRef(false)
  const gaiaRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!gaiaOn || gaiaStarted.current) return
    gaiaStarted.current = true
    const controller = new AbortController()
    gaiaRequest.current = controller
    const radius = (N * meta.wcs.cdelt_arcsec / 2) * Math.SQRT2 + 30
    setGaiaData({ state: 'loading', stars: [] })
    gaiaCone(meta.wcs.crval[0], meta.wcs.crval[1], radius, controller.signal)
      .then((stars) => setGaiaData({ state: 'ok', stars }))
      .catch((e) => { if (!controller.signal.aborted) setGaiaData({ state: 'error', stars: [], err: (e as Error).message }) })
    // unmount (target change) cancels; turning the overlay off keeps the list for next time
    return () => { if (controller.signal.aborted) return }
  }, [gaiaOn, meta, N])
  useEffect(() => () => { gaiaStarted.current = false; gaiaRequest.current?.abort() }, [])

  // Start free comparison with two visits sharing a detector where available.
  useEffect(() => {
    if (compact) useTime.getState().initComparison(meta)
    else setAB([0, Math.max(0, vs.length - 1)])
  }, [meta, vs.length, compact, setAB])

  // keyboard: ←/→ previous/next visit, space = blink
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useTime.getState().suspended) return
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(tag) || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'ArrowLeft') goToVisit(meta, k - (between ? 0 : 1))
      else if (e.key === 'ArrowRight') goToVisit(meta, k + 1)
      else if (e.key === ' ') {
        e.preventDefault()
        if (playing) stop()
        else play('blink')
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meta, k, between, playing, play, stop, goToVisit])

  const toggle = (key: keyof Overlays) => setOv((o) => ({ ...o, [key]: !o[key] }))
  const isOn = (m: string) => playing && playMode === m

  // Each displayed frame represents exactly one observing visit.
  const group = (i: number) => [Math.max(0, Math.min(i, vs.length - 1))]
  const gA = group(ab[0]), gB = group(ab[1]), gNow = group(k)
  const predOf = (g: number[]): Px => isPatch ? [n / 2, n / 2] : vs[g[0]].pred_px
  const mjdOf = (g: number[]) => vs[g[0]].mjd
  const nameOf = (g: number[]) => L(`관측 ${g[0] + 1}`, `Visit ${g[0] + 1}`)

  // magnifier window around the target's track (real pixels)
  const track = useMemo(() => (isPatch ? { cx: n / 2, cy: n / 2 } : makeCube(meta)), [meta, isPatch, n])
  const viewport = frameViewport(N, o, [track.cx, track.cy], zoom, DISPLAY)
  const win = viewport.window
  const S = viewport.project
  // markers may be exaggerated about the first-visit position (badged); the image never is
  const ref: Px = isPatch ? [n / 2, n / 2] : vs[0].pred_px
  const E = (p: Px) => exaggerate(p, ref, X)

  // draw
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => { const cv = canvas.current; return () => { if (cv) clearImage(cv) } }, [])
  const keyA = gA.join(',')
  const keyB = gB.join(',')
  const keyNow = gNow.join(',')
  const comparison = comparisonStatus(meta, gA[0], gB[0], det)
  const stats = useMemo(() => {
    if (!shown) return null
    const w = contrast === 'local' ? win : { x0: 0, y0: 0, w: N }
    const use = coldOn ? shown.filter((_, i) => cold.includes(i)) : shown
    return { stretch: autoStretch(use.length ? use : shown, N, w, floor === 'dark' ? 1 : -0.5), w }
  }, [shown, coldOn, cold, contrast, floor, N, win.x0, win.y0, win.w]) // eslint-disable-line
  const diffInfo = useMemo(() => {
    if (!frames || shownView !== 'diff') return null
    const d = comparison.blocked ? new Float32Array(N * N).fill(NaN) : subtract(frames[gA[0]], frames[gB[0]])
    return { d, scale: diffScale(d, N, contrast === 'local' ? win : { x0: 0, y0: 0, w: N }) }
  }, [frames, shownView, keyA, keyB, comparison.blocked, contrast, N, win.x0, win.y0, win.w]) // eslint-disable-line
  useEffect(()=>{
    if(!wipeOn)return
    ;[wipeA.current,wipeB.current].forEach((cv,j)=>{
      if(!cv)return
      const ctx=cv.getContext('2d')!;ctx.clearRect(0,0,PX,PX)
      if(!frames||!stats||comparison.blocked)return
      const source=document.createElement('canvas');source.width=source.height=N
      source.getContext('2d')!.putImageData(toImageData(frames[j?ab[1]:ab[0]],N,stats.stretch),0,0)
      ctx.imageSmoothingEnabled=smooth
      ctx.drawImage(source,win.x0,win.y0,win.w,win.w,0,0,PX,PX)
    })
  },[wipeOn,frames,stats,comparison.blocked,ab,N,smooth,win.x0,win.y0,win.w])
  const rendered = useMemo(() => new Map<string, HTMLCanvasElement>(), [shown, stats, N])
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    if (!shown || !stats) { cv.getContext('2d')!.clearRect(0, 0, PX, PX); clearImage(cv); return }
    const cacheKey = shownView === 'diff' ? `d:${keyA}:${keyB}` : `${shownView}:${keyNow}`
    let off = rendered.get(cacheKey)
    if (!off) {
      off = document.createElement('canvas'); off.width = off.height = N
      const img = shownView === 'diff' && diffInfo ? diffImageData(diffInfo.d, N, diffInfo.scale) : toImageData(shown[gNow[0]], N, stats.stretch)
      off.getContext('2d')!.putImageData(img, 0, 0)
      // Bound memory when changing A/B pairs repeatedly.
      if (rendered.size >= vs.length + 8) rendered.delete(rendered.keys().next().value!)
      rendered.set(cacheKey, off)
    }
    const g = cv.getContext('2d')!
    g.clearRect(0, 0, PX, PX)
    g.imageSmoothingEnabled = smooth
    g.imageSmoothingQuality = 'high'
    g.drawImage(off, win.x0, win.y0, win.w, win.w, 0, 0, PX, PX)
    publishImage({ id: meta.id, canvas: cv, window: win, offset: o, visit: k })
  }, [shown, stats, diffInfo, shownView, keyNow, smooth, N, win.x0, win.y0, win.w]) // eslint-disable-line

  const pa = S(E(predOf(gA)))
  const pb = S(E(predOf(gB)))
  const [px, py] = S(E(predOf(gNow)))
  const meas = !isPatch && visit.meas_px && X === 1 && shownView === 'image' ? S(visit.meas_px) : null
  const pA = predOf(gA)
  const pB = predOf(gB)
  const abPx = Math.hypot(pB[0] - pA[0], pB[1] - pA[1])
  const A1 = vs[gA[0]]
  const B1 = vs[gB[0]]
  const abMeas = !isPatch && A1.meas_px && B1.meas_px ? Math.hypot(B1.meas_px[0] - A1.meas_px[0], B1.meas_px[1] - A1.meas_px[1]) : null
  const spanPx = isPatch ? Infinity : Math.hypot(vs[vs.length - 1].pred_px[0] - vs[0].pred_px[0], vs[vs.length - 1].pred_px[1] - vs[0].pred_px[1])
  const isControl = spanPx < 0.1
  const fmtShift = (px: number) =>
    px < 0.1 ? `${px.toFixed(3)} px (${(px * meta.wcs.cdelt_arcsec * 1000).toFixed(0)} mas)` : `${px.toFixed(2)} px (${(px * meta.wcs.cdelt_arcsec).toFixed(1)}″)`
  const fieldArcmin = (N * meta.wcs.cdelt_arcsec) / 60 / zoom
  const bar = fieldArcmin >= 4 ? { arcsec: 60, label: '1′' } : { arcsec: 10, label: '10″' }
  const barW = (bar.arcsec / meta.wcs.cdelt_arcsec) * s * zoom
  const regionCube = useMemo(() => (isPatch ? null : makeCube(meta, X)), [meta, X, isPatch])
  const shownHasData = shown && gNow.some((i) => shown[i].some(Number.isFinite))
  const nUris = visit.irsa_uris.length
  const selOpts = vs.map((v, i) => ({ v: i, label: `${i + 1} · ${v.utc.slice(0, 10)}` }))
  const selVal = (i: number) => Math.max(0, Math.min(i, vs.length - 1))
  // how much of the target's own D6 light the filter leaves (measured on these pixels)
  const keep = coldOn && cf && coldFrames && !isPatch && cold.includes(k)
    ? survival(cf.d6[k], coldFrames[k], N, visit.pred_px[0] + o, visit.pred_px[1] + o)
    : null
  const step = (d: number) => {
    if (!coldOn) return goToVisit(meta, d < 0 ? k - (between ? 0 : 1) : k + 1)
    // the filter exists only for visits with both D5 and D6: step through those
    const pos = cold.indexOf(k)
    const next = pos < 0 ? cold.find((i) => (d > 0 ? i > k : i < k)) ?? cold[0] : cold[(pos + d + cold.length) % cold.length]
    goToVisit(meta, next)
  }

  const advancedControls = (<div className="controls" onClick={()=>{if(compact)setComparing(false)}}>
        <div className="ctl-row stage-bar">
          <div className="transport" role="group" aria-label={L('관측 넘기기', 'Step through visits')}>
            <button onClick={() => step(-1)} title={L('이전 관측 (←)', 'Previous visit (←)')}>{L('‹ 이전', '‹ Prev')}</button>
            <button className={isOn('blink') ? 'active primary' : 'primary'} onClick={() => (isOn('blink') ? stop() : play('blink'))} title={L('관측 순서대로 깜빡이기 (space)', 'Blink the visits in order (space)')}>
              {isOn('blink') ? L('■ 정지', '■ Stop') : '▶ Blink'}
            </button>
            <button onClick={() => step(1)} title={L('다음 관측 (→)', 'Next visit (→)')}>{L('다음 ›', 'Next ›')}</button>
          </div>
          <div className="seg" role="group" aria-label={L('영상 종류', 'Image type')}>
            <button className={shownView === 'image' ? 'active' : ''} onClick={() => setView('image')} data-testid="view-image">{L('영상', 'Image')}</button>
            <button className={shownView === 'diff' ? 'active' : ''} onClick={() => setView('diff')} data-testid="view-diff" title={L('같은 격자의 A에서 B를 뺍니다. 파장·밝기·PSF 차이로 고정 별에도 잔차가 남을 수 있습니다.', 'A minus B on the same grid. Fixed stars can leave residuals from wavelength, brightness and PSF differences.')}>{L('A−B 차이', 'A−B diff')}</button>
            {cold.length > 0 && (
              <button className={shownView === 'cold' ? 'active' : ''} onClick={() => { setView('cold'); if (!cold.includes(k)) goToVisit(meta, cold[0]) }} data-testid="view-cold" title={L('D6(4.42–5.00 µm)에서 D5(3.83–4.41 µm)를 이론 비율만큼 뺍니다', 'D6 (4.42–5.00 µm) minus the theoretical share of D5 (3.83–4.41 µm)')}>
                {L('차가운 천체 필터', 'Cold-object filter')}
              </button>
            )}
          </div>
          <div className="seg" role="group" aria-label={wide ? L('시야', 'Field of view') : L('확대', 'Zoom')}>
            {zooms.map((z) => (
              <button key={z} className={zoom === z ? 'active' : ''} onClick={() => setZoom(z)} data-testid={`zoom-${z}`}
                title={`${((N * meta.wcs.cdelt_arcsec) / 60 / z).toFixed(1)}′ ${L('시야', 'field')}`}>
                {wide ? `${((N * meta.wcs.cdelt_arcsec) / 60 / z).toFixed(z >= 6 ? 1 : 0)}′` : `×${z}`}
              </button>
            ))}
          </div>
        </div>
        <div className="ctl-row ctl-sub">
          <SpectralRuler meta={meta} visit={k} det={coldOn ? -1 : det} onPick={(d) => { setDet(d); if (coldOn) setView('image') }} />
          <details className="pop ab-pop">
            <summary>{L('A·B 비교', 'Compare A·B')}</summary>
            <div className="pop-body">
          <div className="ab-pick" role="group" aria-label={L('비교할 두 관측', 'Two visits to compare')}>
            <button className={isOn('ab') ? 'active' : ''} onClick={() => (isOn('ab') ? stop() : play('ab'))} title={L('A와 B만 번갈아 보기', 'Alternate A and B only')}>{L('A/B 번갈아', 'A/B swap')}</button>
            <label className="field">A
              <select value={selVal(ab[0])} onChange={(e) => setAB([+e.target.value, ab[1]])} data-testid="sel-a">
                {selOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </label>
            <label className="field">B
              <select value={selVal(ab[1])} onChange={(e) => setAB([ab[0], +e.target.value])} data-testid="sel-b">
                {selOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </label>
          </div>
              <span className="fps" data-testid="fixed-fps">{L(`${blinkFps} 장/초`, `${blinkFps} fps`)}</span>
            </div>
          </details>
        </div>
      </div>)
  const imageDetails = (<>      {!isPatch && (
        <div className="marks" role="group" aria-label={L('표시', 'Markers')}>
          <button className={ov.circle ? 'active mark' : 'mark'} onClick={() => toggle('circle')} title={L('A·B에서 대상 위치를 동그라미로 표시 (예측 위치)', 'Circle the target at A and B (predicted positions)')} data-testid="mark-circle">{L('◯ 동그라미', '◯ Circles')}</button>
          <button className={ov.arrow ? 'active mark' : 'mark'} onClick={() => toggle('arrow')} title={L('A→B 이동 화살표와 이동 방향', 'A→B motion arrow and direction')} data-testid="mark-arrow">{L('➜ 화살표', '➜ Arrow')}</button>
          <button className={gaiaOn ? 'active mark gaia' : 'mark gaia'} onClick={() => setGaia(!gaiaOn)} title={L('Gaia DR3 별을 VizieR에서 실시간으로 받아 이 관측 날짜로 옮겨 표시', 'Gaia DR3 stars, fetched live from VizieR and moved to this visit\'s date')} data-testid="mark-gaia">{L('✦ Gaia 별', '✦ Gaia stars')}</button>
          <label className="field">{L('표시 과장', 'Exaggerate')}
            <select value={X} onChange={(e) => setExaggeration(+e.target.value)} data-testid="exaggeration">
              {EXAGGERATIONS.map((x) => <option key={x} value={x}>{x === 1 ? L('없음 (실제)', 'none (true)') : `×${x}`}</option>)}
            </select>
          </label>
          {X > 1 && <span className="badge badge-warn" data-testid="exaggerated">{L(`과장됨 ×${X} · 표시만, 영상은 실제`, `Exaggerated ×${X} · markers only, image is real`)}</span>}
        </div>
      )}

      {shownView === 'diff' && (
        <div className="diff-key">
          <span><i className="sw-fill" style={{ background: '#ff8c40' }} /> {L('A가 더 밝음', 'A brighter')}</span>
          <span><i className="sw-fill" style={{ background: '#3d8cff' }} /> {L('B가 더 밝음', 'B brighter')}</span>
          <span className="dim">{L('탐색용 차영상입니다. 검정은 표시 임계값 이하이며 검출 유의성을 뜻하지 않습니다. 픽셀별 파장·PSF·분산 보정이 검증되지 않았습니다.', 'Exploratory difference only. Black is below a display threshold, not a significance test. Pixel wavelength, PSF and variance matching have not been validated.')}</span>
          {comparison.blocked && <strong className="warn" data-testid="comparison-blocked">{L('공통 검출기 또는 파장 범위가 없어 차영상을 표시하지 않습니다.', 'No common detector or wavelength coverage: difference withheld.')}</strong>}
          <span className="dim">
            {isPatch
              ? L('주황·파랑 잔차는 이동 후보일 수 있지만 정렬·파장·PSF 차이도 같은 모양을 만들 수 있습니다.', 'Orange–blue residuals may be motion candidates; alignment, wavelength and PSF differences can produce the same pattern.')
              : abPx < 0.5
              ? L('예측 위치가 겹칩니다. 잔차에는 밝기·파장·PSF 차이가 섞일 수 있어 원인을 추가 확인해야 합니다.', 'Predicted positions overlap. Residuals can mix brightness, wavelength and PSF differences; their cause needs checking.')
              : L('주황·파랑의 방향을 예측 이동과 비교하세요. 색의 짝만으로 이동을 확정할 수 없습니다.', 'Compare orange–blue orientation with predicted motion. A colour pair alone does not establish motion.')}
          </span>
        </div>
      )}

      <div className="ab-caption" data-testid="ab-caption">
        A {nameOf(gA)} {vs[gA[0]].utc.slice(0, 10)} → B {nameOf(gB)} {vs[gB[0]].utc.slice(0, 10)}, {L(`${Math.abs(mjdOf(gB) - mjdOf(gA)).toFixed(0)}일 간격.`, `${Math.abs(mjdOf(gB) - mjdOf(gA)).toFixed(0)} days apart.`)}
        {!isPatch && <> {L(`그 사이 ${fmtShift(abPx)} 이동`, `Moved ${fmtShift(abPx)} in between`)} <Badge kind="model" /></>}
        {abMeas !== null && <> · {L(`측정으로는 ${fmtShift(abMeas)}`, `measured ${fmtShift(abMeas)}`)} <Badge kind="spherex" /></>}
        {X > 1 && <span className="warn"> · {L(`화면 표시는 ×${X} 과장`, `markers exaggerated ×${X}`)}</span>}
      </div>
      {gaiaOn && (
        <p className="small gaia-status" data-testid="gaia-status">
          <Badge kind="catalog" />{' '}
          {gaia.state === 'loading' && L('Gaia DR3 별을 VizieR에서 받는 중…', 'Fetching Gaia DR3 stars from VizieR…')}
          {gaia.state === 'ok' && L(`Gaia DR3 별 ${gaia.stars.length}개(밝은 순 최대 400개)를 이 관측 날짜로 고유운동 이동해 파란 원으로 표시했습니다. SPHEREx 영상의 별과 겹치면 좌표가 맞는 것입니다.`, `${gaia.stars.length} Gaia DR3 stars (up to 400 brightest), moved to this visit's date by proper motion, drawn as blue circles. Where they sit on SPHEREx stars, the coordinates agree.`)}
          {gaia.state === 'error' && <span className="warn">{L('Gaia 목록을 받지 못했습니다(대체 자료 없음): ', 'Gaia list unavailable (nothing substituted): ')}{gaia.err}</span>}
        </p>
      )}
      {wide && <p className="dim small" data-testid="wide-context"><Badge kind="spherex" /> {L('넓은 영상 약 18′, 관측당 노출 최대 8장. 분석·측광은 0.1° 영상 기준입니다.', 'Wide frame about 18′, up to 8 exposures per visit. Measurements use the 0.1° frames.')}</p>}

      <details className="more">
        <summary>{L('표시 설정', 'Display settings')}</summary>
        <div className="legend">
          {!isPatch && <>
            <span className="key"><i className="sw pred" />{L('동그라미·화살표 = 예측 위치', 'Circles and arrows = predicted positions')} <Badge kind="model" /></span>
            <label><input type="checkbox" checked={ov.meas} onChange={() => toggle('meas')} /><i className="sw meas" />{L('측정 위치±1σ', 'Measured position ±1σ')} <Badge kind="spherex" /></label>
            <label><input type="checkbox" checked={ov.track} onChange={() => toggle('track')} />{L('예측 궤적', 'Predicted track')}</label>
            <label><input type="checkbox" checked={ov.region} onChange={() => toggle('region')} />{L('3D 영역', '3D region')}</label>
          </>}
          <label><input type="checkbox" checked={ov.compass} onChange={() => toggle('compass')} />{L('나침반', 'Compass')}</label>
          <label><input type="checkbox" checked={ov.scalebar} onChange={() => toggle('scalebar')} />{L('눈금', 'Scale bar')}</label>
          <label className="field">{L('밝기 기준', 'Stretch from')}
            <select value={contrast} onChange={(e) => setContrast(e.target.value as 'local' | 'frame')}>
              <option value="local">{L('보이는 영역', 'visible area')}</option>
              <option value="frame">{L('전체 프레임', 'whole frame')}</option>
            </select>
          </label>
          <label className="field">{L('배경', 'Sky')}
            <select value={floor} onChange={(e) => setFloor(e.target.value as 'dark' | 'full')} data-testid="sky-floor">
              <option value="dark">{L('어둡게 (잡음 1σ 아래는 검정, 표시만)', 'dark (noise below 1σ in black, display only)')}</option>
              <option value="full">{L('그대로 (잡음까지 모두 보기)', 'full (show all the noise)')}</option>
            </select>
          </label>
          <label><input type="checkbox" checked={smooth} onChange={() => setSmooth(!smooth)} />{L('부드럽게 보간', 'Smooth')}</label>
          <span className="dim">{L('빗금 = 마스크·포화로 값이 없는 픽셀', 'Hatching = masked or saturated pixels with no value')}</span>
        </div>
      </details>

      <details className="more">
        <summary>{L(`관측 ${k + 1} 자세히`, `Visit ${k + 1} details`)}</summary>
        <dl className="info">
          {wide && <><dt>{L('넓은 영상 상태', 'Wide frame')}</dt><dd>{L(`실패 노출 ${wide.visits[k]?.failed_exp ?? 0}장 · 받은 관측값만 표시`, `${wide.visits[k]?.failed_exp ?? 0} failed exposures · only received data shown`)}</dd></>}
          <dt>UTC</dt><dd>{visit.utc.replace('T', ' ').slice(0, 19)}</dd>
          <dt>MJD</dt><dd>{visit.mjd.toFixed(4)}</dd>
          <dt>{L('검출기', 'Detectors')}</dt><dd>{visit.detectors.map((d) => `D${d}`).join(' ')}</dd>
          <dt>{L('파장', 'Wavelength')}</dt><dd>{visit.wave_um ? `${visit.wave_um[0].toFixed(2)}–${visit.wave_um[1].toFixed(2)} µm` : '—'}</dd>
          <dt>{wide ? L('분석 영상 노출', 'Analysis exposures') : L('노출', 'Exposures')}</dt><dd>{L(`${visit.n_exp}장 합성`, `${visit.n_exp} combined`)}</dd>
          {wide && <><dt>{L('표시 영상 노출', 'Displayed exposures')}</dt><dd>{gNow.reduce((sum, i) => sum + (wide.visits[i]?.n_exp ?? 0), 0)} <Badge kind="spherex" /></dd></>}
          {isPatch ? (
            <><dt>{L('데이터 없음', 'No data')}</dt><dd>{((visit.masked_frac ?? 0) * 100).toFixed(1)}% {L('픽셀 (마스크·가장자리)', 'of pixels (mask, edge)')}</dd></>
          ) : (
            <>
              <dt>{L('예측', 'Predicted')}</dt><dd>({visit.pred_px[0].toFixed(2)}, {visit.pred_px[1].toFixed(2)}) px <Badge kind="model" /></dd>
              <dt>{L('측정', 'Measured')}</dt>
              <dd>
                {visit.meas_px
                  ? <>({visit.meas_px[0].toFixed(2)}, {visit.meas_px[1].toFixed(2)}) ± {visit.meas_err_px?.toFixed(2)} px <Badge kind="spherex" /></>
                  : <span className="warn">{L('없음', 'none')}: {visit.meas_note ? dataText(visit.meas_note, L) : L('측정 안 함', 'not measured')}</span>}
              </dd>
            </>
          )}
          <dt>{L('원본', 'Source files')}</dt>
          <dd>
            {nUris > 0 ? (
              <details>
                <summary>{L(`IRSA 원본 영상 ${nUris}개`, `${nUris} IRSA source images`)}</summary>
                <ul className="uris">
                  {visit.irsa_uris.map((u, i) => (
                    <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{visit.exposures?.[i] ?? u.split('/').pop()}</a></li>
                  ))}
                </ul>
              </details>
            ) : '—'}
          </dd>
        </dl>
      </details></>)

  return (
    <div className="blink" data-tutorial="analysis-viewer">
      {compact?<><div className="fw-image-controls"><div className="fw-image-modes" role="group" aria-label={L('영상 보기 방식','Image display mode')}><button className={!wipeOn?'active':''} aria-pressed={!wipeOn} onClick={()=>{stop();setComparing(false);setView('image')}}>{L('한 장','Single')}</button><button className={wipeOn?'active':''} aria-pressed={wipeOn} onClick={()=>{stop();setView('image');goToVisit(meta,ab[0]);setComparing(true);if(det===0){const common=[6,5,4,3,2,1].find(d=>vs[ab[0]].detectors.includes(d)&&vs[ab[1]].detectors.includes(d));if(common)setDet(common)}}}>{L('비교','Compare')}</button></div><div className="fw-image-selects"><label><span>{L('파장','Band')}</span><select aria-label={L('영상 검출기','Image detector')} value={det} onChange={e=>{setDet(+e.target.value);setView('image')}}><option value={0}>{L('전체 파장','All bands')}</option>{[1,2,3,4,5,6].map(d=><option key={d} value={d} disabled={!vs.some(v=>v.detectors.includes(d))}>D{d} · {['','0.75–1.09','1.10–1.62','1.63–2.41','2.42–3.82','3.83–4.41','4.42–5.00'][d]} μm</option>)}</select></label><label><span>{L('시야','Field')}</span><select value={zoom} aria-label={L('관측 영상 시야','Image field of view')} onChange={e=>setZoom(+e.target.value)}>{zooms.map(z=><option key={z} value={z}>{((N*meta.wcs.cdelt_arcsec)/60/z).toFixed(z>=6?1:0)}′</option>)}</select></label></div></div>{wipeOn&&<><div className="fw-compare-pickers">{([0,1] as const).map(j=><label key={j}>{j?'B · 비교 관측':'A · 기준 관측'}<select aria-label={j?L('비교 관측 B','Comparison observation B'):L('기준 관측 A','Reference observation A')} value={selVal(ab[j])} onChange={e=>{stop();setAB(j?[ab[0],+e.target.value]:[+e.target.value,ab[1]]);if(j===0)goToVisit(meta,+e.target.value)}}>{selOpts.map(o=><option key={o.v} value={o.v}>{o.label}</option>)}</select></label>)}</div></>}</>:advancedControls}

      {coldOn && (
        <div className="cold-panel" data-testid="cold-panel">
          <div className="cold-row">
            <span>D6 − k × D5</span>
            <input type="range" min={0.5} max={1.1} step={0.01} value={coldK} onChange={(e) => setColdK(+e.target.value)} aria-label={L('빼는 비율 k', 'Subtraction ratio k')} />
            <b>k = {coldK.toFixed(2)}</b>
            <button className="link" onClick={() => setColdK(RJ_K)} disabled={Math.abs(coldK - RJ_K) < 1e-6}>{L('이론값', 'theory')} {RJ_K.toFixed(2)}</button>
            <Badge kind="model" detail={L('레일리–진스 비율', 'Rayleigh–Jeans ratio')} />
          </div>
          <p className="dim small">
            {L('보통 별은 3.8–5 µm에서 밝기가 파장의 제곱에 반비례해 거의 지워집니다. 남는 점은 4.4 µm 너머에서 빛나는 차가운 천체 후보입니다. 한 장에만 찍힌 우주선 흔적과 포화된 밝은 별 둘레도 남을 수 있으니, 여러 관측에서 같은 자리에(또는 같은 방향으로 움직이며) 남는지 확인하세요.',
              'Ordinary stars fade as 1/λ² at 3.8–5 µm and cancel. What stays is a candidate cold object shining beyond 4.4 µm. Cosmic-ray hits in a single exposure and rings around saturated stars can stay too, so check that a source stays (or moves consistently) over several visits.')}
            {' '}{L(`D5·D6가 함께 있는 관측 ${cold.length}/${vs.length}회만 만듭니다.`, `Made only for the ${cold.length}/${vs.length} visits with both D5 and D6.`)}
          </p>
          {!cold.includes(k) && <p className="warn small" data-testid="cold-missing">{L(`관측 ${k + 1}에는 D5·D6가 함께 없어 필터 영상을 만들 수 없습니다.`, `Visit ${k + 1} lacks D5 or D6, so no filtered frame exists.`)}</p>}
          {keep !== null && (
            <p className="small" data-testid="cold-survival">
              {L('대상 위치에 D6 빛의', 'At the target,')} <b>{Math.round(keep * 100)}%</b>{L('가 남았습니다', ' of the D6 light remains')} <Badge kind="spherex" /> <span className="dim">{L('(보통 별은 0% 근처)', '(ordinary stars: near 0%)')}</span>
            </p>
          )}
        </div>
      )}

      {!compact && isControl && (
        <div className="control-note" data-testid="control-note">
          {VARIABLE.has(meta.id) ? (
            <>
              <strong>{L('변광성', 'Variable star')}</strong>: {L(`${meta.display_name}의 예측 이동은 ${fmtShift(spanPx)}입니다. 같은 검출기를 골라도 픽셀별 파장이 다를 수 있으므로, 밝기 변화는 파장·품질 조건을 확인해 해석하세요.`, `${meta.display_name} has a predicted shift of ${fmtShift(spanPx)}. Even within one detector, pixel wavelengths can differ: check wavelength and quality conditions before interpreting brightness changes.`)}
            </>
          ) : (
            <>
              <strong>{L('거의 안 움직이는 대상', 'Nearly fixed target')}</strong>: {L(`관측 기간 내내 ${fmtShift(spanPx)}밖에 움직이지 않아 영상에서 움직임이 보이지 않는 것이 정상입니다.`, `It moves only ${fmtShift(spanPx)} over all visits, so no motion is expected in the images.`)}
            </>
          )}
        </div>
      )}
      {loadErr && <div className="failure" data-testid="fetch-failed">{L('영상 데이터를 불러오지 못함', 'Could not load image data')}: {loadErr}</div>}

      <div className="stage">
        <div className="frame" style={{ width: DISPLAY, height: DISPLAY }} data-testid="blink-frame" data-visit={k} data-view={wipeOn?'compare':shownView} data-frame-size={N} data-offset={o} data-window-x={win.x0} data-window-y={win.y0} data-window-width={win.w}>
          <canvas ref={canvas} width={PX} height={PX} style={{ width: DISPLAY, height: DISPLAY,visibility:wipeOn?'hidden':'visible' }} aria-label={L('실제 SPHEREx 관측 영상','Real SPHEREx observation')}/>
          {wipeOn&&<><canvas className="fw-wipe-image" ref={wipeB} width={PX} height={PX} aria-hidden="true"/><canvas className="fw-wipe-image" ref={wipeA} width={PX} height={PX} style={{clipPath:`inset(0 ${100-wipe}% 0 0)`}} aria-hidden="true"/></>}
          {!shown && !loadErr && <div className="frame-loading dim">{L('영상 불러오는 중…', 'Loading images…')}</div>}
          {shown && (wipeOn?(!frames?.[ab[0]].some(Number.isFinite)||!frames?.[ab[1]].some(Number.isFinite)||comparison.blocked):!shownHasData) && (
            <div className="frame-loading warn" data-testid="no-frame-data">
              {coldOn ? L('이 관측은 D5·D6가 함께 없어 필터 영상이 없습니다.', 'This visit lacks D5 or D6: no filtered frame.') : L('이 시점·검출기의 영상 데이터가 없습니다.', 'No image data for this visit and detector.')} {L('다른 관측이나 검출기를 선택하세요. (D5·D6)', 'Pick another visit or detector. (D5·D6)')}
            </div>
          )}
          <svg className="overlay" width={DISPLAY} height={DISPLAY} viewBox={`0 0 ${DISPLAY} ${DISPLAY}`}>
            {!isPatch && ov.region && regionCube && (() => {
              const [x0, y0] = S([regionCube.cx - regionCube.half, regionCube.cy - regionCube.half])
              const w = 2 * regionCube.half * s * zoom
              return (
                <g>
                  <rect x={x0} y={y0} width={w} height={w} fill="none" stroke="#6cb6ff" strokeOpacity={0.7} strokeWidth={1} strokeDasharray="4 3" />
                  <text x={x0 + 3} y={y0 - 4} fontSize={16} fill="#6cb6ff">{L('3D 영역', '3D region')}</text>
                </g>
              )
            })()}
            {!isPatch && ov.track && (
              <polyline points={vs.map((v) => S(E(v.pred_px)).join(',')).join(' ')} fill="none" stroke="#ffd34d" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="3 2" />
            )}
            {!isPatch && ov.circle && (
              <g fill="none" strokeWidth={2}>
                {/* A and B: where the target is in each of the two compared frames */}
                {([['A', pa, gA], ['B', pb, gB]] as const).map(([name, q, g]) => {
                  const cur = shownView === 'diff' || (g.includes(k) && !between)
                  const col = shownView === 'diff' ? (name === 'A' ? '#ff9a5c' : '#5cb6ff') : cur ? '#ffd34d' : '#9fe8d0'
                  return (
                    <g key={name}>
                      <circle cx={q[0]} cy={q[1]} r={15} stroke="#000" strokeOpacity={0.5} strokeWidth={4} />
                      <circle cx={q[0]} cy={q[1]} r={15} stroke={col} strokeDasharray={cur ? undefined : '4 3'} />
                      <text x={q[0] + (name === 'A' ? -24 : 24)} y={q[1] + 4} textAnchor="middle" fontSize={16} fontWeight={700} fill={col} stroke="#000" strokeWidth={3} paintOrder="stroke">{name}</text>
                    </g>
                  )
                })}
                {shownView !== 'diff' && !gNow.some((i) => gA.includes(i) || gB.includes(i)) && <circle cx={px} cy={py} r={15} stroke="#ffd34d" />}
                <text x={shownView === 'diff' ? pb[0] : px} y={(shownView === 'diff' ? pb[1] : py) - 22} textAnchor="middle" fontSize={16} fontWeight={700} fill="#ffd34d" stroke="#000" strokeWidth={3} paintOrder="stroke">{meta.display_name}</text>
              </g>
            )}
            {!isPatch && ov.arrow && (() => {
              // dashed A→B displacement as drawn, plus a fixed-length arrow for the direction
              const dx = pb[0] - pa[0]
              const dy = pb[1] - pa[1]
              const len = Math.hypot(dx, dy)
              if (len < 0.5) return null
              const ux = dx / len
              const uy = dy / len
              const head = (x: number, y: number, size: number) =>
                `${x},${y} ${x - ux * size - uy * size * 0.55},${y - uy * size + ux * size * 0.55} ${x - ux * size + uy * size * 0.55},${y - uy * size - ux * size * 0.55}`
              const d0 = [pb[0] + ux * 19, pb[1] + uy * 19]
              const d1 = [pb[0] + ux * 60, pb[1] + uy * 60]
              return (
                <g>
                  {len > 8 && (
                    <>
                      <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#000" strokeOpacity={0.5} strokeWidth={4} />
                      <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#9fe8d0" strokeWidth={2} strokeDasharray="5 3" />
                      <polygon points={head(pb[0], pb[1], Math.min(9, len * 0.5))} fill="#9fe8d0" />
                    </>
                  )}
                  <line x1={d0[0]} y1={d0[1]} x2={d1[0]} y2={d1[1]} stroke="#000" strokeOpacity={0.5} strokeWidth={5} />
                  <line x1={d0[0]} y1={d0[1]} x2={d1[0]} y2={d1[1]} stroke="#9fe8d0" strokeWidth={2.5} />
                  <polygon points={head(d1[0], d1[1], 9)} fill="#9fe8d0" stroke="#000" strokeOpacity={0.4} />
                  <text x={d1[0] + ux * 16} y={d1[1] + uy * 16 + 4} textAnchor="middle" fontSize={16} fontWeight={700} fill="#9fe8d0" stroke="#000" strokeWidth={3} paintOrder="stroke">{L('이동 방향', 'motion')}</text>
                </g>
              )
            })()}
            {ov.meas && meas && (
              <g stroke="#4ea1ff" strokeWidth={2} fill="none">
                <line x1={meas[0] - 6} y1={meas[1]} x2={meas[0] + 6} y2={meas[1]} />
                <line x1={meas[0]} y1={meas[1] - 6} x2={meas[0]} y2={meas[1] + 6} />
                {visit.meas_err_px && <circle cx={meas[0]} cy={meas[1]} r={Math.max(2, visit.meas_err_px * s * zoom)} strokeOpacity={0.8} />}
              </g>
            )}
            {gaiaOn && gaia.state === 'ok' && (
              <g data-testid="gaia-overlay" fill="none" stroke="#7aa2ff" strokeWidth={1.3}>
                {gaia.stars.map((st) => {
                  const [ra, dec] = propagate(st, visit.mjd)
                  const [x, y] = S(skyToGridPx(meta.wcs.crval, meta.wcs.cdelt_arcsec, n, ra, dec))
                  if (x < -8 || y < -8 || x > DISPLAY + 8 || y > DISPLAY + 8) return null
                  const r = st.g === undefined ? 4 : Math.max(3, Math.min(9, 13 - st.g * 0.5))
                  return (
                    <g key={st.id}>
                      <circle cx={x} cy={y} r={r} strokeOpacity={0.9}><title>{`Gaia DR3 ${st.id}${st.g !== undefined ? ` · G ${st.g.toFixed(1)}` : ''}`}</title></circle>
                      {st.g !== undefined && st.g < 11.5 && <text x={x + r + 2} y={y - r} fontSize={16} fill="#a9c2ff" stroke="#000" strokeWidth={2.5} paintOrder="stroke">G {st.g.toFixed(1)}</text>}
                    </g>
                  )
                })}
              </g>
            )}
            {ov.compass && (
              <g stroke="#e8eefb" strokeWidth={1.6} fill="#e8eefb" fontSize={16} fontWeight={700}>
                <line x1={DISPLAY - 22} y1={46} x2={DISPLAY - 22} y2={18} />
                <polygon points={`${DISPLAY - 26},22 ${DISPLAY - 18},22 ${DISPLAY - 22},14`} stroke="none" />
                <text x={DISPLAY - 22} y={11} textAnchor="middle" stroke="none">N</text>
                <line x1={DISPLAY - 22} y1={46} x2={DISPLAY - 50} y2={46} />
                <polygon points={`${DISPLAY - 46},42 ${DISPLAY - 46},50 ${DISPLAY - 54},46`} stroke="none" />
                <text x={DISPLAY - 62} y={50} textAnchor="middle" stroke="none">E</text>
              </g>
            )}
            {ov.scalebar && (
              <g fill="#e8eefb" fontSize={16}>
                <rect x={12} y={DISPLAY - 16} width={barW} height={3} />
                <text x={12 + barW / 2} y={DISPLAY - 22} textAnchor="middle">{bar.label}</text>
              </g>
            )}
          </svg>
          {wipeOn&&<><span className="fw-compare-tag a">A · {vs[ab[0]].utc.slice(0,10)}</span><span className="fw-compare-tag b">B · {vs[ab[1]].utc.slice(0,10)}</span><div className="fw-wipe-slider" style={{left:`${wipe}%`}} role="slider" tabIndex={0} aria-label={L('두 관측 비교 경계','Observation comparison boundary')} aria-valuemin={3} aria-valuemax={97} aria-valuenow={Math.round(wipe)} onPointerDown={e=>{e.preventDefault();wipeDrag.current=true;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!wipeDrag.current)return;const r=e.currentTarget.parentElement!.getBoundingClientRect();setWipe(Math.max(3,Math.min(97,(e.clientX-r.left)/r.width*100)))}} onPointerUp={e=>{wipeDrag.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{wipeDrag.current=false}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();setWipe(v=>e.key==='Home'?3:e.key==='End'?97:Math.max(3,Math.min(97,v+(e.key==='ArrowLeft'?-5:5))))}}><span>↔</span></div></>}
          {!wipeOn&&<div className="frame-tag">
            {shownView === 'diff' ? L('A − B 차이', 'A − B difference') : shownView === 'cold' ? `${L('차가운 천체 필터', 'Cold-object filter')} · ${nameOf(gNow)} · ${vs[gNow[0]].utc.slice(0, 10)}` : `${nameOf(gNow)} · ${vs[gNow[0]].utc.slice(0, 10)}`}
            {shownView !== 'cold' && det > 0 && ` · D${det}`}
            {` · ${L('시야', 'field')} ${fieldArcmin.toFixed(fieldArcmin < 4 ? 1 : 0)}′`}
          </div>}
          {between && shownView !== 'diff' && (
            <div className="between" data-testid="between">
              {L('관측 사이: 직전 관측 영상 표시 중', 'Between visits: showing the previous visit')}
              {nextDays !== null && <> · {L(`다음 관측까지 ${nextDays.toFixed(1)}일`, `next visit in ${nextDays.toFixed(1)} d`)}</>}
            </div>
          )}
        </div>
      </div>

      {compact?<><div className="fw-image-bottom">{!isPatch&&<button aria-pressed={ov.circle} onClick={()=>setOv(v=>({...v,circle:!v.circle,arrow:!v.circle,track:!v.circle}))}>{L('예상 위치','Predicted positions')}</button>}<details className="fw-image-advanced" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.stopPropagation()}}}><summary>{L('영상 설정','Image settings')}</summary><div className="fw-settings-content">{advancedControls}{imageDetails}</div></details></div></>:imageDetails}

    </div>
  )
}
