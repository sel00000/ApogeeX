// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// SkyGlobe: an all-sky navigator. The camera sits at the centre of a unit celestial sphere and looks
// outward, so the sky appears as it does from Earth: north up, east to the LEFT. The sphere is
// painted with SPHEREx all-sky HiPS tiles (HEALPix cells drawn as curved patches) for one of the 102
// spectral channels of the DR1 cube. Coarse tiles are drawn first so the sky is never blank, then
// tiles at the resolution the field of view needs (HiPS order 0..5) are drawn on top.
//
// Two camera modes. Ground OFF (the default here): north up, the whole sphere. Ground ON: the camera's
// up is the ZENITH of the observing site (Seoul by default) at a clock time, so the horizon is level; a
// dark ground with a skyline hides the sky below the horizon (globe/ground.ts) and the sky turns behind
// the view as the clock advances (the view keeps its azimuth and altitude). The sky objects stay in the
// equatorial frame in both modes; only "which way is up" for the camera changes.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { SkyPos } from './skyTypes';
import { parentAt, pix2angNest, queryCone, sepDeg, skyToVec } from './globe/healpix';
import { BLANK_FRAMES, buildTileGeometry, segmentsFor, TileCache } from './globe/tiles';
import { cameraBasis, chooseOrder, ndcToSky, skyToNdc, slerpSky, solveGrab, viewRadiusDeg, type CameraBasis } from './globe/view';
import { createGround, type GroundMeshes } from './globe/ground';
import { constellationSegments, labelText, labelVisible, type Box, type Constellation } from './globe/constellations';
import {
  SEOUL,
  clampViewToHorizon,
  groundGrabAccepted,
  isAboveSkyline,
  groundCameraBasis,
  horizontalToSky,
  horizontalToVec,
  isAboveHorizon,
  observerFrame,
  skyToHorizontal,
  skylineHeightDeg,
  solveGroundGrab,
  vecToHorizontal,
  viewAtAltitude,
  type ObserverFrame,
  type Site,
} from './globe/horizon';

export interface GlobeMarker {
  id: string;
  ra: number;
  dec: number;
  label: string;
  color?: string;
}

export interface GlobePick {
  ra: number;
  dec: number;
  markerId?: string;
}

export interface GlobeView {
  ra: number;
  dec: number;
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Ground view only: azimuth (deg from north through east) and altitude of the view centre. */
  azDeg?: number;
  altDeg?: number;
}

/** Ground view state, emitted as the 'ground' event when it is switched or its clock moves. */
export interface GlobeGround {
  on: boolean;
  /** Clock time (epoch ms) of the sky that is on screen. */
  epochMs: number;
}

export interface SkyGlobeOptions {
  /** HiPS base URL (defaults to the IRSA SPHEREx all-sky cube). */
  baseUrl?: string;
  /** Initial view. */
  view?: Partial<GlobeView>;
  /** Initial cube channel 1..102. */
  channel?: number;
  /** Start with the ground view (level horizon, ground, skyline). Default false: the whole sphere, north up. */
  ground?: boolean;
  /** Clock for the ground view (epoch ms). Default Date.now. Tests pass a fixed one. */
  now?: () => number;
  /** Observing site of the ground view. Default Seoul. */
  site?: Site;
}

export interface SkyGlobeStatus {
  channel: number;
  /** Cube frame actually on screen (channel - 1, or the previous one for the blank channels). */
  frame: number;
  order: number;
  tilesLoaded: number;
  tilesFailed: number;
  tilesPending: number;
  visibleTiles: number;
  imageryAvailable: boolean;
  note: string;
}

type Listener = (payload: GlobePick | GlobeView | GlobeGround) => void;

