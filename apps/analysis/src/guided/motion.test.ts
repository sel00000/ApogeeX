import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { TargetMeta } from '../types'
vi.mock('../lib/data', () => ({ frameUrl: (id:string,file:string) => `/data/${id}/${file}` }))
import { makeMotionPair, observationPeriod, prediction, selectedWaves } from './motion'
const meta = JSON.parse(readFileSync(new URL('../../public/data/barnard/meta.json', import.meta.url), 'utf8')) as TargetMeta

describe('guided motion scientific boundaries', () => {
  it('compares real D6 frames more than a year apart and retains their metadata', () => {
    const p = makeMotionPair(meta)
    expect(p.detector).toBe(6)
    expect(p.a).toBe(0); expect(p.b).toBe(12)
    expect(p.days).toBeGreaterThan(365)
    expect(selectedWaves(meta,p.a,p.detector)![0]).toBeCloseTo(4.4183)
  })
  it('does not silently replace missing frames or mix detectors', () => {
    const copy = structuredClone(meta)
    delete copy.visits[12].f32_det!['6']
    expect(()=>makeMotionPair(copy)).toThrow()
  })
  it('labels northward displacement from catalogue-predicted pixel positions', () => {
    const result=prediction(meta,makeMotionPair(meta))
    expect(result.northArcsec).toBeGreaterThan(10)
    expect(result.eastArcsec).toBeLessThan(0)
    expect(result.pixels).toBeGreaterThan(1.6)
    expect(result.pixels).toBeLessThan(1.8)
  })
  it('shows the actual multi-day detector exposure ranges, not a single visit date', () => {
    const A=observationPeriod(meta,0,6),B=observationPeriod(meta,12,6)
    expect(A.label).toBe('2025.08.15–16')
    expect(B.label).toBe('2026.08.16–20')
  })
  it('rejects unsupported motion targets instead of reusing other pair indices', () => {
    expect(()=>makeMotionPair({...meta,id:'r_dra'})).toThrow()
  })
  it('loads dedicated real detector pairs for all three moving targets', () => {
    for(const [id,indices] of [['barnard',[0,12]],['eps_indi_b',[0,18]],['wise0855',[0,8]]] as const){
      const target=JSON.parse(readFileSync(new URL(`../../public/data/${id}/meta.json`,import.meta.url),'utf8')) as TargetMeta
      const pair=makeMotionPair(target)
      expect([pair.a,pair.b]).toEqual(indices)
      expect(pair.days).toBeGreaterThan(365)
      expect(observationPeriod(target,pair.b,pair.detector).startMjd).toBeGreaterThan(observationPeriod(target,pair.a,pair.detector).endMjd)
    }
  })
})
