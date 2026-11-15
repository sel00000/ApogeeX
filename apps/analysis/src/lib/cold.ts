// Cold-object filter (idea from 경보's TrueBlink, re-implemented on our per-detector frames).
// Ordinary stars sit on the Rayleigh–Jeans tail at 3.8–5 µm, so their D6 (4.42–5.00 µm)
// brightness is about k = (λ5/λ6)² ≈ 0.77 of their D5 (3.83–4.41 µm) brightness in F_ν.
// D6 − k·D5 therefore cancels most stars; objects whose light comes out mainly beyond
// ~4.4 µm (methane-rich Y/T dwarfs such as WISE 0855) stay bright.
// It is a colour selection on SPHEREx pixels, not an identification.
import type { Frame } from './frames'
import type { TargetMeta } from '../types'

/** Median of the finite pixels (background level); NaN when the frame has no data. */
export function frameMedian(f: Frame): number {
  const v: number[] = []
  for (let i = 0; i < f.length; i++) if (f[i] === f[i]) v.push(f[i])
  if (!v.length) return NaN
  v.sort((a, b) => a - b)
  const n = v.length
  return (v[(n - 1) >> 1] + v[n >> 1]) / 2
}

/** (D6 − bg6) − k·(D5 − bg5). Pixels missing in either frame stay NaN; never filled. */
export function coldFrame(d6: Frame, d5: Frame, k: number): Frame {
  const out = new Float32Array(d6.length).fill(NaN)
  const b6 = frameMedian(d6), b5 = frameMedian(d5)
  if (!Number.isFinite(b6) || !Number.isFinite(b5)) return out
  for (let i = 0; i < d6.length; i++) {
    const a = d6[i], b = d5[i]
    if (a === a && b === b) out[i] = (a - b6) - k * (b - b5)
  }
  return out
}

/** Visits that have both D5 and D6 frames (context frames when the target has them). */
export function coldVisits(meta: TargetMeta): number[] {
  const wide = meta.kind !== 'patch' && meta.wide ? meta.wide : null
  return meta.visits
    .map((v, i) => {
      const det = wide ? wide.visits[i]?.f32_det : v.f32_det
      return det?.['5'] && det?.['6'] ? i : -1
    })
    .filter((i) => i >= 0)
}

/** Robust noise of a frame: 1.4826 × median absolute deviation of the finite pixels. */
export function robustSigma(f: Frame): number {
  const m = frameMedian(f)
  const d: number[] = []
  for (let i = 0; i < f.length; i++) if (f[i] === f[i]) d.push(Math.abs(f[i] - m))
  if (!d.length) return NaN
  d.sort((a, b) => a - b)
  return 1.4826 * d[(d.length - 1) >> 1]
}

/** Fraction of a source's D6 flux left after the filter, in a small box around a pixel:
 *  (x, y) in frame pixels, pixel i spanning [i, i+1).
 *  near 0 = cancelled like a normal star, near 1 = survives like a cold object.
 *  null when the source is not detected in D6 (box sum below 5σ): no ratio of noise. */
export function survival(d6: Frame, cold: Frame, n: number, x: number, y: number, r = 2): number | null {
  const b6 = frameMedian(d6), sig = robustSigma(d6)
  let s6 = 0, sc = 0, k = 0
  for (let j = Math.floor(y) - r; j <= Math.floor(y) + r; j++)
    for (let i = Math.floor(x) - r; i <= Math.floor(x) + r; i++) {
      if (i < 0 || j < 0 || i >= n || j >= n) continue
      const a = d6[j * n + i], c = cold[j * n + i]
      if (a === a && c === c) { s6 += a - b6; sc += c; k++ }
    }
  if (!k || !(s6 > 5 * sig * Math.sqrt(k))) return null
  return sc / s6
}
