// Time interpolation of baked positions (float64 throughout).
import type { TargetMeta, Vec3 } from '../types'

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a))
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

function lerpSeries(mjd: number[], ys: Vec3[], t: number): Vec3 {
  const n = mjd.length
  if (t <= mjd[0]) return ys[0]
  if (t >= mjd[n - 1]) return ys[n - 1]
  // uniform 1-day grid from bake.py, but search anyway in case it is not
  let i = Math.min(n - 2, Math.max(0, Math.floor(t - mjd[0])))
  while (i > 0 && mjd[i] > t) i--
  while (i < n - 2 && mjd[i + 1] < t) i++
  const f = (t - mjd[i]) / (mjd[i + 1] - mjd[i])
  const a = ys[i]
  const b = ys[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/** Earth and target barycentric positions (AU, ICRS) at t, linearly interpolated
 *  on the daily samples. At a visit time the exact baked values are returned. */
export function stateAt(meta: TargetMeta, t: number): { earth: Vec3; target: Vec3 } {
  const v = meta.visits.find((v) => Math.abs(v.mjd - t) < 1e-6)
  if (v) return { earth: v.earth_au, target: v.target_au }
  return {
    earth: lerpSeries(meta.dense.mjd, meta.dense.earth_au, t),
    target: lerpSeries(meta.dense.mjd, meta.dense.target_au, t),
  }
}

/** Target space velocity (AU/day) from the daily samples. */
export function targetVelocity(meta: TargetMeta): Vec3 {
  const { mjd, target_au } = meta.dense
  const n = mjd.length - 1
  return scale(sub(target_au[n], target_au[0]), 1 / (mjd[n] - mjd[0]))
}

export const mjdToDate = (mjd: number) => new Date((mjd - 40587) * 86400e3)
export const fmtDate = (mjd: number) => mjdToDate(mjd).toISOString().slice(0, 10)
