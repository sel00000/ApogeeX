# Engine build provenance

## Included artifacts

The website uses the JavaScript and WebAssembly pair in `engine/`. These files were compiled from the included, patched source; they were not downloaded from a hosted Stellarium site.

- Upstream: https://github.com/Stellarium/stellarium-web-engine
- Upstream revision: `2103935134e09ba1715171241769fce03cebebe4`
- Emscripten: **1.39.17**, matching the upstream `Dockerfile.jsbuild`.
- SDK manager revision: `708dcbcc9ee23bc7d2dad44fc90db377e38b771c`
- Emscripten release: `9bc968c0e49b1c795ecddb87391b265911e2adcb`
- Build Python: 3.9.2, isolated in the SDK directory.
- SCons: 4.8.1; setuptools: 75.8.0, isolated using pip `--target`.
- SDK Node runtime: 24.19.0. The website packaging separately supports Node.js 22 or newer.
- Build command: `python -m SCons -j4 mode=release build/stellarium-web-engine.js`
- Output: the matching `stellarium-web-engine.js` and `stellarium-web-engine.wasm`; exact sizes and hashes are recorded in `engine/build-info.json` after each rebuild.

The generated `engine/build-info.json` records the output SHA256 hashes and exact tool versions. JavaScript syntax and `WebAssembly.Module` compilation were verified after the build.

## Rebuild on Windows

Ordinary UI edits and deployment only require `npm run build`. Recompile the engine when changing its C/C++ or `vendor/stellarium-web-engine/src/js` sources.

Prerequisites: Git, an available bootstrap Python with pip, an internet connection for the initial toolchain download, and several GB of free disk space. The script installs a dedicated SDK and Python dependencies in a sibling `stellarium-web-toolchain` directory. It does not change the system PATH or system Python packages.

From the project root in PowerShell:

```powershell
.\scripts\build-engine.ps1
npm run build
```

If Python is not on PATH, supply `-BootstrapPython 'C:\path\to\python.exe'`. An explicit isolated toolchain location can be chosen with `-ToolchainRoot 'C:\path\to\stellarium-web-toolchain'`. Once installed, `-SkipInstall` rebuilds without redownloading dependencies. `-Jobs 4` controls build concurrency.

The script validates the SDK revision, builds the engine, verifies the WASM header, and copies the matching pair into `engine/`. A mismatched JS/WASM pair must not be deployed.

The source ZIP distributed by the website includes the whole source tree and this script. Extract it, run `scripts/build-engine.ps1` once to generate `engine/`, and then `npm run build` to recreate the website. The original working project already includes the binaries and needs only the latter command.

## Source changes from upstream

1. **`SConstruct`**: select the Emscripten Python drivers on Windows and link through a response file to avoid Windows command-line length limits. Asset generation uses the current Python executable.
2. **`tools/make-assets.py`**: handle Windows path separators and CRLF consistently when producing embedded assets.
3. **`src/js/canvas.js`**: compare the canvas backing dimensions with rounded physical pixels, avoiding a resize on every frame at non-unit device pixel ratio. Add live `Module.maxPixelRatio` control; the app defaults to 1.5, with 1 and 2 available.
4. **`src/js/pre.js`**: request WebGL's `high-performance` power preference. The browser and operating system retain the final GPU choice.
5. **`data/font/OFL.txt`**: supply the SIL Open Font License alongside the bundled Noto Sans subset fonts. Font metadata identifies Copyright 2019 Google Inc.; license text comes from the official Google Fonts Noto Sans package.
6. **`src/modules/lines.c`**: bound grid-label intersection subdivision to 32 steps and reject nonfinite coordinates or a midpoint that cannot progress. At the Mollweide seam, screen-space endpoints may remain separated even after the spherical interval collapses. Previously this exhausted the WebAssembly call stack and stopped animation. The guard omits an unresolved border label while retaining the grid itself.

Upstream algorithm and coordinate definitions remain in the vendored source. The custom interface and integration are in the top-level `index.html` and `src/`, separately from engine internals.
