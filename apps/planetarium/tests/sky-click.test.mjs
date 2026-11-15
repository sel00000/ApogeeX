import assert from 'node:assert/strict';
import test from 'node:test';
import { targetAtSkyPoint, viewDirectionAtPoint } from '../src/sky-click.js';

const stereo = { width: 1000, height: 1000, fov: Math.PI, projection: 2 };
const allsky = { width: 1000, height: 500, fov: 2 * Math.PI, projection: 5 };

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Number.isFinite(actual), `Expected finite number, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

function direction(actual, expected) {
  assert.ok(actual, 'Expected a valid sky direction');
  assert.equal(actual.length, 4);
  actual.forEach((value, index) => close(value, expected[index]));
  close(Math.hypot(...actual.slice(0, 3)), 1);
  assert.equal(actual[3], 0, 'A sky direction must be at infinity');
}

test('the center of either projection points straight into the displayed sky', () => {
  direction(viewDirectionAtPoint({ ...stereo, x: 500, y: 500 }), [0, 0, -1, 0]);
  direction(viewDirectionAtPoint({ ...allsky, x: 500, y: 250 }), [0, 0, -1, 0]);
});

test('stereographic off-center pixels resolve to different unit vectors instead of the screen center', () => {
  direction(viewDirectionAtPoint({ ...stereo, x: 750, y: 500 }), [0.8, 0, -0.6, 0]);
  direction(viewDirectionAtPoint({ ...stereo, x: 500, y: 250 }), [0, 0.8, -0.6, 0]);
});

test('stereographic field of view is measured along the shorter canvas dimension', () => {
  const portrait = { ...stereo, width: 500, height: 1000 };
  const landscape = { ...stereo, width: 1000, height: 500 };
  direction(viewDirectionAtPoint({ ...portrait, x: 375, y: 500 }), [0.8, 0, -0.6, 0]);
  direction(viewDirectionAtPoint({ ...landscape, x: 625, y: 250 }), [0.8, 0, -0.6, 0]);
});

test('Mollweide quarter-width points are the two equatorial 90-degree directions', () => {
  direction(viewDirectionAtPoint({ ...allsky, x: 750, y: 250 }), [1, 0, 0, 0]);
  direction(viewDirectionAtPoint({ ...allsky, x: 250, y: 250 }), [-1, 0, 0, 0]);
});

test('native JSON rounding of a 360-degree field of view does not disable all-sky clicks', () => {
  // The native property bridge serializes 2π as this slightly larger decimal.
  const nativeFullSky = { ...allsky, fov: 6.28318530718 };
  direction(viewDirectionAtPoint({ ...nativeFullSky, x: 500, y: 250 }), [0, 0, -1, 0]);
  direction(viewDirectionAtPoint({ ...nativeFullSky, x: 750, y: 250 }), [1, 0, 0, 0]);
  direction(viewDirectionAtPoint({ ...nativeFullSky, x: 250, y: 250 }), [-1, 0, 0, 0]);
  assert.equal(viewDirectionAtPoint({ ...nativeFullSky, fov: 2 * Math.PI + 1e-6, x: 500, y: 250 }), null,
    'A genuinely oversized field of view must still be rejected');
});

test('Mollweide handles the poles and both sides of the longitude seam without NaN', () => {
  direction(viewDirectionAtPoint({ ...allsky, x: 500, y: 0 }), [0, 1, 0, 0]);
  direction(viewDirectionAtPoint({ ...allsky, x: 500, y: 500 }), [0, -1, 0, 0]);
  direction(viewDirectionAtPoint({ ...allsky, x: 0, y: 250 }), [0, 0, 1, 0]);
  direction(viewDirectionAtPoint({ ...allsky, x: 1000, y: 250 }), [0, 0, 1, 0]);
});

test('Mollweide rejects the rectangular canvas corners instead of snapping them to the ellipse edge', () => {
  for (const [x, y] of [[0, 0], [999, 1], [1, 499], [999, 499], [900, 50]]) {
    assert.equal(viewDirectionAtPoint({ ...allsky, x, y }), null);
  }
});

test('Mollweide respects portrait letterboxing and the zoomed field of view', () => {
  const portrait = { ...allsky, width: 500, height: 1000 };
  direction(viewDirectionAtPoint({ ...portrait, x: 250, y: 375 }), [0, 1, 0, 0]);
  assert.equal(viewDirectionAtPoint({ ...portrait, x: 250, y: 300 }), null);
  direction(viewDirectionAtPoint({ ...allsky, fov: Math.PI, x: 750, y: 250 }), [Math.SQRT1_2, 0, -Math.SQRT1_2, 0]);
});

test('horizontal and vertical view flips match the rendered orientation', () => {
  for (const layout of [stereo, allsky]) {
    const point = { ...layout, x: layout.width * 0.6, y: layout.height * 0.4 };
    const normal = viewDirectionAtPoint(point);
    direction(viewDirectionAtPoint({ ...point, flipHorizontal: true }), [-normal[0], normal[1], normal[2], 0]);
    direction(viewDirectionAtPoint({ ...point, flipVertical: true }), [normal[0], -normal[1], normal[2], 0]);
  }
});

test('invalid dimensions, coordinates, field of view, and unknown projections produce no target', () => {
  const valid = { ...stereo, x: 500, y: 500 };
  for (const change of [
    { width: 0 }, { height: -1 }, { width: NaN }, { height: Infinity },
    { x: NaN }, { y: Infinity }, { x: -1 }, { x: 1001 }, { y: -1 }, { y: 1001 },
    { fov: 0 }, { fov: -1 }, { fov: NaN }, { fov: Infinity }, { projection: 99 },
  ]) assert.equal(viewDirectionAtPoint({ ...valid, ...change }), null, JSON.stringify(change));
});

function engineFixture() {
  const calls = [];
  const observer = { name: 'current observer' };
  const engine = {
    observer,
    core: {
      fov: Math.PI,
      projection: 2,
      flip_view_horizontal: false,
      flip_view_vertical: false,
      get selection() { assert.fail('Pixel targeting must not use a previously selected or nearby object'); },
    },
    convertFrame(obs, from, to, vector) {
      calls.push({ obs, from, to, vector });
      return [0, -Math.SQRT1_2, Math.SQRT1_2, 0];
    },
  };
  const canvas = {
    // A 3x framebuffer must not affect coordinates expressed in CSS pixels.
    width: 3000, height: 3000,
    getBoundingClientRect: () => ({ left: 100, top: 60, width: 1000, height: 1000 }),
  };
  return { engine, canvas, calls, observer };
}

test('click targeting converts canvas-local CSS pixels through the current observer to astrometric ICRS degrees', () => {
  const f = engineFixture();
  const target = targetAtSkyPoint(f.engine, { x: 750, y: 500 }, f.canvas);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].obs, f.observer);
  assert.equal(f.calls[0].from, 'VIEW');
  assert.equal(f.calls[0].to, 'ASTROM');
  direction(f.calls[0].vector, [0.8, 0, -0.6, 0]);
  close(target.ra, 270);
  close(target.dec, 45);
  assert.equal(target.label, 'Clicked sky region');
});

test('an invalid map point never reaches the frame converter or silently targets the center', () => {
  const f = engineFixture();
  f.engine.core.projection = 5;
  f.engine.core.fov = 2 * Math.PI;
  assert.equal(targetAtSkyPoint(f.engine, { x: 0, y: 0 }, f.canvas), null);
  assert.equal(f.calls.length, 0);
});
