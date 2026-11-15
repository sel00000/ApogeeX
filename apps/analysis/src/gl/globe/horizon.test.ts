// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
import { describe, expect, it } from 'vitest';
import golden from './fixtures/horizon_golden.json';
import { DEG, skyToVec, vecToSky } from './healpix';
import { cameraBasisAbout, ndcToSky, solveGrabAbout, type Vec3 } from './view';
import {
  SEOUL, SKYLINE_MAX_DEG, altitudeLimits, clampViewToHorizon, formatSiteClock, gmstDeg, groundCameraBasis, horizontalToSky,
  isAboveHorizon, julianDate, lstDeg, observerFrame, skyToHorizontal, skylineHeightDeg, solveGroundGrab, vecToHorizontal, viewAtAltitude,
  horizontalToVec, groundGrabAccepted, isAboveSkyline,
} from './horizon';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a: Vec3, b: Vec3) => {
  const c: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...c), dot(a, b)) / DEG; // accurate for tiny angles
};
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

let worstDir = 0, worstLst = 0;
describe('horizon vs astropy golden values', () => {
  for (const [name, site] of Object.entries(golden.sites)) {
    const s = { name, latDeg: site.latDeg, lonDeg: site.lonDeg, timeZone: 'UTC' };
    for (const t of site.times) {
      it(`${name} ${t.utc}: sidereal time and ${Object.keys(t.stars).length} stars`, () => {
        const dl = angDiff(lstDeg(t.epochMs, s.lonDeg), t.lstDeg);
        worstLst = Math.max(worstLst, dl);
        expect(dl).toBeLessThan(0.01);
        const f = observerFrame(t.epochMs, s);
        for (const [star, g] of Object.entries(t.stars)) {
          const mine = skyToHorizontal(f, g.ra, g.dec);
          const v1 = horizontalToVec(f, mine.azDeg, mine.altDeg);
          const v2 = horizontalToVec(f, g.az, g.alt);
          const err = angle(v1, v2); // direction error on the sky (safe near the zenith)
          worstDir = Math.max(worstDir, err);
          expect(err, `${star} err ${err}`).toBeLessThan(0.1);
          expect(Math.abs(mine.altDeg - g.alt)).toBeLessThan(0.1);
        }
      });
    }
  }
  it('reports the worst errors', () => {
    console.log(`horizon worst direction error ${worstDir.toFixed(5)} deg, worst LST error ${worstLst.toFixed(5)} deg`);
  });
});

describe('time', () => {
  it('Julian date of J2000.0 and the Unix epoch', () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 9);
    expect(julianDate(0)).toBe(2440587.5);
  });
  it('GMST at J2000.0 is 280.46 deg', () => {
    expect(gmstDeg(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(280.46061837, 6);
  });
  it('site clock uses Asia/Seoul, not the local zone', () => {
    expect(formatSiteClock(Date.UTC(2026, 10, 14, 7, 45), SEOUL)).toBe('16:45');
  });
});

describe('observer frame', () => {
  const ms = Date.UTC(2026, 10, 14, 9, 30);
  const f = observerFrame(ms, SEOUL);
  it('is orthonormal and right-handed (east, north, zenith)', () => {
    for (const v of [f.zenith, f.north, f.east]) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    expect(dot(f.zenith, f.north)).toBeCloseTo(0, 12);
    expect(dot(f.zenith, f.east)).toBeCloseTo(0, 12);
    expect(dot(f.north, f.east)).toBeCloseTo(0, 12);
    const c: Vec3 = [f.east[1] * f.north[2] - f.east[2] * f.north[1], f.east[2] * f.north[0] - f.east[0] * f.north[2], f.east[0] * f.north[1] - f.east[1] * f.north[0]];
    expect(angle(c, f.zenith)).toBeLessThan(1e-6);
  });
  it('zenith is at (LST, latitude) of date, within the 0.4 deg precession', () => {
    const z = vecToSky(f.zenith);
    const zd = angle(f.zenith, skyToVec(f.lstDeg, SEOUL.latDeg));
    expect(zd).toBeLessThan(0.45);
    expect(zd).toBeGreaterThan(0.2); // precession is really applied (about 0.37 deg in 2026)
    expect(z.dec).toBeGreaterThan(36);
  });
  it('the celestial pole sits at altitude = latitude, azimuth 0 (to precession)', () => {
    for (const site of [SEOUL, { name: 'Santiago', latDeg: -33.4489, lonDeg: -70.6693, timeZone: 'UTC' }]) {
      const ff = observerFrame(ms, site);
      const pole = site.latDeg >= 0 ? skyToHorizontal(ff, 0, 90) : skyToHorizontal(ff, 0, -90);
      expect(Math.abs(Math.abs(pole.altDeg) - Math.abs(site.latDeg))).toBeLessThan(0.45);
      expect(pole.altDeg).toBeGreaterThan(0); // the visible celestial pole is above the horizon in both hemispheres
      if (site.latDeg > 0) expect(angDiff(pole.azDeg, 0)).toBeLessThan(2);
      else expect(angDiff(pole.azDeg, 180)).toBeLessThan(2); // south pole is due south
    }
  });
  it('equatorial <-> horizontal round trips', () => {
    const r = rng(7);
    for (let i = 0; i < 300; i++) {
      const ra = r() * 360, dec = Math.asin(2 * r() - 1) / DEG;
      const h = skyToHorizontal(f, ra, dec);
      const back = horizontalToSky(f, h.azDeg, h.altDeg);
      expect(angle(skyToVec(ra, dec), skyToVec(back.ra, back.dec))).toBeLessThan(1e-7);
    }
  });
  it('facing south, east is on the left (screen right is west)', () => {
    const fwd = horizontalToVec(f, 180, 20);
    const b = cameraBasisAbout(fwd, f.zenith);
    expect(dot(b.right, f.east)).toBeLessThan(-0.9);
    expect(dot(b.up, f.zenith)).toBeGreaterThan(0.9);
  });
  it('isAboveHorizon, viewAtAltitude, vecToHorizontal', () => {
    const up = horizontalToSky(f, 100, 10), down = horizontalToSky(f, 100, -10);
    expect(isAboveHorizon(f, up.ra, up.dec)).toBe(true);
    expect(isAboveHorizon(f, down.ra, down.dec)).toBe(false);
    expect(isAboveHorizon(f, up.ra, up.dec, 15)).toBe(false);
    const v = viewAtAltitude(f, down);
    const h = skyToHorizontal(f, v.ra, v.dec);
    expect(h.altDeg).toBeCloseTo(20, 6);
    expect(h.azDeg).toBeCloseTo(100, 6);
    expect(vecToHorizontal(f, f.zenith).altDeg).toBeCloseTo(90, 9);
  });
});

