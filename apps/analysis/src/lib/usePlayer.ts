import { useEffect } from 'react'
import { useTime, visitIndexAt } from '../store'
import type { TargetMeta } from '../types'
import { coldVisits } from './cold'

/** One playback loop for the whole app; it only ever writes tMjd. */
export function usePlayer(meta: TargetMeta | null) {
  const playing = useTime((s) => s.playing)
  const playMode = useTime((s) => s.playMode)
  const suspended = useTime((s) => s.suspended)

  useEffect(() => {
    if (!playing || suspended || !meta || meta.visits.length < 2) return
    const st = useTime.getState
    const vs = meta.visits

    if (playMode === 'time') {
      let raf = 0
      let last = performance.now()
      const tick = (now: number) => {
        const dt = (now - last) / 1000
        last = now
        const { tMjd, speed } = st()
        const end = vs[vs.length - 1].mjd
        let next = tMjd + dt * speed
        if (tMjd >= end) next = vs[0].mjd // loop
        st().setTime(Math.min(next, end))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }

    let timer = 0
    const step = () => {
      const { tMjd, ab, blinkFps, goToVisit, view } = st()
      const k = visitIndexAt(meta, tMjd)
      // the cold-object filter only exists for visits with both D5 and D6: blink through those
      const cold = view === 'cold' ? coldVisits(meta) : []
      if (playMode === 'ab') goToVisit(meta, k === ab[0] ? ab[1] : ab[0])
      else if (cold.length) goToVisit(meta, cold.find((i) => i > k) ?? cold[0])
      else goToVisit(meta, (k + 1) % vs.length)
      timer = window.setTimeout(step, 1000 / blinkFps)
    }
    timer = window.setTimeout(step, 1000 / st().blinkFps)
    return () => clearTimeout(timer)
  }, [playing, suspended, playMode, meta])
}
