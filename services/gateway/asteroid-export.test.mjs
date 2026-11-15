import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { ASTEROID_WEB_SCHEMA, exportAsteroidCatalog, exportAsteroidResult, parseAnalysisJson } from './asteroid-export.mjs';

async function fixture(t) {
  const parent = resolve(tmpdir());
  const root = await mkdtemp(join(parent, 'asteroid-export-'));
  t.after(async () => {
    const target = resolve(root);
    assert.ok(target.startsWith(parent + sep) && target.split(sep).at(-1).startsWith('asteroid-export-'));
    await rm(target, { recursive: true });
  });
  const outputs = join(root, 'data', 'prepared', 'asteroids');
  await mkdir(outputs, { recursive: true });
  return { root, outputs, destination: join(root, 'web', '433') };
}

async function recordAt(outputs, id, values = {}) {
  const sourceDir = join(outputs, id);
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, 'integrated_record.json'), JSON.stringify({
    asteroid_id: id, origin: 'OBSERVED', official_name: `${id} Test`, n_spectral_points: 2,
    spectral_class: 'V candidate', classification_confidence: 'Medium',
    spectral_class_probability: [{ rank: 1, class: 'V', complex: 'V-type', probability: 0.9409 }],
    diameter_km: null, missing_data: ['diameter'], limitations: ['The class is a candidate.'],
    ...values,
  }));
  return sourceDir;
}

test('Python nonfinite values become null without changing quoted scientific notes', () => {
  const parsed = parseAnalysisJson('{"note":"NaN and Infinity, escaped \\"quote\\"", "a": NaN, "b": Infinity, "c": -Infinity, "overflow": 1e999, "nested":[3,NaN]}');
  assert.deepEqual(parsed, { note: 'NaN and Infinity, escaped "quote"', a: null, b: null, c: null, overflow: null, nested: [3, null] });
  assert.throws(() => parseAnalysisJson('{"broken": NaNx}'));
  assert.throws(() => parseAnalysisJson('{"broken": undefined}'));
});

test('export preserves records and units and distinguishes searched images from measured coverage', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, '433');
  await writeFile(join(sourceDir, 'stage1_observations.csv'), 'obs_id,detector,mjd_mid,note\r\na,1,60000,"comma, and ""quoted"""\r\na,4,60000,"line\nbreak"\r\nb,2,60010,end\r\n');
  await writeFile(join(sourceDir, 'stage2_spectrum.csv'), 'obs_id,mjd,wavelength_um,flux_uJy\na,60000,1.2,120000\na,60001,2.0,90000\n');
  await writeFile(join(sourceDir, 'stage3_temporal_analysis.json'), '{"sigma": NaN, "explanation": "Infinity is not a measurement"}');
  await writeFile(join(sourceDir, 'report.md'), '# Original report\n');
  await writeFile(join(sourceDir, 'spectrum.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(sourceDir, 'private.env'), 'must not be exported');
  const recordBefore = await readFile(join(sourceDir, 'integrated_record.json'), 'utf8');
  const result = await exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' });
  assert.equal(result.schema, ASTEROID_WEB_SCHEMA);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.numberedId, '433');
  assert.ok(result.aliases.includes('433 Test'));
  assert.match(result.runId, /^saved-[a-f0-9]{20}$/);
  assert.match(result.provenance.recordSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.record, JSON.parse(recordBefore));
  assert.deepEqual(result.counts, { exposures: 3, uniqueExposureIds: 2, points: 2 });
  assert.deepEqual(result.coverage, { start: '2023-02-25T00:00:00.000Z', end: '2023-03-07T00:00:00.000Z' });
  assert.deepEqual(result.measuredCoverage, { start: '2023-02-25T00:00:00.000Z', end: '2023-02-26T00:00:00.000Z' });
  assert.deepEqual(result.assets.plots, [{ kind: 'spectrum', file: 'spectrum.png' }]);
  assert.equal(result.assets.spectrum, 'spectrum.csv');
  assert.equal(result.validation, null);
  assert.match(await readFile(join(f.destination, 'spectrum.csv'), 'utf8'), /flux_uJy\na,60000,1.2,120000/);
  assert.equal(JSON.parse(await readFile(join(f.destination, 'temporal.json'), 'utf8')).sigma, null);
  assert.ok(!(await readdir(f.destination)).includes('private.env'));
  assert.equal(await readFile(join(sourceDir, 'integrated_record.json'), 'utf8'), recordBefore);
});

