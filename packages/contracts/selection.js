export const SCHEMA_VERSION = 1;
export function normalizeSelection(input) {
  if (!input || typeof input !== 'object') throw new TypeError('A target is required.');
  const value = { schemaVersion: SCHEMA_VERSION, kind: input.kind || 'field', id: input.id ?? input.target ?? null, name: String(input.name ?? input.label ?? '').slice(0, 200) };
  const ra = input.raDeg ?? input.ra, dec = input.decDeg ?? input.dec;
  if (ra != null || dec != null) {
    if (ra === '' || dec === '' || ra == null || dec == null || !Number.isFinite(Number(ra)) || !Number.isFinite(Number(dec)) || Number(dec) < -90 || Number(dec) > 90) throw new RangeError('Invalid celestial coordinates.');
    value.raDeg = ((Number(ra) % 360) + 360) % 360; value.decDeg = Number(dec);
    value.frame = input.frame || 'ICRS';
    // Missing epoch is unknown. Do not silently label apparent positions J2000.
    value.coordinateEpoch = input.coordinateEpoch ?? null;
  }
  for (const key of ['observationMjd','epoch']) if (input[key] != null && Number.isFinite(Number(input[key]))) value[key] = Number(input[key]);
  if (input.timeScale) value.timeScale = input.timeScale;
  if (input.observer) value.observer = input.observer;
  if (input.moving) value.moving = true;
  const fov = input.fovDeg ?? (input.fovArcsec != null ? input.fovArcsec / 3600 : null);
  if (fov != null) { if (!Number.isFinite(Number(fov)) || Number(fov) <= 0 || Number(fov) > 180) throw new RangeError('Invalid field size.'); value.fovDeg = Number(fov); }
  return value;
}
export function angularDistanceDeg(a, b) {
  const rad = Math.PI/180, d = ((b.raDeg-a.raDeg+540)%360-180)*rad;
  const x = Math.sin((b.decDeg-a.decDeg)*rad/2)**2 + Math.cos(a.decDeg*rad)*Math.cos(b.decDeg*rad)*Math.sin(d/2)**2;
  return 2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,x))))/rad;
}
