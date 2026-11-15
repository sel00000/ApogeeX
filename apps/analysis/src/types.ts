// Data contract between scripts/bake.py and the frontend.
// JSON Schema mirrors live in schema/*.schema.json.

export type TargetStatus = 'ok' | 'no_data' | 'fetch_failed'

export interface TargetEntry {
  id: string
  display_name: string
  status: TargetStatus
  /** Human-readable reason when status !== 'ok' */
  status_detail?: string | null
  n_visits?: number
  /** frame centre (deg), for linking coordinate searches */
  ra?: number
  dec?: number
}

export interface TargetsIndex {
  generated_utc: string
  code_version: string
  targets: TargetEntry[]
}

/** Provenance badge kinds shown next to every number / graphic */
export type Provenance = 'spherex' | 'catalog' | 'model'

export interface Astrometry {
  ra: number
  dec: number
  parallax_mas: number
  parallax_err_mas?: number | null
  pmra: number
  pmdec: number
  rv_kms: number | null
  ruwe?: number | null
  ref_epoch: number
  source: string
  selection_note?: string
  warnings: string[]
}

export interface CommonWcs {
  crval: [number, number]
  cdelt_arcsec: number
  size_px: [number, number]
  north_up: true
  east_left: true
}

export type Vec3 = [number, number, number]

export interface FrameInfo {
  cutout_deg: number
  frame_deg: number
  reproject: string
  combine: string
  mask_always: string[]
  mask_off_source: string[]
  mask_value: number[]
  nan_pixels: string
  not_masked: string
  max_exp_per_visit?: number | null
  min_visit_spacing_days?: number | null
  visit_gap_days: number
}

export interface DiffStretch {
  kind: string
  center: number
  limit: number
  formula: string
}

export interface Visit {
  mjd: number
  utc: string
  png: string
  diff_png: string
  /** raw float32 frame (scripts/bake.py, scripts/export_frames.py) */
  f32?: string
  /** per-detector frames, keyed by detector number */
  f32_det?: Record<string, string>
  n_exp: number
  detectors: number[]
  wave_um: [number, number] | null
  earth_au: Vec3
  target_au: Vec3
  ra_app: number
  dec_app: number
  pred_px: [number, number]
  meas_px: [number, number] | null
  meas_err_px: number | null
  meas_note?: string | null
  exposures: string[]
  irsa_uris: string[]
  /** patches: fraction of frame pixels without data */
  masked_frac?: number
}

export interface TargetMeta {
  id: string
  /** 'patch' = arbitrary coordinates (scripts/patch.py): no astrometry, no predictions */
  kind?: 'target' | 'patch'
  /** where frames live when not under data/<id>/ (patches from the server) */
  base?: string
  center?: { ra: number; dec: number }
  fov_deg?: number
  status?: 'no_data' | 'fetch_failed'
  status_detail?: string
  /** 0.3° context frames on the same grid centre (scripts/bake_wide.py) */
  wide?: {
    frame_deg: number
    size_px: [number, number]
    offset_px: number
    visits: ({ f32: string; f32_det: Record<string, string>; n_exp: number; failed_exp?: number; exposures?: string[]; irsa_uris?: string[] } | null)[]
    note?: string
  }
  display_name: string
  astrometry: Astrometry
  wcs: CommonWcs
  frame: FrameInfo
  stretch?: Record<string, number | string>
  diff_stretch: DiffStretch
  visits: Visit[]
  dense: { mjd: number[]; earth_au: Vec3[]; target_au: Vec3[] }
  longterm: { year: number[]; target_au: Vec3[]; note?: string }
  notes?: string[]
  provenance: { collections: string[]; query_time_utc: string; code_version: string; exposures_found?: number }
}
