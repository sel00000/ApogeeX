import { useRef } from 'react'
import type { TargetMeta } from '../types'
import { onVisit, useTime, visitIndexAt } from '../store'
import { fmtDate } from '../lib/ephem'
import { useL } from '../lib/i18n'

export function Timeline({ meta }: { meta: TargetMeta }) {
  const tMjd = useTime((s) => s.tMjd)
  const playing = useTime((s) => s.playing)
  const playMode = useTime((s) => s.playMode)
  const speed = useTime((s) => s.speed)
  const { setTime, goToVisit, play, stop, setSpeed } = useTime.getState()
  const track = useRef<HTMLDivElement>(null)
  const L = useL()

  const vs = meta.visits
  const t0 = vs[0].mjd
  const t1 = vs[vs.length - 1].mjd
  const span = Math.max(t1 - t0, 1)
  const x = (mjd: number) => ((mjd - t0) / span) * 100
  const k = visitIndexAt(meta, tMjd)
  const exact = onVisit(meta, tMjd)
  const nextDays = k < vs.length - 1 ? vs[k + 1].mjd - tMjd : null
  const timeOn = playing && playMode === 'time'

  // drag anywhere on the track to scrub continuous time
  const scrub = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setTime(t0 + f * span)
  }
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).classList.contains('tl-marker')) return
    stop()
    scrub(e.clientX)
    const move = (ev: PointerEvent) => scrub(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // visits come in survey passes a few days long, half a year apart: group them so the
  // track reads as "pass 1, pass 2, …" instead of a row of overlapping dots
  const groups: { i0: number; i1: number }[] = []
  vs.forEach((v, i) => {
    const g = groups[groups.length - 1]
    if (g && v.mjd - vs[g.i1].mjd < 20) g.i1 = i
    else groups.push({ i0: i, i1: i })
  })

  return (
    <footer className="timeline" data-testid="timeline">
      <div className="tl-row">
        <button className={`tl-play${timeOn ? ' active' : ''}`} onClick={() => (timeOn ? stop() : play('time'))} aria-label={timeOn ? L('시간 재생 멈추기', 'Stop time') : L('시간 재생', 'Play time')}>
          {timeOn ? L('■ 정지', '■ Stop') : L('▶ 시간 재생', '▶ Play time')}
        </button>
        <label className="field tl-speed">
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label={L('재생 속도', 'Playback speed')}>
            {[2, 5, 20, 60].map((v) => <option key={v} value={v}>{v} {L('일/초', 'd/s')}</option>)}
          </select>
        </label>
        <span className="tl-now-label" data-testid="t-now">
          <b>{fmtDate(tMjd)}</b> <span>MJD {tMjd.toFixed(2)}</span>
        </span>
        <span className={exact ? 'tl-state on' : 'tl-state'}>
          {exact ? L(`관측 ${k + 1}/${vs.length}`, `Visit ${k + 1}/${vs.length}`) : nextDays !== null ? L(`관측 사이 · 다음까지 ${nextDays.toFixed(1)}일`, `Between visits · next in ${nextDays.toFixed(1)} d`) : L('마지막 관측 이후', 'After the last visit')}
        </span>
      </div>
      <div className="tl-track" ref={track} onPointerDown={onDown}>
        <div className="tl-rail" />
        <div className="tl-fill" style={{ transform: `scaleX(${x(tMjd) / 100})` }} />
        {groups.map((g, gi) => (
          <span key={gi} className={`tl-group${x(vs[g.i0].mjd) > 88 ? ' tl-group-end' : ''}`} style={{ left: `${x(vs[g.i0].mjd)}%`, width: `${Math.max(0, x(vs[g.i1].mjd) - x(vs[g.i0].mjd))}%` }}>
            <span className="tl-group-label">{vs[g.i0].utc.slice(0, 7).replace('-', '.')}</span>
          </span>
        ))}
        {vs.map((v, i) => (
          <button
            key={i}
            className={`tl-marker${i === k && exact ? ' active' : ''}${i <= k ? ' past' : ''}`}
            style={{ left: `${x(v.mjd)}%` }}
            onClick={() => { stop(); goToVisit(meta, i) }}
            title={L(`관측 ${i + 1} · ${v.utc.slice(0, 10)} · ${v.n_exp}장`, `Visit ${i + 1} · ${v.utc.slice(0, 10)} · ${v.n_exp} exposures`)}
            aria-label={L(`관측 ${i + 1}로 이동`, `Go to visit ${i + 1}`)}
          />
        ))}
        <div className="tl-cursor" style={{ left: `${x(tMjd)}%` }} />
      </div>
    </footer>
  )
}
