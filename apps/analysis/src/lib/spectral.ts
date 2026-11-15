// Spectroscopy lab: theory (blackbody, literature band positions) vs SPHEREx measurements.
// Measurements are the per-exposure aperture photometry already in meta.json; nothing here
// creates observed values. Theory curves and band positions are labelled as such in the UI.
import type { PhotRow } from '../components/PhotometryPanel'
import { usableSpectralRow } from './quality'

const H = 6.62607015e-34, C = 2.99792458e8, K = 1.380649e-23

/** Planck F_nu shape (arbitrary units) at wavelength λ [µm] and temperature T [K]. */
export function planckNu(lambdaUm: number, T: number): number {
  const lam = lambdaUm * 1e-6
  const x = (H * C) / (lam * K * T)
  if (x > 700) return 0
  return 1 / (lam ** 3 * Math.expm1(x))
}

/** Wien peak of B_λ (µm) — used only to explain the theory curve. */
export const wienPeakUm = (T: number) => 2897.771955 / T

export interface SpecPoint { wave: number; flux: number; err: number; det: number; visit: number; exposure: string; flags: string[] }

export function measuredPoints(rows: PhotRow[], visits?: Set<number>): SpecPoint[] {
  return rows
    .filter((r) => usableSpectralRow(r) && (!visits || visits.has(r.visit)))
    .map((r) => ({ wave: r.wave_um!, flux: r.flux_mjy!, err: r.err_mjy!, det: r.detector, visit: r.visit, exposure: r.exposure, flags: r.flags ?? [] }))
    .sort((a, b) => a.wave - b.wave)
}

/** Best scale for a given T in log space (least squares on log10 flux). */
export function scaleFor(points: SpecPoint[], T: number): number {
  const d = points.map((p) => Math.log10(p.flux) - Math.log10(planckNu(p.wave, T))).filter(Number.isFinite)
  return d.length ? 10 ** (d.reduce((a, b) => a + b, 0) / d.length) : 1
}

/** rms of log10(measured/theory) after scaling: how well one blackbody describes the points. */
export function logRms(points: SpecPoint[], T: number): number {
  const s = scaleFor(points, T)
  const r = points.map((p) => Math.log10(p.flux / (s * planckNu(p.wave, T)))).filter(Number.isFinite)
  return r.length ? Math.sqrt(r.reduce((a, b) => a + b * b, 0) / r.length) : NaN
}

/** Grid search 150–12000 K (log steps). A model fit, not a temperature measurement. */
export function bestFitTemperature(points: SpecPoint[]): { T: number; rms: number } | null {
  if (points.length < 5) return null
  let best = { T: NaN, rms: Infinity }
  for (let lt = Math.log10(150); lt <= Math.log10(12000); lt += 0.005) {
    const T = 10 ** lt, rms = logRms(points, T)
    if (rms < best.rms) best = { T, rms }
  }
  return Number.isFinite(best.T) ? best : null
}

export type Molecule = 'H₂O' | 'CH₄' | 'CO' | 'CO₂' | 'H₂O·CH₄' | 'CH₄·CO'
export interface Feature {
  id: string
  molecule: Molecule
  label: string
  band: [number, number]
  /** continuum windows either side (one window = flat continuum) */
  continuum: [number, number][]
  color: string
  note: string
  noteEn?: string
}

// Approximate band positions from the literature (low-resolution IR spectra of cool stars
// and brown dwarfs, e.g. Cushing et al. 2005; King et al. 2010). Windows are fixed physics
// choices, not tuned to the data.
export const FEATURES: Feature[] = [
  { id: 'h2o_14', molecule: 'H₂O', label: 'H₂O 1.4 µm', band: [1.3, 1.5], continuum: [[1.15, 1.28], [1.52, 1.62]], color: '#4fc3f7', note: '수증기 분자의 진동 흡수. 차가운 별(M형)과 갈색왜성 대기에서 깊어집니다.', noteEn: "Vibrational absorption by water vapour. It deepens in cool stars (M type) and brown dwarfs." },
  { id: 'h2o_19', molecule: 'H₂O·CH₄', label: 'H₂O·CH₄ 1.8 µm', band: [1.75, 2.0], continuum: [[1.52, 1.62], [2.05, 2.2]], color: '#7f8cff', note: '물 흡수에 T형 갈색왜성에서는 메탄 흡수가 겹칩니다.', noteEn: "Water absorption, with methane on top in T-type brown dwarfs." },
  { id: 'ch4_23', molecule: 'CH₄·CO', label: 'CH₄·CO 2.3 µm', band: [2.25, 2.45], continuum: [[2.05, 2.2]], color: '#c792ea', note: '갈색왜성에서는 메탄, 차가운 거성·왜성에서는 일산화탄소 배음 흡수가 이 부근에 나타납니다.', noteEn: "Methane in brown dwarfs, or carbon monoxide overtone absorption in cool giants and dwarfs, near here." },
  { id: 'h2o_27', molecule: 'H₂O', label: 'H₂O 2.7 µm', band: [2.55, 2.95], continuum: [[2.05, 2.2], [3.6, 3.9]], color: '#4fc3f7', note: '넓고 강한 물 흡수 대역. 지상에서는 지구 대기 때문에 거의 볼 수 없는 파장입니다.', noteEn: "A broad, strong water band, almost invisible from the ground because of Earth's own atmosphere." },
  { id: 'ch4_33', molecule: 'CH₄', label: 'CH₄ 3.3 µm', band: [3.15, 3.45], continuum: [[2.05, 2.2], [3.65, 3.95]], color: '#ff79c6', note: '메탄의 가장 강한 기본 진동 흡수. T형·Y형 갈색왜성을 가르는 대표 특징입니다.', noteEn: "The strongest fundamental band of methane: the classic marker of T and Y brown dwarfs." },
  { id: 'co2_43', molecule: 'CO₂', label: 'CO₂ 4.3 µm', band: [4.2, 4.38], continuum: [[3.95, 4.15], [4.42, 4.55]], color: '#ffb86c', note: '이산화탄소 흡수. 아주 차가운 갈색왜성에서 보고되었습니다.', noteEn: "Carbon dioxide absorption, reported in very cold brown dwarfs." },
  { id: 'co_46', molecule: 'CO', label: 'CO 4.6 µm', band: [4.55, 4.95], continuum: [[3.95, 4.2]], color: '#f1fa8c', note: '일산화탄소 기본 진동 흡수. 차가운 별과 갈색왜성 모두에서 나타날 수 있습니다.', noteEn: "The fundamental band of carbon monoxide, possible in both cool stars and brown dwarfs." },
]

