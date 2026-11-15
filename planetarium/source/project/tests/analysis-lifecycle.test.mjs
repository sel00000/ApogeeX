import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalysisController } from '../src/analysis.js';

function setup(t) {
  const elements = new Map();
  const events = [];
  const paints = [];
  const globals = new Map(['document', 'window', 'location', 'requestAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  function element(selector) {
    if (elements.has(selector)) return elements.get(selector);
    const listeners = new Map();
    let src = 'about:blank';
    const item = {
      open: false, hidden: false, textContent: '',
      addEventListener(name, fn) { listeners.set(name, fn); },
      emit(name, event = {}) { listeners.get(name)?.(event); },
      showModal() { this.open = true; events.push('dialog'); },
      close() { this.open = false; this.emit('close'); },
      get src() { return src; },
      set src(value) { src = value; events.push(value === 'about:blank' ? 'unload' : 'navigate'); },
      getAttribute(name) { return this[name]; },
    };
    elements.set(selector, item);
    return item;
  }
  globalThis.document = { querySelector: element };
  globalThis.window = { addEventListener() {} };
  globalThis.location = { origin: 'https://example.test' };
  globalThis.requestAnimationFrame = callback => { paints.push(callback); return paints.length; };
  const controller = createAnalysisController({
    getEngine: () => ({ observer: {}, convertFrame: () => [1, 0, 0, 0] }),
    notify: () => assert.fail('Expected a usable target'),
    onVisibilityChange: visible => events.push(visible ? 'pause' : 'resume'),
  });
  t.after(() => {
    element('#analysis-dialog').close();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const paint = () => { for (const fn of paints.splice(0)) fn(); };
  return { element, events, paint, open: () => controller.open({ ra: 0, dec: 0, label: '클릭한 하늘 영역' }) };
}

test('analysis pauses the sky and paints the dialog before loading its app; closing unloads before resuming', t => {
  const h = setup(t);
  h.open();
  assert.deepEqual(h.events, ['dialog', 'pause']);
  assert.equal(h.element('#analysis-frame').src, 'about:blank');
  h.paint();
  assert.equal(h.element('#analysis-frame').src, 'about:blank');
  h.paint();
  assert.deepEqual(h.events, ['dialog', 'pause', 'navigate']);
  const url = new URL(h.element('#analysis-frame').src);
  assert.match(url.search, /ra=0/);
  assert.match(url.search, /embed=1/);
  h.element('#analysis-dialog').close();
  assert.deepEqual(h.events.slice(-2), ['unload', 'resume']);
});

test('closing before the next paint cannot start a hidden analysis download', t => {
  const h = setup(t);
  h.open();
  h.element('#analysis-dialog').close();
  h.paint();
  h.paint();
  assert.equal(h.element('#analysis-frame').src, 'about:blank');
  assert.equal(h.events.includes('navigate'), false);
});

test('a rapid reopen starts only the latest analysis request', t => {
  const h = setup(t);
  h.open();
  h.element('#analysis-dialog').close();
  h.open();
  h.paint();
  h.paint();
  assert.equal(h.events.filter(event => event === 'navigate').length, 1);
  assert.equal(h.element('#analysis-dialog').open, true);
});
