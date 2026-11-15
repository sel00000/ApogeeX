import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {TargetMeta} from '../types'
import {toImageData} from '../lib/frames'
import type {Frame,Stretch} from '../lib/frames'
import type {Mark,MotionPair} from './motion'
import {day,observationPeriod} from './motion'
import {Icon} from './Icons'

type State={current:0|1;mark:Mark|null;reveal:boolean;both:boolean}
type Props=State&{meta:TargetMeta;pair:MotionPair;frames:[Frame,Frame];stretch:Stretch;onSelect:(frame:0|1)=>void}
export function TimeVolume({meta,pair,frames,stretch,current,mark,reveal,both,onSelect}:Props) {
 const host=useRef<HTMLDivElement>(null),api=useRef<{update:(s:State)=>void;reset:()=>void}|null>(null)
 const selectRef=useRef(onSelect)
 useEffect(()=>{selectRef.current=onSelect},[onSelect])
 const [error,setError]=useState(false)
 const periods=[observationPeriod(meta,pair.a,pair.detector),observationPeriod(meta,pair.b,pair.detector)]
 useEffect(()=>{
  const element=host.current;if(!element)return
  let renderer:THREE.WebGLRenderer
  // oxlint-disable-next-line react/set-state-in-effect -- WebGL capability is discovered during external renderer setup.
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch{setError(true);return}
  // oxlint-disable-next-line react/set-state-in-effect -- Clear a previous renderer capability error after successful external setup.
  setError(false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x090c12,0)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  element.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-label','두 관측 영상을 시간 높이로 쌓은 모형. 드래그로 회전, 방향키로 회전, Home으로 초기화.')
  renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100)
  const start=new THREE.Vector3(3.7,3.2,4.8);camera.position.copy(start)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.72,0)
  controls.enablePan=false;controls.enableDamping=false;controls.minDistance=3.2;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.85
  const render=()=>renderer.render(scene,camera)
  const resources:(THREE.BufferGeometry|THREE.Material|THREE.Texture)[]=[]
  const heights=[0,1.55],n=meta.wcs.size_px[0],size=2.6
  const world=(p:readonly number[],index:number)=>new THREE.Vector3((p[0]/n-.5)*size,heights[index]+.03,(p[1]/n-.5)*size)
  function line(points:THREE.Vector3[],color:number,dashed=false) {
   const geometry=new THREE.BufferGeometry().setFromPoints(points)
   const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.055,gapSize:.045,transparent:true,opacity:.6}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.8})
   const object=new THREE.Line(geometry,material);if(dashed)object.computeLineDistances();scene.add(object);resources.push(geometry,material);return object
  }
  const borders:THREE.Line[]=[];const meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[]
  for(const [i,frame] of frames.entries()){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=n;canvas.getContext('2d')!.putImageData(toImageData(frame,n,stretch),0,0)
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter
   const geometry=new THREE.PlaneGeometry(size,size),material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false,toneMapped:false})
   const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=heights[i];mesh.userData.frame=i;scene.add(mesh);meshes.push(mesh);resources.push(texture,geometry,material)
   borders.push(line([[-size/2,-size/2],[size/2,-size/2],[size/2,size/2],[-size/2,size/2],[-size/2,-size/2]].map(([x,z])=>new THREE.Vector3(x,heights[i],z)),0x58606b))
  }
  for(const x of [-size/2,size/2])for(const z of [-size/2,size/2])line([new THREE.Vector3(x,0,z),new THREE.Vector3(x,heights[1],z)],0x49515b,true)
  const grid=new THREE.GridHelper(4.5,18,0x343943,0x1a2029);grid.position.y=-.08;scene.add(grid);resources.push(grid.geometry,...(Array.isArray(grid.material)?grid.material:[grid.material]))
  const axis=line([new THREE.Vector3(-1.65,-.1,0),new THREE.Vector3(-1.65,2.15,0)],0x8c7962)
  const userMarkers:THREE.Mesh[]=[],predMarkers:THREE.Mesh[]=[]
  for(let i=0;i<2;i++){
   const geometry=new THREE.RingGeometry(.078,.108,32),material=new THREE.MeshBasicMaterial({color:0xf2cf6b,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true})
   const user=new THREE.Mesh(geometry,material);user.rotation.x=-Math.PI/2;user.visible=false;user.renderOrder=4;scene.add(user);userMarkers.push(user);resources.push(geometry,material)
   const pg=new THREE.SphereGeometry(.033,12,8),pm=new THREE.MeshBasicMaterial({color:i?0x9ad8c7:0xe9c48f,depthTest:false,depthWrite:false,transparent:true})
   const pred=new THREE.Mesh(pg,pm);pred.position.copy(world(meta.visits[i?pair.b:pair.a].pred_px,i));pred.renderOrder=5;pred.visible=false;scene.add(pred);predMarkers.push(pred);resources.push(pg,pm)
  }
  const track=line(predMarkers.map(p=>p.position),0xb4c8b6,true);track.visible=false;track.renderOrder=5
  const update=(state:State)=>{
   meshes.forEach((mesh,i)=>{mesh.material.opacity=state.both ? .82 : i===state.current ? 1 : .43})
   borders.forEach((border,i)=>{(border.material as THREE.LineBasicMaterial).color.setHex(state.both||i===state.current?0xe9c48f:0x454a55)})
   userMarkers.forEach((mesh,i)=>{mesh.visible=!!state.mark;if(state.mark)mesh.position.copy(world([state.mark.x,state.mark.y],i))})
   predMarkers.forEach(mesh=>{mesh.visible=state.reveal});track.visible=state.reveal
   render()
  }
  const reset=()=>{camera.position.copy(start);controls.target.set(0,.72,0);controls.update();render()}
  api.current={update,reset}
  controls.addEventListener('change',render);controls.update()
  const resize=()=>{const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();render()}
  const observer=new ResizeObserver(resize);observer.observe(element);resize()
  const raycaster=new THREE.Raycaster();let down:{x:number;y:number}|null=null
  const pointerdown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}}
  const pointerup=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=raycaster.intersectObjects(meshes)[0];if(hit)selectRef.current(hit.object.userData.frame as 0|1);down=null}
  const keydown=(e:KeyboardEvent)=>{if(e.key==='Home'){e.preventDefault();reset();return}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0),.2,2.5);camera.position.setFromSpherical(s).add(controls.target);controls.update();render()}
  renderer.domElement.addEventListener('pointerdown',pointerdown);renderer.domElement.addEventListener('pointerup',pointerup);renderer.domElement.addEventListener('keydown',keydown)
  return ()=>{api.current=null;observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerdown);renderer.domElement.removeEventListener('pointerup',pointerup);renderer.domElement.removeEventListener('keydown',keydown);resources.forEach(r=>r.dispose());scene.remove(axis);renderer.dispose();renderer.domElement.remove()}
 },[frames,meta,pair,stretch])
 useEffect(()=>{api.current?.update({current,mark,reveal,both})},[current,mark,reveal,both,frames,meta,pair,stretch])
 return <section className="g-time-panel" aria-label="시간으로 쌓은 관측 모형"><div className="g-panel-head"><span>3D 시간 모형</span><button onClick={()=>api.current?.reset()} aria-label="3D 시점 초기화" title="시점 초기화"><Icon name="reset" size={15}/></button></div><div className="g-volume-wrap"><div ref={host} className="g-volume"/>{error&&<div className="g-volume-error">이 환경에서 3D를 열지 못했습니다.<br/>옆의 실제 영상으로 비교할 수 있습니다.</div>}<span className="g-time-axis">시간 ↑</span><div className="g-volume-periods"><button title={`${periods[1].label} UTC`} aria-pressed={current===1} className={current===1?'selected':''} onClick={()=>onSelect(1)}><i>B</i>{day(periods[1].startUtc)}</button><button title={`${periods[0].label} UTC`} aria-pressed={current===0} className={current===0?'selected':''} onClick={()=>onSelect(0)}><i>A</i>{day(periods[0].startUtc)}</button></div></div></section>
}
