/** Run the authoritative original numerical and background regression tests,
 * unchanged, against the byte-identical copied production implementation. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
for(const name of ['bbh-physics','bbh-eob','bbh-sim','eob-integration','background-regressions','bbh-nr-id'])require('../assets/blackhole/tests/'+name+'.test.cjs');
