import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('provenance/precision-source-manifest.json',root),'utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');

test('matched native engine pair is byte-identical to the precision baseline and compiles',async()=>{
 const metadata=JSON.parse(await readFile(new URL('engine/build-info.json',root),'utf8'));
 for(const artifact of metadata.artifacts){
  const bytes=await readFile(new URL('engine/'+artifact.file,root));
  assert.equal(bytes.length,artifact.bytes);assert.equal(hash(bytes),artifact.sha256);
  assert.equal(hash(bytes),manifest.files.find(f=>f.path==='engine/'+artifact.file).sha256);
  assert.equal(hash(await readFile(new URL('dist/engine/'+artifact.file,root))),artifact.sha256);
  if(artifact.file.endsWith('.wasm'))assert.ok(new WebAssembly.Module(bytes));
 }
});

test('every precision-baseline vendor file and native catalog tile survives with its exact hash',async()=>{
 let files=0;
 for(const original of manifest.files.filter(f=>f.path.startsWith('vendor/'))){
  assert.equal(hash(await readFile(new URL(original.path,root))),original.sha256,original.path);
  assert.equal(hash(await readFile(new URL('dist/source/project/'+original.path,root))),original.sha256,'corresponding source '+original.path);
  const prefix='vendor/stellarium-web-engine/apps/test-skydata/';
  if(original.path.startsWith(prefix))assert.equal(hash(await readFile(new URL('dist/skydata/'+original.path.slice(prefix.length),root))),original.sha256,'runtime catalog '+original.path);
  files++;
 }
 assert.ok(files>750);
});

test('original controls remain, with the former center-only analysis replaced by the region picker',async()=>{
 const originalIds=JSON.parse(await readFile(new URL('provenance/original-control-ids.json',root),'utf8'));
 const runtime=await readFile(new URL('dist/index.html',root),'utf8');
 for(const id of originalIds.filter(id=>id!=='analyze-center'))assert.ok(runtime.includes(`id="${id}"`),id);
 for(const id of ['analysis-pick','analysis-field-size','analysis-picker-overlay'])assert.ok(runtime.includes(`id="${id}"`),id);
 const info=await stat(new URL('dist/source/stellarium-web-lab-source.zip',root));assert.ok(info.size>1_000_000);
});
