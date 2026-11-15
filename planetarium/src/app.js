/* SPHEREx Sky Lab planetarium — SPDX-License-Identifier: AGPL-3.0-only */
import { capitals } from './capitals.js';
import { constellationNames } from './constellation-names.js';
import { createAnalysisController } from './analysis.js';
import { createAnalysisPicker } from './analysis-picker.js';
import { integrationPaused, registerIntegration, shareView } from './integration.js';
import { sanitizeViewState } from './view-state.js';
import { mountSupplemental } from './supplemental.js';
import { getLang, locale, onLangChange, t } from './i18n.js';
import { viewCenter } from './view-state.js';
let analysisPicker = null;

const $ = (selector) => document.querySelector(selector);
const rad = Math.PI / 180;
const base = new URL('../', import.meta.url);
const asset = (path) => new URL(path, base).href;
const presets = {
  seoul: { name: '서울', nameEn: 'Seoul', country: '대한민국', cityEnglish: 'Seoul', countryCode: 'KR', latitude: 37.5665, longitude: 126.9780, elevation: 38 },
  jinju: { name: '진주', nameEn: 'Jinju', country: '대한민국', cityEnglish: 'Jinju', countryCode: 'KR', latitude: 35.1806, longitude: 128.1076, elevation: 28 },
  busan: { name: '부산', nameEn: 'Busan', country: '대한민국', cityEnglish: 'Busan', countryCode: 'KR', latitude: 35.1796, longitude: 129.0756, elevation: 30 },
};
for (const [id, place] of Object.entries(presets)) place.id = id;
const countryNamesEnglish = new Intl.DisplayNames(['en'], { type: 'region' });
const countryAliases = { AU: '호주', KR: '한국 South Korea', KP: '북한 North Korea', US: 'USA 미합중국', GB: 'UK', ZA: '남아공 남아프리카공화국', AE: 'UAE', SA: '사우디' };
const capitalLocations = capitals.map((capital) => {
  const countryEnglish = countryNamesEnglish.of(capital.countryCode) ?? capital.countryCode;
  return { ...capital, name: `${capital.country} · ${capital.city}`, nameEn: `${countryEnglish} · ${capital.cityEnglish ?? capital.countryCode}`, countryEnglish, aliases: countryAliases[capital.countryCode], elevation: capital.elevation ?? 0 };
}).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
const capitalLocationsEnglish = [...capitalLocations].sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'));
// Korean names are the original data; English names come from GeoNames and the browser's region names.
const placeName = (place) => (!place ? '' : place.id === 'custom' || !place.nameEn ? (place.id === 'custom' ? t('location.custom') : place.name) : getLang() === 'ko' ? place.name : place.nameEn);
const locations = new Map([...Object.values(presets), ...capitalLocations].map((place) => [place.id, place]));
const customStorageKey = 'stellarium-web-lab.custom-location';
let customLocation = { latitude: presets.seoul.latitude, longitude: presets.seoul.longitude };
try {
  const saved = JSON.parse(localStorage.getItem(customStorageKey));
  if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude) && Math.abs(saved.latitude) <= 90 && Math.abs(saved.longitude) <= 180) customLocation = saved;
} catch { /* Coordinates remain usable when browser storage is unavailable. */ }
const objects = [
  { name: '달', id: 'Moon', aliases: ['moon', '달'], type: '지구의 위성', fov: 6 },
  { name: '태양', id: 'Sun', aliases: ['sun', '태양', '해'], type: '항성', fov: 8 },
  { name: '수성', id: 'Mercury', aliases: ['mercury', '수성'], type: '행성', fov: 12 },
  { name: '금성', id: 'Venus', aliases: ['venus', '금성', '샛별'], type: '행성', fov: 12 },
  { name: '화성', id: 'Mars', aliases: ['mars', '화성'], type: '행성', fov: 12 },
  { name: '목성', id: 'Jupiter', aliases: ['jupiter', '목성'], type: '행성', fov: 8 },
  { name: '토성', id: 'Saturn', aliases: ['saturn', '토성'], type: '행성', fov: 8 },
  { name: '천왕성', id: 'Uranus', aliases: ['uranus', '천왕성'], type: '행성', fov: 12 },
  { name: '해왕성', id: 'Neptune', aliases: ['neptune', '해왕성'], type: '행성', fov: 12 },
  { name: '북극성', id: 'Polaris', aliases: ['polaris', '북극성'], type: '항성', fov: 24 },
  { name: '시리우스', id: 'Sirius', aliases: ['sirius', '시리우스'], type: '항성', fov: 24 },
  { name: '베가', id: 'Vega', aliases: ['vega', '베가', '직녀성'], type: '항성', fov: 24 },
  { name: '알타이르', id: 'Altair', aliases: ['altair', '알타이르', '견우성'], type: '항성', fov: 24 },
  { name: '베텔게우스', id: 'Betelgeuse', aliases: ['betelgeuse', '베텔게우스'], type: '항성', fov: 24 },
  { name: '안드로메다 은하', id: 'M 31', aliases: ['m31', 'm 31', 'andromeda', '안드로메다'], type: '은하 · M 31', fov: 8 },
  { name: '오리온 성운', id: 'M 42', aliases: ['m42', 'm 42', 'orion', '오리온 성운'], type: '성운 · M 42', fov: 5 },
  { name: '플레이아데스', id: 'M 45', aliases: ['m45', 'm 45', 'pleiades', '플레이아데스', '좀생이별'], type: '산개성단 · M 45', fov: 10 },
];
const typeKeys = { '지구의 위성': 'type.moon', 항성: 'type.star', 행성: 'type.planet', '은하 · M 31': 'type.galaxy', '성운 · M 42': 'type.nebula', '산개성단 · M 45': 'type.cluster' };
const isListed = (item) => objects.includes(item);
const objectName = (item) => (isListed(item) ? t(`obj.${item.id}`) : item.name ?? item.id);
const objectType = (item) => (typeKeys[item.type] ? t(typeKeys[item.type]) : item.type);
let stel;
let currentLocation = { ...presets.seoul };
const MAX_TIME_SPEED = 1_000_000;
let statusKey = 'status.preparing';
let loadingKey = 'loading.preparing';
let speedInputDirty = false;
let toastTimer;
let startupTimer;
let statusTimer;
let dssAdded = false;
let ready = false;
let timeInputDirty = false;
let coordinateMode = 'horizon';
let coordinateChangeId = 0;
let coordinateTransition = false;
let viewMode = 'sky';
let viewTransition = false;
let savedSkyView = null;
const MOLLWEIDE_PROJECTION = 5;
const normalize = (value) => value.toLocaleLowerCase().replace(/\s+/g, '').trim();

