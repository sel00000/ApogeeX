<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/readme/logo-light.png">
  <img alt="ApogeeX" src="docs/readme/logo-light.png" width="320">
</picture>

<h1>SPHEREx for Everyone</h1>

<p>A public web tool that shows real NASA SPHEREx observations of one place in the sky as a time series, so that moving or changing objects stand out.</p>

<p>
<a href="https://sel00000.github.io/ApogeeX/">Live site</a> ·
<a href="README.ko.md">한국어</a> ·
<a href="#what-it-is">What it does</a> ·
<a href="#data-and-credits">Data and credits</a> ·
<a href="#use-of-ai">Use of AI</a>
</p>

</div>

<img alt="The home page of SPHEREx for Everyone" src="docs/readme/home.jpg" width="100%">

## What it is

SPHEREx for Everyone is a website built by Team ApogeeX for the NASA Space Apps Challenge 2026 challenge "Planet X and SPHEREx". You choose a place on the SPHEREx all-sky map from the NASA/IPAC Infrared Science Archive (IRSA), and the site shows the real SPHEREx exposures of that place in time order. The published site does this for five prepared targets; any other place needs the local Python service, which fetches the exposures from IRSA. Around this sit a planetarium, a 3D view of asteroid orbits linked to real SPHEREx images, a search that understands names in English and Korean, and a tutorial.

The challenge asks how SPHEREx data can help find objects that move or change. SPHEREx images the same sky again and again in many infrared wavelengths. The site puts those visits side by side, compares like with like (the same wavelengths at each visit), and measures positions, brightness and spectra for the five prepared targets: Barnard's Star, Epsilon Indi B, WISE 0855-0714, RW Aurigae and R Draconis. For other places it gives the images and their provenance only. For asteroids it places the orbit from JPL Horizons next to the SPHEREx frames in which the asteroid should appear. The site does not claim any new discovery.

For people who are not astronomers, the tutorial's general course and the plain-language screens explain what an infrared survey sees and why a blink shows motion. For researchers, every value carries its origin, the researcher course covers coordinates, raw pixels, wavelength response and uncertainties, and the analysis screens link back to the archive files they came from.

## Take the tour

<table>
<tr>
<td width="50%" valign="top"><img alt="Sky View" src="docs/readme/sky-view.jpg" width="100%"><br><b>Sky View.</b> Choose a place on the SPHEREx all-sky map, with constellation figures and a ground view; the planetarium is its second view.</td>
<td width="50%" valign="top"><img alt="Observe" src="docs/readme/observe.jpg" width="100%"><br><b>Observe.</b> Blink real exposures of the same place, like with like.</td>
</tr>
<tr>
<td width="50%" valign="top"><img alt="Analyse" src="docs/readme/analyse.jpg" width="100%"><br><b>Analyse.</b> Positions, variability, spectrum and provenance for each prepared target.</td>
<td width="50%" valign="top"><img alt="Orbit 3D" src="docs/readme/orbit-3d.jpg" width="100%"><br><b>Orbit 3D.</b> Asteroid orbits from JPL linked to real SPHEREx images, with W A S D flight against the Milky Way.</td>
</tr>
<tr>
<td width="50%" valign="top"><img alt="Search" src="docs/readme/search.jpg" width="100%"><br><b>Search.</b> Our own engine answers first; a small language model reads a sentence only when the engine cannot, and such results are labelled.</td>
<td width="50%" valign="top"><img alt="Tutorial" src="docs/readme/tutorial.jpg" width="100%"><br><b>Tutorial.</b> A general course and a researcher course, each of which can be skipped or replayed.</td>
</tr>
</table>

## What is real, and what is not

The analysis screens mark values with the badges "SPHEREx measured", "External catalogue" and "Computed · model". Drawings carry a note that they are drawings.

