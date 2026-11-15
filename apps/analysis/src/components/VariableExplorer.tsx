import { memo, useEffect, useMemo, useState } from 'react'
import type { TargetMeta } from '../types'
import { useTime, visitIndexAt } from '../store'
import { fmtDate } from '../lib/ephem'
import {
  QUALITY_EN, QUALITY_NAME, QUANTITY_EN, QUANTITY_NAME, UNIT, UNIT_EN, binRange, binOf, binsFor, compare, coverage, defaultBand,
  directionAcrossBins, errorOf, funnel, median, phaseAt, selectRows, summarizeRows, toCsv, usable, valueOf, visitSpectrum,
} from '../lib/variability'
import type { Band, Cell, Quality, Quantity, ViewMode } from '../lib/variability'
import type { PhotRow } from './PhotometryPanel'
import { DETECTORS } from './PhotometryPanel'
import { Badge } from './Badge'
import { Scene3D } from './Scene3D'
import { SpectrumLab } from './SpectrumLab'
import { currentL, dataText, useL } from '../lib/i18n'
const QN = (q: Quantity) => currentL()(QUANTITY_NAME[q], QUANTITY_EN[q])
const UN = (q: Quantity) => currentL()(UNIT[q], UNIT_EN[q])
const QL = (x: Quality) => currentL()(QUALITY_NAME[x], QUALITY_EN[x])

type Meta = TargetMeta & { photometry?: PhotRow[] }
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 3 : 1 }) : '—')
const W = 520
const LAMBDA: [number, number] = [0.7, 5.05]

// analysis settings survive switching to the 3D tab and back, and switching targets
interface LabState { q: Quantity; mode: ViewMode; quality: Quality; width: number; band: Band | null; compareVisit: number | null; kind: 'time' | 'phase'; period: number; relative: boolean }
const saved = new Map<string, LabState>()

function monthTicks(t0: number, t1: number, max = 6): number[] {
  const d = new Date((t0 - 40587) * 86400e3)
  const out: number[] = []
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; ; m++) {
    const t = Date.UTC(y, m, 1) / 86400e3 + 40587
    if (t > t1) break
    out.push(t)
  }
  const step = Math.ceil(out.length / max)
  return out.filter((_, i) => i % step === 0)
}
const logTicks = (lo: number, hi: number) => {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v) }
  return out
}

/** Right-hand science panel. Variables: variable lab · spectrum lab · 3D. Others: 3D · spectrum lab.
 *  Labs stay mounted once opened (settings survive tab switches); WebGL mounts only on its tab. */
export function VariableExplorer({ meta }: { meta: Meta }) {
  const L = useL()
  const variable = ['rw_aur', 'r_dra'].includes(meta.id)
  const tabs: [Tab, string][] = variable
    ? [['lab', L('✦ 변광 분석실', '✦ Variability lab')], ['spec', L('◐ 분광 실험실', '◐ Spectrum lab')], ['space', L('3D 위치 (보조)', '3D position (aid)')]]
    : [['space', L('◇ 3D 시공간', '◇ 3D space-time')], ['spec', L('◐ 분광 실험실', '◐ Spectrum lab')]]
  const [section, setSection] = useState<Tab>(tabs[0][0])
  const [opened, setOpened] = useState<Set<Tab>>(new Set([tabs[0][0]]))
  const open = (t: Tab) => { setSection(t); setOpened((o) => new Set(o).add(t)) }
  return (
    <div className="variable-shell">
      <div className="science-tabs" role="tablist" aria-label={L('오른쪽 탐구 도구', 'Investigation tools')}>
        {tabs.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={section === t} className={section === t ? 'active' : ''} onClick={() => open(t)}>{label}</button>
        ))}
      </div>
      {variable && <div style={{ display: section === 'lab' ? 'contents' : 'none' }}><VariableLab key={meta.id} meta={meta} /></div>}
      {opened.has('spec') && <div style={{ display: section === 'spec' ? 'contents' : 'none' }}><SpectrumLab key={meta.id} meta={meta} /></div>}
      {section === 'space' && <Scene3D meta={meta} />}
    </div>
  )
}
type Tab = 'lab' | 'spec' | 'space'

// ---------------------------------------------------------------- ① coverage map

