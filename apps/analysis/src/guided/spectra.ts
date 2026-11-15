import type {TargetMeta} from '../types'
import type {PhotRow} from '../components/PhotometryPanel'
import {SPECTRAL_REJECT_FLAGS} from '../lib/quality'
import {day} from './motion'

export interface SpectrumPoint {id:string;epoch:0|1;wave:number;flux:number;err:number;mjd:number;exposure:string}
export interface SpectrumSeries {epoch:0|1;visit:number;points:SpectrumPoint[];label:string;startUtc:string;endUtc:string}
const iso=(mjd:number)=>new Date((mjd-40587)*86400000).toISOString()
/** Keep finite measurements, including negative noisy fluxes on the linear axis.
 * No interpolation, coaddition, model fitting, or statistical detection is performed. */
export function makeSpectralSeries(meta:TargetMeta,visits:[number,number]):[SpectrumSeries,SpectrumSeries] {
 if(visits[0]===visits[1]||visits.some(v=>!meta.visits[v]))throw Error('비교할 분광 관측이 준비되지 않았습니다.')
 return visits.map((visit,epoch)=>makeSpectrumSeries(meta,visit,epoch as 0|1)) as [SpectrumSeries,SpectrumSeries]
}
export function makeSpectrumSeries(meta:TargetMeta,visit:number,epoch:0|1=0):SpectrumSeries {
 if(!meta.visits[visit])throw Error('분광 관측이 준비되지 않았습니다.')
 const rows=(meta as TargetMeta&{photometry?:PhotRow[]}).photometry??[]
  const points=rows.flatMap((r,i):SpectrumPoint[]=>{
   if(r.visit!==visit||r.wave_um===null||!Number.isFinite(r.wave_um)||r.wave_um<=0||r.flux_mjy===null||!Number.isFinite(r.flux_mjy)||r.err_mjy===null||!Number.isFinite(r.err_mjy)||r.err_mjy<=0||!Number.isFinite(r.mjd)||(r.flags??[]).some(f=>SPECTRAL_REJECT_FLAGS.has(f.toUpperCase())))return []
   return [{id:`${visit}:${i}`,epoch:epoch as 0|1,wave:r.wave_um,flux:r.flux_mjy,err:r.err_mjy,mjd:r.mjd,exposure:r.exposure}]
  }).sort((a,b)=>a.wave-b.wave||a.mjd-b.mjd)
  if(points.length<2)throw Error('이 관측에는 비교할 수 있는 분광 자료가 부족합니다.')
  const startUtc=iso(Math.min(...points.map(p=>p.mjd))),endUtc=iso(Math.max(...points.map(p=>p.mjd)))
  const label=startUtc.slice(0,10)===endUtc.slice(0,10)?day(startUtc):startUtc.slice(0,7)===endUtc.slice(0,7)?`${day(startUtc)}–${endUtc.slice(8,10)}`:`${day(startUtc)}–${day(endUtc)}`
  return {epoch:epoch as 0|1,visit,points,label,startUtc,endUtc}

}
export function wavelengthExtent(series:SpectrumSeries[]):[number,number] {
 const waves=series.flatMap(s=>s.points.map(p=>p.wave)),lo=Math.min(...waves),hi=Math.max(...waves),pad=Math.max((hi-lo)*.04,.015)
 return [Math.max(0,lo-pad),hi+pad]
}
