// Space-time cube: the sky patch around the target as the floor (frame pixels, north up,
// east left — exactly the Blink frame), time as the height.
//
// Positions are NOT copied from pred_px: at every time they are computed from the 3D
// ephemeris (Earth and target barycentric positions) through the SPHEREx line-of-sight
// camera (lib/los.ts). pred_px from bake.py is then an independent check.
import type { TargetMeta } from '../types'
import { stateAt } from './ephem'
import { losPixel } from './los'

export interface Cube {
  /** motion exaggeration about the first-visit position (1 = true scale) */
  X: number
  ref: [number, number]
  /** frame-pixel centre of the patch and its half size (pixels), in exaggerated units */
  cx: number
  cy: number
  half: number
  /** time span and cube height (in pixel units) */
  t0: number
  t1: number
  height: number
}

/** Frame pixel position of the target at time t, from the 3D geometry. */
export function pxAt(meta: TargetMeta, t: number): [number, number] {
  const { earth, target } = stateAt(meta, t)
  return losPixel(meta.wcs, earth, target)
}

/** Exaggerate a frame-pixel position about `ref` (X = 1 leaves it unchanged). */
export const exaggerate = (p: [number, number], ref: [number, number], X: number): [number, number] =>
  [ref[0] + (p[0] - ref[0]) * X, ref[1] + (p[1] - ref[1]) * X]

export function makeCube(meta: TargetMeta, X = 1): Cube {
  const vs = meta.visits
  const ref = pxAt(meta, vs[0].mjd)
  const pts = meta.dense.mjd.filter((t) => t >= vs[0].mjd && t <= vs[vs.length - 1].mjd).map((t) => exaggerate(pxAt(meta, t), ref, X))
  pts.push(...vs.map((v) => exaggerate(v.pred_px, ref, X)))
  if (X === 1) pts.push(...vs.flatMap(v => v.meas_px ? [v.meas_px] : []))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  // at least ±2 px so a pixel grid is visible even for targets that barely move
  const half = Math.max(2, Math.ceil(span * 0.75 + 0.5))
  return { X, ref, cx, cy, half, t0: vs[0].mjd, t1: vs[vs.length - 1].mjd, height: half * 2.6 }
}

/** Frame pixel + time → cube coordinates (X right = west, Y up = north, Z up = later). */
export function toCube(c: Cube, px: [number, number], t: number): [number, number, number] {
  const f = c.t1 > c.t0 ? (t - c.t0) / (c.t1 - c.t0) : 0
  const [x, y] = exaggerate(px, c.ref, c.X)
  return [x - c.cx, -(y - c.cy), Math.min(1, Math.max(0, f)) * c.height]
}

/** Contiguous measured visits only: never fill a failed centroid with a prediction. */
export function measuredSegments(meta: TargetMeta, cube: Cube): [number, number, number][][] {
  const segments: [number, number, number][][] = []
  let run: [number, number, number][] = []
  const flush = () => { if (run.length > 1) segments.push(run); run = [] }
  for (const v of meta.visits) {
    if (!v.meas_px || !v.meas_px.every(Number.isFinite)) { flush(); continue }
    run.push(toCube(cube, v.meas_px, v.mjd))
  }
  flush()
  return segments
}
