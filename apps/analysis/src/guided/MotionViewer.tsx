import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react'
import type {CSSProperties} from 'react'
import type {TargetMeta} from '../types'
import {autoStretch,toImageData} from '../lib/frames'
import type {Frame,Stretch} from '../lib/frames'
import {observationPeriod} from './motion'
import type {Mark,MotionPair} from './motion'
import {clamp,cropWindow,frameFromScrub} from './interaction'
import {Icon} from './Icons'
const TimeVolume=lazy(()=>import('./TimeVolume').then(m=>({default:m.TimeVolume})))
type Props={meta:TargetMeta;pair:MotionPair;frames:[Frame,Frame]}
type Mode='single'|'wipe'
type Crop=ReturnType<typeof cropWindow>
function ImageLayer({frame,n,stretch,crop,style}:{frame:Frame;n:number;stretch:Stretch;crop:Crop;style?:CSSProperties}) {
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return
  const source=document.createElement('canvas');source.width=source.height=n
  source.getContext('2d')!.putImageData(toImageData(frame,n,stretch),0,0)
  const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,720,720);ctx.imageSmoothingEnabled=false
  ctx.drawImage(source,crop.left,crop.top,crop.width,crop.width,0,0,720,720)
 },[frame,n,stretch,crop.left,crop.top,crop.width])
 return <canvas ref={ref} width={720} height={720} style={style} aria-hidden="true"/>
}
export function MotionViewer({meta,pair,frames}:Props) {
 const [mark,onMark]=useState<Mark|null>(null)
 const [mobilePane,setMobilePane]=useState<'image'|'space'>('image')
 const [current,setCurrent]=useState<0|1>(0),[running,setRunning]=useState(false),[mode,setMode]=useState<Mode>('single')
 const [zoom,setZoom]=useState(1),[hint,setHint]=useState(false),[wipe,setWipe]=useState(50),[tool,setTool]=useState<'mark'|'pan'>('mark')
 const n=meta.wcs.size_px[0]
 const [center,setCenter]=useState({x:n/2,y:n/2}),[hover,setHover]=useState<Mark|null>(null),[dragging,setDragging]=useState(false)
 const wipeGesture=useRef(false),gesture=useRef<{x:number;y:number;center:Mark;moved:boolean}|null>(null)
 const stretch=useMemo(()=>autoStretch(frames,n,{x0:0,y0:0,w:n},-.5),[frames,n])
 const crop=cropWindow(n,zoom,center)
 const period=[observationPeriod(meta,pair.a,pair.detector),observationPeriod(meta,pair.b,pair.detector)]
 const expected=[meta.visits[pair.a].pred_px,meta.visits[pair.b].pred_px]
 useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setCurrent(c=>c===0?1:0),1000);return()=>clearInterval(id)},[running])
 useEffect(()=>{const stop=()=>{if(document.hidden)setRunning(false)};document.addEventListener('visibilitychange',stop);return()=>document.removeEventListener('visibilitychange',stop)},[])
 const select=(v:0|1)=>{setRunning(false);setCurrent(v);setMode('single')}
 const changeMode=(m:Mode)=>{setRunning(false);setMode(m)}
 const position=(p:readonly number[])=>({left:`${(p[0]-crop.left)/crop.width*100}%`,top:`${(p[1]-crop.top)/crop.width*100}%`})
 const inView=(p:Mark)=>p.x>=crop.left&&p.x<=crop.left+crop.width&&p.y>=crop.top&&p.y<=crop.top+crop.width
 const pointer=(e:{clientX:number;clientY:number},element:HTMLElement)=>{const r=element.getBoundingClientRect();return{x:crop.left+clamp((e.clientX-r.left)/r.width,0,1)*crop.width,y:crop.top+clamp((e.clientY-r.top)/r.height,0,1)*crop.width}}
 const changeWipe=(value:number)=>{setWipe(clamp(value,3,97))}
 const plate=(index:0|1,compare=false)=><div className={`g-plate${tool==='pan'?' g-pan':''}${dragging?' g-dragging':''}`} tabIndex={0} role="img" aria-label={`실제 SPHEREx 관측 ${compare?'A/B 비교':index===0?'A':'B'}. Enter로 위치 선택, 방향키로 선택 이동.`}
  onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);gesture.current={x:e.clientX,y:e.clientY,center:{...center},moved:false};setDragging(true)}}
  onPointerMove={e=>{const p=pointer(e,e.currentTarget);setHover(p);const g=gesture.current;if(!g)return;const rect=e.currentTarget.getBoundingClientRect(),dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>3)g.moved=true;if(tool==='pan'){const half=crop.width/2;setCenter({x:clamp(g.center.x-dx/rect.width*crop.width,half,n-half),y:clamp(g.center.y-dy/rect.height*crop.width,half,n-half)})}else if(g.moved)onMark(p)}}
  onPointerUp={e=>{const g=gesture.current;if(g&&tool==='mark')onMark(pointer(e,e.currentTarget));gesture.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
  onPointerCancel={()=>{gesture.current=null;setDragging(false)}} onPointerLeave={()=>{if(!gesture.current)setHover(null)}}
  onKeyDown={e=>{if(!['Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){onMark(null);return}const p=mark??{x:center.x,y:center.y};onMark({x:clamp(e.key==='Enter'?center.x:p.x+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0),crop.left,crop.left+crop.width),y:clamp(e.key==='Enter'?center.y:p.y+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0),crop.top,crop.top+crop.width)})}}>
   <ImageLayer frame={frames[compare?1:index]} n={n} stretch={stretch} crop={crop}/>
   {compare&&<ImageLayer frame={frames[0]} n={n} stretch={stretch} crop={crop} style={{clipPath:`inset(0 ${100-wipe}% 0 0)`}}/>}
   <span className="g-image-corner"><i>{compare?'A':index===0?'A':'B'}</i>{period[compare?0:index].label}</span>
   {compare&&<span className="g-image-corner g-corner-right"><i>B</i>{period[1].label}</span>}
   <span className="g-compass">N ↑<br/>E ←</span>
   <div className="g-scale" style={{width:`${30/meta.wcs.cdelt_arcsec/crop.width*100}%`}}><span>30″</span><i/></div>
   {hover&&inView(hover)&&<span className="g-cursor-ring" style={position([hover.x,hover.y])}/>}
   {hint&&<div className="g-search-region" style={{...position([(expected[0][0]+expected[1][0])/2,(expected[0][1]+expected[1][1])/2]),width:`${8/crop.width*100}%`,height:`${8/crop.width*100}%`}}><span>예상 위치 주변</span></div>}
   {mark&&inView(mark)&&<span className="g-user-mark" style={position([mark.x,mark.y])}><i/><small>선택</small></span>}
   {hint&&expected.map((p,i)=>inView({x:p[0],y:p[1]})&&<span key={i} className={`g-pred-mark ${i?'pred-b':'pred-a'}`} style={position(p)}><small>예상 {i?'B':'A'}</small></span>)}
   {compare&&<div className="g-wipe-handle" style={{left:`${wipe}%`}} role="slider" tabIndex={0} aria-label="A B 영상 비교 경계" aria-valuemin={3} aria-valuemax={97} aria-valuenow={Math.round(wipe)} aria-valuetext={`왼쪽 A ${Math.round(wipe)}%, 오른쪽 B ${Math.round(100-wipe)}%`}
    onPointerDown={e=>{e.stopPropagation();e.preventDefault();wipeGesture.current=true;e.currentTarget.setPointerCapture(e.pointerId)}}
    onPointerMove={e=>{if(!wipeGesture.current)return;e.stopPropagation();const r=e.currentTarget.parentElement!.getBoundingClientRect();changeWipe((e.clientX-r.left)/r.width*100)}}
    onPointerUp={e=>{e.stopPropagation();wipeGesture.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{wipeGesture.current=false}}
    onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.stopPropagation();e.preventDefault();changeWipe(e.key==='Home'?3:e.key==='End'?97:wipe+(e.key==='ArrowLeft'?-5:5))}}><span>↔</span></div>}
  </div>
 return <section className="g-viewer" aria-label="관측 영상과 시간 모형">
  <div className="g-mobile-views" role="group" aria-label="관측 화면 선택"><button aria-pressed={mobilePane==='image'} onClick={()=>setMobilePane('image')}>관측 영상</button><button aria-pressed={mobilePane==='space'} onClick={()=>setMobilePane('space')}>3D 시공간</button><span>두 화면 연결됨</span></div>
  <div className={`g-lab-panes g-mobile-${mobilePane}`}><section className="g-sky-panel"><div className="g-panel-head"><span>SPHEREx가 찍은 영상 <i className="g-real-dot"/></span><span className="g-live-period">{mode==='single'?`${current?'B':'A'} · ${period[current].label}`:'A / B 비교 중'}</span></div>
   <div className="g-viewer-tools"><div className="g-segment" role="group" aria-label="비교 방식"><button aria-pressed={mode==='single'} onClick={()=>changeMode('single')}>한 장</button><button aria-pressed={mode==='wipe'} onClick={()=>changeMode('wipe')}>비교</button></div><button className="g-hint-button" aria-pressed={hint} onClick={()=>setHint(h=>!h)}><Icon name="eye" size={14}/>위치 안내</button></div>
   <div className="g-image-stage">{plate(current,mode==='wipe')}{mode==='wipe'&&<div className="g-image-instruction">손잡이를 좌우로 움직여 보세요</div>}</div>
   <div className="g-canvas-toolbar"><div className="g-pointer-tools" role="group" aria-label="영상 도구"><button aria-pressed={tool==='mark'} onClick={()=>setTool('mark')}><Icon name="star" size={14}/>선택</button><button aria-pressed={tool==='pan'} onClick={()=>setTool('pan')}>↔ 이동</button>{mark&&<button onClick={()=>onMark(null)} aria-label="선택 해제" title="선택 해제"><Icon name="reset" size={16}/></button>}</div><label><span>확대</span><input type="range" min={1} max={3} step={.25} value={zoom} onChange={e=>setZoom(+e.target.value)} aria-label="관측 영상 확대"/><output>{zoom.toFixed(1)}×</output></label></div>
  </section><Suspense fallback={<section className="g-time-panel g-load-screen"><p>시공간 모형을 준비하는 중…</p></section>}><TimeVolume meta={meta} pair={pair} frames={frames} stretch={stretch} current={current} mark={mark} reveal={hint} both={mode!=='single'} onSelect={select}/></Suspense></div>
  <div className="g-player"><button className="g-play-circle" onClick={()=>{setMode('single');setRunning(r=>!r);if(!running){setCurrent(1)}}} aria-label={running?'비교 멈추기':'번갈아 보기'} aria-pressed={running}><Icon name={running?'pause':'play'} size={19}/></button><div className="g-transport-caption"><strong>관측 {current?'B':'A'}</strong></div><div className="g-time-scrubber"><div><button className={current===0?'selected':''} onClick={()=>select(0)}>A <span>{period[0].label}</span></button><button className={current===1?'selected':''} onClick={()=>select(1)}>B <span>{period[1].label}</span></button></div><input type="range" min={0} max={100} step={100} value={current*100} aria-label="관측 시간 이동" aria-valuetext={`관측 ${current?'B':'A'} ${period[current].label}`} onChange={e=>select(frameFromScrub(+e.target.value))} style={{'--g-progress':`${current*100}%`} as CSSProperties}/></div></div>

 </section>
}
