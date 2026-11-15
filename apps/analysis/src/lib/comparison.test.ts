import { describe, expect, it } from 'vitest'
import type { TargetMeta } from '../types'
import { comparisonStatus } from './comparison'

describe('difference coverage guard', () => {
  const meta = { visits: [{ detectors:[1],wave_um:[.8,1] }, {detectors:[2],wave_um:[1.3,1.5]}] } as TargetMeta
  it('withholds disjoint wavelength or absent detector data', () => {
    expect(comparisonStatus(meta,0,1,0).blocked).toBe(true)
    expect(comparisonStatus(meta,0,1,1).reason).toBe('missing-detector')
  })
  it('does not call broad wavelength overlap a calibrated comparison', () => {
    const overlapping = {visits:[{detectors:[1],wave_um:[.8,1]}, {detectors:[1],wave_um:[.9,1.1]}]} as TargetMeta
    expect(comparisonStatus(overlapping,0,1,1)).toEqual({blocked:false,reason:'unmatched-pixel-response'})
  })
})
