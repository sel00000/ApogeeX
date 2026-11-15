// Raw SPHEREx visit frames in the browser (float32, MJy/sr, north up, east left).
// Contrast, season stacks and A−B differences are computed here from the measured values;
// nothing is added that is not in the data.
import type { TargetMeta } from '../types'
import { frameUrl } from './data'

export type Frame = Float32Array // n×n, row 0 = north (top), NaN = no data

async function fromPng(url: string, n: number): Promise<Frame> {
  // fallback for data without .f32 files (e.g. ?mock=1): grey level 0-255, alpha 0 = NaN
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0, n, n)
  const d = g.getImageData(0, 0, n, n).data
  const out = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) out[i] = d[i * 4 + 3] === 0 ? NaN : d[i * 4]
  return out
}

/** All visit frames; with `det` > 0 only that detector array (visits without it → all NaN);
 *  `wide` = the 0.3° context frames when the target has them. */
export async function loadFrames(meta: TargetMeta, det = 0, wide = false, signal?: AbortSignal): Promise<Frame[]> {
  const W = wide ? meta.wide : undefined
  const n = W ? W.size_px[0] : meta.wcs.size_px[0]
  const out: Frame[] = new Array(meta.visits.length)
  let next = 0
  const load = async (i: number): Promise<Frame> => {
      signal?.throwIfAborted()
      const v = meta.visits[i]
      const src = W ? W.visits[i] : v
      if (W && !src) return new Float32Array(n * n).fill(NaN)
      const file = det ? src!.f32_det?.[String(det)] : src!.f32
      if (det && !file) return new Float32Array(n * n).fill(NaN)
      if (W && !file) throw new Error('넓은 영상 경로가 없습니다. 작은 영상을 확대해 대체하지 않습니다.')
      if (!file) return fromPng(frameUrl(meta.id, v.png, meta.base), n)
      const res = await fetch(frameUrl(meta.id, file, meta.base), { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${file}`)
      const buf = await res.arrayBuffer()
      if (buf.byteLength !== n * n * 4) throw new Error(`${file}: 크기가 맞지 않음`)
      return new Float32Array(buf)
  }
  // Bound local frame downloads, and cancel obsolete work on target/detector changes.
  await Promise.all(Array.from({ length: Math.min(3, meta.visits.length) }, async () => {
    while (next < meta.visits.length) {
      const i = next++
      out[i] = await load(i)
    }
  }))
  return out
}

/** Observing seasons: visits less than `gapDays` apart. */
export function seasons(meta: TargetMeta, gapDays = 30): number[][] {
  const out: number[][] = []
  meta.visits.forEach((v, i) => {
    const g = out[out.length - 1]
    if (g && v.mjd - meta.visits[g[g.length - 1]].mjd < gapDays) g.push(i)
    else out.push([i])
  })
  return out
}

/** Pixel-wise mean of several frames, ignoring NaN. */
export function stack(frames: Frame[], idx: number[]): Frame {
  const n = frames[idx[0]].length
  const sum = new Float32Array(n)
  const cnt = new Uint16Array(n)
  for (const i of idx) {
    const f = frames[i]
    for (let p = 0; p < n; p++) {
      const v = f[p]
      if (v === v) {
        sum[p] += v
        cnt[p]++
      }
    }
  }
  for (let p = 0; p < n; p++) sum[p] = cnt[p] ? sum[p] / cnt[p] : NaN
  return sum
}

export function subtract(a: Frame, b: Frame): Frame {
  const out = new Float32Array(a.length)
  for (let p = 0; p < a.length; p++) out[p] = a[p] - b[p]
  return out
}

export interface Window { x0: number; y0: number; w: number }

function values(frames: Frame[], n: number, win: Window, abs = false): number[] {
  const out: number[] = []
  const x1 = Math.min(n, Math.ceil(win.x0 + win.w))
  const y1 = Math.min(n, Math.ceil(win.y0 + win.w))
  for (const f of frames)
    for (let y = Math.max(0, Math.floor(win.y0)); y < y1; y++)
      for (let x = Math.max(0, Math.floor(win.x0)); x < x1; x++) {
        const v = f[y * n + x]
        if (v === v) out.push(abs ? Math.abs(v) : v)
      }
  return out.sort((p, q) => p - q)
}
const pct = (s: number[], q: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : 0)

export interface Stretch { lo: number; hi: number; soft: number }

/** asinh stretch from the pixels inside `win` of all given frames (one scale for all of them,
 *  so brightness differences between frames stay real). */
export function autoStretch(frames: Frame[], n: number, win: Window, floorSigma = -0.5): Stretch {
  const v = values(frames, n, win)
  const med = pct(v, 0.5)
  const mad = pct(v.map((x) => Math.abs(x - med)).sort((p, q) => p - q), 0.5) * 1.4826 || 1e-6
  // black level at median + floorSigma·σ (display only: pixel values are never changed).
  // −0.5 shows the noisy sky as grey; +1 puts most sky noise in black so sources stand out.
  return { lo: med + floorSigma * mad, hi: Math.max(pct(v, 0.998), med + 12 * mad), soft: 3 * mad }
}

export interface DiffScale { sigma: number; limit: number }

/** Robust display scale only; it is not propagated measurement uncertainty. */
export function diffScale(diff: Frame, n: number, win: Window): DiffScale {
  const a = values([diff], n, win, true)
  const sigma = pct(a, 0.5) * 1.4826 || 1e-6
  return { sigma, limit: Math.max(pct(a, 0.995), 5 * sigma) }
}

/** Grey image; NaN → transparent (the hatched background shows "no data"). */
export function toImageData(f: Frame, n: number, s: Stretch): ImageData {
  const img = new ImageData(n, n)
  const norm = Math.asinh((s.hi - s.lo) / s.soft)
  for (let p = 0; p < n * n; p++) {
    const v = f[p]
    if (v !== v) continue
    const g = Math.max(0, Math.min(1, Math.asinh((v - s.lo) / s.soft) / norm)) * 255
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = g
    img.data[p * 4 + 3] = 255
  }
  return img
}

/** Diverging colours: A brighter → orange, B brighter → blue. A robust display floor
 * suppresses low contrast; the colours do not establish statistical significance. */
export function diffImageData(d: Frame, n: number, { sigma, limit }: DiffScale): ImageData {
  const img = new ImageData(n, n)
  const floor = 2 * sigma
  for (let p = 0; p < n * n; p++) {
    const v = d[p]
    if (v !== v) continue
    const m = Math.max(0, Math.min(1, (Math.abs(v) - floor) / (limit - floor)))
    const t = v > 0 ? m : -m
    const a = Math.sqrt(m) * 255
    if (t > 0) {
      img.data[p * 4] = a
      img.data[p * 4 + 1] = a * 0.45
      img.data[p * 4 + 2] = a * 0.15
    } else {
      img.data[p * 4] = a * 0.2
      img.data[p * 4 + 1] = a * 0.55
      img.data[p * 4 + 2] = a
    }
    img.data[p * 4 + 3] = 255
  }
  return img
}
