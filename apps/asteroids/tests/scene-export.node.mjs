import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,access,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateScene,SCENE_STAGES,validateSceneBundle} from '../scripts/generate-scene.mjs';

async function fixture(t){
 const testRoot=fileURLToPath(new URL('../.test-work/',import.meta.url));await mkdir(testRoot,{recursive:true});
 const root=await mkdtemp(join(testRoot,'scene-unit-'));
 t.after(async()=>{if(!resolve(root).startsWith(resolve(testRoot)+'\\')&&!resolve(root).startsWith(resolve(testRoot)+'/'))throw Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});});
 const sourceRoot=join(root,'raw'),sourceDir=join(sourceRoot,'246'),dbPath=join(root,'separate.sqlite'),destinationDir=join(root,'scene');
 await mkdir(sourceDir,{recursive:true});
 for(const name of ['integrated_record.json','stage1_observations.csv','stage2_spectrum.csv'])await writeFile(join(sourceDir,name),'test-only input');
 await writeFile(dbPath,'test-only database');
 return {root,sourceRoot,sourceDir,dbPath,destinationDir,python:{executable:'unused'}};
}
async function bundle(dir){
 const data={
  'manifest.json':{start:60800,end:60802,warnings:[]},
  'bodies.json':[{id:'246',kind:'asteroid',samples:[[60799,1,2,3,0,0,0],[60803,2,3,4,0,0,0]]}],
  'observations.json':[{objectId:'246',id:'observed-fixture',mjd:60801,image:null}],
  'comparisons.json':[],'sightlines.json':{},'trails.json':{},
 };
 for(const [name,value]of Object.entries(data))await writeFile(join(dir,name),JSON.stringify(value));
}
test('scene export preserves separate raw and SQLite inputs and publishes only after all stages',async t=>{
 const f=await fixture(t),seen=[];
 const result=await generateScene({...f,runStage:async(stage,{env})=>{
  seen.push(stage);assert.equal(env.SPHEREX_SCENE_SOURCE,await realpath(f.sourceRoot));assert.equal(env.SPHEREX_SCENE_DB,await realpath(f.dbPath));
  assert.match(env.SPHEREX_SCENE_SOURCE_COMMIT,/^analysis-[a-f0-9]{20}$/);
  await assert.rejects(access(f.destinationDir));
  if(stage===SCENE_STAGES.at(-1))await bundle(env.SPHEREX_SCENE_OUT);
 }});
 assert.deepEqual(seen,SCENE_STAGES);assert.equal(result.counts.asteroids,1);
 const manifest=JSON.parse(await readFile(result.manifestPath,'utf8'));
 assert.equal(manifest.status,'ready');assert.ok(manifest.artifacts['bodies.json']);assert.ok(manifest.input.sqliteSha256);
 await assert.rejects(generateScene({...f}),/already exists/);
});
test('a failed stage leaves scientific inputs intact and no half-published scene',async t=>{
 const f=await fixture(t);
 await assert.rejects(generateScene({...f,runStage:async()=>{throw Error('fixture upstream unavailable');}}),/upstream unavailable/);
 await assert.rejects(access(f.destinationDir));assert.equal(await readFile(f.dbPath,'utf8'),'test-only database');
 assert.equal((await readdir(f.root)).some(name=>name.startsWith('.scene-build-')),false);
});
test('cancellation prevents publication even when a stage returns successfully',async t=>{
 const f=await fixture(t),controller=new AbortController();
 await assert.rejects(generateScene({...f,signal:controller.signal,runStage:async()=>controller.abort(Error('cancelled fixture'))}),/cancelled fixture/);
 await assert.rejects(access(f.destinationDir));
});
test('bundle validation rejects mismatched object IDs and image traversal',async t=>{
 const f=await fixture(t);await mkdir(f.destinationDir);await bundle(f.destinationDir);
 await writeFile(join(f.destinationDir,'observations.json'),JSON.stringify([{objectId:'433',mjd:60801,image:null}]));
 await assert.rejects(validateSceneBundle(f.destinationDir),/identities differ/);
 await writeFile(join(f.destinationDir,'observations.json'),JSON.stringify([{objectId:'246',mjd:60801,image:{path:'../outside.png'}}]));
 await assert.rejects(validateSceneBundle(f.destinationDir),/Invalid scene image/);
});
