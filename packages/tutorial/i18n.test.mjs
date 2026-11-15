import test from 'node:test';
import assert from 'node:assert/strict';
import { LANG_KEY, LANG_EVENT, UI, readLang, normalizeLang, watchLang, publishLang } from './i18n.js';
import { contentFor, MODULES, TRACKS, CHARACTERS, REFERENCES, TUTORIAL_NOTE } from './content.js';
import { TEXT } from './visuals.text.js';
import { PRACTICE_TEXT } from './practice.js';
import { NOT_READY } from './adapter.js';
import { courseFor } from './state.js';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** Same keys, same array lengths and same function arity in both languages. */
function sameShape(ko, en, path = 'root') {
  if (typeof ko === 'function') { assert.equal(typeof en, 'function', path); assert.equal(en.length, ko.length, path); return; }
  if (Array.isArray(ko)) { assert.ok(Array.isArray(en), path); assert.equal(en.length, ko.length, path); ko.forEach((v, i) => sameShape(v, en[i], `${path}[${i}]`)); return; }
  if (ko && typeof ko === 'object') {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort(), path);
    for (const k of Object.keys(ko)) sameShape(ko[k], en[k], `${path}.${k}`);
    return;
  }
  assert.equal(typeof en, typeof ko, path);
}
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push(String(value(...Array(value.length).fill('1'))));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => strings(v, out));
  return out;
}

test('language contract: only a stored ko means Korean, storage errors mean English', () => {
  assert.equal(normalizeLang('ko'), 'ko');
  for (const v of ['en', null, undefined, 'KO', 'fr', '']) assert.equal(normalizeLang(v), 'en');
  const store = (value) => ({ localStorage: { getItem: (k) => (k === LANG_KEY ? value : null) } });
  assert.equal(readLang(store('ko')), 'ko');
  assert.equal(readLang(store('en')), 'en');
  assert.equal(readLang(store(null)), 'en');
  assert.equal(readLang({ get localStorage() { throw new Error('blocked'); } }), 'en');
  assert.equal(readLang({ localStorage: { getItem() { throw new Error('blocked'); } } }), 'en');
});

test('shell, practice, adapter and diagram texts have the same keys in both languages and English has no Hangul', async () => {
  sameShape(UI.ko, UI.en, 'UI');
  sameShape(PRACTICE_TEXT.ko, PRACTICE_TEXT.en, 'PRACTICE_TEXT');
  sameShape(TEXT.ko, TEXT.en, 'TEXT');
  const { SHELL_TEXT } = await import('./tutorial.js');
  sameShape(SHELL_TEXT.ko, SHELL_TEXT.en, 'SHELL_TEXT');
  assert.equal(SHELL_TEXT.ko.pages.planetarium, '플라네타리움'); assert.equal(SHELL_TEXT.en.pages.planetarium, 'Planetarium');
  assert.deepEqual(Object.keys(NOT_READY).sort(), ['en', 'ko']);
  for (const s of strings([UI.en, PRACTICE_TEXT.en, TEXT.en, NOT_READY.en, SHELL_TEXT.en])) assert.doesNotMatch(s, HANGUL, s);
  // The Korean diagram texts stay the original copy.
  assert.equal(TEXT.ko.mask.hide, '사유 숨기기');
});

