2026-11-15: design approved. Native execution in isolated clone on codex/hangyeol-asteroid; no further approval for implementation required.
Ruling: use existing isolated clone rather than second worktree; only new folder changes.
Task dynamics: 8 math tests observed fail then pass; cubic Hermite endpoints/range, deterministic seed, time conversion, equatorial-to-ecliptic direction.
Final review P1: add independent spacecraft-observer astrometry rather than relying on WCS self-roundtrip.
Final review P2: guard unavailable observer mode and reset camera on target changes; quality breakdown exposes omitted observation reasons.
Final review P2: request-specific image names; two cutout-identity regression tests RED→GREEN.
Ruling: UTC->TDB interpolation uses 69.184 s offset (periodic error <2ms in supported interval); exact image epochs use Astropy. This is not used for precision image projection.
Ruling: all raw quality states remain counted in the UI; only representative prepared cutouts are image-selectable. The quality/reason breakdown prevents confusing unmeasured/bad records with confirmed detections.
Data task: 27 moving bodies, 5,550 observation rows, 53 genuine images; independent observer checks all pass. Missing CSV object recovered from SQLite.
Final P1 fixed: independent Horizons OBSERVER and exact image midpoint/WCS validation. Full bundle test passed.
Final P2 fixed: unavailable observer modes guarded; target changes reset view. Browser regression passed.
Final P2 fixed: visible full quality/unavailable breakdown; browser regression passed.
Final P2 fixed: PNG identity hashes URL+cutout params; two regression tests RED→GREEN.
Browser findings fixed: transient image network failure (2 tests RED→GREEN), mobile intrinsic grid width (browser failure then pass).
Final checks: 10 Vitest tests, 3 Python tests, tsc/Vite build, browser workflow, 1,000-rock fixture. No deferred reviewer minors.

2026-11-15 correction: user rejected target-centered imagery, crosshair-only overlay, oversized rocks and incomplete orbit visualization. Replaced with 14 fixed-sky sequences / 58 actual frames, native ePSF overlay, full reference ellipses and smaller rocks.
Ruling: keep actual individual images when no valid fixed-sky sequence exists; disable comparison-model controls. Reproject real backgrounds instead of inventing a static background. Noise/colour variation remains.
Ruling: reference ellipses are initial-epoch two-body osculating curves; time evolution remains numerical JPL states. Do not describe ellipses as precise long-term propagation.
Ruling: point-source ePSF is the appropriate photographic representation of the illustrative 3D rock; only brightness/background are fitted. Exact pixel or surface agreement is not claimed.
Fresh correction_review identified three Important issues: photo labeled model-only on fallback, delayed image overriding playback/time, stale target metadata during load. Browser reproduction failed all three before fix, passed all after. Stopped in-flight sequence also tested. Source arrays now remain paired with accepted model frames.
Deferred minor: large reduced chi-square currently has a numeric value and explanatory documentation, but no separate plain-language warning badge.

2026-11-15 observer clarification: user explicitly wants a camera flight within 3D followed by toggling the actual photograph over that same scene. DOM mirror removed; a WCS-calibrated textured mesh shares the original Three renderer. Photograph toggle never changes pose, FOV, or source time.
Ruling: preserve Horizons astrometric direction for the selected observer-mode rock, with geometric range used only for depth. It is a display of observed direction, not a new physical orbit; ordinary solar-system positions remain unchanged. Observer angular rock size is illustrative (~one image pixel), no actual size/shape claim.
Ruling: the calibrated frame is the selected cutout/reprojected WCS footprint, not the original full-detector attitude. This keeps the existing fixed-star sequence and correct sky registration.
Observer review Important: exiting observer by selecting another asteroid canceled its exit flight and left controls disabled. Reproduced in observer-selection.js (failed before fix), fixed ordering and cancellation state, now passed. Follow-flight endpoint now updates with the moving target; 30 days/sec flight test keeps target at screen center. Review docs issues fixed.
Verification: JS15 + Python5 pass. Browser flight, photo off/on, saved pose restoration, all-frame projection, mobile and follow transition pass. All 17 prepared objects / 64 exposed frames match calibrated projected direction; max instance-vs-plane error 0.00634 CSS screen pixels at 1440x960, max sky mesh/prediction error 0.0000145 image pixels. FITS mesh bake max error over111 original/prepared images 0.0000688 pixels. These are numerical coordinate checks, not independent astrometric residual/detection confirmation.
