// "무엇이 바뀌었나": short, candidate-worded findings computed from the baked SPHEREx data.
// Idea from 경보's TrueBlink (findings list worded as candidates); numbers here come only from
// our own meta.json (SPHEREx positions/photometry) and the catalog values stored with it.
import type { Provenance, TargetMeta } from '../types'
import type { PhotRow } from '../components/PhotometryPanel'
import { DETECTORS } from '../components/PhotometryPanel'
import { fitProperMotion } from './fit'
import { binRange, defaultBand, selectRows, summarizeRows } from './variability'
import type { Quantity } from './variability'
import { FEATURES, TARGET_SPECTRAL, bandDepth, bestFitTemperature, measuredPoints } from './spectral'

export type Level = '후보' | '판단 보류'
export type FindingKind = 'motion' | 'brightness' | 'spectrum'
export interface Finding {
  id: string
  kind: FindingKind
  title: string
  body: string
  /** our number, and the catalogue/literature number it is compared with */
  value?: string
  reference?: string
  level: Level
  prov: Provenance[]
}

type Meta = TargetMeta & { photometry?: PhotRow[] }
type Tr = (ko: string, en: string) => string
const KO: Tr = (ko) => ko
export const VARIABLES = new Set(['rw_aur', 'r_dra'])

export function motionFinding(meta: TargetMeta, L: Tr = KO): Finding | null {
  if (meta.kind === 'patch' || VARIABLES.has(meta.id)) return null
  const a = meta.astrometry
  const vs = meta.visits
  const nMeas = vs.filter((v) => v.meas_px).length
  const catalog = Math.hypot(a.pmra, a.pmdec)
  const span = Math.hypot(vs[vs.length - 1].pred_px[0] - vs[0].pred_px[0], vs[vs.length - 1].pred_px[1] - vs[0].pred_px[1])
  const years = (vs[vs.length - 1].mjd - vs[0].mjd) / 365.25
  const fit = fitProperMotion(meta)
  if (!fit) {
    return {
      id: 'motion', kind: 'motion', title: L('움직임: 아직 판단 보류', 'Motion: undecided'), level: '판단 보류', prov: ['spherex', 'catalog'],
      body: L(`위치를 잰 관측이 ${nMeas}회라 직선 맞춤(3회 이상, 0.5년 이상)을 하지 못했습니다. 예측 경로로는 ${years.toFixed(1)}년 동안 ${span.toFixed(1)} px 움직입니다.`, `Only ${nMeas} visits have a measured position, too few for a straight-line fit (3 or more over 0.5 yr). The predicted path moves ${span.toFixed(1)} px in ${years.toFixed(1)} yr.`),
      reference: L(`${(catalog / 1000).toFixed(2)}″/년`, `${(catalog / 1000).toFixed(2)}″/yr`),
    }
  }
  const mu = Math.hypot(fit.pm[0], fit.pm[1])
  const err = Math.hypot((fit.pm[0] * fit.pmErr[0]) / mu, (fit.pm[1] * fit.pmErr[1]) / mu)
  const speedSigma = Math.abs(mu - catalog) / err
  const angle = Math.abs(((Math.atan2(fit.pm[0], fit.pm[1]) - Math.atan2(a.pmra, a.pmdec)) * 180) / Math.PI)
  const dAngle = Math.min(angle, 360 - angle)
  // how clearly SPHEREx alone sees the motion (speed over its own error)
  const snr = mu / err
  // vector agreement first; when only the speed agrees, say so instead of calling it a mismatch
  const level: Level = Number.isFinite(snr) && snr >= 3 ? '후보' : '판단 보류'
  const agree =
    fit.sigmaDiff < 2 ? L(`목록값과의 차이는 ${fit.sigmaDiff.toFixed(1)}σ로 측정 오차 안에서 맞습니다.`, `It differs from the catalogue by ${fit.sigmaDiff.toFixed(1)}σ: consistent within the errors.`)
    : fit.sigmaDiff < 3 ? L(`목록값과의 차이는 ${fit.sigmaDiff.toFixed(1)}σ로 대체로 맞지만 경계에 가깝습니다(포화된 중심 때문일 수 있습니다).`, `It differs from the catalogue by ${fit.sigmaDiff.toFixed(1)}σ: broadly consistent but borderline (possibly the saturated core).`)
    : speedSigma < 3 ? L(`속력은 목록값과 ${speedSigma.toFixed(1)}σ 안에서 맞지만, 방향까지 넣으면 ${fit.sigmaDiff.toFixed(1)}σ(방향 차 ${dAngle.toFixed(1)}°) 어긋납니다. 쌍성의 궤도 운동이나 겹친 별, 오차 과소평가 때문일 수 있습니다.`, `The speed agrees with the catalogue within ${speedSigma.toFixed(1)}σ, but including direction it is off by ${fit.sigmaDiff.toFixed(1)}σ (${dAngle.toFixed(1)}° in direction). Orbital motion of a binary, a blended star or underestimated errors could explain it.`)
    : L(`목록값과 ${fit.sigmaDiff.toFixed(1)}σ 어긋나 측정이 흔들렸을 수 있습니다(포화·겹친 별).`, `It is ${fit.sigmaDiff.toFixed(1)}σ off the catalogue; the measurement may be disturbed (saturation, blending).`)
  return {
    id: 'motion', kind: 'motion', level, prov: ['spherex', 'catalog', 'model'],
    title: level === '후보' ? L('위치 변화 모델 · 이동 후보', 'Position-change model · motion candidate') : L('움직임: 아직 판단 보류', 'Motion: undecided'),
    body: L(`SPHEREx 영상 ${fit.n}회에서 잰 위치로 ${fit.baselineYr.toFixed(1)}년치 고유운동을 맞췄습니다. 아래 비교는 모델의 형식적 오차 기준입니다. `, `A proper motion fitted to positions measured in ${fit.n} SPHEREx visits over ${fit.baselineYr.toFixed(1)} yr. The comparison uses the model's formal errors. `) + agree + L(' 파장·PSF·정렬의 체계 오차와 이웃 별을 추가 검증해야 하며, 이동 검출의 확정 판정은 아닙니다.', ' Wavelength, PSF, registration systematics and neighbouring stars still need checks; this is not a confirmed motion detection.'),
    value: L(`${(mu / 1000).toFixed(2)} ± ${(err / 1000).toFixed(2)}″/년`, `${(mu / 1000).toFixed(2)} ± ${(err / 1000).toFixed(2)}″/yr`),
    reference: L(`${(catalog / 1000).toFixed(2)}″/년`, `${(catalog / 1000).toFixed(2)}″/yr`),
  }
}

