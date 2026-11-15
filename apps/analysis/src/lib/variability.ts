// Variable-star analysis on SPHEREx per-exposure photometry.
// Everything here only selects, groups and summarises measured rows; nothing is
// interpolated, resampled onto virtual channels or filled in.
import type { PhotRow } from '../components/PhotometryPanel'

export type Quantity = 'flux' | 'ring'
export type Quality = 'all' | 'severe' | 'clean'
export type ViewMode = 'raw' | 'median'

export const UNIT: Record<Quantity, string> = { flux: 'mJy', ring: 'MJy/sr (상대)' }
export const QUANTITY_NAME: Record<Quantity, string> = { flux: '구경 측광', ring: '고리 밝기' }
/** Flags that mark a pixel/readout as unusable, as opposed to OVERFLOW/SUR_ERROR/TRANSIENT,
 *  which fire on almost every exposure of a bright star. */
export const SEVERE_FLAGS = ['NONFUNC', 'MISSING_DATA', 'HOT', 'COLD', 'PERSIST']
export const UNIT_EN: Record<Quantity, string> = { flux: 'mJy', ring: 'MJy/sr (relative)' }
export const QUANTITY_EN: Record<Quantity, string> = { flux: 'aperture photometry', ring: 'ring brightness' }
export const QUALITY_EN: Record<Quality, string> = { all: 'all exposures', severe: 'drop severe flags', clean: 'unflagged only' }
export const QUALITY_NAME: Record<Quality, string> = {
  all: '모든 노출',
  severe: '심각 플래그 제외',
  clean: '플래그 없는 노출만',
}

export const valueOf = (r: PhotRow, q: Quantity) => (q === 'flux' ? r.flux_mjy : r.ring_mjy_sr) ?? null
export const errorOf = (r: PhotRow, q: Quantity) => (q === 'flux' ? r.err_mjy : r.ring_err) ?? null

export function median(xs: number[]) {
  const a = xs.filter(Number.isFinite).sort((a, b) => a - b)
  const n = a.length
  return n ? (a[(n - 1) >> 1] + a[n >> 1]) / 2 : null
}

/** Rows with a finite, positive value of quantity q and a known wavelength. */
export function usable(rows: PhotRow[], q: Quantity) {
  return rows.filter((r) => {
    const v = valueOf(r, q)
    return v !== null && Number.isFinite(v) && v > 0 && r.wave_um !== null && Number.isFinite(r.wave_um)
  })
}

export function passesQuality(r: PhotRow, quality: Quality) {
  if (quality === 'all') return true
  if (quality === 'clean') return r.flags.length === 0
  return !r.flags.some((f) => SEVERE_FLAGS.includes(f))
}

export const binOf = (wave: number, width: number) => Math.floor(wave / width + 1e-9)
export const binRange = (bin: number, width: number): [number, number] => [bin * width, (bin + 1) * width]

export interface Band { det: number; bin: number; width: number }

export function binsFor(rows: PhotRow[], q: Quantity, det: number, width: number) {
  const bins = new Map<number, { bin: number; n: number; visits: Set<number> }>()
  for (const r of usable(rows, q)) {
    if (r.detector !== det) continue
    const b = binOf(r.wave_um!, width)
    const item = bins.get(b) ?? { bin: b, n: 0, visits: new Set<number>() }
    item.n++
    item.visits.add(r.visit)
    bins.set(b, item)
  }
  return [...bins.values()].sort((a, b) => a.bin - b.bin)
}

/** Exposures of one detector + wavelength bin that pass the quality filter. */
export function selectRows(rows: PhotRow[], q: Quantity, band: Band, quality: Quality) {
  return usable(rows, q)
    .filter((r) => r.detector === band.det && binOf(r.wave_um!, band.width) === band.bin && passesQuality(r, quality))
    .sort((a, b) => a.mjd - b.mjd)
}

export interface Funnel {
  total: number // all photometry records
  valid: number // finite positive value of the chosen quantity
  inBand: number // ... in the selected detector + wavelength bin
  selected: number // ... that also pass the quality filter
  visits: number // observations (visits) that the selected exposures belong to
}

export function funnel(rows: PhotRow[], q: Quantity, band: Band, quality: Quality): Funnel {
  const valid = usable(rows, q)
  const inBand = valid.filter((r) => r.detector === band.det && binOf(r.wave_um!, band.width) === band.bin)
  const selected = inBand.filter((r) => passesQuality(r, quality))
  return { total: rows.length, valid: valid.length, inBand: inBand.length, selected: selected.length, visits: new Set(selected.map((r) => r.visit)).size }
}

export interface VisitPhot { visit: number; mjd: number; value: number; scatter: number | null; n: number; flagged: number; wave: [number, number] }

/** Per-visit median of already selected exposures; scatter is 1.4826·MAD (not an error bar). */
export function summarizeRows(selected: PhotRow[], q: Quantity): VisitPhot[] {
  const groups = new Map<number, PhotRow[]>()
  for (const r of selected) groups.set(r.visit, [...(groups.get(r.visit) ?? []), r])
  return [...groups]
    .map(([visit, rs]) => {
      const values = rs.map((r) => valueOf(r, q)!)
      const v = median(values)!
      return {
        visit,
        mjd: median(rs.map((r) => r.mjd))!,
        value: v,
        scatter: values.length > 1 ? 1.4826 * median(values.map((x) => Math.abs(x - v)))! : null,
        n: rs.length,
        flagged: rs.filter((r) => r.flags.length > 0).length,
        wave: [Math.min(...rs.map((r) => r.wave_um!)), Math.max(...rs.map((r) => r.wave_um!))] as [number, number],
      }
    })
    .sort((a, b) => a.mjd - b.mjd)
}

