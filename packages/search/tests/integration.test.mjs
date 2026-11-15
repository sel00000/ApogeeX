import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSearchService, selectionFromItem, bodyChoices, readSesamePosition } from '../dist/service.js';
import { validateIndexData } from '../dist/core/index.js';
import { parseCoords } from '../dist/core/intent.js';
import { federatedSearch } from '../dist/core/federate.js';

const catalogue = JSON.parse(await readFile(new URL('../public/sky-index.json', import.meta.url)));
const bodies = JSON.parse(await readFile(new URL('../public/bodies-index.json', import.meta.url)));
const jsonResponse = value => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}});
const fixtureFetch = async url => String(url).includes('bodies-index') ? jsonResponse(bodies) : jsonResponse(catalogue);

test('real supplied catalogue passes strict schema; corrupted rows and future versions fail explicitly', () => {
  validateIndexData(catalogue);
  for (const changed of [{...catalogue, v: 2}, {...catalogue, objects: [['bad', 360, 0, '*', 1, [], []]]},
    {...catalogue, objects: [['bad', 30, -91, '*', 1, [], []]]}, {...catalogue, objects: [['bad', 30, 0, '*', 1, 'alias', []]]}]) {
    assert.throws(() => validateIndexData(changed));
  }
});

test('coordinates validate minute/second boundaries and preserve negative Unicode declination', () => {
  assert.equal(parseCoords('05:60:00 -05:20:00'), null);
  assert.equal(parseCoords('05:30:60 -05:20:00'), null);
  assert.equal(parseCoords('05:30:00 -05:60:00'), null);
  assert.equal(parseCoords('05:30:00 -05:20:60'), null);
  assert.equal(parseCoords('24:00:00 +00:00:00'), null);
  assert.equal(parseCoords('00:00:00 +90:00:01'), null);
  assert.deepEqual(parseCoords('05:30:00 −05:30:00'), {ra: 82.5, dec: -5.5});
});

test('known targets remain J2000 and map to V2 prepared IDs without present-day propagation', async () => {
  const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn: fixtureFetch});
  for (const [query, id] of [['바너드별', 'barnard'], ['Epsilon Indi B', 'eps_indi_b'], ['WISE 0855-0714', 'wise0855'], ['RW Aurigae', 'rw_aur'], ['R Draconis', 'r_dra']]) {
    const result = await service.search(query);
    const choice = result.items.find(c => c.selection.preparedTargetId === id);
    assert.ok(choice, query);
    assert.equal(choice.selection.coordinateEpoch, 'J2000');
    assert.equal(choice.selection.frame, 'ICRS');
  }
  const selected = (await service.search('바너드별')).items.find(c => c.selection.preparedTargetId === 'barnard').selection;
  assert.equal(selected.raDeg, 269.45208);
  assert.equal(selected.decDeg, 4.69336);
});

test('Epsilon Indi b exoplanet is never silently relabelled as prepared B companion', () => {
  const planet = selectionFromItem({id: '* eps Ind b', label: 'Epsilon Indi b', ra: 330.84022, dec: -56.78598, origin: 'engine', viaModel: false});
  assert.equal(planet.preparedTargetId, undefined);
  const companion = selectionFromItem({id: '* eps Ind B', label: 'Epsilon Indi B', ra: 331.04415, dec: -56.78284, origin: 'engine', viaModel: false});
  assert.equal(companion.preparedTargetId, 'eps_indi_b');
});

test('offline asteroid search identifies the object without claiming fixed coordinates', async () => {
  const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn: fixtureFetch});
  for (const q of ['433', 'Eros', '에로스', '433 Eros']) {
    const result = await service.search(q);
    assert.equal(result.items[0].selection.id, '433');
    assert.equal(result.items[0].selection.kind, 'asteroid');
    assert.equal(result.items[0].selection.raDeg, undefined);
  }
  assert.equal(bodyChoices('499', bodies.objects, true).length, 0);
  assert.equal(bodyChoices('화성', bodies.objects, true)[0].selection.name, 'Mars');
});

test('IMCCE moving candidates carry no frame/epoch/coordinate claims', () => {
  const s = selectionFromItem({label: 'Ceres', id: 'Ceres', origin: 'imcce', otype: 'Asteroid', viaModel: false});
  assert.equal(s.kind, 'asteroid'); assert.equal(s.moving, true);
  assert.equal(s.raDeg, undefined); assert.equal(s.coordinateEpoch, undefined);
});

test('federation deduplicates across 0 degrees at nonzero declination and close to a pole', async () => {
  for (const [ra1, ra2, dec] of [[359.999, 0.001, 50], [80, 210, 89.999]]) {
    const result = await federatedSearch('unknown', {engine: {interpret: () => ({kind: 'unknown'})},
      resolveName: async () => [{name: 'first', ra: ra1, dec}, {name: 'second', ra: ra2, dec}],
      resolveSolarSystem: async () => [], runList: async () => []});
    assert.equal(result.items.length, 1);
  }
});

test('invalid coordinates fail before network lookup; invalid remote coordinates are rejected', async () => {
  let called = false;
  // Changed by the user's instruction (English is the default language): the Korean wording is now asked for with lang 'ko'.
  const service = createSearchService({lang: 'ko', fetchFn: async () => {called = true; return jsonResponse({});}});
  await assert.rejects(service.search('05:70:00 -05:20:00'), /좌표/);
  await assert.rejects(createSearchService({fetchFn: async () => {called = true; return jsonResponse({});}}).search('05:70:00 -05:20:00'), /Check the coordinates/);
  assert.equal(called, false);
  assert.equal(readSesamePosition('<jradeg>NaN</jradeg><jdedeg>0</jdedeg>', 'bad'), null);
  assert.equal(readSesamePosition('<jradeg>30</jradeg><jdedeg>-91</jdedeg>', 'bad'), null);
});

test('abort while index loads cannot publish a late result; a later independent lookup succeeds', async () => {
  let release;
  const held = new Promise(resolve => {release = resolve;});
  const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn: async url => {
    if (url.includes('sky-index')) await held;
    return fixtureFetch(url);
  }});
  const controller = new AbortController();
  const result = service.search('M31', controller.signal);
  controller.abort(); release();
  await assert.rejects(result, {name: 'AbortError'});
  assert.ok((await service.search('M31')).items.length);
});

test('failed catalogue download can be retried rather than caching the error forever', async () => {
  let fail = true;
  const service = createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn: async url => {
    if (url.includes('sky-index') && fail) return new Response('temporary', {status: 503});
    return fixtureFetch(url);
  }});
  await assert.rejects(service.ready(), /503/);
  fail = false;
  assert.ok((await service.search('M31')).items.length);
});
