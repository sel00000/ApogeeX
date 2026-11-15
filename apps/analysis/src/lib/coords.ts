// Parse user-typed sky coordinates.
// Accepts decimal degrees ("133.7951 -7.2451"), sexagesimal with letters
// ("08h55m10.831s -07d14m42.53s") or colons ("08:55:10.8 -07:14:42"), comma or space separated.
// Returns null when the text is not coordinates (it may be an object name).

export interface Radec { ra: number; dec: number }

function sexa(parts: string[]): number {
  const [a, b = '0', c = '0'] = parts
  if (!(Number(b) >= 0 && Number(b) < 60 && Number(c) >= 0 && Number(c) < 60)) return NaN
  const sign = a.trim().startsWith('-') ? -1 : 1
  return sign * (Math.abs(parseFloat(a)) + parseFloat(b) / 60 + parseFloat(c) / 3600)
}

export function parseCoords(text: string): Radec | null {
  const t = text.trim().replace(/[,;]/g, ' ').replace(/\s+/g, ' ')
  if (!t) return null
  const num = '[+-]?\\d+(?:\\.\\d*)?'
  // decimal degrees
  let m = t.match(new RegExp(`^(${num})\\s*°?\\s+(${num})\\s*°?$`))
  if (m) return check({ ra: parseFloat(m[1]), dec: parseFloat(m[2]) })
  // hms / dms with letters
  m = t.match(new RegExp(`^(${num})\\s*h\\s*(${num})\\s*m\\s*(${num})\\s*s?\\s+(${num})\\s*[d°]\\s*(${num})\\s*['m′]\\s*(${num})\\s*(?:"|″|s)?$`, 'i'))
  if (m) return check({ ra: 15 * sexa([m[1], m[2], m[3]]), dec: sexa([m[4], m[5], m[6]]) })
  // colon or space separated sexagesimal: "08:55:10.8 -07:14:42" or "08 55 10.8 -07 14 42"
  const parts = t.split(/[:\s]+/)
  if (parts.length === 6 && parts.every((p) => new RegExp(`^${num}$`).test(p))) {
    return check({ ra: 15 * sexa(parts.slice(0, 3)), dec: sexa(parts.slice(3)) })
  }
  return null
}

function check(c: Radec): Radec | null {
  if (!(Number.isFinite(c.ra) && Number.isFinite(c.dec) && c.ra >= 0 && c.ra < 360 && c.dec >= -90 && c.dec <= 90)) return null
  return c
}

export const fmtRadec = (c: Radec) => `RA ${c.ra.toFixed(4)}°, Dec ${c.dec >= 0 ? '+' : ''}${c.dec.toFixed(4)}°`
