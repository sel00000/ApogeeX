import { useEffect, useMemo, useState } from 'react'
import type { TargetMeta } from '../types'
import { useTime, visitIndexAt } from '../store'
import { fmtDate } from '../lib/ephem'
import { seasons } from '../lib/frames'
import { FEATURES, TARGET_SPECTRAL, bandDepth, bestFitTemperature, logRms, measuredPoints, planckNu, scaleFor, wienPeakUm } from '../lib/spectral'
import type { BandDepth, SpecPoint } from '../lib/spectral'
import type { PhotRow } from './PhotometryPanel'
import { DETECTORS } from './PhotometryPanel'
import { Badge } from './Badge'
import { currentL, useL } from '../lib/i18n'
import { usableSpectralRow } from '../lib/quality'

type Meta = TargetMeta & { photometry?: PhotRow[] }
const W = 560
const LAM: [number, number] = [0.7, 5.05]
const VARIABLE = new Set(['rw_aur', 'r_dra'])

const STEPS = [
  { key: 'look', title: '관찰', titleEn: 'Look', guide: '먼저 점들의 모양만 보세요. 파장이 길어질수록 밝아지나요? 어디에서 갑자기 꺼지나요?', guideEn: 'First just look at the shape of the points. Do they brighten towards long wavelengths? Where do they suddenly drop?' },
  { key: 'theory', title: '이론 세우기', titleEn: 'Theory', guide: '뜨거운 물체는 온도만으로 정해지는 흑체 곡선처럼 빛납니다. 온도를 바꾸거나 자동 맞춤으로 이론을 세워 보세요.', guideEn: 'A hot body shines like a blackbody curve set by its temperature alone. Change the temperature or use the best fit to build a theory.' },
  { key: 'compare', title: '비교', titleEn: 'Compare', guide: '아래 잔차 그래프에서 이론보다 어두운 곳을 찾으세요. 분자가 빛을 흡수한 자리일 수 있습니다.', guideEn: 'In the residuals below, look for places darker than the theory. Molecules may have absorbed light there.' },
  { key: 'measure', title: '측정', titleEn: 'Measure', guide: '흡수를 숫자로 재 봅시다. 띠 안의 밝기를 양옆 연속선과 비교한 값이 흡수 깊이입니다.', guideEn: 'Put a number on the absorption: the band brightness compared with the continuum on both sides is the band depth.' },
  { key: 'conclude', title: '결론', titleEn: 'Conclude', guide: '측정값과 오차, 그리고 다른 설명 가능성을 함께 적으면 과학 노트가 됩니다.', guideEn: 'Write the value, its uncertainty and the other possible explanations together: that is a science note.' },
] as const

type Epoch = 'all' | 'auto' | number
const saved = new Map<string, { epoch: Epoch; T: number | null; step: number; on: string[] }>()

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : '—')
function logTicks(lo: number, hi: number) {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v) }
  return out
}

function verdict(d: BandDepth, expected = true): { text: string; cls: string } {
  const L = currentL()
  if (d.status === 'outside') return { text: L('관측 범위 밖', 'outside the data'), cls: 'dim' }
  if (d.status === 'insufficient') return { text: L('점이 부족해 판정 불가', 'too few points to judge'), cls: 'dim' }
  if (!(d.sigma! > 0) || !Number.isFinite(d.sigma)) return { text: L('불확도 부족 · 판정 보류', 'uncertainty unavailable · undecided'), cls: 'warn' }
  const r = d.depth! / d.sigma!
  if (d.depth! > 0 && r >= 3) return expected
    ? { text: L('흡수 후보 · 보정·재관측 검증 필요', 'candidate absorption · calibration and repeat checks needed'), cls: 'warn' }
    : { text: L('어두움 · 문헌상 예상 없음 → 연속선 가정 의심', 'dark but not expected → doubt the continuum'), cls: 'warn' }
  if (d.depth! < 0 && -r >= 3) return { text: L('연속선보다 밝음', 'brighter than the continuum'), cls: 'warn' }
  return { text: L('뚜렷하지 않음', 'not distinct'), cls: 'dim' }
}

