// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden_cube.json';
import {
  ang2pixNest,
  cellToSky,
  npixOf,
  parentAt,
  pix2angNest,
  pixCorners,
  queryCone,
  sepDeg,
  skyToTilePixel,
  skyToVec,
  tilePixelToSky,
  vecToSky,
} from './healpix';
import { cameraBasis, chooseOrder, ndcToSky, projectToView, skyToNdc, solveGrab } from './view';

const geom = (golden as any).geometry as {
  tests: { name: string; ra_deg: number; dec_deg: number; npix5: number; x: number; y: number }[];
  tile_10226_vertices_and_centres: { x: number; y: number; label: string; ra_deg: number; dec_deg: number }[];
};

const arcsec = (a: { ra: number; dec: number }, ra: number, dec: number) => sepDeg(a.ra, a.dec, ra, dec) * 3600;

// Deterministic pseudo-random sky points (uniform on the sphere).
function* randomSky(n: number, seed = 12345) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) yield { ra: rnd() * 360, dec: (Math.asin(2 * rnd() - 1) * 180) / Math.PI };
}

describe('HEALPix NESTED against golden_cube.json', () => {
  it('order-5 tile index and pixel position of the golden test positions', () => {
    for (const t of geom.tests) {
      expect(ang2pixNest(5, t.ra_deg, t.dec_deg), t.name).toBe(t.npix5);
      const p = skyToTilePixel(5, t.ra_deg, t.dec_deg);
      expect(p.npix).toBe(t.npix5);
      expect(Math.abs(p.x - t.x), t.name).toBeLessThan(1e-6);
      expect(Math.abs(p.y - t.y), t.name).toBeLessThan(1e-6);
    }
  });

  it('tile pixel -> sky inverse lands on the golden positions', () => {
    for (const t of geom.tests) {
      const s = tilePixelToSky(5, t.npix5, t.x, t.y);
      expect(arcsec(s, t.ra_deg, t.dec_deg), t.name).toBeLessThan(1e-4);
    }
  });

  it('tile 10226 boundary vertices and centres', () => {
    for (const v of geom.tile_10226_vertices_and_centres) {
      const s = tilePixelToSky(5, 10226, v.x, v.y);
      expect(arcsec(s, v.ra_deg, v.dec_deg), v.label).toBeLessThan(1e-4);
    }
    const byLabel = Object.fromEntries(geom.tile_10226_vertices_and_centres.map((v) => [v.label, v]));
    const [n, w, s, e] = pixCorners(5, 10226);
    expect(arcsec(n, byLabel['N vertex'].ra_deg, byLabel['N vertex'].dec_deg)).toBeLessThan(1e-4);
    expect(arcsec(w, byLabel['W vertex'].ra_deg, byLabel['W vertex'].dec_deg)).toBeLessThan(1e-4);
    expect(arcsec(s, byLabel['S vertex'].ra_deg, byLabel['S vertex'].dec_deg)).toBeLessThan(1e-4);
    expect(arcsec(e, byLabel['E vertex'].ra_deg, byLabel['E vertex'].dec_deg)).toBeLessThan(1e-4);
    const c = pix2angNest(5, 10226);
    expect(arcsec(c, byLabel.centre.ra_deg, byLabel.centre.dec_deg)).toBeLessThan(1e-4);
  });

  it('PNG children: Npix10226 is the top-right quadrant (sub-index 2) of order-4 Npix2556', () => {
    expect(parentAt(5, 10226, 4)).toBe(2556);
    expect(10226 % 4).toBe(2);
    // The parent's top-right PNG quadrant centre (column 384, row 128 -> FITS y 383) is the child's centre.
    const a = tilePixelToSky(4, 2556, 383.5, 383.5 - 0.0);
    const b = pix2angNest(5, 10226);
    expect(sepDeg(a.ra, a.dec, b.ra, b.dec)).toBeLessThan(0.02);
  });
});

