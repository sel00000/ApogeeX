// Constellation figures for the sky globe: parsing the data file, great-circle interpolation of the
// figure lines and the rule that decides whether a name is drawn. Pure functions, unit-tested.
// The figures are a guide drawing (Stellarium "western" sky culture on Hipparcos positions), not SPHEREx data.
import { DEG, skyToVec, vecToSky } from './healpix';

export interface Constellation {
  id: string;
  en: string;
  ko: string;
  /** Where the name goes: [ra, dec] in degrees (ICRS). */
  label: [number, number];
  /** Polylines of [ra, dec] vertices in degrees (ICRS). */
  lines: [number, number][][];
}

const isPair = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1] as number) <= 90;

/** Validates the JSON of public/data/sky/constellations.json. Returns null when it is not usable at all;
 *  single bad entries (or bad vertices) are dropped. */
export function parseConstellations(json: unknown): Constellation[] | null {
  if (!json || typeof json !== 'object') return null;
  const list = (json as { constellations?: unknown }).constellations;
  if (!Array.isArray(list)) return null;
  const out: Constellation[] = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const v = c as Record<string, unknown>;
    if (typeof v.id !== 'string' || typeof v.en !== 'string' || !isPair(v.label) || !Array.isArray(v.lines)) continue;
    const lines = v.lines
      .filter((l): l is unknown[] => Array.isArray(l))
      .map((l) => l.filter(isPair).map((p) => [p[0], p[1]] as [number, number]))
      .filter((l) => l.length >= 2);
    out.push({ id: v.id, en: v.en, ko: typeof v.ko === 'string' && v.ko ? v.ko : v.en, label: [v.label[0], v.label[1]], lines });
  }
  return out.length ? out : null;
}

/** Points along the great-circle arc from a to b (both [ra, dec] deg), no step longer than maxStepDeg.
 *  Includes both ends. Antipodal ends (no unique arc) give just the two ends. */
export function greatCircle(a: [number, number], b: [number, number], maxStepDeg = 2): [number, number][] {
  const va = skyToVec(a[0], a[1]);
  const vb = skyToVec(b[0], b[1]);
  const cos = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const ang = Math.acos(cos);
  const n = Math.max(1, Math.ceil(ang / DEG / maxStepDeg - 1e-9));
  const s = Math.sin(ang);
  if (n === 1 || s < 1e-9) return [[a[0], a[1]], [b[0], b[1]]];
  const pts: [number, number][] = [[a[0], a[1]]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const ka = Math.sin((1 - t) * ang) / s;
    const kb = Math.sin(t * ang) / s;
    const p = vecToSky([ka * va[0] + kb * vb[0], ka * va[1] + kb * vb[1], ka * va[2] + kb * vb[2]]);
    pts.push([p.ra, p.dec]);
  }
  pts.push([b[0], b[1]]);
  return pts;
}

/** Line-segment vertex positions (x, y, z pairs on the unit sphere, skyToVec frame) of every figure,
 *  interpolated along great circles. */
export function constellationSegments(list: Constellation[], maxStepDeg = 2): Float32Array {
  const segs: number[] = [];
  for (const c of list) {
    for (const line of c.lines) {
      for (let i = 0; i + 1 < line.length; i++) {
        const pts = greatCircle(line[i], line[i + 1], maxStepDeg);
        for (let k = 0; k + 1 < pts.length; k++) {
          segs.push(...skyToVec(pts[k][0], pts[k][1]), ...skyToVec(pts[k + 1][0], pts[k + 1][1]));
        }
      }
    }
  }
  return new Float32Array(segs);
}

/** Names are hidden when the field of view is narrower than this (the lines stay). */
export const LABEL_MIN_FOV_DEG = 8;

export interface Box { x: number; y: number; w: number; h: number }

export const boxesOverlap = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Whether a constellation name with screen box `box` may be drawn: wide enough field, wholly on screen,
 *  and not covering any of the boxes to avoid (target markers, the read-out, other names). */
export function labelVisible(box: Box, fovDeg: number, width: number, height: number, avoid: Box[]): boolean {
  if (!(fovDeg >= LABEL_MIN_FOV_DEG)) return false;
  if (box.x < 0 || box.y < 0 || box.x + box.w > width || box.y + box.h > height) return false;
  return !avoid.some((a) => boxesOverlap(box, a, 2));
}

/** Text of a name: Korean name on the Korean UI, the Latin name in capitals on the English UI. */
export const labelText = (c: Constellation, lang: 'ko' | 'en') => (lang === 'en' ? c.en.toUpperCase() : c.ko);
