import { describe, expect, it } from 'vitest'
import { FOV_MAX, FOV_MIN } from '../gl/SkyGlobe'
import { SKY_FOV_MAX, SKY_FOV_MIN, SKY_PREF_CONSTELLATIONS, SKY_PREF_GROUND, formatSkyParam, parseSkyParam, planetariumFov, planetariumMessage, readSkyPref, writeSkyPref } from './skyView'

describe('sky=<ra>,<dec>,<fov>', () => {
  it('reads a centre and a field', () => {
    expect(parseSkyParam('83.8,-1.2,40')).toEqual({ ra: 83.8, dec: -1.2, fov: 40 })
    expect(parseSkyParam('-10, +5.5 ,2')).toEqual({ ra: 350, dec: 5.5, fov: 2 })
    expect(parseSkyParam('370,0,1e1')).toEqual({ ra: 10, dec: 0, fov: 10 })
  })
  it('keeps the field inside what the globe shows', () => {
    expect(parseSkyParam('0,0,500')!.fov).toBe(SKY_FOV_MAX)
    expect(parseSkyParam('0,0,0.1')!.fov).toBe(SKY_FOV_MIN)
    expect([SKY_FOV_MIN, SKY_FOV_MAX]).toEqual([FOV_MIN, FOV_MAX])
  })
  it('ignores bad values', () => {
    for (const v of [null, undefined, '', '1,2', '1,2,3,4', 'a,2,3', '1,95,3', '1,-90.1,3', '1,2,0', '1,2,-4', 'NaN,1,2', 'Infinity,1,2', '1,,3', '0x10,1,2'])
      expect(parseSkyParam(v)).toBeNull()
  })
  it('writes what it reads (4 decimals for the centre, 2 for the field)', () => {
    expect(formatSkyParam({ ra: 83.812345, dec: -1.2, fovDeg: 40 })).toBe('83.8123,-1.2,40')
    expect(formatSkyParam({ ra: 359.99999, dec: 0, fovDeg: 1.234 })).toBe('0,0,1.23')
    expect(formatSkyParam({ ra: -0.5, dec: 89.99999, fovDeg: 100 })).toBe('359.5,90,100')
    const v = { ra: 201.36543, dec: -43.01912, fovDeg: 12.5 }
    const back = parseSkyParam(formatSkyParam(v))!
    expect(back.ra).toBeCloseTo(v.ra, 4)
    expect(back.dec).toBeCloseTo(v.dec, 4)
    expect(back.fov).toBe(12.5)
  })
})

describe('planetarium hand-over', () => {
  it('clamps the field to 5..120 degrees and sends the equatorial frame', () => {
    expect([planetariumFov(1.5), planetariumFov(40), planetariumFov(200), planetariumFov(NaN)]).toEqual([5, 40, 120, 60])
    expect(planetariumMessage({ ra: 83.812345, dec: -1.2, fovDeg: 2 }))
      .toEqual({ type: 'spherex-navigate', view: 'planetarium', params: { ra: 83.8123, dec: -1.2, fov: 5, frame: 'equatorial' } })
  })
})

describe('remembered overlay switches', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }
  it('defaults: constellations on, ground off; remembers 1/0', () => {
    const s = mem()
    expect(readSkyPref(SKY_PREF_CONSTELLATIONS, true, s)).toBe(true)
    expect(readSkyPref(SKY_PREF_GROUND, false, s)).toBe(false)
    writeSkyPref(SKY_PREF_CONSTELLATIONS, false, s)
    writeSkyPref(SKY_PREF_GROUND, true, s)
    expect(s.m.get('spherex-analysis:sky:constellations')).toBe('0')
    expect(s.m.get('spherex-analysis:sky:ground')).toBe('1')
    expect(readSkyPref(SKY_PREF_CONSTELLATIONS, true, s)).toBe(false)
    expect(readSkyPref(SKY_PREF_GROUND, false, s)).toBe(true)
    s.m.set(SKY_PREF_GROUND, 'yes')
    expect(readSkyPref(SKY_PREF_GROUND, false, s)).toBe(false)
  })
  it('falls back to the default without an error when storage is missing or throws', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readSkyPref(SKY_PREF_CONSTELLATIONS, true, broken)).toBe(true)
    expect(() => writeSkyPref(SKY_PREF_GROUND, true, broken)).not.toThrow()
    expect(readSkyPref(SKY_PREF_GROUND, false, null)).toBe(false)
    expect(readSkyPref(SKY_PREF_GROUND, false)).toBe(false) // node: no localStorage at all
  })
})

describe('constellation download decision', () => {
  it('downloads only while the layer is on and only once', async () => {
    const { needFigures } = await import('./skyView')
    expect(needFigures(true, false)).toBe(true)
    expect(needFigures(false, false)).toBe(false)
    expect(needFigures(true, true)).toBe(false)
    expect(needFigures(false, true)).toBe(false)
  })
  it('a stored "0" keeps it off at start; no preference means on (the default)', async () => {
    const { needFigures } = await import('./skyView')
    const store = (v: string | null) => ({ getItem: () => v, setItem: () => {} })
    expect(needFigures(readSkyPref(SKY_PREF_CONSTELLATIONS, true, store('0')), false)).toBe(false)
    expect(needFigures(readSkyPref(SKY_PREF_CONSTELLATIONS, true, store(null)), false)).toBe(true)
  })
})
