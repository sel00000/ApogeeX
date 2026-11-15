import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createPublicAccess, createAdmission } from './public-access.mjs';
import { createSiteServer, listenOnAvailablePort } from './server.mjs';
import { createAsteroidApi } from './asteroid-api.mjs';
import { runtimeBytes, requireRuntimeSpace } from './runtime-budget.mjs';

const ORIGIN='https://sky.example', OTHER='https://other.example';
const request=(token, extra={})=>({socket:{remoteAddress:'127.0.0.1'},headers:{origin:ORIGIN,...(token?{'x-spherex-session':token}:{}),...extra}});
test('public mode is explicit, exact HTTPS origins are mandatory, sessions expire and issuance is bounded',()=>{
  assert.throws(()=>createPublicAccess({enabled:true,origins:''}));
  for(const origins of ['http://sky.example','https://sky.example/path','https://*.example']){
    assert.throws(()=>createPublicAccess({enabled:true,origins}));
  }
  let now=0;const access=createPublicAccess({enabled:true,origins:ORIGIN,now:()=>now,sessionTtlMs:1000,perIpLimit:2});
  const first=access.issue(request());assert.equal(first.publicMode,true);assert.match(first.sessionToken,/^[a-f0-9]{64}$/);
  assert.ok(access.session(request(first.sessionToken)));
  assert.throws(()=>access.session(request(first.sessionToken,{origin:OTHER})),{status:403});
  assert.throws(()=>access.session(request('a'.repeat(64))),{status:401});
  access.issue(request());assert.throws(()=>access.issue(request()),{status:429});
  now=1001;assert.throws(()=>access.session(request(first.sessionToken)),{status:401});
});
test('shared lease cannot be stolen or prematurely released by an older worker',()=>{
  const admission=createAdmission(),a=admission.acquire('observation');
  assert.throws(()=>admission.acquire('asteroid'),{status:429});
  a();const b=admission.acquire('asteroid');a();assert.equal(admission.busy,true);b();assert.equal(admission.busy,false);
});
test('per-session scientific execution rate is bounded independently of session issuance',()=>{
  const access=createPublicAccess({enabled:true,origins:ORIGIN}),token=access.issue(request()).sessionToken,id=access.session(request(token));
  for(let i=0;i<8;i++)access.charge(id);
  assert.throws(()=>access.charge(id),{status:429});access.charge(id,'lookup');
});

