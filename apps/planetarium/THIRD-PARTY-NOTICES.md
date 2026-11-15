# Sources and notices

- Country/territory capital coordinates: GeoNames, https://www.geonames.org/, from the daily `cities15000` and country data exports. Used under Creative Commons Attribution 4.0, https://creativecommons.org/licenses/by/4.0/. The project extracts capital records, adds Korean labels and selected qualified government-seat records, and bundles the resulting snapshot in `src/capitals.js`. Source URLs, download hashes, selection rules and reviewed changes are in `docs/CAPITALS.md`.
- Korean city labels: Natural Earth populated places, https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/. Public domain; see https://www.naturalearthdata.com/about/terms-of-use/. Neither provider endorses this application.

- Stellarium Web Engine: https://github.com/Stellarium/stellarium-web-engine
  - Source revision: `2103935134e09ba1715171241769fce03cebebe4`
  - Copyright Stellarium Labs SRL and the upstream contributors.
  - GNU Affero General Public License version 3. The complete license is in `LICENSE-AGPL-3.0.txt`.
  - The complete vendored source, including library-specific notices and the applied patches, is supplied under `source/project/vendor/stellarium-web-engine/` in the built website.
  - External source libraries retain their original notices, including ERFA, json-parser, zlib, WebP, NanoVG and md4c. Consult the corresponding `ext_src/` directories.
- Bundled stars, deep-sky objects, sky culture, landscapes and image surveys are from the same revision's `apps/test-skydata/`. Their properties and metadata remain in the distribution.
- Noto Sans fonts are supplied from the upstream `data/font/` directory with its accompanying notices. See that directory in the corresponding source.
- Optional external DSS image survey: NASA/IPAC IRSA mirror of CDS DSS2 color, https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color/properties. These image tiles are fetched on demand only when the user enables the DSS layer; they are not bundled with this application. Provider attribution remains available in the survey properties.
- The application UI and integration code in this project are distributed under AGPL-3.0-only. This application is independent and is not an official Stellarium, NASA or IRSA service.
