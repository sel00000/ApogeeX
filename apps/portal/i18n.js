/** Portal language layer (spec-i18n D1). English is the default; 'ko' switches the whole site.
 * The portal is the writer of localStorage['spherex-lang']; children follow the storage event and
 * the parent message { type: 'spherex-lang', lang }. Modules in this document (tutorial, search)
 * talk through the 'spherex-lang-change' window event. Switching never reloads.
 */
import en from './i18n/en.js';
import ko from './i18n/ko.js';

export const LANG_KEY = 'spherex-lang';
export const DICTIONARIES = Object.freeze({ en, ko });
const listeners = new Set();
let current = null;

export const normalizeLang = value => (value === 'ko' ? 'ko' : 'en');

export function readStoredLang(storage) {
  try { return normalizeLang((storage ?? globalThis.localStorage)?.getItem(LANG_KEY)); } catch { return 'en'; }
}

/** 'lang=ko|en' inside the route hash (#view?…&lang=ko). Returns the language (or null) and the hash without it. */
export function routeLang(hash = '') {
  const raw = String(hash);
  const split = raw.indexOf('?');
  if (split < 0) return { lang: null, hash: raw };
  const params = new URLSearchParams(raw.slice(split + 1));
  if (!params.has('lang')) return { lang: null, hash: raw };
  const value = params.get('lang');
  params.delete('lang');
  const rest = params.toString();
  return { lang: value === 'ko' || value === 'en' ? value : null, hash: raw.slice(0, split) + (rest ? '?' + rest : '') };
}

export function getLang() {
  if (current === null) current = readStoredLang();
  return current;
}

/** t('key', { n: 3 }) → dictionary text with {n} filled. Falls back to English, then to the key itself. */
export function t(key, vars, lang = getLang()) {
  const table = DICTIONARIES[normalizeLang(lang)];
  let text = Object.hasOwn(table, key) ? table[key] : Object.hasOwn(en, key) ? en[key] : key;
  if (vars && typeof text === 'string') text = text.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
  return text;
}

/** [data-i18n] text, [data-i18n-html] trusted dictionary markup, [data-i18n-attr="aria-label:key;title:key"]. */
export function applyI18n(root = globalThis.document, lang = getLang()) {
  if (!root?.querySelectorAll) return;
  const nodes = sel => [...(root.matches?.(sel) ? [root] : []), ...root.querySelectorAll(sel)];
  for (const el of nodes('[data-i18n]')) el.textContent = t(el.dataset.i18n, null, lang);
  for (const el of nodes('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml, null, lang);
  for (const el of nodes('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s && s.trim());
      if (attr && key) el.setAttribute(attr, t(key, null, lang));
    }
  }
}

export function onLangChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

function postToFrames(lang) {
  if (typeof document === 'undefined') return;
  for (const frame of document.querySelectorAll('iframe')) {
    try { frame.contentWindow?.postMessage({ type: 'spherex-lang', lang }, location.origin); } catch {}
  }
}

// Texts of different length move the page; keep the element under the upper part of the viewport where it was.
function captureAnchor() {
  if (typeof document === 'undefined' || !globalThis.scrollY) return null;
  const el = document.elementFromPoint?.(innerWidth / 2, Math.min(innerHeight * 0.3, 260));
  return el && !el.closest('.site-header,dialog') ? { el, top: el.getBoundingClientRect().top } : null;
}
function restoreAnchor(anchor) {
  if (!anchor?.el.isConnected) return;
  const delta = anchor.el.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'instant' });
}

function commit(lang, { dispatch, store = true }) {
  lang = normalizeLang(lang);
  if (store) { try { globalThis.localStorage?.setItem(LANG_KEY, lang); } catch {} }
  const changed = lang !== getLang();
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (dispatch && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('spherex-lang-change', { detail: { lang, source: 'portal' } }));
  postToFrames(lang);
  if (changed) {
    const anchor = captureAnchor();
    for (const cb of [...listeners]) { try { cb(lang); } catch (e) { console.error('[i18n]', e); } }
    restoreAnchor(anchor);
  }
  return changed;
}

/** The portal toggle: store, set <html lang>, tell same-document modules and every child frame. */
export function setLang(lang) { return commit(lang, { dispatch: true }); }

let started = false;
/** Call once from app.js: reads the route parameter, applies the page and wires frames and events. */
export function startI18n() {
  if (started || typeof window === 'undefined') return getLang();
  started = true;
  const fromRoute = routeLang(location.hash);
  if (fromRoute.lang) {
    try { localStorage.setItem(LANG_KEY, fromRoute.lang); } catch {}
    current = fromRoute.lang;
    history.replaceState(history.state, '', location.pathname + location.search + (fromRoute.hash && fromRoute.hash !== '#' ? fromRoute.hash : ''));
  }
  const lang = getLang();
  document.documentElement.lang = lang;
  applyI18n(document, lang);
  // A child frame that finishes loading hears the current language once more.
  document.addEventListener('load', e => {
    if (e.target?.tagName === 'IFRAME') { try { e.target.contentWindow?.postMessage({ type: 'spherex-lang', lang: getLang() }, location.origin); } catch {} }
  }, true);
  // The tutorial and search (same document) may switch too; their event is the only other writer we follow.
  window.addEventListener('spherex-lang-change', e => {
    if (e.detail?.source === 'portal') return;
    const next = e.detail?.lang;
    if (next !== 'ko' && next !== 'en') return;
    commit(next, { dispatch: false });
  });
  // Another tab switched the language: follow it without writing, so the shell matches its child frames.
  window.addEventListener('storage', e => {
    if (e.key === LANG_KEY) commit(normalizeLang(e.newValue), { dispatch: true, store: false });
  });
  document.documentElement.classList.remove('lang-pending');
  return lang;
}
