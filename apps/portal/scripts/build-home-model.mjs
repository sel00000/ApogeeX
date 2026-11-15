// Bundles home-src/mission-model.js with the vendored Three.js r180 (vendor/three, MIT)
// into one minified module: assets/model/mission-model.js. Uses the analysis app's Vite.
// Run: node scripts/build-home-model.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(pathToFileURL(path.join(root, '../analysis/node_modules/vite/dist/node/index.js')).href);
await build({
  configFile: false, logLevel: 'warn', root,
  resolve: { alias: [
    { find: /^three\/addons\/(.*)$/, replacement: path.join(root, 'vendor/three/examples/jsm/$1') },
    { find: /^three$/, replacement: path.join(root, 'vendor/three/build/three.module.js') },
  ] },
  build: {
    outDir: path.join(root, 'assets/model'), emptyOutDir: false, minify: true, sourcemap: false, target: 'es2022',
    lib: { entry: path.join(root, 'home-src/mission-model.js'), formats: ['es'], fileName: () => 'mission-model.js' },
  },
});
fs.copyFileSync(path.join(root, 'vendor/three/LICENSE'), path.join(root, 'assets/model/THREE-LICENSE.txt'));
const size = fs.statSync(path.join(root, 'assets/model/mission-model.js')).size;
console.log(`assets/model/mission-model.js ${(size / 1024).toFixed(0)} KiB`);
