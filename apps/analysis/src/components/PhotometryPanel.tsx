import { useMemo, useState } from 'react'
import type { TargetMeta } from '../types'
import { useTime, visitIndexAt } from '../store'
import { fmtDate } from '../lib/ephem'
import { Badge } from './Badge'

export interface PhotRow {
  visit: number
  exposure: string
  detector: number
  mjd: number
  wave_um: number | null
  bandwidth_um: number | null
  flux_mjy: number | null
  err_mjy: number | null
  ring_mjy_sr?: number | null
  ring_err?: number | null
  flags: string[]
  note: string | null
}

// SPHEREx detector arrays, short → long wavelength
export const DETECTORS: Record<number, { range: string; color: string }> = {
  1: { range: '0.75–1.09 µm', color: '#7f8cff' },
  2: { range: '1.10–1.62 µm', color: '#4fc3f7' },
  3: { range: '1.63–2.41 µm', color: '#4cc38a' },
  4: { range: '2.42–3.82 µm', color: '#e0c341' },
  5: { range: '3.83–4.41 µm', color: '#ff9a3c' },
  6: { range: '4.42–5.00 µm', color: '#ff5d5d' },
}

type Q = 'flux' | 'ring'
const W = 520
const H = 230
const M = { l: 52, r: 12, t: 12, b: 34 }

function niceLogTicks(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
    }
  return out
}
/** First-of-month MJDs between t0 and t1, thinned to at most 7 labels. */
function monthTicks(t0: number, t1: number): number[] {
  const d = new Date((t0 - 40587) * 86400e3)
  const out: number[] = []
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; ; m++) {
    const t = Date.UTC(y, m, 1) / 86400e3 + 40587
    if (t > t1) break
    out.push(t)
  }
  const step = Math.ceil(out.length / 7)
  return out.filter((_, i) => i % step === 0)
}
const fmtV = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toPrecision(2) : v.toPrecision(1))

/** Light curve (brightness vs time, per detector) and spectrum (brightness vs wavelength for
 *  the visit on screen), both from per-exposure aperture photometry on SPHEREx images. */