| Kind | Examples on the site |
|---|---|
| Measured by SPHEREx | The exposures in Sky View, Observe and Orbit 3D (NASA/IPAC IRSA, SPHEREx DR1 and QR3). Positions and proper motion measured from those images in Analyse. |
| From an external catalogue | Catalogue positions and motions from Gaia DR3, SIMBAD and Hipparcos-2. Asteroid positions and orbits from JPL Horizons. |
| Computed or modelled | Blackbody fits and band depths in the spectrum tool. The predicted asteroid position (ePSF model) laid over a SPHEREx image, and the reference orbit ellipses. |
| Illustration or guide drawing | Constellation figures and the ground in Sky View. Planet sizes and the rock shapes in Orbit 3D, and Saturn's ring, which is a schematic. The Milky Way behind Orbit 3D is the real Gaia all-sky map, but it is not SPHEREx data. |

## Languages

The site opens in English, and the `EN | 한` switch in the header turns every screen, the search and the tutorial Korean without reloading. The choice is kept in the browser under one key, `spherex-lang`, and the details are in [docs/architecture.md](docs/architecture.md).

## Run it locally

You need Node.js 22.13 or later and Python 3.11 or later. On Windows you can run `Start-Web.cmd` instead.

```sh
npm run setup          # web dependencies (npm ci in each app)
npm run setup:python   # Python environment, once
npm run build
npm run preview        # http://127.0.0.1:4173/
# or all web steps at once: npm start
npm test               # needs the Python environment
```

Without the Python services the home page, Sky View, the planetarium, the prepared targets, the prepared asteroid results and Orbit 3D, the search and the tutorial all work. Processing a new place in the sky and running a new asteroid analysis need the Python services. The published site has no Python server (`apiBase` in [deployment/public.json](deployment/public.json) is empty); see [docs/public-server.md](docs/public-server.md). The live site is published by pushing the built `dist` folder to this repository's `gh-pages` branch.

The project's earlier history is in [github.com/sel00000/Apogee](https://github.com/sel00000/Apogee).

## How it is built

```mermaid
flowchart LR
  subgraph Browser
    P[Portal<br/>apps/portal]
    A[Analysis app<br/>apps/analysis]
    PL[Planetarium<br/>apps/planetarium]
    AS[Asteroids and Orbit 3D<br/>apps/asteroids]
    S[Search<br/>packages/search]
    T[Tutorial<br/>packages/tutorial]
    P --> A
    P --> PL
    P --> AS
    P --> S
    P --> T
  end
  subgraph Local["Local services (optional)"]
    G[Node server and gateway<br/>scripts/serve.mjs, services/gateway]
    O[Observations, Python<br/>services/observations]
    AN[Asteroid analysis, Python<br/>services/asteroids]
    G --> O
    G --> AN
  end
  subgraph Outside["Outside data services"]
    IRSA[NASA/IPAC IRSA<br/>SPHEREx images]
    JPL[JPL Horizons]
    CDS[CDS SIMBAD, Sesame, VizieR]
    IM[IMCCE SsODNet]
    LLM[Language model helper<br/>trueblink.pages.dev/api/ask]
  end
  A -. /api .-> G
  AS -. /api .-> G
  A --> IRSA
  O --> IRSA
  AN --> JPL
  AN --> IRSA
  S --> CDS
  S --> IM
  S -. only when the engine cannot read a sentence .-> LLM
```

| Folder | What it holds |
|---|---|
| `apps/portal` | The home page, menus, language switch and the frame that hosts the other apps. |
| `apps/analysis` | Sky View's map and the Observe and Analyse screens (React). |
| `apps/planetarium` | The planetarium, built on the Stellarium Web Engine. |
| `apps/asteroids` | Asteroid results, observations and Orbit 3D (three.js). |
| `packages/search` | The search engine and its name index. |
| `packages/tutorial` | The two tutorial courses. |
| `packages/contracts` | The shared format of a sky selection. |
| `services` | The local Node gateway and the Python services for observations and asteroids. |
| `data/prepared` | Prepared results that ship with the site. |
| `scripts` | Setup, build, local server and tests. |
| `deployment` | Public configuration (`public.json`). |
| `docs` | Architecture, AI use, sources and these README pictures. |

## Data and credits

