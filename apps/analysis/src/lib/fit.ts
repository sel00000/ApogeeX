// Proper-motion check from SPHEREx centroids.
// The prediction already contains catalog proper motion + parallax, so we fit a
// straight line to the residuals (measured − predicted). Its slope is the
// correction to the catalog proper motion as seen by SPHEREx.
import type { TargetMeta } from '../types'

export interface PmFit {
  n: number
  baselineYr: number
  /** measured proper motion, mas/yr (μα*, μδ) */
  pm: [number, number]
  pmErr: [number, number]
  /** |measured − catalog| / σ, per axis combined */
  sigmaDiff: number
  rmsPx: number
}

function wlinfit(t: number[], y: number[], w: number[]) {
  let S = 0, St = 0, Stt = 0, Sy = 0, Sty = 0
  for (let i = 0; i < t.length; i++) {
    S += w[i]; St += w[i] * t[i]; Stt += w[i] * t[i] * t[i]; Sy += w[i] * y[i]; Sty += w[i] * t[i] * y[i]
  }
  const D = S * Stt - St * St
  return { slope: (S * Sty - St * Sy) / D, slopeErr: Math.sqrt(S / D) }
}

export function fitProperMotion(meta: TargetMeta): PmFit | null {
  const vs = meta.visits.filter((v) => v.meas_px && v.meas_err_px)
  if (vs.length < 3) return null
  const t = vs.map((v) => (v.mjd - vs[0].mjd) / 365.25)
  const baselineYr = t[t.length - 1]
  if (baselineYr < 0.5) return null
  const w = vs.map((v) => 1 / v.meas_err_px! ** 2)
  const dx = vs.map((v) => v.meas_px![0] - v.pred_px[0])
  const dy = vs.map((v) => v.meas_px![1] - v.pred_px[1])
  const fx = wlinfit(t, dx, w)
  const fy = wlinfit(t, dy, w)
  const s = meta.wcs.cdelt_arcsec * 1000 // mas per px
  // east is −x, north is −y in PNG pixels
  const corr: [number, number] = [-fx.slope * s, -fy.slope * s]
  const err: [number, number] = [fx.slopeErr * s, fy.slopeErr * s]
  const a = meta.astrometry
  const rms = Math.sqrt(dx.reduce((q, d, i) => q + d * d + dy[i] * dy[i], 0) / vs.length)
  return {
    n: vs.length,
    baselineYr,
    pm: [a.pmra + corr[0], a.pmdec + corr[1]],
    pmErr: err,
    sigmaDiff: Math.hypot(corr[0] / err[0], corr[1] / err[1]),
    rmsPx: rms,
  }
}
