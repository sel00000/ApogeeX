import {afterEach,describe,expect,it,vi} from 'vitest';
import {normalizeApiBase} from '../src/api-config';

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();vi.resetModules();});
function page(url='https://owner.github.io/Apogee/asteroids/') {
  vi.stubGlobal('document',{baseURI:url});vi.stubGlobal('location',new URL(url));
  const values=new Map<string,string>();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
}
describe('runtime API deployment',()=>{
  it('uses the repository-level config, preserves its deployment prefix, and refreshes after five seconds',async()=>{
    page();let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);
    const fetch=vi.fn(async(_url: string,_init?:RequestInit)=>new Response(JSON.stringify({apiBase:'https://science.example/service/',localServices:false})));
    vi.stubGlobal('fetch',fetch);const {loadApiConfig}=await import('../src/api-config');
    expect((await loadApiConfig()).apiBase).toBe('https://science.example/service');
    await loadApiConfig();expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://owner.github.io/Apogee/config.json');
    now+=5001;await loadApiConfig();expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('retries configuration immediately when the user requests reconnection',async()=>{
    page();const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({localServices:false}))).mockResolvedValueOnce(new Response(JSON.stringify({apiBase:'https://science.example'})));
    vi.stubGlobal('fetch',fetch);const {loadApiConfig}=await import('../src/api-config');
    expect((await loadApiConfig()).apiBase).toBe('');
    expect((await loadApiConfig(undefined,true)).apiBase).toBe('https://science.example');
  });
  it('gives an explicit build URL priority without fetching the shell config',async()=>{
    page();vi.stubEnv('VITE_API_BASE','https://explicit.example/prefix/');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const {loadApiConfig}=await import('../src/api-config');expect((await loadApiConfig()).apiBase).toBe('https://explicit.example/prefix');expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the local API fallback when config is missing and preserves cancellation',async()=>{
    page();vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
    const {loadApiConfig}=await import('../src/api-config');expect(await loadApiConfig()).toEqual({apiBase:''});
    const controller=new AbortController();controller.abort();await expect(loadApiConfig(controller.signal)).rejects.toThrow();
  });
  it('allows HTTPS prefixes and explicit HTTP localhost, but rejects unsafe configurations',()=>{
    expect(normalizeApiBase('/backend','https://owner.github.io')).toBe('https://owner.github.io/backend');
    expect(normalizeApiBase('http://127.0.0.1:4173/relay')).toBe('http://127.0.0.1:4173/relay');
    expect(normalizeApiBase('http://[::1]:4173')).toBe('http://[::1]:4173');
    for(const value of ['//evil.example','http://public.example','javascript:alert(1)','https://u:p@api.example','https://api.example/path?x=1','https://api.example/#x','https://api.example/a/../b','https://api.example/%2e%2e','https://api.example/api'])expect(()=>normalizeApiBase(value)).toThrow();
  });
});
describe('public API sessions',()=>{
  it('acquires one session per API server and preserves it across requests',async()=>{
    page();const fetch=vi.fn(async(_url: string,_init?:RequestInit)=>new Response(JSON.stringify({publicMode:true,sessionToken:'test-session',expiresAt:new Date(Date.now()+60000).toISOString()})));vi.stubGlobal('fetch',fetch);
    const {sessionHeaders}=await import('../src/api-config');const config={apiBase:'https://science.example/service'};
    expect(await sessionHeaders(config)).toEqual({'X-Spherex-Session':'test-session'});
    expect(await sessionHeaders(config)).toEqual({'X-Spherex-Session':'test-session'});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://science.example/service/api/session');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({credentials:'omit',redirect:'error'});
    await sessionHeaders({apiBase:'https://second.example'});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('refreshes a rejected session only on the next user request',async()=>{
    page();const fetch=vi.fn(async()=>new Response(JSON.stringify({publicMode:true,sessionToken:'renewed',expiresAt:new Date(Date.now()+60000).toISOString()})));vi.stubGlobal('fetch',fetch);
    const {sessionHeaders,forgetSession}=await import('../src/api-config');const config={apiBase:'https://renew.example'};
    await sessionHeaders(config);forgetSession(config);expect(fetch).toHaveBeenCalledTimes(1);
    await sessionHeaders(config);expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps legacy same-origin local APIs free of session requests',async()=>{
    page('http://localhost:4173/asteroids/');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const {sessionHeaders}=await import('../src/api-config');expect(await sessionHeaders({apiBase:''})).toEqual({});expect(fetch).not.toHaveBeenCalled();
  });
  it('requests sessions for a same-origin public deployment and handles local mode responses',async()=>{
    page();const fetch=vi.fn(async(_url: string,_init?:RequestInit)=>new Response(JSON.stringify({publicMode:false,sessionToken:null})));vi.stubGlobal('fetch',fetch);
    const {sessionHeaders}=await import('../src/api-config');expect(await sessionHeaders({apiBase:'',publicMode:true})).toEqual({});expect(fetch.mock.calls[0]?.[0]).toBe('/api/session');
  });
  it('deduplicates concurrent session issuance and restores the owner after a module reload',async()=>{
    page();const fetch=vi.fn(async()=>{await new Promise(resolve=>setTimeout(resolve,1));return new Response(JSON.stringify({publicMode:true,sessionToken:'one-owner',expiresAt:new Date(Date.now()+60000).toISOString()}));});vi.stubGlobal('fetch',fetch);
    const config={apiBase:'https://concurrent.example'};
    const first=await import('../src/api-config');
    const values=await Promise.all([first.sessionHeaders(config),first.sessionHeaders(config)]);
    expect(values[0]).toEqual(values[1]);expect(fetch).toHaveBeenCalledTimes(1);
    vi.resetModules();const second=await import('../src/api-config');
    expect(await second.sessionHeaders(config)).toEqual({'X-Spherex-Session':'one-owner'});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('cancels one waiter promptly without invalidating another request owner',async()=>{
    page();let release!:()=>void;
    const fetch=vi.fn(async()=>{await new Promise<void>(resolve=>{release=resolve;});return new Response(JSON.stringify({publicMode:true,sessionToken:'retained-owner',expiresAt:new Date(Date.now()+60000).toISOString()}));});vi.stubGlobal('fetch',fetch);
    const {sessionHeaders}=await import('../src/api-config');const config={apiBase:'https://cancelled.example'};
    const controller=new AbortController();const cancelled=sessionHeaders(config,controller.signal);const retained=sessionHeaders(config);
    controller.abort(Error('cancel only this request'));
    await expect(cancelled).rejects.toThrow('cancel only this request');
    release();expect(await retained).toEqual({'X-Spherex-Session':'retained-owner'});expect(fetch).toHaveBeenCalledTimes(1);
  });
});
