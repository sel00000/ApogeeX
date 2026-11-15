import assert from 'node:assert/strict';
import test from 'node:test';
import { bindSkyClickAnalysis } from '../src/sky-click.js';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type, event) { for (const listener of listeners.get(type) ?? []) listener(event); },
  };
}

function setup(initialMode = true) {
  const document = eventTarget();
  const canvas = {
    ...eventTarget(), ownerDocument: document,
    getBoundingClientRect: () => ({ left: 100, top: 60, width: 1000, height: 1000 }),
  };
  const nativeHandlers = new Map();
  const opened = [];
  const selected = [];
  const star = { name: 'Sirius' };
  let allowed = true;
  let analysisMode = initialMode;
  const engine = {
    observer: {},
    core: { projection: 2, fov: Math.PI },
    on(type, callback) { nativeHandlers.set(type, callback); },
    convertFrame(_observer, _from, _to, v) { return [v[0], -v[2], v[1], 0]; },
    _core_on_mouse(_id, state) { if (state === 0 && this.core.on_click === 0) this.core.selection = star; },
  };
  bindSkyClickAnalysis({ engine, canvas, canAnalyze: () => allowed, isAnalysisMode: () => analysisMode,
    onTarget: target => opened.push(target), onSelection: object => selected.push(object) });
  const pointer = (x, y, extra = {}) => ({ pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x + 100, clientY: y + 60, ...extra });
  const click = (x = 750, y = 500, extra = {}) => canvas.emit('click', { clientX: x + 100, clientY: y + 60, button: 0, ...extra });
  const nativeClick = (x = 750, y = 500) => nativeHandlers.get('click')({ point: { x, y } });
  const down = (x = 750, y = 500, extra) => canvas.emit('pointerdown', pointer(x, y, extra));
  const up = (x = 750, y = 500, extra) => document.emit('pointerup', pointer(x, y, extra));
  return { document, canvas, engine, opened, selected, star, pointer, click, nativeClick, down, up,
    mode: value => { analysisMode = value; }, allow: value => { allowed = value; } };
}

test('ordinary clicks select objects, and only the explicit analysis mode opens the workbench', () => {
  const h = setup(false);
  h.down(); h.up(); h.click();
  assert.deepEqual(h.selected, [h.star]);
  assert.equal(h.opened.length, 0);
  h.mode(true);
  h.down(); h.up(); h.click();
  assert.equal(h.selected.length, 1, 'region analysis must not replace the selected object');
  assert.equal(h.opened.length, 1);
  h.mode(false);
  h.down(); h.up(); h.click();
  assert.equal(h.selected.length, 2);
  assert.equal(h.opened.length, 1, 'cancelling the mode restores ordinary picking');
});

test('normal-mode drags and clicks while a modal is open do not select objects', () => {
  const h = setup(false);
  h.down(500, 500); h.up(530, 500); h.click(530, 500);
  h.allow(false); h.down(); h.up(); h.click();
  assert.equal(h.selected.length, 0);
  assert.equal(h.opened.length, 0);
});

test('a short DOM click opens the exact canvas-local coordinates even without a native engine callback', () => {
  const h = setup();
  h.down();
  h.up();
  h.click();
  assert.equal(h.opened.length, 1);
  assert.ok(Math.abs(h.opened[0].ra - 36.86989764584402) < 1e-9);
  assert.equal(h.opened[0].dec, 0);
  assert.equal(h.opened[0].label, 'Clicked sky region');
});

test('the native click callback only consumes nearest-object selection and never opens analysis twice', () => {
  const h = setup();
  h.down(); h.up();
  assert.equal(h.nativeClick(), true);
  assert.equal(h.opened.length, 0);
  h.click();
  assert.equal(h.opened.length, 1);
  assert.equal(h.nativeClick(), true);
  assert.equal(h.opened.length, 1);
});

test('non-primary DOM clicks cannot start an analysis', () => {
  const h = setup();
  for (const button of [1, 2]) {
    h.down(750, 500, { button }); h.up(750, 500, { button });
    h.click(750, 500, { button });
  }
  assert.equal(h.opened.length, 0);
});

test('clicks during loading, view transitions or another modal cannot open analysis', () => {
  const h = setup();
  h.allow(false);
  h.down(); h.up();
  h.click();
  assert.equal(h.opened.length, 0);
  h.allow(true);
  h.down(); h.up(); h.click();
  assert.equal(h.opened.length, 1);
});

test('a click outside the all-sky ellipse does not fall back to the map center', () => {
  const h = setup();
  h.engine.core.projection = 5;
  h.engine.core.fov = 2 * Math.PI;
  h.down(10, 10); h.up(10, 10);
  h.click(10, 10);
  assert.equal(h.opened.length, 0);
});

test('dragging out and back remains a drag even if the browser emits a click at the original position', () => {
  const h = setup();
  h.down(500, 500);
  h.document.emit('pointermove', h.pointer(530, 500));
  h.document.emit('pointermove', h.pointer(500, 500));
  h.up(500, 500); h.click(500, 500);
  assert.equal(h.opened.length, 0);
  h.down(); h.up(); h.click();
  assert.equal(h.opened.length, 1, 'A later independent click must work');
});

test('small normal click jitter is accepted but a displaced release is not', () => {
  const h = setup();
  h.down();
  h.document.emit('pointermove', h.pointer(753, 504));
  h.up(753, 504); h.click(753, 504);
  assert.equal(h.opened.length, 1);
  h.down(500, 500);
  h.up(520, 500); h.click(520, 500);
  assert.equal(h.opened.length, 1, 'The release can be the first reported moved position');
});

test('pointer cancellation cannot open analysis and the next click recovers', () => {
  const h = setup();
  h.down();
  h.document.emit('pointercancel', h.pointer(750, 500));
  h.click();
  assert.equal(h.opened.length, 0);
  h.down(); h.up(); h.click();
  assert.equal(h.opened.length, 1);
});

test('a pinch stays blocked for a synthesized DOM click after touchend, then a fresh tap works', async () => {
  const h = setup();
  h.down(750, 500, { pointerType: 'touch' });
  h.canvas.emit('touchstart', { touches: [{ identifier: 1 }] });
  h.down(790, 500, { pointerType: 'touch', pointerId: 2, isPrimary: false });
  h.canvas.emit('touchstart', { touches: [{ identifier: 1 }, { identifier: 2 }] });
  h.up(790, 500, { pointerType: 'touch', pointerId: 2, isPrimary: false });
  h.canvas.emit('touchend', { touches: [{ identifier: 1 }] });
  h.click();
  h.canvas.emit('touchend', { touches: [] });
  h.up(750, 500, { pointerType: 'touch' });
  h.click();
  assert.equal(h.opened.length, 0);
  await Promise.resolve();
  h.click();
  assert.equal(h.opened.length, 0, 'The browser may synthesize click after the touchend microtask checkpoint');
  h.down(750, 500, { pointerType: 'touch' });
  h.canvas.emit('touchstart', { touches: [{ identifier: 3 }] });
  h.up(750, 500, { pointerType: 'touch' });
  h.canvas.emit('touchend', { touches: [] });
  h.click();
  assert.equal(h.opened.length, 1);
});

test('a cancelled multi-touch gesture remains blocked until its native event completes', async () => {
  const h = setup();
  h.canvas.emit('touchstart', { touches: [{ identifier: 1 }, { identifier: 2 }] });
  h.canvas.emit('touchcancel', { touches: [] });
  h.click();
  assert.equal(h.opened.length, 0);
  await Promise.resolve();
  h.down(); h.up(); h.click();
  assert.equal(h.opened.length, 1);
});
