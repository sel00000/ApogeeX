import type {AnalysisTab} from '../store'

/** One resolved tab shared by the workspace navigation, content and URL. */
export function normalizeAnalysisTab(target:string,wanted:AnalysisTab|null,isPatch=false):AnalysisTab {
 if(isPatch)return 'provenance'
 if(wanted==='variable'&&!['rw_aur','r_dra'].includes(target))return 'motion'
 return wanted??'motion'
}
