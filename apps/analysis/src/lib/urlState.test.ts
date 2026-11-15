import { afterEach, expect, it, vi } from 'vitest'
import { writeView } from './urlState'

afterEach(() => vi.unstubAllGlobals())

it('publishes the updated embedded analysis state after storing a selected tool and visit', () => {
  const location = { href: 'http://localhost:8781/analysis/?target=wise0855&embed=1', origin: 'http://localhost:8781' }
  const postMessage = vi.fn()
  vi.stubGlobal('window', { location, parent: { postMessage }, history: { replaceState: (_state: unknown, _title: string, url: URL) => { location.href = url.href } } })
  writeView({ ui: 'research', tab: 'spectrum', visit: 2 })
  expect(location.href).toBe('http://localhost:8781/analysis/?target=wise0855&embed=1&mode=research&tab=spectrum&visit=3')
  expect(postMessage).toHaveBeenCalledWith({ type: 'spherex-analysis-url', query: 'target=wise0855&mode=research&tab=spectrum&visit=3' }, 'http://localhost:8781')
})

it('keeps the globe view in its own sky parameter, apart from the ra/dec of a coordinate search', async () => {
  const { readView } = await import('./urlState')
  const location = { href: 'http://localhost:8781/analysis/?view=sky&ra=10&dec=20&embed=1', origin: 'http://localhost:8781', search: '?view=sky&ra=10&dec=20&sky=83.8,-1.2,40' }
  const postMessage = vi.fn()
  vi.stubGlobal('window', { location, parent: { postMessage }, history: { replaceState: (_state: unknown, _title: string, url: URL) => { location.href = url.href } } })
  expect(readView().sky).toEqual({ ra: 83.8, dec: -1.2, fov: 40 })
  location.search = '?view=sky&sky=bad'
  expect(readView().sky).toBeNull()
  writeView({ sky: { ra: 84.05, dec: -1.2, fovDeg: 12 } })
  expect(location.href).toBe('http://localhost:8781/analysis/?view=sky&ra=10&dec=20&embed=1&sky=84.05%2C-1.2%2C12')
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'spherex-analysis-url', query: 'view=sky&ra=10&dec=20&sky=84.05%2C-1.2%2C12' }, 'http://localhost:8781')
  writeView({ sky: null })
  expect(location.href).toBe('http://localhost:8781/analysis/?view=sky&ra=10&dec=20&embed=1')
})
