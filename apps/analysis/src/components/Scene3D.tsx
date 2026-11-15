import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { TargetMeta } from '../types'
import { onVisit, useTime, visitIndexAt } from '../store'
import { makeCube, pxAt, toCube } from '../lib/cube'
import type { Cube } from '../lib/cube'
import { useSharedImage } from '../lib/imageBridge'
import type { SharedImage } from '../lib/imageBridge'
import { pxDistance } from '../lib/los'
import { frameViewport } from '../lib/viewport'
import { projectTrack } from '../lib/projection'
import { Badge } from './Badge'
import { useL } from '../lib/i18n'

type P3 = [number, number, number]
const square = (h: number, z: number): P3[] => [[-h,-h,z],[h,-h,z],[h,h,z],[-h,h,z],[-h,-h,z]]
const LABEL_FONT = '"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif'
// Text labels drawn into a texture whose aspect equals the plane's (no stretching) at 256 px line height,
// with mipmaps + anisotropic filtering so they stay sharp when the cube is rotated or seen at an angle.
const Caption = memo(function Caption({ text, position, width, height, color = '#e6eefc', weight = 600 }: { text: string; position: P3; width: number; height: number; color?: string; weight?: number }) {
  const invalidate = useThree(s => s.invalidate)
  const gl = useThree(s => s.gl)
  const texture = useMemo(() => {
    const H = 256, W = Math.min(4096, Math.max(H, Math.round(H * width / height)))
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    return tex
  }, [width, height, gl])
  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement, g = cv.getContext('2d')!
    g.clearRect(0, 0, cv.width, cv.height)
    let size = cv.height * .7
    g.font = `${weight} ${size}px ${LABEL_FONT}`
    const w = g.measureText(text).width, room = cv.width * .94
    if (w > room) { size *= room / w; g.font = `${weight} ${size}px ${LABEL_FONT}` }
    g.textAlign = 'center'; g.textBaseline = 'middle'
    // dark halo keeps thin strokes legible over grid lines and the SPHEREx image
    g.lineJoin = 'round'; g.lineWidth = Math.max(4, size * .14); g.strokeStyle = 'rgba(5,9,20,.82)'
    g.strokeText(text, cv.width / 2, cv.height / 2)
    g.fillStyle = color; g.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true; invalidate()
  }, [text, color, weight, texture, invalidate])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position} renderOrder={3}><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
})
// Wide lines (drei Line → Line2): WebGL's own lines are always 1 px, so thickness needs a mesh line.
const LINE_PX = 2
function Segments({ vertices, color, opacity=1 }: { vertices: number[];color:string;opacity?:number }) {
  const points = useMemo(() => { const p: P3[] = []; for (let i = 0; i + 2 < vertices.length; i += 3) p.push([vertices[i], vertices[i+1], vertices[i+2]]); return p }, [vertices])
  if (points.length < 2) return null
  return <Line points={points} segments color={color} lineWidth={LINE_PX} transparent={opacity<1} opacity={opacity} depthWrite={opacity>=1}/>
}
const StaticVolume = memo(function StaticVolume({ h,H,points,path,projection,en }: {h:number;H:number;points:P3[];path:boolean;projection:boolean;en:boolean}) {
  const floor=-h*.2
  const geometry=useMemo(()=>{
    const edges:number[]=[],trail:number[]=[],projected:number[]=[],rays:number[]=[]
    const ring=(z:number)=>{const p=square(h,z);for(let i=1;i<p.length;i++)edges.push(...p[i-1],...p[i])}
    ring(0);ring(H)
    for(const [x,y] of [[-h,-h],[h,-h],[h,h],[-h,h]])edges.push(x,y,0,x,y,H)
    // Bounded context layers; one GPU draw instead of one thick-line mesh per visit.
    const stride=Math.max(1,Math.ceil(points.length/12))
    points.forEach((p,i)=>{if(i%stride===0)ring(p[2]);rays.push(...p,p[0],p[1],floor)})
    const floorPoints=projectTrack(points,floor)
    for(let i=1;i<points.length;i++) {
      trail.push(...points[i-1],...points[i])
      projected.push(...floorPoints[i-1],...floorPoints[i])
    }
    const frame=square(h,floor).flatMap((p,i,a)=>i?[...a[i-1],...p]:[])
    return {edges,trail,projected,rays,frame}
  },[h,H,points,floor])
  return <>
    <Segments vertices={geometry.edges} color="#6e5d3f" opacity={.45}/>
    <YellowDots points={points}/>
    {path&&<Segments vertices={geometry.trail} color="#ffd34d"/>}
    {projection&&<>
      <Segments vertices={geometry.frame} color="#4b796f" opacity={.55}/>
      <Segments vertices={geometry.rays} color="#6cbfa5" opacity={.15}/>
      <Segments vertices={geometry.projected} color="#80e2ba"/>
    </>}
    <Caption text={en?'SPHEREx line of sight ↓':'SPHEREx 시선 ↓'} position={[0,0,H+h]} width={h*2.2} height={h*0.236}/>
  </>
})
let dotTexture: THREE.Texture | null = null
function roundDot() {
  if (dotTexture) return dotTexture
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill()
  g.lineWidth = 6; g.strokeStyle = 'rgba(5,9,20,.9)'; g.stroke()
  dotTexture = new THREE.CanvasTexture(c); dotTexture.colorSpace = THREE.SRGBColorSpace
  return dotTexture
}
function YellowDots({ points, size = 5 }: { points: P3[]; size?: number }) {
  const dpr = useThree(s => s.viewport.dpr)
  const geometry = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points.flat(),3)), [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  // point size is in device pixels: scale by DPR so dots keep the same on-screen size on Retina screens
  return <points geometry={geometry} renderOrder={2}><pointsMaterial color="#ffd34d" map={roundDot()} alphaTest={.4} transparent size={size * dpr} sizeAttenuation={false} depthTest={false} /></points>
}
function SpaceTime({ meta, cube, mode, image, showImage, resetKey, showPath, showProjection }: { meta: TargetMeta; cube: Cube; mode: 'overview' | 'los'; image: SharedImage | null; showImage: boolean; resetKey: number; showPath: boolean; showProjection: boolean }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree(s => s.invalidate)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedule = () => { if(pending.current===null) pending.current=setTimeout(()=>{pending.current=null;invalidate()},1000/30) }
  useEffect(()=>()=>{if(pending.current!==null)clearTimeout(pending.current)},[])
  const h = cube.half, H = cube.height
  const mid = useMemo<P3>(() => [0,0,H/2], [H])
  const t = useTime(s => s.tMjd)
  const z = toCube(cube,pxAt(meta,t),t)[2]
  const points = useMemo(() => meta.visits.map(v => toCube(cube,pxAt(meta,v.mjd),v.mjd)), [meta,cube])
  const skyTrail = useMemo(() => {
    const flat=projectTrack(points,h*.003)
    return flat.flatMap((p,i)=>i?[...flat[i-1],...p]:[])
  },[points,h])
  const planeEdges = useMemo(()=>{
    const ring=square(h,h*.001)
    return ring.flatMap((p,i)=>i?[...ring[i-1],...p]:[])
  },[h])
  const compassEdges=useMemo(()=>[
    h*.85,h*.85,h*.01,h*.85,h*.55,h*.01,
    h*.85,h*.55,h*.01,h*.55,h*.55,h*.01,
    h*.81,h*.8,h*.01,h*.85,h*.85,h*.01,
    h*.85,h*.85,h*.01,h*.89,h*.8,h*.01,
    h*.6,h*.51,h*.01,h*.55,h*.55,h*.01,
    h*.55,h*.55,h*.01,h*.6,h*.59,h*.01,
  ],[h])
  const poses = useMemo(() => {
    const overview = new THREE.PerspectiveCamera(38,1,h*.01,h*2000)
    overview.up.set(0,0,1); overview.position.set(h*3,-h*4,H*1.8); overview.lookAt(...mid); overview.updateMatrixWorld()
    const D = h*400
    const los = new THREE.PerspectiveCamera(2*Math.atan(h/D)*180/Math.PI,1,h*.01,h*2000)
    los.up.set(0,1,0); los.position.set(0,0,D+H/2); los.lookAt(...mid); los.updateMatrixWorld()
    return { overview, los }
  }, [h,H,mid])
  const slice = useRef<THREE.Group>(null)
  const sliceZ = useRef(z)
  const fly = useRef<{start:number;from:THREE.PerspectiveCamera;to:THREE.PerspectiveCamera}|null>(null)
  const first = useRef(true)
  const [flying,setFlying] = useState(false)
  useEffect(() => {
    if (first.current) { first.current=false; camera.copy(poses.overview); camera.updateProjectionMatrix(); schedule(); return }
    const to = (mode === 'los' ? poses.los : poses.overview).clone()
    if (mode === 'los') to.position.z = h*400 + z
    fly.current={start:performance.now(),from:camera.clone(),to}; setFlying(true); invalidate()
    // Time is deliberately excluded: playback must not restart a camera flight.
  }, [mode,resetKey,poses]) // eslint-disable-line
  useFrame((_, delta) => {
    const animateSlice = mode === 'overview' || fly.current !== null
    const gap = z - sliceZ.current
    // In LOS, camera and image translate together: intermediate frames are visually identical.
    sliceZ.current = !animateSlice || Math.abs(gap) < h * .0001 ? z : THREE.MathUtils.lerp(sliceZ.current, z, 1 - Math.exp(-Math.min(delta,.05)*32))
    if (slice.current) slice.current.position.z = sliceZ.current
    if (animateSlice && Math.abs(z - sliceZ.current) > h*.0001) schedule()
    const f=fly.current
    if (f) {
      const u=Math.min(1,(performance.now()-f.start)/1100), e=u*u*(3-2*u)
      const fromCenter = new THREE.Vector3(...mid)
      const toCenter = new THREE.Vector3(0,0,mode==='los'?z:H/2)
      const center = fromCenter.clone().lerp(toCenter,e)
      const a=f.from.position.clone().sub(fromCenter), b=f.to.position.clone().sub(toCenter)
      camera.position.copy(center).addScaledVector(a.clone().normalize().lerp(b.clone().normalize(),e).normalize(), Math.exp(THREE.MathUtils.lerp(Math.log(a.length()),Math.log(b.length()),e)))
      camera.up.copy(f.from.up).lerp(f.to.up,e).normalize()
      camera.lookAt(center)
      camera.fov=Math.exp(THREE.MathUtils.lerp(Math.log(f.from.fov),Math.log(f.to.fov),e))
      camera.updateProjectionMatrix(); schedule()
      if(u===1) { camera.copy(f.to); camera.updateProjectionMatrix(); fly.current=null; setFlying(false) }
    } else if(mode==='los') {
      // Track the moving plane, preserving exactly the same field width at every date.
      camera.position.set(0,0,h*400+sliceZ.current); camera.updateMatrixWorld()
    }
  })
  const texture = useMemo(() => {
    if(!image || !showImage) return null
    const tex=new THREE.CanvasTexture(image.canvas); tex.colorSpace=THREE.SRGBColorSpace
    tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.generateMipmaps=false
    return tex
  }, [image?.canvas,showImage]) // eslint-disable-line
  useEffect(() => { if(texture) { texture.needsUpdate=true; invalidate() } }, [texture,image?.version,invalidate])
  useEffect(() => () => texture?.dispose(),[texture])
  const arrow=useMemo(()=>new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,H+h*.8),h*.65,0xb0c9ec,h*.12,h*.07),[H,h])
  useEffect(()=>()=>{arrow.line.geometry.dispose(); (arrow.line.material as THREE.Material).dispose(); arrow.cone.geometry.dispose(); (arrow.cone.material as THREE.Material).dispose()},[arrow])
  return <>
    <OrbitControls makeDefault target={mid} enabled={mode==='overview'&&!flying} enableDamping dampingFactor={0.075} rotateSpeed={0.65} zoomSpeed={0.7} panSpeed={0.7} />
    {(mode==='overview'||flying)&&<>
      <StaticVolume h={h} H={H} points={points} path={showPath} projection={showProjection} en={useTime.getState().lang==='en'}/>
      <primitive object={arrow}/>

    </>}
    <group ref={slice} position={[0,0,sliceZ.current]}>
      {showImage&&texture&&<mesh renderOrder={-1}><planeGeometry args={[h*2,h*2]}/><meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} toneMapped={false}/></mesh>}
      {mode==='los'&&showPath&&<Segments vertices={skyTrail} color="#ffd34d"/>}
      {mode==='los'&&<YellowDots points={[[toCube(cube,pxAt(meta,t),t)[0],toCube(cube,pxAt(meta,t),t)[1],h*.002]]}/>}
      <Segments vertices={planeEdges} color="#c9a86e"/>
      {/* E = -X and N = +Y on this plane. N × E = +T. */}
      {mode==='overview'&&<>
        <Segments vertices={compassEdges} color="#edf3ff"/>
        <Caption text="N" position={[h*.85,h*.96,.01*h]} width={h*.34} height={h*.22}/>
        <Caption text="E" position={[h*.44,h*.55,.01*h]} width={h*.34} height={h*.22}/>
      </>}
    </group>
  </>
}
export function Scene3D({ meta,compact=false }: { meta: TargetMeta;compact?:boolean }) {
  const L=useL()
  const mode=useTime(s=>s.mode),t=useTime(s=>s.tMjd)
  const suspended=useTime(s=>s.suspended)
  const shared=useSharedImage(),image=shared?.id===meta.id?shared:null
  const base=useMemo(()=>makeCube(meta),[meta])
  const lastImage = useRef<SharedImage | null>(null)
  if(image) lastImage.current=image
  const fallback=frameViewport(meta.wide?.size_px[0]??meta.wcs.size_px[0],meta.wide?.offset_px??0,[base.cx,base.cy],meta.wide?6:4,420)
  const geometryImage=image??lastImage.current??{window:fallback.window,offset:meta.wide?.offset_px??0}
  const cube=useMemo<Cube>(()=>geometryImage?{...base,cx:geometryImage.window.x0+geometryImage.window.w/2-geometryImage.offset,cy:geometryImage.window.y0+geometryImage.window.w/2-geometryImage.offset,half:geometryImage.window.w/2,height:geometryImage.window.w*4/3}:base,[base,geometryImage.window.x0,geometryImage.window.y0,geometryImage.window.w,geometryImage.offset]) // eslint-disable-line
  const showImage=useTime(s=>s.showImage3d),setShowImage=useTime.getState().setShowImage3d
  const [resetKey,setResetKey]=useState(0)
  const [showPath,setShowPath]=useState(true),[showProjection,setShowProjection]=useState(!compact)
  const box=useRef<HTMLDivElement>(null),[side,setSide]=useState(400)
  useEffect(()=>{const el=box.current!;const ro=new ResizeObserver(()=>setSide(Math.max(1,Math.floor(Math.min(el.clientWidth,el.clientHeight)))));ro.observe(el);return()=>ro.disconnect()},[])
  const k=visitIndexAt(meta,t),px=pxAt(meta,t),err=onVisit(meta,t)?pxDistance(px,meta.visits[k].pred_px):null
  return <div className="scene">
    {compact?<div className="fw-scene-tools"><button className={mode==='los'?'active':''} aria-pressed={mode==='los'} data-testid="los-btn" onClick={()=>useTime.getState().setMode(mode==='los'?'overview':'los')}>{mode==='los'?L('3D로 보기','3D view'):L('시선으로 보기','Line of sight')}</button><button onClick={()=>setResetKey(x=>x+1)} aria-label={L('3D 시점 초기화','Reset 3D view')}>{L('초기화','Reset')}</button><details className="fw-popover"><summary>{L('3D 설정','3D settings')}</summary><div><label><input type="checkbox" checked={showImage} onChange={e=>setShowImage(e.target.checked)}/>{L('관측 영상','Observation image')}</label><label><input type="checkbox" checked={showPath} onChange={e=>setShowPath(e.target.checked)}/>{L('예측 이동 경로','Predicted path')}</label><label><input type="checkbox" checked={showProjection} onChange={e=>setShowProjection(e.target.checked)}/>{L('바닥 정사영','Floor projection')}</label></div></details></div>:<div className="toolbar">
      {mode==='overview'?<button className="primary" data-testid="los-btn" onClick={()=>useTime.getState().setMode('los')}>{L('◎ SPHEREx 시선으로 보기','◎ SPHEREx line of sight')}</button>:<button onClick={()=>useTime.getState().setMode('overview')}>{L('← 3D로 돌아가기','← Back to 3D')}</button>}
      <button onClick={()=>setResetKey(x=>x+1)}>{L('시점 초기화','Reset view')}</button>
      <label className="check"><input type="checkbox" checked={showImage} onChange={e=>setShowImage(e.target.checked)}/>{L('SPHEREx 영상 겹치기','Overlay SPHEREx image')}</label>
      <label className="check"><input type="checkbox" checked={showPath} onChange={e=>setShowPath(e.target.checked)}/>{L('3D 이동 경로','3D path')}</label>
      <label className="check"><input type="checkbox" checked={showProjection} onChange={e=>setShowProjection(e.target.checked)}/>{L('바닥 정사영','Floor projection')}</label>
    </div>}
    {!compact&&<div className="dim small scene-legend" data-testid="measurement-coverage"><span><i className="sw-dot" style={{background:'#ffd34d'}}/>{L('관측 시각의 계산 위치','Computed position at each visit')} <Badge kind="model"/></span><span><i className="sw-line" style={{background:'#80e2ba'}}/>{L('바닥 정사영','Floor projection')}</span><span>{L('위치 측정','Measured positions')} {meta.visits.filter(v=>v.meas_px).length}/{meta.visits.length}{L('회','')} <Badge kind="spherex"/></span></div>}
    <div className="scene-box" ref={box}><div className="scene-canvas" style={{width:side,height:side}} data-testid="space-time" data-visit={k} data-image-version={image?.version??0} data-image-visible={showImage} data-path-visible={showPath} data-projection-visible={showProjection} data-window-width={cube.half*2}>
      <Canvas frameloop={suspended ? 'never' : 'demand'} dpr={[1, 2]} gl={{antialias:true,alpha:true,powerPreference:"high-performance"}} camera={{position:[0,0,10],fov:38}}><SpaceTime meta={meta} cube={cube} mode={mode} image={image} showImage={showImage} resetKey={resetKey} showPath={showPath} showProjection={showProjection}/></Canvas>
      {mode==='los'&&<><svg className="overlay" width={side} height={side}><g stroke="#e8eefb" strokeWidth={1.6} fill="#e8eefb" fontSize={16}><path d={`M ${side-22} 18 V 46 H ${side-50}`} fill="none"/><text x={side-22} y={12} textAnchor="middle" stroke="none">N</text><text x={side-60} y={50} stroke="none">E</text></g></svg><div className="scene-note">{meta.visits[k].utc.replace('T',' ').slice(0,19)} UTC · {L('좌우 같은 영상·시야','same image and field on both sides')}</div></>}
    </div></div>
    <div className="los-readout dim small" data-testid={mode==='los'?'los-error':undefined}>
      {compact?null:mode==='los'?(err!==null?L(`SPHEREx 시선과 일치 (오차 ${err.toFixed(4)} px)`,`Matches the SPHEREx line of sight (error ${err.toFixed(4)} px)`):L('관측 사이: 직전 관측 영상 유지','Between visits: previous image kept')):L('바닥은 하늘(E 왼쪽, N 위), 높이는 시간입니다. 끌어서 돌려 보세요.','The floor is the sky (E left, N up); height is time. Drag to turn it.')}
      {!compact&&showImage&&<> <Badge kind="spherex"/> {L('왼쪽과 같은 영상·시야','same image and field as on the left')}</>}
    </div>
  </div>
}
