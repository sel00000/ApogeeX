import {readFileSync} from 'node:fs'
import {describe,it,expect,vi} from 'vitest'
import type {TargetMeta} from '../types'
vi.mock('../lib/data',()=>({frameUrl:(id:string,file:string)=>`/data/${id}/${file}`}))
import {makeSpectralSeries} from './spectra'
import {EXPLORATIONS} from './explorations'
const meta=(id:string)=>JSON.parse(readFileSync(new URL(`../../public/data/${id}/meta.json`,import.meta.url),'utf8')) as TargetMeta

describe('source-backed guided spectra',()=>{
 it('provides three motion and two usable spectral explorations',()=>{
  expect(EXPLORATIONS.filter(m=>m.kind==='motion')).toHaveLength(3)
  const spectral=EXPLORATIONS.filter(m=>m.kind==='spectrum');expect(spectral).toHaveLength(2)
  for(const m of spectral)for(const series of makeSpectralSeries(meta(m.target),m.visits!))expect(series.points.length).toBeGreaterThanOrEqual(5)
 })
 it('preserves each actual per-exposure value and excludes serious quality flags',()=>{
  const target=meta('eps_indi_b'),series=makeSpectralSeries(target,[0,6])
  const rows=(target as TargetMeta&{photometry:{exposure:string;wave_um:number;flux_mjy:number;err_mjy:number;visit:number;flags:string[]}[]}).photometry
  for(const point of series.flatMap(s=>s.points)){
   const row=rows[Number(point.id.split(':')[1])]
   expect([point.wave,point.flux,point.err]).toEqual([row.wave_um,row.flux_mjy,row.err_mjy])
   expect(row.flags).not.toContain('OVERFLOW');expect(row.flags).not.toContain('SUR_ERROR')
   expect(row.visit).toBe(series[point.epoch].visit)
  }
 })
 it('does not invent RW Aur long-wavelength coverage or mix visits',()=>{
  const [a,b]=makeSpectralSeries(meta('rw_aur'),[0,4])
  expect(a.points).toHaveLength(11);expect(b.points).toHaveLength(5)
  expect(Math.max(...a.points.concat(b.points).map(p=>p.wave))).toBeLessThan(1.1)
  expect(b.startUtc).toMatch(/^2026-/);expect(a.startUtc).toMatch(/^2025-/)
 })
 it('does not substitute saturated ring brightness for numerical spectra',()=>{
  expect(()=>makeSpectralSeries(meta('r_dra'),[0,1])).toThrow('자료가 부족')
 })
 it('retains finite negative measurements and rejects invalid errors',()=>{
  const target={...meta('eps_indi_b'),photometry:[
   {visit:0,exposure:'a',wave_um:1,flux_mjy:-.2,err_mjy:.3,mjd:60000,flags:[]},
   {visit:0,exposure:'b',wave_um:2,flux_mjy:1,err_mjy:.1,mjd:60001,flags:[]},
   {visit:0,exposure:'bad',wave_um:3,flux_mjy:10,err_mjy:-1,mjd:60001,flags:[]},
   {visit:6,exposure:'c',wave_um:1,flux_mjy:1,err_mjy:.1,mjd:61000,flags:[]},
   {visit:6,exposure:'d',wave_um:2,flux_mjy:2,err_mjy:.1,mjd:61001,flags:[]},
  ]}
  const [a]=makeSpectralSeries(target,[0,6]);expect(a.points).toHaveLength(2);expect(a.points[0].flux).toBe(-.2)
 })
})
