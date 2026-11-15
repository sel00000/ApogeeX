# README screenshots

`README.md` and `README.ko.md` show seven screenshots from this folder. Capture them from the final build (`npm run build`, then `npm run preview`, default `http://127.0.0.1:4173/`) or from the live site `https://sel00000.github.io/ApogeeX/`.

For every shot:

- Viewport 1440 x 900, device scale factor 1, the whole viewport (not the full page).
- Language English: before loading, set `localStorage['spherex-lang'] = 'en'` (or add `lang=en` to the hash once).
- Close any first-visit tutorial prompt, toast or open dialog unless the shot is about it.
- Wait until images and the sky map have finished loading (no spinners, no grey tiles).
- Save as JPEG, quality about 85, under exactly the file name given, in `docs/readme/`.
- The header menu must not contain "Space Journey".

| File | Route | What must be visible |
|---|---|---|
| `home.jpg` | `#home` | The top of the home page: header with the ApogeeX logo, the menu and the `EN \| 한` switch; the black-hole sky background; the SPHEREx model; the page title "SPHEREx for Everyone". |
| `sky-view.jpg` | `#analysis?view=sky` | The Find stage of Sky View: the SPHEREx all-sky map with constellation lines and names on, the ground view on, and the header item "Sky View" highlighted. The note "Constellation figures are a guide drawing, not SPHEREx data." should be readable. |
| `observe.jpg` | `#analysis?target=eps_indi_b` | The Observe stage for Epsilon Indi B: the blink viewer with a real exposure, the visit date and wavelength labels, and the time bar. The "Observe" button in the analysis header is on. |
| `analyse.jpg` | `#analysis?target=eps_indi_b&mode=research&tab=motion` | The Analyse stage for the same target with the positions (motion) tab open, showing at least one "SPHEREx measured" and one "External catalogue" badge. If the motion tab shows little, use `tab=spectrum` instead. |
| `orbit-3d.jpg` | `#asteroids?tab=orbit` | Orbit 3D with the Milky Way background on, the planets' orbits and a selected asteroid with its name label. Hardware WebGL if possible; with software WebGL make sure the scene is not black. |
| `search.jpg` | `#home`, then open Search in the header and type `Barnard's Star` | The search dialog with the typed query and at least one result row. No result labelled "AI-interpreted candidate" is needed. |
| `tutorial.jpg` | `#home`, then open Tutorial in the header | The tutorial dialog at the course choice, with both "General course" and "Researcher course" visible. |

Check each file with an image viewer before committing: English text only, no error banner, nothing cut off at the edges.
