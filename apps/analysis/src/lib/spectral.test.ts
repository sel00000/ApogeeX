import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PhotRow } from '../components/PhotometryPanel'
import { FEATURES, TARGET_SPECTRAL, bandDepth, bestFitTemperature, measuredPoints, planckNu, scaleFor, wienPeakUm } from './spectral'
import type { SpecPoint } from './spectral'
import { usableSpectralRow, SPECTRAL_REJECT_FLAGS } from './quality'

const pt = (wave: number, flux: number, err = 0.01): SpecPoint => ({ wave, flux, err, det: 1, visit: 0, exposure: `e${wave}`, flags: [] })

describe('theory', () => {
  it('Planck F_nu shape: Wien peak of B_λ and hotter = bluer', () => {
    expect(wienPeakUm(2898)).toBeCloseTo(1, 3)
    // B_λ ∝ F_ν/λ² peaks at Wien's wavelength
    const T = 3000, grid = Array.from({ length: 2000 }, (_, i) => 0.3 + i * 0.002)
    const peak = grid.reduce((a, w) => (planckNu(w, T) / w ** 2 > planckNu(a, T) / a ** 2 ? w : a))
    expect(Math.abs(peak - wienPeakUm(T))).toBeLessThan(0.01)
    expect(planckNu(1, 6000) / planckNu(4, 6000)).toBeGreaterThan(planckNu(1, 1000) / planckNu(4, 1000))
  })
  it('best-fit temperature recovers a pure blackbody (unit test of the fit, not data)', () => {
    const pts = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map((w) => pt(w, 7 * planckNu(w, 1500)))
    const fit = bestFitTemperature(pts)!
    expect(Math.abs(fit.T - 1500) / 1500).toBeLessThan(0.02)
    expect(fit.rms).toBeLessThan(0.01)
    expect(scaleFor(pts, 1500)).toBeCloseTo(7, 3)
  })
})

describe('band depth', () => {
  const f = FEATURES.find((x) => x.id === 'ch4_33')!
  it('flat spectrum → depth 0, dip → measured fraction, missing points → not judged', () => {
    const flat = [2.1, 2.12, 2.15, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9].map((w) => pt(w, 10))
    expect(bandDepth(flat, f).depth).toBeCloseTo(0, 9)
    const dip = flat.map((p) => (p.wave >= 3.15 && p.wave <= 3.45 ? { ...p, flux: 4 } : p))
    expect(bandDepth(dip, f).depth).toBeCloseTo(0.6, 9)
    expect(bandDepth(dip.filter((p) => p.wave < 3), f).status).toBe('outside')
    expect(bandDepth(dip.filter((p) => p.wave < 3.25 || p.wave > 3.5), f).status).toBe('insufficient')
  })
  it('uncertainty is never smaller than the point spread', () => {
    const noisy = [2.1, 2.12, 2.15, 2.18, 3.2, 3.25, 3.3, 3.35, 3.4, 3.7, 3.8, 3.85, 3.9].map((w, i) => pt(w, 10 + (i % 2 ? 2 : -2), 0.001))
    expect(bandDepth(noisy, f).sigma!).toBeGreaterThan(0.05)
  })
})

describe('real SPHEREx data', () => {
  const load = (id: string): PhotRow[] => JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8')).photometry
  it('only measured, finite quality-approved flux with known uncertainty becomes spectrum points', () => {
    for (const id of Object.keys(TARGET_SPECTRAL)) {
      const rows = load(id), pts = measuredPoints(rows)
      expect(pts.length).toBe(rows.filter(usableSpectralRow).length)
      expect(pts.every((p, i) => i === 0 || p.wave >= pts[i - 1].wave)).toBe(true)
    }
  })
  it('R Dra has too few photometric points for a spectrum (saturation) — the lab must say so', () => {
    expect(measuredPoints(load('r_dra')).length).toBeLessThan(5)
  })
  it('excludes defective positive Epsilon Indi B measurements instead of forcing a literature result', () => {
    const rows = load('eps_indi_b')
    const rejected = rows.filter(r => r.flux_mjy !== null && r.flux_mjy > 0 && r.flags.includes('NONFUNC'))
    expect(rejected.length).toBeGreaterThan(0)
    const pts = measuredPoints(rows)
    expect(pts.every(p => !p.flags.some(f => SPECTRAL_REJECT_FLAGS.has(f)))).toBe(true)
    for (const r of rejected) expect(pts.some(p => p.exposure === r.exposure && p.det === r.detector)).toBe(false)
  })
  it('does not invent zero uncertainty or accept invalid numerical values', () => {
    const base = {visit:0,exposure:'x',detector:1,mjd:60000,wave_um:1,bandwidth_um:.1,flux_mjy:1,err_mjy:.1,flags:[],note:null} as PhotRow
    expect(measuredPoints([base])).toHaveLength(1)
    for (const change of [{err_mjy:null},{err_mjy:0},{flux_mjy:Infinity},{wave_um:NaN},{flags:['PERSIST']}])
      expect(measuredPoints([{...base,...change}])).toHaveLength(0)
  })
})
