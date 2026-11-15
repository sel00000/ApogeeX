// Publish saved Python analysis without executing or reimplementing the scientific pipeline.
import { mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

export const ASTEROID_WEB_SCHEMA = 'spherex-asteroid-web-1';
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PREPARED_DIRECTORY = ['data', 'prepared', 'asteroids'];
const DATA_DIRECTORY = ['apps', 'asteroids', 'public', 'analysis-data'];
const ASSETS = [
  { source: 'report.md', file: 'report.md', key: 'report' },
  { source: 'stage1_observations.csv', file: 'observations.csv', key: 'observations' },
  { source: 'stage2_spectrum.csv', file: 'spectrum.csv', key: 'spectrum' },
  { source: 'stage3_components_reflectance.csv', file: 'components.csv', key: 'components' },
  { source: 'stage3_temporal_analysis.json', file: 'temporal.json', key: 'temporal' },
  { source: 'web_run.json', file: 'run.json', key: 'run' },
  { source: 'spectrum.png', file: 'spectrum.png', kind: 'spectrum' },
  { source: 'separation.png', file: 'separation.png', kind: 'separation' },
  { source: 'residuals.png', file: 'residuals.png', kind: 'residuals' },
  { source: 'sky_track.png', file: 'sky_track.png', kind: 'sky-track' },
  { source: 'reference_comparison.png', file: 'reference_comparison.png', kind: 'reference-comparison' },
];

function checkedId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
      || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(id)) {
    throw new Error('The asteroid result id must be a safe directory name.');
  }
  return id;
}

function within(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

/** Python's json module can emit NaN / +/-Infinity. Replace tokens, never quoted text. */
export function parseAnalysisJson(text) {
  const input = String(text).replace(/^\uFEFF/, '');
  let normalized = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      normalized += ch;
      if (ch === '\\' && i + 1 < input.length) normalized += input[++i];
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    if (!quoted && (ch === 'N' || ch === 'I' || ch === '-')) {
      const token = /^(?:NaN|-?Infinity)(?=$|[\s,}\]])/.exec(input.slice(i));
      if (token) {
        normalized += 'null';
        i += token[0].length - 1;
        continue;
      }
    }
    normalized += ch;
  }
  // The reviver also handles numerical overflow, e.g. 1e999, as unavailable data.
  return JSON.parse(normalized, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? null : value);
}

