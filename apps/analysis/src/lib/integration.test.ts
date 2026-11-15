import { afterEach, describe, expect, it, vi } from 'vitest'
import { embeddedShareURL, movingArchiveContext, notifyAnalysisURL, selectionMessage } from './integration'

afterEach(() => vi.unstubAllGlobals())

describe('same-origin shell selection payload', () => {
  it('preserves real catalogue coordinates and a selected analysis tool', () => {
    expect(selectionMessage({ type: 'spherex-select-target', ra: 83.82208, dec: -5.39111, label: '오리온 성운', tab: 'spectrum' }))
      .toEqual({ type: 'spherex-select-target', ra: 83.82208, dec: -5.39111, label: '오리온 성운', tab: 'spectrum', target: undefined })
  })
  it('rejects malformed or non-finite sky positions rather than selecting a false location', () => {
    for (const value of [null, {}, {type:'spherex-select-target', ra: Infinity, dec:0}, {type:'spherex-select-target', ra:30, dec:100}, {type:'spherex-select-target', target:'../secret'}])
      expect(selectionMessage(value)).toBeNull()
  })
  it('accepts the existing precomputed targets and ignores an unknown analysis tab', () => {
    expect(selectionMessage({ type:'spherex-select-target', target:'wise0855', tab:'invented' }))
      .toMatchObject({ target:'wise0855', tab:undefined })
  })
  it('retains coordinate context and the selected region without silently accepting apparent directions', () => {
    const payload = {type:'spherex-select-target',ra:20,dec:30,frame:'ICRS',coordinateEpoch:'J2000',observationMjd:60000,predictionMjd:60001,timeScale:'UTC',observer:'SPHEREx',fovDeg:1/6}
    expect(selectionMessage(payload)).toMatchObject(payload)
    expect(selectionMessage({...payload,frame:'apparent-ICRF'})).toBeNull()
  })
})

describe('unified-app analysis URL handoff', () => {
  it('shares the actual selected target and tools inside the parent route', () => {
    expect(embeddedShareURL('http://127.0.0.1:8781/analysis/?embed=1&target=wise0855&mode=research&tab=spectrum&visit=2'))
      .toBe('http://127.0.0.1:8781/#analysis?target=wise0855&mode=research&tab=spectrum&visit=2')
  })
  it('preserves supplied moving coordinates, name and dates under a deployed parent subpath', () => {
    expect(embeddedShareURL('https://example.org/project/analysis/?ra=222.86602&dec=-11.90753&label=Vesta&moving=1&epoch=60891.46115208&observationMjd=60891.461818273&embed=1'))
      .toBe('https://example.org/project/#analysis?ra=222.86602&dec=-11.90753&label=Vesta&moving=1&epoch=60891.46115208&observationMjd=60891.461818273')
  })
  it('keeps standalone URLs unchanged and does not invent a target for an empty embedded view', () => {
    const standalone = 'https://example.org/analysis/?target=barnard&visit=2'
    expect(embeddedShareURL(standalone)).toBe(standalone)
    expect(embeddedShareURL('https://example.org/analysis/?embed=1')).toBe('https://example.org/#analysis')
  })
  it('sends only actual child query parameters to the same-origin shell', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { parent: { postMessage }, location: { href: 'http://localhost:8781/analysis/?target=barnard&embed=1', origin: 'http://localhost:8781' } })
    notifyAnalysisURL()
    expect(postMessage).toHaveBeenCalledWith({ type: 'spherex-analysis-url', query: 'target=barnard' }, 'http://localhost:8781')
  })
})

describe('moving-object archival handoff dates', () => {
  it('converts the supplied prediction and observation MJDs independently to UTC', () => {
    expect(movingArchiveContext('?moving=1&epoch=51544.5&observationMjd=60000')).toEqual({
      epoch: { mjd: 51544.5, utc: '2000-01-01 12:00:00 UTC' },
      observation: { mjd: 60000, utc: '2023-02-25 00:00:00 UTC' },
    })
  })
  it('does not invent a date for missing, non-finite or malformed parameters', () => {
    expect(movingArchiveContext('?moving=1&epoch=&observationMjd=Infinity')).toEqual({ epoch: undefined, observation: undefined })
    expect(movingArchiveContext('?moving=1&epoch=not-a-date&observationMjd=1e100')).toEqual({ epoch: undefined, observation: undefined })
  })
  it('does not label a normal fixed-target analysis as a moving-object handoff', () => {
    expect(movingArchiveContext('?epoch=60000')).toBeNull()
    expect(movingArchiveContext('?moving=0&observationMjd=60000')).toBeNull()
  })
})

describe('portal stage message', () => {
  it('accepts sky and workbench only', async () => {
    const { stageMessage } = await import('./integration')
    expect(stageMessage({ type: 'spherex-analysis-stage', stage: 'sky' })).toBe('sky')
    expect(stageMessage({ type: 'spherex-analysis-stage', stage: 'workbench' })).toBe('workbench')
    for (const v of [null, 'sky', {}, { type: 'spherex-analysis-stage' }, { type: 'spherex-analysis-stage', stage: 'planetarium' }, { type: 'spherex-select-target', stage: 'sky' }])
      expect(stageMessage(v)).toBeNull()
  })
})

describe('portal focus message', () => {
  it('accepts sky-mode only', async () => {
    const { focusMessage } = await import('./integration')
    expect(focusMessage({ type: 'spherex-analysis-focus', target: 'sky-mode' })).toBe('sky-mode')
    for (const v of [null, 'sky-mode', {}, { type: 'spherex-analysis-focus' }, { type: 'spherex-analysis-focus', target: 'search' }, { type: 'spherex-analysis-stage', target: 'sky-mode' }])
      expect(focusMessage(v)).toBeNull()
  })
  it('focuses the pressed segment now, or once Find is shown', async () => {
    const { requestSkyModeFocus, flushSkyModeFocus } = await import('./integration')
    const focus = vi.fn()
    let el: { focus: () => void } | null = null
    vi.stubGlobal('document', { querySelector: (sel: string) => (sel === '[data-testid="sky-mode-spherex"]' ? el : null) })
    requestSkyModeFocus()
    expect(focus).not.toHaveBeenCalled()
    el = { focus }
    flushSkyModeFocus()
    expect(focus).toHaveBeenCalledTimes(1)
    flushSkyModeFocus()
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