describe('level-horizon camera', () => {
  const f = observerFrame(Date.UTC(2026, 3, 20, 11, 45), SEOUL);
  it('basis is orthonormal with the zenith up, also near the zenith and nadir', () => {
    const r = rng(3);
    const dirs: Vec3[] = [f.zenith, f.zenith.map((x) => -x) as Vec3];
    for (const e of [1e-12, 1e-8, 1e-5]) dirs.push([f.zenith[0] + e, f.zenith[1], f.zenith[2]], [-f.zenith[0], -f.zenith[1] + e, -f.zenith[2]]);
    for (let i = 0; i < 200; i++) dirs.push(skyToVec(r() * 360, Math.asin(2 * r() - 1) / DEG));
    for (const d of dirs) {
      const b = cameraBasisAbout(d, f.zenith);
      for (const v of [b.forward, b.right, b.up]) expect(Math.hypot(...v)).toBeCloseTo(1, 9);
      expect(Math.abs(dot(b.forward, b.right))).toBeLessThan(1e-9);
      expect(Math.abs(dot(b.forward, b.up))).toBeLessThan(1e-9);
      expect(Math.abs(dot(b.right, b.up))).toBeLessThan(1e-9);
      expect(Math.abs(dot(b.right, f.zenith))).toBeLessThan(1e-6); // level horizon
      if (Math.abs(dot(d, f.zenith)) < 0.999) expect(dot(b.up, f.zenith)).toBeGreaterThan(0);
    }
    const b = groundCameraBasis(f, 10, 20);
    expect(Math.hypot(...b.up)).toBeCloseTo(1, 12);
  });
  it('drag solver keeps the grabbed point under the pointer (random cases)', () => {
    const r = rng(11);
    let solved = 0;
    for (let i = 0; i < 1000; i++) {
      const fov = 20 + r() * 80, aspect = 0.5 + r() * 1.5;
      const view = horizontalToSky(f, r() * 360, -10 + r() * 80);
      const nx = r() * 1.8 - 0.9, ny = r() * 1.8 - 0.9;
      const anchor = ndcToSky(groundCameraBasis(f, view.ra, view.dec), nx, ny, fov, aspect);
      // pointer moves to a new place; find the view that keeps the anchor under it
      const px = r() * 1.8 - 0.9, py = r() * 1.8 - 0.9;
      const sol = solveGroundGrab(f, anchor, px, py, fov, aspect, view);
      if (!sol) continue;
      solved++;
      const back = ndcToSky(groundCameraBasis(f, sol.ra, sol.dec), px, py, fov, aspect);
      expect(angle(skyToVec(back.ra, back.dec), skyToVec(anchor.ra, anchor.dec))).toBeLessThan(1e-6);
      // horizon level: the solved camera right vector has no vertical part (guaranteed by construction)
      const b = groundCameraBasis(f, sol.ra, sol.dec);
      expect(Math.abs(dot(b.right, f.zenith))).toBeLessThan(1e-6);
    }
    expect(solved).toBeGreaterThan(900);
  });
  it('dragging by zero keeps the view; solveGrabAbout with +Y pole equals the plain solver', () => {
    const view = horizontalToSky(f, 200, 30);
    const anchor = ndcToSky(groundCameraBasis(f, view.ra, view.dec), 0.3, -0.2, 60, 1.5);
    const sol = solveGroundGrab(f, anchor, 0.3, -0.2, 60, 1.5, view)!;
    expect(angle(skyToVec(sol.ra, sol.dec), skyToVec(view.ra, view.dec))).toBeLessThan(1e-6);
    const s2 = solveGrabAbout([0, 1, 0], { ra: 100, dec: 20 }, 0.1, 0.1, 50, 1.2, { ra: 90, dec: 10 });
    expect(s2).not.toBeNull();
  });
  it('clamp keeps the horizon in view', () => {
    expect(altitudeLimits(70)).toEqual({ min: -20, max: 89.9 });
    expect(altitudeLimits(20).min).toBeCloseTo(-5, 12);
    expect(altitudeLimits(9).min).toBeCloseTo(0, 12);
    expect(altitudeLimits(8).min).toBeCloseTo(SKYLINE_MAX_DEG + 0.5 - 4, 12); // zoomed in: the view rises above the skyline
    const inside = horizontalToSky(f, 50, 30);
    expect(clampViewToHorizon(f, inside, 60)).toBe(inside);
    const low = clampViewToHorizon(f, horizontalToSky(f, 50, -70), 60);
    const h = skyToHorizontal(f, low.ra, low.dec);
    expect(h.altDeg).toBeCloseTo(-20, 6);
    expect(h.azDeg).toBeCloseTo(50, 6);
    const hi = skyToHorizontal(f, ...Object.values(clampViewToHorizon(f, horizontalToSky(f, 50, 89.99999), 60)) as [number, number]);
    expect(hi.altDeg).toBeLessThanOrEqual(89.9 + 1e-6);
  });
});

