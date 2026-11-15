import type { TargetMeta } from '../types'
import { frameUrl } from '../lib/data'
import type { Frame } from '../lib/frames'

type WithPhotometry = TargetMeta & {photometry?: {visit:number;detector:number;wave_um:number|null;mjd:number}[]}
export type MotionPair = { a:number; b:number; detector:number; days:number }
export type Mark = { x:number; y:number }
export const day = (utc:string) => utc.slice(0,10).replaceAll('-','.')

export function selectedWaves(meta: TargetMeta, visit:number, detector:number): [number,number]|null {
  const waves = ((meta as WithPhotometry).photometry ?? []).filter(p=>p.visit===visit&&p.detector===detector&&Number.isFinite(p.wave_um)&&p.wave_um!==null).map(p=>p.wave_um!)
  return waves.length ? [Math.min(...waves),Math.max(...waves)] : null
}
/** Per-detector visit images combine exposures, sometimes spanning several days. */
export function observationPeriod(meta:TargetMeta,visit:number,detector:number) {
  const times=((meta as WithPhotometry).photometry??[]).filter(p=>p.visit===visit&&p.detector===detector&&Number.isFinite(p.mjd)).map(p=>p.mjd)
  if(!times.length) throw Error('선택한 검출기의 관측 기간을 확인할 수 없습니다.')
  const startMjd=Math.min(...times),endMjd=Math.max(...times)
  const iso=(mjd:number)=>new Date((mjd-40587)*86400000).toISOString()
  const startUtc=iso(startMjd),endUtc=iso(endMjd)
  const label=startUtc.slice(0,10)===endUtc.slice(0,10)?day(startUtc):startUtc.slice(0,7)===endUtc.slice(0,7)?`${day(startUtc)}–${endUtc.slice(8,10)}`:`${day(startUtc)}–${day(endUtc)}`
  return {startMjd,endMjd,startUtc,endUtc,label}
}
export function makeMotionPair(meta:TargetMeta):MotionPair {
  const prepared:Record<string,[number,number]>={barnard:[0,12],eps_indi_b:[0,18],wise0855:[0,8]}
  const selected=prepared[meta.id]
  if(!selected) throw Error('이 대상에는 안내형 이동 탐구가 준비되지 않았습니다.')
  const [a,b]=selected,detector=6
  const A=meta.visits[a],B=meta.visits[b]
  if(!A||!B||!A.f32_det?.[detector]||!B.f32_det?.[detector]) throw Error('비교할 두 시점의 D6 관측 영상이 준비되지 않았습니다.')
  if(!meta.wcs.north_up||!meta.wcs.east_left||meta.wcs.size_px[0]!==meta.wcs.size_px[1]) throw Error('관측 영상의 좌표계를 확인할 수 없습니다.')
  const wa=selectedWaves(meta,a,detector),wb=selectedWaves(meta,b,detector)
  if(!wa||!wb||Math.max(wa[0],wb[0])>Math.min(wa[1],wb[1])) throw Error('두 관측의 파장 범위가 겹치지 않아 안내형 비교를 열 수 없습니다.')
  if(!Number.isFinite(B.mjd-A.mjd)||B.mjd<=A.mjd) throw Error('관측 시각의 순서가 올바르지 않습니다.')
  observationPeriod(meta,a,detector);observationPeriod(meta,b,detector)
  return {a,b,detector,days:B.mjd-A.mjd}
}
export function prediction(meta:TargetMeta,pair:MotionPair) {
  const A=meta.visits[pair.a].pred_px,B=meta.visits[pair.b].pred_px
  const dx=B[0]-A[0],dy=B[1]-A[1],scale=meta.wcs.cdelt_arcsec
  return {eastArcsec:-dx*scale,northArcsec:-dy*scale,pixels:Math.hypot(dx,dy),arcsec:Math.hypot(dx,dy)*scale}
}
export async function loadPair(meta:TargetMeta,pair:MotionPair,signal:AbortSignal):Promise<[Frame,Frame]> {
  return Promise.all([pair.a,pair.b].map(async i=>{
    const file=meta.visits[i].f32_det?.[pair.detector]
    if(!file) throw Error('관측 영상 경로가 없습니다.')
    const r=await fetch(frameUrl(meta.id,file,meta.base),{signal})
    if(!r.ok) throw Error(`관측 영상 요청 실패 (HTTP ${r.status})`)
    const buffer=await r.arrayBuffer()
    if(buffer.byteLength!==meta.wcs.size_px[0]*meta.wcs.size_px[1]*4) throw Error('관측 영상의 크기가 맞지 않습니다.')
    const frame=new Float32Array(buffer)
    if(!frame.some(Number.isFinite)) throw Error('표시할 수 있는 관측 픽셀이 없습니다.')
    return frame
  })) as Promise<[Frame,Frame]>
}
