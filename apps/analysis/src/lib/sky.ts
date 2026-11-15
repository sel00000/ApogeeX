// Live sky services called straight from the browser (all send Access-Control-Allow-Origin: *).
// Approach and mirror lists follow 경보's TrueBlink (src/core/catalogs, src/core/resolve), whose
// docs note that the main CDS hosts in Strasbourg were down during the hackathon while the Harvard
// (CfA) and IDIA mirrors answered. Positions only: Gaia/SIMBAD never replace SPHEREx images.
import { readText, tryMirrors } from './catalogNet'

export const VIZIER_MIRRORS = ['https://vizier.cfa.harvard.edu', 'https://vizier.idia.ac.za', 'https://vizier.cds.unistra.fr']
export const SESAME_URLS = ['https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oxp/SNV?', 'https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?']
/** IRSA SPHEREx all-sky HiPS cube (102 spectral frames, PNG tiles, CORS allowed). */
export const SPHEREX_HIPS = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube'
export const GAIA_EPOCH = 2016.0
export const GAIA_MAX_ROWS = 400

export interface Star { id: string; ra: number; dec: number; pmRa?: number; pmDec?: number; g?: number }

const D = Math.PI / 180
const AS = 206264.80624709636

/** Gnomonic projection about (ra0, dec0): standard coordinates in arcsec (xi east, eta north). */
export function tanProject(ra0: number, dec0: number, ra: number, dec: number): [number, number] {
  const a0 = ra0 * D, d0 = dec0 * D, a = ra * D, d = dec * D
  const c = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0)
  return [(Math.cos(d) * Math.sin(a - a0) / c) * AS, ((Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / c) * AS]
}

/** Inverse gnomonic projection: standard coordinates (arcsec) → RA, Dec in degrees. */
export function tanDeproject(ra0: number, dec0: number, xi: number, eta: number): [number, number] {
  const x = xi / AS, y = eta / AS, d0 = dec0 * D
  const den = Math.cos(d0) - y * Math.sin(d0)
  const ra = ra0 + Math.atan2(x, den) / D
  const dec = Math.atan2(Math.sin(d0) + y * Math.cos(d0), Math.hypot(x, den)) / D
  return [((ra % 360) + 360) % 360, dec]
}

/** Sky position → analysis-grid pixel (PNG convention: x right = west, y down = south; centre n/2).
 *  Checked against every visit's pred_px in meta.json (agreement < 1e-6 px). */
export function skyToGridPx(crval: [number, number], cdeltArcsec: number, n: number, ra: number, dec: number): [number, number] {
  const [xi, eta] = tanProject(crval[0], crval[1], ra, dec)
  return [n / 2 - xi / cdeltArcsec, n / 2 - eta / cdeltArcsec]
}

export const mjdToJyear = (mjd: number) => 2000 + (mjd - 51544.5) / 365.25

/** Move a star from its catalogue epoch to a date with linear proper motion (parallax ignored:
 *  below one SPHEREx pixel for every field star). */
export function propagate(s: Star, mjd: number, epoch = GAIA_EPOCH): [number, number] {
  const dt = mjdToJyear(mjd) - epoch
  if (s.pmRa === undefined && s.pmDec === undefined) return [s.ra, s.dec]
  return tanDeproject(s.ra, s.dec, ((s.pmRa ?? 0) * dt) / 1000, ((s.pmDec ?? 0) * dt) / 1000)
}

const num = (s: string | undefined) => { if (!s || !s.trim()) return undefined; const v = Number(s); return Number.isFinite(v) ? v : undefined }

/** VizieR asu-tsv rows for I/355/gaiadr3 (Source, RA_ICRS, DE_ICRS, pmRA, pmDE, Gmag). */
export function parseGaiaTsv(text: string): Star[] {
  if (/<html/i.test(text.slice(0, 500))) throw new Error('returned an HTML page instead of a table')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('#'))
  if (!lines.length) return []
  const head = lines[0].split('\t').map((h) => h.trim())
  let k = 1
  while (k < lines.length && k <= 2 && (lines[k].startsWith('-') || lines[k].trim().split('\t').every((c) => !/^[+-]?\d/.test(c.trim())))) k++
  const out: Star[] = []
  for (; k < lines.length; k++) {
    const cells = lines[k].split('\t')
    const r: Record<string, string> = {}
    head.forEach((h, i) => (r[h] = (cells[i] ?? '').trim()))
    const ra = num(r.RA_ICRS), dec = num(r.DE_ICRS)
    if (ra === undefined || dec === undefined || !r.Source) continue
    out.push({ id: r.Source, ra, dec, pmRa: num(r.pmRA), pmDec: num(r.pmDE), g: num(r.Gmag) })
  }
  return out
}

