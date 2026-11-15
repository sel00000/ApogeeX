// Numerical regression through the actual deployed native renderer, including
// the ill-conditioned Mollweide polar caps missed by JS-forward round trips.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEngine,projectNativeView,separationArcsec} from './check-astrometry.mjs';
import {projectViewDirection} from '../src/analysis-region.js';
import {viewDirectionAtPoint} from '../src/sky-click.js';

export async function checkNativeProjection() {
  const engine=await loadEngine();
  engine.core.time_speed=0;
  const rad=Math.PI/180;
  const cases=[];
  let maxPixelError=0,maxRoundTripArcsec=0;
  for(const projection of [2,5]) {
    const latitudes=projection===5 ? [-90,-89.999999,-89.9999,-89.99,-89.95,-89.9,-85.001,-85,-84.999,-30,0,30,84.999,85,85.001,89.9,89.95,89.99,89.9999,89.999999,90] : [-45,0,45];
    const longitudes=projection===5 ? [-179.99,-90,0,90,179.99] : [-45,0,45];
    for(const [width,height] of [[1080,540],[540,1080]]) for(const [flipHorizontal,flipVertical] of [[false,false],[true,false],[false,true],[true,true]]) {
      engine.core.projection=projection;
      engine.core.fov=projection===5?2*Math.PI:160*rad;
      engine.core.flip_view_horizontal=flipHorizontal;
      engine.core.flip_view_vertical=flipVertical;
      const options={projection,width,height,fov:engine.core.fov,flipHorizontal,flipVertical};
      for(const latitude of latitudes) for(const longitude of longitudes) {
        const a=longitude*rad,d=latitude*rad;
        const v=[Math.cos(d)*Math.sin(a),Math.sin(d),-Math.cos(d)*Math.cos(a),0];
        const actual=projectNativeView(engine,v,options);
        const overlay=projectViewDirection(v,options);
        assert(actual && overlay);
        const pixelError=Math.hypot(actual.x-overlay.x,actual.y-overlay.y);
        assert(pixelError<2e-5,`Native renderer/overlay mismatch: ${JSON.stringify({options,latitude,longitude,actual,overlay,pixelError})}`);
        maxPixelError=Math.max(maxPixelError,pixelError);
        // Frame edges may differ by a few ulps; the original native pixel is
        // clamped only within that floating-point rounding band.
        const p={x:Math.max(0,Math.min(width,actual.x)),y:Math.max(0,Math.min(height,actual.y))};
        if(Math.abs(p.x-actual.x)>1e-8 || Math.abs(p.y-actual.y)>1e-8) continue;
        const recovered=viewDirectionAtPoint({...options,...p});
        assert(recovered,`Native visible point cannot be clicked: ${JSON.stringify({options,latitude,longitude,actual})}`);
        const errorArcsec=separationArcsec(v,recovered);
        // Within 0.000001 deg of a pole the common double-precision pole
        // convention deliberately drops undefined longitude (<=0.0036").
        const tolerance=Math.abs(latitude)>89.99999?0.005:0.001;
        assert(errorArcsec<tolerance,`Native projection/click mismatch ${latitude}/${longitude}: ${errorArcsec}"`);
        maxRoundTripArcsec=Math.max(maxRoundTripArcsec,errorArcsec);
        cases.push({projection,width,height,flipHorizontal,flipVertical,latitude,longitude,pixelError,errorArcsec});
      }
    }
  }
  return {method:'Actual shipped engine JS/WASM core_project_view uses the same core_get_proj_for_size + project_to_win as the renderer; compared with application overlay and click inverse.',cases:cases.length,maxPixelError,maxRoundTripArcsec,results:cases};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=await checkNativeProjection();
  if(process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:report.cases,maxPixelError:report.maxPixelError,maxRoundTripArcsec:report.maxRoundTripArcsec},null,2));
}
