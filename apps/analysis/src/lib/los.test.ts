import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TargetMeta, TargetsIndex } from '../types'
import { losBasis, losPixel, makeLosCamera, projectToPx, pxDistance, radecToVec } from './los'
import { makeCube, pxAt, toCube } from './cube'
import { dot, norm, stateAt, sub } from './ephem'

const DATA = join(__dirname, '../../public/data')
const index: TargetsIndex = JSON.parse(readFileSync(join(DATA, 'targets.json'), 'utf8'))
const metas: TargetMeta[] = index.targets
  .filter((t) => t.status === 'ok' && existsSync(join(DATA, t.id, 'meta.json')))
  .map((t) => JSON.parse(readFileSync(join(DATA, t.id, 'meta.json'), 'utf8')))

describe('baked data present', () => {
  it('has at least one target with visits', () => {
    expect(metas.length).toBeGreaterThan(0)
    expect(readdirSync(DATA)).toContain('targets.json')
  })
})

describe.each(metas.map((m) => [m.id, m] as const))('LOS camera — %s', (_id, meta) => {
  const n = meta.wcs.size_px[0]

  it('basis is orthonormal; crval lands on the frame centre', () => {
    const b = losBasis(meta.wcs)
    expect(norm(b.forward)).toBeCloseTo(1, 12)
    expect(norm(b.up)).toBeCloseTo(1, 12)
    expect(Math.abs(dot(b.forward, b.up))).toBeLessThan(1e-12)
    const c = projectToPx(makeLosCamera(meta.wcs), b.forward, meta.wcs)
    expect(pxDistance(c, [n / 2, n / 2])).toBeLessThan(1e-6)
  })

  it('north is up and east is left (as in the PNG frames)', () => {
    const cam = makeLosCamera(meta.wcs)
    const [ra, dec] = meta.wcs.crval
    const d = 30 / 3600 // 30″ ≈ 4.9 px
    const north = projectToPx(cam, radecToVec(ra, dec + d), meta.wcs)
    const east = projectToPx(cam, radecToVec(ra + d / Math.cos((dec * Math.PI) / 180), dec), meta.wcs)
    expect(north[1]).toBeLessThan(n / 2 - 4) // up = smaller y
    expect(Math.abs(north[0] - n / 2)).toBeLessThan(0.01)
    expect(east[0]).toBeLessThan(n / 2 - 4) // east = left
  })

  it('3D camera projection of the target matches pred_px at every visit (< 0.5 px)', () => {
    let worst = 0
    for (const v of meta.visits) {
      const { earth, target } = stateAt(meta, v.mjd)
      worst = Math.max(worst, pxDistance(losPixel(meta.wcs, earth, target), v.pred_px))
    }
    expect(worst).toBeLessThan(0.5)
    expect(worst).toBeLessThan(0.01) // in practice: gnomonic ≡ perspective
  })

  it('zoomed / offset view windows keep the pixel mapping', () => {
    const c: [number, number] = [meta.visits.at(-1)!.pred_px[0], meta.visits.at(-1)!.pred_px[1]]
    for (const v of meta.visits) {
      const cam = makeLosCamera(meta.wcs, undefined, { zoom: 16, center: c })
      expect(pxDistance(projectToPx(cam, sub(v.target_au, v.earth_au), meta.wcs), v.pred_px)).toBeLessThan(0.01)
    }
  })

  it('space-time cube: positions from 3D geometry match pred_px; time runs bottom → top', () => {
    const cube = makeCube(meta)
    let lastZ = -1
    for (const v of meta.visits) {
      const px = pxAt(meta, v.mjd)
      expect(pxDistance(px, v.pred_px)).toBeLessThan(0.01)
      const [x, y, z] = toCube(cube, px, v.mjd)
      expect(Math.abs(x)).toBeLessThanOrEqual(cube.half)
      expect(Math.abs(y)).toBeLessThanOrEqual(cube.half)
      expect(z).toBeGreaterThanOrEqual(lastZ)
      lastZ = z
    }
    expect(lastZ).toBeCloseTo(cube.height, 9)
    // north up / east left: smaller PNG y (north) → larger cube Y
    expect(toCube(cube, [cube.cx, cube.cy - 1], cube.t0)[1]).toBeGreaterThan(0)
  })

  it('interpolation between visits stays continuous (no jumps > 0.05 px/day)', () => {
    const t0 = meta.dense.mjd[0] + 1
    const t1 = meta.dense.mjd[meta.dense.mjd.length - 2]
    let prev: [number, number] | null = null
    for (let t = t0; t < t1; t += 0.5) {
      const { earth, target } = stateAt(meta, t)
      const p = losPixel(meta.wcs, earth, target)
      if (prev) expect(pxDistance(p, prev)).toBeLessThan(0.05)
      prev = p
    }
  })
})
