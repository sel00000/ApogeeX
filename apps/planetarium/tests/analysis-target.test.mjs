import test from 'node:test';
import assert from 'node:assert/strict';
import { targetFromVector, targetFromApparentVector, archiveTargetFromSelection, withObservationContext, buildAnalysisUrl } from '../src/analysis-target.js';

test('astrometric axes and RA wrap are handed off in degrees, not hours or radians', () => {
  for (const [vector, ra, dec] of [
    [[1, 0, 0], 0, 0], [[0, 1, 0], 90, 0], [[-1, 0, 0], 180, 0],
    [[0, -1, 0], 270, 0], [[1, 1, Math.sqrt(2)], 45, 45], [[0, 0, -1], 0, -90],
  ]) {
    const target = targetFromVector(vector, '테스트');
    assert.ok(Math.abs(target.ra - ra) < 1e-10);
    assert.ok(Math.abs(target.dec - dec) < 1e-10);
  }
});

test('selected objects remove apparent effects using a normalized direction, even for finite-distance planets', () => {
  const observer = {};
  const engine = { observer, convertFrame(obs, from, to, v) {
    assert.equal(obs, observer);
    assert.equal(from, 'ICRF'); assert.equal(to, 'ASTROM');
    assert.deepEqual(v, [0, 1, 0, 0]);
    return [0, Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0];
  } };
  for (const vector of [[0, 1, 0, 0], [0, 3, 0, 1]]) {
    const target = targetFromApparentVector(engine, vector, '천체');
    assert.equal(target.ra, 90);
    assert.ok(Math.abs(target.dec - 30) < 1e-10);
    assert.equal(target.label, '천체');
  }
  assert.equal(targetFromApparentVector(engine, [0, 0, 0, 1]), null);
  assert.equal(targetFromApparentVector(null, [1, 0, 0]), null);
});

test('missing or invalid selections cannot silently analyze the origin', () => {
  for (const vector of [null, [], [0, 0, 0], [NaN, 1, 0], [1, Infinity, 0], ['1', 0, 0]]) {
    assert.equal(targetFromVector(vector), null);
  }
  assert.throws(() => buildAnalysisUrl({ ra: 10, dec: 91 }, 'https://example.org/planetarium/'));
});

test('localized labels are display-only and nested deployment paths are preserved', () => {
  const target = { ra: 101.28715533, dec: -16.71611586, label: '시리우스 & <항성>' };
  const url = new URL(buildAnalysisUrl(target, 'https://example.org/my-site/planetarium/'));
  assert.equal(url.pathname, '/my-site/analysis/');
  const params = url.searchParams;
  assert.equal(params.get('label'), target.label);
  assert.equal(params.has('name'), false);
  assert.equal(params.get('embed'), '1');
  assert.equal(Number(params.get('ra')), target.ra);
  assert.equal(Number(params.get('dec')), target.dec);
  assert.equal(new URL(buildAnalysisUrl(target, url.origin + '/my-site/planetarium/', false)).searchParams.has('embed'), false);
});

test('the selected square field side reaches the workbench in arcseconds', () => {
  for (const size of [120, 180, 300, 600]) {
    const target = { ra: 359.999, dec: 45, label: '선택한 네모 영역', fovArcsec: size };
    for (const embedded of [true, false]) {
      const url = new URL(buildAnalysisUrl(target, 'https://example.org/site/planetarium/', embedded));
      assert.equal(url.searchParams.get('fovArcsec'), String(size));
      assert.equal(url.searchParams.get('fov'), String(size / 3600));
    }
  }
  for (const fovArcsec of [0, 59, 781, Infinity, '180', 180.5]) {
    assert.throws(() => buildAnalysisUrl({ ra: 10, dec: 0, fovArcsec }, 'https://example.org/planetarium/'));
  }
});

test('moving body keeps apparent direction and observing context instead of an infinity-only correction', () => {
  let conversions = 0;
  const engine = { observer: { utc: 60000 }, convertFrame() { conversions++; return [0, 1, 0]; } };
  const object = { getInfo: key => key === 'distance' ? .0026 : [1, 0, 0, 1] };
  const target = archiveTargetFromSelection(engine, object, '달');
  assert.equal(conversions, 0);
  assert.equal(target.ra, 0); assert.equal(target.frame, 'apparent-ICRF'); assert.equal(target.moving, true);
  assert.equal(target.observationMjd, 60000); assert.equal(target.timeScale, 'UTC');
  const url = new URL(buildAnalysisUrl(target, 'https://example.test/project/planetarium/'));
  assert.equal(url.searchParams.get('frame'), 'apparent-ICRF');
  assert.equal(url.searchParams.get('observationMjd'), '60000');
  assert.equal(url.searchParams.get('moving'), '1');
});

test('fixed sky region carries observation epoch and explicit angular units', () => {
  const target = withObservationContext({ ra: 45, dec: -30, fovArcsec: 180 }, { observer: { utc: 60000 } });
  assert.equal(target.frame, 'ICRS'); assert.equal(target.fovDeg, .05);
  assert.equal(target.coordinateEpoch, '2023-02-25T00:00:00.000Z');
});
