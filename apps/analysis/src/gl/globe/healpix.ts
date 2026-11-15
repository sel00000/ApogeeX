// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// HEALPix NESTED geometry for the SPHEREx all-sky HiPS (pure maths, no DOM, no three.js).
//
// HEALPix cuts the sphere into 12 equal-area base "faces" (diamonds). At order k every face is split
// into 2^k x 2^k cells; in the NESTED scheme a cell index is face * 4^k + (bits of ix and iy
// interleaved). Inside a face we use continuous coordinates fx, fy in [0, 1]: (0,0) is the southern
// corner of the diamond, (1,1) the northern one, (1,0) the eastern and (0,1) the western one.
//
// HiPS tiles are HEALPix cells: tile npix of order k is the cell npix at nside = 2^k, drawn as a
// 512 x 512 image. The PNG orientation (verified on tile 10226 and in Aladin Lite, see
// golden_cube.json geometry.png_orientation): PNG column c runs along fy, PNG row r (from the top)
// runs along fx:  fy_local = (c + 0.5) / 512,  fx_local = (r + 0.5) / 512.
// So the top-left PNG corner is the South vertex, top-right West, bottom-left East, bottom-right North.

export const DEG = Math.PI / 180;
export const TILE_PX = 512;
export const MAX_ORDER = 5;

export const nsideOf = (order: number): number => 1 << order;
export const npixOf = (order: number): number => 12 * (1 << order) * (1 << order);

/** Spread the bits of ix and iy into one NESTED sub-index (ix on even bits, iy on odd bits). */
export function interleave(ix: number, iy: number, bits: number): number {
  let r = 0;
  for (let b = 0; b < bits; b++) {
    r += ((ix >> b) & 1) * 2 ** (2 * b);
    r += ((iy >> b) & 1) * 2 ** (2 * b + 1);
  }
  return r;
}

export function deinterleave(s: number, bits: number): [number, number] {
  let ix = 0;
  let iy = 0;
  for (let b = 0; b < bits; b++) {
    ix |= (Math.floor(s / 2 ** (2 * b)) & 1) << b;
    iy |= (Math.floor(s / 2 ** (2 * b + 1)) & 1) << b;
  }
  return [ix, iy];
}

export interface FacePos {
  face: number;
  /** Continuous face coordinates, 0..1 across the face. */
  fx: number;
  fy: number;
}

/** Sky position (deg) -> base face and continuous face coordinates (standard ang2pix_nest, fractions kept). */
export function skyToFace(raDeg: number, decDeg: number): FacePos {
  const z = Math.sin(decDeg * DEG);
  const za = Math.abs(z);
  const tt = ((((raDeg % 360) + 360) % 360) / 90) % 4; // [0,4)
  let face: number;
  let fx: number;
  let fy: number;
  if (za <= 2 / 3) {
    // Equatorial belt: faces 4..7 straddle the equator, 0..3 above, 8..11 below.
    const t1 = 0.5 + tt;
    const t2 = z * 0.75;
    const fjp = t1 - t2;
    const fjm = t1 + t2;
    const ifp = Math.floor(fjp);
    const ifm = Math.floor(fjm);
    face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? ifp & 3 : (ifm & 3) + 8;
    fx = fjm - ifm;
    fy = 1 - (fjp - ifp);
  } else {
    // Polar caps: the four faces meet at the pole.
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = Math.sqrt(3 * (1 - za));
    const fjp = tp * tmp;
    const fjm = (1 - tp) * tmp;
    if (z >= 0) {
      face = ntt;
      fx = 1 - fjm;
      fy = 1 - fjp;
    } else {
      face = ntt + 8;
      fx = fjp;
      fy = fjm;
    }
  }
  return { face, fx, fy };
}

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

/** Continuous face coordinates -> sky position in degrees (exact HEALPix projection, so evaluating it
 *  along fx = const or fy = const gives the true curved cell boundaries). */
export function faceToSky(face: number, fx: number, fy: number): { ra: number; dec: number } {
  const jr = JRLL[face] - fx - fy; // ring coordinate in units of a face: 0 = north pole, 4 = south pole
  let nr: number;
  let z: number;
  if (jr < 1) {
    nr = jr;
    z = 1 - (nr * nr) / 3;
  } else if (jr > 3) {
    nr = 4 - jr;
    z = (nr * nr) / 3 - 1;
  } else {
    nr = 1;
    z = ((2 - jr) * 2) / 3;
  }
  const phi = nr > 1e-15 ? ((JPLL[face] * nr + fx - fy) / nr) * 45 : 0;
  return {
    ra: ((phi % 360) + 360) % 360,
    dec: Math.asin(Math.max(-1, Math.min(1, z))) / DEG,
  };
}

/** Face and integer cell position of a NESTED index. */
export function nestToFaceXY(order: number, npix: number): { face: number; ix: number; iy: number } {
  const n2 = 4 ** order;
  const face = Math.floor(npix / n2);
  const [ix, iy] = deinterleave(npix - face * n2, order);
  return { face, ix, iy };
}