export interface BandDepth {
  id: string
  status: 'ok' | 'insufficient' | 'outside'
  nBand: number
  nCont: number
  fluxBand: number | null
  fluxCont: number | null
  depth: number | null
  sigma: number | null
}

const inRange = (w: number, [a, b]: [number, number]) => w >= a && w <= b
/** Robust level of a group of exposures: median, with an uncertainty that is the larger of
 *  (a) the propagated per-exposure measurement error and (b) the spread of the points
 *  themselves (1.4826·MAD/√n, scaled for a median). Neither is a significance on its own. */
function level(ps: SpecPoint[]) {
  const n = ps.length
  const v = ps.map((p) => p.flux).sort((x, y) => x - y)
  const m = (v[(n - 1) >> 1] + v[n >> 1]) / 2
  const mad = [...v].map((x) => Math.abs(x - m)).sort((x, y) => x - y)
  const madv = (mad[(n - 1) >> 1] + mad[n >> 1]) / 2
  const meas = (1.2533 * Math.sqrt(ps.reduce((a, p) => a + p.err * p.err, 0))) / n
  const spread = (1.2533 * 1.4826 * madv) / Math.sqrt(n)
  return { m, s: Math.max(meas, spread) }
}

/** Absorption depth 1 − F_band/F_continuum from measured points only.
 *  Continuum = straight line (in λ) between the window medians, or flat for one window.
 *  sigma = larger of measurement error and point spread (no cross-detector / aperture terms). */
export function bandDepth(points: SpecPoint[], f: Feature, minPerWindow = 2): BandDepth {
  const band = points.filter((p) => inRange(p.wave, f.band))
  const wins = f.continuum.map((w) => points.filter((p) => inRange(p.wave, w)))
  const base = { id: f.id, nBand: band.length, nCont: wins.reduce((a, w) => a + w.length, 0), fluxBand: null, fluxCont: null, depth: null, sigma: null }
  const lo = Math.min(...points.map((p) => p.wave)), hi = Math.max(...points.map((p) => p.wave))
  if (!points.length || f.band[1] < lo || f.band[0] > hi) return { ...base, status: 'outside' }
  if (band.length < minPerWindow || wins.some((w) => w.length < minPerWindow)) return { ...base, status: 'insufficient' }
  const b = level(band)
  const c = wins.map(level)
  const centre = (f.band[0] + f.band[1]) / 2
  let cont: number, cErr: number
  if (c.length === 1) { cont = c[0].m; cErr = c[0].s } else {
    const x0 = (f.continuum[0][0] + f.continuum[0][1]) / 2, x1 = (f.continuum[1][0] + f.continuum[1][1]) / 2
    const t = (centre - x0) / (x1 - x0)
    cont = c[0].m * (1 - t) + c[1].m * t
    cErr = Math.hypot(c[0].s * (1 - t), c[1].s * t)
  }
  const depth = 1 - b.m / cont
  const sigma = Math.hypot(b.s / cont, (b.m * cErr) / (cont * cont))
  return { ...base, status: 'ok', fluxBand: b.m, fluxCont: cont, depth, sigma }
}

export interface TargetSpectral { type: string; typeEn?: string; expect: string[]; story: string; storyEn?: string; refs: { label: string; labelEn?: string; url: string }[] }

