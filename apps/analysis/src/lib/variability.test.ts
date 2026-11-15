import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import type { PhotRow } from '../components/PhotometryPanel'
import { binsFor,compare,median,phaseAt,summarize,usable } from './variability'
for(const id of ['rw_aur','r_dra']) {
  const rows:PhotRow[]=JSON.parse(readFileSync(`public/data/${id}/meta.json`,'utf8')).photometry
  const q=id==='r_dra'?'ring':'flux' as const
  it(`${id}: summaries only contain observed values from the selected detector and wavelength`,()=>{
    const bins=binsFor(rows,q,1,.1),bin=bins[0].bin
    const points=summarize(rows,q,1,bin,.1,false)
    expect(points.length).toBeGreaterThan(0)
    for(const p of points) {
      const original=usable(rows,q).filter(r=>r.visit===p.visit&&r.detector===1&&Math.floor(r.wave_um!/.1+1e-9)===bin)
      expect(p.n).toBe(original.length)
      expect(p.value).toBe(median(original.map(r=>q==='flux'?r.flux_mjy!:r.ring_mjy_sr!)))
      expect(p.wave[0]).toBeGreaterThanOrEqual(bin*.1-1e-9)
      expect(p.wave[1]).toBeLessThan((bin+1)*.1+1e-9)
    }
  })
  it(`${id}: clean filtering removes flagged exposures rather than inventing values`,()=>{
    const bin=binsFor(rows,q,1,.1)[0].bin
    const points=summarize(rows,q,1,bin,.1,true)
    expect(points.every(p=>p.flagged===0)).toBe(true)
    expect(points.reduce((s,p)=>s+p.n,0)).toBeLessThanOrEqual(summarize(rows,q,1,bin,.1,false).reduce((s,p)=>s+p.n,0))
  })
}
it('phase wraps cycles including negative times without changing flux',()=>{
  expect(phaseAt(500,10,245)).toBe(0)
  expect(phaseAt(-5,0,10)).toBe(.5)
  expect(()=>phaseAt(0,0,0)).toThrow()
})
it('empty bins stay empty and unavailable flux does not become ring flux',()=>{
  const rows:PhotRow[]=JSON.parse(readFileSync('public/data/r_dra/meta.json','utf8')).photometry
  expect(summarize(rows,'flux',6,100,.1,false)).toEqual([])
  expect(median([])).toBeNull()
})
it('brightness ratios retain sign and do not report a false significance',()=>{
  const p={visit:0,mjd:1,value:10,scatter:null,n:1,flagged:0,wave:[1,1] as [number,number]}
  expect(compare(p,{...p,value:5,mjd:3})).toEqual({ratio:.5,percent:-50,days:2})
})