let toastSource = null;
function toast(message) {
  toastSource = null;
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
}
// A toast built from a dictionary key, so a language switch can re-render it.
function toastT(key, params) {
  toast(t(key, params));
  toastSource = { key, params };
}

function toLocalInput(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fail(key, error) {
  loadingKey = key;
  statusKey = 'status.error';
  ready = false;
  clearTimeout(startupTimer);
  clearInterval(statusTimer);
  for (const button of document.querySelectorAll('.view-controls button')) button.disabled = true;
  $('#loading-overlay').hidden = false;
  $('#loading-overlay').classList.add('error');
  $('#loading-message').textContent = t(key);
  $('#retry-button').hidden = false;
  $('#engine-status').textContent = t(statusKey);
  $('#engine-status').dataset.state = 'error';
  $('#app-controls').disabled = true;
  if (error) console.error(error);
}

function changeLocation(location) {
  currentLocation = { ...location };
  stel.observer.latitude = location.latitude * rad;
  stel.observer.longitude = location.longitude * rad;
  stel.observer.elevation = location.elevation ?? 0;
  $('#latitude').value = String(location.latitude);
  $('#longitude').value = String(location.longitude);
  syncLocationStatus();
  // Nearby bodies have observer-dependent positions even while time is paused.
  analysis.updateSelection();
  updateSelectionMagnitude();
}

function syncLocationStatus() {
  const location = currentLocation;
  $('#location-status').textContent = `${placeName(location)} · ${Math.abs(location.latitude).toFixed(2)}°${location.latitude >= 0 ? 'N' : 'S'} ${Math.abs(location.longitude).toFixed(2)}°${location.longitude >= 0 ? 'E' : 'W'}`;
}

function populateLocations(query = '') {
  const select = $('#location-preset');
  const previous = select.value || 'seoul';
  const match = (place) => !query || normalize([place.name, place.nameEn, place.country, place.city, place.countryCode, place.cityEnglish, place.countryEnglish, place.aliases].filter(Boolean).join(' ')).includes(normalize(query));
  select.replaceChildren(new Option(t('location.customOption'), 'custom'));
  const addGroup = (label, places) => {
    if (!places.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const place of places) group.append(new Option(placeName(place), place.id));
    select.append(group);
  };
  const nearby = Object.values(presets).filter(match);
  const matches = (getLang() === 'ko' ? capitalLocations : capitalLocationsEnglish).filter(match);
  addGroup(t('location.groupNearby'), nearby);
  addGroup(t('location.groupCapitals'), matches);
  const selected = locations.get(previous);
  if (selected && ![...nearby, ...matches].some((place) => place.id === previous)) addGroup(t('location.groupCurrent'), [selected]);
  select.value = previous;
  $('#location-search-status').textContent = query ? t(nearby.length + matches.length === 1 ? 'location.foundOne' : 'location.found', { count: nearby.length + matches.length }) : t('location.capitalCount', { count: capitalLocations.length });
}

function saveCustomLocation(latitude, longitude) {
  customLocation = { latitude, longitude };
  try { localStorage.setItem(customStorageKey, JSON.stringify(customLocation)); } catch { /* Storage is optional. */ }
}

function syncTime() {
  const date = stel.MJD2date(stel.observer.utc);
  $('#time-status').textContent = new Intl.DateTimeFormat(locale(), {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZoneName: 'short',
  }).format(date);
  if (!timeInputDirty && document.activeElement !== $('#observation-time')) $('#observation-time').value = toLocalInput(date);
  $('#fov-status').textContent = `${(stel.core.fov / rad).toFixed(1)}°`;
  $('#map-fov').textContent = `${(stel.core.fov / rad).toFixed(1)}°`;
  syncCoordinates();
  // Update changing values without rebuilding names, descriptions or the card.
  // This follows moving bodies during forward/reverse time playback.
  analysis.updateSelection();
  updateSelectionMagnitude();
}

function centerDirection(frame) {
  return stel.convertFrame(stel.observer, 'VIEW', frame, [0, 0, -1, 0]);
}

function setFovImmediately(fov) {
  // The engine's duration=0 path leaves an older zoom animation active.
  // A near-instant target replaces it so startup/reset cannot snap back.
  stel.core.fov = fov;
  stel.zoomTo(fov, 0.001);
}

function formatRightAscension(angle) {
  // Round before splitting so a minute/second rollover never displays 60.
  const ticks = Math.round(stel.anp(angle) * 43200000 / Math.PI) % 86400000;
  const seconds = ticks / 1000;
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}h ${pad(Math.floor(seconds / 60) % 60)}m ${(seconds % 60).toFixed(3).padStart(6, '0')}s`;
}

function syncCoordinates() {
  const equatorial = coordinateMode === 'equatorial';
  const [longitude, latitude] = stel.c2s(centerDirection(equatorial ? 'ASTROM' : 'OBSERVED'));
  $('#coordinate-longitude-label').textContent = t(equatorial ? 'coords.ra' : 'coords.az');
  $('#coordinate-latitude-label').textContent = t(equatorial ? 'coords.dec' : 'coords.alt');
  $('#coordinate-longitude').textContent = equatorial ? formatRightAscension(longitude) : `${(stel.anp(longitude) / rad).toFixed(3)}°`;
  $('#coordinate-latitude').textContent = `${latitude < 0 ? '−' : '+'}${Math.abs(latitude / rad).toFixed(equatorial ? 6 : 3)}°`;
  $('#coordinate-reference').textContent = t(equatorial ? 'coords.refIcrs' : 'coords.refHorizon');
}

// Screen centre for the portal: astrometric ICRS (J2000) degrees and the field of view, in every coordinate mode.
// While rendering is paused the engine applies a restored direction only on its next frame,
// so a restore made in that state reports the requested centre until rendering resumes.
let pendingCenter = null;
function currentCenter() {
  if (!stel) return null;
  if (pendingCenter && $('#sky-canvas').dataset.rendering === 'paused') return { ...pendingCenter, fov: stel.core.fov / rad };
  pendingCenter = null;
  try { return viewCenter(centerDirection('ASTROM'), stel.core.fov); } catch { return null; }
}

function syncCoordinateText() {
  const equatorial = coordinateMode === 'equatorial';
  $('#toggle-coordinates').setAttribute('aria-label', t(equatorial ? 'viewControls.toHorizon' : 'viewControls.toEquatorial'));
  $('#coordinate-hint').textContent = t(viewMode === 'allsky' ? 'coords.hintAllsky' : equatorial ? 'coords.hintEquatorial' : 'coords.hintHorizon');
}

async function setCoordinateMode(mode, { updateGrid = true } = {}) {
  if (coordinateTransition || !['horizon', 'equatorial'].includes(mode) || (viewMode === 'allsky' && mode !== 'equatorial')) return;
  coordinateTransition = true;
  syncViewControls();
  try {
    const changeId = ++coordinateChangeId;
    const direction = centerDirection('ICRF');
    // Stop a previous object-tracking animation before changing the mount axes.
    stel.core.lock = null;
    stel.lookAt(centerDirection('MOUNT'), 0);
    coordinateMode = mode;
    const equatorial = mode === 'equatorial';
    stel.core.mount_frame = equatorial ? stel.FRAME_ICRF : stel.FRAME_OBSERVED;
    $('#coordinate-system').value = mode;
    $('#equatorial-target').hidden = !equatorial;
    $('#center-marker').hidden = !equatorial;
    $('#toggle-coordinates').setAttribute('aria-pressed', String(equatorial));
    syncCoordinateText();
    if (updateGrid) {
      $('#layer-equatorial').checked = equatorial;
      $('#layer-azimuthal').checked = !equatorial;
      layer('equatorial', equatorial);
      layer('azimuthal', !equatorial);
    }
    // The engine refreshes its mount transform during the animation frame.
    // Keep the same celestial point centered after that transform is available.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (changeId !== coordinateChangeId) return;
    stel.lookAt(stel.convertFrame(stel.observer, 'ICRF', 'MOUNT', direction), 0);
    await new Promise(requestAnimationFrame);
    syncCoordinates();
  } finally {
    coordinateTransition = false;
    syncViewControls();
  }
}

function syncViewControls() {
  const allsky = viewMode === 'allsky';
  const busy = !ready || coordinateTransition || viewTransition;
  document.body.classList.toggle('allsky-view', allsky);
  $('#app-controls').disabled = busy;
  $('#sky-canvas').inert = busy;
  for (const button of document.querySelectorAll('.view-controls button, [data-view], #map-full-view')) button.disabled = busy;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === viewMode));
  $('#toggle-allsky').setAttribute('aria-pressed', String(allsky));
  $('#toggle-allsky').setAttribute('aria-label', t(allsky ? 'viewControls.toSky' : 'viewControls.toAllsky'));
  $('#toggle-coordinates').disabled = busy || allsky;
  $('#toggle-ground').disabled = busy || allsky;
  $('#coordinate-system').disabled = allsky;
  $('#layer-landscape').disabled = allsky;
  $('#layer-atmosphere').disabled = allsky;
  $('#map-banner').hidden = !allsky;
  $('#reset-view').title = t(allsky ? 'viewControls.resetAllsky' : 'viewControls.resetTitle');
  $('#analysis-pick').disabled = busy;
  $('#analysis-field-size').disabled = busy;
  $('#sky-hint').textContent = t(document.body.classList.contains('analysis-picking') ? 'skyHint.picking' : allsky ? 'skyHint.allsky' : 'skyHint.sky');
  if (allsky) $('#coordinate-hint').textContent = t('coords.hintAllsky');
  fitSkyCanvas();
}

function fitSkyCanvas() {
  const canvas = $('#sky-canvas');
  const marker = $('#center-marker');
  if (viewMode !== 'allsky') {
    for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height']) canvas.style.removeProperty(property);
    marker.style.removeProperty('left');
    marker.style.removeProperty('top');
    return;
  }
  const panelOpen = !document.body.classList.contains('panel-closed') && innerWidth > 760;
  const left = panelOpen ? $('#control-panel').getBoundingClientRect().right + 24 : 16;
  $('#map-banner').style.left = `${left}px`;
  const right = innerWidth < 760 ? 64 : 96;
  const top = $('.topbar').getBoundingClientRect().bottom + 96;
  const bottom = innerHeight - $('.observation-status').getBoundingClientRect().top + 24;
  const availableWidth = Math.max(80, innerWidth - left - right);
  const availableHeight = Math.max(40, innerHeight - top - bottom);
  // Mollweide's full-sky ellipse is 2:1. Fit it without cropping either pole.
  const width = Math.min(availableWidth, availableHeight * 2);
  const height = width / 2;
  const x = left + (availableWidth - width) / 2;
  const y = top + (availableHeight - height) / 2;
  Object.assign(canvas.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px` });
  marker.style.left = `${x + width / 2}px`;
  marker.style.top = `${y + height / 2}px`;
}

