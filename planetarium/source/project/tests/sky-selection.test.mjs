import assert from 'node:assert/strict';
import test from 'node:test';
import { selectObjectAtPoint } from '../src/sky-selection.js';

function setup(picked = { name: 'Sirius' }) {
  const calls = [];
  const engine = {
    canvas: { getBoundingClientRect: () => ({ width: 1000, height: 600 }) },
    core: { on_click: '0x23a', selection: { name: 'previous' }, fov: 1, lock: null },
    _core_on_mouse(...args) {
      assert.equal(this, engine, 'native functions keep the engine receiver');
      assert.equal(this.core.on_click, 0, 'the native default picker must run');
      calls.push(args);
      if (args[1] === 0) this.core.selection = picked;
    },
    pointAndLock() { assert.fail('ordinary selection must not recenter'); },
    lookAt() { assert.fail('ordinary selection must not recenter'); },
    zoomTo() { assert.fail('ordinary selection must not zoom'); },
  };
  return { engine, calls, picked };
}

test('a complete stationary click selects the exact native object at CSS pixel coordinates', () => {
  const h = setup();
  assert.equal(selectObjectAtPoint(h.engine, { x: 301.25, y: 127.5 }), h.picked);
  assert.deepEqual(h.calls, [[0, 1, 301.25, 127.5, 1], [0, 0, 301.25, 127.5, 1]]);
  assert.equal(h.engine.core.on_click, '0x23a');
  assert.equal(h.engine.core.fov, 1);
  assert.equal(h.engine.core.lock, null);
});

test('constellation labels returned by the native picker remain selectable objects', () => {
  const constellation = { designations: () => ['CON western Ori'], getInfo: () => undefined };
  const h = setup(constellation);
  assert.equal(selectObjectAtPoint(h.engine, { x: 500, y: 300 }), constellation);
  assert.equal(h.engine.core.selection, constellation);
});

test('a blank-sky click clears a prior selection using the native picker', () => {
  const h = setup(null);
  assert.equal(selectObjectAtPoint(h.engine, { x: 100, y: 100 }), null);
  assert.equal(h.engine.core.selection, null);
  assert.equal(h.engine.core.on_click, '0x23a');
});

test('invalid or off-canvas coordinates do not inject inputs or change selection', () => {
  const h = setup();
  const original = h.engine.core.selection;
  for (const point of [null, {}, { x: NaN, y: 0 }, { x: 0, y: Infinity },
    { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1001, y: 1 }, { x: 1, y: 601 }]) {
    assert.equal(selectObjectAtPoint(h.engine, point), null);
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.engine.core.selection, original);
  assert.equal(h.engine.core.on_click, '0x23a');
});

test('a collapsed canvas and unavailable engines are ignored', () => {
  const h = setup();
  h.engine.canvas.getBoundingClientRect = () => ({ width: 0, height: 600 });
  assert.equal(selectObjectAtPoint(h.engine, { x: 0, y: 0 }), null);
  for (const engine of [null, {}, { core: {} }]) {
    assert.equal(selectObjectAtPoint(engine, { x: 0, y: 0 }), null);
  }
  assert.equal(h.calls.length, 0);
});

test('a native failure still releases the contact and restores the original callback pointer', () => {
  const h = setup();
  h.engine._core_on_mouse = (...args) => {
    h.calls.push(args);
    if (args[1] === 1) throw new Error('native listener failed');
  };
  assert.throws(() => selectObjectAtPoint(h.engine, { x: 10, y: 20 }), /native listener failed/);
  assert.deepEqual(h.calls, [[0, 1, 10, 20, 1], [0, 0, 10, 20, 1]]);
  assert.equal(h.engine.core.on_click, '0x23a');
});

test('a release failure also restores the callback pointer, including zero', () => {
  const h = setup();
  h.engine.core.on_click = 0;
  h.engine._core_on_mouse = (_id, state) => { if (state === 0) throw new Error('release failed'); };
  assert.throws(() => selectObjectAtPoint(h.engine, { x: 10, y: 20 }), /release failed/);
  assert.equal(h.engine.core.on_click, 0);
});