test('English course is a word-for-word parallel of the Korean course structure', () => {
  const ko = contentFor('ko'); const en = contentFor('en');
  assert.equal(ko.MODULES, MODULES); assert.equal(ko.TRACKS, TRACKS); assert.equal(ko.CHARACTERS, CHARACTERS);
  assert.equal(ko.REFERENCES, REFERENCES); assert.equal(ko.TUTORIAL_NOTE, TUTORIAL_NOTE);
  assert.equal(contentFor('fr'), en);
  assert.deepEqual(Object.keys(en.CHARACTERS), Object.keys(ko.CHARACTERS));
  for (const id of Object.keys(ko.CHARACTERS)) assert.equal(en.CHARACTERS[id].image, ko.CHARACTERS[id].image);
  for (const id of Object.keys(ko.REFERENCES)) assert.equal(en.REFERENCES[id].url, ko.REFERENCES[id].url);
  assert.deepEqual(en.MODULES.map(m => m.id), ko.MODULES.map(m => m.id));
  for (const [i, m] of ko.MODULES.entries()) {
    const e = en.MODULES[i];
    assert.deepEqual(e.minutes, m.minutes);
    for (const track of ['beginner', 'research']) {
      assert.equal(e.steps[track].length, m.steps[track].length, `${m.id} ${track}`);
      m.steps[track].forEach((s, j) => {
        const t = e.steps[track][j];
        assert.equal(t.id, s.id); assert.equal(t.character, s.character); assert.equal(t.visual, s.visual);
        assert.deepEqual(t.sources, s.sources);
        assert.equal(t.body.length, s.body.length, s.id);
        assert.notEqual(t.title, s.title, s.id);
        assert.equal(Boolean(t.practice), Boolean(s.practice), s.id);
        if (s.practice) {
          const { label: _l, hint: _h, ...rest } = t.practice; const { label: _k, hint: _g, ...base } = s.practice;
          assert.deepEqual(rest, base, s.id);
          assert.ok(t.practice.label && t.practice.hint, s.id);
          if (s.practice.requires.includes('prepared')) assert.match(t.practice.label, /prepared example/);
        }
        assert.equal(Boolean(t.check), Boolean(s.check), s.id);
        if (s.check) { assert.equal(t.check.answer, s.check.answer); assert.equal(t.check.choices.length, s.check.choices.length, s.id); }
      });
    }
  }
  for (const s of strings({ ...en, MODULES: en.MODULES.map(({ steps, ...m }) => ({ ...m, steps })) })) assert.doesNotMatch(s, HANGUL, s);
  // Hedges survive translation.
  const copy = JSON.stringify(en.MODULES);
  assert.match(copy, /illustrative model/); assert.match(copy, /scientific validation/); assert.match(copy, /candidate/);
  assert.match(en.TUTORIAL_NOTE, /not quotations/); assert.match(en.TUTORIAL_NOTE, /made-up data/);
});

test('followers accept the DOM event, the storage key and only a same-origin parent message', () => {
  const listeners = new Map();
  const parent = {};
  const win = {
    location: { origin: 'https://site.test' }, parent,
    addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t) => listeners.delete(t),
  };
  const seen = [];
  const stop = watchLang(win, (lang) => seen.push(lang));
  listeners.get(LANG_EVENT)({ detail: { lang: 'ko' } });
  listeners.get('storage')({ key: 'other', newValue: 'en' });
  listeners.get('storage')({ key: LANG_KEY, newValue: 'en' });
  listeners.get('message')({ origin: 'https://evil.test', source: parent, data: { type: 'spherex-lang', lang: 'ko' } });
  listeners.get('message')({ origin: 'https://site.test', source: {}, data: { type: 'spherex-lang', lang: 'ko' } });
  listeners.get('message')({ origin: 'https://site.test', source: parent, data: { type: 'other', lang: 'ko' } });
  listeners.get('message')({ origin: 'https://site.test', source: parent, data: { type: 'spherex-lang', lang: 'ko' } });
  assert.deepEqual(seen, ['ko', 'en', 'ko']);
  stop();
  assert.equal(listeners.size, 0);
});

test('publishing stores the key and tells this document, even when storage is blocked', () => {
  const events = [];
  const stored = new Map();
  const win = { localStorage: { setItem: (k, v) => stored.set(k, v) }, CustomEvent, dispatchEvent: (e) => events.push(e) };
  assert.equal(publishLang(win, 'ko'), 'ko');
  assert.equal(stored.get(LANG_KEY), 'ko');
  assert.equal(events[0].type, LANG_EVENT); assert.deepEqual(events[0].detail, { lang: 'ko' });
  const blocked = { get localStorage() { throw new Error('blocked'); }, CustomEvent, dispatchEvent: (e) => events.push(e) };
  assert.equal(publishLang(blocked, 'xx'), 'en');
  assert.deepEqual(events[1].detail, { lang: 'en' });
});

