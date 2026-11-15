import test from 'node:test';
import assert from 'node:assert/strict';
import { installTutorialHost } from './host.js';

function surface(page = 'home') {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.documentElement = { dataset: {} };
  doc.hidden = false;
  const activity = [];
  win.__hero = { setActive(value) { activity.push(value); } };
  const dispose = installTutorialHost(win, doc, page);
  const change = (open, phase = 'lesson') => {
    const event = new Event('sky-tutorial-visibility');
    event.detail = { open, phase };
    win.dispatchEvent(event);
  };
  return { win, doc, activity, dispose, change };
}

test('opening a tutorial pauses the hero and exposes a hotkey guard without changing page controls', () => {
  const s = surface();
  s.change(true);
  assert.equal(s.activity.at(-1), false);
  assert.equal(s.doc.documentElement.dataset.skyTutorialActive, 'true');
  s.change(false, 'practice');
  assert.equal(s.activity.at(-1), true);
  assert.equal(s.doc.documentElement.dataset.skyTutorialActive, 'false');
  s.dispose();
});

test('closing a hidden tutorial does not restart a hidden background', () => {
  const s = surface();
  s.change(true);
  s.doc.hidden = true;
  s.doc.dispatchEvent(new Event('visibilitychange'));
  s.change(false, 'closed');
  assert.equal(s.activity.at(-1), false);
  s.doc.hidden = false;
  s.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.activity.at(-1), true);
  s.dispose();
});

test('history restoration keeps the background paused beneath an open guide', () => {
  const s = surface();
  s.change(true);
  s.win.dispatchEvent(new Event('pageshow'));
  assert.equal(s.activity.at(-1), false);
  s.change(false, 'closed');
  s.win.dispatchEvent(new Event('pageshow'));
  assert.equal(s.activity.at(-1), true);
  s.dispose();
});

test('analysis and planetarium bridges only set visibility and never mutate their scene or measurements', () => {
  for (const page of ['analysis', 'planetarium']) {
    const s = surface(page);
    s.change(true);
    assert.equal(s.doc.documentElement.dataset.skyTutorialActive, 'true');
    assert.deepEqual(s.activity, []);
    s.dispose();
  }
});

test('disposing the host releases its guard and ignores later guide events', () => {
  const s = surface();
  s.change(true);
  s.dispose();
  assert.equal(s.doc.documentElement.dataset.skyTutorialActive, 'false');
  const calls = s.activity.length;
  s.change(true);
  assert.equal(s.activity.length, calls);
  assert.equal(s.doc.documentElement.dataset.skyTutorialActive, 'false');
});

test('shell adapter owns pausing across a route change without touching science controls',()=>{
  const s=surface();const paused=[];
  s.win.__spherexApp={setTutorialActive:value=>paused.push(value)};
  s.change(true);
  s.win.dispatchEvent(new Event('spherex-route-ready'));
  assert.deepEqual(paused,[true,true]);
  s.change(false,'practice');
  assert.equal(paused.at(-1),false);
  s.dispose();
});
