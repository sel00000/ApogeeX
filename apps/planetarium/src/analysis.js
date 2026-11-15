/* SPDX-License-Identifier: AGPL-3.0-only */
import { buildAnalysisUrl, archiveTargetFromSelection, withObservationContext } from './analysis-target.js';
import { openParentAnalysis } from './integration.js';
import { t } from './i18n.js';

export function createAnalysisController({ getEngine, notify, onVisibilityChange = () => {} }) {
  const $ = (selector) => document.querySelector(selector);
  const dialog = $('#analysis-dialog');
  const frame = $('#analysis-frame');
  const base = new URL('../', import.meta.url);
  let loadTimer;
  let opening = 0;
  let shown = null;
  let slow = false;

  function selectionTarget() {
    const engine = getEngine();
    const object = engine?.core?.selection;
    if (!object) return null;
    try {
      return archiveTargetFromSelection(engine, object, $('#selection-name').textContent);
    } catch { return null; }
  }

  function updateSelection() {
    const target = selectionTarget();
    const button = $('#selection-analyze');
    if (button.disabled !== !target) button.disabled = !target;
    const coordinates = target
      ? `${target.moving ? t('selection.apparentIcrf') : 'ICRS'} · RA ${target.ra.toFixed(6)}° · Dec ${target.dec >= 0 ? '+' : ''}${target.dec.toFixed(6)}°` : t('selection.noCoords');
    const note = t(target?.moving ? 'selection.movingNote' : 'selection.fixedNote');
    // syncTime calls this at the existing 500 ms status cadence. Unchanged
    // positions must not rewrite DOM text, reset text selection, or rebuild UI.
    if ($('#selection-coordinates').textContent !== coordinates) $('#selection-coordinates').textContent = coordinates;
    if ($('#selection-analysis-note').textContent !== note) $('#selection-analysis-note').textContent = note;
    return target;
  }

  // Texts of the stand-alone analysis dialog; rerun when the language changes.
  function describe(target) {
    $('#analysis-title').textContent = t('analysisDialog.titleFor', { label: target.label });
    const field = target.fovArcsec ? `${target.fovArcsec / 60}′ × ${target.fovArcsec / 60}′` : null;
    $('#analysis-position').textContent = `${target.moving ? t('selection.apparentIcrf') : 'ICRS'} · RA ${target.ra.toFixed(6)}° · Dec ${target.dec.toFixed(6)}°${field ? t('analysisDialog.field', { field }) : ''}`;
    $('#analysis-context').textContent = target.moving
      ? t('analysisDialog.contextMoving')
      : field ? t('analysisDialog.contextField', { field })
      : t('analysisDialog.contextPoint');
    $('#analysis-loading').textContent = t(slow ? 'analysisDialog.slow' : 'analysisDialog.loading');
  }

  function relabel() {
    if (shown && dialog.open) describe(shown);
    else $('#analysis-loading').textContent = t('analysisDialog.loading');
  }

  function open(target) {
    if (!target) return notify(t('analysisDialog.noTarget'));
    target = withObservationContext(target, getEngine());
    if (openParentAnalysis(target)) return;
    shown = target;
    slow = false;
    describe(target);
    $('#analysis-new-tab').href = buildAnalysisUrl(target, base, false);
    $('#analysis-loading').hidden = false;
    clearTimeout(loadTimer);
    if (!dialog.open) dialog.showModal();
    onVisibilityChange(true);
    // Paint the dialog with the sky renderer paused before starting the second app.
    const request = ++opening;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (request !== opening || !dialog.open) return;
      frame.src = buildAnalysisUrl(target, base);
      loadTimer = setTimeout(() => {
        if (!$('#analysis-loading').hidden) { slow = true; $('#analysis-loading').textContent = t('analysisDialog.slow'); }
      }, 20000);
    }));
  }

  $('#selection-analyze').addEventListener('click', () => open(updateSelection()));
  $('#close-analysis').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    opening++;
    clearTimeout(loadTimer);
    // Unload requests, WebGL and workers when the workbench is no longer visible.
    frame.src = 'about:blank';
    onVisibilityChange(false);
  });
  frame.addEventListener('load', () => {
    if (frame.getAttribute('src') === 'about:blank') return;
    clearTimeout(loadTimer);
    $('#analysis-loading').hidden = true;
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if ((event.data?.type === 'spherex-analysis-close' || event.data?.type === 'spherex-navigate' && event.data.view === 'planetarium') && dialog.open) dialog.close();
  });
  return { updateSelection, open, relabel };
}
