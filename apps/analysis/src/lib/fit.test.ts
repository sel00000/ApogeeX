import { describe, expect, it } from 'vitest'
import type { TargetMeta, Visit } from '../types'
import { fitProperMotion } from './fit'

function fakeMeta(slopePxYr: [number, number]): TargetMeta {
  const visits = [0, 100, 200, 300, 400].map((d) => ({
    mjd: 61000 + d,
    pred_px: [29.5, 29.5],
    meas_px: [29.5 + (slopePxYr[0] * d) / 365.25, 29.5 + (slopePxYr[1] * d) / 365.25],
    meas_err_px: 0.1,
  })) as unknown as Visit[]
  return {
    visits,
    wcs: { cdelt_arcsec: 6.15 },
    astrometry: { pmra: 100, pmdec: -50 },
  } as unknown as TargetMeta
}

describe('fitProperMotion', () => {
  it('returns the catalog value when residuals are flat', () => {
    const f = fitProperMotion(fakeMeta([0, 0]))!
    expect(f.pm[0]).toBeCloseTo(100, 6)
    expect(f.pm[1]).toBeCloseTo(-50, 6)
    expect(f.sigmaDiff).toBeCloseTo(0, 6)
  })
  it('converts a pixel drift to mas/yr with east = −x, north = −y', () => {
    const f = fitProperMotion(fakeMeta([-1, 1]))! // drifting left (east) and down (south)
    expect(f.pm[0]).toBeCloseTo(100 + 6150, 3)
    expect(f.pm[1]).toBeCloseTo(-50 - 6150, 3)
  })
})
