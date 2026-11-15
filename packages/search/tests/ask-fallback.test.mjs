// The language-model fallback seen from the search service: off without an address, labelled results with one,
// and silent for the visitor when the ask function fails. Fake fetch only: no network, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSearchService } from '../dist/service.js';
import { TEXT } from '../dist/i18n.js';

const catalogue = JSON.parse(await readFile(new URL('../public/sky-index.json', import.meta.url)));
const bodies = JSON.parse(await readFile(new URL('../public/bodies-index.json', import.meta.url)));
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
const SENTENCE = 'bright galaxies near Orion';
const ASK = 'https://ask.example.test/api/ask';
const PLAN = {ok: true, model: 'test-model', plan: {kind: 'list', plan: {kind: 'list', type: 'galaxy', sort: 'brightest', near: 'M 42', limit: 3}}};
const SIMBAD = {
  metadata: [{name: 'main_id'}, {name: 'ra'}, {name: 'dec'}, {name: 'otype'}, {name: 'nbref'}],
  data: [['NGC 1792', 76.30917, -37.98056, 'G', 300], ['NGC 1808', 76.92583, -37.51306, 'G', 500]],
};

/** A fake network: the catalogue files, empty name services, and `ask` for the ask function. Records every URL. */
function network(ask) {
  const urls = [];
  const fetchFn = async (input) => {
    const url = String(input); urls.push(url);
    if (url.includes('bodies-index')) return json(bodies);
    if (url.includes('sky-index')) return json(catalogue);
    if (url.includes('nph-sesame')) return new Response('<?xml version="1.0"?><Sesame><Target><INFO>nothing found</INFO></Target></Sesame>');
    if (url.includes('ssodnet')) return json({data: []});
    if (url.includes('sim-tap')) return json(SIMBAD);
    if (url.startsWith(ASK)) return ask(url);
    throw new Error('unexpected request ' + url);
  };
  return {fetchFn, urls, asked: () => urls.filter(u => u.startsWith(ASK))};
}
const options = (net, extra = {}) => ({indexUrl: 'https://example.test/sky-index.json', fetchFn: net.fetchFn, ...extra});

test('text table: model results carry the label in both languages', () => {
  assert.equal(TEXT.ko.aiCandidate, ' · AI 해석 후보');
  assert.equal(TEXT.en.aiCandidate, ' · AI-interpreted candidate');
});

test('no askUrl, or an empty one, means no ask client: the ask function is never called', async () => {
  for (const extra of [{}, {askUrl: ''}, {askUrl: undefined}]) {
    const net = network(() => json(PLAN));
    const service = createSearchService(options(net, extra));
    const result = await service.search(SENTENCE);
    assert.equal(net.asked().length, 0, JSON.stringify(extra));
    assert.equal(result.items.length, 0);
    assert.equal(result.partial, false);
    assert.equal(result.describe('en'), TEXT.en.noneFound);
    assert.equal(result.describe('ko'), TEXT.ko.noneFound);
  }
});

test('a model answer leads to results labelled as AI-interpreted candidates in both languages', async () => {
  const net = network(() => json(PLAN));
  const service = createSearchService(options(net, {askUrl: ASK}));
  const result = await service.search(SENTENCE);
  assert.equal(net.asked().length, 1);
  assert.equal(net.asked()[0], `${ASK}?q=${encodeURIComponent(SENTENCE)}`);
  assert.ok(net.urls.some(u => u.includes('sim-tap')), 'the list goes to SIMBAD');
  assert.equal(result.items.length, 2);
  for (const item of result.items) {
    assert.equal(item.selection.viaModel, true);
    assert.equal(item.selection.source, 'simbad', 'objects and positions come from SIMBAD, not the model');
    assert.ok(item.texts.en.detail.endsWith(' · AI-interpreted candidate'), item.texts.en.detail);
    assert.ok(item.texts.ko.detail.endsWith(' · AI 해석 후보'), item.texts.ko.detail);
    assert.equal(item.detail, item.texts.en.detail);
  }
  assert.deepEqual(result.items.map(i => [i.selection.name, i.selection.raDeg, i.selection.decDeg]),
    [['NGC 1792', 76.30917, -37.98056], ['NGC 1808', 76.92583, -37.51306]]);
});

test('a forged plan from the ask function is checked again and gives nothing', async () => {
  const net = network(() => json({ok: true, plan: {kind: 'list', plan: {kind: 'list', type: 'unicorn', sort: 'brightest'}}}));
  const result = await createSearchService(options(net, {askUrl: ASK})).search(SENTENCE);
  assert.equal(net.asked().length, 1);
  assert.equal(result.items.length, 0);
  assert.ok(!net.urls.some(u => u.includes('sim-tap')));
  assert.equal(result.describe('en'), TEXT.en.noneFound);
});

test('a failing or unreachable ask function is silent: the normal "nothing found" answer, no error', async () => {
  const failures = {
    'HTTP 503': () => json({ok: false, reason: 'unavailable'}, 503),
    'HTTP 403': () => json({error: 'forbidden'}, 403),
    'HTML page': () => new Response('<html>oops</html>', {status: 500}),
    'network error': () => { throw new TypeError('Failed to fetch'); },
    'not understood': () => json({ok: false, reason: 'not_understood'}),
  };
  for (const [name, ask] of Object.entries(failures)) {
    const net = network(ask);
    const result = await createSearchService(options(net, {askUrl: ASK})).search(SENTENCE);
    assert.equal(net.asked().length, 1, name);
    assert.equal(result.items.length, 0, name);
    assert.equal(result.partial, false, name);
    assert.equal(result.message, TEXT.en.noneFound, name);
    assert.equal(result.describe('ko'), TEXT.ko.noneFound, name);
  }
});

test('a real outage of the other services is still reported even when the ask function also fails', async () => {
  const net = network(() => { throw new TypeError('Failed to fetch'); });
  const fetchFn = async (input) => String(input).includes('nph-sesame') ? new Response('', {status: 502}) : net.fetchFn(input);
  const result = await createSearchService({indexUrl: 'https://example.test/sky-index.json', fetchFn, askUrl: ASK}).search(SENTENCE);
  assert.equal(result.partial, true);
  assert.equal(result.message, TEXT.en.noneExternal);
});

test('mountSearch hands its options, askUrl included, to the search service', async () => {
  // No DOM in node: check the source contract that the browser run (reports/F1) exercises for real.
  const source = await readFile(new URL('../src/search.ts', import.meta.url), 'utf8');
  assert.match(source, /interface MountOptions extends SearchOptions/);
  assert.match(source, /createSearchService\(\{\.\.\.options, lang: \(\) => lang\}\)/);
  const service = await readFile(new URL('../src/service.ts', import.meta.url), 'utf8');
  assert.match(service, /askUrl\?: string;/);
  assert.match(service, /options\.askUrl \? \{askModel: makeAskClient\(fetchRemote, options\.askUrl\)\} : \{\}/);
});
