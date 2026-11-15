import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { projectRoot } from './paths.mjs';
import { npm } from './process.mjs';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node.js 22.13 or newer is required.');
for (const name of ['analysis', 'asteroids']) {
  const cwd = join(projectRoot, 'apps', name), marker = join(cwd, 'node_modules', '.spherex-lock');
  const hash = createHash('sha256').update(await readFile(join(cwd, 'package-lock.json'))).digest('hex');
  const ready = await access(join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')).then(() => true, () => false);
  if (!ready || await readFile(marker, 'utf8').catch(() => '') !== hash) {
    console.log(`Installing ${name} dependencies…`);
    await npm(['ci', '--no-audit', '--no-fund'], { cwd });
    await writeFile(marker, hash);
  }
}
console.log('Web dependencies are ready. Python setup: npm run setup:python');
