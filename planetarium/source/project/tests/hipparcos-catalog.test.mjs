import test from 'node:test';
import assert from 'node:assert/strict';
import {checkHipparcos} from '../scripts/check-hipparcos.mjs';

test('all HIP2 astrometry is preserved and native loaded stars match independent reference coordinates',async()=>{
  const result=await checkHipparcos();
  assert.equal(result.validatedCatalogRows,15527);
  assert.equal(result.nativeCases,18);
  assert.equal(result.clickCases,36);
});
