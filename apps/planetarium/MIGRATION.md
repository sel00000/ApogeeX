# Actual Stellarium application migration

This directory is an editable copy of `중선/v1.2.0`, not a replacement scene.
Its engine JS/WASM, original stars, deep-sky catalog, Western skyculture,
landscapes, planetary surveys, ephemerides, time/location/navigation and original
control UI are retained. `provenance/original-source-manifest.json` records all
848 source files and their SHA256 hashes before integration changes.

The original revision's root HTML labels itself v2.1.0 while its package metadata
and directory label are v1.2.0; this migration preserves the supplied code rather
than inventing a different version history.

## Build

`npm run build` packages the original application into `dist/`, including original
runtime data/fonts, the complete corresponding source, upstream notices and a
source ZIP. Serve `dist/` over HTTP; the root app embeds `dist/?embed=1`.
The compiled engine pair is unchanged and its hashes match `engine/build-info.json`.
Engine rebuilding is documented in `docs/ENGINE-BUILD.md`.

## Narrow adaptations

- `src/integration.js` supplies a same-origin embedded bridge, pause/resume and
  diagnostic state. Engine camera, selected object and time remain in a connected,
  paused iframe when the root route changes to analysis. No synthetic catalog is
  loaded by the root adapter.
- `src/analysis.js` removes the original engine's apparent ICRF aberration/deflection using its native ICRF→ASTROM conversion for distant stars and DSOs before making archive queries. Center queries use VIEW→ASTROM. This preserves the engine's selected-date proper motion/parallax; it is not a forced J2000 catalog epoch reset. Finite nearby moving objects keep the original selected-epoch apparent direction, explicitly labeled as an approximate position query, because the engine's inverse ASTROM routine only supports infinity. Renderer and native catalog coordinates are unchanged. Solar-system selections retain the
  original moving-object flag and their selected observation MJD. Standalone use
  keeps the original analysis dialog behavior.
- Only `core.milkyway`'s image survey URL changes. Original `core.stars`, `dsos`,
  `skycultures`, `planets`, `landscapes`, all projections and picking remain native.
- `src/supplemental.js` adds prepared analysis coordinates and two credited Hubble/Webb reference photos. They are observation shortcuts, never engine catalog replacements. Native distance values are read from the original engine in AU and converted to approximate light-years for display.
- `src/embedded.css` changes theme colors; controls and original functionality
  stay present. The outer application supplies shared navigation.

## TIFF background geometry and limits

`assets/spherex-original.png` is an unchanged copy of the TIFF-derived PNG supplied
in the parent project. It is not a model-generated sky. The source raster is
4160×2340, with its outer Galactic Mollweide ellipse centered at
(2079.5,1169.5), rx=2004.03385674, ry=1004.45331586. Longitude 0 is centered,
Galactic north is up, and increasing longitude is left. This is a raster
calibration of a presentation image, not a FITS WCS or a claim of subpixel astrometry.

`scripts/make-spherex-hips.py` resamples that image into equatorial HEALPix NESTED
HiPS, orders0–1, tile width512. Tiles are lossless WebP; only bilinear spatial
resampling is applied. The conversion uses the standard ICRS-to-Galactic rotation
and the exact HEALPix face geometry plus UV transpose in the vendored engine's
`algos/healpix.c`, `uv_map.c`, and `hips.c`. This engine defaults image surveys to
FRAME_ASTROM and does not consume `hips_frame`; therefore the image is actually
reprojected to equatorial tiles instead of merely relabeling Galactic ones.
The processing manifest gives source and every tile hash.

Regenerate with Python in a separate environment containing NumPy and Pillow:

```
python3 -m venv .venv-hips
.venv-hips/bin/pip install numpy pillow
.venv-hips/bin/python scripts/make-spherex-hips.py
npm run build
```

NASA/JPL-Caltech source image:
https://spherex.caltech.edu/image/spherex20251218b-spherex-all-sky-map-2025-stars-and-galaxies
The fixed SPHEREx archival image is a background; date/time changes affect the
original Stellarium stars/planets/horizon, not the observation epoch of this image.
The original native milkyway tone mapping, atmospheric modulation and small-FOV
fade still apply. Native optional DSS is preserved separately.

## License and complete source

Original application and engine retain AGPL-3.0-only and all third-party notices.
This integration code and conversion generator use the same license. The built
site exposes `source/index.html`, complete editable sources and rebuild scripts.
The unchanged upstream engine copyright/license notices remain in every file.

## Verification

`node --test tests/*.test.mjs` checks original analysis/lifecycle behavior, bridge origin/coordinate validation, unchanged engine and vendor/catalog hashes, WASM compilation, and retained UI. Geometry is checked independently against the actual compiled C HEALPix implementation with `.venv-hips/bin/python -m unittest discover -s tests -p "test_hips_geometry.py"`; this optional audit requires a C compiler, NumPy and Pillow.

The standalone analysis fallback uses URL query parameters (including embed=1 in the original dialog), prepared target identifiers and moving observation epochs, matching the integrated analysis app. The earlier original hash-based link contract is retained only in the recorded original-source manifest, not used by this migrated runtime.
