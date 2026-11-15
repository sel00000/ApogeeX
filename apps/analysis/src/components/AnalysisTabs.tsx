import { useEffect, useMemo, useState } from 'react'
import type { TargetMeta } from '../types'
import type { PhotRow } from './PhotometryPanel'
import { useTime, visitIndexAt } from '../store'
import type { AnalysisTab } from '../store'
import { fmtDate } from '../lib/ephem'
import { VARIABLES } from '../lib/findings'
import { writeView } from '../lib/urlState'
import { Badge } from './Badge'
import { TargetCard } from './TargetCard'
import { VariableLab } from './VariableExplorer'
import { SpectrumLab } from './SpectrumLab'
import { dataText, useL } from '../lib/i18n'

type Meta = TargetMeta & { photometry?: PhotRow[] }

const LABEL: Record<AnalysisTab, [string, string]> = { motion: ['위치 측정', 'Positions'], variable: ['변광 분석실', 'Variability lab'], spectrum: ['분광 실험실', 'Spectrum lab'], provenance: ['자료 출처', 'Provenance'] }

/** Research tools under the stage. Labs stay mounted once opened so their settings survive. */
export function AnalysisTabs({ meta }: { meta: Meta }) {
  const variable = VARIABLES.has(meta.id)
  const L = useL()
  const tabs: AnalysisTab[] = variable ? ['variable', 'spectrum', 'motion', 'provenance'] : ['motion', 'spectrum', 'provenance']
  const want = useTime((s) => s.tab)
  const tab: AnalysisTab = want && tabs.includes(want) ? want : tabs[0]
  const [opened, setOpened] = useState<Set<AnalysisTab>>(() => new Set([tab]))
  useEffect(() => setOpened((o) => (o.has(tab) ? o : new Set(o).add(tab))), [tab])
  useEffect(() => writeView({ tab }), [tab])
  const pick = (t: AnalysisTab) => useTime.getState().setTab(t)
  const show = (t: AnalysisTab) => ({ display: tab === t ? 'contents' : 'none' })
  return (
    <section className="analysis" data-testid="analysis">
      <div className="science-tabs" role="tablist" aria-label={L('분석 도구', 'Analysis tools')}>
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => pick(t)} data-testid={`atab-${t}`} data-tutorial={`analysis-${t}`}>{L(...LABEL[t])}</button>
        ))}
      </div>
      {opened.has('motion') && <div style={show('motion')}><MotionPanel meta={meta} /></div>}
      {variable && opened.has('variable') && <div style={show('variable')}><VariableLab key={meta.id} meta={meta} /></div>}
      {opened.has('spectrum') && <div style={show('spectrum')}><SpectrumLab key={meta.id} meta={meta} /></div>}
      {opened.has('provenance') && <div style={show('provenance')}><ProvenancePanel meta={meta} /></div>}
    </section>
  )
}

// ------------------------------------------------------------------ motion
/** SPHEREx-measured position minus catalog-predicted position, per visit, both axes. */
function ResidualChart({ meta }: { meta: TargetMeta }) {
  const t = useTime((s) => s.tMjd)
  const L = useL()
  const k = visitIndexAt(meta, t)
  const W = 560, H = 210, M = { l: 46, r: 12, t: 14, b: 30 }
  const vs = meta.visits
  const pts = vs.map((v, i) => ({ i, mjd: v.mjd, dx: v.meas_px ? -(v.meas_px[0] - v.pred_px[0]) : null, dy: v.meas_px ? -(v.meas_px[1] - v.pred_px[1]) : null, e: v.meas_err_px }))
  const meas = pts.filter((p) => p.dx !== null)
  const lim = Math.max(0.5, ...meas.map((p) => Math.max(Math.abs(p.dx!), Math.abs(p.dy!)) + (p.e ?? 0)))
  const t0 = vs[0].mjd - 10, t1 = vs[vs.length - 1].mjd + 10
  const X = (m: number) => M.l + ((m - t0) / (t1 - t0)) * (W - M.l - M.r)
  const Y = (v: number) => M.t + (1 - (v + lim) / (2 * lim)) * (H - M.t - M.b)
  const ticks = [-lim, -lim / 2, 0, lim / 2, lim]
  if (!meas.length) return <p className="warn small">{L('이 대상은 SPHEREx 영상에서 위치를 잰 관측이 없습니다(포화·오염). 예측 위치만 표시합니다.', 'No SPHEREx position measurements for this target (saturation, blending). Only predictions are shown.')}</p>
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('측정 위치 − 예측 위치 그래프', 'Measured minus predicted position')} data-testid="residual-chart">
        {ticks.map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? 'axis0' : 'grid'} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="tick">{(v * meta.wcs.cdelt_arcsec).toFixed(1)}″</text></g>)}
        <line x1={X(vs[k].mjd)} x2={X(vs[k].mjd)} y1={M.t} y2={H - M.b} className="now" />
        {meas.map((p) => (
          <g key={p.i}>
            {p.e && <line x1={X(p.mjd) - 3} x2={X(p.mjd) - 3} y1={Y(p.dx! - p.e)} y2={Y(p.dx! + p.e)} stroke="#ff9a5c" strokeWidth={1} />}
            <circle cx={X(p.mjd) - 3} cy={Y(p.dx!)} r={3.2} fill="#ff9a5c" />
            {p.e && <line x1={X(p.mjd) + 3} x2={X(p.mjd) + 3} y1={Y(p.dy! - p.e)} y2={Y(p.dy! + p.e)} stroke="#5cb6ff" strokeWidth={1} />}
            <rect x={X(p.mjd) + 0.2} y={Y(p.dy!) - 2.8} width={5.6} height={5.6} fill="#5cb6ff" />
          </g>
        ))}
        <text x={M.l} y={H - 8} className="tick">{fmtDate(vs[0].mjd)}</text>
        <text x={W - M.r} y={H - 8} textAnchor="end" className="tick">{fmtDate(vs[vs.length - 1].mjd)}</text>
      </svg>
      <figcaption className="small">
        <span><i className="sw-fill" style={{ background: '#ff9a5c' }} /> {L('동쪽 방향 차이', 'East offset')}</span>{' '}
        <span><i className="sw-fill" style={{ background: '#5cb6ff' }} /> {L('북쪽 방향 차이', 'North offset')}</span>{' '}
        <span className="dim">{L('0이면 목록값으로 계산한 위치와 SPHEREx 측정 위치가 같습니다. 막대는 측정 오차(1σ).', '0 means the SPHEREx position equals the catalogue prediction. Bars are 1σ measurement errors.')}</span>{' '}
        <Badge kind="spherex" /> <Badge kind="catalog" />
      </figcaption>
    </figure>
  )
}