// ---- time × wavelength explorer (real metadata) ----
import { binOf, coverage, defaultBand, directionAcrossBins, funnel, passesQuality, selectRows, summarizeRows, toCsv, valueOf, visitSpectrum } from './variability'
import type { Quality } from './variability'
for (const id of ['rw_aur', 'r_dra']) {
  const meta = JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8'))
  const rows: PhotRow[] = meta.photometry
  const q = id === 'r_dra' ? 'ring' : 'flux' as const
  const band = defaultBand(rows, q, 0.1)!
  it(`${id}: funnel counts are conserved from all records to visit summaries`, () => {
    for (const quality of ['all', 'severe', 'clean'] as Quality[]) {
      const f = funnel(rows, q, band, quality)
      const sel = selectRows(rows, q, band, quality)
      expect(f.total).toBe(rows.length)
      expect(f.valid).toBe(usable(rows, q).length)
      expect(f.total >= f.valid && f.valid >= f.inBand && f.inBand >= f.selected).toBe(true)
      expect(f.selected).toBe(sel.length)
      const s = summarizeRows(sel, q)
      expect(s.length).toBe(f.visits)
      expect(s.reduce((n, p) => n + p.n, 0)).toBe(sel.length) // raw ↔ median keep every exposure
    }
  })
  it(`${id}: quality presets only remove exposures and never mix quantities`, () => {
    const all = selectRows(rows, q, band, 'all'), severe = selectRows(rows, q, band, 'severe'), clean = selectRows(rows, q, band, 'clean')
    expect(severe.every((r) => all.includes(r)) && clean.every((r) => severe.includes(r))).toBe(true)
    expect(clean.every((r) => r.flags.length === 0)).toBe(true)
    expect(severe.every((r) => passesQuality(r, 'severe'))).toBe(true)
    const other = q === 'flux' ? 'ring' : 'flux'
    for (const r of all) expect(valueOf(r, q)).not.toBeNull()
    // a row usable as ring brightness is never reported as flux and vice versa
    expect(usable(rows, other).every((r) => valueOf(r, other)! > 0)).toBe(true)
  })
  it(`${id}: each visit's spectrum is exactly its own usable exposures, sorted by wavelength`, () => {
    for (let v = 0; v < meta.visits.length; v++) {
      const s = visitSpectrum(rows, q, v)
      expect(s.all).toBe(rows.filter((r) => r.visit === v).length)
      expect(s.ok.length + s.missing).toBe(s.all)
      expect(s.ok.every((r) => r.visit === v)).toBe(true)
      for (let i = 1; i < s.ok.length; i++) expect(s.ok[i].wave_um!).toBeGreaterThanOrEqual(s.ok[i - 1].wave_um!)
      expect(s.reasons.reduce((n, [, c]) => n + c, 0)).toBe(s.missing)
    }
  })
  it(`${id}: coverage map has one cell per exposure and marks values only where they exist`, () => {
    const cells = coverage(rows, q)
    expect(cells.length).toBe(rows.filter((r) => r.wave_um !== null).length)
    expect(cells.filter((c) => c.ok).length).toBe(usable(rows, q).length)
    expect(new Set(cells.map((c) => c.row.exposure)).size).toBe(cells.length)
  })
  it(`${id}: picking a spectrum point selects its own detector and bin`, () => {
    const r = visitSpectrum(rows, q, selectRows(rows, q, band, 'all')[0].visit).ok[0]
    const picked = selectRows(rows, q, { det: r.detector, bin: binOf(r.wave_um!, 0.1), width: 0.1 }, 'all')
    expect(picked).toContain(r)
  })
  it(`${id}: CSV matches the chosen view mode and states its filters`, () => {
    const sel = selectRows(rows, q, band, 'all'), summary = summarizeRows(sel, q)
    const raw = toCsv({ target: id, q, band, quality: 'all', mode: 'raw', selected: sel, summary, utc: () => 'T' })
    const med = toCsv({ target: id, q, band, quality: 'all', mode: 'median', selected: sel, summary, utc: () => 'T' })
    const data = (s: string) => s.split('\n').filter((l) => !l.startsWith('#')).slice(1)
    expect(data(raw).length).toBe(sel.length)
    expect(data(med).length).toBe(summary.length)
    for (const s of [raw, med]) {
      expect(s).toContain(`quantity=${q}`)
      expect(s).toContain(`detector=D${band.det}`)
      expect(s).toContain('quality=all')
    }
    expect(med).toContain('not a measurement error')
  })
}
it('rw_aur: control check compares the same two visits across other bins of one detector', () => {
  const rows: PhotRow[] = JSON.parse(readFileSync('public/data/rw_aur/meta.json', 'utf8')).photometry
  const band = defaultBand(rows, 'flux', 0.1)!
  const s = summarizeRows(selectRows(rows, 'flux', band, 'all'), 'flux')
  const out = directionAcrossBins(rows, 'flux', band.det, 0.1, 'all', s[0].visit, s.at(-1)!.visit)
  expect(out.length).toBeGreaterThan(0)
  expect(out.some((o) => o.bin === band.bin)).toBe(true)
})
