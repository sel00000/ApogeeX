import type { Provenance } from '../types'
import { useL } from '../lib/i18n'

const LABEL: Record<Provenance, [string, string]> = {
  spherex: ['SPHEREx 측정', 'SPHEREx measured'],
  catalog: ['외부 카탈로그', 'External catalogue'],
  model: ['계산·모델', 'Computed · model'],
}

export function Badge({ kind, detail }: { kind: Provenance; detail?: string }) {
  const L = useL()
  return (
    <span className={`badge badge-${kind}`} title={detail}>
      {L(...LABEL[kind])}
      {detail ? `: ${detail}` : ''}
    </span>
  )
}
