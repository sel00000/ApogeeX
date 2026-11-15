import type { TargetMeta } from '../types'

/** This is a necessary coverage check, not a detection-significance test. Prepared
 * bundles do not contain per-pixel wavelength/variance/PSF matching products. */
export function comparisonStatus(meta: TargetMeta, a: number, b: number, detector: number) {
  const A = meta.visits[a], B = meta.visits[b]
  if (!A || !B) return { blocked: true, reason: 'missing-visit' }
  if (detector && (!A.detectors.includes(detector) || !B.detectors.includes(detector)))
    return { blocked: true, reason: 'missing-detector' }
  if (A.wave_um && B.wave_um && Math.max(A.wave_um[0], B.wave_um[0]) > Math.min(A.wave_um[1], B.wave_um[1]))
    return { blocked: true, reason: 'disjoint-wavelength' }
  return { blocked: false, reason: detector ? 'unmatched-pixel-response' : 'mixed-detectors' }
}
