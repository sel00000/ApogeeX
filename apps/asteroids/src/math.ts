import { t as tr } from "./i18n";
/** MJD UTC -> TDB, 2025–2026: TT offset + periodic TDB term (< 2ms).
 * Image overlay uses exact precomputed observation epochs, not this approximation. */
export function utcToTdb(mjd: number) {
  return mjd + 69.184 / 86400;
}
export function seed(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function interpolate(
  s: number[][],
  t: number,
  out: number[] = [0, 0, 0],
) {
  if (
    s.length < 2 ||
    !Number.isFinite(t) ||
    t < s[0][0] ||
    t > s[s.length - 1][0]
  )
    throw new RangeError(tr("math.range"));
  let lo = 0,
    hi = s.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (s[m][0] > t) hi = m;
    else lo = m;
  }
  const a = s[lo],
    b = s[hi],
    h = b[0] - a[0],
    u = (t - a[0]) / h,
    u2 = u * u,
    u3 = u2 * u;
  for (let k = 0; k < 3; k++)
    out[k] =
      (2 * u3 - 3 * u2 + 1) * a[k + 1] +
      (u3 - 2 * u2 + u) * h * a[k + 4] +
      (-2 * u3 + 3 * u2) * b[k + 1] +
      (u3 - u2) * h * b[k + 4];
  return out;
}
export function date(mjd: number) {
  return new Date((mjd - 40587) * 86400000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}
export function skyDirection(
  raDegrees: number,
  decDegrees: number,
): [number, number, number] {
  const ra = (raDegrees * Math.PI) / 180,
    dec = (decDegrees * Math.PI) / 180,
    e = (23.439291111 * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra),
    y = Math.cos(dec) * Math.sin(ra),
    z = Math.sin(dec);
  return [
    x,
    y * Math.cos(e) + z * Math.sin(e),
    -y * Math.sin(e) + z * Math.cos(e),
  ];
}
