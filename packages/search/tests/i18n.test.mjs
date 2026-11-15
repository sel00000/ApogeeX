import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TEXT, t, asLang, SearchError } from '../dist/i18n.js';
import { createSearchService, bodyChoices, choiceFromItem } from '../dist/service.js';
import { validateIndexData } from '../dist/core/index.js';

const bodies = JSON.parse(await readFile(new URL('../public/bodies-index.json', import.meta.url)));
const catalogue = JSON.parse(await readFile(new URL('../public/sky-index.json', import.meta.url)));
const hangul = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const jsonResponse = body => new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}});
const fetchFn = async url => String(url).includes('bodies-index') ? jsonResponse(bodies) : String(url).includes('sky-index') ? jsonResponse(catalogue) : new Response('', {status: 500});

test('text table: both languages have the same keys and the same {placeholders}', () => {
  assert.deepEqual(Object.keys(TEXT.en).sort(), Object.keys(TEXT.ko).sort());
  for (const key of Object.keys(TEXT.ko)) {
    const holes = lang => (TEXT[lang][key].match(/\{\w+\}/g) ?? []).sort().join();
    assert.equal(holes('en'), holes('ko'), key);
    assert.ok(TEXT.en[key].trim() && TEXT.ko[key].trim(), key);
  }
});

test('text table: the English text has no Hangul and the Korean text is Korean', () => {
  for (const [key, value] of Object.entries(TEXT.en)) assert.doesNotMatch(value, hangul, key);
  for (const key of ['label', 'submit', 'searching', 'noneFound']) assert.match(TEXT.ko[key], hangul, key);
  assert.equal(t('en', 'chooseCount', {n: 3}), 'Choose an object. Results: 3.');
  assert.equal(t('ko', 'chooseCount', {n: 3}), '3개 결과에서 대상을 선택하세요.');
});

test('language value: only ko means Korean', () => {
  assert.equal(asLang('ko'), 'ko');
  for (const v of ['en', 'EN', 'ko-KR', '', null, undefined, 3]) assert.equal(asLang(v), 'en');
});

test('index errors carry both languages', () => {
  assert.throws(() => validateIndexData({v: 2}), e => e instanceof SearchError && /not supported/.test(e.text('en')) && /버전/.test(e.text('ko')));
});

test('name order: English name first on the English screen, Korean name first on the Korean screen', async () => {
  const item = {label: '안드로메다 은하', nameEn: 'Andromeda Galaxy', nameKo: '안드로메다 은하', origin: 'engine', viaModel: false, id: 'M 31', ra: 10.68, dec: 41.27, otype: 'Galaxy'};
  assert.equal(choiceFromItem(item, 'en').label, 'Andromeda Galaxy');
  assert.equal(choiceFromItem(item, 'ko').label, '안드로메다 은하');
  assert.equal(choiceFromItem(item, 'en').texts.ko.label, '안드로메다 은하');
  // The selection keeps the name the portal has always received.
  assert.equal(choiceFromItem(item, 'en').selection.name, '안드로메다 은하');
  // An object with only an English name shows it on both screens.
  assert.equal(choiceFromItem({...item, nameKo: null}, 'ko').label, 'Andromeda Galaxy');
  const eros = bodyChoices('에로스', bodies.objects, true);
  assert.equal(eros[0].texts.en.label, '433 Eros');
  assert.equal(eros[0].texts.ko.label, '433 Eros'); // existing Korean form kept; the Korean name still finds it
  const mars = bodyChoices('화성', bodies.objects, true, 'en')[0];
  assert.equal(mars.label, 'Mars'); assert.equal(mars.texts.ko.label, '화성');
});

test('searching in either language works on both screens', async () => {
  for (const lang of ['en', 'ko']) {
    const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn, lang});
    await service.ready();
    const a = service.suggest('안드로메다')[0], b = service.suggest('Andromeda')[0];
    assert.ok(a && b, lang);
    assert.equal(a.selection.id, b.selection.id);
    assert.equal(a.label, lang === 'ko' ? a.texts.ko.label : a.texts.en.label);
    if (lang === 'en') assert.doesNotMatch(a.label, hangul);
    assert.match(a.texts.ko.label, hangul);
    assert.doesNotMatch(a.texts.en.label, hangul);
  }
});

test('service messages follow a language function', async () => {
  let lang = 'en';
  const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn, lang: () => lang});
  assert.match((await service.search('  ')).message, /Enter an object name/);
  lang = 'ko';
  const r = await service.search('  ');
  assert.match(r.message, /천체 이름이나/);
  assert.match(r.describe('en'), /Enter an object name/);
});
