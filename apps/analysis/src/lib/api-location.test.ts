import { describe, expect, it } from 'vitest'
import { normalizeApiBase, patchMetaUrl } from './api-location'

const page = 'https://owner.github.io/Apogee/analysis/'
const api = 'https://api.example/science'
const route = '/api/observations/data/patches/patch_1/meta.json'

describe('API deployment boundary', () => {
  it('accepts HTTPS deployment prefixes and local HTTP without adding an API suffix', () => {
    expect(normalizeApiBase(api + '/')).toBe(api)
    expect(normalizeApiBase('http://localhost:8123/local/')).toBe('http://localhost:8123/local')
    expect(normalizeApiBase('http://127.0.0.1:8123')).toBe('http://127.0.0.1:8123')
    expect(normalizeApiBase('http://[::1]:8123')).toBe('http://[::1]:8123')
    expect(normalizeApiBase('/backend/',page)).toBe('https://owner.github.io/backend')
    expect(normalizeApiBase('/backend/','http://127.0.0.1:8137/analysis/')).toBe('http://127.0.0.1:8137/backend')
  })
  it('rejects insecure remote servers, credentials, query strings and ambiguous prefixes', () => {
    for (const value of ['http://api.example', 'https://user:pass@api.example', '//api.example', 'https://api.example/api', 'https://api.example/x?secret=a', 'https://api.example/x#token', 'https://api.example/x/../y', 'https://api.example/%2e%2e/y', 'javascript:alert(1)'])
      expect(() => normalizeApiBase(value), value).toThrow()
  })
  it('resolves returned route paths and trusted absolute URLs under the configured prefix', () => {
    expect(patchMetaUrl(route, api, page)).toBe(api + route)
    expect(patchMetaUrl(route.slice(1), api, page)).toBe(api + route)
    expect(patchMetaUrl('/science' + route, api, page)).toBe(api + route)
    expect(patchMetaUrl(api + route, api, page)).toBe(api + route)
    expect(patchMetaUrl('data/patches/patch_1/meta.json', api, page)).toBe(api + '/data/patches/patch_1/meta.json')
    expect(patchMetaUrl(route, '', page)).toBe(route)
  })
  it('rejects unrelated origins, paths, credentials, queries and traversal before fetching', () => {
    for (const value of ['https://evil.example/science' + route, 'https://api.example' + route, api + '/private.json', api + route + '?key=secret', api + route + '#x', 'https://user@api.example/science' + route, '//api.example/science' + route, '/api/observations/data/patches/x/../patch_1/meta.json', '/api/observations/data/patches/%2e%2e/meta.json', 'data\\patches\\patch_1\\meta.json'])
      expect(() => patchMetaUrl(value, api, page), value).toThrow('경로')
  })
})
