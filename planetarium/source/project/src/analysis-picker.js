/* SPDX-License-Identifier: AGPL-3.0-only */
import { bindSkyClickAnalysis, targetAtSkyPoint } from './sky-click.js';
import { fieldRegionAroundTarget } from './analysis-region.js';
import { t } from './i18n.js';

// The preview is the same north-up tangent-plane field passed to the analysis API,
// projected onto the current sky view. It is not a fixed-size decorative box.
export function createAnalysisPicker({ engine, canvas, onTarget, onSelection, canInteract, notify }) {
  const doc = canvas.ownerDocument;
  const button = doc.querySelector('#analysis-pick');
  const size = doc.querySelector('#analysis-field-size');
  const hint = doc.querySelector('#analysis-pick-hint');
  const overlay = doc.querySelector('#analysis-picker-overlay');
  const outline = doc.querySelector('#analysis-picker-outline');
  const crosshair = doc.querySelector('#analysis-picker-crosshair');
  const label = doc.querySelector('#analysis-picker-label');
  const skyHint = doc.querySelector('#sky-hint');
  let active = false;
  let inside = false;
  let point;
  let animation;
  let lastDraw = 0;
  const fieldSize = () => Number(size.value);
  const fieldLabel = () => `${fieldSize() / 60}′ × ${fieldSize() / 60}′`;
  // SVGElement does not reflect `.hidden` like HTMLElement does.
  const hideOverlay = hidden => overlay.toggleAttribute('hidden', hidden);

  function regionAt(position) {
    const target = targetAtSkyPoint(engine, position, canvas);
    if (!target) return null;
    const region = fieldRegionAroundTarget(engine, { ...target, label: t('picker.regionLabel') }, canvas, fieldSize());
    const rect = canvas.getBoundingClientRect();
    return region?.points.every(p => p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height) ? region : null;
  }

  function draw() {
    if (!active || !inside || !point || !canInteract()) { hideOverlay(true); return; }
    const region = regionAt(point);
    if (!region) { hideOverlay(true); return; }
    const rect = canvas.getBoundingClientRect();
    const origin = canvas.offsetParent?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    overlay.setAttribute('style', `left:${rect.left - origin.left}px;top:${rect.top - origin.top}px;right:auto;bottom:auto;width:${rect.width}px;height:${rect.height}px`);
    overlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    outline.setAttribute('points', region.points.map(p => `${p.x},${p.y}`).join(' '));
    const { x, y } = region.center;
    crosshair.setAttribute('d', `M${x - 6},${y}h12 M${x},${y - 6}v12`);
    label.setAttribute('x', String(Math.max(12, Math.min(rect.width - 180, x + 16))));
    label.setAttribute('y', String(Math.max(24, Math.min(rect.height - 20, y - 16))));
    label.textContent = t('picker.clickToAnalyse', { field: fieldLabel() });
    hideOverlay(false);
  }

  function animate(time) {
    if (!active) return;
    if (time - lastDraw >= 40) { draw(); lastDraw = time; }
    animation = requestAnimationFrame(animate);
  }

  function makeFieldVisible() {
    // At a whole-sky scale a 3 arcminute field is below one screen pixel.
    // Zoom only when needed; the actual selected region never silently grows.
    const previewFov = fieldSize() / 3600 * 20 * Math.PI / 180;
    if (engine.core.fov > previewFov) {
      engine.zoomTo(previewFov, 0.3);
      notify(t('picker.zoomed', { field: fieldLabel() }));
    }
  }

  function setActive(value) {
    if (value && !canInteract()) return;
    active = value;
    button.setAttribute('aria-pressed', String(active));
    doc.body.classList.toggle('analysis-picking', active);
    skyHint.textContent = t(active ? 'skyHint.picking' : 'skyHint.sky');
    hint.textContent = active ? t('picker.activeHint', { field: fieldLabel() }) : t('picker.normalHint');
    cancelAnimationFrame(animation);
    hideOverlay(true);
    if (active) {
      const rect = canvas.getBoundingClientRect();
      point = { x: rect.width / 2, y: rect.height / 2 };
      inside = true;
      makeFieldVisible();
      canvas.focus({ preventScroll: true });
      draw();
      animation = requestAnimationFrame(animate);
    }
  }

  function analyzeAt(position) {
    if (!active || !canInteract()) return;
    const region = regionAt(position);
    if (!region) {
      notify(t('picker.outside'));
      return;
    }
    setActive(false);
    onTarget(region.target);
  }

  button.disabled = false;
  size.disabled = false;
  hint.textContent = t('picker.normalHint');
  button.addEventListener('click', () => setActive(!active));
  size.addEventListener('change', () => {
    if (!active) return;
    hint.textContent = t('picker.sizeHint', { field: fieldLabel() });
    makeFieldVisible();
    draw();
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true;
    if (active) draw();
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { inside = false; hideOverlay(true); });
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inside = true;
    if (active) draw();
  }, { passive: true });
  doc.addEventListener('keydown', event => {
    if (active && event.key === 'Escape' && canInteract()) {
      event.preventDefault();
      setActive(false);
      button.focus({ preventScroll: true });
    }
  });
  canvas.addEventListener('keydown', event => {
    if (active && event.key === 'Enter' && point) {
      event.preventDefault();
      analyzeAt(point);
    }
  });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden && active) setActive(false); });
  bindSkyClickAnalysis({ engine, canvas, canAnalyze: canInteract, isAnalysisMode: () => active,
    onSelection, onTarget: (_target, position) => analyzeAt(position) });
  // Language change: rewrite the hint and the on-sky label without changing the picker state.
  function relabel() {
    hint.textContent = active ? t('picker.activeHint', { field: fieldLabel() }) : t('picker.normalHint');
    if (active) { skyHint.textContent = t('skyHint.picking'); draw(); }
  }
  return { cancel: () => setActive(false), relabel, get active() { return active; } };
}
