import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { TargetMeta } from '../types'
import { makeCube, pxAt, toCube } from './cube'
import { projectTrack } from './projection'
for(const id of ['barnard','eps_indi_b','wise0855','rw_aur','r_dra']) {
  it(`${id}: floor projection preserves every observed-time sky position and removes only time height`,()=>{
    const meta:TargetMeta=JSON.parse(readFileSync(`public/data/${id}/meta.json`,'utf8'))
    const cube=makeCube(meta), floor=-cube.half*.2
    const source=meta.visits.map(v=>toCube(cube,pxAt(meta,v.mjd),v.mjd))
    const projected=projectTrack(source,floor)
    expect(projected).toHaveLength(source.length)
    projected.forEach((p,i)=>{
      expect(p.slice(0,2)).toEqual(source[i].slice(0,2))
      expect(p[2]).toBe(floor)
      expect(p).not.toBe(source[i])
    })
    expect(source.at(-1)![2]).toBeGreaterThan(source[0][2])
  })
}
