/* SPDX-License-Identifier: AGPL-3.0-only */
// The workbench's fov is the side of a north-up TAN (gnomonic) field, in
// tangent-plane arcseconds. Project that field, not a fixed-size screen box.
export const DEFAULT_ANALYSIS_FOV_ARCSEC = 180;
export const MIN_ANALYSIS_FOV_ARCSEC = 60;
export const MAX_ANALYSIS_FOV_ARCSEC = 780;
const ARCSEC_PER_RAD = 180 * 3600 / Math.PI;
const RAD = Math.PI / 180;

/** Forward counterpart of sky-click.js's VIEW inverse, in canvas CSS pixels. */
export function projectViewDirection(vector, {
  width, height, fov, projection, flipHorizontal = false, flipVertical = false,
}) {
  if (!vector || vector.length < 3 || !vector.slice(0, 3).every(Number.isFinite) ||
      ![width, height, fov].every(Number.isFinite) || width <= 0 || height <= 0 ||
      fov <= 0 || fov > 2 * Math.PI + 1e-10) return null;
  const length = Math.hypot(...vector.slice(0, 3));
  if (!length) return null;
  const [vx, vy, vz] = vector.map(value => value / length);
  fov = Math.min(fov, 2 * Math.PI);
  let nx;
  let ny;
  if (projection === 2) {
    if (fov >= 2 * Math.PI || 1 - vz < 1e-12) return null;
    const scale = 2 * Math.tan(fov / 4);
    nx = 2 * vx / (1 - vz) / scale * Math.min(width, height) / width;
    ny = 2 * vy / (1 - vz) / scale * Math.min(width, height) / height;
  } else if (projection === 5) {
    const longitude = Math.atan2(vx, -vz);
    const latitude = Math.atan2(vy, Math.hypot(vx, vz));
    // Solve 2 theta + sin(2 theta) = pi sin(phi). Bisection also behaves
    // safely at the poles, where the Newton derivative vanishes.
    const rhs = Math.PI * Math.sin(latitude);
    let low = -Math.PI / 2;
    let high = Math.PI / 2;
    for (let i = 0; i < 54; i++) {
      const mid = (low + high) / 2;
      if (2 * mid + Math.sin(2 * mid) < rhs) low = mid;
      else high = mid;
    }
    const theta = Math.abs(vy) >= 1 - 1e-15 ? Math.sign(vy) * Math.PI / 2 : (low + high) / 2;
    const px = 2 * Math.SQRT2 / Math.PI * longitude * Math.cos(theta);
    const py = Math.SQRT2 * Math.sin(theta);
    nx = px / (fov / Math.PI * Math.SQRT2);
    ny = py / (fov * height / width / Math.PI * Math.SQRT2);
  } else return null;
  if (flipHorizontal) nx *= -1;
  if (flipVertical) ny *= -1;
  const point = { x: (nx + 1) * width / 2, y: (1 - ny) * height / 2 };
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

/** Astrometric ICRS direction at east/north tangent-plane offsets, including at poles. */
export function tangentFieldDirection(target, eastArcsec, northArcsec) {
  if (!target || ![target.ra, target.dec, eastArcsec, northArcsec].every(Number.isFinite) ||
      Math.abs(target.dec) > 90) return null;
  const a = target.ra * RAD;
  const d = target.dec * RAD;
  const east = eastArcsec / ARCSEC_PER_RAD;
  const north = northArcsec / ARCSEC_PER_RAD;
  const ca = Math.cos(a), sa = Math.sin(a), cd = Math.cos(d), sd = Math.sin(d);
  const v = [cd * ca - east * sa - north * sd * ca,
    cd * sa + east * ca - north * sd * sa, sd + north * cd];
  const length = Math.hypot(...v);
  return [...v.map(value => value / length), 0];
}

/**
 * Project the requested analysis field around an astrometric ICRS target. `points` follows
 * its four edges for an SVG polygon; `corners` contains the four corner pixels.
 * Coordinates may lie just outside the canvas (normal clipping is preferable
 * to shifting the target). A Mollweide longitude seam cannot be drawn as one
 * polygon: return null rather than connect opposite sides of the all-sky map.
 */
export function fieldRegionAroundTarget(engine, target, canvas, fovArcsec = DEFAULT_ANALYSIS_FOV_ARCSEC) {
  if (!engine?.core || typeof engine.convertFrame !== 'function' || !canvas ||
      !target || !Number.isFinite(target.ra) || !Number.isFinite(target.dec) || Math.abs(target.dec) > 90 ||
      !Number.isFinite(fovArcsec) || fovArcsec < MIN_ANALYSIS_FOV_ARCSEC || fovArcsec > MAX_ANALYSIS_FOV_ARCSEC) return null;
  fovArcsec = Math.round(fovArcsec);
  const { width, height } = canvas.getBoundingClientRect();
  const options = {
    width, height, fov: engine.core.fov, projection: engine.core.projection,
    flipHorizontal: engine.core.flip_view_horizontal,
    flipVertical: engine.core.flip_view_vertical,
  };
  const half = fovArcsec / 2;
  const tangentCorners = [[half, half], [-half, half], [-half, -half], [half, -half]];
  const points = [];
  const viewLongitudes = [];
  const project = (east, north) => {
    const direction = tangentFieldDirection(target, east, north);
    const view = engine.convertFrame(engine.observer, 'ASTROM', 'VIEW', direction);
    if (!view || view.length < 3 || !view.slice(0, 3).every(Number.isFinite)) return null;
    return { point: projectViewDirection(view, options), longitude: Math.atan2(view[0], -view[2]) };
  };
  try {
    const center = project(0, 0)?.point;
    if (!center) return null;
    for (let side = 0; side < 4; side++) {
      const from = tangentCorners[side];
      const to = tangentCorners[(side + 1) % 4];
      for (let step = 0; step < 8; step++) {
        const fraction = step / 8;
        const sample = project(from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction);
        if (!sample?.point) return null;
        points.push(sample.point);
        viewLongitudes.push(sample.longitude);
      }
    }
    if (options.projection === 5 && viewLongitudes.some((longitude, i) =>
      Math.abs(longitude - viewLongitudes[(i + 1) % viewLongitudes.length]) > Math.PI)) return null;
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    return {
      target: { ...target, ra: ((target.ra % 360) + 360) % 360, fovArcsec },
      points, corners: [points[0], points[8], points[16], points[24]], center, fovArcsec,
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    };
  } catch { return null; }
}
