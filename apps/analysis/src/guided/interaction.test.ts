import {describe,it,expect} from 'vitest'
import {cropWindow,frameFromScrub} from './interaction'
describe('honest image interactions',()=>{
 it('time scrub only selects real A or B, including endpoints',()=>{
  expect([0,24,49.9,50,90,100].map(frameFromScrub)).toEqual([0,0,0,1,1,1])
 })
 it('keeps a common crop inside the real data when panned beyond edges',()=>{
  const c=cropWindow(59,3,{x:-100,y:100})
  expect(c.left).toBe(0);expect(c.top+c.width).toBeCloseTo(59)
  expect(cropWindow(59,1,{x:0,y:0})).toEqual({width:59,left:0,top:0})
 })
})
