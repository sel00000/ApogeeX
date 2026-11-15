// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// @ts-nocheck -- ported from the reference suite, which was plain JavaScript (node:test); the typed API is checked through the app code.
// Unit tests per module, on small inputs (no baked index needed). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, compact, displayId, starNameVariants, digitsOf } from '../dist/core/normalize.js';
import { toJamo, initials, isInitialsQuery, syllableCount, hasHangul } from '../dist/core/hangul.js';
import { damerauLevenshtein, editLimit, NgramIndex } from '../dist/core/fuzzy.js';
import { score, TIER, popularity } from '../dist/core/rank.js';
import { parseCoords, parseListRequest } from '../dist/core/intent.js';
import { validatePlan, compileAdql, describePlan, TYPES } from '../dist/core/plan.js';
import { buildIndex } from '../dist/core/index.js';

test('normalize: catalogue forms collapse to one key', () => {
  const k = (s) => compact(normalize(s));
  for (const s of ['M31', 'm31', 'M 31', 'Messier 31', 'messier31', '메시에 31', 'Ｍ３１']) assert.equal(k(s), 'm31', s);
  assert.equal(k('ngc7293'), k('NGC  7293'));
  assert.equal(k('NGC 0224'), 'ngc224');
  assert.equal(normalize('NAME Andromeda Galaxy'), 'andromeda galaxy');
  assert.equal(normalize("NAME Barnard's star"), normalize('Barnards Star'));
});

test('normalize: Greek letters and names become SIMBAD abbreviations', () => {
  const want = normalize('* alf Ori');
  assert.equal(want, 'alf ori');
  for (const s of ['alpha Ori', 'α Ori', 'Alpha ori', 'ALF ORI']) assert.equal(normalize(s), want, s);
  assert.equal(normalize('* alf01 Lib'), normalize('alpha1 Lib'));
  assert.equal(normalize('α² Lib'), normalize('alpha2 Lib'));
});

test('normalize helpers', () => {
  assert.equal(displayId('NAME Andromeda Galaxy'), 'Andromeda Galaxy');
  assert.equal(displayId('* alf Ori'), 'alf Ori');
  assert.equal(displayId('V* V645 Cen'), 'V645 Cen');
  assert.deepEqual(starNameVariants('* alf Ori'), ['Alpha Orionis']);
  assert.deepEqual(starNameVariants('* alf Cen A'), ['Alpha Centauri A']);
  assert.deepEqual(starNameVariants('* 61 Cyg'), ['61 Cygni']);
  assert.deepEqual(starNameVariants('HD 1234'), []);
  assert.equal(digitsOf('ngc 7293'), '7293');
});

test('hangul: jamo, initials', () => {
  assert.equal(toJamo('한'), 'ㅎㅏㄴ');
  assert.equal(toJamo('과'), 'ㄱㅗㅏ'); // compound vowel split
  assert.ok(toJamo('안드로메다').startsWith(toJamo('안드롬'))); // half-typed syllable is a jamo prefix
  assert.equal(toJamo('ᄋ'), 'ㅇ'); // conjoining jamo (from NFKC) mapped back
  assert.equal(initials('안드로메다 은하'), 'ㅇㄷㄹㅁㄷㅇㅎ');
  assert.ok(isInitialsQuery('ㅇㄷㄹㅁㄷ'));
  assert.ok(!isInitialsQuery('ㅇ'));
  assert.ok(!isInitialsQuery('ㅇㅏ'));
  assert.equal(syllableCount('M 31 안드로메다'), 5);
  assert.ok(hasHangul('abc 은하') && !hasHangul('abc'));
});

test('fuzzy: Damerau-Levenshtein', () => {
  assert.equal(damerauLevenshtein('galaxy', 'galxy', 3), 1);
  assert.equal(damerauLevenshtein('siruis', 'sirius', 3), 1); // swap
  assert.equal(damerauLevenshtein('abc', 'abc', 0), 0);
  assert.equal(damerauLevenshtein('kitten', 'sitting', 1), 2); // early exit: > max
  assert.equal(damerauLevenshtein(toJamo('안드로매다'), toJamo('안드로메다'), 2), 1); // one jamo
});

test('fuzzy: edit limits and digits', () => {
  assert.equal(editLimit('vega', 4), 0);
  assert.equal(editLimit('nebula', 6), 1);
  assert.equal(editLimit('betelgeuse', 10), 2);
  assert.equal(editLimit('베가', 4), 0);
  assert.equal(editLimit('북극성', 9), 1);
  const ix = new NgramIndex();
  for (const s of ['sirius', 'm31', 'm32', 'ngc7293', 'polaris']) ix.add(s);
  assert.deepEqual(ix.search('siruis', 1).map((h) => ix.strings[h.id]), ['sirius']);
  assert.deepEqual(ix.search('m33', 2), []); // digits never fuzzy
  assert.deepEqual(ix.search('mm31', 1).map((h) => ix.strings[h.id]), ['m31']);
  assert.deepEqual(ix.search('sirius', 0), []);
});

test('rank: tiers dominate, popularity orders within a tier', () => {
  const base = { bm25: 0, coverage: 1, edits: 0, extra: 0 };
  assert.ok(score({ ...base, kind: 'exact', nbref: 1 }) > score({ ...base, kind: 'prefix', nbref: 100000 }));
  assert.ok(score({ ...base, kind: 'word', nbref: 5000 }) > score({ ...base, kind: 'word', nbref: 50 }));
  assert.ok(score({ ...base, kind: 'fuzzy', nbref: 100, edits: 2 }) < score({ ...base, kind: 'fuzzy', nbref: 100, edits: 1 }));
  assert.ok(TIER.exact > TIER.prefix && TIER.prefix > TIER.word && TIER.word > TIER.fuzzy);
  assert.equal(popularity(0), 0);
});