function csvRecords(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  const text = input.replace(/^\uFEFF/, '');
  const pushField = () => { row.push(field); field = ''; closedQuote = false; };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closedQuote = true; }
    } else if (ch === ',') pushField();
    else if (ch === '\r' || ch === '\n') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else if (ch === '"' && field === '' && !closedQuote) quoted = true;
    else {
      if (closedQuote || ch === '"') throw new Error('Malformed CSV field in an asteroid output.');
      field += ch;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field in an asteroid output.');
  if (field !== '' || row.length || closedQuote) pushRow();
  if (!rows.length) return [];
  const headers = rows.shift();
  if (headers.some(h => h === '') || new Set(headers).size !== headers.length) throw new Error('Invalid asteroid CSV headers.');
  return rows.map(values => {
    if (values.length !== headers.length) throw new Error('An asteroid CSV row has the wrong number of columns.');
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

function dateCoverage(rows, timeKey) {
  const mjds = (rows || []).map(row => row[timeKey] === '' ? NaN : Number(row[timeKey])).filter(Number.isFinite);
  const iso = mjd => {
    const date = new Date((mjd - 40587) * 86400000);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  };
  return { start: mjds.length ? iso(mjds.reduce((a, b) => Math.min(a, b))) : null,
    end: mjds.length ? iso(mjds.reduce((a, b) => Math.max(a, b))) : null };
}

async function sourceFile(sourceRoot, name) {
  const path = join(sourceRoot, name);
  let physical;
  try { physical = await realpath(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!within(sourceRoot, physical)) throw new Error(`Refusing an asteroid source link outside its directory: ${name}`);
  const info = await stat(physical);
  if (!info.isFile()) throw new Error(`Expected an asteroid output file: ${name}`);
  if (info.size > 32 * 1024 * 1024) throw new Error(`Asteroid output is unexpectedly large: ${name}`);
  return readFile(physical);
}

async function atomicWrite(directory, name, content) {
  const temporary = join(directory, `.${name}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content);
    await rename(temporary, join(directory, name));
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

const jsonText = value => JSON.stringify(value, null, 2) + '\n';

/** Export one completed OBSERVED result. Asset paths are relative to result.json. */
export async function exportAsteroidResult({ sourceDir, destinationDir, id, runId, validationPath } = {}) {
  checkedId(id);
  if (!sourceDir || !destinationDir) throw new Error('Both sourceDir and destinationDir are required.');
  const sourceRoot = await realpath(resolve(sourceDir));
  const destination = resolve(destinationDir);
  if (within(sourceRoot, destination) || within(destination, sourceRoot)) {
    throw new Error('Asteroid export source and destination must be separate directories.');
  }
  const recordBytes = await sourceFile(sourceRoot, 'integrated_record.json');
  if (!recordBytes) throw new Error('The analysis has no integrated_record.json yet.');
  const record = object(parseAnalysisJson(recordBytes.toString('utf8')), 'The integrated record');
  if (record.origin !== 'OBSERVED') throw new Error('Only explicitly OBSERVED asteroid results can be published.');
  const numberedId = typeof record.official_name === 'string' ? /^(\d+)\s/.exec(record.official_name)?.[1] ?? null : null;
  let validation = null;
  if (validationPath) {
    const bytes = await readFile(validationPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (bytes) {
      validation = object(parseAnalysisJson(bytes.toString('utf8')), 'The validation result');
      if (String(validation.target) !== String(record.asteroid_id)) throw new Error('The validation target does not match the analysis record.');
      if (validation.origin && validation.origin !== 'OBSERVED') throw new Error('The validation result is not OBSERVED.');
    }
  }
  // Read and validate everything before writing, so malformed inputs cannot partially replace an export.
  const data = new Map();
  for (const asset of ASSETS) {
    const bytes = await sourceFile(sourceRoot, asset.source);
    if (bytes) data.set(asset.source, bytes);
  }
  if (data.has('stage3_temporal_analysis.json')) {
    const temporal = parseAnalysisJson(data.get('stage3_temporal_analysis.json').toString('utf8'));
    data.set('stage3_temporal_analysis.json', Buffer.from(jsonText(temporal), 'utf8'));
  }
  const runMetadata = data.has('web_run.json') ? object(parseAnalysisJson(data.get('web_run.json').toString('utf8')), 'The run metadata') : null;
  const observations = data.has('stage1_observations.csv') ? csvRecords(data.get('stage1_observations.csv').toString('utf8')) : null;
  const spectrum = data.has('stage2_spectrum.csv') ? csvRecords(data.get('stage2_spectrum.csv').toString('utf8')) : null;
  const assets = { plots: [] };
  for (const asset of ASSETS) {
    if (!data.has(asset.source)) continue;
    if (asset.kind) assets.plots.push({ kind: asset.kind, file: asset.file });
    else assets[asset.key] = asset.file;
  }
  const result = {
    schema: ASTEROID_WEB_SCHEMA,
    schemaVersion: 2,
    id,
    objectId: String(record.asteroid_id ?? id),
    numberedId,
    aliases: [...new Set([id, record.asteroid_id, numberedId, record.official_name].filter(value => typeof value === 'string' && value))],
    runId: runId || `saved-${createHash('sha256').update(recordBytes).digest('hex').slice(0, 20)}`,
    record,
    run: runMetadata,
    provenance: {
      origin: record.origin,
      analysisTimestamp: record.analysis_timestamp ?? null,
      modelVersion: record.model_version ?? null,
      recordSha256: createHash('sha256').update(recordBytes).digest('hex'),
    },
    interpretation: {
      processingState: 'completed',
      completeness: record.quality_status ?? null,
      confidence: record.confidence_level ?? null,
      densityStatus: record.density_status ?? (JSON.stringify(record.limitations || []).match(/density.*hold|ON_HOLD_VALIDATION/i) ? 'on_hold' : 'see_record'),
      note: 'Processing completion and field completeness are not validation or measurement confidence. Thermal, statistical, combined and catalogue diameters retain their separate definitions in record.',
    },
    units: { observationTime: 'MJD UTC', spectrumWavelength: 'um', spectrumFlux: 'uJy', skyAngles: 'deg' },
    // This is the search result range, not necessarily the subset measured after max_images.
    coverage: dateCoverage(observations, 'mjd_mid'),
    measuredCoverage: dateCoverage(spectrum, 'mjd'),
    counts: {
      exposures: observations === null ? null : observations.length,
      uniqueExposureIds: observations === null ? null : new Set(observations.map(row => row.obs_id).filter(Boolean)).size,
      points: spectrum === null ? (Number.isSafeInteger(record.n_spectral_points) && record.n_spectral_points >= 0 ? record.n_spectral_points : null) : spectrum.length,
    },
    validation,
    assets,
  };
  await mkdir(destination, { recursive: true });
  const physicalDestination = await realpath(destination);
  if (within(sourceRoot, physicalDestination) || within(physicalDestination, sourceRoot)) {
    throw new Error('The export destination resolves into the source directory.');
  }
  for (const asset of ASSETS) {
    if (!data.has(asset.source)) continue;
    await atomicWrite(physicalDestination, asset.file, data.get(asset.source));
  }
  await atomicWrite(physicalDestination, 'result.json', jsonText(result));
  return result;
}

/** Export the Python project's completed saved results for ordinary static hosting. */
export async function exportAsteroidCatalog({ projectRoot = moduleRoot, outputRoot, sourceRoot } = {}) {
  const root = resolve(projectRoot);
  const source = await realpath(sourceRoot || join(root, ...PREPARED_DIRECTORY));
  const output = resolve(outputRoot || join(root, ...DATA_DIRECTORY));
  if (within(source, output) || within(output, source)) throw new Error('The catalog destination must not overlap the Python outputs.');
  await mkdir(output, { recursive: true });
  const physicalOutput = await realpath(output);
  if (within(source, physicalOutput) || within(physicalOutput, source)) throw new Error('The catalog destination resolves into the Python outputs.');
  const directories = (await readdir(source, { withFileTypes: true })).filter(entry => entry.isDirectory());
  directories.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const targets = [];
  for (const entry of directories) {
    const sourceDir = join(source, entry.name);
    const bytes = await sourceFile(await realpath(sourceDir), 'integrated_record.json');
    if (!bytes) continue; // Intermediate results (e.g. Vesta) are not complete analyses.
    const record = object(parseAnalysisJson(bytes.toString('utf8')), 'The integrated record');
    if (record.origin !== 'OBSERVED') continue;
    const id = checkedId(entry.name);
    const result = await exportAsteroidResult({
      sourceDir, destinationDir: join(physicalOutput, id), id,
      validationPath: join(source, 'validation', `${id}_taxonomy_validation.json`),
    });
    targets.push({
      id,
      objectId: result.objectId,
      numberedId: result.numberedId,
      aliases: result.aliases,
      runId: result.runId,
      name: typeof record.official_name === 'string' ? record.official_name : String(record.asteroid_id ?? id),
      analysisTimestamp: record.analysis_timestamp ?? null,
      nSpectralPoints: result.counts.points,
      confidence: record.confidence_level ?? null,
      quality: record.quality_status ?? null,
      detail: `${id}/result.json`,
    });
  }
  const index = { schema: ASTEROID_WEB_SCHEMA, generatedAt: new Date().toISOString(), targets };
  await atomicWrite(physicalOutput, 'index.json', jsonText(index));
  return index;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = await exportAsteroidCatalog();
  console.log(`Exported ${index.targets.length} observed asteroid analyses for the web.`);
}
