import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TargetMeta } from '../types'
import { MAP_CHANNELS, parseGaiaTsv, propagate, skyToGridPx, tanDeproject, tanProject } from './sky'

const meta = (id: string) => JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8')) as TargetMeta

describe('live sky helpers', () => {
  it('gnomonic projection round-trips', () => {
    for (const [ra0, dec0, ra, dec] of [[269.4, 4.7, 269.5, 4.8], [331.1, -56.8, 330.9, -56.7], [0.1, 89.5, 180, 89.6], [359.9, 0, 0.05, 0.02]]) {
      const [xi, eta] = tanProject(ra0, dec0, ra, dec)
      const [r, d] = tanDeproject(ra0, dec0, xi, eta)
      expect(Math.abs(((r - ra + 540) % 360) - 180)).toBeLessThan(1e-9)
      expect(Math.abs(d - dec)).toBeLessThan(1e-9)
    }
  })
  it('sky → grid pixel reproduces every baked prediction (pred_px from ra_app/dec_app)', () => {
    for (const id of ['barnard', 'eps_indi_b', 'wise0855', 'rw_aur', 'r_dra']) {
      const m = meta(id), n = m.wcs.size_px[0]
      for (const v of m.visits) {
        const [x, y] = skyToGridPx(m.wcs.crval, m.wcs.cdelt_arcsec, n, v.ra_app, v.dec_app)
        expect(Math.hypot(x - v.pred_px[0], y - v.pred_px[1])).toBeLessThan(1e-4)
      }
    }
  })
  it('parses a real VizieR Gaia DR3 answer (saved fixture)', () => {
    const stars = parseGaiaTsv(readFileSync('e2e/fixtures/gaia_eps_indi.tsv', 'utf8'))
    expect(stars.length).toBeGreaterThan(300)
    const gs = stars.map((s) => s.g).filter((g): g is number => g !== undefined)
    expect(gs[0]).toBeLessThan(gs[gs.length - 1]) // brightest first
    expect(stars.every((s) => Number.isFinite(s.ra) && Number.isFinite(s.dec))).toBe(true)
    expect(() => parseGaiaTsv('<html><body>error</body></html>')).toThrow()
  })
  it('proper motion moves Barnard’s Star about 10.4″ per year', () => {
    const s = { id: 'b', ra: 269.448507, dec: 4.739420, pmRa: -801.551, pmDec: 10362.394 }
    const mjd2016 = 51544.5 + 16 * 365.25
    const [ra, dec] = propagate(s, mjd2016 + 365.25)
    const [xi, eta] = tanProject(s.ra, s.dec, ra, dec)
    expect(Math.hypot(xi, eta)).toBeCloseTo(10.393, 2)
  })
  it('the all-sky map offers 100 channels (51 and 52 are blank in DR1), blue to red', () => {
    expect(MAP_CHANNELS).toHaveLength(100)
    expect(MAP_CHANNELS.some((c) => c.channel === 51 || c.channel === 52)).toBe(false)
    for (let i = 1; i < MAP_CHANNELS.length; i++) expect(MAP_CHANNELS[i].um).toBeGreaterThanOrEqual(MAP_CHANNELS[i - 1].um)
  })
})
