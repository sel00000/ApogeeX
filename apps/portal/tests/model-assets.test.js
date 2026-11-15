import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const dir=new URL('../assets/model/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir),'utf8'));

test('both 3D model files match the kit manifest (sha256 and size)',()=>{
 assert.equal(manifest.revision,'panel-clearance-2');
 for(const variant of ['hero','lite']){
  const entry=manifest.models.find(m=>m.variant===variant);
  assert.ok(entry,`manifest lists ${variant}`);
  const bytes=readFileSync(new URL(`spherex-${variant}.glb`,dir));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`${variant} sha256`);
  assert.equal(bytes.length,entry.bytes,`${variant} bytes`);
 }
});

test('the home loads Lite at 700 px and below and caps the pixel ratio per variant',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/matchMedia\('\(max-width:700px\)'\)/);
 assert.match(app,/spherex-lite\.glb/);assert.match(app,/spherex-hero\.glb/);
 const model=readFileSync(new URL('../home-src/mission-model.js',import.meta.url),'utf8');
 assert.match(model,/quality === 'lite' \? 1\.25 : 1\.75/);
});
