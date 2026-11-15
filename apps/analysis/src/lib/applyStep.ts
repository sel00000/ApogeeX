import { useTime } from '../store'
import type { TargetMeta } from '../types'
import { coldVisits } from './cold'
import { commonDetector } from './missions'
import type { StepAction } from './missions'

/** A mission step only sets shared view state; every panel reacts to the store. */
export function applyStep(meta: TargetMeta, a: StepAction) {
  const s = useTime.getState()
  if (a.ui) s.setUi(a.ui)
  if (a.tab) s.setTab(a.tab)
  if (a.det !== undefined) s.setDet(a.det === 'common' ? commonDetector(meta) : a.det)
  if (a.view) s.setView(a.view)
  if (a.zoom !== undefined) s.setZoom(a.zoom)
  if (a.mode) s.setMode(a.mode)
  if (a.showImage3d !== undefined) s.setShowImage3d(a.showImage3d)
  if (a.abEnds) s.setAB([0, meta.visits.length - 1])
  if (a.view === 'cold') {
    const cv = coldVisits(meta)
    const k = meta.visits.findIndex((v) => Math.abs(v.mjd - s.tMjd) < 1e-6)
    if (cv.length && !cv.includes(k)) s.goToVisit(meta, cv[0])
  }
  if (a.ui === 'research') {
    // bring the opened tool into view once it has mounted
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => document.querySelector('[data-testid="analysis"]')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), 60)
  }
  if (a.play === null) s.stop()
  else if (a.play) {
    if (a.play !== 'time' && !meta.visits.some((v) => Math.abs(v.mjd - useTime.getState().tMjd) < 1e-6)) s.goToVisit(meta, 0)
    s.play(a.play)
  }
}
