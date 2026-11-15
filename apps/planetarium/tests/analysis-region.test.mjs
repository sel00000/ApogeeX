import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldRegionAroundTarget, projectViewDirection, tangentFieldDirection } from '../src/analysis-region.js';
import { targetAtSkyPoint, viewDirectionAtPoint } from '../src/sky-click.js';

function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

function fixture({ ra = 0, dec = 0, projection = 2, fov = Math.PI / 180, width = 1000, height = 800 } = {}) {
  const a = ra * Math.PI / 180, d = dec * Math.PI / 180;
  const center = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const east = [-Math.sin(a), Math.cos(a), 0];
  const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const dot = (p, q) => p.reduce((sum, v, i) => sum + v * q[i], 0);
  const engine = {
    core: { fov, projection }, observer: {},
    convertFrame(_observer, from, to, vector) {
      const v = Array.from(vector).slice(0, 3);
      if (from === 'ASTROM' && to === 'VIEW') return [-dot(v, east), dot(v, north), -dot(v, center), 0];
      assert.equal(from, 'VIEW'); assert.equal(to, 'ASTROM');
      return [...center.map((n, i) => -v[2] * n - v[0] * east[i] + v[1] * north[i]), 0];
    },
  };
  const canvas = { getBoundingClientRect: () => ({ width, height, left: 30, top: 70 }) };
  return { engine, canvas, target: { ra, dec, label: '분석 영역' } };
}

test('forward projection round-trips canvas positions for both projections, portrait and flipped views', () => {
  for (const projection of [2, 5]) for (const [width, height] of [[1000, 800], [600, 1000]]) {
    for (const flipHorizontal of [false, true]) for (const flipVertical of [false, true]) {
      const settings = { width, height, projection, fov: Math.PI, flipHorizontal, flipVertical };
      for (const [fx, fy] of [[.5, .5], [.35, .42], [.7, .6]]) {
        const x = width * fx, y = height * fy;
        const v = viewDirectionAtPoint({ ...settings, x, y });
        assert.ok(v);
        const p = projectViewDirection(v, settings);
        close(p.x, x); close(p.y, y);
      }
    }
  }
});

test('north-up field corners project around the exact cursor target with the requested TAN side', () => {
  const f = fixture();
  const point = { x: 620, y: 325 };
  const target = targetAtSkyPoint(f.engine, point, f.canvas);
  const region = fieldRegionAroundTarget(f.engine, target, f.canvas, 180);
  assert.equal(region.target.fovArcsec, 180);
  assert.equal(region.points.length, 32);
  close(region.center.x, point.x); close(region.center.y, point.y);
  assert.ok(region.width > 39 && region.width < 41);
  assert.ok(region.height > 39 && region.height < 41);
  const [eastNorth, westNorth, westSouth, eastSouth] = region.corners;
  assert.ok(eastNorth.x < westNorth.x && eastNorth.y < eastSouth.y);
  assert.ok(westSouth.x > eastSouth.x && westSouth.y > westNorth.y);
});

test('doubling the requested sky side doubles the visible region rather than fixing the cursor size', () => {
  const f = fixture();
  const small = fieldRegionAroundTarget(f.engine, f.target, f.canvas, 180);
  const large = fieldRegionAroundTarget(f.engine, f.target, f.canvas, 360);
  close(large.width / small.width, 2, 1e-6);
  close(large.height / small.height, 2, 1e-6);
  const zoomedOut = fixture({ fov: 60 * Math.PI / 180 });
  const tiny = fieldRegionAroundTarget(zoomedOut.engine, zoomedOut.target, zoomedOut.canvas, 180);
  assert.ok(tiny.width < 1, 'A tiny angular field must not pretend to cover a large screen square');
});

test('RA wrap and celestial poles retain finite, properly centered field geometry', () => {
  for (const [ra, dec] of [[359.999, 15], [0.001, -15], [110, 90], [270, -90], [359.99, 89.999]]) {
    const f = fixture({ ra, dec });
    const region = fieldRegionAroundTarget(f.engine, f.target, f.canvas, 780);
    assert.ok(region);
    close(region.center.x, 500); close(region.center.y, 400);
    assert.ok(region.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(region.width > 170 && region.width < 175);
  }
});

test('tangent directions match TAN coordinates at equator and are directions at infinity', () => {
  const v = tangentFieldDirection({ ra: 0, dec: 0 }, 90, 90);
  close(Math.hypot(...v.slice(0, 3)), 1);
  close(v[1] / v[0] * 180 * 3600 / Math.PI, 90);
  close(v[2] / v[0] * 180 * 3600 / Math.PI, 90);
  assert.equal(v[3], 0);
});

test('all-sky center region works, but a field crossing the map seam never draws across the map', () => {
  const f = fixture({ projection: 5, fov: 2 * Math.PI, width: 1000, height: 500 });
  assert.ok(fieldRegionAroundTarget(f.engine, f.target, f.canvas));
  assert.equal(fieldRegionAroundTarget(f.engine, { ra: 180, dec: 0 }, f.canvas), null);
  assert.equal(fieldRegionAroundTarget(f.engine, { ra: 179.99, dec: 0 }, f.canvas), null);
  const side = fieldRegionAroundTarget(f.engine, { ra: 179, dec: 0 }, f.canvas);
  assert.ok(side && side.width < 1);
});

test('Mollweide poles and stereographic antipode are handled without nonfinite pixels', () => {
  const layout = { width: 1000, height: 500, projection: 5, fov: 2 * Math.PI };
  close(projectViewDirection([0, 1, 0, 0], layout).y, 0);
  close(projectViewDirection([0, -1, 0, 0], layout).y, 500);
  assert.equal(projectViewDirection([0, 0, 1, 0], { ...layout, projection: 2 }), null);
});

test('invalid field requests and conversion failures cannot create an analysis region', () => {
  const f = fixture();
  for (const side of [0, 59, 781, NaN, Infinity]) {
    assert.equal(fieldRegionAroundTarget(f.engine, f.target, f.canvas, side), null);
  }
  for (const target of [null, { ra: NaN, dec: 0 }, { ra: 0, dec: 91 }]) {
    assert.equal(fieldRegionAroundTarget(f.engine, target, f.canvas), null);
  }
  f.engine.convertFrame = () => { throw new Error('observer unavailable'); };
  assert.equal(fieldRegionAroundTarget(f.engine, f.target, f.canvas), null);
  assert.equal(projectViewDirection([0, 0, 0], { width: 1, height: 1, fov: 1, projection: 2 }), null);
});
