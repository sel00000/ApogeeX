import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { TargetMeta } from '../types'
import { makeCube, measuredSegments, toCube } from './cube'

const meta: TargetMeta = JSON.parse(readFileSync(new URL('../../public/data/barnard/meta.json', import.meta.url), 'utf8'))
it('measured tracks preserve observation gaps and use centroids rather than predictions', () => {
  const visits = meta.visits.slice(0, 5).map((v, i) => ({ ...v, meas_px: i === 2 ? null : [v.pred_px[0] + 0.2, v.pred_px[1] - 0.1] as [number, number] }))
  const m = { ...meta, visits }
  const cube = makeCube(m)
  const paths = measuredSegments(m, cube)
  expect(paths.map(p => p.length)).toEqual([2, 2])
  expect(paths[0][0]).toEqual(toCube(cube, visits[0].meas_px!, visits[0].mjd))
  expect(paths[1][0]).toEqual(toCube(cube, visits[3].meas_px!, visits[3].mjd))
  expect(paths[0][0]).not.toEqual(toCube(cube, visits[0].pred_px, visits[0].mjd))
})
it('isolated or absent measurements do not create a fabricated line', () => {
  const m = { ...meta, visits: meta.visits.map((v, i) => ({ ...v, meas_px: i === 1 ? v.pred_px : null })) }
  expect(measuredSegments(m, makeCube(m))).toEqual([])
})
