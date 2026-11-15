/* SPDX-License-Identifier: AGPL-3.0-only */
import { getLang, t } from './i18n.js';
// Convert an astrometric Cartesian direction to archive ICRS degrees.
export function targetFromVector(vector, label = t('selection.default')) {
  if (!vector || vector.length < 3) return null;
  const [x, y, z] = vector;
  if (![x, y, z].every(Number.isFinite) || Math.hypot(x, y, z) === 0) return null;
  const ra = ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
  const dec = Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI;
  return { ra, dec, label };
}

// Object `radec` is an apparent vector in the engine's ICRF axes. Normalize
// explicitly: ASTROM's inverse operates on directions at infinity, including
// when a nearby object's info vector contains a distance component.
export function targetFromApparentVector(engine, vector, label = t('selection.default')) {
  if (!targetFromVector(vector) || typeof engine?.convertFrame !== 'function') return null;
  const length = Math.hypot(...vector.slice(0, 3));
  const direction = [vector[0] / length, vector[1] / length, vector[2] / length, 0];
  return targetFromVector(engine.convertFrame(engine.observer, 'ICRF', 'ASTROM', direction), label);
}

// A solar-system body's apparent direction must not be labeled as a catalogue
// ICRS position by applying the infinity-only inverse. Preserve its observing
// context; the analysis screen explicitly treats it as a fixed-direction query.
export function archiveTargetFromSelection(engine, object, label = t('selection.default')) {
  if (!engine || !object) return null;
  try {
    const vector = object.getInfo('radec', engine.observer);
    const distance = object.getInfo('distance', engine.observer);
    const moving = Number.isFinite(distance) && distance > 0 && distance < 1000;
    const target = moving ? targetFromVector(vector, label) : targetFromApparentVector(engine, vector, label);
    return target ? withObservationContext({ ...target, moving, frame: moving ? 'apparent-ICRF' : 'ICRS' }, engine) : null;
  } catch { return null; }
}

export function withObservationContext(target, engine) {
  if (!target) return null;
  const context = { ...target, frame: target.frame || 'ICRS', timeScale: 'UTC', observer: 'earth' };
  if (Number.isFinite(engine?.observer?.utc)) {
    context.observationMjd = engine.observer.utc;
    const date = new Date((engine.observer.utc - 40587) * 86400000);
    if (Number.isFinite(date.getTime())) context.coordinateEpoch = date.toISOString();
  }
  if (Number.isFinite(target.fovArcsec)) context.fovDeg = target.fovArcsec / 3600;
  return context;
}

export function buildAnalysisUrl(target, planetariumUrl, embedded = true) {
  if (!target || !Number.isFinite(target.ra) || !Number.isFinite(target.dec) || Math.abs(target.dec) > 90) {
    throw new TypeError(t('analysis.badCoords'));
  }
  const url = new URL('../analysis/', planetariumUrl);
  const query = new URLSearchParams({
    ra: (((target.ra % 360) + 360) % 360).toFixed(8), dec: target.dec.toFixed(8),
    label: target.label || t('selection.default'), mode: 'research', lang: getLang(),
  });
  // The portal contract preserves arcseconds; the observation API takes degrees.
  if (target.fovArcsec !== undefined) {
    if (!Number.isInteger(target.fovArcsec) || target.fovArcsec < 60 || target.fovArcsec > 780) {
      throw new TypeError(t('analysis.badField'));
    }
    query.set('fovArcsec', String(target.fovArcsec));
    query.set('fov', String(target.fovArcsec / 3600));
  }
  if (target.target && /^[a-z0-9_-]{1,64}$/.test(target.target)) query.set('target', target.target);
  query.set('frame', target.frame || 'ICRS');
  if (target.moving) query.set('moving', '1');
  if (Number.isFinite(target.observationMjd)) query.set('observationMjd', String(target.observationMjd));
  if (typeof target.coordinateEpoch === 'string') query.set('coordinateEpoch', target.coordinateEpoch);
  if (target.timeScale) query.set('timeScale', target.timeScale);
  if (target.observer) query.set('observer', target.observer);
  if (embedded) query.set('embed', '1');
  url.search = query.toString();
  url.hash = '';
  return url.href;
}
