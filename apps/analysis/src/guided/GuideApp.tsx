import {lazy,Suspense,useEffect,useState} from 'react'
import type {TargetMeta} from '../types'
import {isMock,loadMeta} from '../lib/data'
import type {Frame} from '../lib/frames'
import {loadPair,makeMotionPair} from './motion'
import type {MotionPair} from './motion'
import {MotionViewer} from './MotionViewer'
import {SpectrumViewer} from './SpectrumViewer'
import {makeSpectralSeries} from './spectra'
import type {SpectrumSeries} from './spectra'
import {EXPLORATIONS,explorationFromUrl} from './explorations'
import type {Exploration} from './explorations'
import {Icon} from './Icons'
import {langMessage,readStoredLang} from '../lib/lang'
import {stageMessage} from '../lib/integration'
import './guided.css'
import '../apogee-skin.css'

const LegacyApp=lazy(()=>import('../App'))
type Ready={kind:'motion';meta:TargetMeta;pair:MotionPair;frames:[Frame,Frame]}|{kind:'spectrum';meta:TargetMeta;series:[SpectrumSeries,SpectrumSeries]}
const currentLang=():'ko'|'en'=>{const p=new URLSearchParams(location.search).get('lang');return p==='ko'||p==='en'?p:readStoredLang()}
const embedded=()=>new URLSearchParams(location.search).get('embed')==='1'
export function GuideHeader({free=false,mission=EXPLORATIONS[0]}:{free?:boolean;mission?:Exploration}) {
 const en=currentLang()==='en',emb=embedded()?'&embed=1':''
 const freeUrl=`?experience=free&target=${mission.target}${mission.kind==='spectrum'?'&mode=research&tab=spectrum':''}${emb}`
 const guidedUrl=`?experience=guided${emb}`
 return <header className="g-header"><a className="g-brand" href={guidedUrl} aria-label={en?'Armchair Astronomer, guided explorations':'방구석 천문학자 안내형 탐구'}><span className="g-brand-orbit"/><span>{en?'Armchair Astronomer':'방구석 천문학자'}</span></a><nav aria-label={en?'Exploration mode':'탐구 모드'}><a className={!free?'g-nav-active':''} href={guidedUrl} onClick={e=>{if(!free)e.preventDefault()}} aria-current={!free?'page':undefined}>{en?<>Guided <span lang="ko">(한국어)</span></>:'안내형 탐구'}</a><a className={free?'g-nav-active':''} href={freeUrl} onClick={e=>{if(free)e.preventDefault()}} aria-current={free?'page':undefined}>{en?'Free observation':'자유 관측'}</a></nav></header>
}
/** Inside the site: the guided explorations are Korean for now, so an English screen opens the free observation unless guided is asked for. */
export default function GuideApp() {
 const params=new URLSearchParams(location.search),exp=params.get('experience')
 const wantsFree=exp==='free'||params.get('view')==='sky'||params.has('sky')||params.has('ra')||params.has('q')||params.has('mode')||params.has('tab')
 const wantsGuided=exp==='guided'||params.has('mission')
 const lang=currentLang(),free=wantsFree||(!wantsGuided&&lang==='en')
 useEffect(()=>{
  if(free)return
  // The portal's header sends these; the free observation handles them itself.
  const onMessage=(e:MessageEvent)=>{
   if(e.origin!==location.origin||e.source!==window.parent)return
   if(stageMessage(e.data)==='sky'){const u=new URL(location.href);u.search=embedded()?'?view=sky&embed=1':'?view=sky';location.replace(u.href);return}
   const next=langMessage(e.data)
   if(next&&next!==lang&&!wantsGuided)location.reload()
  }
  window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage)
 },[])
 const mission=EXPLORATIONS.find(m=>m.target===params.get('target')&&m.kind===(params.get('tab')==='spectrum'?'spectrum':'motion'))??EXPLORATIONS[0]
 return free?<><GuideHeader free mission={mission}/><Suspense fallback={<p className="g-loading">{lang==='en'?'Opening the tools…':'분석 도구를 여는 중…'}</p>}><LegacyApp/></Suspense></>:<GuidedExplorations/>
}
function GuidedExplorations() {
 const [mission,setMission]=useState(()=>explorationFromUrl(location.search)),[resetKey,setResetKey]=useState(0)
 const index=EXPLORATIONS.findIndex(m=>m.id===mission.id)
 useEffect(()=>{document.title=`방구석 천문학자 · ${mission.title}`;document.documentElement.lang='ko'},[mission])
 useEffect(()=>{const restore=()=>{setMission(explorationFromUrl(location.search));setResetKey(0)};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)},[])
 function select(next:Exploration) {
  if(next.id===mission.id)return
  const url=new URL(location.href);url.searchParams.set('mission',next.id);history.pushState(null,'',url)
  setMission(next);setResetKey(0)
  if(window.matchMedia('(max-width:1020px)').matches)window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})
 }
 return <div className="g-app g-simple-app"><GuideHeader mission={mission}/><main className="g-main">
  <div className="g-context"><div><h1>{mission.title} <span>{mission.name}</span></h1><p>{mission.question}</p></div></div>
  <div className="g-workspace">
   <ExplorationData key={`${mission.id}:${resetKey}`} mission={mission}/>
   <aside className="g-guide g-mission-guide" aria-label="안내형 탐구 선택">
    <nav className="g-mission-list" aria-label="다섯 가지 탐구">{(['motion','spectrum'] as const).map(kind=><div key={kind} className="g-mission-group"><h2>{kind==='motion'?'이동 탐구':'분광 탐구'}</h2>{EXPLORATIONS.filter(m=>m.kind===kind).map(m=>{const i=EXPLORATIONS.indexOf(m);return <button key={m.id} className={m.id===mission.id?'g-mission-current':''} aria-current={m.id===mission.id?'page':undefined} onClick={()=>select(m)}><span className="g-mission-number">{String(i+1).padStart(2,'0')}</span><span><strong>{m.name}</strong><small>{m.title}</small></span><Icon name="chevron" size={16}/></button>})}</div>)}</nav>
    
    <div className="g-guide-bottom"><button className="g-primary" onClick={()=>select(EXPLORATIONS[(index+1)%EXPLORATIONS.length])}>{index===EXPLORATIONS.length-1?'첫 탐구로':'다음 탐구'}<Icon name="arrow" size={17}/></button><div className="g-bottom-links"><button disabled={index===0} onClick={()=>select(EXPLORATIONS[index-1])}>← 이전 탐구</button><button onClick={()=>setResetKey(k=>k+1)}><Icon name="reset" size={16}/>보기 초기화</button></div></div>
   </aside>
  </div>
 </main></div>
}
function ExplorationData({mission}:{mission:Exploration}) {
 const [ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  ;(async()=>{
   if(isMock)throw Error('실제 관측 자료로 열어 주세요. 주소의 mock 옵션을 제거하면 됩니다.')
   const meta=await loadMeta(mission.target,controller.signal)
   if(mission.kind==='motion'){
    const pair=makeMotionPair(meta),frames=await loadPair(meta,pair,controller.signal)
    if(!controller.signal.aborted)setReady({kind:'motion',meta,pair,frames})
   }else{
    const series=makeSpectralSeries(meta,mission.visits!)
    if(!controller.signal.aborted)setReady({kind:'spectrum',meta,series})
   }
  })().catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e))})
  return()=>controller.abort()
 },[mission,retry])
 if(!ready)return <section className="g-viewer g-load-screen" aria-busy={!error} aria-live="polite"><Icon name="star" size={28}/><h2>{error?'관측 자료를 열지 못했어요':'관측 자료를 여는 중이에요'}</h2><p>{error||mission.name}</p>{error&&<button onClick={()=>{setReady(null);setError('');setRetry(r=>r+1)}}>다시 불러오기</button>}</section>
 return ready.kind==='motion'?<MotionViewer {...ready}/>:<SpectrumViewer {...ready}/>
}
