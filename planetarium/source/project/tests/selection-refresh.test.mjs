import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { buildAnalysisUrl, targetFromApparentVector, archiveTargetFromSelection, withObservationContext } from '../src/analysis-target.js';
import { loadEngine } from '../scripts/check-astrometry.mjs';
import { sanitizeViewState, viewCenter } from '../src/view-state.js';
import { getLang, locale, onLangChange, t } from '../src/i18n.js';

// Run the actual app event functions and actual analysis controller together.
// Only the engine/DOM are replaced; the test must catch a missing refresh call
// in syncTime/changeLocation, rather than testing updateSelection in isolation.
const appUrl = new URL('../src/app.js', import.meta.url);
const analysisUrl = new URL('../src/analysis.js', import.meta.url);
const load = async url => (await readFile(url, 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/\bexport function/g, 'function')
  .replaceAll('import.meta.url', JSON.stringify(url.href));
const sources = `${await load(analysisUrl)}\n${await load(appUrl)}`;

function harness(nativeEngine, { layerControls = false } = {}) {
  const elements = new Map();
  const element = selector => {
    if (elements.has(selector)) return elements.get(selector);
    let text = '';
    const events = new Map();
    const node = {
      textWrites: 0, disabled: false, hidden: false, open: false, value: '', dataset: {},
      style: {}, classList: { add() {}, toggle() {}, contains: () => false },
      get textContent() { return text; },
      set textContent(value) { text = value; this.textWrites++; },
      addEventListener: (type, cb) => events.set(type, cb),
      emit: type => events.get(type)?.({}),
      showModal() { this.open = true; },
      setAttribute() {},
      removeAttribute() {},
    };
    elements.set(selector, node);
    return node;
  };
  const observer = { utc: 60000, latitude: 0, longitude: 0, elevation: 0 };
  let reads = 0;
  const moon = {
    designations: () => ['NAME Moon'],
    getInfo(key, obs = observer) {
      reads++;
      if (key === 'radec') {
        // A changing topocentric body: date and each observer component matter.
        const ra = (10 + (obs.utc - 60000) * 12 + obs.longitude * 0.1 + obs.elevation * 1e-6) * Math.PI / 180;
        const dec = (5 + obs.latitude * 0.1) * Math.PI / 180;
        return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), 1];
      }
      return key === 'distance' ? 0.0026 : -12 + (obs.utc - 60000) * 0.1 + obs.latitude * 0.05;
    },
  };
  const engine = nativeEngine ?? {
    observer, core: { selection: moon, lock: moon, fov: 1, landscapes: {}, atmosphere: {} },
    convertFrame: (_obs, _from, _to, v) => v,
    MJD2date: mjd => new Date((mjd - 40587) * 86400000),
    date2MJD: milliseconds => milliseconds / 86400000 + 40587,
    s2c: (ra,dec) => [Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)],
    lookAt() {}, zoomTo(fov) { this.core.fov = fov; },
    c2s: ([x,y,z]) => [Math.atan2(y,x), Math.atan2(z,Math.hypot(x,y))],
    anp: angle => (angle + 2*Math.PI) % (2*Math.PI),
  };
  const context = vm.createContext({
    URL, URLSearchParams, Intl, console, engine, capitals: [], constellationNames: {}, sanitizeViewState, viewCenter, getLang, locale, onLangChange, t,
    buildAnalysisUrl, targetFromApparentVector, archiveTargetFromSelection, withObservationContext, createAnalysisPicker() {}, openParentAnalysis: () => false, integrationPaused: () => false,
    localStorage: { getItem: () => null },
    document: { documentElement: { dataset: {} }, querySelector: element, querySelectorAll: selector => layerControls && selector === '[data-layer]' ? ['landscape','atmosphere'].map(name => { const node = element('#layer-' + name); node.dataset.layer = name; return node; }) : [], addEventListener() {}, activeElement: null, hidden: false },
    window: { addEventListener() {}, innerWidth: 1280 },
    location: { protocol: 'http:', origin: 'http://localhost', href: 'http://localhost/planetarium/' },
    setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {}, requestAnimationFrame: () => 1,
  });
  vm.runInContext(sources, context);
  vm.runInContext('stel = engine; ready = true; renderSelection();', context);
  return { element, engine, moon: engine.core.selection, observer: engine.observer, run: code => vm.runInContext(code, context), reads: () => reads };
}

