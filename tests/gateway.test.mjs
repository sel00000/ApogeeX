import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSiteServer,staticPath,byteRange,listenOnAvailablePort } from '../services/gateway/server.mjs';
test('raw traversal, hidden and invalid paths are blocked',()=>{
  for(const p of ['/%2e%2e/private','/.env','/a/../secret','/a%5c..%5csecret','/C:/Windows','/%ZZ'])assert.throws(()=>staticPath(tmpdir(),p));
});
test('media byte ranges validate offsets',()=>{
  assert.deepEqual(byteRange('bytes=2-4',10),{start:2,end:4});assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});assert.equal(byteRange('bytes=30-',10),false);assert.equal(byteRange('bytes=-0',10),false);
});
test('gateway serves media, runtime config and unavailable services explicitly',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'spherex-gateway-'));await writeFile(join(dir,'index.html'),'<h1>Sky</h1>');await writeFile(join(dir,'demo.glb'),'0123456789');
  const server=createSiteServer({webRoot:dir,askUrl:'https://ask.example.org/api/ask'});const port=await listenOnAvailablePort(server,{port:0});const base=`http://127.0.0.1:${port}`;
  try{
    const r=await fetch(base+'/demo.glb',{headers:{Range:'bytes=2-4'}});assert.equal(r.status,206);assert.equal(await r.text(),'234');assert.equal(r.headers.get('content-type'),'model/gltf-binary');
    const config=await (await fetch(base+'/config.json')).json();assert.equal(config.askUrl,'https://ask.example.org/api/ask');assert.equal('experienceUrl' in config,false);
    assert.equal((await fetch(base+'/api/patch?ra=0&dec=0')).status,503);assert.equal((await fetch(base+'/api/not-real')).status,404);
    assert.equal((await fetch(base+'/.env')).status,403);
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