/** Largest/smallest per-visit median in the band most visits share (same detector, same 0.1 µm). */
export function brightnessFinding(meta: Meta, L: Tr = KO): Finding | null {
  const rows = meta.photometry ?? []
  if (!VARIABLES.has(meta.id) || !rows.length) return null
  // saturated R Dra: the ring (relative) brightness; RW Aur: aperture photometry
  const q: Quantity = meta.id === 'r_dra' ? 'ring' : 'flux'
  const band = defaultBand(rows, q, 0.1)
  if (!band) return null
  const pts = summarizeRows(selectRows(rows, q, band, 'severe'), q)
  if (pts.length < 2) return null
  const hi = pts.reduce((a, b) => (b.value > a.value ? b : a))
  const lo = pts.reduce((a, b) => (b.value < a.value ? b : a))
  const ratio = hi.value / lo.value
  const [w0, w1] = binRange(band.bin, band.width)
  const level: Level = '후보'
  return {
    id: 'brightness', kind: 'brightness', level, prov: ['spherex'],
    title: L('밝기 차이 후보', 'Brightness-difference candidate'),
    body: L(`검출기 D${band.det}(${DETECTORS[band.det].range})의 ${w0.toFixed(1)}–${w1.toFixed(1)} µm 구간에서 관측 ${pts.length}회를 비교했습니다. 구간 안에서도 실제 파장과 응답이 다를 수 있어 색·PSF·보정 효과가 남습니다. 이 비율만으로 변광을 확정하지 않습니다.${q === 'ring' ? ' 중심이 포화돼 고리 밝기(상대값)를 사용했습니다.' : ''}`, `${pts.length} visits compared within ${w0.toFixed(1)}–${w1.toFixed(1)} µm of detector D${band.det} (${DETECTORS[band.det].range}). Wavelength and response can still differ within this bin, leaving colour, PSF and calibration effects. The ratio alone does not establish variability.${q === 'ring' ? ' The saturated core is replaced by relative ring brightness.' : ''}`),
    value: L(`최대 ${ratio.toFixed(2)}배 (${(2.5 * Math.log10(ratio)).toFixed(2)} 등급)`, `up to ${ratio.toFixed(2)}× (${(2.5 * Math.log10(ratio)).toFixed(2)} mag)`),
  }
}

