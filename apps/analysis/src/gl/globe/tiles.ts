// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// HiPS PNG tile loading and curved tile meshes for SkyGlobe.
//
// Tiles come from the IRSA SPHEREx all-sky cube (CORS: *). One PNG per HEALPix cell, order and cube
// frame; frame 0 has no suffix, frames 1..101 add "_{frame}". The PNGs are 8-bit palette images
// (index 0 = transparent = no data), already stretched with an asinh curve of 0..40 MJy/sr, so they
// are a quick-look picture, not science data.

import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, LinearFilter, SRGBColorSpace, Texture } from 'three';
import { cellToSky, hipsDir, skyToVec } from './healpix';

export const SPHEREX_HIPS_URL = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube';

/** Cube frames with no tiles in DR1 (HTTP 404): channels 51 and 52 (2.40-2.45 um). */
export const BLANK_FRAMES: readonly number[] = [50, 51];

export function tileUrl(base: string, order: number, npix: number, frame: number): string {
  return `${base}/Norder${order}/Dir${hipsDir(npix)}/Npix${npix}${frame > 0 ? `_${frame}` : ''}.png`;
}

export const tileKey = (order: number, npix: number, frame: number): string => `${frame}/${order}/${npix}`;

/**
 * Curved patch for one HEALPix cell: a segs x segs grid whose vertices are evaluated with the exact
 * HEALPix projection, so tile edges follow the true cell boundaries and neighbours meet exactly.
 * UVs follow the HiPS PNG orientation for a texture uploaded with flipY = false (row 0 = top):
 *   u = fy_local (PNG column direction), v = fx_local (PNG row direction, from the top).
 */
export function buildTileGeometry(order: number, npix: number, segs: number, radius = 1): BufferGeometry {
  const n = segs + 1;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ufx = i / segs;
      const vfy = j / segs;
      const s = cellToSky(order, npix, ufx, vfy);
      const v = skyToVec(s.ra, s.dec);
      const k = i * n + j;
      pos[k * 3] = v[0] * radius;
      pos[k * 3 + 1] = v[1] * radius;
      pos[k * 3 + 2] = v[2] * radius;
      uv[k * 2] = vfy;
      uv[k * 2 + 1] = ufx;
    }
  }
  const idx = new Uint16Array(segs * segs * 6);
  let q = 0;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * n + j;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx[q++] = a;
      idx[q++] = c;
      idx[q++] = b;
      idx[q++] = b;
      idx[q++] = c;
      idx[q++] = d;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** Subdivision per order: low orders cover tens of degrees and need more segments to look round. */
export const segmentsFor = (order: number): number => (order === 0 ? 16 : order === 1 ? 12 : order === 2 ? 8 : 4);

type Entry =
  | { state: 'loading'; ctrl: AbortController }
  | { state: 'loaded'; tex: Texture; lastUse: number }
  | { state: 'failed'; status: number; at: number };

interface Want {
  order: number;
  npix: number;
  frame: number;
  priority: number;
}

export interface TileCacheOptions {
  baseUrl?: string;
  /** Textures kept in GPU memory (each 512 x 512 RGBA = 1 MB). */
  capacity?: number;
  maxParallel?: number;
  timeoutMs?: number;
  onChange?: () => void;
}

/**
 * Texture cache with a priority queue. The owner calls want() for every tile it would like, then
 * pump(); entries that were not wanted in the last round are dropped from the queue (not aborted
 * once in flight: a nearly finished tile is still useful). Least recently used textures are evicted
 * above `capacity`, never the ones marked with use() in the current round.
 */
export class TileCache {
  readonly baseUrl: string;
  private readonly capacity: number;
  private readonly maxParallel: number;
  private readonly timeoutMs: number;
  private readonly onChange: () => void;
  private entries = new Map<string, Entry>();
  private queue: Want[] = [];
  private round = new Map<string, Want>();
  private inUse = new Set<string>();
  private active = 0;
  private clock = 0;
  private disposed = false;
  /** Counters for the UI and the headless checks. */
  stats = { loaded: 0, failed: 0, lastError: '' };

  constructor(opts: TileCacheOptions = {}) {
    this.baseUrl = opts.baseUrl ?? SPHEREX_HIPS_URL;
    this.capacity = opts.capacity ?? 150;
    this.maxParallel = Math.min(4, opts.maxParallel ?? 4);
    this.timeoutMs = opts.timeoutMs ?? 20000;
    this.onChange = opts.onChange ?? (() => {});
  }