const CoverageMap = memo(function CoverageMap({ cells, meta, selectedIds, band, k, ab, onPick }: {
  cells: Cell[]; meta: Meta; selectedIds: Set<string>; band: Band | null; k: number; ab: [number, number]; onPick: (visit: number) => void
}) {
  const L = useL()
  const H = 250, M = { l: 44, r: 10, t: 14, b: 28 }
  const vs = meta.visits
  const t0 = vs[0].mjd - 8, t1 = vs[vs.length - 1].mjd + 8
  const X = (t: number) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r)
  const Y = (w: number) => M.t + (1 - (w - LAMBDA[0]) / (LAMBDA[1] - LAMBDA[0])) * (H - M.t - M.b)
  const [blo, bhi] = band ? binRange(band.bin, band.width) : [0, 0]
  return (
    <svg className="variable-chart coverage" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('전체 시간·파장 관측 지도', 'Time × wavelength map of all visits')} data-testid="coverage-map">
      {[1, 2, 3, 4, 5].map((w) => (
        <g key={w} className="ax"><line x1={M.l} x2={W - M.r} y1={Y(w)} y2={Y(w)} /><text x={M.l - 6} y={Y(w) + 4} textAnchor="end">{w} µm</text></g>
      ))}
      {monthTicks(t0, t1).map((t) => <text key={t} className="ax" x={X(t)} y={H - 10} textAnchor="middle">{fmtDate(t).slice(2, 7)}</text>)}
      {band && band.bin >= 0 && <rect x={M.l} width={W - M.l - M.r} y={Y(bhi)} height={Math.max(2, Y(blo) - Y(bhi))} fill="#ffd34d" fillOpacity={0.12} stroke="#ffd34d" strokeOpacity={0.6} strokeDasharray="4 3" />}
      {/* one cell per exposure: time × (wavelength ± half bandwidth); nothing between them is filled */}
      {cells.map((c) => {
        const sel = selectedIds.has(c.row.exposure)
        return (
          <rect key={c.row.exposure} x={X(c.mjd) - 1.6} width={3.2} y={Y(c.wave + c.bw / 2)} height={Math.max(1.5, Y(c.wave - c.bw / 2) - Y(c.wave + c.bw / 2))}
            fill={c.ok ? DETECTORS[c.det].color : 'none'} fillOpacity={sel ? 1 : 0.55}
            stroke={sel ? '#fff' : c.ok ? 'none' : '#6b7894'} strokeWidth={sel ? 0.9 : 0.7} pointerEvents="none" />
        )
      })}
      {([['A', ab[0], '#ff9a5c'], ['B', ab[1], '#5cb6ff']] as const).map(([name, i, col]) => vs[i] && (
        <g key={name} pointerEvents="none"><line x1={X(vs[i].mjd)} x2={X(vs[i].mjd)} y1={M.t - 4} y2={M.t + 4} stroke={col} strokeWidth={2} /><text x={X(vs[i].mjd)} y={M.t - 6} fill={col} fontSize={16} textAnchor="middle">{name}</text></g>
      ))}
      {vs[k] && <line x1={X(vs[k].mjd)} x2={X(vs[k].mjd)} y1={M.t} y2={H - M.b} stroke="#fff" strokeOpacity={0.8} strokeDasharray="3 2" pointerEvents="none" />}
      {/* wide invisible hit columns: one per visit */}
      {vs.map((v, i) => (
        <rect key={i} className="map-hit" x={X(v.mjd) - 5} width={10} y={M.t} height={H - M.t - M.b} role="button" tabIndex={0}
          aria-label={L(`지도에서 관측 ${i + 1} 선택 (${fmtDate(v.mjd)})`, `Select visit ${i + 1} on the map (${fmtDate(v.mjd)})`)} onClick={() => onPick(i)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i) } }}>
          <title>{L(`관측 ${i + 1} · ${fmtDate(v.mjd)} · 클릭하면 이 관측의 스펙트럼과 영상`, `Visit ${i + 1} · ${fmtDate(v.mjd)} · click for its spectrum and image`)}</title>
        </rect>
      ))}
    </svg>
  )
})

// ---------------------------------------------------------------- ② spectrum of one visit

