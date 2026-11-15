import {useEffect,useId,useMemo,useState} from 'react'
import type {TargetMeta} from '../types'
import type {SpectrumPoint,SpectrumSeries} from './spectra'
import {wavelengthExtent} from './spectra'
import {clamp} from './interaction'
import type {CSSProperties} from 'react'

const DESK={W:880,H:430,M:{l:78,r:24,t:28,b:62}},NARROW={W:420,H:380,M:{l:70,r:18,t:22,b:64}}
const NARROW_Q='(max-width:640px)'
function useNarrow(){const [n,setN]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia(NARROW_Q).matches);useEffect(()=>{const q=matchMedia(NARROW_Q),on=()=>setN(q.matches);q.addEventListener('change',on);return()=>q.removeEventListener('change',on)},[]);return n}
const COLORS=['#f4f2ee','#e9c48f']
const fmt=(n:number)=>Math.abs(n)>=100?n.toFixed(1):Math.abs(n)>=1?n.toFixed(2):n.toFixed(3)
function ticks(lo:number,hi:number) {
 const raw=(hi-lo)/5,power=10**Math.floor(Math.log10(raw)),step=([1,2,5,10].find(v=>v>=raw/power)??10)*power
 const out:number[]=[];for(let n=Math.ceil(lo/step)*step;n<=hi+step*.001;n+=step)out.push(n)
 return out
}
export function SpectrumViewer({meta,series,hideVisitControl=false,mode:externalMode,onModeChange,allowCompare=true}:{meta:TargetMeta;series:[SpectrumSeries,SpectrumSeries];hideVisitControl?:boolean;mode?:'single'|'compare';onModeChange?:(mode:'single'|'compare')=>void;allowCompare?:boolean}) {
 const [localMode,setLocalMode]=useState<'single'|'compare'>('single'),[current,setCurrent]=useState<0|1>(0),[selectedId,setSelectedId]=useState<string|null>(null)
 const {W,H,M}=useNarrow()?NARROW:DESK
 const mode=externalMode??localMode,setMode=onModeChange??setLocalMode
 const clipId=useId().replaceAll(':','')
 const all=useMemo(()=>series.flatMap(s=>s.points),[series])
 const visible=mode==='compare'?all:series[current].points
 const selected=visible.find(p=>p.id===selectedId)??series[current].points[Math.floor(series[current].points.length/2)]
 const [x0,x1]=wavelengthExtent(series)
 const lower=Math.min(0,...all.map(p=>p.flux-p.err)),upper=Math.max(...all.map(p=>p.flux+p.err)),pad=Math.max((upper-lower)*.1,.01)
 const y0=lower-pad*.35,y1=upper+pad
 const X=(v:number)=>M.l+(v-x0)/(x1-x0)*(W-M.l-M.r),Y=(v:number)=>M.t+(1-(v-y0)/(y1-y0))*(H-M.t-M.b)
 const pickWave=(wave:number)=>{const candidates=series[selected.epoch].points;setSelectedId(candidates.reduce((best,p)=>Math.abs(p.wave-wave)<Math.abs(best.wave-wave)?p:best,candidates[0]).id)}
 const pointAt=(e:{clientX:number;clientY:number},svg:SVGSVGElement)=>{
  const matrix=svg.getScreenCTM();if(!matrix)return
  const {x,y}=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse())
  if(x<M.l||x>W-M.r||y<M.t||y>H-M.b)return
  const nearest=visible.reduce((best,p)=>Math.hypot(X(p.wave)-x,Y(p.flux)-y)<Math.hypot(X(best.wave)-x,Y(best.flux)-y)?p:best,visible[0]);setSelectedId(nearest.id)
 }
 const movePoint=(key:string)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(key))return false;const ordered=[...visible].sort((a,b)=>a.wave-b.wave),i=ordered.findIndex(p=>p.id===selected.id);setSelectedId(ordered[key==='Home'?0:key==='End'?ordered.length-1:clamp(i+(key==='ArrowLeft'||key==='ArrowDown'?-1:1),0,ordered.length-1)].id);return true}
 const select=(epoch:0|1)=>{setCurrent(epoch);setSelectedId(null)}
 const color=(p:SpectrumPoint)=>COLORS[p.epoch]
 return <section className="g-spectrum-viewer" aria-label={`${meta.display_name} 분광 탐구`}>
  <div className="g-spectrum-panel">
   <div className="g-panel-head"><span>SPHEREx 스펙트럼 <i className="g-real-dot"/></span><span className="g-spectrum-range">{Math.min(...all.map(p=>p.wave)).toFixed(2)}–{Math.max(...all.map(p=>p.wave)).toFixed(2)} μm</span></div>
   <div className="g-spectrum-tools"><div className="g-segment" role="group" aria-label="분광 보기 방식"><button aria-pressed={mode==='single'} onClick={()=>setMode('single')}>한 장</button><button disabled={!allowCompare} aria-pressed={mode==='compare'} onClick={()=>setMode('compare')}>비교</button></div><div className="g-spectrum-legend">{series.filter(s=>mode==='compare'||s.epoch===current).map(s=><span key={s.epoch}><i style={{background:COLORS[s.epoch]}}/>{s.epoch?'B':'A'} · {s.label}</span>)}</div></div>
   <div className="g-spectrum-readout" aria-live="polite"><span className={`g-readout-epoch ${selected.epoch?'is-b':'is-a'}`}>관측 {selected.epoch?'B':'A'}</span><div><span>파장</span><strong>{selected.wave.toFixed(3)} <small>μm</small></strong></div><div><span>밝기</span><strong>{fmt(selected.flux)} <small>mJy</small></strong></div><div><span>측광 오차 ±</span><strong>{fmt(selected.err)} <small>mJy</small></strong></div></div>
   <svg className="g-spectrum-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${meta.display_name} 실제 관측 스펙트럼. 점과 오차 막대를 표시합니다. 방향키로 관측점을 이동합니다.`} tabIndex={0}
    onPointerMove={e=>{if(e.pointerType!=='touch'||e.buttons)pointAt(e,e.currentTarget)}} onPointerDown={e=>pointAt(e,e.currentTarget)}
    onKeyDown={e=>{if(movePoint(e.key))e.preventDefault()}}>
    <defs><clipPath id={clipId}><rect x={M.l} y={M.t} width={W-M.l-M.r} height={H-M.t-M.b}/></clipPath></defs>
    {ticks(y0,y1).map(v=><g key={v}><line x1={M.l} x2={W-M.r} y1={Y(v)} y2={Y(v)} className="g-chart-grid"/><text x={M.l-13} y={Y(v)+5} textAnchor="end" className="g-chart-tick">{Math.abs(v)>=10?v.toFixed(0):v.toPrecision(2)}</text></g>)}
    {ticks(x0,x1).map(v=><g key={v}><line x1={X(v)} x2={X(v)} y1={M.t} y2={H-M.b} className="g-chart-grid"/><text x={X(v)} y={H-M.b+27} textAnchor="middle" className="g-chart-tick">{v.toFixed(x1-x0<1?2:1)}</text></g>)}
    <text x={(M.l+W-M.r)/2} y={H-9} textAnchor="middle" className="g-chart-label">파장 (μm)</text><text transform={`translate(21 ${(M.t+H-M.b)/2}) rotate(-90)`} textAnchor="middle" className="g-chart-label">밝기 Fν (mJy)</text>
    <g clipPath={`url(#${clipId})`}>
     <line x1={X(selected.wave)} x2={X(selected.wave)} y1={M.t} y2={H-M.b} className="g-chart-ruler"/>
     {visible.map(p=><g key={p.id} className="g-spectrum-point" data-epoch={p.epoch} data-wave={p.wave} data-flux={p.flux}>
      <line x1={X(p.wave)} x2={X(p.wave)} y1={Y(p.flux-p.err)} y2={Y(p.flux+p.err)} stroke={color(p)} opacity=".55"/>
      <line x1={X(p.wave)-3} x2={X(p.wave)+3} y1={Y(p.flux-p.err)} y2={Y(p.flux-p.err)} stroke={color(p)} opacity=".55"/><line x1={X(p.wave)-3} x2={X(p.wave)+3} y1={Y(p.flux+p.err)} y2={Y(p.flux+p.err)} stroke={color(p)} opacity=".55"/>
      <circle cx={X(p.wave)} cy={Y(p.flux)} r={p.id===selected.id?5.4:3.5} fill={color(p)} opacity={p.id===selected.id?1:.8}/>
     </g>)}
     <circle cx={X(selected.wave)} cy={Y(selected.flux)} r="11" className="g-chart-selected"/>
    </g>
   </svg>
   <div className="g-wave-control"><span>파장 살펴보기</span><input type="range" aria-label="스펙트럼 파장 선택" min={x0} max={x1} step="any" aria-valuetext={`${selected.wave.toFixed(3)} μm, 관측 ${selected.epoch?'B':'A'}`} onKeyDown={e=>{if(movePoint(e.key))e.preventDefault()}} value={selected.wave} onChange={e=>pickWave(+e.target.value)}/><output>{selected.wave.toFixed(2)} μm</output></div>
  </div>
  {!hideVisitControl&&<div className="g-player g-spectrum-player"><div className="g-transport-caption"><strong>{mode==='compare'?'A + B 비교':`관측 ${current?'B':'A'}`}</strong></div><div className="g-time-scrubber"><div>{series.map(s=><button key={s.epoch} className={current===s.epoch?'selected':''} aria-pressed={current===s.epoch} onClick={()=>select(s.epoch)}>{s.epoch?'B':'A'} <span>{s.label}</span></button>)}</div><input type="range" min={0} max={100} step={100} value={current*100} aria-label="분광 관측 선택" aria-valuetext={`관측 ${current?'B':'A'} ${series[current].label}`} onChange={e=>select(+e.target.value<50?0:1)} style={{'--g-progress':`${current*100}%`} as CSSProperties}/></div></div>}
 </section>
}
