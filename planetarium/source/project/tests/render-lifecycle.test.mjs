import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../vendor/stellarium-web-engine/src/js/canvas.js', import.meta.url), 'utf8');

function engine() {
  let clock = 0;
  let now = 0;
  let nextId = 1;
  let rect = { left: 0, top: 0, width: 800, height: 600 };
  const callbacks = new Map();
  const events = new Map();
  const calls = { update: 0, render: [], mouse: [] };
  const selected = { id: 'selected-star' };
  const canvas = {
    width: 800, height: 600,
    getBoundingClientRect: () => rect,
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const Module = {
    canvas, maxPixelRatio: 1.5,
    core: { time_speed: 3, selection: selected }, observer: { utc: 100 },
    afterInit: (callback) => callback(),
    _core_update: () => {
      calls.update++;
      // The native core uses elapsed wall-clock time, not the RAF timestamp.
      Module.observer.utc += (now - clock) * Module.core.time_speed;
      clock = now;
      Module.onUpdate?.();
    },
    _core_render: (...args) => calls.render.push(args),
    _core_on_mouse: (...args) => calls.mouse.push(args),
    _core_on_zoom: () => {},
  };
  vm.runInNewContext(source, {
    Module, document: {},
    window: {
      devicePixelRatio: 2,
      requestAnimationFrame: (callback) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => callbacks.delete(id),
    },
  });
  return {
    Module, callbacks, calls, events, selected,
    rect: (value) => { rect = { ...rect, ...value }; },
    tick: (time) => {
      now = time;
      const scheduled = [...callbacks.entries()];
      for (const [id, callback] of scheduled) {
        callbacks.delete(id);
        callback(time * 1000);
      }
    },
  };
}

test('covered sky does no native work and resumes exactly one render loop', () => {
  const e = engine();
  e.tick(1);
  assert.equal(e.calls.update, 1);
  assert.deepEqual(e.calls.render, [[800, 600, 1.5]]);
  assert.equal(e.callbacks.size, 1);
  e.Module.setRenderPaused(true);
  e.Module.setRenderPaused(true);
  assert.equal(e.callbacks.size, 0);
  e.tick(6);
  assert.equal(e.calls.update, 1);
  assert.equal(e.calls.render.length, 1);
  e.Module.setRenderPaused(false);
  e.Module.setRenderPaused(false);
  assert.equal(e.callbacks.size, 1);
  e.tick(6);
  assert.equal(e.calls.update, 2);
  assert.equal(e.calls.render.length, 2);
  assert.equal(e.callbacks.size, 1);
  assert.equal(e.Module.observer.utc, 118); // Existing speed includes the covered interval.
  assert.equal(e.Module.core.time_speed, 3);
  assert.equal(e.Module.core.selection, e.selected);
});

test('pausing before the first paint cancels startup rendering without losing the canvas', () => {
  const e = engine();
  const canvas = e.Module.canvas;
  e.Module.setRenderPaused(true);
  e.tick(1);
  assert.equal(e.calls.update, 0);
  e.Module.setRenderPaused(false);
  e.tick(2);
  assert.equal(e.calls.render.length, 1);
  assert.equal(e.Module.canvas, canvas);
});

test('a zero-size canvas neither redraws nor destroys the previous drawing buffer', () => {
  const e = engine();
  e.rect({ width: 0, height: 0 });
  e.tick(1);
  assert.equal(e.calls.update, 0);
  assert.equal(e.calls.render.length, 0);
  assert.equal(e.Module.canvas.width, 800);
  assert.equal(e.Module.canvas.height, 600);
  e.rect({ width: 800, height: 600 });
  e.tick(2);
  assert.equal(e.calls.render.length, 1);
  assert.equal(e.Module.canvas.width, 1200);
  assert.equal(e.Module.canvas.height, 900);
});

test('a pause triggered by a native update prevents that frame from rendering', () => {
  const e = engine();
  e.Module.onUpdate = () => e.Module.setRenderPaused(true);
  e.tick(1);
  assert.equal(e.calls.update, 1);
  assert.equal(e.calls.render.length, 0);
  assert.equal(e.callbacks.size, 0);
});

test('pausing releases a held sky drag before the dialog takes input', () => {
  const e = engine();
  e.events.get('mousedown')({ pageX: 4, pageY: 5, clientX: 4, clientY: 5, buttons: 1 });
  e.Module.setRenderPaused(true);
  assert.deepEqual(e.calls.mouse, [[0, -2, 4, 5, 1]]);
  e.Module.setRenderPaused(false);
  e.tick(1);
  assert.equal(e.calls.mouse.length, 1); // The old press must not repeat after returning.
});
