import { describe, expect, it } from 'vitest'
import { frameViewport } from './viewport'

describe('wide image / overlay coordinate agreement', () => {
  it('maps the same observed pixel and marker together at every field of view', () => {
    const n = 59, N = 177, offset = (N - n) / 2
    for (const zoom of [1, 3, 6, 12]) {
      const v = frameViewport(N, offset, [30.2, 28.7], zoom, 420)
      for (const p of [[0.5, 0.5], [29.5, 29.5], [31.4, 27.2], [58.5, 58.5]] as const) {
        const marker = v.project(p)
        const image = [(p[0] + offset - v.window.x0) / v.window.w * 420, (p[1] + offset - v.window.y0) / v.window.w * 420]
        expect(marker[0]).toBeCloseTo(image[0], 10)
        expect(marker[1]).toBeCloseTo(image[1], 10)
      }
    }
  })
  it('shows the original 6 arcmin window identically at wide zoom 3', () => {
    const a = frameViewport(59, 0, [29.5, 29.5], 1, 420)
    const b = frameViewport(177, 59, [29.5, 29.5], 3, 420)
    expect(a.project([34.25, 24.75])).toEqual(b.project([34.25, 24.75]))
  })
  it('keeps all 18 arcmin edges in the frame without moving the observed grid', () => {
    const v = frameViewport(177, 59, [0, 0], 1, 420)
    expect(v.window).toEqual({ x0: 0, y0: 0, w: 177 })
    expect(v.project([-59, -59])).toEqual([0, 0])
    expect(v.project([118, 118])).toEqual([420, 420])
  })
})
