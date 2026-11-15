import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TargetMeta } from '../types'
import { coldFrame, coldVisits, frameMedian, survival } from './cold'
import { brightnessFinding, findingsFor, motionFinding, spectrumFinding } from './findings'
import { MISSIONS, commonDetector, hasDetector, missionFor } from './missions'
import { RJ_K } from '../store'

const meta = (id: string) => JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8')) as TargetMeta

describe('cold-object filter', () => {
  const n = 9
  const blank = (v: number) => new Float32Array(n * n).fill(v)
  it('cancels a Rayleigh–Jeans star and keeps a source that is bright only at long wavelength', () => {
    const d5 = blank(10), d6 = blank(7)
    d5[4 * n + 4] += 100; d6[4 * n + 4] += 100 * RJ_K // ordinary star at the centre
    d5[1 * n + 1] += 2; d6[1 * n + 1] += 60 // cold object, almost nothing at 4 µm
    const c = coldFrame(d6, d5, RJ_K)
    expect(Math.abs(c[4 * n + 4])).toBeLessThan(1e-4)
    expect(c[1 * n + 1]).toBeGreaterThan(55)
    expect(frameMedian(c)).toBeCloseTo(0, 6) // backgrounds removed before subtracting
  })
  it('keeps missing pixels missing, never fills them', () => {
    const d5 = blank(1), d6 = blank(1)
    d5[3] = NaN
    const c = coldFrame(d6, d5, 0.77)
    expect(Number.isNaN(c[3])).toBe(true)
    expect(coldFrame(blank(NaN), d5, 0.77).every(Number.isNaN)).toBe(true)
  })
  it('survival is ~0 for a cancelled star, ~1 for a cold source, null when undetected', () => {
    const N = 21, base = () => { const f = new Float32Array(N * N); for (let i = 0; i < f.length; i++) f[i] = 5 + ((i * 7919) % 13) * 0.01; return f }
    const d5 = base(), d6 = base()
    d5[10 * N + 10] += 50; d6[10 * N + 10] += 50 * RJ_K
    d6[4 * N + 4] += 40
    const c = coldFrame(d6, d5, RJ_K)
    expect(Math.abs(survival(d6, c, N, 10.5, 10.5)!)).toBeLessThan(0.05)
    expect(survival(d6, c, N, 4.5, 4.5)!).toBeGreaterThan(0.9)
    expect(survival(d6, c, N, 16.5, 16.5)).toBeNull()
  })
  it('real data: WISE 0855 has filter frames in 5 of 9 visits, R Dra in none', () => {
    expect(coldVisits(meta('wise0855'))).toEqual([0, 2, 4, 7, 8])
    expect(coldVisits(meta('r_dra'))).toEqual([])
  })
})

describe('findings from the baked SPHEREx data', () => {
  it('Barnard: measured proper motion compared with the catalogue', () => {
    const f = motionFinding(meta('barnard'))!
    expect(f.kind).toBe('motion')
    expect(f.value).toMatch(/″\/년/)
    expect(f.reference).toBe('10.39″/년')
    expect(f.prov).toEqual(['spherex', 'catalog', 'model'])
    expect(['후보', '판단 보류']).toContain(f.level)
  })
  it('variables get a same-band brightness finding first, no motion finding', () => {
    const m = meta('rw_aur')
    const list = findingsFor(m)
    expect(list[0].kind).toBe('brightness')
    expect(list.some((f) => f.kind === 'motion')).toBe(false)
    expect(brightnessFinding(m)!.value).toMatch(/배/)
  })
  it('keeps Epsilon Indi B depths as model candidates and R Dra on hold', () => {
    const eps = spectrumFinding(meta('eps_indi_b'))!
    expect(eps.title).toBe('흡수 후보 · 모델 비교')
    expect(eps.level).toBe('후보')
    expect(eps.body).toContain('분자 검출 유의도나 온도 실측이 아닙니다')
    expect(eps.value).toContain('깊이')
    const r = spectrumFinding(meta('r_dra'))
    expect(r === null || r.level === '판단 보류' || r.level === '후보').toBe(true)
  })
  it('does not promote exploratory results to confirmed or likely discoveries in either language', () => {
    for (const id of Object.keys(MISSIONS)) for (const language of ['ko', 'en']) {
      const findings = findingsFor(meta(id), (ko,en) => language === 'ko' ? ko : en)
      for (const finding of findings) {
        expect(['후보', '판단 보류']).toContain(finding.level)
        expect(finding.title).not.toMatch(/움직였습니다|흡수 띠가 보입니다|Its brightness changed|Absorption bands show/)
      }
      const spectrum = spectrumFinding(meta(id), (ko,en) => language === 'ko' ? ko : en)
      if (spectrum) expect(spectrum.body).not.toMatch(/3σ|more than 3σ/)
    }
  })
})

describe('missions', () => {
  it('every challenge target has a mission whose steps set real state', () => {
    for (const id of ['barnard', 'eps_indi_b', 'wise0855', 'rw_aur', 'r_dra']) {
      const m = MISSIONS[id]
      expect(m.steps.length).toBeGreaterThanOrEqual(3)
      for (const s of m.steps) expect(Object.keys(s.action).length).toBeGreaterThan(0)
    }
  })
  it('common detector is one the viewer can actually show in most visits', () => {
    for (const id of ['wise0855', 'rw_aur', 'r_dra']) {
      const m = meta(id), d = commonDetector(m)
      const c = m.visits.filter((_, i) => hasDetector(m, i, d)).length
      for (let o = 1; o <= 6; o++) expect(c).toBeGreaterThanOrEqual(m.visits.filter((_, i) => hasDetector(m, i, o)).length)
    }
  })
  it('all mission variants distinguish residuals and detector ranges from detections', () => {
    for (const id of [...Object.keys(MISSIONS), 'patch']) for (const lang of ['ko','en'] as const) {
      const mission = missionFor(id, id === 'patch', lang)!
      const text = [mission.look, ...mission.steps.map(step => step.hint)].join(' ')
      expect(text).not.toMatch(/짝으로 붙어 있으면 움직인 것입니다|means motion|같은 검출기\(같은 파장\)|same detector \(the same wavelength\)|진짜 밝기 변화|real brightness change/)
    }
  })
})