/** Gaia DR3 stars within radiusArcsec of a position, brightest first, live from VizieR mirrors. */
export async function gaiaCone(ra: number, dec: number, radiusArcsec: number, signal?: AbortSignal): Promise<Star[]> {
  const c = `${ra.toFixed(6)} ${dec >= 0 ? '+' : ''}${dec.toFixed(6)}`
  const q = `-source=I/355/gaiadr3&-c=${encodeURIComponent(c)}&-c.rs=${radiusArcsec.toFixed(1)}&-out=Source,RA_ICRS,DE_ICRS,pmRA,pmDE,Gmag&-out.max=${GAIA_MAX_ROWS}&-sort=Gmag`
  return tryMirrors('Gaia DR3 (VizieR)', VIZIER_MIRRORS.map((h) => `${h}/viz-bin/asu-tsv?${q}`), async (res) => parseGaiaTsv(await readText(res)), { signal, timeoutMs: 15000 })
}

/** Name → J2000 position via CDS Sesame (browser, mirrors). null when no resolver knows the name. */
export async function sesame(name: string, signal?: AbortSignal): Promise<{ name: string; ra: number; dec: number; moved: boolean } | null> {
  const q = encodeURIComponent(name.trim())
  return tryMirrors('Sesame', SESAME_URLS.map((u) => `${u}${q}`), async (res) => {
    const xml = await readText(res)
    const ra = num(/<jradeg>([^<]+)<\/jradeg>/.exec(xml)?.[1]), dec = num(/<jdedeg>([^<]+)<\/jdedeg>/.exec(xml)?.[1])
    if (ra === undefined || dec === undefined) return null
    const oname = /<oname>([^<]+)<\/oname>/.exec(xml)?.[1]?.replace(/^(NAME|V\*|\*\*|\*)\s+/, '').trim()
    // Preserve catalogue J2000 coordinates; ephemeris propagation is a separate step.
    return { name: oname || name.trim(), ra, dec, moved: false }
  }, { signal, timeoutMs: 12000 })
}

// Central wavelength (µm) of the 102 cube channels (IRSA properties data_cube_crval3_arr, as in
// TrueBlink scripts/hips-rewrite.mjs). Frames 50 and 51 (channels 51, 52) are blank in DR1.
export const CHANNEL_UM = (
  '0.753 0.771 0.790 0.809 0.828 0.848 0.868 0.889 0.910 0.932 0.955 0.978 1.001 1.025 1.050 1.075 1.102 ' +
  '1.113 1.139 1.167 1.195 1.224 1.254 1.284 1.315 1.346 1.378 1.412 1.446 1.481 1.517 1.554 1.592 1.631 ' +
  '1.656 1.695 1.735 1.775 1.818 1.861 1.905 1.949 1.995 2.041 2.089 2.139 2.189 2.240 2.292 2.345 2.399 ' +
  '2.445 2.506 2.575 2.646 2.719 2.794 2.871 2.951 3.033 3.118 3.204 3.293 3.383 3.476 3.570 3.667 3.768 ' +
  '3.833 3.867 3.901 3.935 3.970 4.005 4.040 4.076 4.112 4.148 4.184 4.220 4.257 4.294 4.331 4.368 4.405 ' +
  '4.435 4.467 4.500 4.533 4.566 4.600 4.635 4.669 4.704 4.739 4.773 4.808 4.843 4.879 4.915 4.951 4.988'
).split(' ').map(Number)

/** Usable channels (1-based) sorted by wavelength, without the blank 51 and 52. */
export const MAP_CHANNELS = CHANNEL_UM.map((um, i) => ({ channel: i + 1, um })).filter((c) => c.channel !== 51 && c.channel !== 52).sort((a, b) => a.um - b.um || a.channel - b.channel)
