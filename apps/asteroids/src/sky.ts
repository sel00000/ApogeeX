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

/** Flight speed scale. Full throttle in AU/s from the distance (AU) to the nearest body surface,
 * so the camera slows down by itself near a body. The controls themselves are in flight.ts. */
export const FLIGHT = { rate: 0.9, min: 0.0004, max: 30 };
export function flightSpeed(surfaceDistance: number) {
  const d = Number.isFinite(surfaceDistance) ? Math.max(0, surfaceDistance) : Infinity;
  return Math.min(FLIGHT.max, Math.max(FLIGHT.min, FLIGHT.rate * d));
}

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

/** Drawn radius (AU) of a body that must show at least minPx CSS pixels in radius, never below its own
 * radius and never above maxRadius. pxPerAu is the screen scale at the body's distance from the camera. */
export function drawRadius(base: number, minPx: number, pxPerAu: number, maxRadius: number) {
  if (!(pxPerAu > 0) || !Number.isFinite(pxPerAu)) return base;
  return Math.max(base, Math.min(minPx / pxPerAu, maxRadius));
}
/** Illustrative planet size: at least minPx on screen, capped at PLANET_SIZE_CAP x the distance from the
 * Sun so planets never cover the Sun or each other; the true radius in SPHEREx (observer) view. */
export const PLANET_SIZE_CAP = 0.22;
export function planetDrawRadius(
  base: number,
  minPx: number,
  pxPerAu: number,
  sunDistance: number,
  observer = false,
) {
  return observer ? base : drawRadius(base, minPx, pxPerAu, PLANET_SIZE_CAP * sunDistance);
}
/** CSS pixels per AU at distance d from a perspective camera with vertical field of view fovDeg. */
export function pixelsPerAu(d: number, fovDeg: number, viewHeight: number) {
  return viewHeight / 2 / (Math.max(d, 1e-9) * Math.tan((fovDeg * Math.PI) / 360));
}
/** Illustrative weight of a planet drawn s times its true size: 0 at true size, 1 from 2.5 x up. */
export function illustrativeWeight(s: number) {
  if (!(s > 1)) return 0;
  const t = Math.min(1, (s - 1) / 1.5);
  return t * t * (3 - 2 * t);
}
/** Lighting of an illustrative planet: the true day/night light at k = 0, an even light
 * (never below 0.58, 1 on the day side) at k = 1. Mirrored in PLANET_FRAGMENT in scene.ts. */
export function illustrativeLight(light: number, k: number) {
  return light + (0.58 + 0.42 * light - light) * k;
}
