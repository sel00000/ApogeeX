// Numerical regression through the shipped WASM, independent PyERFA oracle,
// real catalog star models, and the application click/region/link functions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {targetAtSkyPoint} from '../src/sky-click.js';
import {fieldRegionAroundTarget, tangentFieldDirection} from '../src/analysis-region.js';
import {targetFromApparentVector, buildAnalysisUrl} from '../src/analysis-target.js';

const RAD=Math.PI/180;
const AS=3600/RAD;
export function separationArcsec(a,b) {
  const av=Array.isArray(a)?a:[Math.cos(a.dec*RAD)*Math.cos(a.ra*RAD),Math.cos(a.dec*RAD)*Math.sin(a.ra*RAD),Math.sin(a.dec*RAD)];
  const bv=Array.isArray(b)?b:[Math.cos(b.dec*RAD)*Math.cos(b.ra*RAD),Math.cos(b.dec*RAD)*Math.sin(b.ra*RAD),Math.sin(b.dec*RAD)];
  const cross=[av[1]*bv[2]-av[2]*bv[1],av[2]*bv[0]-av[0]*bv[2],av[0]*bv[1]-av[1]*bv[0]];
  return Math.atan2(Math.hypot(...cross),av[0]*bv[0]+av[1]*bv[1]+av[2]*bv[2])*AS;
}