async function setViewMode(mode) {
  if (viewTransition || coordinateTransition || !['sky', 'allsky'].includes(mode) || mode === viewMode) return;
  viewTransition = true;
  syncViewControls();
  try {
    if (mode === 'allsky') {
      savedSkyView = {
        coordinateMode, direction: centerDirection('ICRF'), fov: stel.core.fov, projection: stel.core.projection, cardinals: stel.core.cardinals.visible,
        layers: Object.fromEntries([...document.querySelectorAll('[data-layer]')].map((input) => [input.dataset.layer, input.checked])),
      };
      await setCoordinateMode('equatorial');
      viewMode = 'allsky';
      stel.core.projection = MOLLWEIDE_PROJECTION;
      stel.core.cardinals.visible = false;
      for (const name of ['landscape', 'atmosphere', 'azimuthal']) {
        $(`[data-layer="${name}"]`).checked = false;
        layer(name, false);
      }
      syncViewControls();
      resetView();
      if (innerWidth < 760) setPanel(false);
    } else {
      viewMode = 'sky';
      setFovImmediately(Math.min(savedSkyView.fov, 150 * rad));
      stel.core.projection = savedSkyView.projection;
      stel.core.cardinals.visible = savedSkyView.cardinals;
      await setCoordinateMode(savedSkyView.coordinateMode, { updateGrid: false });
      for (const [name, enabled] of Object.entries(savedSkyView.layers)) {
        $(`[data-layer="${name}"]`).checked = enabled;
        layer(name, enabled);
      }
      stel.lookAt(stel.convertFrame(stel.observer, 'ICRF', 'MOUNT', savedSkyView.direction), 0);
      setFovImmediately(Math.min(savedSkyView.fov, 150 * rad));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    syncTime();
  } finally {
    viewTransition = false;
    syncViewControls();
  }
}

function goToEquatorialCoordinates(event) {
  event.preventDefault();
  const ra = $('#target-ra').valueAsNumber;
  const dec = $('#target-dec').valueAsNumber;
  if (!Number.isFinite(ra) || ra < 0 || ra > 24 || !Number.isFinite(dec) || Math.abs(dec) > 90) {
    toastT('coords.invalid');
    return;
  }
  const direction = stel.s2c((ra % 24) * 15 * rad, dec * rad);
  stel.core.selection = null;
  stel.core.lock = null;
  // lookAt's direction follows the active mount, including equatorial mode.
  stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', direction), 0.5);
  renderSelection();
  toastT('coords.moving', { ra: ra % 24, dec });
}

function setSpeed(speed) {
  if (!Number.isFinite(speed)) return;
  const limitedSpeed = Math.max(-MAX_TIME_SPEED, Math.min(MAX_TIME_SPEED, speed));
  speedInputDirty = false;
  $('#time-speed-input').value = String(limitedSpeed);
  $('#time-speed-input').removeAttribute('aria-invalid');
  $('#time-speed-hint').textContent = t('time.speedHint');
  stel.core.time_speed = limitedSpeed;
  syncSpeedControls();
}

function syncSpeedControls() {
  const speed = stel.core.time_speed;
  $('#time-backward').classList.toggle('is-active', speed < 0);
  $('#time-stop').setAttribute('aria-pressed', String(speed === 0));
  $('#time-forward').classList.toggle('is-active', speed > 0);
  $('#time-backward').disabled = speed <= -MAX_TIME_SPEED;
  $('#time-forward').disabled = speed >= MAX_TIME_SPEED;
  $('#time-state').textContent = t(speed === 0 ? 'time.stopped' : speed === 1 ? 'time.realtime' : speed > 0 ? 'time.forward' : 'time.reverse');
  const magnitude = Math.abs(speed);
  const multiplier = magnitude > 0 && magnitude < 0.001
    ? Number(magnitude.toPrecision(6)).toExponential()
    : magnitude.toLocaleString(locale(), { maximumSignificantDigits: 6 });
  $('#time-multiplier').textContent = `×${multiplier}`;
  $('#time-speed').title = t('time.speedTitle', { speed });
  if (!speedInputDirty && document.activeElement !== $('#time-speed-input')) $('#time-speed-input').value = String(speed);
}

function applyTypedSpeed(reportError = true) {
  if (!ready) return;
  const input = $('#time-speed-input');
  const speed = input.valueAsNumber;
  if (!Number.isFinite(speed) || Math.abs(speed) > MAX_TIME_SPEED) {
    input.setAttribute('aria-invalid', 'true');
    $('#time-speed-hint').textContent = t('time.speedInvalid');
    if (reportError) input.reportValidity();
    return;
  }
  setSpeed(speed);
}

function stepTimeSpeed(direction) {
  let speed = stel.core.time_speed;
  // Match Stellarium's 10-fold time-step controls through reverse, stop and +1.
  if (direction > 0) {
    if (speed >= 1) speed *= 10;
    else if (speed < -1) speed /= 10;
    else speed = speed >= 0 ? 1 : 0;
  } else {
    if (speed > 1) speed /= 10;
    else if (speed <= -1) speed *= 10;
    else speed = speed <= 0 ? -1 : 0;
  }
  setSpeed(speed);
}

function resetView() {
  ++coordinateChangeId;
  stel.core.selection = null;
  stel.core.lock = null;
  const direction = coordinateMode === 'equatorial'
    ? stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', stel.s2c(0, 0))
    : stel.s2c(0, 15 * rad);
  stel.lookAt(direction, 0);
  if (viewMode === 'allsky') setFovImmediately(360 * rad);
  else stel.zoomTo(100 * rad, 0.5);
  renderSelection();
}

function layer(name, enabled) {
  if (viewMode === 'allsky' && ['landscape', 'atmosphere'].includes(name)) enabled = false;
  const c = stel.core;
  switch (name) {
    case 'constellations': c.constellations.lines_visible = enabled; break;
    case 'labels': c.constellations.labels_visible = enabled; break;
    case 'atmosphere': c.atmosphere.visible = enabled; break;
    case 'landscape':
      c.landscapes.visible = enabled;
      c.landscapes.fog_visible = enabled;
      syncGroundControls();
      break;
    case 'equatorial': c.lines.equatorial.visible = enabled; break;
    case 'azimuthal': c.lines.azimuthal.visible = enabled; break;
    case 'dss':
      if (enabled && !dssAdded) {
        c.dss.addDataSource({ url: 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color' });
        dssAdded = true;
      }
      c.dss.visible = enabled;
      if (enabled) toastT('layers.dssToast');
      break;
  }
}

function syncGroundControls() {
  const enabled = Boolean(stel.core.landscapes.visible);
  $('#layer-landscape').checked = enabled;
  $('#toggle-ground').setAttribute('aria-pressed', String(enabled));
  const label = t(enabled ? 'viewControls.groundOff' : 'viewControls.groundOn');
  $('#toggle-ground').setAttribute('aria-label', label);
  $('#toggle-ground').title = label;
}

function toggleGround() {
  if (!ready) return;
  if (viewMode === 'allsky') return toastT('ground.allskyHidden');
  const enabled = !stel.core.landscapes.visible;
  layer('landscape', enabled);
  toastT(enabled ? 'ground.on' : 'ground.off');
}

function getObject(id) {
  return stel.getObj(`NAME ${id}`) || stel.getObj(id);
}

function updateSelectionMagnitude() {
  const object = stel.core.selection;
  const magnitude = object ? object.getInfo('vmag', stel.observer) : NaN;
  const field = $('#selection-magnitude');
  const text = Number.isFinite(magnitude) ? t('selection.magnitude', { value: magnitude.toFixed(2) }) : '';
  if (field.textContent !== text) field.textContent = text;
  field.hidden = !text;
}

function renderSelection() {
  const object = stel.core.selection;
  $('#selection-panel').hidden = !object;
  if (!object) { analysis.updateSelection(); updateSelectionMagnitude(); return; }
  const names = object.designations().map((name) => name.replace(/^NAME /, ''));
  const known = objects.find((item) => names.includes(item.id));
  const constellation = names.length === 1 ? constellationNames[names[0]] : null;
  $('#selection-name').textContent = (known && objectName(known)) ?? constellation ?? names[0] ?? t('selection.default');
  const rows = [];
  if (constellation) rows.push(t('selection.constellation'));
  else if (known?.type) rows.push(objectType(known));
  if (names.length) rows.push(names.slice(0, 3).join(' · '));
  $('#selection-details').textContent = rows.join('\n');
  updateSelectionMagnitude();
  analysis.updateSelection();
}

function selectObject(item) {
  if (!ready) return;
  const object = getObject(item.id);
  if (!object) {
    toastT('selection.notFound');
    return;
  }
  stel.core.selection = object;
  stel.pointAndLock(object, 0.8);
  stel.zoomTo((item.fov ?? 12) * rad, 0.8);
  $('#search-input').value = objectName(item);
  $('#search-results').replaceChildren();
  renderSelection();
  if (window.innerWidth < 720) setPanel(false);
  toastT(viewMode === 'allsky' ? 'selection.zoomedAllsky' : 'selection.moved', { name: objectName(item) });
}

function search(query) {
  const normalized = normalize(query);
  const container = $('#search-results');
  container.replaceChildren();
  if (!normalized) return;
  const matches = objects.filter((item) => item.aliases.some((alias) => normalize(alias).includes(normalized)) || normalize(item.name).includes(normalized) || normalize(objectName(item)).includes(normalized));
  for (const item of matches.slice(0, 6)) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    const label = document.createElement('span');
    const detail = document.createElement('small');
    label.textContent = objectName(item);
    detail.textContent = objectType(item);
    button.append(label, detail);
    button.addEventListener('click', () => selectObject(item));
    li.append(button);
    container.append(li);
  }
  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'search-hint';
    li.textContent = t('search.none');
    container.append(li);
  }
}

function setPanel(open) {
  document.body.classList.toggle('panel-closed', !open);
  $('#toggle-panel').setAttribute('aria-expanded', String(open));
  $('#control-panel').inert = !open;
  fitSkyCanvas();
}

async function applySharedView(value = new URL(location.href).searchParams) {
  const params = sanitizeViewState(value);
  // A newly requested direction must release the retained native tracking lock;
  // otherwise the next engine update would snap back to the previous object.
  if (params.has('ra') || params.has('yaw') || params.has('pitch')) {
    stel.core.lock = null; stel.core.selection = null; renderSelection();
  }
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (params.has('lat') && params.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const sharedPlace = locations.get(params.get('place'));
    if (sharedPlace && Math.abs(sharedPlace.latitude - lat) < 0.00002 && Math.abs(sharedPlace.longitude - lon) < 0.00002) {
      changeLocation(sharedPlace);
      $('#location-preset').value = sharedPlace.id;
    } else {
      changeLocation({ id: 'custom', name: '사용자 위치', latitude: lat, longitude: lon, elevation: 0 });
      customLocation = { latitude: lat, longitude: lon };
      $('#location-preset').value = 'custom';
    }
  }
  const time = new Date(params.get('time') ?? '');
  if (Number.isFinite(time.getTime()) && time.getFullYear() >= 1900 && time.getFullYear() <= 2100) stel.observer.utc = stel.date2MJD(time.getTime());
  if (params.get('view') === 'allsky') await setViewMode('allsky');
  else if (params.get('view') === 'sky') await setViewMode('sky');
  if (params.has('frame') && viewMode !== 'allsky') await setCoordinateMode(params.get('frame'));
  if (params.has('speed')) setSpeed(Number(params.get('speed')));
  for (const [key, min, max, apply] of [
    ['fov', 0.2, viewMode === 'allsky' ? 360 : 150, (value) => { setFovImmediately(value * rad); }],
    ['yaw', -360, 360, (value) => { stel.observer.yaw = value * rad; }],
    ['pitch', -90, 90, (value) => { stel.observer.pitch = value * rad; }],
  ]) {
    const value = Number(params.get(key));
    if (params.has(key) && Number.isFinite(value) && value >= min && value <= max) apply(value);
  }
  const sharedLayers = params.get('layers');
  // Analysis links back with astrometric ICRS coordinates in degrees. Keep them independent
  // of translated labels and of the observer's horizon / time settings.
  const targetRa = Number(params.get('ra'));
  const targetDec = Number(params.get('dec'));
  if (params.get('ra')?.trim() && params.get('dec')?.trim() && Number.isFinite(targetRa) && Number.isFinite(targetDec) && Math.abs(targetDec) <= 90) {
    await setCoordinateMode('equatorial');
    const direction = stel.s2c(((targetRa % 360 + 360) % 360) * rad, targetDec * rad);
    stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', direction), 0);
    pendingCenter = { ra: (targetRa % 360 + 360) % 360, dec: targetDec };
  }
  if (sharedLayers !== null) {
    const names = new Set(sharedLayers.split(','));
    for (const input of document.querySelectorAll('[data-layer]')) {
      input.checked = names.has(input.dataset.layer);
    }
  }
}

function serializeView() {
  const yawDegrees = ((stel.observer.yaw / rad + 180) % 360 + 360) % 360 - 180;
  return {
    lat: currentLocation.latitude.toFixed(5), lon: currentLocation.longitude.toFixed(5),
    place: currentLocation.id ?? 'custom', frame: coordinateMode, view: viewMode,
    time: stel.MJD2date(stel.observer.utc).toISOString(), speed: String(stel.core.time_speed),
    fov: (stel.core.fov / rad).toFixed(6), yaw: yawDegrees.toFixed(6), pitch: (stel.observer.pitch / rad).toFixed(6),
    layers: [...document.querySelectorAll('[data-layer]:checked')].map(input => input.dataset.layer).join(','),
  };
}

async function restoreView(query) {
  if (!ready) throw new Error(t('error.notReady'));
  await applySharedView(query);
  for (const input of document.querySelectorAll('[data-layer]')) layer(input.dataset.layer, input.checked);
  syncViewControls(); syncTime(); renderSelection();
}

async function initializeOpeningView() {
  stel.observer.utc = stel.date2MJD(Date.now());
  setSpeed(1);
  resetView();
  await applySharedView();
  const initial = sanitizeViewState(new URL(location.href).searchParams);
  // A fresh visit starts at the present time with ground visible. Explicit
  // shared states keep their chosen layers/time; an all-sky map has no ground.
  if (!initial.toString()) $('#layer-landscape').checked = true;
  else if (viewMode === 'allsky') {
    $('#layer-landscape').checked = false; $('#layer-atmosphere').checked = false;
  }
  for (const input of document.querySelectorAll('[data-layer]')) layer(input.dataset.layer, input.checked);
}

function setupControls() {
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => setViewMode(button.dataset.view));
  $('#toggle-allsky').addEventListener('click', () => setViewMode(viewMode === 'allsky' ? 'sky' : 'allsky'));
  $('#map-full-view').addEventListener('click', resetView);
  window.addEventListener('resize', fitSkyCanvas);
  $('#coordinate-system').addEventListener('change', (event) => setCoordinateMode(event.target.value));
  $('#toggle-coordinates').addEventListener('click', () => setCoordinateMode(coordinateMode === 'equatorial' ? 'horizon' : 'equatorial'));
  $('#equatorial-target').addEventListener('submit', goToEquatorialCoordinates);
  $('#search-input').addEventListener('input', (event) => search(event.target.value));
  $('#search-input').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $('#search-results').replaceChildren();
    if (event.key === 'ArrowDown') { event.preventDefault(); $('#search-results button')?.focus(); }
  });
  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#search-input').value.trim();
    if (!query) return;
    const item = objects.find((entry) => normalize(entry.name) === normalize(query) || normalize(objectName(entry)) === normalize(query) || entry.aliases.some((alias) => normalize(alias) === normalize(query)));
    selectObject(item ?? { id: query, name: query });
  });
  $('#location-preset').addEventListener('change', (event) => {
    if (event.target.value === 'custom') {
      $('#latitude').value = customLocation.latitude;
      $('#longitude').value = customLocation.longitude;
      $('#latitude').focus();
      return;
    }
    const place = locations.get(event.target.value);
    if (!place) return;
    changeLocation(place);
    toastT('location.placeApplied', { name: placeName(place) });
  });
  $('#location-search').addEventListener('input', (event) => populateLocations(event.target.value.trim()));
  $('#location-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#location-preset').focus(); }
  });
  for (const id of ['#latitude', '#longitude']) $(id).addEventListener('input', () => { $('#location-preset').value = 'custom'; });
  $('#location-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const latitude = $('#latitude').valueAsNumber;
    const longitude = $('#longitude').valueAsNumber;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return toastT('location.invalid');
    const preset = locations.get($('#location-preset').value);
    if (!preset) saveCustomLocation(latitude, longitude);
    changeLocation({ id: preset?.id ?? 'custom', name: preset?.name ?? '사용자 위치', nameEn: preset?.nameEn, latitude, longitude, elevation: preset?.elevation ?? 0 });
    toastT('location.applied');
  });
  $('#observation-time').addEventListener('input', () => { timeInputDirty = true; });
  $('#time-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const date = new Date($('#observation-time').value);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) return toastT('time.invalidYear');
    stel.observer.utc = stel.date2MJD(date.getTime());
    timeInputDirty = false;
    setSpeed(0);
    syncTime();
  });
  $('#time-backward').addEventListener('click', () => stepTimeSpeed(-1));
  $('#time-stop').addEventListener('click', () => setSpeed(0));
  $('#time-forward').addEventListener('click', () => stepTimeSpeed(1));
  $('#time-speed-input').addEventListener('input', () => {
    speedInputDirty = true;
    $('#time-speed-input').removeAttribute('aria-invalid');
    $('#time-speed-hint').textContent = t('time.speedHint');
  });
  $('#time-speed-form').addEventListener('submit', (event) => {
    event.preventDefault();
    applyTypedSpeed();
  });
  $('#time-speed-input').addEventListener('change', () => {
    if (speedInputDirty) applyTypedSpeed(false);
  });
  $('#time-now').addEventListener('click', () => {
    timeInputDirty = false;
    stel.observer.utc = stel.date2MJD(Date.now());
    setSpeed(1);
    syncTime();
    toastT('time.backToNow');
  });
  stel.core.change('time_speed', syncSpeedControls);
  for (const input of document.querySelectorAll('[data-layer]')) input.addEventListener('change', () => layer(input.dataset.layer, input.checked));
  $('#toggle-ground').addEventListener('click', toggleGround);
  document.addEventListener('keydown', (event) => {
    if (integrationPaused() || document.documentElement.dataset.skyTutorialActive === 'true' || !ready || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || $('#help-dialog').open || $('#analysis-dialog').open) return;
    if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || event.target.isContentEditable)) return;
    if (event.code !== 'KeyG' && event.key.toLowerCase() !== 'g') return;
    event.preventDefault();
    toggleGround();
  });
  $('#quality-select').addEventListener('change', (event) => { stel.maxPixelRatio = { performance: 1, balanced: 1.5, detail: 2 }[event.target.value]; });
  $('#zoom-in').addEventListener('click', () => stel.zoomTo(Math.max(0.2 * rad, stel.core.fov * 0.7), 0.3));
  $('#zoom-out').addEventListener('click', () => stel.zoomTo(Math.min((viewMode === 'allsky' ? 360 : 150) * rad, stel.core.fov / 0.7), 0.3));
  $('#reset-view').addEventListener('click', resetView);
  $('#clear-selection').addEventListener('click', () => { stel.core.selection = null; stel.core.lock = null; renderSelection(); });
  $('#copy-link').addEventListener('click', async () => {
    const state = serializeView();
    if (shareView(state)) return;
    const url = new URL(base);
    url.search = new URLSearchParams(state).toString();
    try { await navigator.clipboard.writeText(url.href); toastT('share.copied'); }
    catch { window.prompt(t('share.prompt'), url.href); }
  });
  stel.core.change('selection', renderSelection);
}

