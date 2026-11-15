// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// Horizon maths for the "Ground" view of the sky map (pure: no three.js, no DOM, no clock; every
// function takes the time as epoch milliseconds).
//
// Frame: all vectors are in the map frame of healpix.ts skyToVec, v = (cos d cos a, sin d, -cos d sin a),
// J2000 (ICRS) RA/Dec. That is the standard equatorial frame (X,Y,Z) mapped to (X, Z, -Y), a proper rotation.
// Azimuth is measured from north through east, 0..360 deg; altitude is -90..90 deg.
//
// WHAT IS INCLUDED: Julian date, Greenwich mean sidereal time (IAU 1982), local sidereal time, and
// IAU 1976 precession from J2000 to the date (about 0.37 deg in 2026), so J2000 positions are compared with
// the true horizon of date. Time is treated as UT1 = UTC and TT = UTC for precession.
// WHAT IS LEFT OUT: atmospheric refraction (up to ~0.5 deg at the horizon, ~0.01 deg above 45 deg altitude),
// nutation (<= 0.006 deg, mean instead of apparent sidereal time), polar motion (< 1e-5 deg), UT1-UTC
// (< 0.9 s = 0.004 deg), annual aberration (<= 0.006 deg), stellar proper motion and parallax, the
// site's height. Measured against astropy (tests/horizon.test.ts, tests/fixtures/horizon_golden.json)
// the largest error is a few thousandths of a degree, far inside the 0.5 deg bound.

import { DEG, skyToVec, vecToSky } from './healpix';
import { cameraBasisAbout, solveGrabAbout, type CameraBasis, type Vec3 } from './view';

export interface Site {
  name: string;
  /** Geodetic latitude, degrees north. */
  latDeg: number;
  /** Longitude, degrees EAST of Greenwich (negative = west). */
  lonDeg: number;
  /** IANA time zone used to show the local clock. */
  timeZone: string;
}

export const SEOUL: Site = { name: 'Seoul', latDeg: 37.5665, lonDeg: 126.978, timeZone: 'Asia/Seoul' };

/** Observer frame at one instant, J2000 map-frame unit vectors. (east, north, zenith) is a right-handed set. */
export interface ObserverFrame {
  zenith: Vec3;
  /** North point of the horizon (horizontal, towards the celestial pole). */
  north: Vec3;
  /** East point of the horizon. */
  east: Vec3;
  /** Local mean sidereal time, degrees 0..360. */
  lstDeg: number;
  site: Site;
}

export interface Horizontal {
  /** Azimuth, deg from north through east, 0..360. */
  azDeg: number;
  /** Altitude above the horizon, deg. */
  altDeg: number;
}

const norm360 = (x: number) => ((x % 360) + 360) % 360;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Julian date (days) from epoch milliseconds (UTC; Unix epoch = JD 2440587.5). */
export function julianDate(epochMs: number): number {
  return epochMs / 86400000 + 2440587.5;
}

