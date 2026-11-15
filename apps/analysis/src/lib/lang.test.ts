import { describe, expect, it } from 'vitest'
import { LANG_KEY, appTitle, initialLang, langMessage, readStoredLang, writeStoredLang } from './lang'

const mem = (v?: string) => { const m = new Map<string, string>(v === undefined ? [] : [[LANG_KEY, v]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => void m.set(k, x), m } }
const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }

describe('shared language key (spec D1)', () => {
  it("is Korean only for 'ko'; missing, other values and storage errors mean English", () => {
    expect(readStoredLang(mem('ko'))).toBe('ko')
    for (const s of [mem(), mem('en'), mem('KO'), mem('fr'), broken, null]) expect(readStoredLang(s)).toBe('en')
    expect(readStoredLang()).toBe('en') // node: no localStorage
  })
  it('is written by the standalone switch, quietly when storage is blocked', () => {
    const s = mem()
    writeStoredLang('ko', s)
    expect(s.m.get('spherex-lang')).toBe('ko')
    expect(() => writeStoredLang('en', broken)).not.toThrow()
  })
  it('inside the portal ignores the URL; standalone the URL lang wins over the key', () => {
    expect(initialLang('?embed=1&lang=ko', true, mem('en'))).toBe('en')
    expect(initialLang('?embed=1', true, mem('ko'))).toBe('ko')
    expect(initialLang('?lang=ko', false, mem('en'))).toBe('ko')
    expect(initialLang('?lang=en', false, mem('ko'))).toBe('en')
    expect(initialLang('', false, mem())).toBe('en')
    expect(initialLang('?lang=xx', false, mem('ko'))).toBe('ko')
  })
  it('accepts only the portal message with en or ko', () => {
    expect(langMessage({ type: 'spherex-lang', lang: 'ko' })).toBe('ko')
    expect(langMessage({ type: 'spherex-lang', lang: 'en' })).toBe('en')
    for (const v of [null, 'ko', {}, { type: 'spherex-lang' }, { type: 'spherex-lang', lang: 'fr' }, { type: 'other', lang: 'ko' }]) expect(langMessage(v)).toBeNull()
  })
  it('titles the document in the chosen language', () => {
    expect(appTitle('en')).not.toMatch(/[가-힣]/)
    expect(appTitle('ko')).toMatch(/방구석/)
  })
})