// What the literature leads one to expect (catalog/literature, not measured here).
export const TARGET_SPECTRAL: Record<string, TargetSpectral> = {
  barnard: {
    type: 'M4 V 적색왜성 (약 3,200 K)',
    typeEn: "M4 V red dwarf (about 3,200 K)",
    expect: ['h2o_14', 'h2o_19', 'h2o_27', 'ch4_23', 'co_46'],
    story: '차가운 별은 대기에 물과 일산화탄소 분자가 살아남아 흡수 띠를 만듭니다. 짧은 파장은 포화돼 3.5 µm 이후만 측광됩니다.',
    storyEn: "Cool stars keep water and carbon monoxide molecules in their atmospheres, which carve absorption bands. Short wavelengths saturate, so only beyond 3.5 µm is measured.",
    refs: [{ label: 'Cushing, Rayner & Vacca (2005) — M·L·T형 적외선 분광 순서', labelEn: 'Cushing, Rayner & Vacca (2005), infrared spectral sequence of M, L and T dwarfs', url: 'https://ui.adsabs.harvard.edu/abs/2005ApJ...623.1115C' }],
  },
  eps_indi_b: {
    type: 'T1 + T6 갈색왜성 쌍 (Ba/Bb, SPHEREx에서는 하나로 보임)',
    typeEn: "T1 + T6 brown dwarf pair (Ba/Bb, one point for SPHEREx)",
    expect: ['h2o_14', 'h2o_19', 'ch4_23', 'h2o_27', 'ch4_33', 'co_46'],
    story: '별이 되지 못한 차가운 천체라 메탄이 대기에 생기고, 물과 메탄이 빛을 깊게 파먹습니다. 흑체 하나로는 설명되지 않는 모양을 직접 확인해 보세요.',
    storyEn: "Too cool to be stars, they form methane, and water and methane bite deep into their light. See for yourself a shape no single blackbody explains.",
    refs: [
      { label: 'King et al. (2010) — ε Indi Ba/Bb 상세 연구', labelEn: 'King et al. (2010), a detailed study of ε Indi Ba/Bb', url: 'https://ui.adsabs.harvard.edu/abs/2010A%26A...510A..99K' },
      { label: 'Cushing, Rayner & Vacca (2005)', url: 'https://ui.adsabs.harvard.edu/abs/2005ApJ...623.1115C' },
    ],
  },
  wise0855: {
    type: 'Y형 갈색왜성 (약 250–300 K, 가장 차가운 축)',
    typeEn: "Y dwarf (about 250–300 K, among the coldest)",
    expect: ['ch4_33', 'co2_43', 'co_46'],
    story: '얼음 행성만큼 차가워 빛 대부분이 4.5 µm 부근 “창”으로만 새어 나옵니다. 우리 자료는 근처 별 오염 때문에 3.8–5 µm(D5–D6)만 씁니다.',
    storyEn: "As cold as an icy planet, it leaks most of its light through a window near 4.5 µm. Our data use only 3.8–5 µm (D5–D6) to avoid a nearby star.",
    refs: [
      { label: 'Skemer et al. (2016) — 4.5–5 µm 지상 분광', labelEn: 'Skemer et al. (2016), 4.5–5 µm ground-based spectroscopy', url: 'https://ui.adsabs.harvard.edu/abs/2016ApJ...826L..17S' },
      { label: 'Luhman et al. (2024) — JWST 분광', labelEn: 'Luhman et al. (2024), JWST spectroscopy', url: 'https://ui.adsabs.harvard.edu/search/q=author%3A%22Luhman%22%20WISE%200855%20JWST%20year%3A2024' },
    ],
  },
  rw_aur: {
    type: '원반을 가진 젊은 별 (T Tauri형 쌍성)',
    typeEn: "Young star with a disc (T Tauri binary)",
    expect: [],
    story: '별 주위 먼지 원반이 데워져 긴 파장에서 별 자체보다 더 밝게 빛납니다. 흡수선보다 “흑체보다 밝은 적외선 초과”를 찾아보세요.',
    storyEn: "The warm dust disc around the star outshines the star itself at long wavelengths. Look for an infrared excess above the blackbody rather than absorption.",
    refs: [{ label: 'RW Aur 감광 연구: Lux et al. (2023)', labelEn: 'RW Aur dimming: Lux et al. (2023)', url: 'https://arxiv.org/abs/2312.17598' }],
  },
  r_dra: {
    type: 'M형 미라 변광성 (차가운 거성)',
    typeEn: "M-type Mira variable (cool giant)",
    expect: ['h2o_14', 'h2o_19', 'ch4_23', 'h2o_27', 'co_46'],
    story: '물과 일산화탄소 흡수가 기대되지만, 너무 밝아 거의 모든 노출의 중심이 포화됐습니다.',
    storyEn: "Water and carbon monoxide absorption are expected, but it is so bright that nearly every exposure is saturated at the core.",
    refs: [{ label: 'BAA VSS: R Dra', labelEn: 'BAA VSS: R Dra', url: 'https://britastro.org/vss/objects/obj-dra.html' }],
  },
}