/** Greenwich mean sidereal time in degrees 0..360 (IAU 1982), UT1 taken as UTC. */
export function gmstDeg(epochMs: number): number {
  const jd = julianDate(epochMs);
  const d = jd - 2451545.0;
  const T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Local mean sidereal time in degrees 0..360 for an EAST longitude in degrees. */
export function lstDeg(epochMs: number, lonDeg: number): number {
  return norm360(gmstDeg(epochMs) + lonDeg);
}

/** IAU 1976 precession matrix P (row-major 3x3) taking standard equatorial J2000 vectors to the mean equator of date. */
function precessionMatrix(epochMs: number): number[] {
  const T = (julianDate(epochMs) - 2451545.0) / 36525;
  const as = Math.PI / 180 / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
  const cz = Math.cos(zeta), sz = Math.sin(zeta), cZ = Math.cos(z), sZ = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  return [
    cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
    cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
    cz * st, -sz * st, ct,
  ];
}

/** Standard equatorial (X,Y,Z) of date -> J2000 (multiply by P transposed) -> map frame (X, Z, -Y). */
function dateEqToMap(P: number[], v: Vec3): Vec3 {
  const X = P[0] * v[0] + P[3] * v[1] + P[6] * v[2];
  const Y = P[1] * v[0] + P[4] * v[1] + P[7] * v[2];
  const Z = P[2] * v[0] + P[5] * v[1] + P[8] * v[2];
  return [X, Z, -Y];
}

/** Zenith, north and east of the horizon at `epochMs` over `site`, as J2000 map-frame unit vectors. */
export function observerFrame(epochMs: number, site: Site = SEOUL): ObserverFrame {
  const lst = lstDeg(epochMs, site.lonDeg);
  const L = lst * DEG, phi = site.latDeg * DEG;
  const P = precessionMatrix(epochMs);
  const zenith = dateEqToMap(P, [Math.cos(phi) * Math.cos(L), Math.cos(phi) * Math.sin(L), Math.sin(phi)]);
  const north = dateEqToMap(P, [-Math.sin(phi) * Math.cos(L), -Math.sin(phi) * Math.sin(L), Math.cos(phi)]);
  const east = dateEqToMap(P, [-Math.sin(L), Math.cos(L), 0]);
  return { zenith, north, east, lstDeg: lst, site };
}

/** Unit vector (map frame) -> azimuth/altitude. Azimuth is 0 at the zenith/nadir by convention. */
export function vecToHorizontal(f: ObserverFrame, v: Vec3): Horizontal {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(v, f.zenith) / n))) / DEG;
  const az = Math.atan2(dot(v, f.east), dot(v, f.north)) / DEG;
  return { azDeg: norm360(az), altDeg: alt };
}

/** Azimuth/altitude -> unit vector (map frame). */
export function horizontalToVec(f: ObserverFrame, azDeg: number, altDeg: number): Vec3 {
  const a = azDeg * DEG, h = altDeg * DEG;
  const ch = Math.cos(h), cn = ch * Math.cos(a), ce = ch * Math.sin(a), cz = Math.sin(h);
  return [
    cn * f.north[0] + ce * f.east[0] + cz * f.zenith[0],
    cn * f.north[1] + ce * f.east[1] + cz * f.zenith[1],
    cn * f.north[2] + ce * f.east[2] + cz * f.zenith[2],
  ];
}

/** J2000 RA/Dec (deg) -> azimuth/altitude (deg) for the observer frame. */
export function skyToHorizontal(f: ObserverFrame, raDeg: number, decDeg: number): Horizontal {
  return vecToHorizontal(f, skyToVec(raDeg, decDeg));
}

/** Azimuth/altitude (deg) -> J2000 RA/Dec (deg). */
export function horizontalToSky(f: ObserverFrame, azDeg: number, altDeg: number): { ra: number; dec: number } {
  return vecToSky(horizontalToVec(f, azDeg, altDeg));
}

/** True when the sky position is above the horizon by more than `marginDeg` (default 0). */
export function isAboveHorizon(f: ObserverFrame, raDeg: number, decDeg: number, marginDeg = 0): boolean {
  return dot(skyToVec(raDeg, decDeg), f.zenith) > Math.sin(marginDeg * DEG);
}

/** True when the sky position is above the skyline at its azimuth, so it can be seen (one rule for hiding markers,
 *  refusing clicks on the ground and listing what is below the horizon). */
export function isAboveSkyline(f: ObserverFrame, raDeg: number, decDeg: number): boolean {
  const h = skyToHorizontal(f, raDeg, decDeg);
  return h.altDeg >= skylineHeightDeg(h.azDeg);
}

/** Ground drag: false when a drag solution would swing the view round the zenith (azimuth jumps by more than 90 deg
 *  while the view is above 80 deg altitude). The view then stays where it is, like a planetarium stopping at the zenith. */
export function groundGrabAccepted(f: ObserverFrame, current: { ra: number; dec: number }, next: { ra: number; dec: number }): boolean {
  const a = skyToHorizontal(f, current.ra, current.dec);
  const b = skyToHorizontal(f, next.ra, next.dec);
  if (Math.max(a.altDeg, b.altDeg) <= 80) return true;
  const d = Math.abs(((b.azDeg - a.azDeg + 540) % 360) - 180);
  return d <= 90;
}

/** The view centre with the same azimuth as `view` but the given altitude (default 20 deg). */
export function viewAtAltitude(f: ObserverFrame, view: { ra: number; dec: number }, altDeg = 20): { ra: number; dec: number } {
  const h = skyToHorizontal(f, view.ra, view.dec);
  return horizontalToSky(f, h.azDeg, altDeg);
}

