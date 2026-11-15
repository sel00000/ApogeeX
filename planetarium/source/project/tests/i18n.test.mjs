import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { en, ko } from '../src/i18n-dict.js';
import { LANG_KEY, normalizeLang, readStoredLang, t } from '../src/i18n.js';
import { viewCenter } from '../src/view-state.js';

const hangul = /[ᄀ-ᇿ㄰-㆏가-힯]/;

test('both dictionaries have the same keys and no empty text', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  for (const [key, value] of Object.entries(en)) {
    assert.ok(value.trim(), key);
    assert.ok(ko[key].trim(), key);
    assert.ok(!hangul.test(value), `English text contains Hangul: ${key}`);
    // Placeholders must match so that the same parameters fill both languages.
    const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(names(value), names(ko[key]), key);
  }
});

test('language contract: only a stored "ko" means Korean; anything else or a storage error means English', () => {
  assert.equal(LANG_KEY, 'spherex-lang');
  const storage = (value) => ({ getItem: (key) => (key === LANG_KEY ? value : null) });
  assert.equal(readStoredLang(storage('ko')), 'ko');
  for (const value of ['en', null, '', 'KO', 'kr', 'fr']) assert.equal(readStoredLang(storage(value)), 'en');
  assert.equal(readStoredLang({ getItem() { throw new Error('blocked'); } }), 'en');
  assert.equal(readStoredLang(null), 'en');
  assert.equal(normalizeLang('ko'), 'ko');
  assert.equal(normalizeLang(undefined), 'en');
});

test('t() fills placeholders and falls back to the key for unknown texts', () => {
  assert.equal(t('location.found', { count: 3 }), '3 places found');
  assert.equal(t('location.foundOne', { count: 1 }), '1 place found');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('index.html is English by default and every marker names a known key', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.ok(!hangul.test(html), 'index.html contains Hangul');
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-lead|-html)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((pair) => pair.split('=')[1])),
  ];
  assert.ok(keys.length > 80);
  for (const key of keys) assert.ok(key in en, key);
});

test('viewCenter returns ICRS degrees and the field of view for the portal', () => {
  const rad = Math.PI / 180;
  const vector = (ra, dec, r = 1) => [r * Math.cos(dec * rad) * Math.cos(ra * rad), r * Math.cos(dec * rad) * Math.sin(ra * rad), r * Math.sin(dec * rad), 0];
  const orion = viewCenter(vector(83.82, -5.39), 20 * rad);
  assert.ok(Math.abs(orion.ra - 83.82) < 1e-9);
  assert.ok(Math.abs(orion.dec + 5.39) < 1e-9);
  assert.ok(Math.abs(orion.fov - 20) < 1e-9);
  // Unnormalised input, negative-angle wrap and the poles.
  assert.ok(Math.abs(viewCenter(vector(350, 10, 3), rad).ra - 350) < 1e-9);
  assert.ok(Math.abs(viewCenter([0, 0, 2], rad).dec - 90) < 1e-9);
  assert.equal(viewCenter([0, 0, 0], rad), null);
  assert.equal(viewCenter([NaN, 0, 1], rad), null);
  assert.equal(viewCenter([1, 0, 0], NaN), null);
  assert.equal(viewCenter(null, rad), null);
});