class Child extends EventEmitter{
  stdout=new PassThrough();stderr=new PassThrough();exitCode=null;signalCode=null;
  finish(code=0,signal=null){if(this.exitCode!==null||this.signalCode!==null)return;this.exitCode=code;this.signalCode=signal;this.stdout.end();this.stderr.end();this.emit('exit',code,signal);this.emit('close',code,signal);}
  kill(signal='SIGTERM'){setTimeout(()=>this.finish(null,signal),50);return true;}
}
async function fixture(apiOverrides={}){
  const root=await mkdtemp(join(tmpdir(),'spherex-public-'));await writeFile(join(root,'index.html'),'sky');
  const access=createPublicAccess({enabled:true,origins:ORIGIN,maxFov:.1}),admission=createAdmission(),children=[];
  let busy=false,state='done';const id='r1_000000_dp2_000000_f0_100000';
  const worker=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/observations/health')return res.end(JSON.stringify({busy}));
    if(req.url?.startsWith('/api/observations/data/patches/'))return res.end(JSON.stringify({status:'done',visits:[]}));
    if(req.method==='POST'){for await(const _ of req){}busy=true;state='running';}
    if(req.method==='DELETE'){state='cancelled';setTimeout(()=>{busy=false;},50);}
    res.end(JSON.stringify({id,status:state,url:`/api/observations/data/patches/${id}/meta.json`}));
  });
  await listenOnAvailablePort(worker,{port:0});
  const api=createAsteroidApi({projectRoot:root,access,admission,probePython:async()=>({available:true,executable:'test-python',args:[]}),
    spawnProcess:(executable,args,options)=>{const child=new Child();children.push({child,args,options});return child;},
    exportResult:async({destinationDir})=>{await mkdir(destinationDir,{recursive:true});await writeFile(join(destinationDir,'result.json'),'{}');await writeFile(join(destinationDir,'private.txt'),'secret');},...apiOverrides});
  const server=createSiteServer({webRoot:root,access,admission,asteroids:api,observationsUrl:`http://127.0.0.1:${worker.address().port}`,observationsAlive:()=>true});
  const port=await listenOnAvailablePort(server,{port:0}),base=`http://127.0.0.1:${port}`;
  const call=(path,{token,headers={},...options}={})=>fetch(base+path,{...options,headers:{Origin:ORIGIN,...(token?{'X-Spherex-Session':token}:{}),...headers}});
  const session=async()=> (await(await call('/api/session')).json()).sessionToken;
  return {root,api,admission,children,call,session,id,finishObservation:()=>{busy=false;state='done';},async close(){busy=false;await api.close();server.closeAllConnections();await new Promise(r=>server.close(r));worker.closeAllConnections();await new Promise(r=>worker.close(r));const target=resolve(root);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.includes('spherex-public-'));await rm(target,{recursive:true,force:true});}};
}
test('CORS preflight, protected controls, observation ownership and shared capacity work over HTTP',async()=>{
  const f=await fixture();try{
    const preflight=await f.call('/api/patch',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type, X-Spherex-Session'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN);
    assert.equal((await f.call('/api/session',{headers:{Origin:OTHER}})).status,403);
    const a=await f.session(),b=await f.session(),input={ra:1,dec:2,fov:.1};
    const post=(token,value=input)=>f.call('/api/patch',{token,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
    assert.equal((await post(null)).status,401);assert.equal((await post(a,{...input,fov:.2})).status,422);
    assert.equal((await post(a,{...input,padding:'a'.repeat(9000)})).status,413);
    assert.equal((await f.call('/api/patch',{token:a,method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'})).status,400);
    assert.equal((await f.call('/api/patch?ra=1&dec=2&fov=.1',{token:a})).status,404);
    assert.equal((await post(a)).status,202);assert.equal(f.admission.busy,true);
    assert.equal((await f.call(`/api/observations/jobs/${f.id}`,{token:b,method:'DELETE'})).status,404);
    assert.equal((await f.call('/api/patch?ra=1&dec=2&fov=.1',{token:b})).status,404);
    assert.equal((await f.call(`/api/observations/data/patches/${f.id}/meta.json`)).status,200);
    assert.equal((await f.call('/api/asteroid-analysis/capabilities')).status,429);
    assert.equal((await post(b)).status,429);
    assert.equal((await f.call(`/api/observations/jobs/${f.id}`,{token:a,method:'DELETE'})).status,200);
    assert.equal(f.admission.busy,true);await new Promise(r=>setTimeout(r,1200));assert.equal(f.admission.busy,false);
  }finally{await f.close();}
});
test('public asteroid jobs keep raw cache isolated and cannot be inspected/cancelled by other sessions',async()=>{
  const f=await fixture();try{
    const a=await f.session(),b=await f.session();
    const created=await f.call('/api/asteroid-analysis/jobs',{token:a,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'433',start:'2026-01-01',end:'2026-01-15',maxImages:360})});
    assert.equal(created.status,202);const job=await created.json();assert.equal(job.maxImages,360);
    const path=`/api/asteroid-analysis/jobs/${job.id}`;
    assert.equal((await f.call(path,{token:b})).status,404);assert.equal((await f.call(path,{token:b,method:'DELETE'})).status,404);
    assert.equal((await f.call(path)).status,401);assert.equal((await f.call(path,{token:a})).status,200);
    assert.equal(f.children[0].options.env.SPHEREX_ASTEROID_CACHE_DIR,join(f.root,'var','jobs','asteroids',job.id,'cache'));
    assert.equal((await f.call(path+'/asteroids.sqlite')).status,404);
    assert.equal((await f.call(path,{token:a,method:'DELETE'})).status,200);assert.equal(f.admission.busy,true);
    await new Promise(r=>setTimeout(r,100));assert.equal(f.admission.busy,false);
  }finally{await f.close();}
});
test('runtime budget counts generated files and rejects an exhausted allocation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'spherex-public-storage-'));
  try{await writeFile(join(root,'data.fits'),Buffer.alloc(2048));assert.equal(await runtimeBytes(root),2048);await assert.rejects(requireRuntimeSpace(root,1024),{status:507});}
  finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}
});
test('completed scientific artifacts stay public while 3D creation/cancellation owns the shared lease',async()=>{
  let sceneStarted=false;
  const f=await fixture({generateScene:async({signal})=>{sceneStarted=true;await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>setTimeout(()=>reject(Error('cancelled')),50),{once:true}));}});
  try{
    const a=await f.session(),b=await f.session();
    const created=await f.call('/api/asteroid-analysis/jobs',{token:a,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'433',start:'2026-01-01',end:'2026-01-15',maxImages:120})});
    const job=await created.json(),path=`/api/asteroid-analysis/jobs/${job.id}`,child=f.children[0].child;
    const source=join(f.root,'var','jobs','asteroids',job.id,'outputs','433');await mkdir(source,{recursive:true});
    child.stdout.write('SPHEREX_WEB_RESULT='+JSON.stringify({sourceDir:source})+'\n');child.finish(0);
    for(let i=0;i<30;i++){if((await(await f.call(path,{token:a})).json()).status==='completed')break;await new Promise(r=>setTimeout(r,10));}
    assert.equal((await f.call(path+'/result.json')).status,200);assert.equal((await f.call(path+'/private.txt')).status,404);
    assert.equal((await f.call(path+'/scene',{token:b,method:'POST'})).status,404);
    assert.equal((await f.call(path+'/scene',{token:a,method:'POST'})).status,202);
    await new Promise(r=>setTimeout(r,20));assert.equal(sceneStarted,true);assert.equal(f.admission.busy,true);
    assert.equal((await f.call('/api/patch',{token:b,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ra:1,dec:2,fov:.1})})).status,429);
    assert.equal((await f.call(path+'/scene',{token:b,method:'DELETE'})).status,404);
    assert.equal((await f.call(path+'/scene',{token:a,method:'DELETE'})).status,200);assert.equal(f.admission.busy,true);
    await new Promise(r=>setTimeout(r,100));assert.equal(f.admission.busy,false);
    assert.equal((await f.call(path+'/result.json')).status,200);
  }finally{await f.close();}
});
