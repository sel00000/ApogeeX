import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';
import {t, routeLang, readStoredLang, normalizeLang, LANG_KEY} from '../i18n.js';
import {VIEW_TITLES, viewTitle, documentTitle, skyReturnHash, analysisParams} from '../routing.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const HANGUL = /[가-힣ㄱ-ㆎ]/;

test('both dictionaries have the same keys and no empty values', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  for (const [k, v] of Object.entries(en)) { assert.ok(typeof v === 'string' && v.length, k); assert.ok(!HANGUL.test(v.replace(/<span lang="ko">[^<]*<\/span>/g, '')), 'Hangul in en: ' + k); }
  for (const [k, v] of Object.entries(ko)) assert.ok(typeof v === 'string' && v.length, k);
});

test('every key used in index.html exists, and the file text is the English dictionary text', () => {
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html|-key)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) keys.add(pair.split(':')[1]);
  assert.ok(keys.size > 100, 'keys found: ' + keys.size);
  for (const k of keys) { assert.ok(Object.hasOwn(en, k), 'missing in en: ' + k); assert.ok(Object.hasOwn(ko, k), 'missing in ko: ' + k); }
  for (const m of html.matchAll(/data-i18n-html="([^"]+)">/g)) assert.ok(html.includes(m[0] + en[m[1]]), 'first paint differs from en for ' + m[1]);
  assert.match(html, /<html lang="en">/);
  assert.ok(html.includes('<title>' + en['meta.title'] + '</title>'));
});

test('index.html has no Hangul outside elements marked lang="ko"', () => {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'circle', 'path', 'ellipse']);
  const stack = []; let last = 0; const bad = [];
  const koNow = () => stack.some(e => e.ko);
  const body = html.replace(/<script[\s\S]*?<\/script>/g, s => (HANGUL.test(s) ? s : '')); // scripts are checked as text too
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const text = body.slice(last, m.index); last = m.index + m[0].length;
    if (HANGUL.test(text) && !koNow()) bad.push(text.trim().slice(0, 40));
    const [, close, tag, attrs, selfClose] = m;
    if (close) { const i = stack.map(e => e.tag).lastIndexOf(tag.toLowerCase()); if (i >= 0) stack.length = i; continue; }
    const ko = /\slang="ko"/.test(attrs);
    if (HANGUL.test(attrs) && !ko && !koNow()) bad.push('<' + tag + attrs.slice(0, 60));
    if (!selfClose && !VOID.has(tag.toLowerCase())) stack.push({ tag: tag.toLowerCase(), ko });
  }
  assert.deepEqual(bad, []);
});

test('route language helper reads lang=ko|en once and strips it from the address', () => {
  assert.deepEqual(routeLang('#home?lang=ko'), { lang: 'ko', hash: '#home' });
  assert.deepEqual(routeLang('#analysis?view=sky&lang=en&sky=1,2,3'), { lang: 'en', hash: '#analysis?view=sky&sky=1%2C2%2C3' });
  assert.deepEqual(routeLang('#planetarium?lang=fr'), { lang: null, hash: '#planetarium' });
  assert.deepEqual(routeLang('#asteroids?tab=orbit'), { lang: null, hash: '#asteroids?tab=orbit' });
  assert.deepEqual(routeLang(''), { lang: null, hash: '' });
});

test('stored language: only "ko" means Korean; anything else or a storage error means English', () => {
  const store = v => ({ getItem: k => (k === LANG_KEY ? v : null) });
  assert.equal(readStoredLang(store('ko')), 'ko');
  for (const v of ['en', 'KO', '', null, 'kr']) assert.equal(readStoredLang(store(v)), 'en');
  assert.equal(readStoredLang({ getItem() { throw new Error('denied'); } }), 'en');
  assert.equal(normalizeLang('ko'), 'ko'); assert.equal(normalizeLang(undefined), 'en');
});