/** Back-compatible wrapper: `clean` = only exposures without any flag. */
export function summarize(rows: PhotRow[], q: Quantity, det: number, bin: number, width: number, clean: boolean): VisitPhot[] {
  return summarizeRows(selectRows(rows, q, { det, bin, width }, clean ? 'clean' : 'all'), q)
}

/** Everything one visit contains: usable exposures sorted by wavelength, plus what is missing and why. */
export function visitSpectrum(rows: PhotRow[], q: Quantity, visit: number) {
  const all = rows.filter((r) => r.visit === visit)
  const ok = usable(all, q).sort((a, b) => a.wave_um! - b.wave_um!)
  const missing = all.filter((r) => !ok.includes(r))
  const reasons = new Map<string, number>()
  for (const r of missing) {
    const why = r.note ?? (valueOf(r, q) === null ? `${QUANTITY_NAME[q]} 값 없음` : '0 이하 값')
    reasons.set(why, (reasons.get(why) ?? 0) + 1)
  }
  return { all: all.length, ok, missing: missing.length, reasons: [...reasons] }
}

/** Visit coverage of the whole data set: one cell per exposure (time × wavelength). */
export interface Cell { row: PhotRow; visit: number; mjd: number; wave: number; bw: number; det: number; ok: boolean }

export function coverage(rows: PhotRow[], q: Quantity): Cell[] {
  const ok = new Set(usable(rows, q))
  return rows
    .filter((r) => r.wave_um !== null && Number.isFinite(r.wave_um))
    .map((r) => ({ row: r, visit: r.visit, mjd: r.mjd, wave: r.wave_um!, bw: r.bandwidth_um ?? 0.02, det: r.detector, ok: ok.has(r) }))
}

/** Default band: the detector + bin seen in the most visits (ties → most exposures). */
export function defaultBand(rows: PhotRow[], q: Quantity, width: number): Band | null {
  let best: (Band & { visits: number; n: number }) | null = null
  for (let det = 1; det <= 6; det++)
    for (const b of binsFor(rows, q, det, width))
      if (!best || b.visits.size > best.visits || (b.visits.size === best.visits && b.n > best.n))
        best = { det, bin: b.bin, width, visits: b.visits.size, n: b.n }
  return best && { det: best.det, bin: best.bin, width: best.width }
}

export function phaseAt(t: number, t0: number, period: number) {
  if (!Number.isFinite(period) || period <= 0) throw new Error('주기는 양수여야 합니다')
  return (((t - t0) / period) % 1 + 1) % 1
}

export function compare(a: VisitPhot, b: VisitPhot) {
  return { ratio: b.value / a.value, percent: 100 * (b.value / a.value - 1), days: b.mjd - a.mjd }
}

/** RW Aur control check: in how many other wavelength bins of the same detector does the
 *  A→B change go the same way? Counts only — not a significance test. */
export function directionAcrossBins(rows: PhotRow[], q: Quantity, det: number, width: number, quality: Quality, a: number, b: number) {
  const out: { bin: number; percent: number }[] = []
  for (const { bin } of binsFor(rows, q, det, width)) {
    const s = summarizeRows(selectRows(rows, q, { det, bin, width }, quality), q)
    const pa = s.find((p) => p.visit === a)
    const pb = s.find((p) => p.visit === b)
    if (pa && pb) out.push({ bin, percent: compare(pa, pb).percent })
  }
  return out
}

const csvCell = (x: unknown) => {
  const s = x === null || x === undefined ? '' : String(x)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV matching the current view: raw exposures or per-visit medians, with the filters as comments. */
export function toCsv(opts: {
  target: string; q: Quantity; band: Band; quality: Quality; mode: ViewMode
  selected: PhotRow[]; summary: VisitPhot[]; utc: (mjd: number) => string
}) {
  const { target, q, band, quality, mode, selected, summary, utc } = opts
  const [lo, hi] = binRange(band.bin, band.width)
  const head = [
    `# target=${target}`,
    `# source=SPHEREx DR1/QR3 per-exposure aperture photometry (this app)`,
    `# quantity=${q} (${QUANTITY_NAME[q]}) unit=${UNIT[q]}`,
    `# detector=D${band.det} wavelength_bin_um=${lo.toFixed(3)}-${hi.toFixed(3)} quality=${quality} (${QUALITY_NAME[quality]})`,
    `# mode=${mode === 'raw' ? 'raw exposures' : 'per-visit median; scatter = 1.4826*MAD, not a measurement error'}`,
  ]
  if (mode === 'raw') {
    return [...head,
      'visit,exposure,mjd,utc,detector,wavelength_um,bandwidth_um,quantity,value,error,flags',
      ...selected.map((r) => [r.visit + 1, r.exposure, r.mjd, utc(r.mjd), r.detector, r.wave_um, r.bandwidth_um, q, valueOf(r, q), errorOf(r, q), r.flags.join(' ')].map(csvCell).join(',')),
    ].join('\n')
  }
  return [...head,
    'visit,mjd_median,utc,detector,wavelength_min_um,wavelength_max_um,quantity,median,scatter_MAD,n_exposures,flagged_exposures',
    ...summary.map((p) => [p.visit + 1, p.mjd, utc(p.mjd), band.det, p.wave[0], p.wave[1], q, p.value, p.scatter, p.n, p.flagged].map(csvCell).join(',')),
  ].join('\n')
}