// ---- A small DOM, enough for the real guide to mount, render and switch language. ----
function fakeDom() {
  const kebab = (s) => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  class Element {
    constructor(tag, doc) {
      this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentElement = null;
      this.attributes = new Map(); this.listeners = new Map(); this.textValue = '';
      const props = new Map();
      this.style = { setProperty: (k, v, p) => props.set(k, [v, p]), getPropertyValue: k => props.get(k)?.[0] ?? '', getPropertyPriority: k => props.get(k)?.[1] ?? '', removeProperty: k => props.delete(k) };
      this.dataset = new Proxy({}, {
        get: (_, k) => this.getAttribute('data-' + kebab(String(k))) ?? undefined,
        set: (_, k, v) => { this.setAttribute('data-' + kebab(String(k)), v); return true; },
      });
      this.classList = {
        add: (...n) => { const s = new Set(this.className.split(' ').filter(Boolean)); n.forEach(x => s.add(x)); this.className = [...s].join(' '); },
        remove: (...n) => { this.className = this.className.split(' ').filter(x => x && !n.includes(x)).join(' '); },
        toggle: (n, force) => { const has = this.classList.contains(n); const want = force ?? !has; if (want) this.classList.add(n); else this.classList.remove(n); return want; },
        contains: (n) => this.className.split(' ').includes(n),
      };
    }
    get className() { return this.getAttribute('class') ?? ''; } set className(v) { this.setAttribute('class', v); }
    get id() { return this.getAttribute('id') ?? ''; } set id(v) { this.setAttribute('id', v); }
    get textContent() { return this.textValue + this.children.map(c => c.textContent).join(''); }
    set textContent(v) { this.children = []; this.textValue = String(v); }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
    removeAttribute(k) { this.attributes.delete(k); }
    append(...nodes) { for (const n of nodes) { if (typeof n === 'string') { this.textValue += n; continue; } n.remove(); n.parentElement = this; this.children.push(n); } }
    replaceChildren(...nodes) { for (const c of this.children) c.parentElement = null; this.children = []; this.textValue = ''; this.append(...nodes); }
    remove() { if (this.parentElement) { this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; } }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === this.ownerDocument.documentElement; }
    contains(o) { for (let n = o; n; n = n.parentElement) if (n === this) return true; return false; }
    addEventListener(t, f) { if (!this.listeners.has(t)) this.listeners.set(t, []); this.listeners.get(t).push(f); }
    removeEventListener(t, f) { this.listeners.set(t, (this.listeners.get(t) ?? []).filter(x => x !== f)); }
    dispatchEvent(e) { for (const f of this.listeners.get(e.type) ?? []) f(e); return true; }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} }); }
    focus() { this.ownerDocument.activeElement = this; }
    scrollIntoView() {}
    getBoundingClientRect() { return { width: 440, height: 172, left: 0, top: 0, right: 440, bottom: 172 }; }
    showModal() { this.open = true; } close() { this.open = false; }
    matches(sel) { return sel.split(',').some(s => matchChain(this, s.trim().split(/\s+/))); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n; return null; }
    querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  }
  function matchOne(el, compound) {
    const m = compound.match(/^([a-z0-9]*)((?:#[\w-]+)?)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i);
    if (!m) throw new Error('selector ' + compound);
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && el.id !== m[2].slice(1)) return false;
    for (const c of m[3].split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
    for (const a of m[4].match(/\[[^\]]+\]/g) ?? []) {
      const [, k, v] = a.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/);
      if (v === undefined ? el.getAttribute(k) === null : el.getAttribute(k) !== v) return false;
    }
    return true;
  }
  function matchChain(el, parts) {
    if (!matchOne(el, parts.at(-1))) return false;
    let rest = parts.slice(0, -1);
    for (let n = el.parentElement; n && rest.length; n = n.parentElement) if (matchOne(n, rest.at(-1))) rest = rest.slice(0, -1);
    return rest.length === 0;
  }
  const doc = { activeElement: null };
  doc.createElement = (t) => new Element(t, doc);
  doc.createElementNS = (_ns, t) => new Element(t, doc);
  doc.documentElement = doc.createElement('html');
  doc.head = doc.createElement('head'); doc.body = doc.createElement('body');
  doc.documentElement.append(doc.head, doc.body);
  doc.querySelector = (s) => doc.documentElement.querySelector(s);
  doc.querySelectorAll = (s) => doc.documentElement.querySelectorAll(s);
  const docListeners = new Element('x', doc);
  doc.addEventListener = (t, f) => docListeners.addEventListener(t, f);
  doc.removeEventListener = (t, f) => docListeners.removeEventListener(t, f);
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const winTarget = new Element('window', doc);
  const win = {
    document: doc, location: { origin: 'https://site.test', hash: '#home', href: 'https://site.test/#home' },
    localStorage: storage, sessionStorage: new Map() && { getItem: () => null, setItem() {} },
    scrollX: 0, scrollY: 0, scrollTo() {}, innerWidth: 1440, innerHeight: 900,
    addEventListener: (t, f) => winTarget.addEventListener(t, f), removeEventListener: (t, f) => winTarget.removeEventListener(t, f),
    dispatchEvent: (e) => winTarget.dispatchEvent(e), getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    CustomEvent,
  };
  win.self = win; win.top = win; win.parent = win;
  return { win, doc, Element, store };
}

