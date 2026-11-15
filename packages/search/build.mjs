import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
if (output !== root + sep + 'dist') throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

async function compile(directory, relative = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, item.name);
    const destination = join(output, relative, item.name.replace(/\.ts$/, '.js'));
    if (item.isDirectory()) {
      await mkdir(destination, { recursive: true });
      await compile(source, join(relative, item.name));
    } else if (item.name.endsWith('.ts')) {
      const code = stripTypeScriptTypes(await readFile(source, 'utf8'), { mode: 'strip' });
      const rewritten = code.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
        (_, before, path, after) => before + (path.endsWith('.js') ? path : path + '.js') + after);
      await writeFile(destination, rewritten, 'utf8');
    }
  }
}
await compile(join(root, 'src'));
await cp(join(root, 'public'), output, { recursive: true });
for (const name of ['LICENSE', 'AI_USE.md', 'NOTICE.md']) await cp(join(root, name), join(output, name));
console.log('Search ready: dist/search.js, catalogue, and source notices.');
