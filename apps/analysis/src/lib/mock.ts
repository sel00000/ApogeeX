// UI-development mock data. Used ONLY when ?mock=1, and the app shows a
// full-width "모의 데이터" banner whenever it is active. Nothing here is real.
import type { TargetMeta, TargetsIndex, Vec3, Visit } from '../types'

const IDS: [string, string][] = [
  ['barnard', "Barnard's Star"],
  ['eps_indi_b', 'Epsilon Indi B'],
  ['wise0855', 'WISE 0855-0714'],
  ['rw_aur', 'RW Aurigae'],
  ['r_dra', 'R Draconis'],
]

export function mockTargets(): TargetsIndex {
  return {
    generated_utc: new Date().toISOString(),
    code_version: 'mock',
    targets: IDS.map(([id, display_name], i) => ({
      id,
      display_name,
      // exercise every status in the UI
      status: i === 4 ? 'no_data' : 'ok',
      status_detail: i === 4 ? '모의: no_data 상태 표시 확인용' : null,
      n_visits: i === 4 ? 0 : 6,
    })),
  }
}

const N = 64

function mockFrame(x: number, y: number, seed: number): string {
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  const img = g.createImageData(N, N)
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const d2 = (i - x) ** 2 + (j - y) ** 2
      const v = Math.min(255, 30 + rnd() * 25 + 220 * Math.exp(-d2 / 3))
      const k = (j * N + i) * 4
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  return c.toDataURL()
}

export function mockMeta(id: string): TargetMeta {
  const mjd0 = 60800
  const visits: Visit[] = Array.from({ length: 6 }, (_, k) => {
    const mjd = mjd0 + k * 90
    const x = 32 + k * 0.8
    const y = 32 + k * 0.2
    const a = (2 * Math.PI * (mjd - 60755)) / 365.25
    const earth: Vec3 = [Math.cos(a), Math.sin(a) * 0.917, Math.sin(a) * 0.398]
    return {
      mjd,
      utc: new Date((mjd - 40587) * 86400e3).toISOString(),
      png: mockFrame(x, y, k + 1),
      diff_png: mockFrame(x + 1, y + 1, k + 100),
      n_exp: 4,
      detectors: [1, 2],
      wave_um: [0.75, 1.1],
      earth_au: earth,
      target_au: [1000, 2000 + k, 3000],
      ra_app: 0,
      dec_app: 0,
      pred_px: [x, y],
      meas_px: k % 2 === 0 ? [x + 0.3, y - 0.2] : null,
      meas_err_px: 0.2,
      meas_note: k % 2 === 0 ? undefined : 'SNR < 5',
      exposures: [`exp-${k}-D1`, `exp-${k}-D2`],
      irsa_uris: [],
    }
  })
  const dense = { mjd: [] as number[], earth_au: [] as Vec3[], target_au: [] as Vec3[] }
  for (let m = mjd0; m <= mjd0 + 450; m++) {
    const a = (2 * Math.PI * (m - 60755)) / 365.25
    dense.mjd.push(m)
    dense.earth_au.push([Math.cos(a), Math.sin(a) * 0.917, Math.sin(a) * 0.398])
    dense.target_au.push([1000, 2000 + (m - mjd0) / 90, 3000])
  }
  return {
    id,
    display_name: IDS.find(([i]) => i === id)?.[1] ?? id,
    astrometry: {
      ra: 0, dec: 0, parallax_mas: 100, pmra: 0, pmdec: 0, rv_kms: null,
      ref_epoch: 2016.0, source: 'MOCK', warnings: ['모의 데이터'],
    },
    wcs: { crval: [0, 0], cdelt_arcsec: 6.15, size_px: [N, N], north_up: true, east_left: true },
    frame: {
      cutout_deg: 0.15, frame_deg: 0.1, reproject: 'reproject_interp (bilinear)',
      combine: 'nanmean', mask_always: [], mask_off_source: [], mask_value: [],
      nan_pixels: 'transparent', not_masked: '', visit_gap_days: 2,
    },
    stretch: {},
    diff_stretch: { kind: 'linear', center: 0, limit: 1, formula: 'v = 0.5 + x/2' },
    visits,
    dense,
    longterm: { year: [], target_au: [] },
    provenance: { collections: ['mock'], query_time_utc: '', code_version: 'mock' },
  }
}