test('switching language re-renders the current step in place and keeps course, step and answer', async () => {
  const { win, doc, Element, store } = fakeDom();
  const saved = {};
  for (const k of ['window', 'document', 'Element', 'localStorage', 'sessionStorage', 'getComputedStyle']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  set('window', win); set('document', doc); set('Element', Element); set('localStorage', win.localStorage); set('sessionStorage', win.sessionStorage);
  let api;
  try {
    const { mountTutorial } = await import('./tutorial.js');
    const { setCurrentLang } = await import('./i18n.js');
    setCurrentLang('en');
    api = mountTutorial({ page: 'home', autoOpen: false, embedded: false });
    const dialog = doc.querySelector('dialog');
    const title = () => dialog.querySelector('#sky-guide-title').textContent;
    const pressed = () => dialog.querySelectorAll('.sg-lang button').map(b => `${b.dataset.lang}:${b.getAttribute('aria-pressed')}`);
    api.open();
    assert.equal(dialog.lang, 'en');
    assert.deepEqual(pressed(), ['en:true', 'ko:false']);
    const koButton = dialog.querySelector('.sg-lang [data-lang="ko"]');
    assert.equal(koButton.lang, 'ko'); assert.equal(koButton.getAttribute('aria-label'), '한국어');
    assert.equal(dialog.querySelector('.sg-lang').getAttribute('role'), 'group');
    assert.equal(title(), UI.en.againTitle);
    // Start the wavelength topic, move to step 2 and answer its check wrongly.
    dialog.querySelectorAll('.sg-topic')[2].click();
    dialog.querySelector('.sg-footer .sg-primary').click();
    const en = courseFor(contentFor('en').MODULES, 'beginner', 'wavelength');
    const ko = courseFor(contentFor('ko').MODULES, 'beginner', 'wavelength');
    assert.equal(title(), en[1].title);
    dialog.querySelectorAll('.sg-check-choice')[0].click();
    assert.match(dialog.querySelector('.sg-check-feedback').textContent, /^Let’s look again\./);

    const heard = [];
    win.addEventListener(LANG_EVENT, e => heard.push(e.detail.lang));
    dialog.querySelector('.sg-lang [data-lang="ko"]').focus();
    dialog.querySelector('.sg-lang [data-lang="ko"]').click();
    assert.equal(store.get(LANG_KEY), 'ko');
    assert.deepEqual(heard, ['ko']);
    assert.equal(dialog.lang, 'ko');
    assert.equal(title(), ko[1].title);
    assert.equal(dialog.querySelector('.sg-progress span').textContent, '2 / 4');
    assert.equal(dialog.querySelectorAll('.sg-check-choice')[0].getAttribute('aria-pressed'), 'true');
    assert.match(dialog.querySelector('.sg-check-feedback').textContent, /^다시 살펴볼까요\?/);
    assert.deepEqual(pressed(), ['en:false', 'ko:true']);
    assert.equal(doc.activeElement, dialog.querySelector('.sg-lang [data-lang="ko"]'), 'focus stays on the pressed segment');
    assert.equal(dialog.querySelector('.sg-sr-only').textContent, '언어: 한국어');

    // The portal (or another tab) switches back: the guide follows without moving.
    win.dispatchEvent({ type: 'storage', key: LANG_KEY, newValue: 'en' });
    assert.equal(title(), en[1].title);
    assert.match(dialog.querySelector('.sg-check-feedback').textContent, /^Let’s look again\./);
    win.dispatchEvent({ type: 'message', origin: 'https://evil.test', source: win, data: { type: 'spherex-lang', lang: 'ko' } });
    assert.equal(title(), en[1].title);
    win.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: 'ko' } }));
    assert.equal(title(), ko[1].title);

    // Completion and chooser follow too.
    dialog.querySelector('.sg-footer .sg-primary').click();
    dialog.querySelector('.sg-footer .sg-primary').click();
    dialog.querySelector('.sg-footer .sg-primary').click();
    assert.equal(title(), UI.ko.completeTitle);
    win.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: 'en' } }));
    assert.equal(title(), UI.en.completeTitle);
    assert.match(dialog.querySelector('.sg-lead').textContent, /Reading wavelengths and graphs/);
  } finally {
    api?.destroy();
    for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
});
