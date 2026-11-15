import { seed } from "./math";
const mu = 0.0002959122082855911;
const dot = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Osculating two-body reference ellipse derived from a real JPL heliocentric state.
 * Only a reference curve; actual animation always uses the numerical JPL ephemeris. */
export function orbitPath(s: number[], segments = 192): number[][] {
  const r = s.slice(1, 4),
    v = s.slice(4, 7),
    R = Math.hypot(...r),
    h = cross(r, v),
    H = Math.hypot(...h),
    vxh = cross(v, h),
    evec = vxh.map((x, i) => x / mu - r[i] / R),
    e = Math.hypot(...evec),
    a = 1 / (2 / R - dot(v, v) / mu);
  if (!(a > 0) || e >= 1 || !Number.isFinite(a) || H === 0) return [];
  const p = e > 1e-8 ? evec.map((x) => x / e) : r.map((x) => x / R),
    q = cross(
      h.map((x) => x / H),
      p,
    ),
    theta = Math.atan2(dot(r, q), dot(r, p)),
    points = [];
  for (let i = 0; i < segments; i++) {
    const t = theta + (i / segments) * Math.PI * 2,
      radius = (a * (1 - e * e)) / (1 + e * Math.cos(t));
    points.push(
      p.map((x, j) => radius * (x * Math.cos(t) + q[j] * Math.sin(t))),
    );
  }
  points.push([...points[0]]);
  return points;
}
export function asteroidScale(id: string) {
  return 0.0008 * (1 + (seed(id) % 11) / 30);
}