test('missing measurements, calibration, diameter and validation remain unavailable', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, 'A913_SF', { asteroid_id: 'A913 SF', n_spectral_points: undefined });
  const result = await exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: 'A913_SF' });
  assert.equal(result.record.asteroid_id, 'A913 SF');
  assert.equal(result.record.diameter_km, null);
  assert.equal('spectral_calibration' in result.record, false);
  assert.deepEqual(result.counts, { exposures: null, uniqueExposureIds: null, points: null });
  assert.deepEqual(result.coverage, { start: null, end: null });
  assert.deepEqual(result.assets, { plots: [] });
  assert.equal(result.validation, null);
});

test('catalog excludes intermediate and simulated output folders and uses relative asset locations', async t => {
  const f = await fixture(t);
  await recordAt(f.outputs, '433');
  await recordAt(f.outputs, 'A913_SF', { asteroid_id: 'A913 SF', official_name: '764 Gedania' });
  await recordAt(f.outputs, 'SIMULATED_10', { origin: 'SIMULATED' });
  await mkdir(join(f.outputs, '4'));
  await writeFile(join(f.outputs, '4', 'stage2_spectrum.csv'), 'mjd,flux_uJy\n60000,100\n');
  const index = await exportAsteroidCatalog({ projectRoot: f.root });
  assert.deepEqual(index.targets.map(x => x.id), ['433', 'A913_SF']);
  assert.equal(index.targets[1].detail, 'A913_SF/result.json');
  assert.equal(index.targets[1].objectId, 'A913 SF');
  assert.equal(index.targets[1].numberedId, '764');
  const output = join(f.root, 'apps', 'asteroids', 'public', 'analysis-data');
  assert.deepEqual(JSON.parse(await readFile(join(output, 'index.json'), 'utf8')), index);
  assert.equal(index.targets[0].nSpectralPoints, 2);
});

test('the validation target must match and its failed criterion is preserved', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, '433');
  const validationPath = join(f.root, 'validation.json');
  const validation = { target: '433', origin: 'OBSERVED', reference: { class: 'S' }, criteria: [{ id: 'C7', result: 'FAIL' }] };
  await writeFile(validationPath, JSON.stringify(validation));
  const result = await exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433', validationPath });
  assert.deepEqual(result.validation, validation);
  await writeFile(validationPath, JSON.stringify({ ...validation, target: '10' }));
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433', validationPath }), /does not match/);
  assert.deepEqual(JSON.parse(await readFile(join(f.destination, 'result.json'), 'utf8')), result);
});

test('unsafe ids, overlapping directories and non-observed results are rejected', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, '433');
  for (const id of ['../433', 'a/b', 'a\\b', 'C:433', 'CON', '', '.']) {
    await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id }), /safe directory/);
  }
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: join(sourceDir, 'web'), id: '433' }), /separate directories/);
  await assert.rejects(exportAsteroidCatalog({ projectRoot: f.root, outputRoot: f.outputs }), /must not overlap/);
  await writeFile(join(sourceDir, 'integrated_record.json'), '{"origin":"SIMULATED"}');
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' }), /Only explicitly OBSERVED/);
});

test('malformed CSV or temporal JSON does not replace the previous valid result', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, '433');
  await writeFile(join(sourceDir, 'report.md'), 'Original report');
  await exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' });
  const before = await readFile(join(f.destination, 'result.json'), 'utf8');
  await writeFile(join(sourceDir, 'stage2_spectrum.csv'), 'mjd,flux_uJy\n60000,"unclosed');
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' }), /Unclosed quoted/);
  assert.equal(await readFile(join(f.destination, 'result.json'), 'utf8'), before);
  await writeFile(join(sourceDir, 'stage2_spectrum.csv'), 'mjd,flux_uJy\n60000,100\n');
  await writeFile(join(sourceDir, 'report.md'), 'Changed report');
  await writeFile(join(sourceDir, 'stage3_temporal_analysis.json'), '{bad}');
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' }));
  assert.equal(await readFile(join(f.destination, 'report.md'), 'utf8'), 'Original report');
});

test('a symlinked input cannot export a file from outside the result directory', async t => {
  const f = await fixture(t);
  const sourceDir = await recordAt(f.outputs, '433');
  const secret = join(f.root, 'outside.txt');
  await writeFile(secret, 'outside source');
  try { await symlink(secret, join(sourceDir, 'report.md'), 'file'); }
  catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('This Windows account cannot create file symlinks.');
    throw error;
  }
  await assert.rejects(exportAsteroidResult({ sourceDir, destinationDir: f.destination, id: '433' }), /outside its directory/);
});
