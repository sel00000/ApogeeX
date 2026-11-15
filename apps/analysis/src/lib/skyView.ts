// The Find (sky) stage: its view in the URL (`sky=<ra>,<dec>,<fov>`), the remembered overlay switches
// and the hand-over to the planetarium. Pure helpers, unit-tested in skyView.test.ts.
// Same limits as gl/SkyGlobe (FOV_MIN, FOV_MAX; a test checks they agree). Not imported from there, so the
// URL code in the main bundle does not pull in three.js.
export const SKY_FOV_MIN = 1.5
export const SKY_FOV_MAX = 100

export interface SkyParam { ra: number; dec: number; fov: number }

/** `sky=<ra>,<dec>,<fov>` (degrees). Anything malformed gives null (the parameter is ignored).
 *  RA is wrapped into [0, 360); the field is kept inside what the globe can show. */
export function parseSkyParam(raw: string | null | undefined): SkyParam | null {
  if (typeof raw !== 'string') return null
  const parts = raw.split(',')
  if (parts.length !== 3 || parts.some((p) => !/^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(p))) return null
  const [ra, dec, fov] = parts.map(Number)
  if (![ra, dec, fov].every(Number.isFinite)) return null
  if (Math.abs(dec) > 90 || !(fov > 0)) return null
  return { ra: ra >= 0 && ra < 360 ? ra : ((ra % 360) + 360) % 360, dec, fov: Math.min(SKY_FOV_MAX, Math.max(SKY_FOV_MIN, fov)) }
}

const num = (v: number, digits: number) => String(Number(v.toFixed(digits)))

/** The value written into the URL: four decimals for the centre, two for the field. */
export function formatSkyParam(v: { ra: number; dec: number; fovDeg: number }): string {
  const ra = ((v.ra % 360) + 360) % 360
  return `${num(ra >= 359.99995 ? 0 : ra, 4)},${num(v.dec, 4)},${num(v.fovDeg, 2)}`
}

/** Field of view handed to the planetarium (its own limits for this hand-over: 5 to 120 degrees). */
export const planetariumFov = (fovDeg: number) => Math.min(120, Math.max(5, Number.isFinite(fovDeg) ? fovDeg : 60))

/** The `spherex-navigate` message that opens the planetarium on the same sky. */
export function planetariumMessage(v: { ra: number; dec: number; fovDeg: number }) {
  return {
    type: 'spherex-navigate',
    view: 'planetarium',
    params: { ra: Number(v.ra.toFixed(4)), dec: Number(v.dec.toFixed(4)), fov: Number(planetariumFov(v.fovDeg).toFixed(2)), frame: 'equatorial' },
  } as const
}

export const SKY_PREF_CONSTELLATIONS = 'spherex-analysis:sky:constellations'
export const SKY_PREF_GROUND = 'spherex-analysis:sky:ground'

type Store = Pick<Storage, 'getItem' | 'setItem'>
const defaultStore = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** A remembered switch ('1' / '0'); the default when storage is missing, blocked or holds anything else. */
export function readSkyPref(key: string, fallback: boolean, store: Store | null = defaultStore()): boolean {
  try {
    const v = store?.getItem(key)
    return v === '1' ? true : v === '0' ? false : fallback
  } catch { return fallback }
}

export function writeSkyPref(key: string, on: boolean, store: Store | null = defaultStore()): void {
  try { store?.setItem(key, on ? '1' : '0') } catch { /* storage blocked: the choice lasts for this page only */ }
}

/** Whether the constellation figures should be downloaded now: only when the layer is on and they have not been requested yet. */
export function needFigures(layerOn: boolean, requested: boolean): boolean {
  return layerOn && !requested
}