/** Sky position -> NESTED cell index at `order`. */
export function ang2pixNest(order: number, raDeg: number, decDeg: number): number {
  const ns = nsideOf(order);
  const { face, fx, fy } = skyToFace(raDeg, decDeg);
  const ix = Math.min(ns - 1, Math.max(0, Math.floor(fx * ns)));
  const iy = Math.min(ns - 1, Math.max(0, Math.floor(fy * ns)));
  return face * 4 ** order + interleave(ix, iy, order);
}

/** Centre of a NESTED cell, degrees. */
export function pix2angNest(order: number, npix: number): { ra: number; dec: number } {
  return cellToSky(order, npix, 0.5, 0.5);
}

/** A point inside a cell given local face fractions (u along fx, v along fy, both 0..1). */
export function cellToSky(order: number, npix: number, ufx: number, vfy: number): { ra: number; dec: number } {
  const ns = nsideOf(order);
  const { face, ix, iy } = nestToFaceXY(order, npix);
  return faceToSky(face, (ix + ufx) / ns, (iy + vfy) / ns);
}

/** The four cell vertices in healpy order: North, West, South, East. */
export function pixCorners(order: number, npix: number): { ra: number; dec: number }[] {
  return [cellToSky(order, npix, 1, 1), cellToSky(order, npix, 0, 1), cellToSky(order, npix, 0, 0), cellToSky(order, npix, 1, 0)];
}

/** HiPS tile pixel (0-based FITS x = PNG column, FITS y = 511 - PNG row) -> sky. Same as the reference tileToRadec. */
export function tilePixelToSky(order: number, npix: number, x: number, y: number): { ra: number; dec: number } {
  return cellToSky(order, npix, (TILE_PX - 0.5 - y) / TILE_PX, (x + 0.5) / TILE_PX);
}

/** Sky -> HiPS tile index at `order` and fractional FITS pixel (x, y) inside that 512 px tile. */
export function skyToTilePixel(order: number, raDeg: number, decDeg: number): { npix: number; x: number; y: number } {
  const ns = nsideOf(order);
  const { face, fx, fy } = skyToFace(raDeg, decDeg);
  const ix = Math.min(ns - 1, Math.max(0, Math.floor(fx * ns)));
  const iy = Math.min(ns - 1, Math.max(0, Math.floor(fy * ns)));
  const npix = face * 4 ** order + interleave(ix, iy, order);
  const lfx = fx * ns - ix;
  const lfy = fy * ns - iy;
  return { npix, x: lfy * TILE_PX - 0.5, y: TILE_PX - 0.5 - lfx * TILE_PX };
}

/** Standard HiPS directory: Dir{floor(npix / 10000) * 10000}. */
export const hipsDir = (npix: number): number => Math.floor(npix / 10000) * 10000;

/** Unit vector of a sky position in the right-handed globe frame used by SkyGlobe:
 *  v = (cos dec cos ra, sin dec, -cos dec sin ra). North pole = +y. Seen from inside, east is left. */
export function skyToVec(raDeg: number, decDeg: number): [number, number, number] {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  const c = Math.cos(d);
  return [c * Math.cos(a), Math.sin(d), -c * Math.sin(a)];
}

export function vecToSky(v: readonly [number, number, number] | number[]): { ra: number; dec: number } {
  const [x, y, z] = v;
  const r = Math.hypot(x, y, z) || 1;
  const dec = Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG;
  let ra = Math.atan2(-z, x) / DEG;
  if (ra < 0) ra += 360;
  if (ra >= 360) ra -= 360;
  return { ra, dec };
}

/** Great-circle separation in degrees. */
export function sepDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = skyToVec(ra1, dec1);
  const b = skyToVec(ra2, dec2);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  return Math.atan2(Math.hypot(cx, cy, cz), dot) / DEG;
}

/** Angular radius (deg) of a cell around its centre: max distance to vertices and edge midpoints,
 *  with a small margin because the curved edges bulge between sample points. */
export function cellRadiusDeg(order: number, npix: number): number {
  const c = pix2angNest(order, npix);
  let r = 0;
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
    const p = cellToSky(order, npix, u, v);
    r = Math.max(r, sepDeg(c.ra, c.dec, p.ra, p.dec));
  }
  return r * 1.08;
}

/** All NESTED cells of `order` that may intersect a cone (hierarchical descent from the 12 faces).
 *  The test is conservative: a cell is kept when centre distance < cone radius + cell radius. */
export function queryCone(order: number, raDeg: number, decDeg: number, radiusDeg: number): number[] {
  const out: number[] = [];
  const visit = (k: number, n: number) => {
    const c = pix2angNest(k, n);
    if (sepDeg(c.ra, c.dec, raDeg, decDeg) > radiusDeg + cellRadiusDeg(k, n)) return;
    if (k === order) {
      out.push(n);
      return;
    }
    for (let s = 0; s < 4; s++) visit(k + 1, n * 4 + s);
  };
  for (let f = 0; f < 12; f++) visit(0, f);
  return out;
}

/** The ancestor of a cell at a lower order (NESTED: drop two bits per order). */
export const parentAt = (order: number, npix: number, ancestorOrder: number): number =>
  Math.floor(npix / 4 ** (order - ancestorOrder));