test('same selected body refreshes coordinates during forward and reverse time playback', () => {
  const h = harness();
  const card = h.element('#selection-coordinates');
  const details = h.element('#selection-details');
  const detailWrites = details.textWrites;
  assert.match(card.textContent, /RA 10\.000000°/);
  h.observer.utc += 30;
  h.run('syncTime()');
  // 30 days happens to wrap a full turn in this fixture; use a further half-day.
  h.observer.utc += 0.5;
  h.run('syncTime()');
  assert.match(card.textContent, /RA 16\.000000°/);
  h.observer.utc -= 1;
  h.run('syncTime()');
  assert.match(card.textContent, /RA 4\.000000°/);
  assert.equal(h.engine.core.selection, h.moon);
  assert.equal(h.engine.core.lock, h.moon);
  assert.equal(details.textWrites, detailWrites, 'status updates must not rebuild the information card');
});

test('fresh embedded visit starts with ground on at current UTC and realtime 1x', async () => {
  const h = harness(undefined, {layerControls:true});
  h.run('location.href = "http://localhost/planetarium/?embed=1";');
  const before = Date.now();
  await h.run('initializeOpeningView()');
  const after = Date.now();
  assert.equal(h.engine.core.landscapes.visible, true);
  assert.equal(h.element('#layer-landscape').checked, true);
  assert.equal(h.engine.core.time_speed, 1);
  assert.equal(h.run('coordinateMode'), 'horizon');
  const actual = h.engine.MJD2date(h.observer.utc).getTime();
  assert.ok(actual >= before - 1 && actual <= after + 1);
});

test('explicit shared ground-off and historical reverse speed are not overwritten at startup', async () => {
  const h = harness(undefined, {layerControls:true});
  h.run('location.href = "http://localhost/planetarium/?embed=1&layers=&time=2026-01-01T00:00:00Z&speed=-10";');
  await h.run('initializeOpeningView()');
  assert.equal(h.engine.core.landscapes.visible, false);
  assert.equal(h.engine.core.time_speed, -10);
  assert.equal(h.engine.MJD2date(h.observer.utc).toISOString(), '2026-01-01T00:00:00.000Z');
});

test('explicit all-sky startup hides ground and atmosphere', async () => {
  const h = harness(undefined, {layerControls:true});
  h.run('location.href = "http://localhost/planetarium/?embed=1&view=allsky"; viewMode = "allsky";');
  h.element('#layer-landscape').checked = true;
  h.element('#layer-atmosphere').checked = true;
  await h.run('initializeOpeningView()');
  assert.equal(h.engine.core.landscapes.visible, false);
  assert.equal(h.engine.core.atmosphere.visible, false);
});

test('portal pause stops rendering and status polling and cancels an armed region preview', () => {
  const h = harness();
  h.run('stel.setRenderPaused = value => globalThis.rendererPaused = value; analysisPicker = {active:true,cancel(){this.active=false;}}; integrationPaused = () => true; syncRendering();');
  assert.equal(h.run('rendererPaused'), true);
  assert.equal(h.run('analysisPicker.active'), false);
  assert.equal(h.run('statusTimer'), null);
  h.run('integrationPaused = () => false; syncRendering();');
  assert.equal(h.run('rendererPaused'), false);
  assert.equal(h.run('statusTimer'), 1);
  assert.equal(h.run('analysisPicker.active'), false, 'returning must not unexpectedly rearm analysis');
});

test('a partial portal camera restore releases previous tracking instead of snapping back', async () => {
  const h = harness();
  await h.run('applySharedView({yaw: "-20", pitch: "30"})');
  assert.equal(h.engine.core.lock, null); assert.equal(h.engine.core.selection, null);
  assert.ok(Math.abs(h.observer.yaw + 20 * Math.PI / 180) < 1e-10);
  assert.ok(Math.abs(h.observer.pitch - Math.PI / 6) < 1e-10);
  assert.equal(h.element('#selection-panel').hidden, true);
});

test('changing observer location immediately refreshes the same selected body', () => {
  const h = harness();
  h.run("changeLocation({name:'Test', latitude:45, longitude:90, elevation:1000})");
  assert.match(h.element('#selection-coordinates').textContent, /RA 10\.158080° · Dec \+5\.078540°/);
  assert.equal(h.engine.core.selection, h.moon);
});

