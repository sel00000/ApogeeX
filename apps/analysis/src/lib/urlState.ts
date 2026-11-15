// Share link: the view lives in the URL (idea from TrueBlink), so a copied link reopens it.
import type { AnalysisTab, Lang, StageView, UiMode } from '../store'
import { notifyAnalysisURL } from './integration'
import { initialLang } from './lang'
import { formatSkyParam, parseSkyParam } from './skyView'
import type { SkyParam } from './skyView'

const TABS: AnalysisTab[] = ['motion', 'variable', 'spectrum', 'provenance']

export function readView(): { ui: UiMode; tab: AnalysisTab | null; visit: number | null; lang: Lang; stage: StageView; sky: SkyParam | null } {
  const q = new URLSearchParams(window.location.search)
  const tab = q.get('tab') as AnalysisTab | null
  const v = Number(q.get('visit'))
  return {
    ui: q.get('mode') === 'research' ? 'research' : 'explore',
    tab: tab && TABS.includes(tab) ? tab : null,
    visit: Number.isInteger(v) && v > 0 ? v - 1 : null,
    // English by default (spec D1); inside the portal the shared key decides, never the URL
    lang: initialLang(window.location.search, q.get('embed') === '1'),
    stage: q.get('view') === 'sky' ? 'sky' : 'workbench',
    // the Find globe's centre and field: its own parameter, never the `ra`/`dec` of a coordinate search
    sky: parseSkyParam(q.get('sky')),
  }
}

export function writeView(p: { ui?: UiMode; tab?: AnalysisTab | null; visit?: number | null; lang?: Lang; stage?: StageView; sky?: { ra: number; dec: number; fovDeg: number } | null }) {
  const u = new URL(window.location.href)
  if (p.ui !== undefined) { if (p.ui === 'research') u.searchParams.set('mode', 'research'); else u.searchParams.delete('mode') }
  if (p.tab !== undefined) { if (p.tab) u.searchParams.set('tab', p.tab); else u.searchParams.delete('tab') }
  if (p.visit !== undefined) { if (p.visit !== null) u.searchParams.set('visit', String(p.visit + 1)); else u.searchParams.delete('visit') }
  // only Korean is written (a missing lang means English); inside the portal the language is not in the URL
  if (p.lang !== undefined) { if (p.lang === 'ko' && u.searchParams.get('embed') !== '1') u.searchParams.set('lang', 'ko'); else u.searchParams.delete('lang') }
  if (p.stage !== undefined) { if (p.stage === 'sky') u.searchParams.set('view', 'sky'); else u.searchParams.delete('view') }
  if (p.sky !== undefined) { if (p.sky) u.searchParams.set('sky', formatSkyParam(p.sky)); else u.searchParams.delete('sky') }
  window.history.replaceState(null, '', u)
  notifyAnalysisURL(u.href)
}
