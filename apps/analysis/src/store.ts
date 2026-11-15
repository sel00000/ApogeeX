import { create } from 'zustand'
import type { TargetMeta } from './types'

export type ViewMode = 'overview' | 'los'
/** time: continuous days/sec · blink: visit by visit · ab: alternate visits A and B */
export type PlayMode = 'time' | 'blink' | 'ab'
/** explore = guided missions for everyone · research = every analysis tool */
export type UiMode = 'explore' | 'research'
/** image = one visit · diff = A − B · cold = long-λ minus scaled short-λ (cold-object filter) */
export type ImageView = 'image' | 'diff' | 'cold'
export type AnalysisTab = 'motion' | 'variable' | 'spectrum' | 'provenance'
export type Lang = 'ko' | 'en'
/** workbench = SPHEREx image + 3D · sky = the live all-sky SPHEREx globe */
export type StageView = 'workbench' | 'sky'

interface TimeState {
  targetId: string | null
  /** single source of truth for "now"; every view derives from it */
  tMjd: number
  playing: boolean
  suspended: boolean
  playMode: PlayMode
  /** time mode: simulated days per real second; blink/ab: frames per second */
  speed: number
  blinkFps: number
  ab: [number, number]
  abTargetId: string | null
  mode: ViewMode
  /** motion exaggeration for markers / 3D track only (never the image); always badged */
  exaggeration: number

  // shared view settings (missions drive these, so they live here and not inside one panel)
  ui: UiMode
  view: ImageView
  /** 0 = all six detector arrays */
  det: number
  /** null = the viewer's default for this target */
  zoom: number | null
  /** cold-object filter scale k in  D6 − k·D5 */
  coldK: number
  showImage3d: boolean
  tab: AnalysisTab | null
  lang: Lang
  stage: StageView
  /** Gaia DR3 stars (live from VizieR) over the SPHEREx frame */
  gaia: boolean

  setTarget: (id: string) => void
  setTime: (mjd: number) => void
  play: (mode: PlayMode) => void
  stop: () => void
  setSuspended: (suspended: boolean) => void
  setSpeed: (s: number) => void
  setBlinkFps: (f: number) => void
  setAB: (ab: [number, number]) => void
  initComparison: (meta: TargetMeta) => void
  setMode: (m: ViewMode) => void
  setExaggeration: (x: number) => void
  goToVisit: (meta: TargetMeta, i: number) => void
  setUi: (ui: UiMode) => void
  setView: (v: ImageView) => void
  setDet: (d: number) => void
  setZoom: (z: number | null) => void
  setColdK: (k: number) => void
  setShowImage3d: (b: boolean) => void
  setTab: (t: AnalysisTab | null) => void
  setLang: (l: Lang) => void
  setStage: (v: StageView) => void
  setGaia: (b: boolean) => void
}

/** Rayleigh–Jeans flux ratio F_ν(4.71 µm)/F_ν(4.12 µm) = (4.12/4.71)² for the D6 and D5 array centres. */
export const RJ_K = (4.12 / 4.71) ** 2

export const useTime = create<TimeState>((set, get) => ({
  targetId: null,
  tMjd: 0,
  playing: false,
  suspended: false,
  playMode: 'blink',
  speed: 20,
  blinkFps: 8,
  ab: [0, 0],
  abTargetId: null,
  mode: 'overview',
  exaggeration: 1,
  ui: 'explore',
  view: 'image',
  det: 0,
  zoom: null,
  coldK: RJ_K,
  showImage3d: true,
  tab: null,
  lang: 'en',
  stage: 'workbench',
  gaia: false,

  setTarget: (id) => set({ targetId: id, abTargetId: null, playing: false, mode: 'overview', exaggeration: 1, view: 'image', det: 0, zoom: null, coldK: RJ_K, showImage3d: true, tab: null }),
  setTime: (mjd) => set({ tMjd: mjd }),
  play: (playMode) => set({ playing: true, playMode }),
  stop: () => set({ playing: false }),
  setSuspended: (suspended) => set({ suspended }),
  setSpeed: (speed) => set({ speed }),
  setBlinkFps: (blinkFps) => set({ blinkFps }),
  setAB: (ab) => set({ ab }),
  initComparison: (meta) => {
    const state = get()
    if (state.abTargetId === meta.id && state.ab.every(i => !!meta.visits[i])) return
    const last = meta.visits.findLastIndex((v, i) => i > 0 && v.detectors.some(d => meta.visits[0].detectors.includes(d)))
    set({ abTargetId: meta.id, ab: [0, Math.max(0, last)] })
  },
  setMode: (mode) => set({ mode }),
  setExaggeration: (exaggeration) => set({ exaggeration }),
  goToVisit: (meta, i) => {
    const k = Math.max(0, Math.min(meta.visits.length - 1, i))
    set({ tMjd: meta.visits[k].mjd })
  },
  setUi: (ui) => set({ ui }),
  setView: (view) => set({ view }),
  setDet: (det) => set({ det }),
  setZoom: (zoom) => set({ zoom }),
  setColdK: (coldK) => set({ coldK }),
  setShowImage3d: (showImage3d) => set({ showImage3d }),
  setTab: (tab) => set({ tab }),
  setLang: (lang) => set({ lang }),
  setStage: (stage) => set({ stage }),
  setGaia: (gaia) => set({ gaia }),
}))

/** Index of the visit at or before t (falls back to first). */
export function visitIndexAt(meta: TargetMeta, t: number): number {
  let k = 0
  for (let i = 0; i < meta.visits.length; i++) if (meta.visits[i].mjd <= t + 1e-6) k = i
  return k
}

/** True when t sits exactly on a visit. */
export function onVisit(meta: TargetMeta, t: number): boolean {
  return meta.visits.some((v) => Math.abs(v.mjd - t) < 1e-6)
}