export function SpectrumLab({ meta }: { meta: Meta }) {
  const L = useL()
  const info = TARGET_SPECTRAL[meta.id]
  const rows = useMemo(() => meta.photometry ?? [], [meta])
  const seas = useMemo(() => seasons(meta), [meta])
  const init = saved.get(meta.id) ?? { epoch: VARIABLE.has(meta.id) ? 'auto' : 'all', T: null, step: 0, on: info?.expect ?? [] }
  const [epoch, setEpoch] = useState<Epoch>(init.epoch)
  const [Tsel, setT] = useState<number | null>(init.T)
  const [step, setStep] = useState(init.step)
  const [on, setOn] = useState<Set<string>>(new Set(init.on))
  const [hover, setHover] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const k = useTime((s) => visitIndexAt(meta, s.tMjd))
  const goToVisit = (i: number) => { useTime.getState().stop(); useTime.getState().goToVisit(meta, i) }

  const seasonIdx = epoch === 'auto' ? seas.findIndex((g) => g.includes(k)) : typeof epoch === 'number' ? epoch : -1
  const visitSet = useMemo(() => (seasonIdx >= 0 ? new Set(seas[seasonIdx]) : undefined), [seasonIdx, seas])
  const points = useMemo(() => measuredPoints(rows, visitSet), [rows, visitSet])
  const fit = useMemo(() => bestFitTemperature(points), [points])
  const T = Tsel ?? fit?.T ?? 3000
  const s = useMemo(() => scaleFor(points, T), [points, T])
  const rms = useMemo(() => logRms(points, T), [points, T])
  const depths = useMemo(() => FEATURES.map((f) => bandDepth(points, f)), [points])
  useEffect(() => { saved.set(meta.id, { epoch, T: Tsel, step, on: [...on] }) }, [meta.id, epoch, Tsel, step, on])

  const allValid = rows.filter(usableSpectralRow).length
  if (!info) return null
  const epochLabel = seasonIdx >= 0 ? L(`시즌 ${seasonIdx + 1} (${fmtDate(meta.visits[seas[seasonIdx][0]].mjd)}~, 관측 ${seas[seasonIdx].length}회)`, `season ${seasonIdx + 1} (${fmtDate(meta.visits[seas[seasonIdx][0]].mjd)}–, ${seas[seasonIdx].length} visits)`) : L('모든 관측 합침', 'all visits combined')

  if (points.length < 5) {
    return (
      <section className="spec-lab" data-testid="spectrum-lab">
        <Intro meta={meta} info={info} />
        <div className="spec-card warn-card" data-testid="spectrum-unavailable">
          <h4>{L('이 대상은 분광 측광으로 스펙트럼을 그릴 수 없습니다', 'No spectrum can be drawn from this target\'s photometry')}</h4>
          <p>{L(`품질·불확도 조건을 통과한 노출 ${allValid}/${rows.length}개 · 이 시기 ${points.length}개.`, `${allValid}/${rows.length} exposures pass quality and uncertainty checks · ${points.length} in this period.`)} {meta.id === 'r_dra' ? L('너무 밝아 거의 모든 노출의 중심이 포화됐습니다. 포화 바깥 고리 밝기는 파장마다 별 모양(PSF)이 달라 스펙트럼 모양 비교에 쓰지 않습니다.', 'So bright that the core saturates in almost every exposure. The ring brightness outside it depends on the PSF at each wavelength, so it is not used for spectral shape.') : L('불량·포화·잔상 플래그와 불확도가 없는 값은 제외했습니다. 다른 시기나 대상을 선택하세요.', 'Defective, saturated, persistent and unquantified values were excluded. Pick another period or target.')}</p>
          <p className="dim small">{L('대체 자료나 가상의 스펙트럼은 만들지 않습니다. 분광 탐구는 Epsilon Indi B(메탄·물), WISE 0855(4.5 µm 창), RW Aur(적외선 초과)에서 해 보세요.', 'No substitute or invented spectrum is made. Try Epsilon Indi B (methane, water), WISE 0855 (the 4.5 µm window) or RW Aur (infrared excess).')}</p>
        </div>
      </section>
    )
  }

  const theory = (w: number) => s * planckNu(w, T)
  const ys = points.flatMap((p) => [p.flux, theory(p.wave)]).filter((v) => v > 0)
  const lo = Math.min(...points.map((p) => p.flux)) / 2.2, hi = Math.max(...ys.filter(Number.isFinite)) * 1.6
  const M = { l: 54, r: 12, t: 26, b: 30 }, Hm = 300
  const X = (w: number) => M.l + ((w - LAM[0]) / (LAM[1] - LAM[0])) * (W - M.l - M.r)
  const Y = (v: number) => M.t + (1 - (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (Hm - M.t - M.b)
  const curve = Array.from({ length: 220 }, (_, i) => LAM[0] + ((LAM[1] - LAM[0]) * i) / 219).map((w) => [X(w), Y(theory(w))] as const).filter(([, y]) => y >= M.t - 2 && y <= Hm - M.b + 2)
  const shown = FEATURES.filter((f) => on.has(f.id))
  const focus = FEATURES.find((f) => f.id === hover) ?? null
  const showTheory = step >= 1

  // residuals: log10(measured / theory)
  const Hr = 130, Mr = { t: 10, b: 24 }
  const R = (v: number) => Mr.t + (1 - (Math.max(-1, Math.min(1, v)) + 1) / 2) * (Hr - Mr.t - Mr.b)
  const resid = points.map((p) => ({ p, r: Math.log10(p.flux / theory(p.wave)) }))

  const expected = FEATURES.filter((f) => info.expect.includes(f.id))
  const others = FEATURES.filter((f) => !info.expect.includes(f.id))
  const dets = [...new Set(points.map((p) => p.det))].sort()
  const note = buildNote(meta, info, epochLabel, points, T, Tsel === null, fit, rms, depths)
  const copyNote = async () => { try { await navigator.clipboard.writeText(note); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setCopied(false) } }
  const csv = () => {
    const lines = [
      `# target=${meta.id} epoch=${epochLabel} source=SPHEREx per-exposure aperture photometry (mJy, no aperture correction)`,
      `# theory=blackbody T=${T.toFixed(0)}K scale=${s.toExponential(4)} (model, normalised in log space)`,
      'exposure,visit,detector,wavelength_um,flux_mJy,err_mJy,theory_mJy,log10_measured_over_theory,flags',
      ...points.map((p) => [p.exposure, p.visit + 1, p.det, p.wave, p.flux, p.err, theory(p.wave), Math.log10(p.flux / theory(p.wave)), p.flags.join(' ')].join(',')),
      '', '# Quality-filtered positive flux only; known positive uncertainty required.',
      '# Band-depth uncertainty includes measurement error / point spread, not cross-detector calibration, aperture, PSF or time covariance. Not detection significance.',
      'feature,band_um,n_band,n_continuum,flux_band,flux_continuum,depth,sigma,status',
      ...FEATURES.map((f, i) => { const d = depths[i]; return [f.label, f.band.join('-'), d.nBand, d.nCont, d.fluxBand ?? '', d.fluxCont ?? '', d.depth ?? '', d.sigma ?? '', d.status].join(',') }),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${meta.id}_spectrum_lab.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="spec-lab" data-testid="spectrum-lab">
      <Intro meta={meta} info={info} />
      <p className="control-note" data-testid="spectral-quality">{L(`품질·불확도 조건을 통과한 노출 ${allValid}/${rows.length}개를 사용합니다. 불량·포화·잔상 플래그 또는 불확도가 없는 값은 제외합니다. 흡수 깊이는 탐색용이며 분자 검출 유의도가 아닙니다.`, `${allValid}/${rows.length} exposures pass quality and uncertainty checks. Defective, saturated, persistent or unquantified values are excluded. Band depths are exploratory, not molecular-detection significance.`)}</p>

      <ol className="stepper" role="tablist" aria-label={L('탐구 단계', 'Inquiry steps')}>
        {STEPS.map((st, i) => (
          <li key={st.key}>
            <button role="tab" aria-selected={step === i} className={step === i ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)}>
              <span className="n">{i + 1}</span>{L(st.title, st.titleEn)}
            </button>
          </li>
        ))}
      </ol>
      <div className="guide" data-testid="spectrum-guide">
        <div className="avatar" aria-hidden>F</div>
        <div><b>{L('프라운호퍼', 'Fraunhofer')}</b> <span className="badge badge-model">{L('교육용 창작 대사', 'fictional guide for teaching')}</span><p>{L(STEPS[step].guide, STEPS[step].guideEn)}</p></div>
      </div>

      <div className="spec-controls">
        <label>{L('시기', 'Period')}
          <select aria-label={L('분광 시기', 'Spectrum period')} value={String(epoch)} onChange={(e) => setEpoch(e.target.value === 'all' || e.target.value === 'auto' ? e.target.value : +e.target.value)}>
            {VARIABLE.has(meta.id) && <option value="auto">{L('지금 보는 관측의 시즌 (자동)', 'season of the current visit (auto)')}</option>}
            <option value="all">{L('모든 관측 합침', 'all visits combined')}</option>
            {seas.map((g, i) => <option key={i} value={i}>{L('시즌', 'season')} {i + 1} · {fmtDate(meta.visits[g[0]].mjd)} ({g.length} {L('회', 'visits')})</option>)}
          </select>
        </label>
        <span className="pill" data-testid="spec-lab-count">{L('노출', 'exposures')} {points.length} · {dets.map((d) => `D${d}`).join(' ')} · {points[0].wave.toFixed(2)}–{points.at(-1)!.wave.toFixed(2)} µm</span>
      </div>

      <figure className="spec-card chart-card">
        <svg viewBox={`0 0 ${W} ${Hm}`} className="spec-chart" role="img" aria-label={L('SPHEREx 스펙트럼과 이론 비교', 'SPHEREx spectrum against theory')}>
          {logTicks(lo, hi).map((v) => <g key={v} className="ax"><line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end">{fmt(v, v < 1 ? 2 : 0)}</text></g>)}
          {[1, 2, 3, 4, 5].map((w) => <text key={w} className="ax" x={X(w)} y={Hm - 10} textAnchor="middle">{w} µm</text>)}
          <text className="ax" x={14} y={M.t + 120} transform={`rotate(-90 14 ${M.t + 120})`} textAnchor="middle">mJy (log)</text>
          {shown.map((f) => (
            <g key={f.id} className={`band ${hover === f.id ? 'hot' : ''}`} onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === f.id ? null : f.id)} role="button" tabIndex={0} aria-label={L(`${f.label} 설명`, `About ${f.label}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHover(hover === f.id ? null : f.id) } }}>
              <rect x={X(f.band[0])} width={X(f.band[1]) - X(f.band[0])} y={M.t} height={Hm - M.t - M.b} fill={f.color} fillOpacity={hover === f.id ? 0.22 : 0.1} />
              <text x={(X(f.band[0]) + X(f.band[1])) / 2} y={M.t - 8} textAnchor="middle" fill={f.color} fontSize={10.5} fontWeight={600}>{f.molecule}</text>
              {hover === f.id && f.continuum.map((c, i) => <rect key={i} x={X(c[0])} width={X(c[1]) - X(c[0])} y={Hm - M.b - 6} height={6} fill="#e8eefb" fillOpacity={0.55} />)}
            </g>
          ))}
          {showTheory && curve.length > 1 && <polyline points={curve.map((p) => p.join(',')).join(' ')} fill="none" stroke="#e8eefb" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} pointerEvents="none" />}
          {points.map((p) => (
            <circle key={p.exposure} cx={X(p.wave)} cy={Y(p.flux)} r={2.6} fill={DETECTORS[p.det].color} fillOpacity={0.9} onClick={() => goToVisit(p.visit)} className="pt">
              <title>{`${p.wave.toFixed(3)} µm · ${fmt(p.flux, 3)} ± ${fmt(p.err, 3)} mJy · D${p.det} · ${L('관측', 'visit')} ${p.visit + 1}${p.flags.length ? ` · FLAGS ${p.flags.join(',')}` : ''} · ${L('클릭 = 영상 이동', 'click = go to image')}`}</title>
            </circle>
          ))}
        </svg>
        <figcaption>
          <span><i className="dot" style={{ background: '#7f8cff' }} />{L('점 = SPHEREx 노출 한 장 (색 = 검출기)', 'dot = one SPHEREx exposure (colour = detector)')} <Badge kind="spherex" /></span>
          {showTheory && <span><i className="dash" />{L('흑체 이론', 'blackbody')} {T.toFixed(0)} K <Badge kind="model" /></span>}
          <span><i className="box" />{L('띠 = 문헌의 대략적 흡수 위치', 'band = approximate absorption position from the literature')} <Badge kind="catalog" /></span>
        </figcaption>
      </figure>

      {focus && (
        <div className="spec-card feature-card" style={{ borderColor: focus.color }}>
          <b style={{ color: focus.color }}>{focus.label}</b> · {focus.band[0]}–{focus.band[1]} µm
          <p>{L(focus.note, focus.noteEn ?? focus.note)}</p>
          <p className="dim small">{L('흰 막대 = 흡수 깊이를 잴 때 쓰는 양옆 연속선 구간', 'white bars = continuum windows used to measure the depth')}</p>
        </div>
      )}

      <div className="chips" aria-label={L('흡수 띠 표시', 'Absorption bands')}>
        {FEATURES.map((f) => (
          <button key={f.id} className={`chip ${on.has(f.id) ? 'on' : ''}`} style={{ ['--c' as string]: f.color }}
            onClick={() => setOn((o) => { const n = new Set(o); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })}>
            {f.label}{info.expect.includes(f.id) && <span className="exp">{L('예상', 'expected')}</span>}
          </button>
        ))}
      </div>

      {step >= 1 && (
        <div className="spec-card" data-testid="theory-panel">
          <div className="row">
            <label className="grow">{L('흑체 온도', 'Blackbody temperature')} <b>{T.toFixed(0)} K</b>
              <input aria-label={L('흑체 온도', 'Blackbody temperature')} type="range" min={Math.log10(150)} max={Math.log10(12000)} step={0.005} value={Math.log10(T)} onChange={(e) => setT(10 ** +e.target.value)} />
            </label>
            <button className="primary" onClick={() => setT(null)} disabled={!fit}>{L('가장 잘 맞는 온도', 'Best-fit temperature')}</button>
          </div>
          <p className="small">
            {fit ? <>{L('자동 맞춤', 'Best fit')}: <b>{fit.T.toFixed(0)} K</b> (log rms {fit.rms.toFixed(3)}) · {L('지금 곡선 rms', 'this curve rms')} {rms.toFixed(3)}. </> : null}
            {L('흑체 최대 밝기(Bλ) 파장', 'Blackbody peak (Bλ) at')} {wienPeakUm(T).toFixed(2)} µm {L('(빈의 법칙).', '(Wien\'s law).')} <span className="dim">{L('맞춘 온도는 “흑체 하나로 설명한다면”의 모델값이며 별의 실제 온도 측정이 아닙니다.', 'The fitted temperature is a model value (“if one blackbody explained it”), not a measurement of the star\'s temperature.')}</span>
          </p>
        </div>
      )}

      {step >= 2 && (
        <figure className="spec-card chart-card" data-testid="residual-panel">
          <svg viewBox={`0 0 ${W} ${Hr}`} className="spec-chart" role="img" aria-label={L('측정 대 이론 잔차', 'Measured over theory residuals')}>
            {shown.map((f) => <rect key={f.id} x={X(f.band[0])} width={X(f.band[1]) - X(f.band[0])} y={Mr.t} height={Hr - Mr.t - Mr.b} fill={f.color} fillOpacity={0.1} />)}
            {[-1, -0.5, 0, 0.5, 1].map((v) => <g key={v} className="ax"><line x1={M.l} x2={W - M.r} y1={R(v)} y2={R(v)} strokeDasharray={v === 0 ? undefined : '2 4'} /><text x={M.l - 6} y={R(v) + 4} textAnchor="end">×{fmt(10 ** v, 2)}</text></g>)}
            {resid.map(({ p, r }) => <circle key={p.exposure} cx={X(p.wave)} cy={R(r)} r={2.2} fill={r < 0 ? '#ff9a5c' : '#5cb6ff'} fillOpacity={0.85} />)}
            {[1, 2, 3, 4, 5].map((w) => <text key={w} className="ax" x={X(w)} y={Hr - 8} textAnchor="middle">{w} µm</text>)}
          </svg>
          <figcaption><span><i className="dot" style={{ background: '#ff9a5c' }} />{L('이론보다 어두움 (흡수?)', 'darker than theory (absorption?)')}</span><span><i className="dot" style={{ background: '#5cb6ff' }} />{L('이론보다 밝음 (초과?)', 'brighter than theory (excess?)')}</span><span className="dim">{L('측정 ÷ 이론, 로그 눈금 · 범위 밖은 끝에 표시', 'measured ÷ theory, log scale · out-of-range values pinned to the edge')}</span></figcaption>
        </figure>
      )}

      {step >= 3 && (
        <div className="spec-card" data-testid="depth-table">
          <table className="depths">
            <thead><tr><th>{L('흡수 띠', 'Band')}</th><th>{L('점(띠/연속선)', 'points (band/continuum)')}</th><th>{L('흡수 깊이', 'Depth')}</th><th>{L('판정', 'Verdict')}</th></tr></thead>
            <tbody>
              {[...expected, ...others].map((f) => {
                const d = depths[FEATURES.indexOf(f)], v = verdict(d, info.expect.includes(f.id))
                return (
                  <tr key={f.id} onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)}>
                    <td><i className="sw" style={{ background: f.color }} />{f.label}{info.expect.includes(f.id) && <span className="exp">{L('예상', 'expected')}</span>}</td>
                    <td>{d.nBand}/{d.nCont}</td>
                    <td>{d.depth !== null ? `${(d.depth * 100).toFixed(0)}% ± ${(d.sigma! * 100).toFixed(1)}%` : '—'}</td>
                    <td className={v.cls}>{v.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="small">{L('연속선은 띠 양옆을 직선으로 이은 가정입니다. RW Aur처럼 스펙트럼이 크게 꺾이는 천체에서는 흡수가 없어도 ‘어두움’이 나올 수 있으니, 문헌상 예상과 함께 판단하세요.', 'The continuum is assumed to be a straight line between the windows. For strongly curved spectra such as RW Aur, a band can look dark without absorption, so judge it together with what the literature expects.')}</p>
          <p className="dim small">{L('흡수 깊이 = 1 − (띠 안 중앙값 ÷ 양옆 연속선 중앙값을 이은 값). 측정 점만 쓰고 비어 있는 파장은 채우지 않습니다. ±는 노출 측정오차와 점들의 흩어짐 중 큰 쪽이며, 검출기 간 보정·구경 보정의 계통오차는 들어 있지 않습니다.', 'Depth = 1 − (band median ÷ continuum interpolated between window medians). Measured points only; empty wavelengths are not filled. ± is the larger of exposure errors and point scatter, without systematic terms from detector or aperture calibration.')} <Badge kind="model" /></p>
        </div>
      )}

      {step >= 4 && (
        <div className="spec-card note-card" data-testid="research-note">
          <h4>{L('연구 노트', 'Research note')}</h4>
          <pre>{note}</pre>
          <div className="row"><button className="primary" onClick={copyNote}>{copied ? L('복사됨', 'Copied') : L('노트 복사', 'Copy note')}</button><button onClick={csv}>{L('측정·깊이 CSV', 'Points & depths CSV')}</button></div>
        </div>
      )}

      <div className="spec-nav">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>{L('← 이전 단계', '← Previous step')}</button>
        <button className="primary" onClick={() => setStep(Math.min(4, step + 1))} disabled={step === 4}>{L('다음 단계 →', 'Next step →')}</button>
      </div>
      <p className="dim small">{L('SPHEREx 분광 분해능(R≈40–130)으로는 원자 흡수선 하나하나가 아니라 넓은 분자 띠만 구별됩니다. 띠 위치는 문헌 기준의 대략적 범위입니다.', 'At SPHEREx resolution (R≈40–130) only broad molecular bands can be told apart, not single atomic lines. Band positions are approximate ranges from the literature.')}</p>
    </section>
  )
}

function Intro({ meta, info }: { meta: Meta; info: (typeof TARGET_SPECTRAL)[string] }) {
  const L = useL()
  return (
    <header className="spec-intro">
      <span className="eyebrow">{L('미션 · 분자의 흔적 찾기', 'Mission · traces of molecules')}</span>
      <h3>{L(`${meta.display_name}의 빛에는 무엇이 빠져 있을까?`, `What is missing from the light of ${meta.display_name}?`)}</h3>
      <p>{L(info.story, info.storyEn ?? info.story)}</p>
      <p className="dim small">{L('분류', 'Type')}: {L(info.type, info.typeEn ?? info.type)} <Badge kind="catalog" /> · {info.refs.map((r, i) => <a key={i} href={r.url} target="_blank" rel="noreferrer">{L(r.label, r.labelEn ?? r.label)}</a>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ' · ', x] : [x]), [])}</p>
    </header>
  )
}

function buildNote(meta: Meta, info: (typeof TARGET_SPECTRAL)[string], epoch: string, pts: SpecPoint[], T: number, auto: boolean,
  fit: { T: number; rms: number } | null, rms: number, depths: BandDepth[]) {
  const L = currentL()
  const lines = [
    L(`[관측] ${meta.display_name} · ${epoch} · SPHEREx 노출 ${pts.length}개 · ${pts[0].wave.toFixed(2)}–${pts.at(-1)!.wave.toFixed(2)} µm (구경 측광, mJy)`, `[Observation] ${meta.display_name} · ${epoch} · ${pts.length} SPHEREx exposures · ${pts[0].wave.toFixed(2)}–${pts.at(-1)!.wave.toFixed(2)} µm (aperture photometry, mJy)`),
    L(`[이론] 흑체 ${T.toFixed(0)} K${auto ? ' (자동 맞춤)' : ' (직접 선택)'} · log 잔차 rms ${rms.toFixed(3)}${fit && !auto ? ` · 자동 맞춤은 ${fit.T.toFixed(0)} K` : ''} — 모델값이며 실제 온도 측정 아님`, `[Theory] blackbody ${T.toFixed(0)} K${auto ? ' (best fit)' : ' (chosen)'} · log residual rms ${rms.toFixed(3)}${fit && !auto ? ` · best fit ${fit.T.toFixed(0)} K` : ''} — a model value, not a temperature measurement`),
    L('[측정] 흡수 깊이 (측정 점만, ±는 측정오차·점 흩어짐 중 큰 쪽):', '[Measurement] band depths (measured points only; ± is the larger of measurement error and scatter):'),
  ]
  FEATURES.forEach((f, i) => {
    const d = depths[i]
    if (d.status === 'outside') return
    const exp = info.expect.includes(f.id) ? L(' [문헌상 예상]', ' [expected from literature]') : ''
    lines.push(d.status === 'ok' ? `  · ${f.label}: ${(d.depth! * 100).toFixed(0)}% ± ${(d.sigma! * 100).toFixed(1)}% → ${verdict(d, info.expect.includes(f.id)).text}${exp}` : L(`  · ${f.label}: 점 부족(띠 ${d.nBand}, 연속선 ${d.nCont})${exp}`, `  · ${f.label}: too few points (band ${d.nBand}, continuum ${d.nCont})${exp}`))
  })
  lines.push(
    L('[대안 설명] 검출기 사이 보정 차이 · 구경 보정 없음(파장마다 별 크기 다름) · 서로 다른 시기 섞임(변광) · 포화·플래그 · 근처 천체 오염', '[Other explanations] calibration differences between detectors · no aperture correction (star size changes with wavelength) · mixed periods (variability) · saturation and flags · contamination by neighbours'),
    L('[다음 확인] 시기를 바꿔도 같은가? 띠 양옆 연속선 점이 충분한가? 같은 검출기 안에서도 보이는가?', '[Next checks] Same in another period? Enough continuum points on both sides? Visible within one detector?'),
    L(`[출처] NASA/IPAC IRSA SPHEREx DR1·QR3 · 띠 위치: ${info.refs.map((r) => r.label).join('; ')}`, `[Sources] NASA/IPAC IRSA SPHEREx DR1·QR3 · band positions: ${info.refs.map((r) => r.labelEn ?? r.label).join('; ')}`),
  )
  return lines.join('\n')
}
