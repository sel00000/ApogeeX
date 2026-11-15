// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// Camera maths for looking at the sky from inside the celestial sphere (pure, no three.js).
//
// The camera sits at the centre and looks at the view centre (ra0, dec0). "North up" means the
// camera's up vector lies in the plane through the view direction and the north celestial pole.
// Because we look at the sphere from the inside, the right-handed frame
// v = (cos d cos a, sin d, -cos d sin a) puts increasing RA (east) on the LEFT of the screen,
// exactly as a sky chart or a north-up, east-left image.

import { DEG, MAX_ORDER, skyToVec, vecToSky } from './healpix';

export type Vec3 = [number, number, number];

export interface CameraBasis {
  /** Unit vector to the view centre. */
  forward: Vec3;
  /** Screen right (towards west when north is up). */
  right: Vec3;
  /** Screen up (towards north). */
  up: Vec3;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Camera basis for a north-up view centred on (ra, dec). At the exact poles "north up" is
 *  undefined, so the view direction is nudged by a hair (the picture is unaffected). */
export function cameraBasis(raDeg: number, decDeg: number): CameraBasis {
  const d = Math.max(-89.9999, Math.min(89.9999, decDeg));
  const a = raDeg * DEG;
  const f = skyToVec(raDeg, d);
  // right = forward x north, normalised: (sin a, 0, cos a), the direction of RA - 90 deg (west).
  const right: Vec3 = [Math.sin(a), 0, Math.cos(a)];
  // up = right x forward (unit, points towards the north pole).
  const up: Vec3 = [
    right[1] * f[2] - right[2] * f[1],
    right[2] * f[0] - right[0] * f[2],
    right[0] * f[1] - right[1] * f[0],
  ];
  return { forward: f, right, up };
}

/** Gnomonic (tangent-plane) coordinates of a sky point in the camera frame:
 *  x to the right, y up, both in units of tan(angle); `front` is false behind the camera. */
export function projectToView(b: CameraBasis, raDeg: number, decDeg: number): { x: number; y: number; front: boolean } {
  const v = skyToVec(raDeg, decDeg);
  const z = dot(v, b.forward);
  return { x: dot(v, b.right) / z, y: dot(v, b.up) / z, front: z > 1e-9 };
}

/** Normalised screen position (ndc x, y in -1..1, y up) -> sky, for a perspective camera with
 *  vertical field of view fovDeg and the given aspect (width / height). */
export function ndcToSky(b: CameraBasis, ndcX: number, ndcY: number, fovDeg: number, aspect: number): { ra: number; dec: number } {
  const t = Math.tan((fovDeg * DEG) / 2);
  const cr = ndcX * t * aspect;
  const cu = ndcY * t;
  const v: Vec3 = [
    b.forward[0] + cr * b.right[0] + cu * b.up[0],
    b.forward[1] + cr * b.right[1] + cu * b.up[1],
    b.forward[2] + cr * b.right[2] + cu * b.up[2],
  ];
  return vecToSky(v);
}

/** Sky -> ndc (x, y in -1..1 inside the view, y up); null when behind the camera. */
export function skyToNdc(b: CameraBasis, raDeg: number, decDeg: number, fovDeg: number, aspect: number): { x: number; y: number } | null {
  const p = projectToView(b, raDeg, decDeg);
  if (!p.front) return null;
  const t = Math.tan((fovDeg * DEG) / 2);
  return { x: p.x / (t * aspect), y: p.y / t };
}

/**
 * "Grab the sky": find the north-up view centre for which the sky point `anchor` appears at the
 * normalised screen position (ndcX, ndcY). The camera-frame ray (cr, cu, 1) has a fixed declination
 * relation  sin(dec_anchor) = (sin dec0 + cu cos dec0) / |ray|, which we solve for dec0; then RA
 * follows by rotation about the pole. Returns null when no north-up view can do it (near a pole).
 */
export function solveGrab(
  anchor: { ra: number; dec: number },
  ndcX: number,
  ndcY: number,
  fovDeg: number,
  aspect: number,
  currentDec: number,
): { ra: number; dec: number } | null {
  const t = Math.tan((fovDeg * DEG) / 2);
  const cr = ndcX * t * aspect;
  const cu = ndcY * t;
  const norm = Math.hypot(1, cr, cu);
  const cf = 1 / norm;
  const cuN = cu / norm;
  const R = Math.hypot(cf, cuN);
  const s = Math.sin(anchor.dec * DEG) / R;
  if (Math.abs(s) > 1) return null;
  const phi = Math.atan2(cuN, cf);
  const as = Math.asin(s);
  const candidates = [as - phi, Math.PI - as - phi, as - phi - 2 * Math.PI, Math.PI - as - phi - 2 * Math.PI, as - phi + 2 * Math.PI];
  let best: number | null = null;
  for (const c of candidates) {
    if (c < -Math.PI / 2 - 1e-12 || c > Math.PI / 2 + 1e-12) continue;
    if (best === null || Math.abs(c - currentDec * DEG) < Math.abs(best - currentDec * DEG)) best = c;
  }
  if (best === null) return null;
  const dec0 = Math.max(-89.9999, Math.min(89.9999, best / DEG));
  // RA of the ray when the view centre has RA 0; the anchor's RA minus that is the view RA.
  const rel = ndcToSky(cameraBasis(0, dec0), ndcX, ndcY, fovDeg, aspect);
  const ra = (((anchor.ra - rel.ra) % 360) + 360) % 360;
  return { ra, dec: dec0 };
}

/** Half-angle (deg) of the cone that encloses the whole view (corner of the screen). */
export function viewRadiusDeg(fovDeg: number, aspect: number): number {
  const t = Math.tan((fovDeg * DEG) / 2);
  return Math.atan(t * Math.hypot(1, aspect)) / DEG;
}

/** HiPS order whose texels (58.6 deg / 2^k / 512) are about as fine as the screen pixels. */
export function chooseOrder(fovDeg: number, heightDevicePx: number): number {
  const faceDeg = 58.6;
  const need = (faceDeg * heightDevicePx) / (512 * fovDeg);
  let k = 0;
  while ((1 << k) < need && k < MAX_ORDER) k++;
  return k;
}

/** Spherical linear interpolation between two sky positions (for smooth lookAt). */
export function slerpSky(a: { ra: number; dec: number }, b: { ra: number; dec: number }, t: number): { ra: number; dec: number } {
  const va = skyToVec(a.ra, a.dec);
  const vb = skyToVec(b.ra, b.dec);
  const c = Math.max(-1, Math.min(1, dot(va, vb)));
  const om = Math.acos(c);
  if (om < 1e-9) return { ...b };
  const s = Math.sin(om);
  const wa = Math.sin((1 - t) * om) / s;
  const wb = Math.sin(t * om) / s;
  return vecToSky([wa * va[0] + wb * vb[0], wa * va[1] + wb * vb[1], wa * va[2] + wb * vb[2]]);
}

// ---------------------------------------------------------------------------------------------
// Generalised camera: an arbitrary "up" pole (the zenith for a level-horizon ground view).
// ---------------------------------------------------------------------------------------------

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Unit axis least aligned with `u`, used when a pole direction is degenerate. */
function leastAlignedAxis(u: Vec3): Vec3 {
  const ax = Math.abs(u[0]), ay = Math.abs(u[1]), az = Math.abs(u[2]);
  if (ax <= ay && ax <= az) return [1, 0, 0];
  return ay <= az ? [0, 1, 0] : [0, 0, 1];
}

/** Camera basis looking along `forward` with screen-up as close as possible to the pole `up`
 *  (same construction as cameraBasis with the pole generalised: right = forward x up, up' = right x forward).
 *  Vectors are in the skyToVec frame. If forward is within a hair of +-up the horizontal direction is
 *  taken from an arbitrary axis, so the result is always finite and orthonormal. */
export function cameraBasisAbout(forward: Vec3, up: Vec3): CameraBasis {
  const f = norm3(forward);
  const u = norm3(up);
  let r = cross(f, u);
  if (Math.hypot(r[0], r[1], r[2]) < 1e-9) r = cross(f, leastAlignedAxis(f));
  const rf = dot(r, f); // re-orthogonalise: r is tiny (ill-conditioned) when f is within a hair of the pole
  const right = norm3([r[0] - rf * f[0], r[1] - rf * f[1], r[2] - rf * f[2]]);
  return { forward: f, right, up: cross(right, f) };
}

/** Rotation (rows e1, up, e3; proper) that turns the pole `up` into +Y. */
function poleFrame(up: Vec3): { e1: Vec3; e3: Vec3; u: Vec3 } {
  const u = norm3(up);
  const e1 = norm3(cross(leastAlignedAxis(u), u));
  return { e1, e3: cross(e1, u), u };
}

/** solveGrab for a camera whose "up" is the pole `up` instead of the celestial pole: finds the view
 *  centre (ra, dec in the skyToVec frame) that keeps `anchor` under the normalised screen position
 *  (ndcX, ndcY) with the pole kept vertical. Rotates the problem so `up` is +Y, uses solveGrab, rotates back.
 *  `current` (the present view centre) picks the nearer of the two mathematical solutions. */
export function solveGrabAbout(
  up: Vec3,
  anchor: { ra: number; dec: number },
  ndcX: number,
  ndcY: number,
  fovDeg: number,
  aspect: number,
  current: { ra: number; dec: number },
): { ra: number; dec: number } | null {
  const { e1, e3, u } = poleFrame(up);
  const fwd = (v: Vec3): Vec3 => [dot(v, e1), dot(v, u), dot(v, e3)];
  const a = vecToSky(fwd(skyToVec(anchor.ra, anchor.dec)));
  const c = vecToSky(fwd(skyToVec(current.ra, current.dec)));
  const sol = solveGrab(a, ndcX, ndcY, fovDeg, aspect, c.dec);
  if (!sol) return null;
  const w = skyToVec(sol.ra, sol.dec);
  const back: Vec3 = [
    e1[0] * w[0] + u[0] * w[1] + e3[0] * w[2],
    e1[1] * w[0] + u[1] * w[1] + e3[1] * w[2],
    e1[2] * w[0] + u[2] * w[1] + e3[2] * w[2],
  ];
  return vecToSky(back);
}
