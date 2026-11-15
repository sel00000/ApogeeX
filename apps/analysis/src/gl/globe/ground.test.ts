// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// The ground of the sky map: mesh geometry, placement, the remembered switch, first-visit view.
// Ported from TrueBlink (tests/ground.test.ts, Apache-2.0): the ground mesh part. The app-side parts
// (TrueBlink's remembered switch and first-visit view) are not used here; see lib/skyView.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { GROUND_ORDER, GLOW_ORDER, SKYLINE_STEP_DEG, createGround, localDir } from './ground';
import { SEOUL, SKYLINE_MAX_DEG, horizontalToVec, observerFrame, skyToHorizontal, skylineHeightDeg } from './horizon';
import type { Mesh, BufferGeometry } from 'three';

const COLORS = { rim: '#0c1322', mid: '#080d18', deep: '#04060c', glow: '#6479b4' };
const T0 = Date.parse('2026-11-14T12:30:00Z'); // 21:30 KST

describe('ground geometry', () => {
  const g = createGround(COLORS);
  const [glow, ground] = g.group.children as Mesh<BufferGeometry>[];
  const pos = ground.geometry.getAttribute('position');

  it('draws the glow under the grid and the ground over it, in two draw calls', () => {
    expect(g.group.children.length).toBe(2);
    expect(glow.renderOrder).toBe(GLOW_ORDER);
    expect(ground.renderOrder).toBe(GROUND_ORDER);
    expect(GLOW_ORDER).toBeLessThan(100);
    expect(GROUND_ORDER).toBeGreaterThan(100);
  });

  it('has the skyline as its top ring: every top vertex is at skylineHeightDeg, inside 0..max', () => {
    const n = Math.round(360 / SKYLINE_STEP_DEG);
    let worst = 0;
    for (let i = 0; i <= n; i += 7) {
      const az = (i * 360) / n;
      const alt = Math.asin(pos.getY(i)) / (Math.PI / 180);
      worst = Math.max(worst, Math.abs(alt - skylineHeightDeg(az)));
      expect(alt).toBeGreaterThanOrEqual(-1e-9);
      expect(alt).toBeLessThanOrEqual(SKYLINE_MAX_DEG + 1e-9);
    }
    expect(worst).toBeLessThan(1e-5);
    // the ring closes without a seam: the last column equals the first
    expect(pos.getX(n)).toBeCloseTo(pos.getX(0), 6);
    expect(pos.getZ(n)).toBeCloseTo(pos.getZ(0), 6);
  });

  it('has finite unit-length vertices and in-range indices', () => {
    for (let i = 0; i < pos.count; i += 3) {
      const l = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      expect(Number.isFinite(l)).toBe(true);
      expect(l).toBeCloseTo(1, 6);
    }
    const idx = ground.geometry.getIndex()!;
    let max = 0;
    for (let i = 0; i < idx.count; i += 11) max = Math.max(max, idx.getX(i));
    expect(max).toBeLessThan(pos.count);
  });

  it('has a glow that is strongest at the horizon and gone at the top', () => {
    const a = glow.geometry.getAttribute('color');
    const cols = 361;
    const rings = a.count / cols;
    expect(a.getW(0)).toBeGreaterThan(0.4);
    for (let r = 1; r < rings; r++) expect(a.getW(r * cols)).toBeLessThanOrEqual(a.getW((r - 1) * cols));
    expect(a.getW((rings - 1) * cols)).toBe(0);
  });

  it('is placed by a proper rotation: local (east, zenith, -north) map to the observer frame', () => {
    const f = observerFrame(T0, SEOUL);
    g.setFrame(f);
    expect(g.group.visible).toBe(true);
    const m = g.group.matrix;
    expect(m.determinant()).toBeCloseTo(1, 9);
    // a local direction for (az, alt) lands exactly where horizontalToVec puts it
    for (const [az, alt] of [[0, 0], [90, 10], [180, 25], [270, -30], [33, 70]]) {
      const l = localDir(az, alt);
      const w = new Vector3(...l).applyMatrix4(m);
      const v = horizontalToVec(f, az, alt);
      expect(Math.hypot(w.x - v[0], w.y - v[1], w.z - v[2])).toBeLessThan(1e-9);
    }
    // the ground's nadir points at minus zenith, so the dome is below the horizon of the site
    const nadir = new Vector3(0, -1, 0).applyMatrix4(m);
    expect(nadir.x * f.zenith[0] + nadir.y * f.zenith[1] + nadir.z * f.zenith[2]).toBeCloseTo(-1, 9);
  });

  it('disposes without throwing', () => {
    expect(() => g.dispose()).not.toThrow();
  });
});