function SpectrumChart({ rows, q, other, otherLabel, band, onBand }: {
  rows: PhotRow[]; q: Quantity; other: PhotRow[]; otherLabel: string; band: Band | null; onBand: (r: PhotRow) => void
}) {
  const L = useL()
  const H = 230, M = { l: 52, r: 10, t: 12, b: 30 }
  const vals = [...rows, ...other].flatMap((r) => { const v = valueOf(r, q)!, e = errorOf(r, q) ?? 0; return [v, v + e, Math.max(v - e, v * 0.5)] })
  const lo = vals.length ? Math.min(...vals) / 1.25 : 1, hi = vals.length ? Math.max(...vals) * 1.25 : 10
  const X = (w: number) => M.l + ((w - LAMBDA[0]) / (LAMBDA[1] - LAMBDA[0])) * (W - M.l - M.r)
  const Y = (v: number) => M.t + (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (H - M.t - M.b)
  const [blo, bhi] = band ? binRange(band.bin, band.width) : [0, 0]
  return (
    <svg className="variable-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('선택 관측 스펙트럼', 'Spectrum of the selected visit')}>
      {logTicks(lo, hi).map((v) => <g key={v} className="ax"><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} /><text x={M.l - 5} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text></g>)}
      {[1, 2, 3, 4, 5].map((w) => <text key={w} className="ax" x={X(w)} y={H - 10} textAnchor="middle">{w} µm</text>)}
      {band && band.bin >= 0 && <rect x={X(blo)} width={Math.max(2, X(bhi) - X(blo))} y={M.t} height={H - M.t - M.b} fill="#ffd34d" fillOpacity={0.12} />}
      {other.map((r) => {
        const v = valueOf(r, q)!
        return <path key={r.exposure} d={`M${X(r.wave_um!)},${Y(v) - 4} l4,4 l-4,4 l-4,-4 z`} fill="none" stroke="#c9d3e6" strokeOpacity={0.7}><title>{otherLabel} · {r.wave_um!.toFixed(3)} µm · {fmt(v)} {UN(q)}</title></path>
      })}
      {rows.map((r) => {
        const v = valueOf(r, q)!, e = errorOf(r, q)
        return (
          <g key={r.exposure} className="variable-point" role="button" tabIndex={0} aria-label={L(`${r.wave_um!.toFixed(3)} µm 파장 구간 선택`, `Select the ${r.wave_um!.toFixed(3)} µm band`)}
            onClick={() => onBand(r)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onBand(r) } }}>
            {e ? <line x1={X(r.wave_um!)} x2={X(r.wave_um!)} y1={Y(v + e)} y2={Y(Math.max(v - e, lo))} stroke={DETECTORS[r.detector].color} strokeOpacity={0.6} /> : null}
            <circle cx={X(r.wave_um!)} cy={Y(v)} r={3.3} fill={DETECTORS[r.detector].color} stroke={r.flags.length ? '#ffb86c' : '#0a111e'} strokeWidth={r.flags.length ? 1.6 : 1} />
            <title>{`D${r.detector} · ${r.wave_um!.toFixed(3)} µm (${L('폭', 'width')} ${r.bandwidth_um?.toFixed(3)}) · ${fmt(v)} ${UN(q)}${e ? ` ± ${fmt(e)}` : ''} · ${fmtDate(r.mjd)}${r.flags.length ? ` · FLAGS ${r.flags.join(',')}` : ''} · ${L('클릭 = 이 파장 구간 분석', 'click = analyse this band')}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------- ③ time series of one band

interface TPoint { key: string; visit: number; mjd: number; value: number; err: number | null; flagged: boolean; n: number }

function BandPlot({ points, mode, k, ab, kind, period, relative, q, onPick }: {
  points: TPoint[]; mode: ViewMode; k: number; ab: [number, number]; kind: 'time' | 'phase'; period: number; relative: boolean; q: Quantity; onPick: (v: number) => void
}) {
  const L = useL()
  const H = 235
  const t0 = points[0]?.mjd ?? 0, span = Math.max(1, (points.at(-1)?.mjd ?? t0) - t0)
  const ref = median(points.map((p) => p.value)) ?? 1
  const y = (v: number) => (relative ? (v / ref) * 100 : v)
  // brightness indices are positive: error bars are clipped at 0 rather than stretching the axis below it
  const all = points.flatMap((p) => (p.err ? [y(Math.max(0, p.value - p.err)), y(p.value + p.err)] : [y(p.value)]))
  const lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1, pad = Math.min(Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.02, 1e-6), Math.max(lo, 1e-6))
  const Y = (v: number) => 185 - ((v - lo + pad) / (hi - lo + pad * 2)) * 160
  const X = (t: number) => 52 + (kind === 'phase' ? phaseAt(t, t0, period) : (t - t0) / span) * 440
  const cycle = (t: number) => Math.floor((t - t0) / period)
  return (
    <svg className="variable-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={kind === 'phase' ? L('위상 접기 광도 곡선', 'Phase-folded light curve') : L('좁은 파장 구간 광도 곡선', 'Narrow-band light curve')}>
      {[0, 0.5, 1].map((f) => { const v = lo - pad + (hi - lo + 2 * pad) * f; return <g key={f} className="ax"><line x1="52" x2="492" y1={Y(v)} y2={Y(v)} /><text x="47" y={Y(v) + 4} textAnchor="end">{fmt(v)}</text></g> })}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={52 + 440 * f} y="207" textAnchor="middle" className="ax">{kind === 'phase' ? f.toFixed(2) : fmtDate(t0 + f * span).slice(2)}</text>)}
      {kind === 'time' && ([['A', ab[0], '#ff9a5c'], ['B', ab[1], '#5cb6ff']] as const).map(([name, i, col]) => {
        const p = points.find((p) => p.visit === i)
        return p ? <g key={name}><line x1={X(p.mjd)} x2={X(p.mjd)} y1={22} y2={190} stroke={col} strokeOpacity={0.6} strokeDasharray="4 3" /><text x={X(p.mjd)} y={18} fill={col} fontSize={16} textAnchor="middle">{name}</text></g> : null
      })}
      {points.map((p) => (
        <g key={p.key} role="button" tabIndex={0} aria-label={L(`분석 관측 ${p.visit + 1} 선택`, `Select visit ${p.visit + 1}`)} className="variable-point"
          onClick={() => onPick(p.visit)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p.visit) } }}>
          {p.err !== null && <line x1={X(p.mjd)} x2={X(p.mjd)} y1={Y(y(Math.max(0, p.value - p.err)))} y2={Y(y(p.value + p.err))} stroke="#8498b4" strokeDasharray={mode === 'median' ? '2 2' : undefined} />}
          <circle cx={X(p.mjd)} cy={Y(y(p.value))} r={p.visit === k ? (mode === 'raw' ? 5 : 7) : mode === 'raw' ? 3.2 : 5}
            fill={kind === 'phase' ? `hsl(${((cycle(p.mjd) * 137.508) % 360 + 360) % 360} 75% 72%)` : mode === 'raw' ? '#9fd8ff' : '#7dcfff'}
            stroke={p.flagged ? '#ffb86c' : '#102039'} strokeWidth={p.visit === k ? 2.5 : 1} />
          <title>{`${L('관측', 'Visit')} ${p.visit + 1} · ${fmtDate(p.mjd)} · ${fmt(p.value)} ${UN(q)}${mode === 'median' ? ` · ${L(`${p.n}노출 중앙값`, `median of ${p.n}`)}` : ''}${p.err !== null ? ` · ${mode === 'raw' ? L('노출 오차', 'error') : L('MAD 산포', 'MAD scatter')} ${fmt(p.err)}` : ''} · ${L('클릭 = 영상 이동', 'click = go to image')}`}</title>
        </g>
      ))}
      <text x="272" y="230" textAnchor="middle" className="ax">
        {kind === 'phase' ? L('주기 내 위치 (위상) · 색 = 반복 회차', 'phase in the cycle · colour = cycle number') : mode === 'raw' ? L('원본 노출 시각 · 점 사이를 보간하지 않음', 'exposure times · points not interpolated') : L('관측별 중앙 시각 · 점 사이를 보간하지 않음', 'median time per visit · points not interpolated')}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------- the lab

export function VariableLab({ meta,compact=false }: { meta: Meta;compact?:boolean }) {
  const L = useL()
  const mira = meta.id === 'r_dra'
  const rows = useMemo(() => meta.photometry ?? [], [meta])
  const init = saved.get(meta.id) ?? { q: mira ? 'ring' : 'flux', mode: 'raw', quality: 'all', width: 0.1, band: null, compareVisit: null, kind: 'time', period: 245.6, relative: true } as LabState
  const [st, setSt] = useState<LabState>(init)
  useEffect(() => { saved.set(meta.id, st) }, [meta.id, st])
  const set = (p: Partial<LabState>) => setSt((s) => ({ ...s, ...p }))
  const { q, mode, quality, width, compareVisit, kind, period, relative } = st

  // only the visit index matters here, not the continuous time
  const k = useTime((s) => visitIndexAt(meta, s.tMjd))
  const ab = useTime((s) => s.ab)
  const pick = (visit: number) => { useTime.getState().stop(); useTime.getState().goToVisit(meta, visit) }

  const fallbackBand = useMemo(() => defaultBand(rows, q, width), [rows, q, width])
  // a band the user chose is kept even when it has no data (shown as "no data"), never silently swapped
  const band: Band | null = st.band && st.band.width === width ? st.band : fallbackBand
  const bins = useMemo(() => (band ? binsFor(rows, q, band.det, width) : []), [rows, q, band?.det, width]) // eslint-disable-line react-hooks/exhaustive-deps
  const cells = useMemo(() => coverage(rows, q), [rows, q])
  const selected = useMemo(() => (band ? selectRows(rows, q, band, quality) : []), [rows, q, band?.det, band?.bin, width, quality]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedIds = useMemo(() => new Set(selected.map((r) => r.exposure)), [selected])
  const summary = useMemo(() => summarizeRows(selected, q), [selected, q])
  const fun = useMemo(() => (band ? funnel(rows, q, band, quality) : null), [rows, q, band?.det, band?.bin, width, quality]) // eslint-disable-line react-hooks/exhaustive-deps
  const points: TPoint[] = useMemo(() => mode === 'raw'
    ? selected.map((r) => ({ key: r.exposure, visit: r.visit, mjd: r.mjd, value: valueOf(r, q)!, err: errorOf(r, q), flagged: r.flags.length > 0, n: 1 }))
    : summary.map((p) => ({ key: String(p.visit), visit: p.visit, mjd: p.mjd, value: p.value, err: p.scatter, flagged: p.flagged > 0, n: p.n })), [mode, selected, summary, q])
  const spec = useMemo(() => visitSpectrum(rows, q, k), [rows, q, k])
  const cmp = useMemo(() => (compareVisit !== null && compareVisit !== k ? visitSpectrum(rows, q, compareVisit).ok : []), [rows, q, compareVisit, k])
  const validVisits = useMemo(() => [...new Set(usable(rows, q).map((r) => r.visit))].sort((a, b) => a - b), [rows, q])

  const [lo, hi] = band ? binRange(band.bin, band.width) : [0, 0]
  const actual = selected.length ? [Math.min(...selected.map((r) => r.wave_um!)), Math.max(...selected.map((r) => r.wave_um!))] : null
  const a = summary.find((p) => p.visit === ab[0]), b = summary.find((p) => p.visit === ab[1]), change = a && b ? compare(a, b) : null
  const ref = median(summary.map((p) => p.value))
  const current = summary.find((p) => p.visit === k)
  const flagged = selected.filter((r) => r.flags.length).length
  const selectExtreme = () => {
    if (summary.length < 2) return
    const s = [...summary].sort((x, y) => x.value - y.value)
    useTime.getState().setAB([s[s.length - 1].visit, s[0].visit])
    pick(s[0].visit)
  }
  const controls = useMemo(() => (!mira && band && change ? directionAcrossBins(rows, q, band.det, width, quality, ab[0], ab[1]) : []), [mira, rows, q, band?.det, width, quality, ab[0], ab[1], !!change]) // eslint-disable-line react-hooks/exhaustive-deps
  const exportCsv = () => {
    if (!band) return
    const body = toCsv({ target: meta.id, q, band, quality, mode, selected, summary, utc: (t) => new Date((t - 40587) * 86400e3).toISOString() })
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${meta.id}_D${band.det}_${lo.toFixed(2)}-${hi.toFixed(2)}um_${q}_${mode}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const pickBand = (r: PhotRow) => set({ band: { det: r.detector, bin: binOf(r.wave_um!, width), width } })
  const v = meta.visits[k]

  return (
    <section className={`variable-lab${compact?' fw-variable-compact':''}`} data-testid="variable-lab">
      {!compact&&<><p className="dim small" data-testid="lab-measurement-coverage">{L('위치 측정', 'Positions measured')} {meta.visits.filter((v) => v.meas_px).length}/{meta.visits.length}{L('회 · 이 대상은 밝기 변화로 탐구합니다.', ' · this target is studied through its brightness.')}</p>
      <header className="variable-intro">
        <span className="badge badge-model">{mira ? L('미라형 · 반복 패턴 실험', 'Mira · repeating pattern') : L('젊은 별 · 감광 탐정', 'Young star · dimming detective')}</span>
        <h3>{mira ? L('밝기의 리듬은 반복될까?', 'Does the rhythm of brightness repeat?') : L('별이 어두워진 걸까, 다른 색으로 본 걸까?', 'Did the star dim, or did we see it in another colour?')}</h3>
        <p>{mira
          ? L('R Dra는 중심이 포화돼 바깥 고리의 상대 밝기로 봅니다. 지도에서 관측마다 어느 파장을 찍었는지 보고, 같은 파장 구간끼리 회차를 비교하세요.', 'R Dra saturates at the core, so we read the relative brightness of the outer ring. See on the map which wavelength each visit took, and compare cycles band by band.')
          : L('RW Aur는 문헌에서 깊고 불규칙한 감광이 알려진 젊은 별입니다. 지도 → 스펙트럼 → 같은 파장 구간의 시간 변화 순서로 이번 SPHEREx 자료를 직접 확인하세요.', 'RW Aur is a young star known for deep, irregular dimming. Check the SPHEREx data yourself: map → spectrum → the same band over time.')}</p>
      </header></>}
      {compact&&<div className="fw-analysis-heading"><h2>{L('파장별 밝기 변화','Brightness over time')}</h2></div>}
      <div className="toolbar">
        <label>{L('측정값', 'Quantity')} <select aria-label={L('변광 측정값', 'Variability quantity')} value={q} onChange={(e) => set({ q: e.target.value as Quantity, band: null, compareVisit: null })}>
          <option value="flux">{L('구경 측광 (mJy)', 'aperture photometry (mJy)')}</option><option value="ring">{L('고리 밝기 (상대 MJy/sr)', 'ring brightness (relative MJy/sr)')}</option></select></label>
        <span className="seg" role="group" aria-label={L('점 표시 방식', 'Point mode')}>
          <button className={mode === 'raw' ? 'active' : ''} onClick={() => set({ mode: 'raw' })}>{L('원본 노출점', 'Raw exposures')}</button>
          <button className={mode === 'median' ? 'active' : ''} onClick={() => set({ mode: 'median' })}>{L('관측별 중앙값', 'Median per visit')}</button>
        </span>
        <label>{L('품질', 'Quality')} <select aria-label={L('품질 필터', 'Quality filter')} value={quality} onChange={(e) => set({ quality: e.target.value as Quality })}>
          {(['all', 'severe', 'clean'] as Quality[]).map((x) => <option key={x} value={x}>{QL(x)}</option>)}</select></label>
      </div>

      {!compact && fun && (
        <ol className="funnel" data-testid="data-funnel" aria-label={L('자료 개수 흐름', 'Data counts')}>
          <li><b>{fun.total}</b><span>{L('전체 측광 기록', 'photometry records')}</span></li>
          <li><b>{fun.valid}</b><span>{QN(q)} {L('유효', 'valid')}</span></li>
          <li><b>{fun.inBand}</b><span>{band!.bin >= 0 ? `D${band!.det} ${lo.toFixed(2)}–${hi.toFixed(2)} µm` : `D${band!.det} ${L('(값 없음)', '(no values)')}`}</span></li>
          <li><b>{fun.selected}</b><span>{QL(quality)}</span></li>
          <li className={mode === 'median' ? 'on' : ''}><b>{fun.visits}</b><span>{L('관측 요약점', 'visit summaries')}</span></li>
        </ol>
      )}
      <p className="dim small">
        {mode === 'raw' ? L(`지금 그래프는 원본 노출점 ${selected.length}개를 보여 줍니다.`, `The plot shows ${selected.length} raw exposures.`) : L(`지금 그래프는 관측별 중앙값 ${summary.length}개 (${selected.length}노출을 관측마다 묶음)를 보여 줍니다.`, `The plot shows ${summary.length} visit medians (${selected.length} exposures grouped by visit).`)}
        {quality !== 'all' && L(` 품질 필터로 ${fun ? fun.inBand - fun.selected : 0}노출 제외.`, ` ${fun ? fun.inBand - fun.selected : 0} exposures removed by the quality filter.`)}
      </p>

      <details className="fw-details fw-coverage" open={!compact}><summary>{L('관측 지도와 개별 스펙트럼','Observation coverage and individual spectra')}</summary>
      <h4 className="lab-step">{L('① 전체 시간·파장 관측 지도', '① Time × wavelength map')} <Badge kind="spherex" /></h4>
      <CoverageMap cells={cells} meta={meta} selectedIds={selectedIds} band={band} k={k} ab={ab} onPick={pick} />
      <div className="map-legend">
        {[1, 2, 3, 4, 5, 6].map((d) => <span key={d}><i style={{ background: DETECTORS[d].color }} />D{d}</span>)}
        <span><i className="hollow" />{L(`노출은 있으나 ${QN(q)} 값 없음`, `exposure without a ${QN(q)} value`)}</span>
        <span><i className="sel" />{L('지금 분석 중인 노출', 'exposures in the analysis')}</span>
        <span className="dim">{L('빈칸 = 그 날짜·파장 관측 없음 (채우지 않음) · 색 = 검출기(밝기 아님)', 'blank = no visit at that date and wavelength (not filled) · colour = detector (not brightness)')}</span>
      </div>

      <h4 className="lab-step">{L(`② 관측 ${k + 1}의 스펙트럼`, `② Spectrum of visit ${k + 1}`)} <span className="dim small">{v ? fmtDate(v.mjd) : ''}</span> <Badge kind="spherex" /></h4>
      <div className="toolbar">
        <label>{L('비교 관측', 'Compare with')} <select aria-label={L('스펙트럼 비교 관측', 'Spectrum comparison visit')} value={compareVisit ?? ''} onChange={(e) => set({ compareVisit: e.target.value === '' ? null : +e.target.value })}>
          <option value="">{L('없음', 'none')}</option>
          {validVisits.filter((i) => i !== k).map((i) => <option key={i} value={i}>{L('관측', 'Visit')} {i + 1} · {fmtDate(meta.visits[i].mjd)}{i === ab[0] ? ' (A)' : i === ab[1] ? ' (B)' : ''}</option>)}
        </select></label>
        <span className="dim small" data-testid="spectrum-count">{L(`노출 ${spec.all}개 중 ${QN(q)} 유효 ${spec.ok.length}개`, `${spec.ok.length} of ${spec.all} exposures with a valid ${QN(q)}`)}{spec.ok.length ? ` · ${[...new Set(spec.ok.map((r) => `D${r.detector}`))].join(' ')} · ${spec.ok[0].wave_um!.toFixed(2)}–${spec.ok.at(-1)!.wave_um!.toFixed(2)} µm` : ''}</span>
      </div>
      <div data-testid="visit-spectrum">
        {spec.ok.length
          ? <SpectrumChart rows={spec.ok} q={q} other={cmp} otherLabel={compareVisit !== null ? `${L('관측', 'Visit')} ${compareVisit + 1} (${fmtDate(meta.visits[compareVisit].mjd)})` : ''} band={band} onBand={pickBand} />
          : <div className="failure" data-testid="spectrum-empty">{L(`관측 ${k + 1}에는 ${QN(q)} 값이 있는 노출이 없습니다`, `Visit ${k + 1} has no exposure with a ${QN(q)} value`)}{spec.reasons.length ? ` — ${spec.reasons.map(([w, n]) => `${dataText(w, L)} ${n}`).join(', ')}` : ''}. {L('지도에서 색이 있는 관측을 고르세요. 대체 자료는 만들지 않습니다.', 'Pick a coloured visit on the map. Nothing is substituted.')}</div>}
      </div>
      <p className="dim small">
        {L(`● 관측 ${k + 1}의 노출(색 = 검출기, 주황 테두리 = 플래그)`, `● exposures of visit ${k + 1} (colour = detector, orange ring = flagged)`)}{cmp.length ? ` · ◇ ${L('관측', 'visit')} ${compareVisit! + 1}` : ''} · {L('점을 누르면 그 파장 구간이 ③에 선택됩니다.', 'click a point to select its band in ③.')}
        {L('한 관측 안의 노출도 최대 2일에 걸쳐 따로 찍혔고, 구경 보정과 검출기 사이 보정을 하지 않았습니다. 없는 파장은 잇지 않습니다.', 'Exposures of one visit span up to 2 days; no aperture or inter-detector correction. Missing wavelengths are not joined.')}
        {spec.missing > 0 && L(` 값 없는 노출 ${spec.missing}개: `, ` ${spec.missing} exposures without a value: `) + spec.reasons.map(([w, n]) => `${dataText(w, L)} ${n}`).join(', ') + '.'}
      </p>

      </details>
      <h4 className="lab-step">{compact?L('비교할 파장','Wavelength band'):L('③ 파장 구간의 시간 변화', '③ One band over time')} <Badge kind="spherex" /><Badge kind="model" detail={mode === 'raw' ? L('정규화만', 'normalised only') : L('관측별 중앙값·MAD', 'visit median · MAD')} /></h4>
      <div className="toolbar">
        <label>{L('검출기', 'Detector')} <select aria-label={L('변광 검출기', 'Variability detector')} value={band?.det ?? ''} onChange={(e) => { const det = +e.target.value; const bb = binsFor(rows, q, det, width); set({ band: bb.length ? { det, bin: [...bb].sort((x, y) => y.visits.size - x.visits.size)[0].bin, width } : { det, bin: -1, width } }) }}>
          {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>D{d} · {DETECTORS[d].range}</option>)}</select></label>
        <label>{L('구간 폭', 'Band width')} <select aria-label={L('파장 구간 폭', 'Wavelength band width')} value={width} onChange={(e) => set({ width: +e.target.value, band: null })}>
          {[0.05, 0.1, 0.2].map((w) => <option key={w} value={w}>{w} µm</option>)}</select></label>
        <label>{L('파장', 'Band')} <select aria-label={L('변광 파장 구간', 'Variability wavelength band')} value={bins.some((x) => x.bin === band?.bin) ? band!.bin : ''} onChange={(e) => band && set({ band: { ...band, bin: +e.target.value } })}>
          {!bins.some((x) => x.bin === band?.bin) && <option value="">{bins.length ? L('구간 선택', 'choose a band') : `D${band?.det} ${QN(q)} ${L('값 없음', 'no values')}`}</option>}
          {bins.map((x) => <option key={x.bin} value={x.bin}>{binRange(x.bin, width)[0].toFixed(2)}–{binRange(x.bin, width)[1].toFixed(2)} µm · {x.visits.size} {L('회', 'visits')} · {x.n} {L('노출', 'exp.')}</option>)}
        </select></label>
      </div>
      <p className="dim small" data-testid="band-range">
        {band && band.bin >= 0 ? `${L('구간', 'Band')} D${band.det} ${lo.toFixed(2)}–${hi.toFixed(2)} µm` : L(`D${band?.det ?? ''}에는 ${QN(q)} 값이 있는 파장 구간이 없음`, `D${band?.det ?? ''} has no band with a ${QN(q)} value`)}
        {actual ? L(` · 실제 선택 노출 파장 ${actual[0].toFixed(3)}–${actual[1].toFixed(3)} µm (같은 파장이 아니라 이 범위 안)`, ` · selected exposures at ${actual[0].toFixed(3)}–${actual[1].toFixed(3)} µm (within this range, not identical)`) : ''} · {L('이 필터는 아래 분석에만 적용되며 영상의 검출기는 따로 고릅니다.', 'this applies to the analysis only; the image detector is chosen separately.')}
      </p>
      <div className="toolbar">
        <button className={kind === 'time' ? 'active' : ''} onClick={() => set({ kind: 'time' })}>{L('시간별 밝기', 'Brightness over time')}</button>
        {mira && <button className={kind === 'phase' ? 'active' : ''} onClick={() => set({ kind: 'phase' })}>{L('주기로 접어 보기', 'Fold by period')}</button>}
        <label className="check"><input type="checkbox" checked={relative} onChange={(e) => set({ relative: e.target.checked })} />{L('중앙값 = 100으로 비교', 'median = 100')}</label>
        <button onClick={exportCsv} disabled={!selected.length}>{L('분석 CSV 내려받기', 'Download analysis CSV')}</button>
      </div>
      <div className="variable-stats" data-testid="variable-summary">
        <div><b>{summary.length}/{meta.visits.length}</b><span>{L('비교 관측', 'visits compared')}</span></div>
        <div><b>{selected.length}</b><span>{L('선택 노출', 'exposures selected')}</span></div>
        <div><b>{flagged}</b><span>{L('플래그 포함 노출', 'flagged exposures')}</span></div>
        <div><b>{current && ref ? fmt(relative ? (current.value / ref) * 100 : current.value) : L('측정 없음', 'no value')}</b><span>{L('관측', 'Visit')} {k + 1} · {relative ? L('중앙값 대비 지수', 'index vs median') : UN(q)}</span></div>
      </div>
      {kind === 'phase' && (
        <div className="phase-controls" data-testid="phase-controls">
          <label>{L('시험 주기', 'Trial period')} <input aria-label={L('시험 주기', 'Trial period')} type="range" min="100" max="400" step=".5" value={period} onChange={(e) => set({ period: +e.target.value })} />{period.toFixed(1)} {L('일', 'd')}</label>
          <button onClick={() => set({ period: 245.6 })}>{L('문헌 참고값 245.6일', 'literature value 245.6 d')}</button>
          <p>{L('주기를 바꿔 다른 회차의 점들이 겹치는지 실험하세요. 위상 0은 선택 자료의 첫 시각이며 최대 밝기 시점이 아닙니다. 주기 검출·적합 기능이 아닙니다.', 'Change the period and see whether points from different cycles line up. Phase 0 is the first selected time, not maximum light. This is not a period search or fit.')} <Badge kind="catalog" detail={L('BAA VSS 참고 주기', 'BAA VSS reference period')} /></p>
        </div>
      )}
      {points.length
        ? <BandPlot points={points} mode={mode} k={k} ab={ab} kind={kind} period={period} relative={relative} q={q} onPick={pick} />
        : <div className="failure" data-testid="variable-empty">{L('이 조건에 유효한 측광값이 없습니다. 품질 조건·파장·검출기 또는 측정값을 바꾸세요. 대체 자료는 만들지 않습니다.', 'No valid photometry for these settings. Change the quality filter, band, detector or quantity. Nothing is substituted.')}</div>}
      <p className="dim small">
        {mode === 'raw'
          ? L('세로 막대 = 노출 측광 오차(분산 기반, 구경 보정 없음). 주황 테두리 = 플래그 포함.', 'bars = exposure photometry errors (from variance, no aperture correction). Orange ring = flagged.')
          : L('점선 막대 = 같은 관측 안 노출들의 MAD 산포로, 측정 오차나 유의도가 아닙니다. 주황 테두리 = 플래그 포함 노출이 있음.', 'dashed bars = MAD scatter within a visit, not a measurement error or significance. Orange ring = contains flagged exposures.')} {L('관측 사이 빈 기간은 채우지 않습니다.', 'Gaps between visits are not filled.')}
      </p>

      <details className="fw-details" open={!compact}><summary>{L('밝은 관측과 어두운 관측 비교','Compare bright and faint observations')}</summary><div className="variable-compare" data-testid="variable-compare">
        <strong>{L('밝은 때 ↔ 어두운 때', 'Bright ↔ faint')}</strong>
        <button onClick={selectExtreme} disabled={summary.length < 2}>{L('선택 자료의 밝음·어두움 찾기', 'Find brightest and faintest')}</button>
        <p>{change
          ? L(`A 관측 ${ab[0] + 1} → B 관측 ${ab[1] + 1}: ${Math.abs(change.days).toFixed(1)}일 간격 · B/A ${change.ratio.toFixed(3)} · ${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}% (관측별 중앙값 기준)`, `A visit ${ab[0] + 1} → B visit ${ab[1] + 1}: ${Math.abs(change.days).toFixed(1)} days · B/A ${change.ratio.toFixed(3)} · ${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}% (visit medians)`)
          : L('현재 A/B 중 이 파장 구간의 측정이 없는 관측이 있습니다. 밝음·어두움 찾기로 실제 자료가 있는 두 시점을 고르세요.', 'A or B has no measurement in this band. Use “find brightest and faintest” to pick two dates with data.')}</p>
        {a && b && <p className="dim small">{L('A 실제 파장', 'A actual λ')} {a.wave[0].toFixed(3)}–{a.wave[1].toFixed(3)} µm · B {b.wave[0].toFixed(3)}–{b.wave[1].toFixed(3)} µm</p>}
        {!mira && change && controls.length > 0 && (
          <p data-testid="control-check">
            {L(`통제 점검: 같은 검출기 D${band!.det}의 다른 파장 구간 ${controls.length}개 중 ${controls.filter((c) => Math.sign(c.percent) === Math.sign(change.percent)).length}개에서도 B가 A보다 ${change.percent < 0 ? '어둡습니다' : '밝습니다'}`, `Control check: in ${controls.filter((c) => Math.sign(c.percent) === Math.sign(change.percent)).length} of ${controls.length} other bands of D${band!.det}, B is also ${change.percent < 0 ? 'fainter' : 'brighter'} than A`)}
            {quality !== 'all' && ` (${QL(quality)})`}. {L('개수 세기일 뿐 통계 검정이 아니며, 원인(먼지 등)을 확정하지 않습니다.', 'A count, not a statistical test; it does not establish the cause (dust or otherwise).')}
          </p>
        )}
        <p className="dim small">{L('버튼은 영상의 A/B도 함께 선택합니다. 차이는 보정되지 않은 밝기 지표이며 변광의 유의도나 원인을 확정하지 않습니다.', 'The button also sets A/B in the image. The difference is an uncalibrated brightness index; it does not establish significance or cause.')}</p>
      </div></details>

      <details className="fw-details">
        <summary>{L('관측 품질과 해석 · 꼭 확인하기', 'Data quality and interpretation · please read')}</summary>
        <p>{q === 'ring'
          ? L('고리 밝기는 포화된 중심 바깥 픽셀의 상대 지표로, 별 전체의 광도·등급·반지름이 아니며 포화를 복원한 값도 아닙니다. 구경 측광(mJy)과 같은 축에 섞지 않습니다.', 'Ring brightness is a relative index from pixels outside the saturated core: not the star\'s luminosity, magnitude or radius, and not a de-saturated value. It is never mixed with aperture photometry (mJy).')
          : L('구경 측광은 구경 보정이 없는 값입니다. 절대 광도나 검출기 사이 색지수로 해석하지 마세요.', 'Aperture photometry has no aperture correction. Do not read it as absolute luminosity or as colours between detectors.')}</p>
        <p>{L('밝은 별은 거의 모든 노출에 OVERFLOW·SUR_ERROR·TRANSIENT 플래그가 붙습니다. ‘심각 플래그 제외’는 NONFUNC·MISSING_DATA·HOT·COLD·PERSIST가 있는 노출만 뺍니다. 플래그는 진단 정보이며, 없다고 완전히 유효하거나 있다고 반드시 틀린 것은 아닙니다.', 'Bright stars carry OVERFLOW, SUR_ERROR and TRANSIENT flags in almost every exposure. “Drop severe flags” removes only exposures with NONFUNC, MISSING_DATA, HOT, COLD or PERSIST. Flags are diagnostics: no flag does not mean perfect, a flag does not mean wrong.')}</p>
        {summary.map((p) => <div key={p.visit}>{L('관측', 'Visit')} {p.visit + 1} · {fmtDate(p.mjd)} · λ {p.wave.map((w) => w.toFixed(3)).join('–')} µm · {p.n} {L('노출', 'exp.')} / {L('플래그', 'flagged')} {p.flagged}</div>)}
      </details>
      {!compact&&<><div className="variable-question"><b>{L('탐구 질문', 'Question to explore')}</b><p>{mira
        ? L('지도에서 R Dra는 관측마다 좁은 파장 하나씩만 찍혔습니다. 같은 파장 구간에서 시험 주기를 바꿨을 때 다른 회차의 점들이 겹치나요? 구간을 바꿔도 같은 경향이 남나요?', 'On the map, each R Dra visit covers one narrow wavelength. In one band, do points from different cycles line up as you change the trial period? Does the trend survive another band?')
        : L('어두운 시점과 밝은 시점은 같은 파장 범위인가요? 품질 필터를 바꾸거나 다른 파장 구간을 골라도 같은 방향의 변화가 남나요? 지금 자료만으로 먼지에 가려졌다고 말할 수 있을까요?', 'Are the faint and bright dates in the same wavelength range? Does the change keep its direction with another quality filter or band? Can these data alone say it was hidden by dust?')}</p></div>
      <p className="dim small">{mira
        ? <a href="https://britastro.org/vss/objects/obj-dra.html" target="_blank" rel="noreferrer">{L('BAA VSS: R Dra 분류·참고 주기', 'BAA VSS: R Dra type and period')}</a>
        : <a href="https://arxiv.org/abs/2312.17598" target="_blank" rel="noreferrer">{L('RW Aur 감광 연구: Lux 외 (2023)', 'RW Aur dimming: Lux et al. (2023)')}</a>} · {L('외부 광도·영상 자료는 쓰지 않으며, 문헌은 탐구 배경입니다.', 'No external photometry or images are used; the literature is background only.')}</p></>}
    </section>
  )
}
