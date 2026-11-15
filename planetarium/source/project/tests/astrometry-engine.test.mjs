import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAstrometry} from '../scripts/check-astrometry.mjs';

test('shipped WASM recovers catalog and moving-star astrometry against an independent ERFA oracle',async()=>{
  const report=await checkAstrometry();
  assert.equal(report.counts.catalogDateCases,12);
  assert.equal(report.counts.clickCases,192);
  assert.equal(report.counts.regionCornerCases,768);
  assert.equal(report.counts.nativeMovingStarCases,12);
  assert.equal(report.counts.movingStarClickCases,24);
  assert(report.maximumErrorsArcsec.beforeCorrection>10,'must detect the old apparent-coordinate error');
});