function MotionPanel({ meta }: { meta: TargetMeta }) {
  const L = useL()
  return (
    <div className="motion-panel" data-testid="motion-panel">
      <h3>{L('SPHEREx로 잰 위치 − 목록으로 계산한 위치', 'SPHEREx position minus catalogue prediction')}</h3>
      <ResidualChart meta={meta} />
      <TargetCard meta={meta} />
    </div>
  )
}

// ------------------------------------------------------------------ provenance
function ProvenancePanel({ meta }: { meta: TargetMeta }) {
  const p = meta.provenance
  const L = useL()
  const t = useTime((s) => s.tMjd)
  const k = visitIndexAt(meta, t)
  const goTo = useTime.getState().goToVisit
  const rows = useMemo(() => meta.visits.map((v, i) => ({
    i, utc: v.utc.replace('T', ' ').slice(0, 16), n: v.n_exp, det: v.detectors.map((d) => `D${d}`).join(' '),
    wave: v.wave_um ? `${v.wave_um[0].toFixed(2)}–${v.wave_um[1].toFixed(2)}` : '—', meas: !!v.meas_px, uris: v.irsa_uris,
  })), [meta])
  const csv = () => {
    const head = '# SPHEREx visits used by 방구석 천문학자 analysis workspace\n# collections: ' + p.collections.join(' ') + '\nvisit,utc,mjd,n_exposures,detectors,wave_um_min,wave_um_max,measured_position,irsa_files\n'
    const body = meta.visits.map((v, i) => [i + 1, v.utc, v.mjd.toFixed(5), v.n_exp, v.detectors.join(' '), v.wave_um?.[0] ?? '', v.wave_um?.[1] ?? '', v.meas_px ? 'yes' : 'no', v.irsa_uris.join(' ')].join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([head + body + '\n'], { type: 'text/csv' }))
    a.download = `${meta.id}_visits.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="prov-panel" data-testid="provenance-panel">
      <dl className="prov-facts">
        <div><dt>{L('관측 자료', 'Observations')}</dt><dd>NASA/IPAC IRSA SPHEREx {p.collections.join(', ')} <Badge kind="spherex" /></dd></div>
        <div><dt>{L('검색 시각', 'Queried')}</dt><dd>{p.query_time_utc?.replace('T', ' ').slice(0, 16)} UTC</dd></div>
        {p.exposures_found !== undefined && <div><dt>{L('검색된 노출', 'Exposures found')}</dt><dd>{p.exposures_found} {L('장 (선별 전)', '(before selection)')}</dd></div>}
        <div><dt>{L('위치·운동 값', 'Positions & motion')}</dt><dd>{meta.astrometry.source} <Badge kind="catalog" /></dd></div>
        <div><dt>{L('처리 코드', 'Code version')}</dt><dd>{p.code_version}</dd></div>
      </dl>
      <div className="toolbar"><button onClick={csv} data-testid="visits-csv">{L('관측 목록 CSV 내려받기', 'Download visit list (CSV)')}</button><span className="dim small">{L('행을 누르면 그 관측으로 이동합니다.', 'Click a row to go to that visit.')}</span></div>
      <div className="table-wrap">
        <table className="visits">
          <thead><tr><th>{L('관측', 'Visit')}</th><th>UTC</th><th>{L('노출', 'Exp.')}</th><th>{L('검출기', 'Detectors')}</th><th>{L('파장 µm', 'λ µm')}</th><th>{L('위치 측정', 'Position')}</th><th>{L('원본', 'Files')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i} className={r.i === k ? 'on' : ''} onClick={() => goTo(meta, r.i)}>
                <td>{r.i + 1}</td><td>{r.utc}</td><td>{r.n}</td><td>{r.det}</td><td>{r.wave}</td><td>{r.meas ? L('있음', 'yes') : '—'}</td>
                <td>{r.uris.length ? <a href={r.uris[0]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>FITS ×{r.uris.length}</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta.notes && meta.notes.length > 0 && <ul className="notes-list">{meta.notes.map((n) => <li key={n}>{dataText(n, L)}</li>)}</ul>}
    </div>
  )
}
