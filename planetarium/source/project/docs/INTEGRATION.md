# Planetarium integration

The portal serves the built app at `planetarium/?embed=1`. The approved V2 theme and SPHEREx background are combined with the precision engine, matching source and calibrated catalogue recorded in `provenance/precision-source-manifest.json`.

Only messages from `window.parent` at the same origin are accepted. Child messages use that exact origin. The portal owns the shared tutorial; the child does not boot a second guide.

| Direction | Message | Data |
| --- | --- | --- |
| Child → portal | `spherex-planetarium-ready` | `state` |
| Child → portal | `spherex-planetarium-analyze` | `target` |
| Child → portal | `spherex-planetarium-share` | `query`, portal `url` |
| Child → portal | `spherex-planetarium-home` | — |
| Child → portal | `spherex-tutorial-open` | `page: planetarium` |
| Portal → child | `spherex-planetarium-visibility` | `paused` |
| Portal → child | `spherex-planetarium-state-request` | optional `requestId` |
| Child → portal | `spherex-planetarium-state` | `requestId`, `state` |
| Portal → child | `spherex-planetarium-restore` | `state` query object/string, optional `requestId` |
| Child → portal | `spherex-planetarium-restored` / `spherex-planetarium-error` | `requestId`, state or message |

State has a `query` object containing lat/lon/place, frame, view, UTC time, speed, FOV degrees, yaw/pitch degrees and enabled layers. Invalid query fields are discarded. Empty layers means all optional layers off. Restore is sequential to avoid projection-transition races. A blank portal route should preserve the retained sky rather than restoring defaults.

Region selection sends `ra`, `dec` in degrees, `frame: ICRS`, `fovArcsec`, `fovDeg`, `observationMjd`, `coordinateEpoch` ISO UTC, `timeScale: UTC`, `observer: earth`. The standalone analysis URL's `fov` parameter is **degrees**, while `fovArcsec` retains the exact original size. Moving selected objects send `moving: true, frame: apparent-ICRF`; do not silently relabel these as ICRS or claim archive trajectory tracking. The analysis UI must explain its fixed-field limitation.

`window.__stellariumIntegration` exposes `getState`, `restoreState`, `setPaused`, and `focusObject` to the same-origin host. A pause cancels the region preview, status timer and native render loop while preserving selection and sky state. Resume does not rearm region selection.

Validation: `node scripts/build.mjs`, then `node --test tests/*.test.mjs`. Numerical checks exercise the actual shipped WASM with independent ERFA and HIP2 fixtures. Their error bounds quantify conversion agreement, not the instrument's astrometric uncertainty. Corresponding engine source and source ZIP remain part of the build.
