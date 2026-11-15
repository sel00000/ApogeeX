import {afterEach,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {useTime} from '../store'
import type {TargetMeta} from '../types'
import {normalizeAnalysisTab} from './workspaceState'

const meta=(id:string)=>JSON.parse(readFileSync(new URL(`../../public/data/${id}/meta.json`,import.meta.url),'utf8')) as TargetMeta
afterEach(()=>useTime.setState(useTime.getInitialState()))

it('keeps an image comparison selected in another analysis when the viewer remounts',()=>{
 const m=meta('rw_aur'),s=useTime.getState()
 s.setTarget(m.id);s.initComparison(m);s.setAB([4,1]);s.setTab('variable')
 s.setUi('explore');s.initComparison(m)
 expect(useTime.getState().ab).toEqual([4,1])
})

it('initializes a new target with a valid shared-detector pair, without stale indices',()=>{
 const s=useTime.getState();s.setTarget('barnard');s.initComparison(meta('barnard'))
 expect(useTime.getState().ab).toEqual([0,12])
 s.setAB([10,12]);s.setTarget('rw_aur');s.initComparison(meta('rw_aur'))
 expect(useTime.getState().ab).toEqual([0,6])
})

it('normalizes research links consistently for navigation, content and URL',()=>{
 expect(normalizeAnalysisTab('rw_aur',null)).toBe('motion')
 expect(normalizeAnalysisTab('barnard','variable')).toBe('motion')
 expect(normalizeAnalysisTab('r_dra','variable')).toBe('variable')
 expect(normalizeAnalysisTab('eps_indi_b','spectrum')).toBe('spectrum')
 expect(normalizeAnalysisTab('patch_1','spectrum',true)).toBe('provenance')
})