const fz = observerFrame(Date.parse('2026-11-14T12:30:00Z'), SEOUL);
describe('horizon stays in view and sky stays on screen', () => {
  it('the top edge of the screen is above the highest skyline for every field of view', () => {
    for (let fov = 1.5; fov <= 100; fov += 0.25) {
      const { min, max } = altitudeLimits(fov);
      expect(min + fov / 2).toBeGreaterThan(SKYLINE_MAX_DEG);
      expect(min).toBeLessThanOrEqual(max);
    }
  });
  it('a view clamped at a 1.5 degree field shows sky above the skyline at every azimuth', () => {
    const f2 = observerFrame(Date.parse('2026-11-15T03:00:00+09:00'), SEOUL);
    for (let az = 0; az < 360; az += 0.5) {
      const v = clampViewToHorizon(f2, horizontalToSky(f2, az, -5), 1.5);
      const h = skyToHorizontal(f2, v.ra, v.dec);
      expect(h.altDeg + 0.75).toBeGreaterThan(skylineHeightDeg(az));
    }
  });
  it('isAboveSkyline: 0.4 deg up behind a 1.5 deg hill is hidden, above it is visible', () => {
    let az = 0;
    while (skylineHeightDeg(az) < 2.5) az += 0.5;
    const h = skylineHeightDeg(az);
    const lo = horizontalToSky(fz, az, h - 0.3);
    const hi = horizontalToSky(fz, az, h + 0.3);
    expect(isAboveSkyline(fz, lo.ra, lo.dec)).toBe(false);
    expect(isAboveSkyline(fz, hi.ra, hi.dec)).toBe(true);
  });
});

describe('dragging over the zenith', () => {
  it('never swings the azimuth by more than 90 deg while the view is high', () => {
    const fov = 60, aspect = 1.6;
    let view = horizontalToSky(fz, 180, 75);
    const anchor = ndcToSky(groundCameraBasis(fz, view.ra, view.dec), 0, 0.6, fov, aspect);
    let prev = skyToHorizontal(fz, view.ra, view.dec);
    let rejected = 0;
    for (let y = 0.6; y > -1; y -= 0.05) {
      const sol = solveGroundGrab(fz, anchor, 0, y, fov, aspect, view);
      if (!sol) continue;
      if (!groundGrabAccepted(fz, view, sol)) { rejected++; continue; }
      view = sol;
      const h = skyToHorizontal(fz, view.ra, view.dec);
      if (h.altDeg > 80) expect(angDiff(h.azDeg, prev.azDeg)).toBeLessThanOrEqual(90);
      prev = h;
    }
    expect(rejected).toBeGreaterThan(0); // the flip over the zenith was met and refused
    expect(angDiff(prev.azDeg, 180)).toBeLessThan(5);
  });
  it('accepts ordinary moves at low altitude, even large ones', () => {
    expect(groundGrabAccepted(fz, horizontalToSky(fz, 10, 20), horizontalToSky(fz, 170, 25))).toBe(true);
  });
});

describe('skyline', () => {
  it('is deterministic, periodic and inside its bounds', () => {
    let max = 0, min = 99;
    for (let a = -400; a < 760; a += 0.05) {
      const h = skylineHeightDeg(a);
      expect(h).toBe(skylineHeightDeg(a));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(SKYLINE_MAX_DEG);
      max = Math.max(max, h); min = Math.min(min, h);
    }
    expect(skylineHeightDeg(30)).toBeCloseTo(skylineHeightDeg(390), 9);
    expect(max).toBeGreaterThan(min + 1); // it is not flat
  });
});