export function PhotometryPanel({ meta }: { meta: TargetMeta & { photometry?: PhotRow[] } }) {
  const tMjd = useTime((s) => s.tMjd)
  const { goToVisit } = useTime.getState()
  const rows = useMemo(() => meta.photometry ?? [], [meta])
  const nFlux = rows.filter((r) => r.flux_mjy != null && r.flux_mjy > 0).length
  const nRing = rows.filter((r) => r.ring_mjy_sr != null && r.ring_mjy_sr > 0).length
  const [q, setQ] = useState<Q>(nFlux >= nRing ? 'flux' : 'ring')
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const k = visitIndexAt(meta, tMjd)

  const val = (r: PhotRow) => (q === 'flux' ? r.flux_mjy : r.ring_mjy_sr) ?? null
  const err = (r: PhotRow) => (q === 'flux' ? r.err_mjy : r.ring_err) ?? 0
  const pts = rows.filter((r) => { const v = val(r); return v !== null && v > 0 && !hidden.has(r.detector) })
  if (!rows.length) return null

  const ys = pts.map(val) as number[]
  const lo = ys.length ? Math.min(...ys) / 1.3 : 1
  const hi = ys.length ? Math.max(...ys) * 1.3 : 10
  const Y = (v: number) => M.t + (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (H - M.t - M.b)
  const t0 = meta.visits[0].mjd - 10
  const t1 = meta.visits[meta.visits.length - 1].mjd + 10
  const Xt = (t: number) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r)
  const Xw = (w: number) => M.l + ((w - 0.7) / (5.05 - 0.7)) * (W - M.l - M.r)
  const yTicks = niceLogTicks(lo, hi)
  const unit = q === 'flux' ? 'mJy' : 'MJy/sr (상대)'
  const cur = pts.filter((r) => r.visit === k && r.wave_um)
  const dets = [...new Set(rows.map((r) => r.detector))].sort()

  const axisY = (
    <g className="ax">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} />
          <text x={M.l - 6} y={Y(v) + 4} textAnchor="end">{fmtV(v)}</text>
        </g>
      ))}
      <text x={12} y={M.t + (H - M.t - M.b) / 2} transform={`rotate(-90 12 ${M.t + (H - M.t - M.b) / 2})`} textAnchor="middle">{unit}</text>
    </g>
  )

  return (
    <section className="phot" data-testid="photometry">
      <header>
        <h3>밝기 변화와 스펙트럼 <Badge kind="spherex" /></h3>
        <span className="seg">
          <button className={q === 'flux' ? 'active' : ''} onClick={() => setQ('flux')} disabled={!nFlux}>측광 ({nFlux})</button>
          <button className={q === 'ring' ? 'active' : ''} onClick={() => setQ('ring')} disabled={!nRing} title="중심이 포화된 노출: 바깥 고리 밝기(상대값)">포화 시 고리 밝기 ({nRing})</button>
        </span>
        <span className="det-keys">
          {dets.map((d) => (
            <button key={d} className={hidden.has(d) ? 'off' : ''} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(d)) n.delete(d); else n.add(d); return n })}
              title={DETECTORS[d].range}>
              <i style={{ background: DETECTORS[d].color }} />D{d}
            </button>
          ))}
        </span>
      </header>
      <div className="charts">
        <figure>
          <figcaption>광도 곡선 — 노출 하나가 점 하나, 색 = 검출기(파장대)</figcaption>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="광도 곡선">
            {axisY}
            <g className="ax">
              {monthTicks(t0, t1).map((t) => (
                <g key={t}>
                  <line x1={Xt(t)} x2={Xt(t)} y1={H - M.b} y2={H - M.b + 4} />
                  <text x={Xt(t)} y={H - 12} textAnchor="middle">{fmtDate(t).slice(2, 7)}</text>
                </g>
              ))}
            </g>
            <line x1={Xt(tMjd)} x2={Xt(tMjd)} y1={M.t} y2={H - M.b} stroke="#ffb347" strokeWidth={1.5} />
            {pts.map((r, i) => {
              const v = val(r)!
              const e = err(r)
              return (
                <g key={i} onClick={() => goToVisit(meta, r.visit)} className="pt">
                  {e > 0 && <line x1={Xt(r.mjd)} x2={Xt(r.mjd)} y1={Y(Math.max(lo, v - e))} y2={Y(v + e)} stroke={DETECTORS[r.detector].color} strokeOpacity={0.5} />}
                  <circle cx={Xt(r.mjd)} cy={Y(v)} r={r.visit === k ? 3.4 : 2.4} fill={DETECTORS[r.detector].color} fillOpacity={r.visit === k ? 1 : 0.75}>
                    <title>{`${r.exposure} · ${fmtDate(r.mjd)} · ${r.wave_um?.toFixed(2)} µm · ${v.toFixed(3)} ${unit}${r.flags.length ? ` · FLAGS ${r.flags.join(',')}` : ''}`}</title>
                  </circle>
                </g>
              )
            })}
          </svg>
        </figure>
        <figure>
          <figcaption>스펙트럼 — 관측 {k + 1} ({fmtDate(meta.visits[k].mjd)})의 노출 {cur.length}개, 회색 = 다른 관측</figcaption>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="스펙트럼">
            {axisY}
            <g className="ax">
              {[1, 2, 3, 4, 5].map((w) => <text key={w} x={Xw(w)} y={H - 12} textAnchor="middle">{w} µm</text>)}
            </g>
            {pts.filter((r) => r.visit !== k && r.wave_um).map((r, i) => (
              <circle key={i} cx={Xw(r.wave_um!)} cy={Y(val(r)!)} r={1.6} fill="#8592ab" fillOpacity={0.35} />
            ))}
            {cur.sort((a, b) => a.wave_um! - b.wave_um!).map((r, i) => (
              <circle key={i} cx={Xw(r.wave_um!)} cy={Y(val(r)!)} r={3.4} fill={DETECTORS[r.detector].color}>
                <title>{`${r.wave_um!.toFixed(3)} µm (폭 ${r.bandwidth_um?.toFixed(3)}) · ${val(r)!.toFixed(3)} ${unit}`}</title>
              </circle>
            ))}
            {!cur.length && <text x={W / 2} y={H / 2} textAnchor="middle" className="ax">이 관측에는 {q === 'flux' ? '측광' : '고리 밝기'} 값이 없음</text>}
          </svg>
        </figure>
      </div>
      <p className="dim small">
        SPHEREx 원본 노출마다 대상 위치에서 잰 밝기입니다(반지름 2.5 픽셀 구경, 바깥 고리로 배경 제거). 구경 보정을 하지 않았으니
        검출기와 실제 파장 구간·품질 조건을 함께 확인하며 시간별 밝기(광도 곡선)나 파장별 모양(스펙트럼)을 비교하세요. 같은 검출기만으로 파장 일치가 보장되지는 않습니다.
        {q === 'ring' && ' 고리 밝기 = 중심이 포화된 노출에서 그 바깥 픽셀의 평균 밝기로, 별 밝기에 비례하는 상대값입니다.'}
        {' '}한 검출기 안에서도 파장이 조금씩 달라(선형 가변 필터) 점이 퍼질 수 있습니다.
      </p>
    </section>
  )
}
