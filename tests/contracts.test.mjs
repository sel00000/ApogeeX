import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSelection, angularDistanceDeg } from '../packages/contracts/selection.js';
test('selection preserves physical metadata and converts arcseconds once',()=>{
  const x=normalizeSelection({ra:360.1,dec:-12,fovArcsec:180,frame:'apparent-ICRF',observationMjd:60000,timeScale:'UTC',moving:true});
  assert.ok(Math.abs(x.raDeg-.1)<1e-9);assert.equal(x.fovDeg,.05);assert.equal(x.frame,'apparent-ICRF');assert.equal(x.coordinateEpoch,null);assert.equal(x.timeScale,'UTC');
});
test('invalid or partial coordinates cannot become zero',()=>{
  for(const x of [{ra:'',dec:0},{ra:2},{ra:0,dec:91},{ra:'oops',dec:0}])assert.throws(()=>normalizeSelection(x));
});
test('angular separation wraps the RA meridian at nonzero declination',()=>{
  const d=angularDistanceDeg({raDeg:359.999,decDeg:60},{raDeg:.001,decDeg:60});assert.ok(Math.abs(d-.001)<1e-7);
});
