import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalysisPicker } from '../src/analysis-picker.js';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    emit(type, event = {}) { for (const callback of listeners.get(type) ?? []) callback(event); },
  };
}

function setup(t) {
  const globals = new Map(['requestAnimationFrame', 'cancelAnimationFrame']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const pendingFrames = new Map();
  let nextFrame = 0;
  globalThis.requestAnimationFrame = callback => { pendingFrames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => pendingFrames.delete(id);

  const elements = new Map();
  const classes = new Set();
  function element(selector) {
    if (elements.has(selector)) return elements.get(selector);
    const attributes = new Map([['hidden', '']]);
    const el = {
      ...eventTarget(), hidden: true, disabled: true, textContent: '', value: '180', focused: false,
      setAttribute(key, value) { attributes.set(key, value); },
      toggleAttribute(key, value) { if (value) attributes.set(key, ''); else attributes.delete(key); if (key === 'hidden') this.hidden = value; },
      getAttribute(key) { return attributes.get(key); },
      focus() { this.focused = true; },
    };
    elements.set(selector, el);
    return el;
  }
  const document = {
    ...eventTarget(), hidden: false, querySelector: element,
    body: { classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } } },
  };
  const canvas = {
    ...eventTarget(), ownerDocument: document, focused: false,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 1000, height: 800 }),
    focus() { this.focused = true; },
  };
  const selectedObject = { name: 'visible constellation label' };
  const zooms = [];
  const engine = {
    canvas, observer: {}, core: { projection: 2, fov: Math.PI / 3, on_click: '0x13', selection: null },
    on() {},
    convertFrame(_observer, from, to, v) {
      if (from === 'VIEW' && to === 'ASTROM') return [-v[2], -v[0], v[1], 0];
      assert.equal(from, 'ASTROM'); assert.equal(to, 'VIEW');
      return [-v[1], v[2], -v[0], 0];
    },
    zoomTo(fov) { zooms.push(fov); this.core.fov = fov; },
    _core_on_mouse(_id, state) { if (state === 0) this.core.selection = selectedObject; },
  };
  const targets = [], selections = [], notices = [], activeAtLaunch = [];
  let allowed = true;
  const picker = createAnalysisPicker({
    engine, canvas, canInteract: () => allowed,
    onTarget(target) { targets.push(target); activeAtLaunch.push(picker.active); },
    onSelection(selection) { selections.push(selection); },
    notify(message) { notices.push(message); },
  });
  t.after(() => {
    picker.cancel();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const pointer = (x = 500, y = 400) => ({
    clientX: x + 100, clientY: y + 50, pointerId: 1, pointerType: 'mouse', button: 0,
  });
  const click = (x = 500, y = 400) => {
    canvas.emit('pointerdown', pointer(x, y));
    document.emit('pointerup', pointer(x, y));
    canvas.emit('click', pointer(x, y));
  };
  const move = (x, y) => {
    canvas.emit('pointermove', pointer(x, y));
    document.emit('pointermove', pointer(x, y));
  };
  const press = key => {
    const event = { key, prevented: false, preventDefault() { this.prevented = true; } };
    document.emit('keydown', event);
    return event;
  };
  const arm = () => element('#analysis-pick').emit('click');
  return { picker, engine, canvas, document, element, targets, selections, selectedObject,
    notices, activeAtLaunch, zooms, pendingFrames, classes, click, move, press, arm,
    allow(value) { allowed = value; } };
}

test('ordinary clicks identify the rendered object without opening or arming analysis', t => {
  const h = setup(t);
  assert.equal(h.picker.active, false);
  h.click();
  assert.deepEqual(h.selections, [h.selectedObject]);
  assert.equal(h.targets.length, 0);
  assert.equal(h.element('#analysis-picker-overlay').hidden, true);
  assert.equal(h.pendingFrames.size, 0);
  assert.equal(h.zooms.length, 0);
});

test('the analysis button arms a moving field preview and focuses the sky', t => {
  const h = setup(t);
  h.arm();
  assert.equal(h.picker.active, true);
  assert.equal(h.element('#analysis-pick').getAttribute('aria-pressed'), 'true');
  assert.ok(h.classes.has('analysis-picking'));
  assert.equal(h.canvas.focused, true);
  assert.equal(h.targets.length, 0, 'arming is not an analysis request');
  assert.equal(h.zooms.length, 1, 'the tiny analysis field becomes visible');
  const firstOutline = h.element('#analysis-picker-outline').getAttribute('points');
  h.move(640, 350);
  assert.equal(h.element('#analysis-picker-overlay').hidden, false);
  assert.equal(h.element('#analysis-picker-overlay').getAttribute('hidden'), undefined, 'SVG visibility must remove the attribute, not only set an expando property');
  assert.notEqual(h.element('#analysis-picker-outline').getAttribute('points'), firstOutline);
  assert.match(h.element('#analysis-picker-label').textContent, /3′ × 3′/);
});

test('the region overlay follows a letterboxed canvas including fractional CSS offsets', t => {
  const h = setup(t);
  h.canvas.getBoundingClientRect = () => ({ left: 364, top: 195.5, width: 820, height: 410 });
  h.canvas.offsetParent = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  h.arm();
  assert.equal(h.element('#analysis-picker-overlay').getAttribute('style'),
    'left:364px;top:195.5px;right:auto;bottom:auto;width:820px;height:410px');
});

test('Escape and a second button click cancel selection and restore ordinary object picking', t => {
  const h = setup(t);
  h.arm();
  const escape = h.press('Escape');
  assert.equal(escape.prevented, true);
  assert.equal(h.picker.active, false);
  assert.equal(h.element('#analysis-pick').focused, true);
  assert.equal(h.element('#analysis-picker-overlay').hidden, true);
  assert.equal(h.pendingFrames.size, 0);
  h.arm(); h.arm();
  assert.equal(h.picker.active, false);
  assert.equal(h.element('#analysis-pick').getAttribute('aria-pressed'), 'false');
  h.click();
  assert.equal(h.targets.length, 0);
  assert.deepEqual(h.selections, [h.selectedObject]);
});

test('a valid field click opens the clicked coordinates once and disarms before opening', t => {
  const h = setup(t);
  h.arm(); h.click();
  assert.equal(h.targets.length, 1);
  assert.equal(h.targets[0].ra, 0);
  assert.equal(h.targets[0].dec, 0);
  assert.equal(h.targets[0].label, 'Selected square field');
  assert.equal(h.targets[0].fovArcsec, 180);
  assert.deepEqual(h.activeAtLaunch, [false]);
  assert.equal(h.element('#analysis-picker-overlay').hidden, true);
  assert.equal(h.pendingFrames.size, 0);
  assert.equal(h.selections.length, 0, 'analysis never snaps to the visible object');
  h.click();
  assert.equal(h.targets.length, 1);
  assert.deepEqual(h.selections, [h.selectedObject]);
});

test('changing field size updates the preview and passes that same angular size to analysis', t => {
  const h = setup(t);
  h.arm();
  const before = h.element('#analysis-picker-outline').getAttribute('points');
  h.element('#analysis-field-size').value = '600';
  h.element('#analysis-field-size').emit('change');
  assert.match(h.element('#analysis-picker-label').textContent, /10′ × 10′/);
  assert.notEqual(h.element('#analysis-picker-outline').getAttribute('points'), before);
  h.click();
  assert.equal(h.targets.length, 1);
  assert.equal(h.targets[0].fovArcsec, 600);
});

test('a field extending outside the canvas does not launch and can be repositioned', t => {
  const h = setup(t);
  h.arm(); h.move(1, 1); h.click(1, 1);
  assert.equal(h.targets.length, 0);
  assert.equal(h.selections.length, 0);
  assert.equal(h.picker.active, true);
  assert.equal(h.element('#analysis-picker-overlay').hidden, true);
  assert.match(h.notices.at(-1), /all of it is inside the sky/);
  h.move(500, 400); h.click();
  assert.equal(h.targets.length, 1);
});

test('unavailable interaction cannot arm the picker or start an analysis', t => {
  const h = setup(t);
  h.allow(false); h.arm(); h.click();
  assert.equal(h.picker.active, false);
  assert.equal(h.targets.length, 0);
  assert.equal(h.selections.length, 0);
  h.allow(true); h.arm();
  h.allow(false); h.click();
  assert.equal(h.targets.length, 0);
  h.allow(true); h.click();
  assert.equal(h.targets.length, 1);
});

test('hiding the page cancels armed selection and its redraw loop', t => {
  const h = setup(t);
  h.arm();
  assert.equal(h.pendingFrames.size, 1);
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.picker.active, false);
  assert.equal(h.pendingFrames.size, 0);
  assert.equal(h.element('#analysis-picker-overlay').hidden, true);
  assert.equal(h.classes.has('analysis-picking'), false);
  assert.equal(h.targets.length, 0);
});