export async function loadEngine({assetRoot,assetTrace=[]}={}) {
  const enginePath=fileURLToPath(new URL('../engine/stellarium-web-engine.js',import.meta.url));
  const mod={exports:{}};
  // The distributed build is UMD, inside an ESM project. Evaluate its original
  // CommonJS entry without modifying the bundle and pass the actual WASM bytes.
  // Native C asset loading uses XMLHttpRequest in the web build. The offline
  // numerical harness supplies only filesystem bytes at one reserved origin;
  // it does not mock the catalog parser, astrometry, or sky projection.
  class LocalAssetRequest {
    open(method,url) { this.url=new URL(url); assetTrace.push(url); assert.equal(method,'GET'); }
    send() {
      setImmediate(()=>{
        try {
          assert(assetRoot && this.url.origin==='https://astrometry-fixture.invalid');
          const file=path.resolve(assetRoot,decodeURIComponent(this.url.pathname).replace(/^\//,''));
          assert(file.startsWith(path.resolve(assetRoot)+path.sep));
          const bytes=fs.readFileSync(file);
          this.response=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
          this.status=200;
        } catch (error) {assetTrace.push(String(error));this.status=404;this.statusText='Fixture asset unavailable';}
        this.onload?.({});
      });
    }
    abort() {this.onabort?.({});}
  }
  new Function('module','exports','require','__filename','__dirname','XMLHttpRequest',fs.readFileSync(enginePath,'utf8'))(
    mod,mod.exports,createRequire(import.meta.url),enginePath,path.dirname(enginePath),LocalAssetRequest);
  return mod.exports({wasmBinary:fs.readFileSync(enginePath.replace(/\.js$/,'.wasm')),print:()=>{},printErr:()=>{}});
}

// Call the actual shipped C renderer projection. The forward pixels must not
// be synthesized by the same JS maths whose inverse is under test.
export function projectNativeView(engine, vector, {width,height}) {
  assert.equal(typeof engine._core_project_view,'function','Rebuild the native engine with core_project_view');
  const input=engine._malloc(24),output=engine._malloc(24);
  try {
    engine.HEAPF64.set(vector.slice(0,3),input/8);
    if (!engine._core_project_view(width,height,input,output)) return null;
    return {x:engine.HEAPF64[output/8],y:engine.HEAPF64[output/8+1]};
  } finally {engine._free(input);engine._free(output);}
}

export async function checkAstrometry() {
  const oracle=JSON.parse(fs.readFileSync(new URL('./fixtures/astrometry-stars.json',import.meta.url),'utf8'));
  const engine=await loadEngine();
  engine.core.time_speed=0;
  engine.observer.latitude=oracle.observer.latitudeDeg*RAD;
  engine.observer.longitude=oracle.observer.longitudeDeg*RAD;
  engine.observer.elevation=oracle.observer.elevationM;
  engine.core.mount_frame=engine.FRAME_ICRF;
  const results=[];
  const corners=[[90,90],[-90,90],[-90,-90],[90,-90]];
  let clickCases=0;
  let cornerCases=0;
  for (const entry of oracle.cases) {
    engine.observer.utc=entry.utcMjd;
    engine._observer_update(engine.observer.v,0);
    const apparent=engine.convertFrame(engine.observer,'ASTROM','ICRF',entry.astrometricVector);
    const inverse=targetFromApparentVector(engine,entry.apparentVector,entry.star);
    const row={star:entry.star,utc:entry.utc,
      oracleForwardErrorArcsec:separationArcsec(apparent,entry.apparentVector),
      oracleInverseErrorArcsec:separationArcsec(inverse,entry.astrometricVector),
      oldUncorrectedErrorArcsec:separationArcsec(apparent,entry.astrometricVector),
      maxClickErrorArcsec:0,maxRegionCornerErrorArcsec:0,maxAnalysisUrlErrorArcsec:0};
    assert(row.oracleForwardErrorArcsec<0.01,`WASM vs independent ERFA forward: ${JSON.stringify(row)}`);
    assert(row.oracleInverseErrorArcsec<0.01,`WASM vs independent ERFA inverse: ${JSON.stringify(row)}`);
    for (const projection of [2,5]) {
      const width=projection===2?1280:1080;
      const height=projection===2?720:540;
      engine.core.projection=projection;
      engine.core.fov=projection===2?60*RAD:2*Math.PI;
      const canvas={getBoundingClientRect:()=>({width,height})};
      for (const offCenter of [false,true]) {
        engine.lookAt(engine.convertFrame(engine.observer,'ASTROM','MOUNT',entry.astrometricVector),0);
        if (offCenter) {engine.observer.yaw+=5*RAD; engine.observer.pitch-=3*RAD;}
        engine._observer_update(engine.observer.v,0);
        for (const [flipHorizontal,flipVertical] of [[false,false],[true,false],[false,true],[true,true]]) {
          engine.core.flip_view_horizontal=flipHorizontal;
          engine.core.flip_view_vertical=flipVertical;
          const opts={width,height,fov:engine.core.fov,projection,flipHorizontal,flipVertical};
          // Project the independently computed apparent ray through the native
          // observer rotation, not the ASTROM inverse being tested.
          const view=engine.convertFrame(engine.observer,'ICRF','VIEW',entry.apparentVector);
          const point=projectNativeView(engine,view,opts);
          assert(point && point.x>=0 && point.y>=0 && point.x<=width && point.y<=height);
          const target=targetAtSkyPoint(engine,point,canvas);
          assert(target);
          const err=separationArcsec(target,entry.astrometricVector);
          row.maxClickErrorArcsec=Math.max(row.maxClickErrorArcsec,err);
          assert(err<0.02,`Click ${entry.star} ${entry.utc}, projection ${projection}: ${err} arcsec`);
          const url=buildAnalysisUrl({...target,fovArcsec:180},'https://example.test/planetarium/');
          const params=new URL(url).searchParams;
          const transmitted={ra:Number(params.get('ra')),dec:Number(params.get('dec'))};
          const urlErr=separationArcsec(transmitted,entry.astrometricVector);
          row.maxAnalysisUrlErrorArcsec=Math.max(row.maxAnalysisUrlErrorArcsec,urlErr);
          assert(urlErr<0.02 && params.get('fovArcsec')==='180' && params.get('fov')==='0.05');
          clickCases++;
          const region=fieldRegionAroundTarget(engine,target,canvas,180);
          assert(region);
          for (let i=0;i<4;i++) {
            const recovered=targetAtSkyPoint(engine,region.corners[i],canvas);
            const expected=tangentFieldDirection(target,...corners[i]);
            const cornerErr=separationArcsec(recovered,expected);
            row.maxRegionCornerErrorArcsec=Math.max(row.maxRegionCornerErrorArcsec,cornerErr);
            assert(cornerErr<0.02,`TAN corner ${entry.star}: ${cornerErr} arcsec`);
            cornerCases++;
          }
        }
      }
    }
    results.push(row);
  }
  const moving=[];
  let movingStarClickCases=0;
  for (const entry of oracle.movingStarCases) {
    const catalog=oracle.stars.find(s=>s.name===entry.star);
    engine.observer.utc=entry.utcMjd;
    engine._observer_update(engine.observer.v,0);
    // A real native star object performs the same proper-motion/parallax and
    // apparent-position pipeline as the sky renderer. RV=0 is the bundled
    // engine's documented implementation limit, also explicit in the oracle.
    const star=engine.createObj('star',{names:[catalog.name],model_data:{
      ra:catalog.ra,de:catalog.dec,pm_ra:catalog.pmRaCosDecMasYr,
      pm_de:catalog.pmDecMasYr,plx:catalog.parallaxMas,epoch:catalog.modelEpoch,Vmag:1,
    }});
    const rendered=star.getInfo('radec',engine.observer);
    const selected=targetFromApparentVector(engine,rendered,catalog.name);
    const row={star:entry.star,utc:entry.utc,
      apparentErrorArcsec:separationArcsec(rendered,entry.apparentVector),
      selectedCoordinateErrorArcsec:separationArcsec(selected,entry.astrometricVector),maxClickErrorArcsec:0,
      oldUncorrectedErrorArcsec:separationArcsec(rendered,entry.astrometricVector),
      expectedRa:entry.ra,expectedDec:entry.dec,actualRa:selected.ra,actualDec:selected.dec};
    assert(row.apparentErrorArcsec<0.01,`Native star apparent vs ERFA: ${JSON.stringify(row)}`);
    assert(row.selectedCoordinateErrorArcsec<0.01,`Native selected star vs ERFA: ${JSON.stringify(row)}`);
    for (const projection of [2,5]) {
      const width=projection===2?1280:1080,height=projection===2?720:540;
      engine.core.projection=projection;
      engine.core.fov=projection===2?10*RAD:2*Math.PI;
      engine.core.flip_view_horizontal=false;
      engine.core.flip_view_vertical=false;
      engine.lookAt(engine.convertFrame(engine.observer,'ICRF','MOUNT',rendered),0);
      engine.observer.yaw+=0.5*RAD;
      engine.observer.pitch-=0.3*RAD;
      engine._observer_update(engine.observer.v,0);
      const view=engine.convertFrame(engine.observer,'ICRF','VIEW',rendered);
      const point=projectNativeView(engine,view,{width,height});
      const clicked=targetAtSkyPoint(engine,point,{getBoundingClientRect:()=>({width,height})});
      const clickError=separationArcsec(clicked,entry.astrometricVector);
      row.maxClickErrorArcsec=Math.max(row.maxClickErrorArcsec,clickError);
      assert(clickError<0.02,`Native moving-star click ${entry.star}: ${clickError} arcsec`);
      movingStarClickCases++;
    }
    moving.push(row);
  }
  const max=(items,key)=>Math.max(...items.map(r=>r[key]));
  const report={generatedAt:new Date().toISOString(),engine:'shipped stellarium-web-engine.js + .wasm, no mocked coordinate transforms',
    oracle:'independent PyERFA '+oracle.versions.pyerfa,stars:oracle.stars.map(s=>({name:s.name,ra:s.ra,dec:s.dec,epoch:s.catalogEpoch,source:s.url})),
    observer:oracle.observer,fixedCatalogDirections:results,nativeMovingStarModels:moving,
    counts:{catalogDateCases:results.length,clickCases,regionCornerCases:cornerCases,nativeMovingStarCases:moving.length,movingStarClickCases},
    maximumErrorsArcsec:{oracleForward:max(results,'oracleForwardErrorArcsec'),oracleInverse:max(results,'oracleInverseErrorArcsec'),
      click:max(results,'maxClickErrorArcsec'),analysisUrl:max(results,'maxAnalysisUrlErrorArcsec'),regionCorner:max(results,'maxRegionCornerErrorArcsec'),
      nativeSelectedStar:max(moving,'selectedCoordinateErrorArcsec'),nativeMovingStarClick:max(moving,'maxClickErrorArcsec'),beforeCorrection:max(results,'oldUncorrectedErrorArcsec')},
    limits:['These are coordinate-conversion numerical errors, not SPHEREx instrument astrometric accuracy.',
      'Fixed rays isolate reference-frame correction; native moving-star cases additionally include catalog proper motion and parallax.',
      'Native star model follows bundled engine RV=0 assumption; matching a fixed direction does not track moving objects through archive epochs.']};
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=await checkAstrometry();
  const out=process.argv[2];
  if (out) fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({counts:report.counts,maximumErrorsArcsec:report.maximumErrorsArcsec},null,2));
}
