import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPatchMeta, patchError, pollPatch, requestPatch } from './api'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('coordinate job retry contract', () => {
  it('does not retry terminal work during normal polling but sends an explicit retry flag on demand', async () => {
    const requests: { path: string; options: RequestInit }[] = []
    vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
      requests.push({ path, options })
      return new Response(JSON.stringify({ id: 'test', status: 'queued', url: 'data/patches/test/meta.json' }))
    })
    await requestPatch({ ra: 222.866022, dec: -11.907528 }, .1)
    await requestPatch({ ra: 222.866022, dec: -11.907528 }, .1, true)
    await pollPatch({ ra: 222.866022, dec: -11.907528 }, .1)
    expect(requests[0].options.method).toBe('POST')
    expect(JSON.parse(requests[0].options.body as string)).toEqual({ra:222.866022,dec:-11.907528,fov:.1,retry:false})
    expect(JSON.parse(requests[1].options.body as string).retry).toBe(true)
    expect(requests[2].path).toBe('/api/patch?ra=222.866022&dec=-11.907528&fov=0.1')
    expect(requests[2].options.method).toBeUndefined()
  })
  it('treats a transient fetch failure as an error, while preserving genuine empty coverage', () => {
    expect(patchError({id:'x',url:'',status:'fetch_failed',message:'archive unavailable'})).toBe('archive unavailable')
    expect(patchError({id:'x',url:'',status:'no_data'})).toBeNull()
  })
  it('uses the returned namespaced data URL without double slashes and rejects remote result URLs', async () => {
    const fetch = vi.fn(async (_path: string, _options?: RequestInit) => new Response(JSON.stringify({ id:'x',visits:[] }), {headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch', fetch)
    const meta = await loadPatchMeta({id:'x',status:'no_data',url:'/api/observations/data/patches/x/meta.json'})
    expect(fetch.mock.calls[0][0]).toBe('/api/observations/data/patches/x/meta.json')
    expect(meta.base).toBe('/api/observations/data/patches/x/')
    await expect(loadPatchMeta({id:'x',status:'done',url:'https://example.test/data.json'})).rejects.toThrow('경로')
  })
  it('forwards cancellation without disguising it as a service outage', async () => {
    const controller = new AbortController()
    controller.abort()
    const failure = new DOMException('cancelled', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => { throw failure }))
    await expect(requestPatch({ra:1,dec:2}, .1, false, controller.signal)).rejects.toBe(failure)
  })
})

describe('static publication capability', () => {
  it('explains the missing processing server under a repository path without sending an API request', async () => {
    vi.stubGlobal('document', {baseURI:'https://owner.github.io/Apogee/analysis/?embed=1'})
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify({localServices:false})))
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('준비된 대상의 관측·분석 결과는 계속 볼 수 있습니다')
    await expect(pollPatch({ra:1,dec:2}, .05)).rejects.toThrow('Python 분석 서버')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]?.[0]).toBe('https://owner.github.io/Apogee/config.json')
  })
  it('preserves backend validation errors when local services are enabled', async () => {
    vi.stubGlobal('document', {baseURI:'http://127.0.0.1:4183/analysis/'})
    const fetch = vi.fn(async (url: string) => url.endsWith('/config.json')
      ? new Response(JSON.stringify({localServices:true}))
      : new Response(JSON.stringify({error:'coordinates outside supported range'}), {status:400}))
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('coordinates outside supported range')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('does not infer static hosting from a missing config or disguise a network failure', async () => {
    vi.stubGlobal('document', {baseURI:'https://science.example/analysis/'})
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/config.json')) return new Response('not found', {status:404})
      throw new Error('connection reset')
    })
    vi.stubGlobal('fetch', fetch)
    await expect(requestPatch({ra:1,dec:2}, .05)).rejects.toThrow('connection reset')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('preserves cancellation during the capability check', async () => {
    vi.stubGlobal('document', {baseURI:'https://cancel.example/repository/analysis/'})
    const controller = new AbortController()
    const failure = new DOMException('cancelled config lookup', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(failure); throw failure }))
    await expect(requestPatch({ra:1,dec:2}, .05, false, controller.signal)).rejects.toBe(failure)
  })
})