test('t() fills variables and falls back to English, then to the key', () => {
  assert.equal(t('wave.sep', { r: '4.0' }, 'en'), 'Separation 4.0 M');
  assert.equal(t('wave.sep', { r: '4.0' }, 'ko'), '간격 4.0 M');
  assert.equal(t('wave.sep', {}, 'en'), 'Separation {r} M');
  assert.equal(t('common.close', null, 'xx'), 'Close');
  assert.equal(t('no.such.key', null, 'ko'), 'no.such.key');
  assert.equal(t('common.close'), 'Close', 'default language in a context without storage is English');
});

test('view titles match the dictionaries and document titles follow the language', () => {
  for (const v of ['home', 'planetarium', 'analysis', 'asteroids']) {
    assert.equal(viewTitle(v, 'en'), en['view.' + v]); assert.equal(viewTitle(v, 'ko'), ko['view.' + v]);
  }
  assert.equal(VIEW_TITLES.ko.suffix, ko['doc.suffix']); assert.equal(VIEW_TITLES.en.suffix, en['doc.suffix']);
  assert.equal(documentTitle('asteroids', 'en'), 'Asteroid Analysis · SPHEREx for Everyone');
  assert.equal(documentTitle('asteroids', 'ko'), '소행성 분석 · 모두를 위한 SPHEREx');
  assert.equal(documentTitle('home', 'en'), en['meta.title']); assert.equal(documentTitle('home', 'ko'), ko['meta.title']);
});

test('routing errors carry an i18n key with an English message', () => {
  for (const [target, key] of [[null, 'err.noTarget'], [{ name: 'Eros' }, 'err.needCoords'], [{ ra: 2, dec: 1, frame: 'apparent-ICRF' }, 'err.apparent']]) {
    assert.throws(() => analysisParams(target), e => e.i18nKey === key && e.message === en[key]);
  }
});

test('sky hand-over accepts getState().center and keeps the older fallback', () => {
  assert.equal(skyReturnHash({ center: { ra: 370, dec: -20, fov: 60 } }), '#analysis?view=sky&sky=10,-20,60');
  assert.equal(skyReturnHash({ center: { ra: 1, dec: 95, fov: 60 }, query: 'ra=5&dec=6&fov=7' }), '#analysis?view=sky&sky=5,6,7');
  assert.equal(skyReturnHash({ center: { ra: 'x' } }), '#analysis?view=sky');
});

test('the polite live line is announced from the language listener, so every switch source reaches it', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const listener = app.slice(app.indexOf('onLangChange(lang=>{'), app.indexOf('});', app.indexOf('onLangChange(lang=>{')));
  assert.match(listener, /\$\('#lang-live'\)\.textContent=t\('lang\.live'\)/);
  assert.equal(app.match(/#lang-live/g).length, 1, 'only the listener writes the live line');
  assert.match(html, /class="header-search"[^>]*data-i18n-attr="aria-label:header\.searchLabel"/);
  assert.equal(en['header.searchLabel'], 'Search'); assert.equal(ko['header.searchLabel'], '검색');
});

test('ApogeeX logo: derived brand files exist, the page uses them, and the brand link names ApogeeX', () => {
  for (const n of ['apogeex-logo.png', 'apogeex-mark.png', 'apogeex-favicon.png', 'apogeex-favicon-32.png']) {
    assert.ok(fs.statSync(new URL('../assets/brand/' + n, import.meta.url)).size > 0, n);
  }
  assert.match(html, /<link rel="icon" href="assets\/brand\/apogeex-favicon-32\.png" sizes="32x32"/);
  assert.match(html, /<link rel="icon" href="assets\/brand\/apogeex-favicon\.png" sizes="192x192"/);
  assert.doesNotMatch(html, /rel="icon" href="assets\/mark\.svg"/);
  assert.match(html, /<a class="brand"[^>]*><span class="brand-logo" aria-hidden="true">/);
  assert.match(html, /<footer><span class="brand-small"><span class="brand-logo brand-logo-small" aria-hidden="true">/);
  assert.match(en['brand.home'], /ApogeeX/); assert.match(ko['brand.home'], /ApogeeX/);
  assert.equal(ko['brand.name'], '모두를 위한 SPHEREx');
});
