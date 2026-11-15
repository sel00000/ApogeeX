# 한결소행성 Implementation Plan

> Agentic workers: execute task-by-task with executing-plans.

Goal: 실제 JPL 궤도와 SPHEREx 개별 관측을 연결하는 저폴리 태양계.
Architecture: Python prepares immutable local JSON/PNG from existing MOST records, Horizons and IRSA. TypeScript/Three renders cached data with demand-based frames.
Spec: ../DESIGN.md (approved 2026-11-15).

## Global constraints
Names, positions and time only. Four procedural rock shapes. Linear AU scale, illustrative body sizes. No invented detections. UTC UI/TDB dynamics, explicit coordinate frames. No extrapolation. Image cache <=8 frames. JPL serial calls.

## Review focus
- Late image responses after target changes: generation guards and bounded cache.
- Missing or bad observations: show reason, no invented measurements.
- Paused/hidden tabs: no perpetual render loop.
- Outside ephemeris range: reject/clamp user time, never extrapolate.
- Coordinate mismatch: observer ephemerides and FITS WCS, not geometric projection.

## Tasks
- [x] Data: scripts/prepare.py consumes existing CSV + JPL/IRSA; emits manifest.json, bodies.json, observations.json, images. tests/test_data.py checks independent sample interpolation and image projection roundtrip. Run Python unittest then data preparation.
- [x] Dynamics: src/math.ts exports interpolate(samples,t,out), seededRock; tests/math.test.ts verifies endpoints, cubic motion, invalid ranges. Watch tests fail then implement.
- [x] UI: src/main.ts, scene.ts, observations.ts, style.css. ESM typed contracts in types.ts. Time controls, object selection, four instanced geometries, transition and WCS-aligned overlays. Build with tsc/vite.
- [x] Verification: tests/browser.mjs exercises load, playback, target switching, observer views, cache/hidden state, reduced motion and console errors. Record screenshots/performance. Fresh final reviewer, fix important findings, document execution and limitations.

## User correction: fixed sky and real comparison (2026-11-15)

- [x] Replace target-centered cutout playback with same-sky ICRS WCS sequences from original IRSA FITS, shared footprint/stretch; validate star registration and asteroid pixel movement.
- [x] Use native FITS ePSF at fixed independent Horizons prediction; fit amplitude/background only; pack photo + model into bounded image atlases. Expose photo/model/blend and synchronized observation transport.
- [x] Remove polar grid; add batched JPL-state osculating reference ellipses, retain numerical trajectory. Shrink rocks below 1/13 Earth display radius including longest shape extent.
- [x] Fresh correction review; reproduce and fix three asynchronous/fallback UI issues. Tests include delayed image vs play and stopped pending sequence.
- [x] Rebuild local server bundle, test real data/math/browser and record new performance separately from original baseline.

## Observer camera clarification — 2026-11-15

- [x] Replace DOM image-screen substitution with a calibrated image-plane mesh in the existing solar-system scene.
- [x] Fly from arbitrary user camera pose to actual exposure spacecraft position, WCS sky direction/roll and matching angular coverage; restore the saved free pose.
- [x] Independent photo visibility/opacity; keep the same camera and illustrative asteroid when photo is off. Synchronize next exposure without restarting a flight.
- [x] Bake original FITS WCS/SIP for 111 images offline; test actual GPU instance positions against the calibrated plane across all 64 frames exposed by the UI.
- [x] Fresh observer_review: fix selection canceling exit-flight/locking controls, keep moving follow-flight endpoint on target; correct README and regeneration steps.
