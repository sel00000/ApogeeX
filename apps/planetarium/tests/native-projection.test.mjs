import test from 'node:test';
import assert from 'node:assert/strict';
import {checkNativeProjection} from '../scripts/check-native-projection.mjs';

test('shipped native renderer and click inverse agree at Mollweide poles, seams, flips and portrait sizes',async()=>{
  const report=await checkNativeProjection();
  assert(report.cases>=800);
  assert(report.maxPixelError<2e-5);
  assert(report.maxRoundTripArcsec<0.005);
});
