import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('./boot.js', import.meta.url), 'utf8')).replace(/\bimport\(/g, 'dynamicImport(');
const settle = () => new Promise(resolve => setImmediate(resolve));

function boot({ page = 'home', prefix = '/', embedded = false } = {}) {
  const events = new Map();
  const calls = [];
  class Element {
    closest(selector) { return selector === '[data-sky-tutorial-open]' ? this : null; }
  }
  const document = {
    currentScript: { dataset: { tutorialPage: page }, src: `https://example.test${prefix}tutorial/boot.js` },
    getElementById: () => null,
    addEventListener: (type, callback) => events.set(type, callback),
  };
  const window = { self: {}, top: {} };
  if (!embedded) window.top = window.self;
  const controller = { open: () => calls.push(['open']) };
  vm.runInNewContext(source, {
    window, document, URL, Element, console,
    dynamicImport: async url => {
      calls.push(['import', url]);
      return url.endsWith('/host.js')
        ? { installTutorialHost: (_win, _doc, value) => calls.push(['host', value]) }
        : { mountTutorial: options => { calls.push(['mount', { ...options }]); return controller; } };
    },
  });
  const click = () => {
    const event = {
      target: new Element(), prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    events.get('click')(event);
    return event;
  };
  return { calls, click };
}

test('all entry pages resolve shared modules under both root and GitHub project base paths', async () => {
  for (const prefix of ['/', '/temporary-sky/']) {
    for (const page of ['home', 'planetarium', 'analysis']) {
      const s = boot({ page, prefix });
      await settle();
      assert.deepEqual(s.calls.filter(([kind]) => kind === 'import').map(([, url]) => url), [
        `https://example.test${prefix}tutorial/host.js`,
        `https://example.test${prefix}tutorial/tutorial.js`,
      ]);
      const mount = s.calls.find(([kind]) => kind === 'mount');
      assert.deepEqual(mount[1], { page, autoOpen: true, embedded: false });
      assert.ok(s.calls.findIndex(([kind]) => kind === 'host') < s.calls.indexOf(mount));
      assert.equal(s.calls.filter(([kind]) => kind === 'open').length, 0);
    }
  }
});

test('embedded analysis is explicitly identified so mounting cannot auto-interrupt a selected analysis', async () => {
  const s = boot({ page: 'analysis', embedded: true });
  await settle();
  assert.deepEqual(s.calls.find(([kind]) => kind === 'mount')[1], { page: 'analysis', autoOpen: false, embedded: true });
  assert.equal(s.calls.filter(([kind]) => kind === 'open').length, 0);
});

test('quick replay clicks while loading are coalesced into one chooser and one controller', async () => {
  const s = boot();
  const first = s.click();
  const second = s.click();
  assert.equal(first.prevented && first.stopped && second.prevented && second.stopped, true);
  await settle();
  assert.deepEqual(s.calls.find(([kind]) => kind === 'mount')[1], { page: 'home', autoOpen: false, embedded: false });
  assert.equal(s.calls.filter(([kind]) => kind === 'mount').length, 1);
  assert.equal(s.calls.filter(([kind]) => kind === 'open').length, 1);
  assert.equal(s.calls.filter(([kind]) => kind === 'import').length, 2);
  // Once mounted, the shared UI owns delegated buttons; bootstrap must not duplicate it.
  const later = s.click();
  assert.equal(later.prevented || later.stopped, false);
  assert.equal(s.calls.filter(([kind]) => kind === 'open').length, 1);
});