async function onReady(engine) {
  try {
    stel = engine;
    // Expose the engine for local integration and scientific extension work.
    window.stellarium = engine;
    const c = stel.core;
    const sky = asset('skydata/');
    c.stars.addDataSource({ url: sky + 'stars' });
    c.skycultures.addDataSource({ url: sky + 'skycultures/western', key: 'western' });
    c.dsos.addDataSource({ url: sky + 'dso' });
    c.landscapes.addDataSource({ url: sky + 'landscapes/guereins', key: 'guereins' });
    c.milkyway.addDataSource({ url: asset('assets/spherex-hips') });
    for (const [body, key] of [['moon', 'moon'], ['sun', 'sun'], ['moon', 'default']]) c.planets.addDataSource({ url: sky + 'surveys/sso/' + body, key });
    c.constellations.show_only_pointed = false;
    populateLocations();
    changeLocation(presets.seoul);
    await initializeOpeningView();
    setupControls();
    const fonts = await Promise.allSettled([
      stel.setFont('regular', asset('fonts/NotoSans-Regular.ttf')),
      stel.setFont('bold', asset('fonts/NotoSans-Bold.ttf')),
    ]);
    if (fonts.some((result) => result.status === 'rejected')) console.warn('외부 폰트를 불러오지 못해 엔진의 기본 폰트를 사용합니다.');
    clearTimeout(startupTimer);
    ready = true;
    analysisPicker = createAnalysisPicker({
      engine: stel, canvas: $('#sky-canvas'), onTarget: analysis.open, onSelection: renderSelection, notify: toast,
      canInteract: () => !integrationPaused() && document.documentElement.dataset.skyTutorialActive !== 'true' && ready && !coordinateTransition && !viewTransition && !$('#help-dialog').open && !$('#analysis-dialog').open,
    });
    syncViewControls();
    syncCoordinateText();
    $('#loading-overlay').hidden = true;
    statusKey = 'status.ready';
    $('#engine-status').textContent = t(statusKey);
    $('#engine-status').dataset.state = 'ready';
    syncTime();
    registerIntegration({
      getState: () => ({ ready, viewMode, coordinateMode, center: currentCenter(), query: serializeView(), selected: $('#selection-name').textContent, selection: !!stel.core.selection, statusPolling: !!statusTimer, rendering: $('#sky-canvas').dataset.rendering }),
      restoreState: restoreView,
      onPauseChanged: syncRendering,
      focusObject: id => selectObject(objects.find(item => item.id === id) || { id, name: id }),
    });
    syncRendering();
    mountSupplemental(async (ra, dec, label) => {
      await setCoordinateMode('equatorial');
      stel.core.selection = null; stel.core.lock = null; renderSelection();
      stel.lookAt(stel.convertFrame(stel.observer, 'ASTROM', 'MOUNT', stel.s2c(ra * rad, dec * rad)), .8);
      stel.zoomTo(12 * rad, .8); toastT('supp.moved', { label });
    }).catch(error => console.warn('Supplemental observation links', error));
    if (window.innerWidth < 720) setPanel(false);
  } catch (error) { fail('error.init', error); }
}

