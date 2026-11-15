/* SPDX-License-Identifier: AGPL-3.0-only */
const layers = new Set(['constellations', 'labels', 'atmosphere', 'landscape', 'equatorial', 'azimuthal', 'dss']);

// Accept only the documented public state, never arbitrary property paths.
export function sanitizeViewState(value) {
  const input = value instanceof URLSearchParams ? value : new URLSearchParams(typeof value === 'string' ? value : value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  const result = new URLSearchParams();
  const numeric = (key, min, max) => {
    if (!input.has(key) || !input.get(key).trim()) return false;
    const n = Number(input.get(key));
    if (!Number.isFinite(n) || n < min || n > max) return false;
    result.set(key, String(n)); return true;
  };
  if (!(numeric('lat', -90, 90) && numeric('lon', -180, 180))) { result.delete('lat'); result.delete('lon'); }
  if (result.has('lat') && /^[A-Za-z0-9_-]{1,80}$/.test(input.get('place') || '')) result.set('place', input.get('place'));
  if (['horizon', 'equatorial'].includes(input.get('frame'))) result.set('frame', input.get('frame'));
  if (['sky', 'allsky'].includes(input.get('view'))) result.set('view', input.get('view'));
  numeric('fov', .2, 360); numeric('yaw', -360, 360); numeric('pitch', -90, 90); numeric('speed', -1000000, 1000000);
  if (numeric('ra', 0, 360) && numeric('dec', -90, 90)) {
    result.set('ra', String(Number(result.get('ra')) % 360));
  } else { result.delete('ra'); result.delete('dec'); }
  const time = new Date(input.get('time') || '');
  if (Number.isFinite(time.getTime()) && time.getUTCFullYear() >= 1900 && time.getUTCFullYear() <= 2100) result.set('time', time.toISOString());
  if (input.has('layers')) result.set('layers', input.get('layers').split(',').filter(key => layers.has(key)).join(','));
  return result;
}

export function portalShareUrl(query, planetariumUrl) {
  const url = new URL('../', planetariumUrl);
  url.hash = `planetarium?${sanitizeViewState(query)}`;
  return url.href;
}

// Screen centre for the portal: a Cartesian direction in the astrometric ICRS frame
// (the frame used for the read-out and analysis) plus the field of view in radians,
// returned as right ascension, declination and field of view in degrees.
export function viewCenter(direction, fovRadians) {
  if (!direction || direction.length < 3) return null;
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z);
  if (![x, y, z].every(Number.isFinite) || length === 0 || !Number.isFinite(fovRadians)) return null;
  const ra = ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, z / length))) * 180 / Math.PI;
  return { ra, dec, fov: fovRadians * 180 / Math.PI };
}
