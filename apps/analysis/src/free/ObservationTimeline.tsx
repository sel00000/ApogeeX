import type {CSSProperties} from 'react'
import type {TargetMeta} from '../types'
import {useTime,visitIndexAt} from '../store'
import {useL} from '../lib/i18n'

/** A discrete visit selector: no synthetic observation between dates. */
export function ObservationTimeline({meta}:{meta:TargetMeta}) {
 const L=useL(),t=useTime(s=>s.tMjd),playing=useTime(s=>s.playing),fps=useTime(s=>s.blinkFps)
 const {stop,play,goToVisit,setBlinkFps}=useTime.getState(),k=visitIndexAt(meta,t),last=meta.visits.length-1
 const seek=(i:number)=>{stop();goToVisit(meta,i)}
 return <section className="fw-timeline" aria-label={L('관측 시간 선택','Observation time')} data-testid="timeline" data-tutorial="analysis-timeline">
  <div className="fw-transport"><button aria-label={L('이전 관측','Previous observation')} disabled={k===0} onClick={()=>seek(k-1)}>‹</button><button className="fw-play" aria-label={playing?L('재생 멈추기','Pause'):L('관측 재생','Play observations')} aria-pressed={playing} onClick={()=>playing?stop():play('blink')}>{playing?'Ⅱ':'▶'}</button><button aria-label={L('다음 관측','Next observation')} disabled={k===last} onClick={()=>seek(k+1)}>›</button></div>
  <div className="fw-now"><span>{L('관측','Observation')} {k+1} <i>/ {meta.visits.length}</i></span><strong data-testid="t-now">{meta.visits[k].utc.slice(0,10).replaceAll('-','.')} <small>UTC</small></strong></div>
  <div className="fw-time-track"><input type="range" min={0} max={last} step={1} value={k} disabled={!last} onChange={e=>seek(+e.target.value)} aria-label={L('관측 날짜 선택','Select observation date')} aria-valuetext={`${k+1} / ${meta.visits.length}, ${meta.visits[k].utc.slice(0,10)}`} style={{'--progress':`${last?k/last*100:0}%`} as CSSProperties}/><div><span>{meta.visits[0].utc.slice(0,10)}</span><span>{meta.visits[last].utc.slice(0,10)}</span></div></div>
  <label className="fw-speed"><span>{L('재생 속도','Speed')}</span><select value={fps} onChange={e=>setBlinkFps(+e.target.value)} aria-label={L('관측 재생 속도','Observation playback speed')}>{[.5,1,2,4,8].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
 </section>
}