describe('runtime remote API configuration', () => {
  it('uses runtime apiBase for submission, polling, metadata and frame base despite static hosting', async () => {
    vi.stubGlobal('document', {baseURI:'https://owner.github.io/Remote/analysis/'})
    const api = 'https://api.example/deployment'
    const fetch = vi.fn(async (url: string, _options?:RequestInit) => new Response(JSON.stringify(url.endsWith('/config.json')
      ? {apiBase:api+'/',localServices:false}
      : url.endsWith('/api/session') ? {publicMode:true,sessionToken:'remote-session-token',expiresAt:new Date(Date.now()+60000).toISOString()}
      : url.endsWith('/meta.json') ? {id:'patch_1',visits:[]} : {id:'patch_1',status:'done',url:'/api/observations/data/patches/patch_1/meta.json'})))
    vi.stubGlobal('fetch', fetch)
    const job = await requestPatch({ra:1,dec:2}, .05)
    await pollPatch({ra:1,dec:2}, .05)
    const meta = await loadPatchMeta(job)
    expect(fetch.mock.calls.map(call=>call[0])).toEqual([
      'https://owner.github.io/Remote/config.json', api+'/api/session', api+'/api/patch', api+'/api/patch?ra=1&dec=2&fov=0.05', api+'/api/observations/data/patches/patch_1/meta.json',
    ])
    expect(meta.base).toBe(api+'/api/observations/data/patches/patch_1/')
    expect(new Headers(fetch.mock.calls[2][1]?.headers).get('X-Spherex-Session')).toBe('remote-session-token')
    expect(new Headers(fetch.mock.calls[3][1]?.headers).get('X-Spherex-Session')).toBe('remote-session-token')
    expect(new Headers(fetch.mock.calls[4][1]?.headers).has('X-Spherex-Session')).toBe(false)
    expect(fetch.mock.calls[2][1]?.credentials).toBe('omit')
  })
  it('gives explicit build configuration precedence and accepts only its absolute result URLs', async () => {
    vi.stubEnv('VITE_API_BASE','https://explicit.example/service/')
    vi.stubGlobal('document',{baseURI:'https://owner.github.io/Explicit/analysis/'})
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify({id:'x',visits:[]})))
    vi.stubGlobal('fetch',fetch)
    const meta = await loadPatchMeta({id:'x',status:'done',url:'https://explicit.example/service/api/observations/data/patches/x/meta.json'})
    expect(meta.base).toBe('https://explicit.example/service/api/observations/data/patches/x/')
    expect(fetch).toHaveBeenCalledTimes(1)
    await expect(loadPatchMeta({id:'x',status:'done',url:'https://different.example/service/api/observations/data/patches/x/meta.json'})).rejects.toThrow('경로')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('refreshes a static unavailable configuration on retry after the short TTL', async () => {
    vi.stubGlobal('document',{baseURI:'https://owner.github.io/Recovered/analysis/'})
    const now = vi.spyOn(Date,'now').mockReturnValue(1000)
    let connected = false
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/config.json')
      ? {localServices:false,apiBase:connected?'https://recovered.example':''}
      : url.endsWith('/api/session') ? {publicMode:true,sessionToken:'recovered-session',expiresAt:new Date(Date.now()+60000).toISOString()}
      : {id:'x',status:'queued',url:'data/patches/x/meta.json'})))
    vi.stubGlobal('fetch',fetch)
    await expect(requestPatch({ra:1,dec:2},.05)).rejects.toThrow('Python 분석 서버')
    connected=true;now.mockReturnValue(6001)
    await expect(requestPatch({ra:1,dec:2},.05,true)).resolves.toMatchObject({id:'x'})
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('https://recovered.example/api/patch')
  })
  it('shows invalid runtime configuration without making an insecure request', async () => {
    vi.stubGlobal('document',{baseURI:'https://owner.github.io/Insecure/analysis/'})
    const fetch = vi.fn(async (_url:string)=>new Response(JSON.stringify({localServices:false,apiBase:'http://remote.example'})))
    vi.stubGlobal('fetch',fetch)
    await expect(requestPatch({ra:1,dec:2},.05)).rejects.toThrow('HTTPS')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('supports a public cloud server on the same origin with an empty apiBase',async()=>{
    vi.stubGlobal('document',{baseURI:'https://cloud.example/analysis/'})
    const fetch=vi.fn(async(url:string,_options?:RequestInit)=>new Response(JSON.stringify(url.endsWith('/config.json')
      ?{apiBase:'',publicMode:true,localServices:false}
      :url.endsWith('/api/session')?{publicMode:true,sessionToken:'cloud-session',expiresAt:new Date(Date.now()+60000).toISOString()}
      :{id:'x',status:'queued',url:'data/patches/x/meta.json'})))
    vi.stubGlobal('fetch',fetch)
    await requestPatch({ra:1,dec:2},.05)
    expect(fetch.mock.calls[1][0]).toBe('/api/session')
    expect(fetch.mock.calls[2][0]).toBe('/api/patch')
    expect(new Headers(fetch.mock.calls[2][1]?.headers).get('X-Spherex-Session')).toBe('cloud-session')
  })
  it('does not replay a failed POST and refreshes its session only for the next explicit retry',async()=>{
    vi.stubEnv('VITE_API_BASE','https://sessions.example/service')
    let sessions=0,posts=0
    const fetch=vi.fn(async(url:string,_options?:RequestInit)=>{
      if(url.endsWith('/api/session'))return new Response(JSON.stringify({publicMode:true,sessionToken:'session-'+(++sessions),expiresAt:new Date(Date.now()+60000).toISOString()}))
      posts++
      return posts===1?new Response(JSON.stringify({error:'session expired'}),{status:401}):new Response(JSON.stringify({id:'x',status:'queued',url:'data/patches/x/meta.json'}))
    })
    vi.stubGlobal('fetch',fetch)
    await expect(requestPatch({ra:1,dec:2},.05)).rejects.toThrow('session expired')
    expect(posts).toBe(1)
    await requestPatch({ra:1,dec:2},.05,true)
    expect(posts).toBe(2);expect(sessions).toBe(2)
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get('X-Spherex-Session')).toBe('session-2')
  })
  it('allows a legacy localhost server without a session route but rejects a remote missing route',async()=>{
    vi.stubEnv('VITE_API_BASE','http://127.0.0.1:8137')
    const fetch=vi.fn(async(url:string)=>url.endsWith('/api/session')?new Response('not found',{status:404}):new Response(JSON.stringify({id:'x',status:'queued',url:'data/patches/x/meta.json'})))
    vi.stubGlobal('fetch',fetch)
    await expect(requestPatch({ra:1,dec:2},.05)).resolves.toMatchObject({id:'x'})
    vi.stubEnv('VITE_API_BASE','https://missing-session.example')
    await expect(requestPatch({ra:1,dec:2},.05)).rejects.toThrow('세션 응답 HTTP 404')
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('https://missing-session.example/api/session')
  })
  it('issues one session for concurrent requests and restores the owner after iframe re-entry',async()=>{
    const api='https://persisted-session.example/prefix'
    vi.stubEnv('VITE_API_BASE',api)
    const stored=new Map<string,string>()
    vi.stubGlobal('sessionStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)})
    let issued=0
    const fetch=vi.fn(async(url:string,_options?:RequestInit)=>{
      if(url.endsWith('/api/session')){
        issued++;await new Promise(resolve=>setTimeout(resolve,5))
        return new Response(JSON.stringify({publicMode:true,sessionToken:'persisted-owner',expiresAt:new Date(Date.now()+60000).toISOString()}))
      }
      return new Response(JSON.stringify({id:'x',status:'queued',url:'data/patches/x/meta.json'}))
    })
    vi.stubGlobal('fetch',fetch)
    await Promise.all([requestPatch({ra:1,dec:2},.05),pollPatch({ra:1,dec:2},.05)])
    expect(issued).toBe(1)
    expect(JSON.parse(stored.get('spherex-api-session:'+api)!)).toMatchObject({sessionToken:'persisted-owner'})
    vi.resetModules()
    const reentered=await import('./api')
    await reentered.pollPatch({ra:1,dec:2},.05)
    expect(issued).toBe(1)
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get('X-Spherex-Session')).toBe('persisted-owner')
  })
  it('cancelling one waiting request does not cancel a concurrent session acquisition',async()=>{
    vi.stubEnv('VITE_API_BASE','https://shared-session.example')
    let issued=0
    let issue:()=>void=()=>{}
    const gate=new Promise<void>(resolve=>{issue=resolve})
    const fetch=vi.fn(async(url:string)=>{
      if(url.endsWith('/api/session')){issued++;await gate;return new Response(JSON.stringify({publicMode:true,sessionToken:'shared-owner',expiresAt:new Date(Date.now()+60000).toISOString()}))}
      return new Response(JSON.stringify({id:'x',status:'queued',url:'data/patches/x/meta.json'}))
    })
    vi.stubGlobal('fetch',fetch)
    const controller=new AbortController()
    const cancelled=requestPatch({ra:1,dec:2},.05,false,controller.signal)
    const other=pollPatch({ra:1,dec:2},.05)
    await Promise.resolve();await Promise.resolve()
    controller.abort(new Error('navigation cancelled'))
    const rejected=expect(cancelled).rejects.toThrow('navigation cancelled')
    issue()
    await rejected
    await expect(other).resolves.toMatchObject({id:'x'})
    expect(issued).toBe(1)
  })
})
