// Bundles home-src/mission-model.js with the vendored Three.js r180 (vendor/three, MIT)
// into one minified module: assets/model/mission-model.js. Uses the analysis app's Vite.
// Run: node scripts/build-home-model.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(pathToFileURL(path.join(root, '../analysis/node_modules/vite/dist/node/index.js')).href);
// drop chunks from earlier builds (the hash changes when Three.js or the entries change)
for (const f of fs.readdirSync(path.join(root, 'assets/model'))) if (/^three-.*\.js$/.test(f)) fs.rmSync(path.join(root, 'assets/model', f));
await build({
  configFile: false, logLevel: 'warn', root,
  resolve: { alias: [
    { find: /^three\/addons\/(.*)$/, replacement: path.join(root, 'vendor/three/examples/jsm/$1') },
    { find: /^three$/, replacement: path.join(root, 'vendor/three/build/three.module.js') },
  ] },
  build: {
    outDir: path.join(root, 'assets/model'), emptyOutDir: false, minify: true, sourcemap: false, target: 'es2022',
    // two entries share one Three.js chunk, so the home page downloads Three.js once
    lib: { entry: { 'mission-model': path.join(root, 'home-src/mission-model.js'), 'sky-scan': path.join(root, 'home-src/sky-scan.js') }, formats: ['es'], fileName: (_, name) => `${name}.js` },
    rollupOptions: { output: { chunkFileNames: 'three-[hash].js' } },
  },
});
fs.copyFileSync(path.join(root, 'vendor/three/LICENSE'), path.join(root, 'assets/model/THREE-LICENSE.txt'));
for (const f of fs.readdirSync(path.join(root, 'assets/model')).filter(f => f.endsWith('.js'))) console.log(`assets/model/${f} ${(fs.statSync(path.join(root, 'assets/model', f)).size / 1024).toFixed(0)} KiB`);
