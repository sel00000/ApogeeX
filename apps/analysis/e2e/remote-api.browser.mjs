// Standalone real-browser CORS check. Local fixtures only; never contacts NASA.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createServer as createViteServer} from 'vite';
import {chromium} from '@playwright/test';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(await readFile(join(root,'public/data/barnard/meta.json'),'utf8'));
const png=await readFile(join(root,'public/data/barnard',source.visits[0].png));
const n=source.wcs.size_px[0];
const binary=Buffer.from(new Float32Array(n*n).fill(7.25).buffer);
const meta={...source,id:'remote_fixture',visits:[{...source.visits[0],png:'frame.png',f32:'frame.f32'}]};
const patch='/api/observations/data/patches/remote_fixture/';
const requests=[];
let origin='',sessions=0,preflights=0,browser,vite;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const api=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  requests.push({path,method:req.method,token:req.headers['x-spherex-session']||null});
  if(path!==patch+'denied.png'){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Spherex-Session');
    res.setHeader('Vary','Origin');
  }
  if(req.method==='OPTIONS'){preflights++;res.writeHead(204);return res.end();}
  if(path==='/api/session'){sessions++;return json(res,{publicMode:true,sessionToken:'browser-fixture-owner',expiresAt:new Date(Date.now()+600000).toISOString()});}
  if(path==='/api/patch'){
    if(req.headers['x-spherex-session']!=='browser-fixture-owner')return json(res,{error:'missing owner'},401);
    return json(res,{id:'remote_fixture',status:'done',url:patch+'meta.json'});
  }
  if(path===patch+'meta.json')return json(res,meta);
  if(path===patch+'frame.png'||path===patch+'denied.png'){res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);}
  if(path===patch+'frame.f32'){res.writeHead(200,{'Content-Type':'application/octet-stream'});return res.end(binary);}
  json(res,{error:'not found'},404);
});

try{
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  const apiBase='http://127.0.0.1:'+api.address().port;
  vite=await createViteServer({root,configFile:false,appType:'custom',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'remote-api-browser-fixtures',
    configureServer(server){server.middlewares.use((req,res,next)=>{
      if(req.url==='/analysis/cors-test.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Remote API CORS test</title>');}
      if(req.url==='/config.json')return json(res,{apiBase,localServices:false});
      next();
    });},
  }]});
  await vite.listen();origin='http://127.0.0.1:'+vite.httpServer.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const external=[];page.on('request',request=>{if(![origin,apiBase].includes(new URL(request.url()).origin))external.push(request.url());});
  await page.goto(origin+'/analysis/cors-test.html');
  const checks=await page.evaluate(async()=>{
    const api=await import('/src/lib/api.ts');
    const {loadFrames}=await import('/src/lib/frames.ts');
    const job=await api.requestPatch({ra:1,dec:2},.05);
    await api.pollPatch({ra:1,dec:2},.05);
    const meta=await api.loadPatchMeta(job);
    const floats=await loadFrames(meta);
    const pngMeta=structuredClone(meta);delete pngMeta.visits[0].f32;
    const pixels=await loadFrames(pngMeta);
    const denied=structuredClone(pngMeta);denied.visits[0].png='denied.png';
    let corsRejected=false;
    try{await loadFrames(denied);}catch{corsRejected=true;}
    let pathRejected=false;
    try{await api.loadPatchMeta({...job,url:location.origin+'/api/private.json'});}catch{pathRejected=true;}
    return {jobDone:job.status==='done',remoteBase:meta.base!==undefined&&new URL(meta.base).origin!==location.origin,f32:floats[0].length===meta.wcs.size_px[0]**2&&floats[0].every(value=>value===7.25),png:pixels[0].length===meta.wcs.size_px[0]**2&&pixels[0].some(Number.isFinite),corsRejected,pathRejected};
  });
  for(const [name,value]of Object.entries(checks))assert.equal(value,true,name);
  assert.ok(preflights>=1,'actual CORS preflights');
  assert.equal(sessions,1,'one session for POST and polling');
  assert.ok(requests.filter(row=>row.path.startsWith(patch)).every(row=>!row.token),'public artifacts omit session headers');
  await page.reload();
  await page.evaluate(async()=>{const api=await import('/src/lib/api.ts');await api.pollPatch({ra:1,dec:2},.05);});
  assert.equal(sessions,1,'session owner restored after iframe/page re-entry');
  assert.deepEqual(errors,[],'no browser runtime errors');
  assert.deepEqual(external,[],'no external archive requests');
  console.log(JSON.stringify({passed:12,checks:Object.keys(checks).concat(['actual CORS preflights','one session per deployment','public artifact requests omit session headers','session owner survives re-entry','no browser runtime errors','no external archive requests']),preflights,errors},null,2));
}finally{
  await browser?.close();
  await vite?.close();
  api.closeAllConnections();await new Promise(resolve=>api.close(resolve));
}