/** Allowed range of the view centre's altitude so the horizon stays on screen for a vertical field `fovDeg`:
 *  min = -(fov/2 - 5) limited to [-20, 0], but never so low that the top edge of the screen is under the highest
 *  skyline (SKYLINE_MAX_DEG + 0.5 deg): zoomed in near the horizon the view rises (+3.75 deg at a field of 1.5 deg)
 *  so that some sky is always on screen. max = 89.9. */
export function altitudeLimits(fovDeg: number): { min: number; max: number } {
  const low = -Math.min(20, Math.max(0, fovDeg / 2 - 5));
  return { min: Math.max(low, SKYLINE_MAX_DEG + 0.5 - fovDeg / 2) + 0, max: 89.9 };
}

/** Clamp the view centre's altitude into altitudeLimits(fovDeg), keeping azimuth. Returns the input
 *  object unchanged when it is already inside. */
export function clampViewToHorizon(f: ObserverFrame, view: { ra: number; dec: number }, fovDeg: number): { ra: number; dec: number } {
  const h = skyToHorizontal(f, view.ra, view.dec);
  const { min, max } = altitudeLimits(fovDeg);
  if (h.altDeg >= min && h.altDeg <= max) return view;
  return horizontalToSky(f, h.azDeg, Math.max(min, Math.min(max, h.altDeg)));
}

/** Camera basis with the zenith up (level horizon) looking at (ra, dec). */
export function groundCameraBasis(f: ObserverFrame, raDeg: number, decDeg: number): CameraBasis {
  return cameraBasisAbout(skyToVec(raDeg, decDeg), f.zenith);
}

/** Drag solver for the level-horizon camera: the view centre that keeps `anchor` under (ndcX, ndcY). */
export function solveGroundGrab(
  f: ObserverFrame,
  anchor: { ra: number; dec: number },
  ndcX: number,
  ndcY: number,
  fovDeg: number,
  aspect: number,
  current: { ra: number; dec: number },
): { ra: number; dec: number } | null {
  return solveGrabAbout(f.zenith, anchor, ndcX, ndcY, fovDeg, aspect, current);
}

/** Largest skyline height in degrees. */
export const SKYLINE_MAX_DEG = 4;

function hash01(n: number): number {
  let x = (Math.imul(n | 0, 374761393) + 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Silhouette height (deg, 0..SKYLINE_MAX_DEG) at azimuth `azDeg`: low hills, tree tufts and a few roofs.
 *  Deterministic and 360-periodic; no randomness, no clock. */
export function skylineHeightDeg(azDeg: number): number {
  const a = norm360(azDeg);
  const r = a * DEG;
  let h = 1.3 + 0.5 * Math.sin(3 * r + 0.7) + 0.3 * Math.sin(7 * r + 2.1) + 0.15 * Math.sin(13 * r + 4.0);
  // tree tufts: 1.5 deg cells with a hashed height
  const cell = Math.floor(a / 1.5);
  const t = hash01(cell);
  if (t > 0.45) h += (t - 0.45) * 1.35 * Math.sin(((a % 1.5) / 1.5) * Math.PI) ** 0.8; // a hump that is 0 at the cell edges: no vertical steps
  // roofs: flat-topped blocks at fixed azimuths
  for (const [c, w, hh] of ROOFS) {
    let d = Math.abs(a - c);
    if (d > 180) d = 360 - d;
    if (d < w / 2) h = Math.max(h, hh);
  }
  return Math.max(0, Math.min(SKYLINE_MAX_DEG, h));
}

const ROOFS: ReadonlyArray<readonly [number, number, number]> = [
  [22, 2.2, 2.6], [47, 3, 2.1], [96, 1.8, 3.1], [131, 2.6, 2.4], [178, 2, 2.9],
  [214, 3.2, 2.2], [251, 1.6, 3.4], [288, 2.4, 2.5], [323, 2, 2.8], [351, 2.8, 2.3],
];

/** Wall-clock "HH:MM" at the site (Intl, 24 h), independent of the visitor's time zone. */
export function formatSiteClock(epochMs: number, site: Site = SEOUL): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: site.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(epochMs));
}
