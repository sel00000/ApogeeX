/* SPDX-License-Identifier: AGPL-3.0-only */
import { targetFromVector } from './analysis-target.js';
import { selectObjectAtPoint } from './sky-selection.js';
import { t } from './i18n.js';

const STEREOGRAPHIC = 2;
const MOLLWEIDE = 5;
const clampUnit = value => Math.max(-1, Math.min(1, value));

// Inverse of the bundled engine's proj_stereographic.c / proj_mollweide.c,
// including core_get_proj's aspect ratio and flips. Positions use CSS pixels,
// as do the native click callback and core.win_size, not framebuffer pixels.
export function viewDirectionAtPoint({ x, y, width, height, fov, projection, flipHorizontal = false, flipVertical = false }) {
  if (![x, y, width, height, fov].every(Number.isFinite) || width <= 0 || height <= 0 ||
      fov <= 0 || fov > 2 * Math.PI + 1e-10 || x < 0 || y < 0 || x > width || y > height) return null;
  // Native JSON properties round a full-sky 2π to 6.28318530718.
  fov = Math.min(fov, 2 * Math.PI);
  const nx = (2 * x / width - 1) * (flipHorizontal ? -1 : 1);
  const ny = (1 - 2 * y / height) * (flipVertical ? -1 : 1);
  if (projection === STEREOGRAPHIC) {
    if (fov >= 2 * Math.PI) return null;
    const scale = 2 * Math.tan(fov / 4);
    const px = nx * width / Math.min(width, height) * scale;
    const py = ny * height / Math.min(width, height) * scale;
    const q = (px * px + py * py) / 4;
    return [px / (1 + q), py / (1 + q), (q - 1) / (q + 1), 0];
  }
  if (projection === MOLLWEIDE) {
    const px = nx * fov / Math.PI * Math.SQRT2;
    const py = ny * fov * height / width / Math.PI * Math.SQRT2;
    // The empty corners are not sky. Never clamp them onto the map's edge.
    if (px * px / 8 + py * py / 2 > 1 + 1e-12) return null;
    const theta = Math.asin(clampUnit(py / Math.SQRT2));
    const cosTheta = Math.cos(theta);
    const lambda = Math.abs(cosTheta) < 1e-10 ? 0 : Math.PI * px / (2 * Math.SQRT2 * cosTheta);
    const phi = Math.asin(clampUnit((2 * theta + Math.sin(2 * theta)) / Math.PI));
    return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), -Math.cos(phi) * Math.cos(lambda), 0];
  }
  return null;
}

export function targetAtSkyPoint(engine, point, canvas) {
  if (!engine?.core || !point || !canvas) return null;
  const { width, height } = canvas.getBoundingClientRect();
  const direction = viewDirectionAtPoint({
    x: point.x, y: point.y, width, height, fov: engine.core.fov,
    projection: engine.core.projection,
    flipHorizontal: engine.core.flip_view_horizontal,
    flipVertical: engine.core.flip_view_vertical,
  });
  if (!direction) return null;
  // ASTROM removes the observer's aberration and solar light deflection too.
  // The engine's ICRF axes alone still contain those apparent-position effects.
  return targetFromVector(engine.convertFrame(engine.observer, 'VIEW', 'ASTROM', direction), t('picker.clickedLabel'));
}

export function bindSkyClickAnalysis({ engine, canvas, canAnalyze = () => true, isAnalysisMode = () => false, onTarget, onSelection = () => {} }) {
  let multiTouch = false;
  let dragged = false;
  const pointers = new Map();
  const pointerSurface = canvas.ownerDocument || canvas;
  canvas.addEventListener('pointerdown', event => {
    if (!pointers.size) { dragged = false; multiTouch = false; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) dragged = true;
  }, { capture: true, passive: true });
  const trackPointer = event => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) dragged = true;
  };
  pointerSurface.addEventListener('pointermove', trackPointer, { capture: true, passive: true });
  pointerSurface.addEventListener('pointerup', event => {
    trackPointer(event);
    pointers.delete(event.pointerId);
    // Do not reset here: the native mouseup/touchend callback runs afterwards.
  }, { capture: true, passive: true });
  pointerSurface.addEventListener('pointercancel', event => {
    dragged = true;
    pointers.delete(event.pointerId);
  }, { capture: true, passive: true });
  const touchStart = event => {
    if (event.touches.length === 1) multiTouch = false;
    else { multiTouch = true; dragged = true; }
  };
  // Keep a pinch suppressed even through a delayed synthetic click. The next
  // independent pointerdown/touchstart starts a new gesture.
  canvas.addEventListener('touchstart', touchStart, { capture: true, passive: true });
  canvas.addEventListener('touchcancel', () => { multiTouch = true; dragged = true; }, { capture: true, passive: true });
  // Native mouse-down is sampled on animation frames, so its click callback
  // can miss a short click. Use the DOM click after mouseup/touchend instead,
  // with the excursion guard above to reject panning and pinching.
  // Dispatch once from the DOM after gesture validation. Ordinary clicks use
  // the engine's native object/constellation picker; analysis clicks keep the
  // exact coordinate instead of snapping to the nearest object.
  engine.on('click', () => true);
  canvas.addEventListener('click', event => {
    if (event.button !== 0 || multiTouch || dragged || !canAnalyze()) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const target = targetAtSkyPoint(engine, point, canvas);
    if (!target) return;
    if (isAnalysisMode()) onTarget(target, point);
    else onSelection(selectObjectAtPoint(engine, point));
  });
}
