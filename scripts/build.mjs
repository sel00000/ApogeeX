import { cp, mkdir, rename, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { projectRoot, insideRoot } from './paths.mjs';
import { npm, run } from './process.mjs';
import { publicConfig } from './public-config.mjs';
const stage = insideRoot(`.build-${process.pid}`), output = insideRoot('dist'), previous = insideRoot('.previous-dist');
const exists = file => stat(file).then(() => true, () => false);
await mkdir(stage, { recursive: false });
try {
  const { exportAsteroidCatalog } = await import('../services/gateway/asteroid-export.mjs');
  await exportAsteroidCatalog({ projectRoot });
  await run(process.execPath, ['scripts/build.mjs'], { cwd: join(projectRoot, 'apps/planetarium') });
  await npm(['run', 'build'], { cwd: join(projectRoot, 'apps/analysis') });
  await npm(['run', 'build'], { cwd: join(projectRoot, 'apps/asteroids') });
  await npm(['run', 'build'], { cwd: join(projectRoot, 'packages/search') });
  const excluded = new Set(['node_modules', 'dist', '.git', '.venv', '__pycache__', 'tests', 'verification', 'package.json', 'package-lock.json', 'server.py', 'launch_preview.py', 'Start-Web.cmd']);
  const filter = path => !excluded.has(basename(path)) && !/\.test\.(?:mjs|js|ts)$/.test(path);
  for (const name of ['index.html','app.js','routing.js','styles.css','glass.js','home-background.js','home-waveform.js','home-story.js','i18n.js','i18n','adapters','assets','vendor','moving']) {
    await cp(join(projectRoot, 'apps/portal', name), join(stage, name), { recursive: true, filter });
  }
  for (const name of ['planetarium', 'analysis', 'asteroids']) await cp(join(projectRoot, 'apps', name, 'dist'), join(stage, name), { recursive: true });
  await cp(join(projectRoot, 'packages/search/dist'), join(stage, 'search'), { recursive: true });
  await cp(join(projectRoot, 'packages/tutorial'), join(stage, 'tutorial'), { recursive: true, filter });
  await cp(join(projectRoot, 'packages/contracts'), join(stage, 'contracts'), { recursive: true, filter });
  for (const name of ['LICENSE','THIRD_PARTY_NOTICES.md']) if(await exists(join(projectRoot,'apps/analysis',name))) await cp(join(projectRoot,'apps/analysis',name),join(stage,'analysis',name));
  await writeFile(join(stage, 'config.json'), JSON.stringify(await publicConfig(projectRoot)));
  await writeFile(join(stage, '.nojekyll'), '');
  await writeFile(join(stage, 'build-info.json'), JSON.stringify({ version: '5.0.0', builtAt: new Date().toISOString(), modules: ['portal', 'planetarium', 'analysis', 'asteroids', 'search', 'tutorial'] }, null, 2));
  for (const required of ['index.html','analysis/index.html','planetarium/index.html','asteroids/index.html','search/search.js','tutorial/boot.js']) {
    if (!(await exists(join(stage, required)))) throw new Error(`Missing build artifact: ${required}`);
  }
  if (await exists(previous)) await rm(previous, { recursive: true, force: true });
  if (await exists(output)) await rename(output, previous);
  try { await rename(stage, output); } catch (error) { if (await exists(previous)) await rename(previous, output); throw error; }
  if (await exists(previous)) await rm(previous, { recursive: true, force: true });
  async function size(path) { let files = 0, bytes = 0; for (const entry of await readdir(path, { withFileTypes: true })) { const p = join(path, entry.name); if (entry.isDirectory()) { const s = await size(p); files += s.files; bytes += s.bytes; } else { files++; bytes += (await stat(p)).size; } } return { files, bytes }; }
  const totals = await size(output);
  console.log(`SPHEREx Sky Lab v5.0.0 built: ${totals.files} files, ${(totals.bytes/1048576).toFixed(1)} MiB.\nRun npm run preview.`);
} finally { if (await exists(stage)) await rm(stage, { recursive: true, force: true }); }
