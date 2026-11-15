import { describe, expect, it } from 'vitest'
import { trueBlinkUrl } from './trueblink'

describe('trueBlinkUrl', () => {
  it('builds the normal address', () => {
    expect(trueBlinkUrl({ ra: 264.8203, dec: 11.8084, fovDeg: 0.1, lang: 'en' })).toBe('https://trueblink.pages.dev/#ra=264.8203&dec=11.8084&fov=360&lang=en')
  })
  it('clamps a too small and a too large field', () => {
    expect(trueBlinkUrl({ ra: 10, dec: 0, fovDeg: 0.001, lang: 'en' })).toContain('&fov=60&')
    expect(trueBlinkUrl({ ra: 10, dec: 0, fovDeg: 5, lang: 'en' })).toContain('&fov=780&')
  })
  it('wraps negative ra, clamps dec and rounds to 4 decimals', () => {
    expect(trueBlinkUrl({ ra: -10.123456, dec: 95, fovDeg: 0.1, lang: 'en' })).toBe('https://trueblink.pages.dev/#ra=349.8765&dec=90&fov=360&lang=en')
  })
  it('passes lang ko', () => {
    expect(trueBlinkUrl({ ra: 1, dec: -1, fovDeg: 0.1, lang: 'ko' })).toMatch(/&lang=ko$/)
  })
  it('leaves fov out when missing or not finite', () => {
    expect(trueBlinkUrl({ ra: 1, dec: 2, lang: 'en' })).toBe('https://trueblink.pages.dev/#ra=1&dec=2&lang=en')
    expect(trueBlinkUrl({ ra: 1, dec: 2, fovDeg: NaN, lang: 'en' })).not.toContain('fov=')
  })
})