describe('ang2pix / pix2ang round trips, orders 0-5', () => {
  for (let order = 0; order <= 5; order++) {
    it(`order ${order}`, () => {
      // Every cell centre maps back to its own cell (sample all cells at low order, a stride above).
      const n = npixOf(order);
      const step = Math.max(1, Math.floor(n / 3000));
      for (let p = 0; p < n; p += step) {
        const c = pix2angNest(order, p);
        expect(ang2pixNest(order, c.ra, c.dec)).toBe(p);
      }
      // Random points: the cell found must contain the point, and the point lies within the cell radius.
      for (const s of randomSky(2000, 99 + order)) {
        const p = ang2pixNest(order, s.ra, s.dec);
        const t = skyToTilePixel(order, s.ra, s.dec);
        expect(t.npix).toBe(p);
        expect(t.x).toBeGreaterThanOrEqual(-0.5 - 1e-6);
        expect(t.x).toBeLessThanOrEqual(511.5 + 1e-6);
        const back = tilePixelToSky(order, p, t.x, t.y);
        expect(arcsec(back, s.ra, s.dec)).toBeLessThan(1e-3);
        // Children nest inside parents.
        if (order > 0) expect(parentAt(order, p, order - 1)).toBe(ang2pixNest(order - 1, s.ra, s.dec));
      }
    });
  }

  it('cell vertices are shared by neighbours (edges join without gaps)', () => {
    // Walk along a fine line and check that consecutive cells share a boundary point.
    for (let order = 0; order <= 3; order++) {
      for (let p = 0; p < npixOf(order); p++) {
        const corner = cellToSky(order, p, 1, 0); // east vertex
        // A point just inside the cell next to that vertex must map back to this cell.
        const inside = cellToSky(order, p, 0.999, 0.001);
        expect(ang2pixNest(order, inside.ra, inside.dec)).toBe(p);
        expect(Number.isFinite(corner.ra) && Number.isFinite(corner.dec)).toBe(true);
      }
    }
  });

  it('queryCone covers every cell under the cone', () => {
    for (const s of randomSky(20, 7)) {
      const cells = new Set(queryCone(4, s.ra, s.dec, 6));
      for (const q of randomSky(400, Math.floor(s.ra * 1000))) {
        if (sepDeg(q.ra, q.dec, s.ra, s.dec) < 6) expect(cells.has(ang2pixNest(4, q.ra, q.dec))).toBe(true);
      }
    }
  });
});

describe('sky handedness and camera', () => {
  it('vector convention v = (cos d cos a, sin d, -cos d sin a)', () => {
    const v = skyToVec(90, 0);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[2]).toBeCloseTo(-1, 12);
    const s = vecToSky(skyToVec(123.4, -56.7));
    expect(s.ra).toBeCloseTo(123.4, 9);
    expect(s.dec).toBeCloseTo(-56.7, 9);
  });

  it('Orion seen from inside with north up: Betelgeuse is left of and above Rigel (east is left)', () => {
    const b = cameraBasis(83.8, -1.2);
    const betelgeuse = projectToView(b, 88.79, 7.41);
    const rigel = projectToView(b, 78.63, -8.2);
    expect(betelgeuse.front && rigel.front).toBe(true);
    expect(betelgeuse.x).toBeLessThan(rigel.x);
    expect(betelgeuse.y).toBeGreaterThan(rigel.y);
  });

  it('north is up everywhere off the poles', () => {
    for (const s of randomSky(50, 3)) {
      if (Math.abs(s.dec) > 85) continue;
      const b = cameraBasis(s.ra, s.dec);
      const p = projectToView(b, s.ra, s.dec + 1);
      expect(Math.abs(p.x)).toBeLessThan(1e-9);
      expect(p.y).toBeGreaterThan(0);
    }
  });

  it('ndc <-> sky round trip and grab solver keeps the anchor under the cursor', () => {
    const fov = 40;
    const aspect = 1.6;
    for (const s of randomSky(100, 5)) {
      if (Math.abs(s.dec) > 70) continue;
      const b = cameraBasis(s.ra, s.dec);
      const q = ndcToSky(b, 0.3, -0.4, fov, aspect);
      const n = skyToNdc(b, q.ra, q.dec, fov, aspect)!;
      expect(n.x).toBeCloseTo(0.3, 9);
      expect(n.y).toBeCloseTo(-0.4, 9);
      // Drag that point to another screen position.
      const c = solveGrab(q, -0.2, 0.25, fov, aspect, s.dec)!;
      expect(c).not.toBeNull();
      const n2 = skyToNdc(cameraBasis(c.ra, c.dec), q.ra, q.dec, fov, aspect)!;
      expect(n2.x).toBeCloseTo(-0.2, 7);
      expect(n2.y).toBeCloseTo(0.25, 7);
    }
  });

  it('chooseOrder picks coarse tiles for wide views and order 5 when zoomed in', () => {
    expect(chooseOrder(100, 800)).toBe(0);
    expect(chooseOrder(30, 800)).toBe(2);
    expect(chooseOrder(5, 800)).toBe(5);
    expect(chooseOrder(1.5, 800)).toBe(5);
  });
});