| Data or asset | Credit | Licence or terms | Full notice |
|---|---|---|---|
| SPHEREx images and all-sky cube (DR1, QR3, Level 2) | NASA/IPAC Infrared Science Archive (IRSA) | No licence text in this repository | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Asteroid positions and velocities | JPL Horizons (NASA/JPL) | No licence text in this repository | [apps/asteroids/README.md](apps/asteroids/README.md) |
| Milky Way background in Orbit 3D | ESA/Gaia/DPAC; acknowledgement A. Moitinho | CC BY-SA 3.0 IGO (resized and converted, a modified version) | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| Gaia DR3 positions and motions (VizieR I/355) | ESA/Gaia/DPAC, via CDS | Used for values and name look-up only | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Hipparcos-2 star positions (VizieR I/311) | F. van Leeuwen 2007, A&A 474, 653 | CDS VizieR terms | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Stellarium Web Engine and its bundled sky data | Stellarium Labs SRL and contributors | AGPL-3.0 | [apps/planetarium/THIRD-PARTY-NOTICES.md](apps/planetarium/THIRD-PARTY-NOTICES.md) |
| Constellation figures (western sky culture) | Stellarium's team | Text and data CC BY-SA | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Planet maps: Mercury, Venus, Earth, Mars, Jupiter | NASA/MESSENGER/ASU/USGS; NASA/JPL Magellan, USGS; NASA Earth Observatory, R. Stöckli; NASA Ames/USGS Viking; NASA/JPL/Space Science Institute | Public domain, NASA imagery guidelines or JPL image use policy, per file | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| Planet maps: Saturn, Uranus, Neptune | NASA/ESA Hubble, Amy Simon and the OPAL team, STScI/MAST | STScI content use policy | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| Name look-up | SIMBAD and Sesame, CDS, Strasbourg | Acknowledgement given in the notice | [packages/search/NOTICE.md](packages/search/NOTICE.md) |
| Korean object names | Wikidata and the source project's supplements | CC0 (Wikidata) | [packages/search/NOTICE.md](packages/search/NOTICE.md) |
| Solar System body look-up | IMCCE SsODNet (quaero) | No licence text in this repository | [packages/search/AI_USE.md](packages/search/AI_USE.md) |
| Capital cities in the planetarium | GeoNames; Natural Earth | CC BY 4.0; public domain | [apps/planetarium/THIRD-PARTY-NOTICES.md](apps/planetarium/THIRD-PARTY-NOTICES.md) |
| three.js | three.js authors | MIT | [apps/portal/vendor/three/LICENSE](apps/portal/vendor/three/LICENSE) |

Where a row says there is no licence text in this repository, the source is credited but its terms were not copied in.

## Use of AI

Much of the code and text was written with Anthropic's Claude, used through Claude Code, under the direction of the team; the notes below say which parts, and other AI agents reviewed that work. The English interface texts were written by the AI as translations of the team's Korean texts. At run time the search can send a sentence that its own engine cannot read to a small language model (Llama 3.1 8B on Cloudflare Workers AI); the model returns a search plan only, never objects, positions or numbers, and such results are labelled "AI-interpreted candidate". No sky image, planet map or observation on the site is AI-generated. The details are in [docs/AI_USE.md](docs/AI_USE.md), [packages/search/AI_USE.md](packages/search/AI_USE.md) and [apps/portal/moving/AI_USE-TrueBlink.md](apps/portal/moving/AI_USE-TrueBlink.md).

## Licences

There is no single licence for the whole repository. Each part carries its own.

| Part | Licence |
|---|---|
| `apps/analysis` | MIT ([LICENSE](apps/analysis/LICENSE)); files taken from TrueBlink keep Apache-2.0 ([notice](apps/analysis/THIRD_PARTY_NOTICES.md)) |
| `apps/planetarium` | AGPL-3.0-only ([LICENSE-AGPL-3.0.txt](apps/planetarium/LICENSE-AGPL-3.0.txt)) |
| `packages/search` | Apache-2.0 ([LICENSE](packages/search/LICENSE)) |
| `apps/portal/moving` | Apache-2.0 ([LICENSE](apps/portal/moving/LICENSE)) |
| `apps/portal/vendor/three` | MIT ([LICENSE](apps/portal/vendor/three/LICENSE)) |
| `apps/portal` (rest), `apps/asteroids`, `packages/tutorial`, `packages/contracts`, `services`, `scripts` | No licence stated yet |

## Team

Team ApogeeX, NASA Space Apps Challenge 2026.

Members: ______________________________
