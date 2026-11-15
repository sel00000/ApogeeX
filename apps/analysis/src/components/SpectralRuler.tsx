import type { TargetMeta } from '../types'
import { DETECTORS } from './PhotometryPanel'
import { hasDetector } from '../lib/missions'
import { useL } from '../lib/i18n'

// SPHEREx sees 0.75–5.0 µm with six detector arrays. The ruler is the detector picker:
// each segment is as wide as the wavelength range it covers, so "same detector" reads as
// "same part of the spectrum". Segments the current visit lacks are hollow.
const SPAN: Record<number, [number, number]> = { 1: [0.75, 1.09], 2: [1.1, 1.62], 3: [1.63, 2.41], 4: [2.42, 3.82], 5: [3.83, 4.41], 6: [4.42, 5.0] }
const LO = 0.75, HI = 5.0
const TICKS = [1, 2, 3, 4, 5]

export function SpectralRuler({ meta, visit, det, onPick, disabled }: { meta: TargetMeta; visit: number; det: number; onPick: (d: number) => void; disabled?: boolean }) {
  const L = useL()
  const any = (d: number) => meta.visits.some((_, i) => hasDetector(meta, i, d))
  return (
    <div className={`ruler${disabled ? ' ruler-off' : ''}`} role="radiogroup" aria-label={L('검출기(파장) 선택', 'Detector (wavelength) picker')} data-testid="spectral-ruler" data-tutorial="analysis-wavelength">
      <button role="radio" aria-checked={det === 0} className={`ruler-all${det === 0 ? ' on' : ''}`} onClick={() => onPick(0)} disabled={disabled} data-testid="det-0">
        {L('전체', 'All')}
      </button>
      <div className="ruler-track">
        <div className="ruler-bar">
          {[1, 2, 3, 4, 5, 6].map((d) => {
            const [a, b] = SPAN[d]
            const here = hasDetector(meta, visit, d)
            return (
              <button
                key={d}
                role="radio"
                aria-checked={det === d}
                aria-label={`D${d} ${DETECTORS[d].range}${here ? '' : L(' (이 관측에는 없음)', ' (not in this visit)')}`}
                title={`D${d} · ${DETECTORS[d].range}${here ? '' : L(' · 이 관측에는 없음', ' · not in this visit')}`}
                className={`seg-d${det === d ? ' on' : ''}${here ? '' : ' absent'}`}
                style={{ flexGrow: b - a, ['--c' as string]: DETECTORS[d].color }}
                disabled={disabled || !any(d)}
                onClick={() => onPick(d)}
                data-testid={`det-${d}`}
              >
                D{d}
              </button>
            )
          })}
        </div>
        <div className="ruler-axis" aria-hidden>
          {TICKS.map((t) => <span key={t} className={t === HI ? 'last' : ''} style={{ left: `${((t - LO) / (HI - LO)) * 100}%` }}>{t === HI ? `${t} µm` : t}</span>)}
        </div>
      </div>
    </div>
  )
}