test('paused unchanged coordinates cause no repeated DOM writes', () => {
  const h = harness();
  const fields = ['#selection-coordinates', '#selection-analysis-note', '#selection-details', '#selection-magnitude'].map(h.element);
  const before = fields.map(node => node.textWrites);
  h.run('syncTime(); syncTime(); syncTime();');
  assert.deepEqual(fields.map(node => node.textWrites), before);
});

test('opening analysis between status ticks updates the card to the exact submitted position', () => {
  const h = harness();
  h.observer.utc += 0.25;
  h.element('#selection-analyze').emit('click');
  assert.match(h.element('#selection-coordinates').textContent, /RA 13\.000000°/);
  assert.match(h.element('#analysis-position').textContent, /RA 13\.000000°/);
  const url = new URL(h.element('#analysis-new-tab').href);
  assert.equal(Number(url.searchParams.get('ra')), 13);
});

test('clearing selection removes the available target and polling does not read stale objects', () => {
  const h = harness();
  const readCount = h.reads();
  h.engine.core.selection = null;
  h.run('renderSelection(); syncTime();');
  assert.equal(h.element('#selection-panel').hidden, true);
  assert.equal(h.element('#selection-analyze').disabled, true);
  assert.equal(h.reads(), readCount);
  assert.doesNotMatch(h.element('#selection-coordinates').textContent, /RA /);
});

test('actual WASM Moon card follows date and observer changes and matches the analysis URL', async () => {
  const engine = await loadEngine();
  engine.core.time_speed = 0;
  engine.observer.utc = 61358.5;
  engine.observer.latitude = 37.5665 * Math.PI / 180;
  engine.observer.longitude = 126.978 * Math.PI / 180;
  const moon = engine.getObj('NAME Moon');
  assert(moon, 'the shipped planetary ephemeris must contain the Moon');
  engine.core.selection = moon;
  const h = harness(engine);
  const card = h.element('#selection-coordinates');
  const before = card.textContent;
  const magnitude = h.element('#selection-magnitude');
  const magnitudeBefore = magnitude.textContent;
  const detailWrites = h.element('#selection-details').textWrites;
  engine.observer.utc += 30;
  h.run('syncTime()');
  assert.notEqual(card.textContent, before, 'the same native Moon object must update after a date change');
  assert.notEqual(magnitude.textContent, magnitudeBefore);
  assert.equal(magnitude.textContent, `Apparent magnitude ${moon.getInfo('vmag').toFixed(2)}`);
  const dated = card.textContent;
  h.run("changeLocation({name:'Sydney', latitude:-33.8688, longitude:151.2093, elevation:58})");
  assert.notEqual(card.textContent, dated, 'lunar topocentric parallax must update after relocation');
  assert.equal(magnitude.textContent, `Apparent magnitude ${moon.getInfo('vmag').toFixed(2)}`);
  assert.equal(h.element('#selection-details').textWrites, detailWrites, 'static selection text must retain its DOM content');
  h.element('#selection-analyze').emit('click');
  const url = new URL(h.element('#analysis-new-tab').href);
  const params = url.searchParams;
  const ra = Number(params.get('ra'));
  const dec = Number(params.get('dec'));
  assert.match(card.textContent, new RegExp(`RA ${ra.toFixed(6).replace('.', '\\.')}°`));
  assert(card.textContent.endsWith(`Dec ${dec >= 0 ? '+' : ''}${dec.toFixed(6)}°`));
});

test('forward/reverse updates only the changing magnitude and hides unavailable values', () => {
  const h = harness();
  const field = h.element('#selection-magnitude');
  const staticWrites = h.element('#selection-details').textWrites;
  assert.equal(field.textContent, 'Apparent magnitude -12.00');
  h.observer.utc += 14;
  h.run('syncTime()');
  assert.equal(field.textContent, 'Apparent magnitude -10.60');
  h.observer.utc -= 14;
  h.run('syncTime()');
  assert.equal(field.textContent, 'Apparent magnitude -12.00');
  h.moon.getInfo = () => NaN;
  h.run('updateSelectionMagnitude()');
  assert.equal(field.textContent, '');
  assert.equal(field.hidden, true);
  assert.equal(h.element('#selection-details').textWrites, staticWrites);
});