  /** Loaded texture or undefined; marks it as used in this round. */
  get(order: number, npix: number, frame: number): Texture | undefined {
    const k = tileKey(order, npix, frame);
    const e = this.entries.get(k);
    if (e?.state !== 'loaded') return undefined;
    e.lastUse = ++this.clock;
    this.inUse.add(k);
    return e.tex;
  }

  status(order: number, npix: number, frame: number): 'none' | 'loading' | 'loaded' | 'failed' {
    return this.entries.get(tileKey(order, npix, frame))?.state ?? 'none';
  }

  beginRound(): void {
    this.round.clear();
    this.inUse.clear();
  }

  want(order: number, npix: number, frame: number, priority: number): void {
    const k = tileKey(order, npix, frame);
    const e = this.entries.get(k);
    if (e?.state === 'loaded' || e?.state === 'loading') return;
    // Missing tiles (404) are permanent; network errors are retried after 15 s.
    if (e?.state === 'failed' && (e.status === 404 || performance.now() - e.at < 15000)) return;
    const prev = this.round.get(k);
    if (!prev || prev.priority > priority) this.round.set(k, { order, npix, frame, priority });
  }

  /** Replace the queue with this round's wishes (lowest priority value first) and start downloads. */
  pump(): void {
    this.queue = [...this.round.values()].sort((a, b) => a.priority - b.priority);
    this.next();
    this.evict();
  }

  private next(): void {
    while (!this.disposed && this.active < this.maxParallel && this.queue.length) {
      const w = this.queue.shift()!;
      const k = tileKey(w.order, w.npix, w.frame);
      if (this.entries.has(k) && this.entries.get(k)!.state !== 'failed') continue;
      void this.load(k, w);
    }
  }

  private async load(k: string, w: Want): Promise<void> {
    const ctrl = new AbortController();
    this.entries.set(k, { state: 'loading', ctrl });
    this.active++;
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), this.timeoutMs);
    const url = tileUrl(this.baseUrl, w.order, w.npix, w.frame);
    try {
      const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) {
        const err = new Error(`HiPS tile ${url} answered HTTP ${res.status}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      if (this.disposed) {
        bmp.close();
        return;
      }
      const tex = new Texture(bmp);
      tex.flipY = false; // ignored for ImageBitmap anyway; the UVs assume row 0 = top
      tex.colorSpace = SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.wrapS = ClampToEdgeWrapping;
      tex.wrapT = ClampToEdgeWrapping;
      tex.needsUpdate = true;
      this.entries.set(k, { state: 'loaded', tex, lastUse: ++this.clock });
      this.stats.loaded++;
    } catch (e) {
      if (this.disposed) return;
      const status = (e as { status?: number }).status ?? 0;
      const msg = ctrl.signal.aborted ? `HiPS tile ${url} timed out after ${this.timeoutMs / 1000} s` : e instanceof Error ? e.message : String(e);
      this.entries.set(k, { state: 'failed', status, at: performance.now() });
      this.stats.failed++;
      this.stats.lastError = status === 0 && !ctrl.signal.aborted ? `Could not reach the SPHEREx sky tiles (${msg})` : msg;
    } finally {
      clearTimeout(timer);
      this.active--;
      if (!this.disposed) {
        this.onChange();
        this.next();
      }
    }
  }

  private evict(): void {
    const loaded: [string, number][] = [];
    for (const [k, e] of this.entries) if (e.state === 'loaded') loaded.push([k, e.lastUse]);
    if (loaded.length <= this.capacity) return;
    loaded.sort((a, b) => a[1] - b[1]);
    let excess = loaded.length - this.capacity;
    for (const [k] of loaded) {
      if (excess <= 0) break;
      if (this.inUse.has(k)) continue;
      const e = this.entries.get(k);
      if (e?.state === 'loaded') {
        e.tex.dispose();
        (e.tex.image as ImageBitmap | undefined)?.close?.();
      }
      this.entries.delete(k);
      excess--;
    }
  }

  /** Number of loaded textures (for tests and the status line). */
  get size(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.state === 'loaded') n++;
    return n;
  }

  get pending(): number {
    return this.active + this.queue.length;
  }

  dispose(): void {
    this.disposed = true;
    for (const e of this.entries.values()) {
      if (e.state === 'loading') e.ctrl.abort(new Error('disposed'));
      if (e.state === 'loaded') {
        e.tex.dispose();
        (e.tex.image as ImageBitmap | undefined)?.close?.();
      }
    }
    this.entries.clear();
    this.queue = [];
  }
}
