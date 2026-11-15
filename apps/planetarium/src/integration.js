/* SPDX-License-Identifier: AGPL-3.0-only */
import { sanitizeViewState, portalShareUrl } from './view-state.js';
import { t } from './i18n.js';
const embedded = typeof window !== 'undefined' && window.parent !== window && typeof location !== 'undefined' && new URLSearchParams(location.search).has('embed');
let controls = null, paused = false, restoreSequence = Promise.resolve();
const send = message => { if (embedded) window.parent.postMessage(message, location.origin); };
export function integrationPaused() { return embedded && paused; }
export function openParentAnalysis(target) {
  if (!embedded) return false;
  if (!target || !Number.isFinite(target.ra) || !Number.isFinite(target.dec) || Math.abs(target.dec) > 90) return false;
  send({ type: 'spherex-planetarium-analyze', target }); return true;
}
export function shareView(query) {
  if (!embedded) return false;
  const state = sanitizeViewState(query).toString();
  send({ type: 'spherex-planetarium-share', query: state, url: portalShareUrl(state, location.href) });
  return true;
}
export function registerIntegration(api) {
  controls = api;
  window.__stellariumIntegration = {
    ...api,
    getState: () => ({ ...api.getState(), paused: integrationPaused(), source: 'apps/planetarium', engine: 'Stellarium Web Engine 2103935134e09ba1715171241769fce03cebebe4', background: 'SPHEREx equatorial HiPS' }),
    setPaused(value) { paused = !!value; api.onPauseChanged(); },
  };
  api.onPauseChanged();
  send({ type: 'spherex-planetarium-ready', state: api.getState() });
}
if (typeof window !== 'undefined') window.addEventListener('message', event => {
  if (!embedded || event.source !== window.parent || event.origin !== location.origin || !event.data || typeof event.data !== 'object') return;
  const message = event.data;
  if (message.type === 'spherex-planetarium-visibility') {
    paused = !!message.paused; controls?.onPauseChanged();
  } else if (message.type === 'spherex-planetarium-state-request') {
    send({ type: 'spherex-planetarium-state', requestId: message.requestId, state: controls?.getState() ?? { ready: false } });
  } else if (message.type === 'spherex-planetarium-restore' && controls) {
    const query = sanitizeViewState(message.state ?? message.query).toString();
    restoreSequence = restoreSequence.then(() => controls.restoreState(query)).then(() => {
      send({ type: 'spherex-planetarium-restored', requestId: message.requestId, state: controls.getState() });
    }).catch(error => send({ type: 'spherex-planetarium-error', requestId: message.requestId, message: String(error?.message || t('error.restore')) }));
  } else if (message.type === 'spherex-planetarium-focus' && controls) {
    const query = sanitizeViewState(message.target).toString();
    if (query) restoreSequence = restoreSequence.then(() => controls.restoreState(query)).catch(() => {});
  }
});
if (embedded) {
  document.documentElement.classList.add('embedded');
  document.querySelector('.brand')?.addEventListener('click', event => { event.preventDefault(); send({ type: 'spherex-planetarium-home' }); });
  document.querySelector('[data-sky-tutorial-open]')?.addEventListener('click', () => send({ type: 'spherex-tutorial-open', page: 'planetarium' }));
}
