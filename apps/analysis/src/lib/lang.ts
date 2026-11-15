// Shared language contract of the site (spec D1): English is the default; one key in localStorage,
// written by the portal's toggle (and by this app's own switch when it runs on its own), followed live
// through the `storage` event and the parent's `spherex-lang` message.
import type { Lang } from '../store'

export const LANG_KEY = 'spherex-lang'

type Store = Pick<Storage, 'getItem' | 'setItem'>
const defaultStore = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** 'ko' when the stored value is 'ko'; anything else (missing, other values, storage errors) is English. */
export function readStoredLang(store: Store | null = defaultStore()): Lang {
  try { return store?.getItem(LANG_KEY) === 'ko' ? 'ko' : 'en' } catch { return 'en' }
}

export function writeStoredLang(lang: Lang, store: Store | null = defaultStore()): void {
  try { store?.setItem(LANG_KEY, lang) } catch { /* storage blocked: this page keeps the choice */ }
}

/** The language at start: inside the portal only the shared key counts; on its own the URL's `lang` wins. */
export function initialLang(search: string, embedded: boolean, store: Store | null = defaultStore()): Lang {
  if (!embedded) {
    const q = new URLSearchParams(search).get('lang')
    if (q === 'ko' || q === 'en') return q
  }
  return readStoredLang(store)
}

/** `{ type: 'spherex-lang', lang }` from the portal. */
export function langMessage(value: unknown): Lang | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.type !== 'spherex-lang') return null
  return v.lang === 'ko' || v.lang === 'en' ? v.lang : null
}

export const appTitle = (lang: Lang) => lang === 'ko' ? '방구석 천문학자 · 모두를 위한 SPHEREx!' : 'Armchair Astronomer · SPHEREx for Everyone'
