/* Language layer: English by default, Korean on request.
 * Contract (docs/spec-i18n.md D1): localStorage 'spherex-lang' ('ko' => Korean, anything else => English),
 * the window 'storage' event for that key, and the parent's { type: 'spherex-lang', lang } message.
 * SPDX-License-Identifier: AGPL-3.0-only */
import { en, ko } from './i18n-dict.js';

export const LANG_KEY = 'spherex-lang';
const dictionaries = { en, ko };
const listeners = new Set();

export const normalizeLang = (value) => (value === 'ko' ? 'ko' : 'en');

export function readStoredLang(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try { return normalizeLang(storage?.getItem(LANG_KEY)); } catch { return 'en'; }
}

let lang = readStoredLang();

export const getLang = () => lang;

// Translate a key; {name} placeholders are filled from params. A missing key falls back to English.
export function t(key, params) {
  let text = dictionaries[lang][key] ?? en[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  return text;
}

export const locale = () => (lang === 'ko' ? 'ko-KR' : 'en-GB');

export function onLangChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Static markup: data-i18n (text), data-i18n-html (trusted dictionary markup such as <br> or <kbd>),
// data-i18n-attr="aria-label=key,title=key".
export function applyStatic(root = typeof document === 'undefined' ? null : document) {
  if (!root?.querySelectorAll) return;
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(node.dataset.i18nHtml);
  // data-i18n-lead: replace only the first non-blank text node, keeping icons, inputs and <kbd> beside it.
  for (const node of root.querySelectorAll('[data-i18n-lead]')) {
    const text = [...node.childNodes].find((child) => child.nodeType === 3 && child.nodeValue.trim());
    if (!text) continue;
    const [, before, , after] = text.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
    text.nodeValue = before + t(node.dataset.i18nLead) + after;
  }
  for (const node of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr.split(',')) {
      const [attribute, key] = pair.split('=').map((part) => part.trim());
      if (attribute && key) node.setAttribute(attribute, t(key));
    }
  }
  const html = root.documentElement ?? root.ownerDocument?.documentElement;
  if (html) html.lang = lang;
  if ('title' in root && root.documentElement) {
    root.title = t('doc.title');
    root.querySelector('meta[name="description"]')?.setAttribute('content', t('doc.description'));
  }
}

export function setLang(value) {
  const next = normalizeLang(value);
  if (next === lang) return;
  lang = next;
  applyStatic();
  for (const callback of [...listeners]) {
    try { callback(lang); } catch (error) { console.error(error); }
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  applyStatic();
  window.addEventListener('storage', (event) => {
    if (event.key === LANG_KEY || event.key === null) setLang(readStoredLang());
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== window.parent || window.parent === window) return;
    if (event.data?.type === 'spherex-lang') setLang(event.data.lang);
  });
  window.addEventListener('spherex-lang-change', (event) => setLang(event.detail?.lang));
}