test('intent: coordinates', () => {
  assert.deepEqual(parseCoords('10.684 41.269'), { ra: 10.684, dec: 41.269 });
  const p = parseCoords('05:35:17.3 -05:23:28');
  assert.ok(p && Math.abs(p.ra - 83.822) < 0.001 && Math.abs(p.dec + 5.391) < 0.001);
  assert.equal(parseCoords('M 31'), null);
  assert.equal(parseCoords('10 20'), null);
  assert.equal(parseCoords('400.0 10.0'), null);
  assert.equal(parseCoords('10 nearest brown dwarfs'), null);
});

test('intent: list requests', () => {
  assert.deepEqual(parseListRequest('가장 가까운 갈색왜성'), { type: 'brown_dwarf', sort: 'nearest', nearText: null, limit: 10, qualified: true });
  assert.equal(parseListRequest('brightest red supergiants')?.type, 'red_supergiant');
  const n = parseListRequest('오리온 성운 근처의 어린 별');
  assert.equal(n?.type, 'young_star');
  assert.equal(n?.nearText, '오리온 성운');
  assert.equal(parseListRequest('young stars near the Orion Nebula')?.nearText, 'orion nebula');
  assert.equal(parseListRequest('가장 가까운 백색왜성 5개')?.limit, 5);
  assert.equal(parseListRequest('10 nearest brown dwarfs')?.limit, 10);
  assert.equal(parseListRequest('블랙홀이 있는 곳을 보고 싶어'), null); // leftover words
  assert.equal(parseListRequest('Crab Nebula'), null);
  assert.equal(parseListRequest('오늘 저녁 뭐 먹지'), null);
});

test('plan: validate, compile, describe', () => {
  assert.equal(validatePlan({ kind: 'list', type: 'nope' }).ok, false);
  assert.equal(validatePlan({ kind: 'list', type: 'galaxy', near: "x'; DROP" }).ok, false);
  const v = validatePlan({ kind: 'list', type: 'brown_dwarf', sort: 'nearest', limit: 99 });
  assert.ok(v.ok);
  assert.equal(v.plan.limit, 20);
  const { adql, sortUsed } = compileAdql(v.plan);
  assert.equal(sortUsed, 'nearest');
  assert.match(adql, /^SELECT TOP 60 main_id, ra, dec, otype, nbref, plx_value FROM basic WHERE \(otype='BD\*'\) AND plx_value IS NOT NULL ORDER BY plx_value DESC$/);
  const g = compileAdql({ kind: 'list', type: 'galaxy', sort: 'nearest', near: 'M 42', limit: 5 }, { ra: 83.82, dec: -5.39 });
  assert.equal(g.sortUsed, 'famous'); // distance ordering is not offered for extended objects
  assert.match(g.adql, /CIRCLE\('ICRS', 83\.82000, -5\.39000, 1\.0\)/);
  assert.equal(describePlan(v.plan).ko, '갈색왜성 · 가까운 순 · 20개');
  assert.match(describePlan(v.plan).en, /nearest first · 20 results\.$/);
  assert.equal(Object.keys(TYPES).length, 35);
});

test('index + search on a tiny synthetic index', async () => {
  const { createSkySearch } = await import('../dist/core/search.js');
  const data = {
    v: 1,
    otypes: { G: 'Galaxy' },
    objects: [
      ['M 31', 10.68471, 41.26875, 'G', 13836, ['NAME Andromeda Galaxy', 'NGC 224'], ['안드로메다 은하']],
      ['M 32', 10.67427, 40.86517, 'G', 3000, ['NGC 221'], []],
      ['* alf Ori', 88.79294, 7.40706, 's*r', 1804, ['NAME Betelgeuse', 'HD 39801'], ['베텔게우스']],
    ],
  };
  const ix = buildIndex(data);
  assert.equal(ix.objects.length, 3);
  assert.equal(ix.objects[0].name, 'Andromeda Galaxy');
  const ss = createSkySearch(data);
  assert.equal(ss.size, 3);
  assert.equal(ss.suggest('andro')[0].object.id, 'M 31');
  assert.equal(ss.suggest('ㅂㅌ')[0].object.id, '* alf Ori');
  assert.equal(ss.suggest('안드로', { lang: 'en' })[0].label, 'Andromeda Galaxy');
  const r = ss.interpret('m31');
  assert.equal(r.kind, 'object');
  assert.equal(r.best.object.id, 'M 31');
  assert.equal(r.confident, true);
  assert.equal(ss.interpret('m33').kind, 'unknown'); // never M 31/M 32 by digit typo
  assert.equal(ss.interpret('Alpha Orionis').best.object.id, '* alf Ori');
  assert.equal(ss.interpret('betelgeuze').best.object.id, '* alf Ori');
  assert.equal(ss.interpret('안드로매다 은하').best.object.id, 'M 31');
  assert.deepEqual(ss.interpret('  '), { kind: 'empty' });
  assert.equal(ss.interpret('1.5 2.5').kind, 'coords');
  const l = ss.interpret('가장 밝은 은하 3개');
  assert.equal(l.kind, 'list');
  assert.deepEqual(l.plan, { kind: 'list', type: 'galaxy', sort: 'brightest', near: null, limit: 3 });
  assert.equal(ss.interpret('galaxies near Nowhere Land').kind, 'unknown');
});
