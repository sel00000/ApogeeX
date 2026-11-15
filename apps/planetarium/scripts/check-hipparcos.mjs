// Read the shipped EPH bytes with the rebuilt native C loader and compare
// selection/click coordinates to independent HIP2/PyERFA reference values.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,inflateSync} from 'node:zlib';
import {loadEngine,separationArcsec,projectNativeView} from './check-astrometry.mjs';
import {targetFromApparentVector,buildAnalysisUrl} from '../src/analysis-target.js';
import {targetAtSkyPoint} from '../src/sky-click.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const RAD=Math.PI/180;

export function readEphStars(file) {
  const all=fs.readFileSync(file); assert.equal(all.subarray(0,4).toString(),'EPHE');
  const stars=[];
  for(let offset=8;offset<all.length;) {
    const type=all.subarray(offset,offset+4).toString(),size=all.readUInt32LE(offset+4);
    const p=all.subarray(offset+8,offset+8+size);offset+=size+12;
    if(type!=='STAR')continue;
    const flags=p.readInt32LE(12),rowSize=p.readInt32LE(16),ncol=p.readInt32LE(20),nrow=p.readInt32LE(24);
    const cols=[];
    for(let i=0;i<ncol;i++) {
      const k=28+20*i;
      cols.push({name:p.subarray(k,k+4).toString().replace(/\0+$/,''),type:p.subarray(k+4,k+5).toString(),unit:p.readInt32LE(k+8),offset:p.readInt32LE(k+12),size:p.readInt32LE(k+16)});
    }
    const compStart=28+20*ncol;
    let raw=inflateSync(p.subarray(compStart+8,compStart+8+p.readInt32LE(compStart+4)));
    assert.equal(raw.length,rowSize*nrow);
    if(flags&1) {
      const unshuffled=Buffer.alloc(raw.length);
      for(let row=0;row<nrow;row++)for(let byte=0;byte<rowSize;byte++)unshuffled[row*rowSize+byte]=raw[byte*nrow+row];
      raw=unshuffled;
    }
    for(let row=0;row<nrow;row++) {
      const entry={};
      for(const c of cols) {
        const o=row*rowSize+c.offset;
        entry[c.name]=c.type==='f'?(c.size===8?raw.readDoubleLE(o):raw.readFloatLE(o)):
          c.type==='i'?raw.readInt32LE(o):c.type==='Q'?raw.readBigUInt64LE(o).toString():raw.subarray(o,o+c.size).toString().replace(/\0+$/,'');
      }
      stars.push({values:entry,columns:cols,file});
    }
  }
  return stars;
}

