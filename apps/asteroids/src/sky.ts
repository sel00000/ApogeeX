/** Pure geometry for the sky background, planet poles and WASD flight.
 * Scene frame: heliocentric J2000 ecliptic, +Z = ecliptic north pole, AU. */
import { skyDirection } from "./math";

export type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

/** Galactic -> ICRS rotation (row-major), Gaia EDR3 documentation (Hipparcos convention). */
export const GALACTIC_TO_ICRS: Mat3 = [
  [-0.0548755604162154, 0.4941094278755837, -0.8676661490190047],
  [-0.873437090234885, -0.4448296299600112, -0.1980763734312015],
  [-0.4838350155487132, 0.746982244497219, 0.4559837761750669],
];
/** IAU 2006 J2000 mean obliquity, degrees. */
export const OBLIQUITY_DEG = 23.4392911;

const rad = Math.PI / 180;
const unit = (lonDeg: number, latDeg: number): Vec3 => [
  Math.cos(latDeg * rad) * Math.cos(lonDeg * rad),
  Math.cos(latDeg * rad) * Math.sin(lonDeg * rad),
  Math.sin(latDeg * rad),
];
const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const multiply = (a: Mat3, b: Mat3): Mat3 =>
  [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]),
  ) as Mat3;
export const transpose = (m: Mat3): Mat3 =>
  [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]) as Mat3;

/** ICRS (equatorial) -> ecliptic: rotation about +X by the obliquity. */
export function icrsToEclipticMatrix(obliquityDeg = OBLIQUITY_DEG): Mat3 {
  const c = Math.cos(obliquityDeg * rad),
    s = Math.sin(obliquityDeg * rad);
  return [
    [1, 0, 0],
    [0, c, s],
    [0, -s, c],
  ];
}
/** Galactic -> scene (ecliptic) rotation. Its transpose maps scene -> Galactic. */
export const GALACTIC_TO_ECLIPTIC: Mat3 = multiply(icrsToEclipticMatrix(), GALACTIC_TO_ICRS);

/** Galactic (l, b) in degrees -> ICRS RA/Dec in degrees (RA in 0..360). */
export function galacticToIcrs(lDeg: number, bDeg: number) {
  const v = apply(GALACTIC_TO_ICRS, unit(lDeg, bDeg));
  return {
    ra: ((Math.atan2(v[1], v[0]) / rad) % 360 + 360) % 360,
    dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / rad,
  };
}
/** Galactic (l, b) in degrees -> unit vector in the scene's ecliptic frame. */
export function galacticToEcliptic(lDeg: number, bDeg: number): Vec3 {
  return apply(GALACTIC_TO_ECLIPTIC, unit(lDeg, bDeg));
}
/** Scene direction -> texture coordinate of the Gaia map (u right, v up as in WebGL with flipY).
 * Map: equirectangular in Galactic l,b; centre l=0; l increases to the left; north (b=+90) at top.
 * Mirrored exactly by the GLSL in scene.ts. */
export function eclipticToSkyUv(d: Vec3): [number, number] {
  const g = apply(transpose(GALACTIC_TO_ECLIPTIC), d),
    n = Math.hypot(...g),
    l = Math.atan2(g[1], g[0]),
    b = Math.asin(g[2] / n);
  const u = 0.5 - l / (2 * Math.PI);
  return [u - Math.floor(u), 0.5 + b / Math.PI];
}

/** IAU pole (alpha0, delta0; J2000, degrees) as a unit vector in the scene's ecliptic frame. */
export function poleToEcliptic(alpha0: number, delta0: number): Vec3 {
  return skyDirection(alpha0, delta0);
}
/** IAU WGCCRE pole directions (alpha0, delta0 at J2000) given by the design spec. */
export const PLANET_POLES: Record<string, [number, number]> = {
  "199": [281.01, 61.41],
  "299": [272.76, 67.16],
  "399": [0, 90],
  "499": [317.68, 52.89],
  "599": [268.06, 64.5],
  "699": [40.59, 83.54],
  "799": [257.31, -15.18],
  "899": [299.36, 43.46],
};

/** WASD flight. Speed in AU/s from the distance (AU) to the nearest body surface. */
export const FLIGHT = { rate: 0.9, min: 0.0004, max: 30, boost: 4, ease: 0.12 };
export function flightSpeed(surfaceDistance: number, boost = false) {
  const d = Number.isFinite(surfaceDistance) ? Math.max(0, surfaceDistance) : Infinity;
  return Math.min(FLIGHT.max, Math.max(FLIGHT.min, FLIGHT.rate * d)) * (boost ? FLIGHT.boost : 1);
}
/** Held keys -> camera-local direction [right, up, back] (three.js camera looks along -Z).
 * Normalised so diagonals are not faster. */
export function flightDirection(keys: ReadonlySet<string>): Vec3 {
  const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    y = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0),
    z = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
    n = Math.hypot(x, y, z);
  return n ? [x / n, y / n, z / n] : [0, 0, 0];
}
/** Fraction of the remaining velocity change applied this frame (0.12 s ease; immediate if reduced). */
export function easeStep(dt: number, reduced: boolean) {
  if (reduced) return 1;
  return 1 - Math.exp(-dt / (FLIGHT.ease / 3));
}
export const FLIGHT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"]);

/** The sky picture could not be loaded: untick and disable the box and give its label the reason as a title.
 * The stored preference is deliberately left alone. */
export function markSkyUnavailable(
  box: { checked: boolean; disabled: boolean },
  label: { setAttribute(name: string, value: string): void } | null,
) {
  box.checked = false;
  box.disabled = true;
  label?.setAttribute("data-i18n-title", "o.skyFail");
}