export function spectrumFinding(meta: Meta, L: Tr = KO): Finding | null {
  const rows = meta.photometry ?? []
  const spec = TARGET_SPECTRAL[meta.id]
  if (!rows.length || !spec) return null
  const pts = measuredPoints(rows)
  const fit = bestFitTemperature(pts)
  if (!fit) return {
    id: 'spectrum', kind: 'spectrum', title: L('스펙트럼: 판단 보류', 'Spectrum: undecided'), level: '판단 보류', prov: ['spherex'],
    body: L('품질·불확도 조건을 통과한 측광점이 5개보다 적습니다. 불량·포화·잔상 또는 불확도가 없는 값은 모델에 쓰지 않았습니다.', 'Fewer than 5 photometry points pass quality and uncertainty checks. Defective, saturated, persistent or unquantified values are excluded from the model.'),
  }
  const strong = FEATURES.filter((f) => spec.expect.includes(f.id))
    .map((f) => ({ f, d: bandDepth(pts, f) }))
    .filter(({ d }) => d.status === 'ok' && d.depth !== null && d.sigma !== null && Number.isFinite(d.sigma) && d.sigma > 0 && d.depth > 3 * d.sigma)
    .sort((a, b) => b.d.depth! - a.d.depth!)
  const top = strong[0]
  return {
    id: 'spectrum', kind: 'spectrum', prov: ['spherex', 'model'],
    level: top ? '후보' : '판단 보류',
    title: top ? L('흡수 후보 · 모델 비교', 'Absorption candidate · model comparison') : L('스펙트럼 모양 · 모델 비교', 'Spectrum shape · model comparison'),
    body: top
      ? L(`품질 조건을 통과한 자료의 흑체 모양 맞춤은 약 ${Math.round(fit.T).toLocaleString()} K입니다. 연속선 가정으로 살펴볼 문헌 대역 후보 ${strong.length}개 중 깊이가 가장 큰 곳은 ${top.f.label}입니다. 오차에는 검출기 간 보정·구경·PSF·시기 간 공분산이 모두 포함되지 않아, 이 결과는 분자 검출 유의도나 온도 실측이 아닙니다.`, `A blackbody shape fit to quality-filtered data gives about ${Math.round(fit.T).toLocaleString()} K. Of ${strong.length} literature-band candidates selected under a continuum assumption, ${top.f.label} has the largest depth. The uncertainty does not fully include cross-detector calibration, aperture, PSF or temporal covariance; this is neither molecular-detection significance nor a measured temperature.`)
      : L(`품질 조건을 통과한 자료의 흑체 모양 맞춤은 약 ${Math.round(fit.T).toLocaleString()} K입니다. 이 연속선 가정에서는 뚜렷한 후보를 고르지 못했으며, 분자가 없다는 뜻은 아닙니다. 온도 실측이나 검출 유의도 대신 모양을 비교하는 모델입니다.`, `A blackbody shape fit to quality-filtered data gives about ${Math.round(fit.T).toLocaleString()} K. No distinct candidate was selected under this continuum assumption; that does not imply absence of a molecule. This is a shape model, not a measured temperature or detection-significance test.`),
    value: top ? L(`${top.f.label} 깊이 ${(100 * top.d.depth!).toFixed(0)}% ± ${(100 * top.d.sigma!).toFixed(0)}%`, `${top.f.label} depth ${(100 * top.d.depth!).toFixed(0)}% ± ${(100 * top.d.sigma!).toFixed(0)}%`) : L(`${Math.round(fit.T).toLocaleString()} K 흑체 (모델)`, `${Math.round(fit.T).toLocaleString()} K blackbody (model)`),
  }
}

export function findingsFor(meta: Meta, L: Tr = KO): Finding[] {
  const primary = VARIABLES.has(meta.id) ? [brightnessFinding(meta, L), motionFinding(meta, L)] : [motionFinding(meta, L), brightnessFinding(meta, L)]
  return [...primary, spectrumFinding(meta, L)].filter((f): f is Finding => f !== null)
}
