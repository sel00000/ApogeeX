import { useEffect, useMemo, useRef, useState } from 'react'
import type { TargetsIndex } from '../types'
import { FOV_MAX, FOV_MIN, SkyGlobe } from '../gl/SkyGlobe'
import type { GlobeGround, GlobeView } from '../gl/SkyGlobe'
import { parseConstellations } from '../gl/globe/constellations'
import type { Constellation } from '../gl/globe/constellations'
import { SEOUL, isAboveSkyline, observerFrame } from '../gl/globe/horizon'
import { MAP_CHANNELS, SPHEREX_HIPS, sesame } from '../lib/sky'
import { parseCoords } from '../lib/coords'
import type { Radec } from '../lib/coords'
import { useL } from '../lib/i18n'
import { useTime } from '../store'
import { readView, writeView } from '../lib/urlState'
import { flushSkyModeFocus, notifyShell } from '../lib/integration'
import { SKY_PREF_CONSTELLATIONS, SKY_PREF_GROUND, needFigures, planetariumMessage, readSkyPref, writeSkyPref } from '../lib/skyView'
import { DETECTORS } from './PhotometryPanel'
import { Badge } from './Badge'

// Live all-sky navigator. The globe engine (gl/SkyGlobe.ts, gl/globe/*) is 경보's TrueBlink code,
// used unchanged: it reads SPHEREx all-sky HiPS tiles straight from IRSA (CORS allowed, no relay)
// for one of the 102 spectral channels and lets you drag, zoom and click the celestial sphere.

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
export function fmtHms(ra: number) {
  const s = (((ra % 360) + 360) % 360) / 15 * 3600
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${pad(h)}h${pad(m)}m${sec.toFixed(1).padStart(4, '0')}s`
}
export function fmtDms(dec: number) {
  const sg = dec < 0 ? '−' : '+', a = Math.abs(dec) * 3600
  const d = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60
  return `${sg}${pad(d)}°${pad(m)}′${s.toFixed(0).padStart(2, '0')}″`
}
const sep = (a: Radec, b: Radec) => {
  const r = Math.PI / 180
  const c = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r)
  return Math.acos(Math.min(1, c)) / r
}
const detectorOf = (um: number) => (um < 1.095 ? 1 : um < 1.625 ? 2 : um < 2.415 ? 3 : um < 3.825 ? 4 : um < 4.415 ? 5 : 6)

type Pick = { ra: number; dec: number; name?: string }

// Constellation figures (a guide drawing, not SPHEREx data): fetched once, the first time the layer is on in Find.
// A failed fetch is not cached, so the next visit tries again.
let figures: Promise<Constellation[]> | null = null
function loadFigures(): Promise<Constellation[]> {
  figures ??= fetch(`${import.meta.env.BASE_URL}data/sky/constellations.json`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .then((j) => { const list = parseConstellations(j); if (!list) throw new Error('bad constellation file'); return list })
    .catch((e) => { figures = null; throw e })
  return figures
}

export function SkyPanel({ index, currentId, onOpenTarget, onPatch, embedded = false }: {
  index: TargetsIndex
  embedded?: boolean
  currentId: string | null
  onOpenTarget: (id: string) => void
  onPatch: (c: Radec, fov: number, label?: string) => void
}) {
  const L = useL()
  const lang = useTime((s) => s.lang)
  const suspended = useTime((s) => s.suspended)
  const box = useRef<HTMLDivElement>(null)
  const readRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)
  // `sky=<ra>,<dec>,<fov>` in the URL opens the globe on that sky (a link shared from here or the planetarium)
  const [initialSky] = useState(() => readView().sky)
  const [constOn, setConstOn] = useState(() => readSkyPref(SKY_PREF_CONSTELLATIONS, true))
  const [groundOn, setGroundOn] = useState(() => readSkyPref(SKY_PREF_GROUND, false))
  const [figuresFailed, setFiguresFailed] = useState(false)
  const [gs, setGs] = useState<GlobeGround>(() => ({ on: false, epochMs: Date.now() }))
  const [onScreen, setOnScreen] = useState(true)
  const globe = useRef<SkyGlobe | null>(null)
  const figuresAsked = useRef(false)
  const targets = useMemo(() => index.targets.filter((t) => t.ra !== undefined && t.dec !== undefined && t.status === 'ok'), [index])
  const start = targets.find((t) => t.id === currentId) ?? targets[0]
  const [ci, setCi] = useState(() => Math.max(0, MAP_CHANNELS.findIndex((c) => c.um >= 1.2)))
  const [view, setView] = useState<GlobeView>(initialSky ? { ra: initialSky.ra, dec: initialSky.dec, fovDeg: initialSky.fov } : { ra: start?.ra ?? 83.8, dec: start?.dec ?? -1.2, fovDeg: 40 })
  const [status, setStatus] = useState({ loaded: 0, pending: 0, failed: 0, order: 0, note: '' })
  const [picked, setPicked] = useState<Pick | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fov, setFov] = useState(0.1)

  useEffect(() => {
    const el = box.current!
    const first = initialSky ? { ra: initialSky.ra, dec: initialSky.dec, fovDeg: initialSky.fov } : { ra: start?.ra, dec: start?.dec, fovDeg: 40 }
    const g = new SkyGlobe(el, { baseUrl: SPHEREX_HIPS, view: first, channel: MAP_CHANNELS[ci].channel, ground: groundOn })
    globe.current = g
    g.setConstellationsVisible(constOn)
    g.setConstellationLang(useTime.getState().lang)
    g.setLabelAvoid([readRef.current, zoomRef.current].filter((x): x is HTMLDivElement => !!x))
    setGs(g.getGroundState())
    figuresAsked.current = false
    const offPick = g.on('pick', (p) => {
      const t = p.markerId ? targets.find((x) => x.id === p.markerId) : undefined
      setPicked({ ra: t?.ra ?? p.ra, dec: t?.dec ?? p.dec, name: t?.display_name })
    })
    // the view goes into the URL 400 ms after it settles (same path as the other view parameters)
    let urlTimer = 0
    const offView = g.on('view', (v) => {
      setView(v)
      clearTimeout(urlTimer)
      urlTimer = window.setTimeout(() => writeView({ sky: v }), 400)
    })
    const offGround = g.on('ground', (x) => setGs(x))
    // the ground clock only runs while the map is on screen
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting))) : null
    io?.observe(el)
    const timer = window.setInterval(() => {
      const s = g.getStatus()
      setStatus({ loaded: s.tilesLoaded, pending: s.tilesPending, failed: s.tilesFailed, order: s.order, note: s.note })
    }, 700)
    const ro = new ResizeObserver(() => g.resize())
    ro.observe(el)
    return () => {
      offPick(); offView(); offGround(); clearInterval(timer); clearTimeout(urlTimer); ro.disconnect(); io?.disconnect(); g.dispose(); globe.current = null
      // leaving Find: the next visit starts from the target again, as before
      writeView({ sky: null })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    globe.current?.setMarkers(targets.map((t) => ({ id: t.id, ra: t.ra!, dec: t.dec!, label: t.display_name, color: t.id === currentId ? '#ffd34d' : '#9fe8d0' })))
  }, [targets, currentId])
  useEffect(() => { globe.current?.setChannel(MAP_CHANNELS[ci].channel) }, [ci])
  useEffect(() => { globe.current?.setConstellationsVisible(constOn); writeSkyPref(SKY_PREF_CONSTELLATIONS, constOn) }, [constOn])
  // download the figures only while the layer is on: at start (the default) or the first time the box is ticked
  useEffect(() => {
    const g = globe.current
    if (!g || !needFigures(constOn, figuresAsked.current)) return
    figuresAsked.current = true
    // results for a globe that has since been disposed (Find closed) are dropped
    loadFigures().then((list) => { if (globe.current === g) { setFiguresFailed(false); g.setConstellations(list) } },
      () => { if (globe.current === g) { setFiguresFailed(true); figuresAsked.current = false } })
  }, [constOn])
  // a portal focus request that came before Find was shown
  useEffect(() => { flushSkyModeFocus() }, [])
  useEffect(() => { globe.current?.setGround(groundOn); writeSkyPref(SKY_PREF_GROUND, groundOn) }, [groundOn])
  useEffect(() => { globe.current?.setActive(onScreen && !suspended) }, [onScreen, suspended])
  useEffect(() => {
    globe.current?.setConstellationLang(lang)
    globe.current?.setGroundLabels({
      compass: L('북,동,남,서', 'N,E,S,W').split(','),
      ariaAllLabel: L('전천 지도. 끌어서 이동하고 스크롤하거나 두 손가락으로 확대·축소합니다. 방향키로 움직이고 플러스와 마이너스 키로 확대·축소합니다.', 'All-sky map. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.'),
      ariaLabel: L('지표면이 있는 서울의 하늘. 끌어서 이동하고 스크롤하거나 두 손가락으로 확대·축소합니다. 방향키로 움직이거나 플러스와 마이너스 키로 확대·축소할 수도 있습니다.', 'Sky over Seoul with the ground. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.'),
    })
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const toPlanetarium = () => {
    const v = globe.current?.getView() ?? view
    notifyShell(planetariumMessage(v))
  }

  const go = (p: Pick, fovDeg = 2) => { globe.current?.lookAt({ ra: p.ra, dec: p.dec }, fovDeg); setPicked(p) }
  const find = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const c = parseCoords(query)
    if (c) return go({ ...c })
    if (!query.trim()) return setErr(L('좌표나 천체 이름을 입력하세요', 'Type coordinates or a name'))
    setBusy(true)
    try {
      const r = await sesame(query)
      if (!r) setErr(L(`'${query}'을(를) 찾지 못했습니다`, `No resolver knows '${query}'`))
      else go({ ra: r.ra, dec: r.dec, name: r.name + (r.moved ? L(' (고유운동 반영, 오늘 위치)', ' (moved by proper motion to today)') : '') })
    } catch (ex) {
      setErr(L('이름 찾기 서비스에 연결하지 못했습니다: ', 'Name service unavailable: ') + (ex as Error).message)
    } finally { setBusy(false) }
  }
  const zoom = (k: number) => {
    const v = globe.current?.getView()
    if (v) globe.current!.lookAt({ ra: v.ra, dec: v.dec }, Math.min(FOV_MAX, Math.max(FOV_MIN, v.fovDeg * k)))
  }
  const ch = MAP_CHANNELS[ci]
  const det = detectorOf(ch.um)
  // ground view: the picked position is under Seoul's horizon (or behind the skyline) at the globe's clock
  const below = !!picked && gs.on && !isAboveSkyline(observerFrame(gs.epochMs, SEOUL), picked.ra, picked.dec)
  const fmtAlt = (a: number) => { const r = Math.round(a * 10) / 10; return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}` }
  const near = picked ? targets.map((t) => ({ t, d: sep(picked, { ra: t.ra!, dec: t.dec! }) })).sort((a, b) => a.d - b.d)[0] : null

  return (
    <section className="sky-panel" data-testid="sky-panel">
      <div className="sky-globe">
        <div className="globe-box" ref={box} data-testid="sky-globe" aria-label={L('SPHEREx 전천 천구: 끌어서 돌리고, 휠로 확대하고, 눌러서 좌표를 고릅니다', 'SPHEREx all-sky globe: drag to turn, scroll to zoom, click to pick a position')} />
        <div className="globe-zoom" ref={zoomRef} role="group" aria-label={L('확대', 'Zoom')}>
          <button onClick={() => zoom(0.6)} aria-label={L('확대', 'Zoom in')}>+</button>
          <button onClick={() => zoom(1 / 0.6)} aria-label={L('축소', 'Zoom out')}>−</button>
        </div>
        {/* ground on: the read-out moves to the top (the ground fills the bottom) and gives azimuth and altitude, as in TrueBlink */}
        <div className={`globe-read${gs.on ? ' on-ground' : ''}`} ref={readRef} data-testid="sky-view">
          {gs.on && view.azDeg !== undefined && view.altDeg !== undefined
            ? <span data-testid="sky-azalt">{L(`방위각 ${view.azDeg.toFixed(1)}° · 고도 ${fmtAlt(view.altDeg)}°`, `Az ${view.azDeg.toFixed(1)}° · Alt ${fmtAlt(view.altDeg)}°`)}</span>
            : <>{fmtHms(view.ra)} {fmtDms(view.dec)} · {L('시야', 'field')} {view.fovDeg.toFixed(view.fovDeg < 10 ? 1 : 0)}°</>}
        </div>
      </div>

      <aside className="sky-side">
        {embedded && (
          <div className="mode-switch sky-mode" role="group" aria-label={L('천구 보기 방식', 'Sky view')} data-testid="sky-mode">
            <button type="button" className="on" aria-pressed="true" data-testid="sky-mode-spherex">{L('SPHEREx 천구', 'SPHEREx sky')}</button>
            <button type="button" aria-pressed="false" onClick={toPlanetarium} data-testid="sky-mode-planetarium">{L('플라네타리움', 'Planetarium')}</button>
          </div>
        )}
        <form className="sky-find" onSubmit={find} data-testid="sky-find">
          <label htmlFor="sky-q">{L('좌표나 이름으로 찾기', 'Find by coordinates or name')}</label>
          <div className="row">
            <input id="sky-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('예: 269.45 +4.69 · M42 · Betelgeuse', 'e.g. 269.45 +4.69 · M42 · Betelgeuse')} />
            <button type="submit" className="primary" disabled={busy}>{busy ? L('찾는 중…', 'Finding…') : L('이동', 'Go')}</button>
          </div>
          {err && <p className="warn small" data-testid="sky-err">{err}</p>}
          <p className="dim small">{L('이름은 CDS Sesame(실시간)로 찾습니다.', 'Names are resolved live with CDS Sesame.')} <Badge kind="catalog" /></p>
        </form>

        <div className="sky-wave">
          <label htmlFor="sky-ch">{L('파장', 'Wavelength')} <b style={{ color: DETECTORS[det].color }}>{ch.um.toFixed(2)} µm</b> <span className="dim small">D{det} · {L('채널', 'channel')} {ch.channel}</span></label>
          <input id="sky-ch" type="range" min={0} max={MAP_CHANNELS.length - 1} value={ci} onChange={(e) => setCi(+e.target.value)} data-testid="sky-channel" />
          <div className="sky-ruler" aria-hidden><span>0.75</span><span>5.0 µm</span></div>
        </div>

        <div className="sky-overlays" data-testid="sky-overlays">
          <h3>{L('하늘 표시', 'Sky overlays')}</h3>
          <label className="check"><input type="checkbox" checked={constOn} onChange={(e) => setConstOn(e.target.checked)} data-testid="sky-constellations" />{L('별자리 선과 이름', 'Constellation lines and names')}</label>
          {figuresFailed && <p className="dim small" data-testid="sky-constellations-failed">{L('별자리 자료를 불러오지 못했습니다', 'Could not load the constellation figures')}</p>}
          <label className="check"><input type="checkbox" checked={groundOn} onChange={(e) => setGroundOn(e.target.checked)} data-testid="sky-ground" />{L('지면 (서울, 지금)', 'Ground (Seoul, now)')}</label>
          {constOn && !figuresFailed && <p className="dim small">{L('별자리 선은 길잡이 그림이고 SPHEREx 자료가 아닙니다.', 'Constellation figures are a guide drawing, not SPHEREx data.')} <Badge kind="catalog" /></p>}
          {groundOn && <p className="dim small">{L('서울(37.57°N, 126.98°E)의 지금 하늘입니다. 지평선 아래는 땅으로 가립니다.', 'The sky over Seoul (37.57°N, 126.98°E) right now. The ground covers what is below the horizon.')}</p>}
        </div>

        {picked ? (
          <div className="sky-pick" data-testid="sky-pick">
            <h3>{picked.name ?? L('고른 위치', 'Picked position')}</h3>
            <p className="coord">{fmtHms(picked.ra)} {fmtDms(picked.dec)}<br /><span className="dim small">{picked.ra.toFixed(5)}°, {picked.dec >= 0 ? '+' : ''}{picked.dec.toFixed(5)}°</span></p>
            {below && (
              <p className="small sky-below" role="status" data-testid="sky-below-horizon">
                {L('고른 위치는 지금 서울의 지평선 아래에 있습니다.', "The picked position is below Seoul's horizon right now.")}{' '}
                <button type="button" className="link" onClick={() => setGroundOn(false)}>{L('지면 끄기', 'Turn the ground off')}</button>
              </p>
            )}
            {near && near.d < 0.3 ? (
              <button className="primary" onClick={() => onOpenTarget(near.t.id)} data-testid="sky-open-target">
                {L(`${near.t.display_name} 분석 열기`, `Open ${near.t.display_name} analysis`)}
              </button>
            ) : (
              <>
                <div className="row">
                  <select value={fov} onChange={(e) => setFov(+e.target.value)} aria-label={L('시야', 'Field of view')}>
                    {[0.1, 0.2, 0.3].map((f) => <option key={f} value={f}>{f}°</option>)}
                  </select>
                  <button className="primary" onClick={() => onPatch({ ra: picked.ra, dec: picked.dec }, fov, picked.name)} data-testid="sky-analyse">{L('이 위치 SPHEREx 영상 받기', 'Fetch SPHEREx images here')}</button>
                </div>
                <p className="dim small">{L('좌표 검색 서버(scripts/server.py)가 IRSA에서 이 영역의 관측을 받아 같은 격자로 맞춥니다.', 'The search server (scripts/server.py) downloads the visits covering this spot from IRSA and puts them on our grid.')}{near && <> {L(`가장 가까운 대상: ${near.t.display_name} (${near.d.toFixed(1)}°)`, `Nearest target: ${near.t.display_name} (${near.d.toFixed(1)}°)`)}</>}</p>
              </>
            )}
          </div>
        ) : (
          <p className="dim small">{L('천구를 누르면 그 좌표를 고릅니다. 표시된 대상을 누르면 바로 분석을 열 수 있습니다.', 'Click the sky to pick a position. Click a labelled target to open its analysis.')}</p>
        )}

        <div className="sky-targets">
          <h3>{L('챌린지 대상으로 날아가기', 'Fly to a challenge target')}</h3>
          {targets.map((t) => (
            <button key={t.id} className={t.id === currentId ? 'on' : ''} onClick={() => go({ ra: t.ra!, dec: t.dec!, name: t.display_name }, 1.5)} data-testid={`sky-go-${t.id}`}>{t.display_name}</button>
          ))}
        </div>

        <p className="dim small sky-status" data-testid="sky-status">
          <Badge kind="spherex" /> {L('IRSA에서 실시간', 'Live from IRSA')}: {L('타일', 'tiles')} {status.loaded} {L('받음', 'loaded')}
          {status.pending > 0 && <> · {status.pending} {L('받는 중', 'loading')}</>}
          {status.failed > 0 && <span className="warn"> · {status.failed} {L('실패', 'failed')}</span>} · HiPS order {status.order}
          {status.note && <><br />{status.note}</>}
        </p>
        <p className="dim small">{L('전천 영상은 SPHEREx DR1 전천 큐브(102색, 1년 평균)입니다. 변화를 보여 주지 않으니, 고른 뒤 Blink로 날짜별 영상을 확인하세요.', 'The map is the SPHEREx DR1 all-sky cube (102 colours, a yearly average). It cannot show change: pick a spot, then blink its dated images.')}</p>
      </aside>
    </section>
  )
}
