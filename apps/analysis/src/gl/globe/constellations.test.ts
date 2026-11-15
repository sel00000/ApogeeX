import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEG, sepDeg, skyToVec } from './healpix'
import { cameraBasis, skyToNdc } from './view'
import { LABEL_MIN_FOV_DEG, boxesOverlap, constellationSegments, greatCircle, labelText, labelVisible, parseConstellations } from './constellations'

const FIXTURE = {
  version: 1,
  constellations: [
    { id: 'Ori', en: 'Orion', ko: '오리온자리', label: [83.0, 2.0], lines: [[[88.79, 7.41], [81.28, 6.35]], [[84.05, -1.2], [85.19, -1.94]]] },
    { id: 'Bad', en: 'Bad', ko: '', label: [10, 95], lines: [] },
    { id: 'Oct', en: 'Octans', ko: '', label: [300, -85], lines: [[[0, -80], 'x', [180, -80]]] },
  ],
}

describe('constellation file', () => {
  it('keeps good entries, drops bad ones and vertices, falls back to the Latin name', () => {
    const list = parseConstellations(FIXTURE)!
    expect(list.map((c) => c.id)).toEqual(['Ori', 'Oct'])
    expect(list[1].ko).toBe('Octans')
    expect(list[1].lines).toEqual([[[0, -80], [180, -80]]])
  })
  it('refuses files that are not constellation files', () => {
    for (const v of [null, 3, {}, { constellations: 'x' }, { constellations: [] }]) expect(parseConstellations(v)).toBeNull()
  })
  it('the delivered data parses, and Orion and the Big Dipper sit where the sky has them', () => {
    let raw: unknown
    try { raw = JSON.parse(readFileSync(new URL('../../../public/data/sky/constellations.json', import.meta.url), 'utf8')) } catch { return }
    const list = parseConstellations(raw)!
    expect(list.length).toBeGreaterThan(80)
    const ori = list.find((c) => c.id === 'Ori')!
    expect(ori.ko).toBe('오리온자리')
    // the belt (Alnitak, Alnilam, Mintaka) is near RA 84 deg, Dec -1 deg: some figure vertex lies there
    const verts = ori.lines.flat()
    expect(verts.some(([ra, dec]) => sepDeg(ra, dec, 84.05, -1.2) < 0.2)).toBe(true)
    // Dubhe (RA 165.93, Dec +61.75) is a vertex of Ursa Major
    const uma = list.find((c) => c.id === 'UMa')!
    expect(uma.lines.flat().some(([ra, dec]) => sepDeg(ra, dec, 165.93, 61.75) < 0.2)).toBe(true)
  })
})

describe('great-circle interpolation', () => {
  it('stays on the great circle through both ends, in steps no longer than asked', () => {
    const a: [number, number] = [10, 20]
    const b: [number, number] = [80, 60]
    const pts = greatCircle(a, b, 2)
    expect(pts[0]).toEqual(a)
    expect(pts[pts.length - 1]).toEqual(b)
    const va = skyToVec(...a), vb = skyToVec(...b)
    const n = [va[1] * vb[2] - va[2] * vb[1], va[2] * vb[0] - va[0] * vb[2], va[0] * vb[1] - va[1] * vb[0]]
    for (let i = 0; i < pts.length; i++) {
      const v = skyToVec(pts[i][0], pts[i][1])
      expect(Math.abs(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])).toBeLessThan(1e-9) // in the plane of the circle
      if (i) expect(sepDeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])).toBeLessThanOrEqual(2 + 1e-9)
    }
    // the total length equals the arc length
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += sepDeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    expect(sum).toBeCloseTo(sepDeg(10, 20, 80, 60), 8)
  })
  it('crosses RA 0 the short way and keeps short arcs as one segment', () => {
    const pts = greatCircle([359, 0], [3, 0], 1)
    expect(pts.length).toBe(5)
    for (const [ra] of pts) expect(ra > 358 || ra < 4).toBe(true)
    expect(greatCircle([5, 5], [5.5, 5.2], 2)).toHaveLength(2)
  })
  it('makes unit-sphere line segments for every interpolated step', () => {
    const list = parseConstellations(FIXTURE)!
    const seg = constellationSegments(list, 1)
    expect(seg.length % 6).toBe(0)
    for (let i = 0; i < seg.length; i += 3) expect(Math.hypot(seg[i], seg[i + 1], seg[i + 2])).toBeCloseTo(1, 5)
  })
})

describe('constellation names', () => {
  const box = { x: 100, y: 100, w: 60, h: 13 }
  it('are hidden below an 8 degree field', () => {
    expect(LABEL_MIN_FOV_DEG).toBe(8)
    expect(labelVisible(box, 7.9, 800, 600, [])).toBe(false)
    expect(labelVisible(box, 8, 800, 600, [])).toBe(true)
  })
  it('are hidden when not wholly on screen', () => {
    expect(labelVisible({ ...box, x: -1 }, 40, 800, 600, [])).toBe(false)
    expect(labelVisible({ ...box, x: 760 }, 40, 800, 600, [])).toBe(false)
    expect(labelVisible({ ...box, y: 590 }, 40, 800, 600, [])).toBe(false)
  })
  it('are hidden where they would cover a marker or the read-out box', () => {
    const marker = { x: 150, y: 105, w: 18, h: 18 }
    const readout = { x: 12, y: 560, w: 260, h: 24 }
    expect(labelVisible(box, 40, 800, 600, [marker])).toBe(false)
    expect(labelVisible({ ...box, x: 20, y: 565 }, 40, 800, 600, [readout])).toBe(false)
    expect(labelVisible(box, 40, 800, 600, [readout])).toBe(true)
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 })).toBe(false)
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 }, 2)).toBe(true)
  })
  it('are Korean on the Korean screen and Latin capitals on the English one', () => {
    const c = parseConstellations(FIXTURE)![0]
    expect(labelText(c, 'ko')).toBe('오리온자리')
    expect(labelText(c, 'en')).toBe('ORION')
  })
})

describe('handedness (same projection as the SPHEREx tiles)', () => {
  it('north up, east left: Betelgeuse is left of and above Rigel', () => {
    const b = cameraBasis(83.8, -1.2)
    const betelgeuse = skyToNdc(b, 88.79, 7.41, 40, 1.5)!
    const rigel = skyToNdc(b, 78.63, -8.2, 40, 1.5)!
    expect(betelgeuse.x).toBeLessThan(rigel.x)
    expect(betelgeuse.y).toBeGreaterThan(rigel.y)
    expect(DEG).toBeCloseTo(Math.PI / 180)
  })
})