export async function checkHipparcos() {
  const skydata=path.join(root,'vendor/stellarium-web-engine/apps/test-skydata');
  const catalogText=gunzipSync(fs.readFileSync(path.join(root,'catalogs/hipparcos2-astrometry.tsv.gz'))).toString();
  const catalog=new Map(catalogText.split(/\r?\n/).filter(line=>/^\s*\d+\t/.test(line)).map(line=>{
    const [hip,ra,dec,plx,pmra,pmdec]=line.split('\t').map(Number);return[hip,{ra,dec,plx,pmra,pmdec}];
  }));
  const stats=JSON.parse(fs.readFileSync(path.join(root,'catalogs/hipparcos2-update-report.json'),'utf8'));
  const records=[];
  for(const order of fs.readdirSync(path.join(skydata,'stars')).filter(x=>x.startsWith('Norder'))) {
    for(const dir of fs.readdirSync(path.join(skydata,'stars',order)).filter(x=>x.startsWith('Dir'))) {
      for(const file of fs.readdirSync(path.join(skydata,'stars',order,dir)).filter(x=>x.endsWith('.eph'))) records.push(...readEphStars(path.join(skydata,'stars',order,dir,file)));
    }
  }
  const byHip=new Map();
  for(const record of records) {
    const v=record.values,c=catalog.get(v.hip);assert(c,`HIP ${v.hip} missing authoritative row`);
    assert(!byHip.has(v.hip),`Duplicate HIP ${v.hip}`);byHip.set(v.hip,record);
    for(const key of ['ra','de','plx','pra','pde','epoc'])assert.equal(record.columns.find(col=>col.name===key).size,8);
    assert.equal(v.ra,c.ra*RAD);assert.equal(v.de,c.dec*RAD);assert.equal(v.plx,c.plx/1000);
    assert.equal(v.pra,c.pmra*RAD/3600000);assert.equal(v.pde,c.pmdec*RAD/3600000);
    assert.equal(v.epoc,stats.encodedEpochBesselian);
  }
  assert.equal(records.length,15527);assert.equal(catalog.size,15527);
  const oracle=JSON.parse(fs.readFileSync(path.join(root,'catalogs/hipparcos2-validation.json'),'utf8'));
  const trace=[];
  const e=await loadEngine({assetRoot:skydata,assetTrace:trace});
  e.core.time_speed=0;e.observer.latitude=37.5665*RAD;e.observer.longitude=126.978*RAD;e.observer.elevation=0;
  e.core.stars.addDataSource({url:'https://astrometry-fixture.invalid/stars'});
  const names=new Map(oracle.stars.map(s=>[s.hip,byHip.get(s.hip).values.ids.split('|')[0] || `HIP ${s.hip}`]));
  const objects=new Map();
  for(let attempt=0;attempt<100 && objects.size<names.size;attempt++) {
    await new Promise(setImmediate);e._core_update();
    // core_search is case-insensitive: variable '* S Car' and Bayer '* s Car'
    // are distinct objects. Resolve exact designations from the native list.
    // Collect native pointers before constructing wrappers: the legacy JS
    // listObjs helper reuses a callback-global array inside its constructor.
    const pointers=[];
    const callback=e.addFunction((_user,pointer)=>{pointers.push(pointer);return 0;},'iii');
    e._module_list_objs2(e.core.stars.v,e.observer.v,8,0,callback);
    e.removeFunction(callback);
    for(const pointer of pointers) {
      const obj=new e.SweObj(pointer),designations=obj.designations();
      for(const [hip,name]of names)if(!objects.has(hip)&&designations.includes(name)){obj.retain();objects.set(hip,obj);}
    }
  }
  assert.equal(objects.size,names.size,`Native catalog did not load all targets: ${JSON.stringify(trace)}`);
  const results=[];
  for(const item of oracle.cases) {
    e.observer.utc=item.utcMjd;e._observer_update(e.observer.v,0);
    const obj=objects.get(item.hip),native=obj.getInfo('radec',e.observer);
    const selected=targetFromApparentVector(e,native,item.star);
    const row={star:item.star,hip:item.hip,utc:item.utc,expectedRa:item.ra,expectedDec:item.dec,
      selectedRa:selected.ra,selectedDec:selected.dec,
      selectedErrorArcsec:separationArcsec(selected,item.astrometricVector),maxClickErrorArcsec:0,maxUrlErrorArcsec:0};
    assert(row.selectedErrorArcsec<0.01,`Native HIP2 selection: ${JSON.stringify(row)}`);
    for(const projection of [2,5]) {
      e.core.projection=projection;e.core.fov=projection===2?10*RAD:2*Math.PI;
      e.core.flip_view_horizontal=false;e.core.flip_view_vertical=false;
      e.lookAt(e.convertFrame(e.observer,'ICRF','MOUNT',native),0);
      e.observer.yaw+=0.5*RAD;e.observer.pitch-=0.3*RAD;e._observer_update(e.observer.v,0);
      const width=1280,height=projection===2?720:640;
      const point=projectNativeView(e,e.convertFrame(e.observer,'ICRF','VIEW',native),{width,height});
      const target=targetAtSkyPoint(e,point,{getBoundingClientRect:()=>({width,height})});
      const error=separationArcsec(target,item.astrometricVector);
      row.maxClickErrorArcsec=Math.max(row.maxClickErrorArcsec,error);
      assert(error<0.02,`Native HIP2 click: ${JSON.stringify(row)}`);
      const params=new URL(buildAnalysisUrl({...target,fovArcsec:180},'https://example.test/planetarium/')).searchParams;
      const urlError=separationArcsec({ra:Number(params.get('ra')),dec:Number(params.get('dec'))},item.astrometricVector);
      row.maxUrlErrorArcsec=Math.max(row.maxUrlErrorArcsec,urlError);assert(urlError<0.02);
    }
    results.push(row);
  }
  return{generatedAt:new Date().toISOString(),validatedCatalogRows:records.length,nativeCases:results.length,clickCases:2*results.length,
    method:'Actual shipped EPH bytes through native C loader and WASM, compared against independent HIP2/PyERFA oracle; no mocked coordinates',
    source:'VizieR I/311/hip2 (van Leeuwen 2007)',results,
    maximumErrorsArcsec:{selected:Math.max(...results.map(r=>r.selectedErrorArcsec)),click:Math.max(...results.map(r=>r.maxClickErrorArcsec)),analysisUrl:Math.max(...results.map(r=>r.maxUrlErrorArcsec))},
    limits:['These are numerical conversion/model agreement errors, not catalog or SPHEREx instrument astrometric uncertainties.',
      'Native model assumes zero radial velocity; nonpositive parallax uses angular proper motion without fabricated distance or annual parallax.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const report=await checkHipparcos();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({validatedCatalogRows:report.validatedCatalogRows,nativeCases:report.nativeCases,clickCases:report.clickCases,maximumErrorsArcsec:report.maximumErrorsArcsec},null,2));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
