import { join } from 'node:path';
import { projectRoot } from './paths.mjs';
import { run, npm } from './process.mjs';
// Run after npm run build: native/source audits also verify shipped dist files.
await run(process.execPath,['--test','tests/*.test.mjs','services/gateway/*.test.mjs'],{cwd:projectRoot});
await npm(['test'],{cwd:join(projectRoot,'packages/search')});
await run(process.execPath,['--test','packages/tutorial/*.test.mjs'],{cwd:projectRoot});
await npm(['test'],{cwd:join(projectRoot,'apps/portal')});
await npm(['test'],{cwd:join(projectRoot,'apps/planetarium')});
await npm(['test','--','--run'],{cwd:join(projectRoot,'apps/analysis')});
await npm(['test','--','--run'],{cwd:join(projectRoot,'apps/asteroids')});
await npm(['run','test:scene'],{cwd:join(projectRoot,'apps/asteroids')});
