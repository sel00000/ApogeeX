import { describe, expect, it } from 'vitest'
import { parseCoords } from './coords'

describe('parseCoords', () => {
  it('reads the WISE 0855 coordinates as written in the challenge', () => {
    const c = parseCoords('08h55m10.831s -07d14m42.53s')!
    expect(c.ra).toBeCloseTo(133.7951292, 6)
    expect(c.dec).toBeCloseTo(-7.2451472, 6)
  })
  it('reads decimal degrees and colon sexagesimal', () => {
    expect(parseCoords('269.4486, 4.7398')).toEqual({ ra: 269.4486, dec: 4.7398 })
    const c = parseCoords('17:57:48.5 +04:41:36')!
    expect(c.ra).toBeCloseTo(269.452083, 5)
    expect(c.dec).toBeCloseTo(4.693333, 5)
  })
  it('keeps the sign of small negative declinations', () => {
    expect(parseCoords('10:00:00 -00:30:00')!.dec).toBeCloseTo(-0.5, 9)
  })
  it('returns null for names and out-of-range values', () => {
    expect(parseCoords("Barnard's Star")).toBeNull()
    expect(parseCoords('400 10')).toBeNull()
    expect(parseCoords('10 95')).toBeNull()
    for (const input of ['10:60:00 +20:00:00', '10:00:60 +20:00:00', '10:00:00 -20:-01:00', '24:00:00 +00:00:00', '10:00:00 +90:00:01'])
      expect(parseCoords(input)).toBeNull()
  })
})