export const FOV_MIN = 1.5;
export const FOV_MAX = 100;
const ANIM_MS = 600;
const PICK_RADIUS_PX = 12;
const MAX_VISIBLE_TILES = 90;
/** The ground view re-derives its sky from the clock this often (ms) while the map is visible. */
export const GROUND_TICK_MS = 15000;
const GROUND_COLORS = { rim: '#0c1322', mid: '#080d18', deep: '#04060c', glow: '#6479b4' };
const DEFAULT_COMPASS = ['N', 'E', 'S', 'W'];

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  try {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

const clampFov = (f: number) => Math.min(FOV_MAX, Math.max(FOV_MIN, f));
const wrapRa = (ra: number) => ((ra % 360) + 360) % 360;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** RA label in hours and minutes (astronomers' habit: 15 deg = 1 h). */
function raLabel(raDeg: number): string {
  const totalMin = Math.round((wrapRa(raDeg) / 15) * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${pad2(m)}m`;
}

function decLabel(decDeg: number): string {
  const r = Math.round(decDeg * 10) / 10;
  const s = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${s}${Math.abs(r)}°`;
}

/** Graticule spacing for a field of view: RA steps of 1 h at wide views down to 2 min when zoomed. */
function gridSpacing(fov: number): { ra: number; dec: number } {
  if (fov >= 40) return { ra: 15, dec: 10 };
  if (fov >= 15) return { ra: 5, dec: 5 };
  if (fov >= 6) return { ra: 2.5, dec: 2 };
  if (fov >= 2.5) return { ra: 1.25, dec: 1 };
  return { ra: 0.5, dec: 0.5 };
}

export class SkyGlobe {
  private readonly container: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly noteEl: HTMLDivElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly tileGroup = new Group();
  private readonly cache: TileCache;
  private readonly tileMeshes = new Map<string, Mesh<BufferGeometry, MeshBasicMaterial>>();
  private readonly geoCache = new Map<string, BufferGeometry>();
  private graticule: LineSegments | null = null;
  private graticuleKey = '';
  private graticuleLines: { kind: 'ra' | 'dec'; value: number; pts: [number, number][] }[] = [];
  private readonly gridLabels: HTMLSpanElement[] = [];
  private markers: GlobeMarker[] = [];
  private markerEls = new Map<string, HTMLDivElement>();
  private listeners: { pick: Set<Listener>; view: Set<Listener>; ground: Set<Listener> } = { pick: new Set(), view: new Set(), ground: new Set() };

  // Ground view state.
  private ground = false;
  private frameObs: ObserverFrame | null = null;
  private groundMeshes: GroundMeshes | null = null;
  private groundTimer: ReturnType<typeof setTimeout> | null = null;
  private active = true;
  private readonly nowFn: () => number;
  private readonly site: Site;
  private readonly compassEls: HTMLDivElement[] = [];
  private compassNames = DEFAULT_COMPASS;
  private ariaAll = '';
  private ariaGround = '';

  private center: SkyPos = { ra: 83.8, dec: -1.2 };
  private fov = 60;
  private channel = 1;
  private frame = 0;
  private prevFrame = -1;
  private order = 0;
  private visibleCount = 0;
  private width = 1;
  private height = 1;

  private raf = 0;
  private dirty = true;
  private disposed = false;
  private anim: { from: SkyPos; to: SkyPos; fov0: number; fov1: number; t0: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { anchor: SkyPos; downX: number; downY: number; t0: number; moved: boolean } | null = null;
  private pinch: { d0: number; fov0: number; anchor: SkyPos } | null = null;
  private lastViewEmit = 0;
  private lastEmitted = '';
  private viewTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly ro: ResizeObserver | null = null;
  private readonly cleanups: (() => void)[] = [];
  private compassPx: { x: number; y: number }[] = [];
  // Constellation layer (a guide drawing on top of the data; off = the map is drawn exactly as without it).
  private constList: Constellation[] | null = null;
  private constLines: LineSegments | null = null;
  private constOn = false;
  private constLang: 'ko' | 'en' = 'ko';
  private readonly constLabelEls: HTMLSpanElement[] = [];
  private readonly constLabelW = new Map<HTMLSpanElement, { text: string; w: number; h: number }>();
  private avoidEls: HTMLElement[] = [];
  private readonly colors: { grid: string; label: string; marker: string; bg: string; accent: string; constLine: string; constLabel: string };

  constructor(container: HTMLElement, options: SkyGlobeOptions = {}) {
    this.container = container;
    this.colors = {
      bg: cssVar(container, '--bg', '#080c16'),
      grid: cssVar(container, '--accent-wave', '#5ad1e6'),
      label: cssVar(container, '--muted', '#93a0b8'),
      marker: cssVar(container, '--accent-time', '#ffb454'),
      accent: cssVar(container, '--accent', '#7aa2ff'),
      constLine: cssVar(container, '--text', '#dfe6f3'),
      constLabel: cssVar(container, '--dim', '#8592ab'),
    };
    this.nowFn = options.now ?? Date.now;
    this.site = options.site ?? SEOUL;
    if (options.view?.ra !== undefined) this.center.ra = wrapRa(options.view.ra);
    if (options.view?.dec !== undefined) this.center.dec = Math.max(-90, Math.min(90, options.view.dec));
    if (options.view?.fovDeg !== undefined) this.fov = clampFov(options.view.fovDeg);
    if (options.channel !== undefined) {
      this.channel = Math.min(102, Math.max(1, Math.round(options.channel)));
      this.frame = BLANK_FRAMES.includes(this.channel - 1) ? 0 : this.channel - 1;
    }

    this.root = document.createElement('div');
    this.root.className = 'sky-globe';
    Object.assign(this.root.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: this.colors.bg,
      touchAction: 'none',
      userSelect: 'none',
      outline: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'application');
    this.ariaAll = 'All-sky map. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.';
    this.ariaGround = 'Sky over the observing site with the ground. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.';
    this.root.setAttribute('aria-label', this.ariaAll);

    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch (e) {
      throw new Error(`SkyGlobe: WebGL is not available in this browser (${e instanceof Error ? e.message : String(e)})`);
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(new Color(this.colors.bg), 1);
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', cursor: 'grab' });
    this.root.appendChild(canvas);

    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', font: `11px ${cssVar(container, '--font', 'system-ui, sans-serif')}` });
    this.root.appendChild(this.overlay);

    this.noteEl = document.createElement('div');
    Object.assign(this.noteEl.style, {
      position: 'absolute',
      left: '10px',
      bottom: '10px',
      padding: '4px 8px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.6)',
      color: cssVar(container, '--warn', '#f2c14e'),
      font: `12px ${cssVar(container, '--font', 'system-ui, sans-serif')}`,
      pointerEvents: 'none',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    this.noteEl.setAttribute('role', 'status');
    this.root.appendChild(this.noteEl);
    container.appendChild(this.root);

    this.camera = new PerspectiveCamera(this.fov, 1, 0.01, 10);
    this.scene.add(this.tileGroup);
    this.cache = new TileCache({ baseUrl: options.baseUrl, onChange: () => this.requestRender() });

    this.bindEvents(canvas);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
    }
    this.resize();
    if (options.ground) this.setGround(true);
  }

  // ------------------------------------------------------------------ public API

  /** Switch the ground view on or off. On: the view keeps its place when it is above the horizon, else it is
   *  raised to 20 degrees altitude at the same azimuth. Off: the north-up whole-sky map, same view centre.
   *  A running smooth move is finished first, so quick toggling never leaves a half state. */
  setGround(on: boolean): void {
    if (this.disposed || on === this.ground) return;
    if (this.anim) {
      this.center = { ...this.anim.to };
      this.fov = this.anim.fov1;
      this.anim = null;
    }
    this.drag = null;
    this.pinch = null;
    this.ground = on;
    if (on) {
      this.frameObs = this.makeFrame();
      const f = this.frameObs;
      if (!isAboveHorizon(f, this.center.ra, this.center.dec)) this.center = viewAtAltitude(f, this.center, 20);
      this.clampGround();
      if (!this.groundMeshes) {
        this.groundMeshes = createGround(GROUND_COLORS);
        this.scene.add(this.groundMeshes.group);
      }
      this.groundMeshes.setFrame(f);
      this.scheduleGroundTick();
    } else {
      this.frameObs = null;
      if (this.groundMeshes) this.groundMeshes.group.visible = false;
      this.stopGroundTick();
      for (const el of this.compassEls) el.style.display = 'none';
    }
    this.root.setAttribute('aria-label', on ? this.ariaGround : this.ariaAll);
    this.requestRender();
    this.emit('ground', this.groundState());
  }

  getGround(): boolean {
    return this.ground;
  }

  /** Clock time of the sky on screen (epoch ms) and whether the ground is on. */
  getGroundState(): GlobeGround {
    return this.groundState();
  }

  /** The observer frame of the ground view (null when the ground is off). */
  getObserver(): ObserverFrame | null {
    return this.frameObs;
  }

  /** Azimuth/altitude (deg) of a sky position for the ground view's clock; null when the ground is off. */
  horizontalOf(ra: number, dec: number): { azDeg: number; altDeg: number } | null {
    return this.frameObs ? skyToHorizontal(this.frameObs, ra, dec) : null;
  }

  /** Screen position (CSS px inside the map) of a sky position, or null when it is behind the camera. */
  project(ra: number, dec: number): { x: number; y: number } | null {
    const n = skyToNdc(this.basis(), ra, dec, this.fov, this.aspect());
    return n ? { x: ((n.x + 1) / 2) * this.width, y: ((1 - n.y) / 2) * this.height } : null;
  }

  /** Re-derive the sky from the clock now: the view keeps its azimuth and altitude, the sky turns behind it.
   *  Called by the timer (every GROUND_TICK_MS while visible); public so tests can move a fixed clock. */
  refreshGround(): void {
    if (this.disposed || !this.ground || !this.frameObs) return;
    if (this.drag || this.pinch) return; // retried by the next tick; the grabbed point must not slide
    const old = this.frameObs;
    const nf = this.makeFrame();
    const rebase = (p: SkyPos): SkyPos => {
      const h = skyToHorizontal(old, p.ra, p.dec);
      return horizontalToSky(nf, h.azDeg, h.altDeg);
    };
    this.center = rebase(this.center);
    if (this.anim) this.anim = { ...this.anim, from: rebase(this.anim.from), to: rebase(this.anim.to) };
    this.frameObs = nf;
    this.groundMeshes?.setFrame(nf);
    this.requestRender();
    this.emit('ground', this.groundState());
  }

  /** The map is on screen (true) or hidden (false); the ground clock only runs while it is on screen. */
  setActive(active: boolean): void {
    if (this.disposed || active === this.active) return;
    this.active = active;
    if (!active) this.stopGroundTick();
    else if (this.ground) {
      this.refreshGround();
      this.scheduleGroundTick();
    }
  }

  /** Words for the compass letters (N, E, S, W) and the map's accessible name in the ground view. */
  setGroundLabels(labels: { compass?: string[]; ariaLabel?: string; ariaAllLabel?: string }): void {
    if (labels.compass && labels.compass.length === 4) this.compassNames = labels.compass.slice();
    if (labels.ariaLabel) this.ariaGround = labels.ariaLabel;
    if (labels.ariaAllLabel) this.ariaAll = labels.ariaAllLabel; // (added here) the whole-sky name in the page's language
    this.root.setAttribute('aria-label', this.ground ? this.ariaGround : this.ariaAll);
    this.compassEls.forEach((el, i) => (el.textContent = this.compassNames[i]));
    this.requestRender();
  }

  /** Show cube channel 1..102 (cube frame z = channel - 1). The tiles on screen stay until the new
   *  channel's tiles arrive. Channels 51 and 52 have no all-sky image in DR1. */
  setChannel(cubeChannel: number): void {
    const ch = Math.min(102, Math.max(1, Math.round(cubeChannel)));
    if (!Number.isFinite(ch)) return;
    this.channel = ch;
    const f = ch - 1;
    if (!BLANK_FRAMES.includes(f) && f !== this.frame) {
      this.prevFrame = this.frame;
      this.frame = f;
    }
    this.requestRender();
  }

  /** Centre the view on a sky position, optionally with a new field of view (smoothly, about 600 ms). */
  lookAt(pos: SkyPos, fovDeg?: number): void {
    let to = { ra: wrapRa(pos.ra), dec: Math.max(-90, Math.min(90, pos.dec)) };
    const fov1 = clampFov(fovDeg ?? this.fov);
    // Ground view: a target below the horizon is raised to 20 degrees altitude (same azimuth), then kept inside the allowed altitudes.
    if (this.ground && this.frameObs) {
      // Same as switching the ground on: a place below the horizon is shown from 20 degrees altitude.
      if (!isAboveHorizon(this.frameObs, to.ra, to.dec)) to = viewAtAltitude(this.frameObs, to, 20);
      to = clampViewToHorizon(this.frameObs, to, fov1);
    }
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.anim = null;
      this.center = to;
      this.fov = fov1;
      this.clampGround();
    } else {
      this.anim = { from: { ...this.center }, to, fov0: this.fov, fov1, t0: performance.now() };
    }
    this.requestRender();
  }

  setMarkers(markers: GlobeMarker[]): void {
    this.markers = markers.map((m) => ({ ...m, ra: wrapRa(m.ra) }));
    for (const el of this.markerEls.values()) el.remove();
    this.markerEls.clear();
    for (const m of this.markers) {
      const el = document.createElement('div');
      const color = m.color ?? this.colors.marker;
      Object.assign(el.style, { position: 'absolute', left: '0', top: '0', display: 'none', pointerEvents: 'none', willChange: 'transform' });
      const ring = document.createElement('div');
      Object.assign(ring.style, {
        position: 'absolute',
        left: '-9px',
        top: '-9px',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.7)',
        boxSizing: 'border-box',
      } satisfies Partial<CSSStyleDeclaration>);
      const label = document.createElement('div');
      label.textContent = m.label;
      Object.assign(label.style, {
        position: 'absolute',
        left: '12px',
        top: '-8px',
        whiteSpace: 'nowrap',
        color: '#fff',
        background: 'rgba(0,0,0,0.55)',
        borderLeft: `2px solid ${color}`,
        padding: '1px 5px',
        borderRadius: '3px',
        fontSize: '12px',
        lineHeight: '14px',
      } satisfies Partial<CSSStyleDeclaration>);
      el.append(ring, label);
      this.overlay.appendChild(el);
      this.markerEls.set(m.id, el);
    }
    this.requestRender();
  }

  on(event: 'pick', cb: (payload: GlobePick) => void): () => void;
  on(event: 'view', cb: (payload: GlobeView) => void): () => void;
  on(event: 'ground', cb: (payload: GlobeGround) => void): () => void;
  on(event: 'pick' | 'view' | 'ground', cb: ((payload: GlobePick) => void) | ((payload: GlobeView) => void) | ((payload: GlobeGround) => void)): () => void {
    const set = this.listeners[event];
    if (!set) throw new Error(`SkyGlobe.on: unknown event "${String(event)}" (use 'pick', 'view' or 'ground')`);
    set.add(cb as Listener);
    return () => set.delete(cb as Listener);
  }

  /** Current view (vertical field of view in degrees). */
  /** Constellation figures to draw (null removes them). Built once; switched with setConstellationsVisible. */
  setConstellations(list: Constellation[] | null): void {
    if (this.disposed) return;
    this.constList = list;
    if (this.constLines) {
      this.scene.remove(this.constLines);
      this.constLines.geometry.dispose();
      (this.constLines.material as LineBasicMaterial).dispose();
      this.constLines = null;
    }
    for (const el of this.constLabelEls) el.remove();
    this.constLabelEls.length = 0;
    this.constLabelW.clear();
    if (list) {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(constellationSegments(list), 3));
      const mat = new LineBasicMaterial({ color: new Color(this.colors.constLine), transparent: true, opacity: 0.38, depthTest: false, depthWrite: false });
      this.constLines = new LineSegments(g, mat);
      this.constLines.renderOrder = 101; // over the grid (100), under the ground (150)
      this.constLines.frustumCulled = false;
      this.constLines.visible = this.constOn;
      this.scene.add(this.constLines);
      for (const c of list) {
        const s = document.createElement('span');
        s.dataset.constellation = c.id;
        Object.assign(s.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          display: 'none',
          color: this.colors.constLabel,
          textShadow: '0 0 3px #000, 0 0 2px #000',
          whiteSpace: 'nowrap',
          fontSize: '11px',
          lineHeight: '13px',
          pointerEvents: 'none',
        } satisfies Partial<CSSStyleDeclaration>);
        this.overlay.appendChild(s);
        this.constLabelEls.push(s);
      }
    }
    this.requestRender();
  }

  setConstellationsVisible(on: boolean): void {
    if (this.disposed || on === this.constOn) return;
    this.constOn = on;
    if (this.constLines) this.constLines.visible = on;
    this.requestRender();
  }

  /** Language of the constellation names: Korean names, or Latin names in capitals. */
  setConstellationLang(lang: 'ko' | 'en'): void {
    if (this.disposed || lang === this.constLang) return;
    this.constLang = lang;
    this.requestRender();
  }

  /** Elements over the map (the read-out box, buttons) that constellation names must not cover. */
  setLabelAvoid(els: HTMLElement[]): void {
    this.avoidEls = els.slice();
    this.requestRender();
  }

  /** The element the globe draws into. */
  get element(): HTMLElement {
    return this.container;
  }

  getView(): GlobeView {
    const v: GlobeView = { ra: this.center.ra, dec: this.center.dec, fovDeg: this.fov };
    if (this.ground && this.frameObs) {
      const h = skyToHorizontal(this.frameObs, this.center.ra, this.center.dec);
      v.azDeg = h.azDeg;
      v.altDeg = h.altDeg;
    }
    return v;
  }

  /** Loading state, for status lines and headless checks. */
  getStatus(): SkyGlobeStatus {
    const imageryAvailable = this.imageryAvailable();
    return {
      channel: this.channel,
      frame: this.frame,
      order: this.order,
      tilesLoaded: this.cache.stats.loaded,
      tilesFailed: this.cache.stats.failed,
      tilesPending: this.cache.pending,
      visibleTiles: this.visibleCount,
      imageryAvailable,
      note: this.noteEl.style.display === 'none' ? '' : this.noteEl.textContent ?? '',
    };
  }

  resize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.root.clientWidth);
    const h = Math.max(1, this.root.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.viewTimer) clearTimeout(this.viewTimer);
    this.stopGroundTick();
    this.groundMeshes?.dispose();
    this.groundMeshes = null;
    this.ro?.disconnect();
    for (const c of this.cleanups) c();
    this.cache.dispose();
    for (const m of this.tileMeshes.values()) m.material.dispose();
    this.tileMeshes.clear();
    for (const g of this.geoCache.values()) g.dispose();
    this.geoCache.clear();
    if (this.graticule) {
      this.graticule.geometry.dispose();
      (this.graticule.material as LineBasicMaterial).dispose();
    }
    if (this.constLines) {
      this.constLines.geometry.dispose();
      (this.constLines.material as LineBasicMaterial).dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.root.remove();
    this.listeners.pick.clear();
    this.listeners.view.clear();
    this.listeners.ground.clear();
  }

  // ------------------------------------------------------------------ rendering

  private requestRender(): void {
    this.dirty = true;
    if (this.disposed || this.raf || (typeof document !== 'undefined' && document.hidden)) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.frameTick();
    });
  }

  private aspect(): number {
    return this.width / this.height;
  }

  private basis(): CameraBasis {
    if (this.ground && this.frameObs) return groundCameraBasis(this.frameObs, this.center.ra, this.center.dec);
    return cameraBasis(this.center.ra, this.center.dec);
  }

  private makeFrame(): ObserverFrame {
    return observerFrame(this.nowFn(), this.site);
  }

  private groundState(): GlobeGround {
    return { on: this.ground, epochMs: this.nowFn() };
  }

  /** Keep the horizon in view: limit the view centre's altitude for the present field of view. */
  private clampGround(): void {
    if (this.ground && this.frameObs) this.center = clampViewToHorizon(this.frameObs, this.center, this.fov);
  }

  private scheduleGroundTick(): void {
    if (this.groundTimer || !this.ground || !this.active || this.disposed || (typeof document !== 'undefined' && document.hidden)) return;
    this.groundTimer = setTimeout(() => {
      this.groundTimer = null;
      this.refreshGround();
      this.scheduleGroundTick();
    }, GROUND_TICK_MS);
  }

  private stopGroundTick(): void {
    if (this.groundTimer) clearTimeout(this.groundTimer);
    this.groundTimer = null;
  }

  private frameTick(): void {
    if (this.disposed) return;
    let again = false;
    if (this.anim) {
      const t = Math.min(1, (performance.now() - this.anim.t0) / ANIM_MS);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.center = slerpSky(this.anim.from, this.anim.to, e);
      this.fov = this.anim.fov0 * (this.anim.fov1 / this.anim.fov0) ** e;
      if (t >= 1) {
        this.center = { ...this.anim.to };
        this.fov = this.anim.fov1;
        this.anim = null;
      } else again = true;
      this.clampGround();
    }
    this.dirty = false;
    this.updateCamera();
    this.updateTiles();
    this.updateGraticule();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.updateMarkers();
    this.updateCompass();
    this.updateConstellationLabels();
    this.updateNote();
    this.emitView();
    if (again || this.dirty) this.requestRender();
  }

  private updateCamera(): void {
    const b = this.basis();
    const m = new Matrix4().makeBasis(new Vector3(...b.right), new Vector3(...b.up), new Vector3(-b.forward[0], -b.forward[1], -b.forward[2]));
    this.camera.quaternion.setFromRotationMatrix(m);
    this.camera.position.set(0, 0, 0);
    if (this.camera.fov !== this.fov) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld(true);
  }

  private geometry(order: number, npix: number): BufferGeometry {
    const k = `${order}/${npix}`;
    let g = this.geoCache.get(k);
    if (g) {
      this.geoCache.delete(k);
      this.geoCache.set(k, g); // refresh LRU position
      return g;
    }
    g = buildTileGeometry(order, npix, segmentsFor(order));
    this.geoCache.set(k, g);
    if (this.geoCache.size > 600) {
      for (const [ok, og] of this.geoCache) {
        if (this.tileMeshes.has(ok)) continue;
        og.dispose();
        this.geoCache.delete(ok);
        if (this.geoCache.size <= 500) break;
      }
    }
    return g;
  }

  /** Best texture for a cell: the current frame, else the previous frame (kept while the new one loads). */
  private textureFor(order: number, npix: number): Texture | undefined {
    return this.cache.get(order, npix, this.frame) ?? (this.prevFrame >= 0 ? this.cache.get(order, npix, this.prevFrame) : undefined);
  }

  private updateTiles(): void {
    const cache = this.cache;
    cache.beginRound();
    const show = new Map<string, Texture>();
    const frame = this.frame;

    // 1. Order 0 everywhere (12 tiles, about 1 MB): the sky is never blank.
    for (let n = 0; n < 12; n++) {
      cache.want(0, n, frame, n === 0 ? 0 : 1);
      const t = this.textureFor(0, n);
      if (t) show.set(`0/${n}`, t);
    }

    // 2. Tiles at the order the field of view needs, for cells intersecting the view.
    const radius = viewRadiusDeg(this.fov, this.aspect());
    let order = chooseOrder(this.fov, this.height * this.renderer.getPixelRatio());
    let visible = order > 0 ? queryCone(order, this.center.ra, this.center.dec, radius) : [];
    while (order > 0 && visible.length > MAX_VISIBLE_TILES) {
      order--;
      visible = order > 0 ? queryCone(order, this.center.ra, this.center.dec, radius) : [];
    }
    this.order = order;
    this.visibleCount = order > 0 ? visible.length : 12;
    if (order > 0) {
      // Nearest tiles to the view centre first.
      const withDist = visible.map((n) => {
        const c = pix2angNest(order, n);
        return { n, d: sepDeg(c.ra, c.dec, this.center.ra, this.center.dec) };
      });
      withDist.sort((a, b) => a.d - b.d);
      withDist.forEach(({ n }, i) => {
        cache.want(order, n, frame, 10 + i);
        let t = cache.get(order, n, frame);
        if (t) return void show.set(`${order}/${n}`, t);
        // Old channel at the same resolution, then the best loaded ancestor (coarse-to-fine).
        if (this.prevFrame >= 0 && (t = cache.get(order, n, this.prevFrame))) return void show.set(`${order}/${n}`, t);
        for (let k = order - 1; k >= 1; k--) {
          const p = parentAt(order, n, k);
          const tk = this.textureFor(k, p);
          if (tk) {
            show.set(`${k}/${p}`, tk);
            break;
          }
        }
      });
    }
    cache.pump();

    // 3. Sync meshes with the wanted set. Finer orders draw on top (renderOrder = order).
    for (const [k, mesh] of this.tileMeshes) {
      if (!show.has(k)) {
        this.tileGroup.remove(mesh);
        mesh.material.dispose();
        this.tileMeshes.delete(k);
      }
    }
    for (const [k, tex] of show) {
      let mesh = this.tileMeshes.get(k);
      if (!mesh) {
        const [o, n] = k.split('/').map(Number);
        const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
        mesh = new Mesh(this.geometry(o, n), mat);
        mesh.renderOrder = o;
        mesh.frustumCulled = true;
        this.tileMeshes.set(k, mesh);
        this.tileGroup.add(mesh);
      } else if (mesh.material.map !== tex) {
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      }
    }
  }

  private imageryAvailable(): boolean {
    for (let n = 0; n < 12; n++) if (this.textureFor(0, n)) return true;
    return this.cache.stats.failed === 0;
  }

  private updateNote(): void {
    let note = '';
    if (!this.imageryAvailable()) note = `Sky imagery unavailable${this.cache.stats.lastError ? ': ' + this.cache.stats.lastError : ''}`;
    else if (BLANK_FRAMES.includes(this.channel - 1)) note = `Channel ${this.channel} has no all-sky image in DR1; showing channel ${this.frame + 1}`;
    if (note) {
      if (this.noteEl.textContent !== note) this.noteEl.textContent = note;
      this.noteEl.style.display = 'block';
    } else this.noteEl.style.display = 'none';
  }

  // ------------------------------------------------------------------ graticule

  private updateGraticule(): void {
    const sp = gridSpacing(this.fov);
    const wide = sp.ra >= 15;
    // Fine grids are built only around the view and rebuilt when the view moves away.
    const r = Math.min(90, viewRadiusDeg(this.fov, this.aspect()) * 1.6 + 2 * sp.dec);
    const snap = wide ? 0 : Math.max(sp.dec, r / 3);
    const cRa = wide ? 0 : Math.round(this.center.ra / snap) * snap;
    const cDec = wide ? 0 : Math.round(this.center.dec / snap) * snap;
    const key = wide ? 'wide' : `${sp.ra}/${sp.dec}/${cRa.toFixed(3)}/${cDec.toFixed(3)}/${r.toFixed(2)}`;
    if (key === this.graticuleKey) return;
    this.graticuleKey = key;

    const lines: { kind: 'ra' | 'dec'; value: number; pts: [number, number][] }[] = [];
    let dec0 = -90;
    let dec1 = 90;
    let ra0 = 0;
    let ra1 = 360;
    if (!wide) {
      dec0 = Math.max(-90, cDec - r);
      dec1 = Math.min(90, cDec + r);
      const cosd = Math.cos((Math.max(Math.abs(dec0), Math.abs(dec1)) * Math.PI) / 180);
      const rr = dec1 >= 89.9 || dec0 <= -89.9 || cosd < 0.05 ? 180 : Math.min(180, r / cosd);
      ra0 = cRa - rr;
      ra1 = cRa + rr;
    }
    const step = wide ? 1 : Math.max(sp.dec / 8, 0.05);
    // Meridians (constant RA), stopped short of the poles where they all meet.
    const poleGap = 0;
    for (let ra = Math.ceil(ra0 / sp.ra) * sp.ra; ra < ra1 - 1e-9 && ra < ra0 + 360 - 1e-9; ra += sp.ra) {
      const pts: [number, number][] = [];
      const lo = Math.max(dec0, -90 + poleGap);
      const hi = Math.min(dec1, 90 - poleGap);
      for (let d = lo; d <= hi + 1e-9; d += step) pts.push([wrapRa(ra), Math.min(d, hi)]);
      lines.push({ kind: 'ra', value: wrapRa(ra), pts });
    }
    // Parallels (constant Dec).
    for (let dec = Math.ceil(dec0 / sp.dec) * sp.dec; dec <= dec1 + 1e-9; dec += sp.dec) {
      if (Math.abs(dec) >= 89.99) continue;
      const pts: [number, number][] = [];
      const rstep = wide ? 1 : Math.max(sp.ra / 8, 0.05);
      for (let ra = ra0; ra <= ra1 + 1e-9; ra += rstep) pts.push([wrapRa(ra), dec]);
      lines.push({ kind: 'dec', value: dec, pts });
    }
    this.graticuleLines = lines;

    let nseg = 0;
    for (const l of lines) nseg += Math.max(0, l.pts.length - 1);
    const pos = new Float32Array(nseg * 6);
    let q = 0;
    for (const l of lines) {
      for (let i = 0; i + 1 < l.pts.length; i++) {
        const a = skyToVec(l.pts[i][0], l.pts[i][1]);
        const b = skyToVec(l.pts[i + 1][0], l.pts[i + 1][1]);
        pos.set(a, q);
        pos.set(b, q + 3);
        q += 6;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    if (this.graticule) {
      this.graticule.geometry.dispose();
      this.graticule.geometry = g;
    } else {
      const mat = new LineBasicMaterial({ color: new Color(this.colors.grid), transparent: true, opacity: 0.35, depthTest: false, depthWrite: false });
      this.graticule = new LineSegments(g, mat);
      this.graticule.renderOrder = 100;
      this.graticule.frustumCulled = false;
      this.scene.add(this.graticule);
    }
  }

  /** Sparse labels: each meridian is labelled where it leaves the bottom of the screen, each
   *  parallel where it leaves the left edge; labels closer than 46 px to another are skipped. */
  private updateLabels(): void {
    const b = this.basis();
    const W = this.width;
    const H = this.height;
    const a = this.aspect();
    const placed: { x: number; y: number; text: string }[] = [];
    const margin = 0.94;
    const fo = this.ground ? this.frameObs : null;
    // Keep grid labels clear of the compass letters.
    for (const c of this.compassPx) placed.push({ x: c.x, y: c.y, text: '' });
    for (const l of this.graticuleLines) {
      let best: { x: number; y: number } | null = null;
      // Sample along the line (every other point is enough for label placement).
      for (let i = 0; i < l.pts.length; i += 2) {
        const n = skyToNdc(b, l.pts[i][0], l.pts[i][1], this.fov, a);
        if (!n || Math.abs(n.x) > margin || Math.abs(n.y) > margin) continue;
        if (fo && !isAboveHorizon(fo, l.pts[i][0], l.pts[i][1], 1)) continue; // under the ground
        // Meridians all meet at the poles: never label them there.
        if (l.kind === 'ra' && Math.abs(l.pts[i][1]) > 88) continue;
        if (!best || (l.kind === 'ra' ? n.y < best.y : n.x < best.x)) best = n;
      }
      if (!best) continue;
      // A meridian whose lowest visible point is mid-screen ends at a pole there: no label.
      if (!fo && l.kind === 'ra' && Math.max(Math.abs(best.x), Math.abs(best.y)) < 0.8) continue;
      const x = ((best.x + 1) / 2) * W;
      const y = ((1 - best.y) / 2) * H;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 46)) continue;
      placed.push({ x, y, text: l.kind === 'ra' ? raLabel(l.value) : decLabel(l.value) });
      if (placed.length >= 24 + this.compassPx.length) break;
    }
    placed.splice(0, this.compassPx.length);
    while (this.gridLabels.length < placed.length) {
      const s = document.createElement('span');
      Object.assign(s.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        color: this.colors.label,
        textShadow: '0 0 3px #000, 0 0 2px #000',
        whiteSpace: 'nowrap',
        fontSize: '11px',
      } satisfies Partial<CSSStyleDeclaration>);
      this.overlay.appendChild(s);
      this.gridLabels.push(s);
    }
    this.gridLabels.forEach((s, i) => {
      const p = placed[i];
      if (!p) {
        s.style.display = 'none';
        return;
      }
      s.style.display = 'block';
      if (s.textContent !== p.text) s.textContent = p.text;
      s.style.transform = `translate(${Math.round(p.x + 3)}px, ${Math.round(p.y - 14)}px)`;
    });
  }

  /** Compass letters N, E, S, W standing on the skyline at the four points of the horizon, N emphasised. */
  private updateCompass(): void {
    const f = this.ground ? this.frameObs : null;
    this.compassPx = [];
    if (!f) return;
    if (this.compassEls.length === 0) {
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.dataset.tb = `compass-${'NESW'[i]}`;
        el.setAttribute('aria-hidden', 'true');
        const north = i === 0;
        Object.assign(el.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          display: 'none',
          willChange: 'transform',
          fontWeight: north ? '700' : '600',
          fontSize: north ? '17px' : '13px',
          lineHeight: '1',
          letterSpacing: '0.02em',
          color: north ? this.colors.accent : '#aab6cf',
          textShadow: '0 0 4px #000, 0 0 2px #000',
          pointerEvents: 'none',
        } satisfies Partial<CSSStyleDeclaration>);
        el.textContent = this.compassNames[i];
        this.overlay.appendChild(el);
        this.compassEls.push(el);
      }
    }
    const b = this.basis();
    const t = Math.tan((this.fov * Math.PI) / 360);
    const a = this.aspect();
    this.compassEls.forEach((el, i) => {
      const v = horizontalToVec(f, i * 90, skylineHeightDeg(i * 90));
      const z = v[0] * b.forward[0] + v[1] * b.forward[1] + v[2] * b.forward[2];
      let ok = z > 1e-6;
      let x = 0;
      let y = 0;
      if (ok) {
        const nx = (v[0] * b.right[0] + v[1] * b.right[1] + v[2] * b.right[2]) / z / (t * a);
        const ny = (v[0] * b.up[0] + v[1] * b.up[1] + v[2] * b.up[2]) / z / t;
        x = ((nx + 1) / 2) * this.width;
        y = ((1 - ny) / 2) * this.height;
        ok = x > 8 && x < this.width - 8 && y > 20 && y < this.height + 4;
      }
      if (!ok) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const w = el.offsetWidth || 10;
      el.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - el.offsetHeight - 3)}px)`;
      this.compassPx.push({ x, y: y - 10 });
    });
  }

  /** Constellation names at their label points: hidden below an 8 degree field, off screen, behind the
   *  camera, under the ground, or where they would cover a target marker, the read-out or another name. */
  private updateConstellationLabels(): void {
    const els = this.constLabelEls;
    if (!this.constList || !els.length) return;
    const show = this.constOn && this.fov >= 8;
    if (!show) {
      for (const el of els) if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    const b = this.basis();
    const a = this.aspect();
    const W = this.width;
    const H = this.height;
    const avoid: Box[] = [];
    const rr = this.root.getBoundingClientRect();
    const addRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) avoid.push({ x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height });
    };
    for (const el of this.markerEls.values()) {
      if (el.style.display === 'none') continue;
      for (const child of Array.from(el.children)) addRect(child);
    }
    for (const el of this.avoidEls) if (el.isConnected) addRect(el);
    for (const el of this.gridLabels) if (el.style.display !== 'none') addRect(el); // keep grid numbers readable
    for (const c of this.compassPx) avoid.push({ x: c.x - 10, y: c.y - 10, w: 20, h: 20 });
    const fo = this.ground ? this.frameObs : null;
    // Names nearer the view centre win when two would overlap.
    const order = this.constList
      .map((c, i) => ({ c, i, n: skyToNdc(b, c.label[0], c.label[1], this.fov, a) }))
      .sort((p, q) => (p.n ? Math.hypot(p.n.x, p.n.y) : 99) - (q.n ? Math.hypot(q.n.x, q.n.y) : 99));
    for (const { c, i, n } of order) {
      const el = els[i];
      const hide = () => { if (el.style.display !== 'none') el.style.display = 'none'; };
      if (!n || Math.abs(n.x) > 1.05 || Math.abs(n.y) > 1.05) { hide(); continue; }
      if (fo && !isAboveSkyline(fo, c.label[0], c.label[1])) { hide(); continue; }
      const text = labelText(c, this.constLang);
      let m = this.constLabelW.get(el);
      if (!m || m.text !== text) {
        el.textContent = text;
        el.style.letterSpacing = this.constLang === 'en' ? '.14em' : '0';
        el.style.display = 'block';
        m = { text, w: el.offsetWidth, h: el.offsetHeight || 13 };
        this.constLabelW.set(el, m);
      }
      const x = ((n.x + 1) / 2) * W - m.w / 2;
      const y = ((1 - n.y) / 2) * H - m.h / 2;
      const box: Box = { x, y, w: m.w, h: m.h };
      if (!labelVisible(box, this.fov, W, H, avoid)) { hide(); continue; }
      avoid.push(box);
      el.style.display = 'block';
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  private markerScreen(m: GlobeMarker, b: CameraBasis): { x: number; y: number } | null {
    // Ground view: a marker below the horizon or behind the skyline is not drawn (and cannot be picked).
    if (this.ground && this.frameObs && !isAboveSkyline(this.frameObs, m.ra, m.dec)) return null;
    const n = skyToNdc(b, m.ra, m.dec, this.fov, this.aspect());
    if (!n) return null;
    const x = ((n.x + 1) / 2) * this.width;
    const y = ((1 - n.y) / 2) * this.height;
    // Hidden once the ring is off screen, so no clipped label fragments remain at the edges.
    if (x < -8 || y < -8 || x > this.width + 8 || y > this.height + 8) return null;
    return { x, y };
  }

  private updateMarkers(): void {
    const b = this.basis();
    for (const m of this.markers) {
      const el = this.markerEls.get(m.id);
      if (!el) continue;
      const p = this.markerScreen(m, b);
      if (!p) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      // Keep the label readable near the right edge by putting it on the left of the ring.
      const label = el.lastElementChild as HTMLElement | null;
      if (label) {
        const flip = p.x > this.width - 12 - label.offsetWidth;
        label.style.left = flip ? 'auto' : '12px';
        label.style.right = flip ? '12px' : 'auto';
      }
    }
  }

  // ------------------------------------------------------------------ events

  private emit(event: 'pick' | 'view' | 'ground', payload: GlobePick | GlobeView | GlobeGround): void {
    for (const cb of [...this.listeners[event]]) {
      try {
        cb(payload);
      } catch (e) {
        console.error(`SkyGlobe '${event}' listener failed`, e);
      }
    }
  }

  /** 'view' is emitted at most every 100 ms while the view changes, plus once when it settles. */
  private emitView(): void {
    const v = this.getView();
    const sig = `${v.ra.toFixed(5)}/${v.dec.toFixed(5)}/${v.fovDeg.toFixed(4)}/${v.azDeg === undefined ? '-' : `${v.azDeg.toFixed(4)}/${v.altDeg?.toFixed(4)}`}`;
    if (sig === this.lastEmitted) return;
    const now = performance.now();
    if (this.viewTimer) clearTimeout(this.viewTimer);
    if (now - this.lastViewEmit >= 100) {
      this.lastViewEmit = now;
      this.lastEmitted = sig;
      this.emit('view', v);
    } else {
      this.viewTimer = setTimeout(() => {
        this.viewTimer = null;
        if (!this.disposed) this.emitView();
      }, 110);
    }
  }

  private ndcAt(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, y: 1 - ((clientY - r.top) / Math.max(1, r.height)) * 2 };
  }

  private skyAt(clientX: number, clientY: number): SkyPos {
    const n = this.ndcAt(clientX, clientY);
    return ndcToSky(this.basis(), n.x, n.y, this.fov, this.aspect());
  }

  /** Move the view so that sky point `anchor` sits under the screen point (keeps north up). */
  private keepUnder(anchor: SkyPos, clientX: number, clientY: number): void {
    const n = this.ndcAt(clientX, clientY);
    if (this.ground && this.frameObs) {
      const g = solveGroundGrab(this.frameObs, anchor, n.x, n.y, this.fov, this.aspect(), this.center);
      if (g && groundGrabAccepted(this.frameObs, this.center, g)) {
        this.center = g;
        this.clampGround();
      }
      return;
    }
    const c = solveGrab(anchor, n.x, n.y, this.fov, this.aspect(), this.center.dec);
    if (c) this.center = c;
  }

  private zoomAt(factor: number, clientX?: number, clientY?: number): void {
    this.anim = null;
    const anchor = clientX !== undefined && clientY !== undefined ? this.skyAt(clientX, clientY) : null;
    this.fov = clampFov(this.fov * factor);
    if (anchor) this.keepUnder(anchor, clientX!, clientY!);
    this.clampGround();
    this.requestRender();
  }

  private pick(clientX: number, clientY: number): void {
    const sky = this.skyAt(clientX, clientY);
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const b = this.basis();
    let best: { id: string; d: number } | null = null;
    for (const m of this.markers) {
      const p = this.markerScreen(m, b);
      if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= PICK_RADIUS_PX && (!best || d < best.d)) best = { id: m.id, d };
    }
    // A click on the ground (under the skyline) does nothing: there is no sky there to pin.
    if (!best && this.ground && this.frameObs) {
      const h = vecToHorizontal(this.frameObs, skyToVec(sky.ra, sky.dec));
      if (h.altDeg < skylineHeightDeg(h.azDeg)) return;
    }
    const payload: GlobePick = best ? { ra: sky.ra, dec: sky.dec, markerId: best.id } : { ra: sky.ra, dec: sky.dec };
    this.emit('pick', payload);
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    const add = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };

    add(canvas, 'pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.anim = null;
      this.root.focus({ preventScroll: true });
      if (this.pointers.size === 1) {
        this.drag = { anchor: this.skyAt(e.clientX, e.clientY), downX: e.clientX, downY: e.clientY, t0: performance.now(), moved: false };
        canvas.style.cursor = 'grabbing';
      } else if (this.pointers.size === 2) {
        const [p, q] = [...this.pointers.values()];
        this.drag = null;
        this.pinch = { d0: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), fov0: this.fov, anchor: this.skyAt((p.x + q.x) / 2, (p.y + q.y) / 2) };
      }
    });
    add(canvas, 'pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const [p, q] = [...this.pointers.values()];
        const d = Math.max(1, Math.hypot(p.x - q.x, p.y - q.y));
        this.fov = clampFov((this.pinch.fov0 * this.pinch.d0) / d);
        this.keepUnder(this.pinch.anchor, (p.x + q.x) / 2, (p.y + q.y) / 2);
        this.clampGround();
        this.requestRender();
      } else if (this.drag) {
        if (Math.hypot(e.clientX - this.drag.downX, e.clientY - this.drag.downY) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          this.keepUnder(this.drag.anchor, e.clientX, e.clientY);
          this.requestRender();
        }
      }
    });
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.drag && !this.drag.moved && e.type === 'pointerup' && performance.now() - this.drag.t0 < 800) this.pick(e.clientX, e.clientY);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 1) {
        const [id, p] = [...this.pointers.entries()][0];
        void id;
        this.drag = { anchor: this.skyAt(p.x, p.y), downX: p.x, downY: p.y, t0: 0, moved: true };
      } else this.drag = null;
      canvas.style.cursor = 'grab';
    };
    add(canvas, 'pointerup', up);
    add(canvas, 'pointercancel', up);
    add(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        this.zoomAt(Math.exp(Math.max(-1, Math.min(1, dy * 0.0015))), e.clientX, e.clientY);
      },
      { passive: false },
    );
    add(this.root, 'keydown', (e) => {
      const stepDeg = this.fov / 10;
      let handled = true;
      if (e.key === '+' || e.key === '=') this.zoomAt(1 / 1.25);
      else if (e.key === '-' || e.key === '_') this.zoomAt(1.25);
      else if (this.ground && this.frameObs && e.key.startsWith('Arrow') && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // Ground view: arrows move altitude and azimuth (left = towards east when facing south, like a drag to the right).
        const h = skyToHorizontal(this.frameObs, this.center.ra, this.center.dec);
        let az = h.azDeg;
        let alt = h.altDeg;
        if (e.key === 'ArrowUp') alt += stepDeg;
        else if (e.key === 'ArrowDown') alt -= stepDeg;
        else {
          const dAz = stepDeg / Math.max(0.1, Math.cos((alt * Math.PI) / 180));
          az += e.key === 'ArrowLeft' ? -dAz : dAz;
        }
        this.center = horizontalToSky(this.frameObs, az, Math.min(89.9, alt));
        this.clampGround();
      } else if (e.key === 'ArrowUp') this.center = { ra: this.center.ra, dec: Math.min(90, this.center.dec + stepDeg) };
      else if (e.key === 'ArrowDown') this.center = { ra: this.center.ra, dec: Math.max(-90, this.center.dec - stepDeg) };
      else if (e.key === 'ArrowLeft') this.center = { ra: wrapRa(this.center.ra + stepDeg / Math.max(0.1, Math.cos((this.center.dec * Math.PI) / 180))), dec: this.center.dec };
      else if (e.key === 'ArrowRight') this.center = { ra: wrapRa(this.center.ra - stepDeg / Math.max(0.1, Math.cos((this.center.dec * Math.PI) / 180))), dec: this.center.dec };
      else handled = false;
      if (handled) {
        e.preventDefault();
        this.anim = null;
        this.requestRender();
      }
    });
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.stopGroundTick();
      } else {
        if (this.ground && this.active) {
          this.refreshGround();
          this.scheduleGroundTick();
        }
        this.requestRender();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
    const onCtxLost = (e: Event) => e.preventDefault();
    canvas.addEventListener('webglcontextlost', onCtxLost);
    this.cleanups.push(() => canvas.removeEventListener('webglcontextlost', onCtxLost));
  }
}