for (const button of document.querySelectorAll('.view-controls button')) button.disabled = true;
$('#toggle-panel').addEventListener('click', () => setPanel(document.body.classList.contains('panel-closed')));
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) $('#help-dialog').close(); });
$('#retry-button').addEventListener('click', () => location.reload());
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toastT('fullscreen.unavailable'); }
});
$('#sky-canvas').addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  ready = false;
  fail('error.contextLost');
});

async function start() {
  if (location.protocol === 'file:') return fail('error.fileProtocol');
  if (!window.WebAssembly) return fail('error.noWasm');
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl') || probe.getContext('experimental-webgl');
  if (!context) return fail('error.noWebgl');
  context.getExtension('WEBGL_lose_context')?.loseContext();
  startupTimer = setTimeout(() => fail('error.slow'), 45000);
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = asset('engine/stellarium-web-engine.js');
      script.onload = resolve;
      script.onerror = () => reject(new Error('Engine script failed to load'));
      document.head.append(script);
    });
    loadingKey = 'loading.engine';
    $('#loading-message').textContent = t(loadingKey);
    const engine = window.StelWebEngine({
      wasmFile: asset('engine/stellarium-web-engine.wasm'), canvas: $('#sky-canvas'), maxPixelRatio: 1.5,
      translateFn: (_domain, text) => text,
      onReady,
      onAbort: (reason) => fail('error.abort', reason),
    });
    if (engine?.catch) engine.catch((error) => fail('error.wasmLoad', error));
  } catch (error) { fail('error.engineMissing', error); }
}
function syncRendering() {
  // Keep the sky and its selection in memory, but stop GPU/CPU work while covered.
  const paused = document.hidden || $('#analysis-dialog').open || document.documentElement.dataset.skyTutorialActive === 'true' || integrationPaused();
  if (paused && analysisPicker?.active) analysisPicker.cancel();
  clearInterval(statusTimer); statusTimer = null;
  if (ready && !paused) statusTimer = setInterval(syncTime, 500);
  if (!stel?.setRenderPaused) return;
  stel.setRenderPaused(paused);
  $('#sky-canvas').dataset.rendering = paused ? 'paused' : 'running';
}
// Switching language rewrites texts only: sky, time, selection, open panels and camera stay as they are.
function relocalize() {
  $('#engine-status').textContent = t(statusKey);
  $('#loading-message').textContent = t(loadingKey);
  if (toastSource && !$('#toast').hidden) $('#toast').textContent = t(toastSource.key, toastSource.params);
  populateLocations($('#location-search').value.trim());
  syncLocationStatus();
  analysisPicker?.relabel();
  analysis.relabel();
  if (!stel || !ready) return relocalizeStartup();
  syncCoordinateText();

  syncViewControls();
  syncGroundControls();
  syncSpeedControls();
  $('#time-speed-hint').textContent = t($('#time-speed-input').getAttribute('aria-invalid') === 'true' ? 'time.speedInvalid' : 'time.speedHint');
  syncTime();
  renderSelection();
  if ($('#search-results').children.length) search($('#search-input').value);
}
// Texts that scripts write before the engine is ready (the static ones follow data-i18n).
function relocalizeStartup() {
  $('#engine-status').textContent = t(statusKey);
  $('#loading-message').textContent = t(loadingKey);
  $('#time-status').textContent = t('time.statusPreparing');
  $('#time-state').textContent = t('time.realtime');
  $('#time-speed-hint').textContent = t('time.speedHint');
  $('#coordinate-reference').textContent = t('coords.refHorizon');
  $('#coordinate-longitude-label').textContent = t('coords.az');
  $('#coordinate-latitude-label').textContent = t('coords.alt');
  $('#coordinate-hint').textContent = t('coords.hintHorizon');
  syncCoordinateText();
  $('#sky-hint').textContent = t('skyHint.sky');
  $('#selection-name').textContent = t('selection.default');
  $('#analysis-pick-hint').textContent = t('picker.normalHint');
}
onLangChange(relocalize);
const analysis = createAnalysisController({ getEngine: () => stel, notify: toast, onVisibilityChange: syncRendering });
document.addEventListener('visibilitychange', syncRendering);
window.addEventListener('sky-tutorial-visibility', syncRendering);
window.addEventListener('pagehide', () => stel?.setRenderPaused?.(true));
window.addEventListener('pageshow', syncRendering);
relocalizeStartup();
start();
