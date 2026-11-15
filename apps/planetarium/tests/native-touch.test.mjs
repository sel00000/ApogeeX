import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { loadEngine } from '../scripts/check-astrometry.mjs';
import { targetAtSkyPoint } from '../src/sky-click.js';

const source = await readFile(new URL('../vendor/stellarium-web-engine/src/js/canvas.js', import.meta.url), 'utf8');
const degrees = radians => radians * 180 / Math.PI;

// Exercise the browser event bridge and the delivered native gesture code.
// The DOM/RAF are minimal surfaces; core_on_mouse and projection are real WASM.
async function harness() {
  const engine = await loadEngine();
  engine.core.time_speed = 0;
  engine.core.projection = 2;
  engine.core.fov = Math.PI / 3;
  const events = new Map();
  const page = new Map();
  const documentEvents = new Map();
  const canvas = {
    width: 800, height: 600,
    getBoundingClientRect: () => ({ left: 20, top: 30, width: 800, height: 600 }),
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const bridge = {
    canvas, afterInit: fn => fn(),
    _core_on_mouse: engine._core_on_mouse,
    _core_on_zoom: engine._core_on_zoom,
  };
  const document = { hidden: false, addEventListener: (name, fn) => documentEvents.set(name, fn) };
  vm.runInNewContext(source, { Module: bridge, document, window: {
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    addEventListener: (name, fn) => page.set(name, fn),
  } });
  const touch = (id, x, y = 100) => ({ identifier: id, clientX: x + 20, clientY: y + 30,
    // Page scrolling must not move contacts relative to a viewport rectangle.
    pageX: x + 120, pageY: y + 230 });
  const emit = (name, ts) => events.get(name)?.({ changedTouches: ts, preventDefault() {} });
  const pinch = (id, endX) => {
    emit('touchstart', [touch(id, 100), touch(id + 1, 300)]);
    emit('touchmove', [touch(id + 1, endX)]);
  };
  return { engine, canvas, bridge, events, page, documentEvents, document, touch, emit, pinch,
    fov: () => degrees(engine.core.fov) };
}

test('touchcancel frees both native contacts and a new gesture works without a synthetic click', async () => {
  const h = await harness();
  h.pinch(100, 200);
  assert(Math.abs(h.fov() - 120) < 1e-7);
  const clicks = h.engine.core.clicks;
  assert(Number.isFinite(clicks), 'native click counter must be observable');
  h.emit('touchcancel', [h.touch(100, 100), h.touch(101, 200)]);
  assert.equal(h.engine.core.clicks, clicks);
  h.engine.core.fov = Math.PI / 3;
  h.pinch(200, 200);
  assert(Math.abs(h.fov() - 120) < 1e-7, 'new identifiers must not be blocked by cancelled native slots');
  h.emit('touchcancel', [h.touch(200, 100), h.touch(201, 200)]);
  // A cancelled single contact must not become a selection click either.
  h.emit('touchstart', [h.touch(300, 200)]);
  h.emit('touchcancel', [h.touch(300, 200)]);
  assert.equal(h.engine.core.clicks, clicks);
});

test('pause, pagehide, blur and hidden document release touch state and ignore stale moves', async () => {
  const h = await harness();
  const cancellations = [
    () => { h.bridge.setRenderPaused(true); h.bridge.setRenderPaused(false); },
    () => h.page.get('pagehide')(),
    () => h.page.get('blur')(),
    () => { h.document.hidden = true; h.documentEvents.get('visibilitychange')(); h.document.hidden = false; },
  ];
  let id = 1000;
  for (const cancel of cancellations) {
    h.engine.core.fov = Math.PI / 3;
    h.pinch(id, 200);
    cancel();
    h.emit('touchmove', [h.touch(id + 1, 101)]);
    assert(Math.abs(h.fov() - 120) < 1e-7, 'cancelled old contacts must not reenter native input');
    h.engine.core.fov = Math.PI / 3;
    id += 10;
    h.pinch(id, 200);
    assert(Math.abs(h.fov() - 120) < 1e-7);
    h.emit('touchcancel', [h.touch(id, 100), h.touch(id + 1, 200)]);
    id += 10;
  }
});

test('pinch stays inside the stereographic UI domain and clicks remain invertible', async () => {
  const h = await harness();
  h.pinch(400, 120); // 200px -> 20px used to set600deg, then singular360deg.
  assert(h.fov() <= 185.000001 && h.fov() > 100);
  h.engine._core_update();
  assert(h.fov() <= 185.000001);
  const target = targetAtSkyPoint(h.engine, { x: 400, y: 300 }, h.canvas);
  assert(target && Number.isFinite(target.ra) && Number.isFinite(target.dec));
  const before = h.fov();
  h.emit('touchmove', [h.touch(401, 100)]); // Coincident fingers.
  assert.equal(h.fov(), before);
  h.emit('touchmove', [h.touch(401, 1e9)]);
  assert(h.fov() >= 1 / 3600 - 1e-10, 'the shared minimum field applies to pinch zoom');
  h.emit('touchcancel', [h.touch(400, 100), h.touch(401, 1e9)]);
});

test('pinch uses the full-sky projection own valid limit', async () => {
  const h = await harness();
  h.engine.core.projection = 5;
  h.pinch(500, 120);
  assert(Math.abs(h.fov() - 360) < 1e-7, 'Mollweide must retain its valid360deg overview');
  const target = targetAtSkyPoint(h.engine, { x: 400, y: 300 }, h.canvas);
  assert(target && Number.isFinite(target.ra) && Number.isFinite(target.dec));
  h.emit('touchcancel', [h.touch(500, 100), h.touch(501, 120)]);
});
