import {useMemo,useState} from 'react'
import type {TargetMeta} from '../types'
import {useTime,visitIndexAt} from '../store'
import {useL} from '../lib/i18n'
import {makeSpectrumSeries} from '../guided/spectra'
import type {SpectrumSeries} from '../guided/spectra'
import {SpectrumViewer} from '../guided/SpectrumViewer'
import {SpectrumLab} from '../components/SpectrumLab'

export function FreeSpectrum({meta}:{meta:TargetMeta}) {
 const L=useL(),current=useTime(s=>visitIndexAt(meta,s.tMjd))
 const available=useMemo(()=>meta.visits.flatMap((_,i)=>{try{return[makeSpectrumSeries(meta,i)]}catch{return[]}}),[meta])
 const [a,setA]=useState(()=>available.find(s=>s.visit===current)?.visit??available[0]?.visit??0)
 const [b,setB]=useState(()=>available.at(-1)?.visit??0)
 const [mode,setMode]=useState<'single'|'compare'>('single')
 const first=available.find(s=>s.visit===a)??available[0]
 const second=available.find(s=>s.visit===b&&s.visit!==first?.visit)??available.find(s=>s.visit!==first?.visit)??first
 const series=useMemo<[SpectrumSeries,SpectrumSeries]|null>(()=>first&&second?[first,{...second,epoch:1,points:second.points.map(p=>({...p,id:`b:${p.id}`,epoch:1}))}]:null,[first,second])
 if(!series)return <div className="fw-empty" data-testid="spectrum-unavailable"><span className="fw-empty-orbit" aria-hidden>∿</span><h2>{L('표시할 수 있는 분광 자료가 없어요','No usable spectrum for this target')}</h2><p>{L('포화와 측광 품질 조건을 통과한 관측점이 부족합니다. 다른 대상을 선택해 주세요.','Too few measurements pass the saturation and photometry quality checks. Choose another target.')}</p><button onClick={()=>{useTime.getState().setTarget('eps_indi_b');useTime.getState().setTab('spectrum')}}>{L('엡실론 인디 B 보기','View Epsilon Indi B')} →</button></div>
 const pickA=(visit:number)=>{if(visit===b)setB(a);setA(visit);useTime.getState().stop();useTime.getState().goToVisit(meta,visit)}
 return <div className="fw-spectrum g-app">
  <div className="fw-spectrum-selects"><label>{L('관측 기간','Observation period')}<select aria-label={L('분광 관측 기간','Spectrum observation period')} value={first.visit} onChange={e=>pickA(+e.target.value)}>{available.map(s=><option key={s.visit} value={s.visit}>{s.label} · {s.points.length} {L('점','points')}</option>)}</select></label>{mode==='compare'&&<label>{L('비교할 기간','Compare with')}<select aria-label={L('비교할 분광 관측 기간','Comparison spectrum period')} value={second.visit} onChange={e=>setB(+e.target.value)}>{available.map(s=><option key={s.visit} value={s.visit} disabled={s.visit===first.visit}>{s.label} · {s.points.length} {L('점','points')}</option>)}</select></label>}</div>
  <SpectrumViewer key={`${first.visit}:${second.visit}`} meta={meta} series={series} hideVisitControl mode={mode} onModeChange={setMode} allowCompare={available.length>1}/>
  <details className="fw-details fw-model-tools"><summary>{L('모형과 흡수대 도구','Models and absorption bands')}</summary><SpectrumLab meta={meta} compact/></details>
 </div>
}
