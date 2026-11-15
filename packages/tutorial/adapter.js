import { PAGES } from './state.js';
import { getLang } from './i18n.js';

export const NOT_READY = { ko: '화면을 준비하고 있어요. 잠시 후 다시 눌러 주세요.', en: 'The screen is still loading. Please try again in a moment.' };

/** Tutorial queries are semantic UI requests, never access to a scientific store. */
export function currentPage(win, fallback = 'home') {
  const view = win.__spherexApp?.view;
  if (PAGES.includes(view)) return view;
  const route = win.location?.hash?.slice(1).split('?')[0];
  return PAGES.includes(route) ? route : fallback;
}

export function featureDocument(win, shellDocument, page) {
  if (page === 'home') return shellDocument;
  try {
    const doc = win.__spherexApp?.getFeatureDocument?.();
    // A feature document on another origin is intentionally opaque to this guide.
    if (doc && doc.defaultView?.location.origin === win.location.origin) return doc;
  } catch { /* Cross-origin content must not be inspected. */ }
  return null;
}

export async function navigatePractice(win, practice, signal) {
  const destination=typeof practice==='string'?practice:practice.page;
  const params=typeof practice==='string'?undefined:practice.params;
  if (!PAGES.includes(destination)) throw new Error('Unknown tutorial destination.');
  const app = win.__spherexApp;
  if (!app?.navigate) throw new Error(NOT_READY[getLang()]);
  if (signal?.aborted) return false;
  if (currentPage(win) !== destination || params) await app.navigate(destination,params);
  if (signal?.aborted) return false;
  await app.whenReady?.();
  return !signal?.aborted && currentPage(win) === destination;
}

export function installHighlightStyle(doc) {
  if (!doc?.head || doc.querySelector('[data-sky-guide-highlight]')) return;
  const style = doc.createElement('style');
  style.dataset.skyGuideHighlight = '';
  style.textContent = '.sky-tutorial-target{outline:3px solid #83e2d2!important;outline-offset:5px!important;box-shadow:0 0 0 8px #83e2d21f!important;scroll-margin-block:100px!important}';
  doc.head.append(style);
}
