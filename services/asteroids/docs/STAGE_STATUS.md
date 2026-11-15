# Stage status (2026-11-15)

Test suite: 168 tests pass offline (`pytest`; 2026-11-15, after the shape-model reference for diameters), 8 network
tests skipped. Network tests (`pytest --run-network -m network`): run at 11:00, 6 passed and 2 failed. The solar-analog image search failed; its IRSA/Gaia modules are unchanged. 433 Eros failed C1 while the classification still took the first 120 of its 191 images; the single-season rule restores its validated sampling, and the saved-data validation of 433 again gives C1 and C7 INCONCLUSIVE. In a live re-run (fresh search and extraction, 11:59) Eros satisfies every assertion of its two tests (C2–C6 and C8 PASS, C1 INCONCLUSIVE, C7 INCONCLUSIVE with the reference best by deviance); the solar-analog search was still waiting on IRSA after 27 minutes and was stopped. Re-run of the two open tests at 12:33 with the final code (separate processes): 3 passed. Eros, both tests in 64 s with a fresh search and extraction: the same verdicts (C7 gap 4.2 to the Q-type), and the validation record it writes is byte-identical to the 11:59 one. Solar-analog search (Landolt 115-271, MJD 60830–60845): passed in 200 s.

Status values:
- **Unit-tested**: tests pass on synthetic or fixture data.
- **Real-data verified**: run on live SPHEREx DR1 / JPL data and checked against independent values.

| Stage | Unit-tested | Real-data verified | Notes |
|---|---|---|---|
| 1 Search (MOST + Horizons from SPHEREx) | yes | **yes** | Eros: 218 exposures (2026-02-01..21). SPHEREx-centred Horizons positions agree with MOST to 0.2″ and with the measured image peak to about 0.1 px. Fixed sources (calibration stars): ObsCore position query + DataLink, Gaia DR3 astrometry |
| 2 Spectral extraction | yes | **yes** | PSF fluxes agree with r = 4 px aperture sums to 1–3%. Saturated PSF cores are recorded per point (`core_flags`, reason "saturated PSF core"); on the calibration stars such wing-only points scatter 7–8% in B1/B2 against 2–3% for clean points |
| 2c Relative spectral calibration (solar analogs) | yes | **yes** | 14 solar analogs, 1657 clean points, 199/216 bins; split-sample test χ²/N = 0.91. Applied to every OBSERVED spectrum (`docs/METHODS.md` §2c) |
| 3 Reflected / thermal separation | yes | **yes** | Eros: periodic lightcurve from repeats, NEATM χ²_red 0.87; Psyche χ²_red 0.18 |
| 4 Taxonomy / minerals | yes | **partly** | Classifier calibrated by injection–recovery of 190 real SpeX spectra sampled like DR1 observations (`docs/METHODS.md` §4b), with a population, orbit and albedo prior (§4c; injections: true complex first 62% → 70%, class-balanced 54% → 65%, wrong-and-distinguished at gap 6 4.2% → 2.8%). 21 DR1 targets after the robustness fixes: reference complex first in 13 (11 of the 15 validation targets); C7 4 PASS (A, D, two V), 1 FAIL (96 Aegle, T → C), 16 INCONCLUSIVE. See "Robustness test with three added targets" |
| 5 Diameter / H / albedo | yes | **yes (D) / partly (pV)** | Diameter posterior from every point and season with a NEOWISE-based η prior (`docs/METHODS.md` §3b). 23 registered targets: median 1σ error 16% (26% before), none above 30% except a flagged prior/thermal conflict (64 Angelina); rms 0.072 dex against catalogue diameters (0.132 before); thermal diameters for 19 (10 before). Six hold-out asteroids: median error 17%, all within 2σ. Eros 2025-07: 24.1 km thermal against NEAR's volume-equivalent 16.8 km (−1.7σ). SPHEREx saw the elongated body pole-on, and the effective diameter of the NEAR shape at that geometry is 22.1 km (−0.4σ; `docs/METHODS.md` §8b). See "Diameter uncertainties" and "Shape-model reference" |
| 6 Mass / density | yes | **yes** (catalogue inputs) | ρ = M/V with SBDB GM and volume-equivalent D matches spacecraft values within 0.1–1.4% for Ceres, Vesta, Psyche, Lutetia, Ryugu and Eros, and within 3% for Bennu |
| 7 Integration / report / DB | yes | **yes** | Pipeline, report, database and dashboard run end-to-end on all targets; the report and the record state whether the solar-analog correction was applied. Figures use the dashboard's dark theme (`src/visualization/style.py`, `.streamlit/config.toml`); `analyze --from-saved` redraws them from the saved tables |

## Diameter uncertainties (2026-11-15)
**Request.** Some diameters had very wide error ranges. Find those asteroids and the cause, then apply a method that
fixes them for the registered asteroids and keeps the errors of newly added asteroids low.

**Which asteroids.** Before this change, 8 of the 23 registered targets had a 1σ error above 30%:
- thermal diameters: 236 Honoria 62 ± 27 km (44%), 216 Kleopatra 111 ± 47 km (42%), 433 Eros 27.6 ± 10.6 km (38%);
- statistical diameters: 92 Undina (38%), 764 Gedania (35%), 729 Watsonia (34%), 96 Aegle (32%), 10 Hygiea (30%).

Six more were at 25–29%. Some thermal diameters were also far off, with errors that did not cover the catalogue value:
308 Polyxo 184 ± 22 km against 129 km (−2.9σ), 387 Aquitania 185 ± 42 km against 101 km.

**Why** (error budget of the least-squares NEATM fit, re-run on the saved spectra; `docs/METHODS.md` §3b):
1. **The beaming parameter η.** With η held at its fitted value the data fix D to 1–7%. The rest came from the η
   prior: at 3.5–5 µm D ∝ η^~1.5, and the prior was the NEO relation (−30%/+50% in η).
2. **One normalisation group.** The fit used 22 of 116 points for 236 Honoria and 48 of 115 for 221 Eos, and could
   not run at all for 729 Watsonia.
3. **Visit-correlated errors counted as independent.** A normalisation error between the B5 and B6 visits then
   looked like a measured thermal colour (308 Polyxo: η 1.22 ± 0.09 → D 184 km).
4. **η at its bound** was fixed at the prior mean with the whole prior range propagated (433 Eros: ±10.6 km).
5. **One observing season.** The extraction took the first 120 images, almost always one season: 196–552 exposures per
   target were never used, often the ones closest to the Sun.
6. **Statistical diameters** rest on the albedo prior of the complex mixture (σ log pV 0.20–0.34 dex for L, C, X) and on
   a non-detection whose thermal likelihood had the broad NEO η prior.

**What was changed** (general; nothing target-specific):
- Diameter posterior on a (D, η) grid from all points: one free offset per normalisation group, a nuisance offset per
  visit with the temporal analysis' uncertainty, the continuum slope prior, and the χ² widened by κ. The colour part of
  the χ² is weighted by 1/κ (`src/physical/diameter_posterior.py`).
- η prior from ~70 000 NEOWISE fits with a free beaming parameter, by size and phase angle, ×1.12 for 3.5–5 µm (the
  ratio of the Trilling 2016 and Mainzer 2011 relations), with an extra 0.12 in ln η calibrated on these targets.
  NEOs keep Trilling 2016 (`src/physical/eta_prior.py`, `python main.py eta-prior`).
- Best diameter = posterior × population albedo prior (complex probabilities without the albedo term), unless the
  thermal diameter disagrees with the H + albedo prior (|z| ≥ 2). The albedo still uses only the thermal diameter.
- A thermal diameter (and albedo) is reported when the excess test passes or the likelihood of all points shows the
  emission (≥ 5σ and ≥ 20% of the 4.4–5 µm flux; synthetic null tests with continuum curvature: ≤ 8%).
- Every season is extracted (`validate-batch`, the validation targets and the CLI use every exposure; the dashboard
  defaults to 400, shared among seasons). The classification keeps the earliest 120 images it was validated on.
- Bug: Horizons refused chunks of identical epochs; unique epochs are queried now (773 Irmintraud had lost its whole
  geometry, so no thermal analysis was possible).
- Combined diameters whose thermal likelihood and prior disagree by |z| ≥ 3 are reported as the geometric mean of
  the two, with an interval spanning both, and flagged (64 Angelina).

**Result: registered targets** (same code for all; the "before" column is the state before this change; z =
ln(D_catalogue / D) / half-width of the 68% interval in ln D; 596 Scheila against IRAS 113 km, because SBDB's 160 km
disagrees with IRAS and with NEOWISE's fitted-η runs, 110–118 km):

| Target | Catalogue D (km) | Before: best ± 1σ (source) | z | After: best D, 68% interval (source) | z | Thermal D, 68% | pV (thermal) | Images |
|---|---|---|---|---|---|---|---|---|
| 10 Hygiea | 407.1 | 395.2 ± 1.2e+02 (30%, statistical) | +0.1 | **377** (313.2–454.7; ±19%, combined) | +0.4 | 357.3 (287.9–450.6) | 0.076 | 120 → 263 |
| 624 Hektor | 225 | 188.7 ± 47 (25%, statistical) | +0.7 | **155.3** (125.6–190.7; ±21%, combined) | +1.8 | – | – | 120 → 273 |
| 16 Psyche | 222 | 253.8 ± 64 (25%, thermal) | -0.5 | **258.7** (217.9–309.3; ±18%, combined) | -0.9 | 259.5 (212.3–321.3) | 0.087 | 120 → 295 |
| 96 Aegle | 177.8 | 122.3 ± 39 (32%, statistical) | +1.2 | **166.5** (135.4–203.4; ±20%, combined) | +0.3 | 181.1 (143.5–230.8) | 0.046 | 120 → 459 |
| 596 Scheila | 159.7 * | 88.68 ± 20 (22%, thermal) | +1.1 | **93.73** (82.21–107.5; ±13%, combined) | +1.4 | 97.06 (83.76–113.3) | 0.051 | 120 → 280 |
| 69 Hesperia | 138.1 | 92.31 ± 27 (29%, thermal) | +1.3 | **103.8** (89.15–122.3; ±16%, combined) | +1.8 | 92.7 (79.2–110.3) | 0.268 | 120 → 266 |
| 308 Polyxo | 128.6 | 184.2 ± 22 (12%, thermal) | -2.9 | **140.1** (118.4–166.3; ±17%, combined) | -0.5 | 155.7 (124.6–195.9) | 0.039 | 120 → 257 |
| 92 Undina | 126.4 | 207.8 ± 79 (38%, statistical) | -1.3 | **112** (93.98–135.5; ±19%, combined) | +0.7 | – | – | 120 → 350 |
| 216 Kleopatra | 122 | 111.4 ± 47 (42%, thermal) | +0.2 | **133.6** (115.2–157.3; ±16%, combined) | -0.6 | 131.5 (110.2–159.8) | 0.159 | 120 → 406 |
| 387 Aquitania | 100.5 | 184.9 ± 42 (23%, thermal) | -2.7 | **119.1** (101.2–141.8; ±17%, combined) | -1.0 | 108.8 (89.96–134) | 0.150 | 120 → 252 |
| 221 Eos | 95.47 | 65.48 ± 17 (26%, thermal) | +1.4 | **111.5** (96.03–132.1; ±16%, combined) | -1.0 | 112.5 (92.39–138.9) | 0.115 | 120 → 310 |
| 579 Sidonia | 85.57 | 99.31 ± 29 (29%, statistical) | -0.5 | **90.81** (78.38–106.1; ±15%, combined) | -0.4 | 87.99 (73.18–107.5) | 0.143 | 120 → 285 |
| 236 Honoria | 77.71 | 62.26 ± 27 (44%, thermal) | +0.5 | **75.05** (65.89–86.04; ±13%, combined) | +0.3 | 72.14 (61.74–84.99) | 0.180 | 120 → 359 |
| 64 Angelina | 58.29 | 94.98 ± 24 (25%, statistical) | -2.0 | **68.79** (35.28–171.9; ±99%, combined) | -0.2 | – | – | 120 → 367 |
| 764 Gedania | 58.28 | 53.31 ± 19 (35%, statistical) | +0.3 | **70.05** (57.57–84.74; ±19%, combined) | -1.0 | 77.63 (62.16–97.73) | 0.040 | 60 → 315 |
| 246 Asporina | 50.89 | 54.96 ± 8.1 (15%, statistical) | -0.5 | **56.13** (50.08–63.02; ±12%, combined) | -0.9 | 57.68 (48.39–69.98) | 0.189 | 120 → 282 |
| 729 Watsonia | 50.02 | 61.52 ± 21 (34%, statistical) | -0.6 | **56.7** (47.98–67.67; ±17%, combined) | -0.7 | 55.68 (45.96–68.04) | 0.086 | 120 → 321 |
| 653 Berenike | 49.79 | 44.21 ± 11 (24%, thermal) | +0.5 | **47.73** (41.97–54.39; ±13%, combined) | +0.3 | 45.48 (37.64–55.87) | 0.155 | 120 → 195 |
| 433 Eros | 16.84 | 27.58 ± 11 (38%, thermal) | -1.2 | **23.68** (20.87–26.96; ±13%, combined) | -2.7 | 24.12 (19.48–30.08) | 0.210 | 191 → 191 |
| 2045 Peking | 9.664 | 9.179 ± 1.3 (14%, statistical) | +0.4 | **9.677** (8.61–10.89; ±12%, combined) | -0.0 | 10.52 (8.638–12.92) | 0.220 | 120 → 227 |
| 2851 Harbin | 8.838 | 8.617 ± 1.2 (14%, statistical) | +0.2 | **8.865** (7.869–9.99; ±12%, combined) | -0.0 | 9.362 (7.642–11.54) | 0.217 | 120 → 355 |
| 2566 Kirghizia | 7.816 | 8.329 ± 1.2 (14%, statistical) | -0.4 | **6.854** (6.068–7.745; ±12%, combined) | +1.1 | – | – | 120 → 213 |
| 35107 | 0.929 | 1.408 ± 0.38 (27%, thermal) | -1.5 | **1.138** (0.984–1.332; ±15%, combined) | -1.3 | 1.098 (0.8876–1.397) | 0.264 | 120 → 672 |

Summary (23 targets, best diameter):
- 1σ error: median 26% → 16%, largest 44% → 21% except 64 Angelina; above 30%: 8 → 1. The exception is 64 Angelina,
  whose interval spans its two disagreeing constraints (99%, flagged).
- Distance from the catalogue: rms 0.132 → 0.072 dex (about 36% → 18%).
- Error calibration: rms z 1.22 → 1.04 (0.90 without Eros); within 2σ 91% → 96%. Against the effective diameter of the
  catalogue shape for the three targets with an SBDB shape (433, 216, 16; see "Shape-model reference"): rms z 0.91,
  within 2σ 100% (23 of 23), largest |z| 1.8 (69 Hesperia).
- Thermal diameters (and albedos): 10 → 19 targets, median error 20%, rms z 0.91.
- Largest changes in value: 308 Polyxo 184 → 140 km (catalogue 129), 387 Aquitania 185 → 119 km (101), 221 Eos
  65 → 112 km (95), 96 Aegle 122 → 167 km (178), 92 Undina 208 → 112 km (126).

**Result: hold-out asteroids** (never used to tune anything; analysed with the standard command and every exposure, in
a scratch database; one per complex: C, K, L, T, M, V):

| Hold-out target | Catalogue D (km) | Best D, 68% interval (source) | z | Thermal D, 68% | pV (catalogue pV) | Class (reference) | Images |
|---|---|---|---|---|---|---|---|
| 24 Themis | 198 | **195.3** (165.6–231.6; ±17%, combined) | +0.1 | 198.3 (163.6–243.5) | 0.059 | C-complex (subclass not determined: C 21 | 358 |
| 773 Irmintraud | 91.67 | **92.52** (78.78–109.4; ±17%, combined) | -0.1 | 100.5 (82.49–123.1) | 0.039 | T candidate | 302 |
| 110 Lydia | 86.09 | **96.29** (82–114.4; ±17%, combined) | -0.7 | 86.04 (72.39–104) | 0.176 | X-complex (subclass not determined: Xc 3 | 446 |
| 742 Edisona | 47.09 | **41.92** (36.7–48.01; ±13%, combined) | +0.9 | 39.88 (33.6–47.87) | 0.161 | K candidate | 336 |
| 824 Anastasia | 32.46 | **39.19** (33.47–46.36; ±16%, combined) | -1.2 | 39.79 (33.03–48.37) | 0.090 | C-complex (subclass not determined: B 22 | 382 |
| 2912 Lapalma | 6.519 | **8.361** (7.152–10.07; ±17%, combined) | -1.5 | 9.28 (7.366–11.73) | 0.149 | A candidate | 301 |

Hold-out: median 1σ error 17% (largest 17%), rms z 0.88, all six within 2σ of the catalogue. 773 Irmintraud had no
geometry in its first run (the Horizons bug) and only a statistical estimate (65–129 km); after the fix it has a thermal
diameter. 110 Lydia shows why the colour is weighted by 1/κ (κ 6.5): η 1.45 and 126 km with full weight, 86 km now
(NEOWISE 88 km).

Figure: `outputs/validation/diameter_errors_before_after.png` (best diameter / catalogue diameter with 68% intervals).

**Classification.** The reflectance spectrum and the classification still use the sampling they were validated on:
every image of a single-season spectrum, and the earliest 120 images when the data span several seasons. Every target
therefore classifies from the same images as before, except 764 Gedania (60 → 120 images; still C first). C7 verdicts:
C7 5 PASS / 1 FAIL / 17 INCONCLUSIVE → 4 / 1 / 18; reference complex first 14 → 15 of 23. The changes are
624 Hektor (D 100% PASS → D 74% INCONCLUSIVE), 216 Kleopatra (L 57% → L 26%), 92 Undina (S → X, the reference) and
764 Gedania (C 24% → 29%). The first three come from the per-season brightness offsets of §2b (2026-11-15), with which
these targets had not been re-run before; 764 from its 60 → 120 images. Eros and the others classify exactly as
before (433: S 82.8%, C1 and C7 INCONCLUSIVE).

**Still open.**
- 433 Eros: the comparison is resolved ("Shape-model reference"): the effective diameter of the NEAR shape at the
  2025-07 geometry is 22.1 km, and SPHEREx's 23.7 km lies 0.5σ from it. Still open: a volume-equivalent SPHEREx
  diameter (the shape in the thermal likelihood), which the density needs (Eros: 0.91 g/cm³ on hold, NEAR 2.67).
- 64 Angelina (E-type) has less 4–5 µm flux than expected for its catalogue size, so its combined interval is wide
  (flagged conflict).
- Metal-rich M-types can have a high η (69 Hesperia at +1.8σ). The η prior covers them only through σ_x.
- Classification with every season: 10 Hygiea and 92 Undina improved, 236 Honoria and 216 Kleopatra became
  confidently wrong. This needs a study of the brightness model across seasons before the classification uses them.

## Shape-model reference (2026-11-15)
**Request.** 433 Eros's diameter looked too large (23.7 km against 16.84 km, −2.7σ), probably because Eros is
elongated. First fix: compare SPHEREx with the same quantity.

**Cause** (`docs/METHODS.md` §8b). In 2025-07 SPHEREx saw Eros 3–8° from its south pole (sub-observer latitude −82 to
−87°), with the Sun at −50 to −60° and a phase angle of 37°. A spherical NEATM applied to an ellipsoid with NEAR's
proportions and volume at that geometry gives 22.1 km (f = 1.31). It sees the largest cross-section (area-equivalent
20.3 km), and the sunlit side is flatter than a sphere's. The same aspect explains the small visit-to-visit brightness
rms (0.03 mag). The catalogue's 16.84 km is volume-equivalent, while a NEATM diameter is an effective diameter.

**Change.** New code: `src/validation/shape_reference.py`, plus `ellipsoid_facets` and `facet_neatm_flux_jy` in
`src/physical/thermal_model.py`. For a target with an SBDB extent, the record stores the effective diameter of the
catalogue shape at the SPHEREx geometry and z against both references (`catalog_effective_diameter_km`,
`shape_reference`, `diameter_catalog_z`, `diameter_effective_z`). The same values go to the database, the report and
the dashboard's Physical tab. Only the SBDB extent, pole and diameter and the geometry of the thermal points are used,
no SPHEREx flux. The SPHEREx diameters do not change.

**Result** (re-run from saved data; every other record field unchanged except timestamps):

| Target | Catalogue D (km) | Effective D of the catalogue shape (km) | SPHEREx best (km) | z: catalogue → effective |
|---|---|---|---|---|
| 433 Eros (2025-07) | 16.84 | 22.1 (f 1.31; seen pole-on) | 23.7 (20.9–27.0) | −2.7 → −0.5 |
| 216 Kleopatra | 122 ± 30 | 159 (f 1.30) | 134 (115–157) | −0.3 → +0.6 |
| 16 Psyche | 222 | 208 (190–254; no pole in SBDB) | 259 (218–309) | −0.9 → −1.0 |

These z values include the catalogue error and, for Psyche, the range over isotropic poles, as stored in the record.
The 23 registered targets, with z computed without catalogue errors as in "Diameter uncertainties": rms z 1.04 → 0.91,
within 2σ 96% → 100%, largest |z| 2.7 (Eros) → 1.8 (69 Hesperia). No hold-out target has an SBDB shape.

**Checks.**
- 20 new tests (`tests/test_shape_reference.py`): the facet model gives NEATM's flux for a sphere (to 0.3%); the
  recomputed geometry matches the stored Horizons r and α (1e-4 au, 0.001°) and the J2000 position of the Sun; Eros
  2025-07 is seen pole-on with f between 1.27 and 1.36; the reference ignores the photometry; the z convention and the
  record fields are covered.
- Full suite: 168 passed, 8 skipped.
- A scratch end-to-end run and the re-run gave diameters identical to the records.
- Dashboard checked in headless Chromium for 433, 16 and 246, with no exceptions. One display bug was fixed: missing
  values showed as blank cells, because SQLite NULLs come back as NaN, and now show as N/A.

**Not changed / open.**
- The density still uses the SPHEREx (effective) diameter. For Eros, ρ ∝ D⁻³ gives 0.91 g/cm³ (on hold) against NEAR's
  2.67. A volume-equivalent SPHEREx diameter needs the shape inside the thermal likelihood.
- Kleopatra is bilobed, so the ellipsoid's f is approximate.
- In the 2026-02 window (not registered) the Sun was near Eros's equator: f = 0.94, while the current code gives 21.7 km
  with χ²_red 9 (strong rotational variation of the thermal flux, high η).

## Robustness test with three added targets (2026-11-15)
**Selection.** The rule was fixed before any of the three was analysed (`config/validation_targets.yaml`, comment
above "64"). One target was chosen for each regime the 18 analysed targets did not cover:
- **64 Angelina** — Bus–DeMeo Xe, Tholen E, catalogue pV 0.48: a high-albedo X-type, the hardest case for the
  albedo prior.
- **596 Scheila** — T, the third T-type of the class-coverage screening. Its earlier run had stopped during the
  extraction, at the moment that session ended.
- **35107 (1991 VH)** — Sq, SMASSII Sk. Of the 41 DeMeo et al. (2009) NEAs, three passed the coverage rule (SMASSII
  in the same complex, a catalogue diameter, ≥ 100 DR1 exposures, predicted V 12.0–17.5); 35107 has the smallest
  heliocentric distance (r ≈ 1.03 au, phase 59–92°), i.e. the strongest thermal signal. Screening table:
  `outputs/validation/added_targets_screening_neas.csv`.

All three were searched, extracted and validated with the settings of the other targets (window 2025-04-12 to
2026-10-15, 120 exposures): `outputs/validation/batch_run_added_robustness.log`.

**What went wrong in the first run.**
- **35107 — wrong thermal result.** The 3.8–5 µm fluxes were about 3× the 1.6–2.4 µm fluxes, so roughly 90% of the
  4–5 µm flux is thermal, yet the detection test gave S/N 0.5 and no thermal diameter. Three causes:
  - star blends 10–40× too bright were not rejected, because the outlier test compared raw fluxes that already
    differ ×30 with distance (Δ 0.09–0.29 au) and phase;
  - four of those points carried OVERFLOW/BLOOM flags and were kept as "saturated wing photometry", although
    an object at V ≈ 15 cannot saturate;
  - the free continuum slope came out at +1.32 /µm (asteroids: −0.10 to +0.27) and, extrapolated to 4–5 µm,
    swallowed the excess.
- **596 Scheila — wrong and "distinguished" (C7 FAIL).** X-complex first, T 9.0 behind. On the spectrum alone T
  had 21%. The albedo term took it to 1%: SBDB lists pV 0.040, but the catalogue diameter with the current H
  implies 0.019, a 3σ disagreement the prior ignored. The earlier interruption did not recur; it was not a code
  fault.
- **64 Angelina.** X-complex first but not distinguished (0.1 ahead of L). Statistical diameter 94 km against 58 km
  (×1.62): inside the 95% interval, the expected outcome for an E-type whose high albedo is unknown to the prior.

**Fixes.** All are general and none is specific to a target:
- outlier test on geometry-normalised fluxes (`docs/METHODS.md` §2d);
- removal of saturation flags on objects predicted fainter than V 13 below 3 µm (§2d);
- prior on the continuum slope in the thermal fit (§3);
- catalogue albedo/diameter disagreement added to the albedo uncertainty (§4c), with the thresholds
  recalibrated to 6 / 10 / 10.

A shrinkage of the rare-complex albedo distributions was tested and rejected: the leave-one-out score got worse.
Regression tests: `tests/test_added_target_robustness.py` (blends at two distances; saturation on a faint object;
noisy sparse continuum over 20 synthetic NEAs; catalogue disagreement). `tests/test_thermal_separation.py` now draws
the noise-only slopes from the prior range.

**All 21 targets re-run on their saved spectra with the fixes**
(`outputs/validation/batch_run_fixes_from_saved.log`). "Before" is the state after the first run of the three new
targets.

| Target | Reference | First complex before → after | C7 before → after (gap) | Thermal D before → after (km) | Catalogue D | Statistical D, 68% |
|---|---|---|---|---|---|---|
| 433 Eros (2025-07) | S | S 80% → S 83% | INC → INC (+4.2) | 27.6 → 27.6 | 16.84 | 23.6 (20.1–28.3) |
| 16 Psyche | Xk | T 33% → T 29% | INC → INC (−0.3), saturated | 256 → 254 | 222 | 259 (189–356) |
| 246 Asporina | A | A 100% → A 99% | PASS → PASS (+10.4) | – | 50.9 | 55.0 (47.5–63.7) |
| 624 Hektor | D | D 94% → D 100% | INC (+5.9) → **PASS (+16.6)** | – | 225 | 189 (148–242) |
| 10 Hygiea | C | C 81% → C 79% | INC → INC (+3.0) | – | 407 | 395 (291–530) |
| 221 Eos | K | K 50% → K 49% | INC → INC (+1.4) | 63.5 → 65.5 | 95.5 | 116 (89–162) |
| 579 Sidonia | K | K 42% → K 39% | INC → INC (+0.3) | – | 85.6 | 99 (79–136) |
| 387 Aquitania | L | L 55% → L 56% | INC → INC (+1.3) | 185 → 185 | 101 | 154 (111–220) |
| 236 Honoria | L | X 28% → K 41% | INC → INC (−0.9) | – → **62 ± 27** | 77.7 | 86 (67–122) |
| 308 Polyxo | T | T 68% → T 70% | INC → INC (+2.2) | 185 → 184 | 129 | 121 (93–159) |
| 96 Aegle | T | C 64% → C 64% | FAIL → FAIL (−6.1) | – | 178 | 122 (94–172) |
| 2045 Peking | V | V 100% → V 100% | PASS → PASS (+27.9) | – | 9.66 | 9.2 (8.0–10.6) |
| 2851 Harbin | V | V 100% → V 100% | PASS → PASS (+18.6) | – | 8.84 | 8.6 (7.5–10.0) |
| 69 Hesperia | Xk | X 40% → X 44% | INC → INC (+0.8) | 110 → 92 | 138 | 165 (117–232) |
| 92 Undina | Xk | X 24% → S 40% | INC → INC (−1.7) | – | 126 | 208 (141–298) |
| 653 Berenike | K | K 86% → K 82% | INC → INC (+3.9) | 44.1 → 44.2 | 49.8 | 50.0 (41.9–60.4) |
| 729 Watsonia | L | X 36% → X 34% | INC → INC (−1.1) | – | 50.0 | 61.5 (44.2–86.1) |
| 764 Gedania | C | C 26% → C 24% | INC → INC (0.0) | – | 58.3 | 53.3 (40.4–78.1) |
| **64 Angelina** | Xe | X 43% → L 52% | INC → INC (−0.9) | – | 58.3 | 95 (74–121) |
| **596 Scheila** | T | X 47% → C 41% | **FAIL (−9.0) → INC (−2.5)** | 90.6 → 88.7 | 160 (IRAS 113) | 79 (57–109) |
| **35107 (1991 VH)** | Sq | V 36% → V 50% | INC → INC (−2.3) | – → **1.41 ± 0.38** | 0.929 | 1.20 (0.98–1.54) |

Summary:
- **C7 verdicts:** 4 PASS, 1 FAIL, 16 INCONCLUSIVE (before: 3 / 2 / 16).
  - 624 Hektor's D-type became distinguished after the cleaning removed five points: four with saturation
    flags that a V ≈ 15 object cannot cause, and one outlier.
  - Scheila's confident wrong answer is gone.
- **Reference complex first:** 13 of 21, 15 before. The two losses are near-ties whose order changed: 92 Undina
  (S, X and L within 4% before; the retrained population model and the cleaning reorder them) and 64 Angelina (gap
  0.9; the old outlier test had discarded two of its points only because they were observed at a smaller distance).
- **Thermal diameters:** 10 targets. The two new ones (236, 35107) agree with the catalogue within 1.2σ. 387
  Aquitania (+2.0σ) and 308 Polyxo (+2.5σ) were already off before. Scheila is −3.6σ against NEOWISE and −1.2σ
  against IRAS.
- **Statistical diameters:** rms 0.124 dex. The catalogue value is inside the 68% interval for 14 of 21 and inside
  the 95% interval for 19 of 21. The two misses are 433 Eros (16.84 km, interval starting at 16.9) and 596 Scheila
  (catalogue pV 0.019 with the current H).

**Still open.**
- 96 Aegle: T-type read as C. The spectrum alone already prefers C, and its albedo is C-like.
- 35107: classified V. The spectrum alone favours S (27% vs 17%), but its high albedo (0.37) and the
  complex-balanced prior favour V. Confidence is Low and the result is not distinguished; S-types with V-like
  albedos and weak spectra are a cost of the adopted prior (§4c).
- The thermal-diameter offsets of 387 and 308 (D–η degeneracy, §3).

## Classification prior and statistical diameters (2026-11-15)
*The tables in this section are the state before the robustness fixes; the current results for all 21 targets are
in "Robustness test with three added targets" above.*

Method: `docs/METHODS.md` §4c (prior) and §5b (statistical diameter). All 18 analysed targets were re-run
on their saved spectra with identical code (`python main.py validate-batch --from-saved --targets …`; log
`outputs/validation/batch_run_prior_from_saved.log`). The reference classes are never an input. The
population model is trained without the validation targets, without the injection set and without the
analysed object.

**Classification.** Three columns:
- "Previous record" is the run of 2026-11-14: complex probabilities summed under a flat prior over the
  25 classes, with older code. For 10, 16, 221, 387 and 624 that record named a different complex than
  its own ranking.
- "Spectrum only" is today's code without the prior. It is stored in every record
  (`spectral_complex_probability_spectral_only`).
- "With prior" is the reported result.

The fair measure of the prior is the comparison of the last two columns.

| Target | Reference | Previous record | Spectrum only | With prior | C7 previous → now (gap) |
|---|---|---|---|---|---|
| 433 Eros (2025-07) | S | S 82% | S 82% | S 80% | INCONCLUSIVE → INCONCLUSIVE (3.4) |
| 16 Psyche | Xk | X 35% | X 35% | T 33% | not scored, 93% saturated |
| 246 Asporina | A | A 99% | A 99% | A 100% | PASS → PASS (11.0) |
| 624 Hektor | D | S 50% | S 50% | **D 94%** | INCONCLUSIVE → INCONCLUSIVE (5.9) |
| 10 Hygiea | C | C 60% | C 60% | C 81% | INCONCLUSIVE → INCONCLUSIVE (3.2) |
| 221 Eos | K | C 42% | C 42% | **K 50%** | INCONCLUSIVE → INCONCLUSIVE (1.5) |
| 579 Sidonia | K | C 39% | C 39% | **K 42%** | INCONCLUSIVE → INCONCLUSIVE (0.5) |
| 387 Aquitania | L | X 40% | X 40% | **L 55%** | INCONCLUSIVE → INCONCLUSIVE (1.1) |
| 236 Honoria | L | X 34% | X 34% | X 28% | INCONCLUSIVE → INCONCLUSIVE (1.2 behind) |
| 308 Polyxo | T | T 55% | T 55% | T 68% | INCONCLUSIVE → INCONCLUSIVE (1.9) |
| 96 Aegle | T | C 37% | C 37% | C 64% | INCONCLUSIVE → **FAIL** (6.0 behind) |
| 2045 Peking | V | V 100% | V 100% | V 100% | PASS → PASS (37.6) |
| 2851 Harbin | V | V 100% | V 100% | V 100% | PASS → PASS (20.0) |
| 69 Hesperia | Xk | C 70% | X 54% | X 40% | INCONCLUSIVE → INCONCLUSIVE (0.2) |
| 92 Undina | Xk | not classified | C 37% | **X 24%** | INCONCLUSIVE → INCONCLUSIVE (0.1) |
| 653 Berenike (SBDB ref.) | K | K 31% | K 31% | K 86% | – → INCONCLUSIVE (4.2) |
| 729 Watsonia (SBDB ref.) | L | C 52% | C 52% | X 36% | – → INCONCLUSIVE (1.1 behind) |
| 764 Gedania (SBDB ref.) | C | S 26% | S 26% | **C 26%** | – → INCONCLUSIVE (0.0) |

Summary:
- **15 validation targets, same code.** The reference complex is first in 12 with the prior and in 8
  without it.
  - Gained: 624 Hektor, 221 Eos, 579 Sidonia, 387 Aquitania, 92 Undina.
  - Lost: 16 Psyche, X → T by 0.6 on a saturation-limited spectrum.
  - The previous records had 7: 69 Hesperia moved from C to X with the thermal-group change made
    earlier the same day, which gives it a thermal fit (excess S/N 3.7). The same code without the prior
    gives the same fit. 92 Undina had no classification at all.
- **All 18.** 14 first with the prior, 9 spectrum only.
- **C7 verdicts:** 3 PASS, 1 FAIL, 11 INCONCLUSIVE (3 / 0 / 12 before). The calibrated thresholds keep
  most DR1 results "not distinguished", as the injection test predicts. 624 Hektor (D 94%) misses
  "distinguished" by 0.1.
- **96 Aegle (FAIL).** The spectrum alone already prefers C (37%; T not in the first four). Its
  catalogue albedo, 0.048, is the C-complex median (T-types: 0.076). The prior therefore turned an
  existing C preference into a distinguished one. Dark T-types are the known weak point: 38% recovery
  in the injection test, unchanged by the prior.

**Diameters.** Statistical diameter for every target (catalogue diameter not used; median and 68%
interval). For targets with a thermal diameter the statistical estimate is computed without thermal
weighting and serves as its consistency check. UL95 is the upper limit from the thermal non-detection
alone.

| Target | Catalogue D (km) | SPHEREx thermal D | Statistical D, 68% interval | Ratio to catalogue | UL95 | Thermal vs statistical (z) |
|---|---|---|---|---|---|---|
| 246 Asporina | 50.9 | – | 54.9 (48.1–62.7) | 1.08 | 148 | – |
| 624 Hektor | 225 | – | 185 (125–244) | 0.82 | 382 | – |
| 10 Hygiea | 407 | – | 389 (284–521) | 0.96 | 744 | – |
| 579 Sidonia | 85.6 | – | 98.3 (77.8–133) | 1.15 | 251 | – |
| 236 Honoria | 77.7 | – | 106 (78.5–143) | 1.36 | 219 | – |
| 96 Aegle | 178 | – | 121 (93.1–169) | 0.68 | 249 | – |
| 2045 Peking | 9.66 | – | 8.9 (7.8–10.3) | 0.92 | 15.2 | – |
| 2851 Harbin | 8.84 | – | 8.6 (7.5–9.9) | 0.97 | 23.0 | – |
| 92 Undina | 126 | – (no thermal fit) | 219 (154–308) | 1.73 | – | – |
| 729 Watsonia | 50.0 | – (no thermal fit) | 62.0 (44.3–86.9) | 1.24 | – | – |
| 764 Gedania | 58.3 | – | 53.1 (38.6–76.9) | 0.91 | 137 | – |
| 433 Eros (2025-07) | 16.84 | 27.6 ± 10.6 | 23.3 (19.8–27.8) | 1.39 | – | +0.4 |
| 16 Psyche | 222 | 256 ± 65 | 267 (194–367) | 1.20 | – | −0.1 |
| 221 Eos | 95.5 | 63.5 ± 17.0 | 115 (89.7–162) | 1.21 | – | −1.5 |
| 387 Aquitania | 101 | 185 ± 42 | 153 (110–218) | 1.52 | – | +0.5 |
| 308 Polyxo | 129 | 185 ± 23 | 116 (89.4–152) | 0.91 | – | +1.6 |
| 69 Hesperia | 138 | 110 ± 45 | 165 (117–230) | 1.19 | – | −0.8 |
| 653 Berenike | 49.8 | 44.1 ± 10.5 | 49.8 (42.0–59.9) | 1.00 | – | −0.4 |

- **11 targets without a thermal diameter.** log10(statistical/catalogue) has a median of −0.011 and an
  rms of 0.107 dex (28%). 7 of 11 are within 20%. The catalogue value lies inside the 68% interval for
  8 of 11 and inside the 95% interval for 11 of 11.
- **All 18.** rms 0.105 dex; inside 68% for 13 of 18 (72%) and inside 95% for 18 of 18. The intervals
  are therefore roughly calibrated.
- **Thermal upper limits.** For the nine non-detections they lie 1.4–2.9 times above the catalogue
  diameter: consistent, but weak.
- **Consistency check.** No thermal diameter is flagged at |z| ≥ 2, although 387 Aquitania (thermal 1.84×
  catalogue) and 308 Polyxo (1.44×) are off. Their statistical estimates use the complex probabilities
  without the albedo term, and those still give weight to dark complexes. A tighter check would need the
  catalogue albedo, which would make it circular.
- **The largest misses.** 92 Undina (×1.73): no thermal fit, X-complex 24% with a broad X albedo. 96 Aegle
  (×0.68): misclassified as C. 387 Aquitania (×1.52).

## Multi-asteroid taxonomy validation (DR1, identical settings, 2026-11-14)
*Superseded for the classification by the calibrated classifier (2026-11-15). The current results for
these five and the ten added targets are in "Added validation targets" below. This section keeps
the analysis notes.*
Reference taxonomy from JPL SBDB (`spec_B`, else `spec_T`; visible-wavelength classes, compared at
complex level). Windows: Eros 2025-07-01..31 with 191 exposures (chosen by the saturation rule, see
below; `config/validation_targets.yaml`); the others 2025-04-12..2026-10-15 with 120 exposures. Solar-analog
correction applied; saturated points used with their measured per-band error; lightcurve harmonics by
BIC; stability checks on. Files: `outputs/validation/<id>_taxonomy_validation.{md,json}`,
`outputs/validation/batch_summary.json`.

| Target | Reference | Most probable (complex probability) | Confidence | Saturated points in 0.75–2.45 µm | C7 (scaled deviance gap; distinguished at ≥ 4) | Other criteria |
|---|---|---|---|---|---|---|
| 433 Eros (2025-07) | S | S-complex 91.9% (X 4.9%) | Low | 1 of 94 (1%) | PASS (first; 5.4 to X) | C1 INCONCLUSIVE, rest PASS |
| 16 Psyche | X (Tholen M) | X-complex 49.3% (C 28.3%) | Low | 52 of 56 (93%) | not scored, saturation-limited (first; 1.5 to C) | all PASS |
| 246 Asporina | A | S-complex 62.3%, class Sa (A-type 37.7%) | Low | 1 of 58 (2%) | INCONCLUSIVE (second; 1.0 behind) | all PASS |
| 624 Hektor | D | D-type 53.4% (S-complex 43.1%) | Low | 3 of 59 (5%) | INCONCLUSIVE (first; 1.2 to S) | C2 INCONCLUSIVE, rest PASS |
| 10 Hygiea | C | X-complex 60.3%, class Xn (C 39.3%) | Low | 4 of 58 (7%) | INCONCLUSIVE (second; 0.7 behind) | all PASS |

Per target:
- **433 Eros.** In 2025-07 (V ≈ 13.2, r = 1.68 au) only 1% of the classification-window points are
  saturated. The periodic lightcurve model is not supported by the repeats here (it explains 64% of the
  visit-to-visit variation, < 70%), so relative visit offsets are used (8 normalisation groups), and
  Band I cannot be tested within one group (C1 INCONCLUSIVE). Confidence Low because the thermal fit is
  poor (χ²_red 3.2); the classifier alone gives Medium. The saturated 2026-02 window gave V-type (2
  harmonics) or R/S (5 harmonics) - see "Criterion for saturated points".
- **16 Psyche.** All DR1 windows have V 11.18–11.42; 93% of the window points are saturated. Not
  scorable with SPHEREx DR1.
- **246 Asporina.** DeMeo et al. (2009) class Asporina A and separate A from Sa by slope ("Sa-types are
  much less red than A-types"). In SPHEREx the slope rests on the inter-segment levels, which depend on the
  lightcurve model: 3 and 4 harmonics are about equally supported (ΔBIC = 2) and give A and Sa. With that
  model uncertainty in the errors (fix 27) the result is S 62% / A 38%, a 1.0 deviance gap: not decided.
- **624 Hektor.** Faint (~6 mJy), unsaturated, 9 normalisation groups; 4 of 21 leave-one-visit-out samples
  give S-complex.
- **10 Hygiea.** The narrow "Xn" feature came from visits 0 and 5, linked by repeats only to each other
  and 10% fainter than the rest; they had the small tested error (fix 26). With the untested prior they
  no longer decide the class: X 60% / C 39%, a 0.7 gap. C- and X-complexes do not separate clearly in
  the near-infrared (DeMeo et al. 2009, Fig. 4); without the saturated points C-complex is first.

Earlier summary (before the solar-analog calibration and the saturation criterion): Eros S 98.9% (High),
Psyche X 84%, Hektor D 60%, Asporina Sa 85%, Hygiea X. The Eros and Psyche results then rested on
saturated photometry with understated errors.

## Added validation targets (class-coverage rule, 2026-11-14)
The five targets above score S, A, D and C (X was saturation-limited). Further targets were added by
a rule fixed from screening numbers alone (IRSA MOST exposure count and predicted V), before any of
them was analysed. The rule and the choice are in `config/validation_targets.yaml`, and the screening
table of 67 candidates is in `outputs/validation/added_targets_screening.csv`.
1. Classes not yet scored: K, L, T, V, R, O, Q, B, and the X-complex.
2. Reference: the Bus–DeMeo class in DeMeo et al. (2009, Appendix; 0.45–2.45 µm). SMASSII (SBDB
   `spec_B`) must give the same class (Ld counts as L; within the X-complex any X subclass).
3. DR1 window 2025-04-12..2026-10-15 and 120 exposures, as in the batch above; ≥ 100 MOST exposures.
4. Saturation: predicted V ≥ 12.0 for every exposure (Psyche, V 11.4–11.8: 93% of points saturated;
   Hygiea, V 11.75–12.1: 7%).
5. Signal: median predicted V ≤ 17.5. At V = 17 the per-point S/N is about 2–10, scaled from Eros,
   Asporina and Hektor with the noise held fixed.
6. The candidate with the brightest median V is the primary target; the second brightest is a replicate.

| Class | Primary (median V) | Replicate (median V) |
|---|---|---|
| K | 221 Eos (13.2) | 579 Sidonia (13.8) |
| L | 387 Aquitania (13.1) | 236 Honoria (13.3) |
| T | 308 Polyxo (13.5) | 96 Aegle (13.9) |
| V | 2045 Peking (17.0) | 2851 Harbin (17.0) |
| X-complex | 69 Hesperia (12.6; Bus–DeMeo Xk) | 92 Undina (12.8; Xk) |

Classes that cannot be tested in DR1 under the rule:
- R: 349 Dembowska, the only R-type, has V 11.0–12.0 (saturated). 1904 Massevitch is R in SMASSII but
  V in DeMeo et al. (2009), so rule 2 excludes it.
- O: 3628 Božněmcová, V ≈ 19.0.
- Q: every Bus–DeMeo Q-type is a near-Earth asteroid, at V > 20 in DR1; 3753 Cruithne was not observed.
- B: 2 Pallas is saturated; 3200 Phaethon, 6411 Tamaga and 1508 Kemi are at V ≈ 18–19.

### Results with the calibrated classifier (2026-11-15; all 15 targets re-run with identical code)
The first run of the five primaries used the uncalibrated χ² classifier. It gave three wrong complexes
reported as distinguished: 221 Eos → C (gap 6.6), 387 Aquitania → X (9.3) and 69 Hesperia → C (18.6).
308 Polyxo was not classified (bug 29). These results led to bugs 29–32 and to the injection–recovery
calibration (`docs/METHODS.md` §4b). All targets were then re-run with the calibrated classifier:

| Target | Reference | Most probable complex / first class | Confidence | C7 (gap) | C9 (gap) | Other criteria not PASS |
|---|---|---|---|---|---|---|
| 433 Eros (2025-07) | S (Bus–DeMeo Sw) | S-complex 82% / Sq | Low | INCONCLUSIVE (4.2) | INCONCLUSIVE (1.7) | C1 INCONCLUSIVE |
| 16 Psyche | Xk | X-complex 35% / T | Low | not scored, 93% saturated | not scored | – |
| 246 Asporina | A | A-type 99% / A | Medium | **PASS (9.2)** | INCONCLUSIVE (9.2) | – |
| 624 Hektor | D (Tholen) | S-complex 50% / D | Low | INCONCLUSIVE (D best by 1.4) | INCONCLUSIVE | C2 INCONCLUSIVE, C3 FAIL |
| 10 Hygiea | C | C-complex 60% / Xc | Low | INCONCLUSIVE (0.1) | INCONCLUSIVE | – |
| 221 Eos | K | C-complex 42% / Xc | Low | INCONCLUSIVE (2.4) | INCONCLUSIVE | C1 INCONCLUSIVE, C3 FAIL |
| 579 Sidonia | K | C-complex 39% / Xc | Low | INCONCLUSIVE (1.4) | INCONCLUSIVE | C1 FAIL, C3 FAIL |
| 387 Aquitania | L | X-complex 40% / Ch | Low | INCONCLUSIVE (1.4) | INCONCLUSIVE | – |
| 236 Honoria | L | X-complex 34% / T | Low | INCONCLUSIVE (3.9) | INCONCLUSIVE | – |
| 308 Polyxo | T | T-type 55% / T | Low | INCONCLUSIVE (T best by 1.1) | INCONCLUSIVE | – |
| 96 Aegle | T | C-complex 37% / L | Low | INCONCLUSIVE (2.5) | INCONCLUSIVE | C2 INCONCLUSIVE, C3 FAIL |
| 2045 Peking (V ≈ 17) | V | V-type 100% / V | High | **PASS (35.1)** | **PASS (35.1)** | – |
| 2851 Harbin (V ≈ 17) | V | V-type 100% / V | High | **PASS (18.4)** | **PASS (18.4)** | – |
| 69 Hesperia | Xk | C-complex 70% / B | Low | INCONCLUSIVE (4.7) | **FAIL (20.2)** | – |
| 92 Undina | Xk | not classified (no reflectance spectrum) | – | INCONCLUSIVE | INCONCLUSIVE | – |

Summary over the 15 targets:
- C7: 3 PASS (A and two V-types), 0 FAIL, 12 INCONCLUSIVE. Psyche is not scored and Undina was not
  classified.
- C9: 2 PASS, 1 FAIL (Hesperia), 12 INCONCLUSIVE.
- In the uncalibrated first run, three wrong complexes were reported as distinguished. With the
  calibrated thresholds, none is.
- Deep-band V-types are recovered even at V ≈ 17. K, L, T and X-complex targets are not decided by DR1
  near-infrared spectra, as the injection test predicts (K 28%, L 12%, X 38% first).

Notes:
- **C3 FAIL (624, 221, 579, 96).** The control, the exact D-type class mean sampled like the
  observation, was not recovered as D. These samplings (5–9 unlinked normalisation groups) cannot
  identify a D-type, and the full Gaussian deviance penalises the wide D class when the injected
  spectrum is the class mean itself (§4b). A control built from real D-type spectra of the injection
  set would be the fair version; open.
- **69 Hesperia C9 FAIL.** At class level the spectrum is clearly B-like (flat or blue), not Xk. A
  slope systematic (calibration or lightcurve) is the first suspect; open.
- **92 Undina.** It was observed in two seasons, with 23 visits in 11 unlinked groups. The thermal fit
  used group 0, which has too few points in the reflected-light window, so no reflectance spectrum
  was made. Choosing the group by reflected-window coverage is open.

## Relative spectral calibration with solar analogs
Method and full numbers: `docs/METHODS.md` §2c. Build: `python main.py solar-analog-calibration --start
2025-03-01 --end 2026-11-14 --max-images-per-star 150` (about 2 h, 2250 cutouts); re-derive from the
saved star spectra without network: `--from-saved`.
- Stars: Marsset et al. (2020) Table 1 stars with V ≥ 10.5 (98-978, 107-998, 110-361) and 12 stars of
  the Gaia DR3 golden sample of solar analogues (Creevey et al. 2023), G 11.3–11.8, chosen reproducibly
  (`config/solar_analogs.yaml`). The eight brighter Marsset stars saturate SPHEREx B1/B2 and are not used.
  110-361 was dropped by the star-level outlier rule (MWIR − SWIR level −5.5%, 7σ; b = +2°).
- Result: relative to 1.2 µm, B1 +2–3% with a dip at 0.89–0.93 µm and +4–5.5% at 1.03–1.12 µm (the
  pattern seen earlier in several asteroids); B2 +3.5–5.8% above 1.35 µm; B3 +2.5–11%; B4–B6
  +3.4–12.5%. Slope uncertainty 0.23 %/µm (SWIR), MWIR level uncertainty 0.24%.
- Independent checks: the two star halves (|β| < 30° / ≥ 30°) agree (χ²/N = 0.91 over 134 bins). The
  correction improves the fit to the literature class mean for Hygiea, Asporina and Hektor and leaves Eros
  unchanged; it changes no complex-level result. The narrow B1 structure matches the residuals of the
  bright Hygiea (r = 0.5–0.7) but not of the faint Hektor (r = 0.04): part of it may depend on brightness,
  which stars of a single brightness range cannot test.

## Saturation of bright targets in B1–B3
The SPHEREx PSF is undersampled, so the brightest pixel holds 40–80% of the flux and saturates first
(`OVERFLOW`/`SUR_ERROR` in FLAGS). Points with a rejected PSF-core pixel, per band (earlier DR1 runs):

| Target | B1 flux | B1 | B2 | B3 | B4 | B5 | B6 |
|---|---|---|---|---|---|---|---|
| 16 Psyche | ~300 mJy | 21/23 | 19/19 | 17/18 | 10/23 | 3/19 | 2/18 |
| 433 Eros | ~80 mJy | 10/27 | 14/32 | 11/21 | 11/27 | 6/32 | 10/21 |
| 10 Hygiea | ~100 mJy | 2/18 | 3/29 | 3/12 | 2/19 | 1/29 | 0/13 |
| 246 Asporina | ~13 mJy | 1/36 | 2/19 | 0/5 | 2/36 | 4/19 | 0/5 |
| 624 Hektor | ~6 mJy | 2/29 | 4/27 | 0/5 | 1/29 | 1/26 | 0/4 |

(For Hygiea, Asporina and Hektor the rejected core pixels are mostly not saturation: their B1/B2 peaks
reach at most 75, 14 and 6 MJy/sr, while flagged peaks of Eros and Psyche reach 150–220 MJy/sr.)

Accuracy of wing-only photometry, measured on the calibration stars (same star and band, saturated
against clean points relative to the fitted model): rms 7.0% (B1), 7.8% (B2), 5.9% (B3) against 2.2%,
2.5%, 3.1%; star-dependent offsets from −15% to +5% (χ²/N of the per-star differences 6.7).

### Criterion for saturated points (applies to every target)
1. **Point.** A point with `OVERFLOW`, `SUR_ERROR` or `NONLINEAR` in its PSF core is wing-only photometry.
   It is used in every step with the per-band scatter measured on the calibration stars added to its
   error (B1–B6: 7.0, 7.8, 5.9, 3.4, 2.8, 3.2%; `temporal.saturated_flux_error_frac_by_band`). It is not
   dropped, because dropping selects points by flux (Eros: lightcurve phase coverage 100% → 60%), and it
   is not used with nominal errors, which understate its error about threefold.
2. **Classification.** The classification is repeated without the saturated points, with the BIC
   runner-up lightcurve model, with the lightcurve correction scaled by 0.9 and 1.1, and with each visit
   left out; if any of these changes the most probable complex, the confidence is Low.
3. **Spectrum.** If more than 20% of the points in 0.75–2.45 µm are saturated
   (`classification.max_saturated_fraction`), the spectrum is saturation-limited: confidence Low (Eros 2026-02: 38%; Psyche: 93%; the other
   targets 1–7%).
4. **Validation.** On a saturation-limited spectrum C7 is reported but not scored (INCONCLUSIVE),
   whatever the outcome. Validation windows are chosen by this rule before their result is known: for
   433 Eros the 2025-07 window (191 exposures, V ≈ 13.2) replaces 2026-02 (V ≈ 10.7, 38% saturated).
   16 Psyche has no DR1 window fainter than V 11.2 (2025-08/09, 2026-02/03: V 11.18–11.42) and stays
   saturation-limited (93% of its 0.75–2.45 µm points saturated).

Eros 2026-02 under the treatments that were compared (same photometry, 2-harmonic lightcurve): nominal
errors S-complex 98.9% (High); per-band errors V-type 94.1% (Medium); saturated points dropped V-type
95.6–96.8%. With the lightcurve harmonics chosen by BIC (5) the same window gives R-type 63.7% /
S-complex 34.6% (Low) and Band I at 2.7σ (below the 3σ threshold): the window cannot fix the type.
With the final code that window is saturation-limited (38%): C7 not scored, Band I not detected
(C1 FAIL), R-type 63.7% at Low confidence. Results: `outputs/windows/2026-02/`.

## Stability checks added to the classification (spec §11.2)
Each check sets the confidence to Low when the most probable complex changes; results are stored with
the taxonomy (`lightcurve_sensitivity`, `visit_jackknife`, `saturation_sensitivity`, `saturation_limit`).
- Lightcurve model: the applied periodic correction scaled by 0.9 and 1.1, and recomputed with the
  BIC runner-up number of harmonics (model form). The number of harmonics itself is chosen by BIC
  (1–5); a fixed two-harmonic model under-fitted the sharp minima of Eros.
- Leave-one-visit-out: each visit with points in 0.75–2.45 µm removed in turn.
- Saturation: the classification repeated without the saturated points.

## Bugs found by real-data testing (all fixed and covered by tests)
1. Horizons rejected bare SPK-IDs (they need `DES=<spkid>;`). The SPHEREx-centred refinement had
   been silently skipped.
2. The thermal-excess S/N ignored the shared continuum error. The noise-only spread was 3.3σ instead of 1σ.
3. A free η could run to its bound and give a biased D. It now falls back to a fixed η with the prior propagated.
4. The density volume preferred the extent ellipsoid. That is wrong for irregular bodies (Eros +11%, Ryugu −18%).
5. A missing D uncertainty broke the albedo uncertainty (Psyche).
6. The SPHEREx `OUTLIER` flag marks the moving asteroid itself (49% of core pixels versus 1.3% of
   background). It had been rejecting the asteroid's own pixels.
7. The EPSF was integrated over the pixel twice. Fluxes were 5–15% low with a band-dependent bias,
   and χ²_red was about 100.
8. No trail model: a moving object was fitted with a point-source PSF.
9. `synphot` was missing, so sbpy silently fell back to a blackbody Sun (10–20% shape error). The
   fallback is now shown in reports.
10. Mineral candidates were reported at Medium confidence from a spectrum with neither thermal
    emission nor rotation removed.
11. Taxonomy scores used bare χ² with class σ, which favoured broad classes; classes without σ were
    penalised (an exact R spectrum came out Sr). Fixed with a σ floor and reference-grid binning,
    and calibrated on the class means.
12. The η prior was swamped by over-trusted data when χ²_red ≫ 1. The data errors are now rescaled
    consistently before being weighed against the prior.
13. Old databases lacked new result columns. An automatic schema migration now adds them.
14. "No variability detected between visits" was treated as "no variability": visits that no
    repeated observation could link got zero visit-to-visit uncertainty. On 10 Hygiea one isolated B1
    visit (0.85–0.97 µm) then produced a false 1-µm band. The spread of the fitted visit offsets
    (0.1 mag rms for visits no repeat links) is now kept in the error covariance;
    `test_isolated_faint_visit_does_not_create_a_false_band` fails with the old treatment.
15. A full-band candidate whose minimum lay outside the band-centre range counted as a detection.
    The minimum must now lie within 0.85–1.12 µm (Band I) or 1.75–2.35 µm (Band II).
16. An interrupted cutout download could leave a half-written file in the cache. Files are now
    written under a temporary name and renamed; downloads run 5 at a time.
17. The classical solar analogs of asteroid spectroscopy (V 8–10.6) saturate SPHEREx B1–B3: Landolt
    115-271 (V 9.7) had `OVERFLOW` in the peak pixel in 39 of 72 exposures, and Landolt 98-978
    (V 10.6) kept 1 clean B1 point and no clean B2 point out of 50. The calibration now also uses
    fainter solar analogues from the Gaia DR3 golden sample, and a calibration point may carry no
    FLAGS plane other than `SOURCE` in its PSF core.
18. Gaia DR3 `source_id`s (19 digits) were corrupted when a table row was read as a float64 Series:
    16 of the 23 configured identifiers pointed at other Gaia sources up to a few hundred numbers away
    (neighbouring stars in the same HEALPix cell). They were caught before any of them was
    photometered. Identifiers are now read column-wise, and the build checks each star's G and
    position against the values recorded at selection time (`verify_star_identity`).
19. The seeded random choice of golden-sample stars was not reproducible because TAP returns rows in
    no guaranteed order. Candidates are now sorted by `source_id` first; two runs give the same stars.
20. Saturated PSF cores were used without notice and with understated errors. A saturated peak pixel
    is rejected, so the flux comes from the PSF wings alone. Points now record their core FLAGS planes,
    and the analysis uses them with the 8% error measured on the calibration stars (see "Saturation").
21. A target whose spectrum could not be analysed (Psyche without its saturated points) was scored as a
    failed validation (`C0 FAIL`). Unanswerable criteria are now INCONCLUSIVE, with the reason, and the
    observation-time criteria and C8 are still scored.
22. `validate-batch` overwrote the summary of targets not in the current run; it now updates entries per
    target.
23. The rotational lightcurve always had two Fourier harmonics. That under-fits elongated rotators, whose
    minima are sharper than their maxima; faint-phase points were then under-corrected (433 Eros: BIC
    730 with 2 harmonics, 426 with 5). The number of harmonics is now chosen by BIC (1–5), and the
    classification is re-checked with the BIC runner-up.
24. Without points below 1.1 µm the classifier still gave Medium confidence when a featureless class
    came first (433 Eros without that region: C-complex 87%, Medium). The cap at Low now applies to any
    class.
25. C6 compared plain classifier runs (counterfactuals) with the reported confidence, which also
    contains the analysis-level downgrades; it now compares like with like (`confidence_classifier`).
26. Fix 14 was incomplete. With no variability detected, every visit in any repeat-linked group got the
    small tested error, but only the visits of one group are tested against each other. 10 Hygiea's
    visits 0 and 5 were linked only to each other, 10% fainter than the rest, and carried a false
    0.9-µm band (Xn, X-complex 84%). The largest group is now the reference; visits outside it keep the
    0.1-mag untested prior (`test_visits_linked_only_among_themselves_keep_the_untested_prior`).
27. The lightcurve model with the lowest BIC was used as if certain. When another number of harmonics is
    about as good (246 Asporina: ΔBIC = 2 between 3 and 4), the inter-segment levels, and the slope that
    separates A from Sa, depend on that choice. The BIC-weighted variance of the two models' corrections,
    w(1 − w)·d², is now added to the visit-correlated errors.
28. C7 scored any first-place mismatch as FAIL and any match as PASS, however close the runner-up. It
    now uses the classifier's own threshold for "distinguished" (scaled deviance gap ≥ 4): PASS only if
    the reference is first and distinguished, FAIL only if it is distinguished as worse, otherwise
    INCONCLUSIVE.
29. The reflectance was normalised only if a point lay within 0.05 µm of 1.2 µm; the docstring said
    "interpolated from neighbours". 308 Polyxo's 120-exposure subset had no such point, so it got no
    reflectance and no classification. The value at 1.2 µm is now interpolated, with a weighted linear
    fit to points on both sides (never extrapolated).
30. The classifier's deviance omitted ln det of the class covariance. A class with a wider intra-class σ
    therefore always had the smaller χ² for the same residuals and won whenever no class fitted well.
    Every wrong first place so far went to a wider class: Eros Sa over S, Asporina Sa over A, Hygiea Xn
    over C, Eos B over K, Aquitania Xn over L. The fixed gaps 4 and 9 were also never calibrated.
    Injection–recovery of 190 real SpeX spectra, sampled like the DR1 observations, showed the effect:
    20% of injections had a wrong complex reported as distinguished. The deviance is now the full
    Gaussian, with class σ correlated over 0.2 µm, and the gaps are calibrated: 6 (Medium, C7), 10 (High),
    10 (subclass, C9). Wrong-and-distinguished then drops to 3.6%. Method: `docs/METHODS.md` §4b.
31. A complex-level PASS hid subclass results: Eros was reported as "S-type 91.9%" while the first class
    was Sa (60%, S 32%). The result now names the complex when the subclass is not distinguished, and
    the new criterion C9 scores the class with the C7 rule.
32. C7 took "first" from the summed complex probability but measured the gap with the minimum deviance
    per complex. When the two orders differed, it compared the reference with itself (16 Psyche: "gap to
    the runner-up X-complex: 0.0"). It now compares the reference with the best other complex by deviance,
    as the confidence does.

33. Analyses started from the dashboard (or `analyze`) could fail or leave bad records:
    - an unknown name ("zzzz12345") ran through and stored an empty "Insufficient Data" record;
    - an invalid date, an end before the start, or a window without SPHEREx data raised an exception
      from IRSA MOST, which would crash the page;
    - "Eros", "433 Eros" and "433" became three records of one object.

    The pipeline now checks the window and resolves the name in SBDB before anything is written. It
    stops with a message, storing nothing, for an unknown object, a bad window, no exposures, or an
    unreachable service, and it stores results under the SBDB designation. The dashboard uses date
    pickers, shows these messages and never raises; a successful run is selected in the main view.
    Tested headless with Streamlit's AppTest: every stored result opens without error, and a run with
    an unknown name warns and stores nothing.
34. The thermal fit used the normalisation group with the best min(continuum, thermal) points, even
    if it had fewer continuum points than the fit needs. 92 Undina (11 unlinked groups) got group 0, with
    3 continuum and 33 thermal points; the fit failed and no reflectance was made at all. The group now
    needs ≥ 4 continuum points. If no thermal fit is possible, the reflectance uses the points below
    2.5 µm whose upper bound on the thermal flux is < 1% (whole disk at the subsolar temperature, bond
    albedo 0, η 0.756, pV 0.02). For Undina the bound is 8 × 10⁻⁴.
35. The outlier test compared each point with the median within ±0.08 µm and skipped it if fewer than 4
    points fell in that window. A point 3× too faint at 1.93 µm in 69 Hesperia (flagged GOOD) was never
    tested; it gave χ²_red ≈ 7–12 and a distinguished B class (C9 FAIL). The window now widens (×1.5, ×2,
    ×3) until it holds 5 points. Hesperia: χ²_red 1.43, B 19.5 behind the first, no class decided.
36. C3 scored a failed D-type control as FAIL. A control that is not recovered means the sampling cannot
    identify a D-type, so the test cannot be made: INCONCLUSIVE, as C1 when the data are not sensitive
    enough. A D result despite a band, or a red slope turning a band-bearing template into D, is still
    FAIL.

## Open limitations and next steps
- **Classifier calibration (2026-11-15).** The thresholds rest on 190 in-sample SpeX spectra and on
  the pipeline's own error model. Real DR1 spectra may carry calibration or lightcurve systematics
  beyond it. C3's control should use real D-type spectra (see the results notes). Undina's thermal
  group choice and Hesperia's class-level miss are open.
- **Fast, elongated and bright rotators (433 Eros).** In a bright window the classification is not
  robust (2026-02: V, R or S depending on the lightcurve model and the saturated points); the
  saturation rule now moves the validation to a fainter window, where the type is recovered at Low
  confidence, but the thermal signal and hence D are weaker there. An external lightcurve or shape
  model, or spectral modelling of the simultaneous SWIR/MWIR detector pairs, would help both.
- **Saturated targets (16 Psyche).** Without the wing-only points no spectrum is possible. A PSF model
  validated on saturated stars, or an aperture method for saturated cores, would be needed.
- **Visit structure (10 Hygiea).** B1 is assembled from separate visits whose relative brightness is not
  tested by any repeat; one visit decides the narrow feature.
- **Calibration.** The calibration stars cover G 11.3–11.8 (golden-sample limit 12.3). Whether the narrow
  B1 structure depends on brightness needs fainter solar analogs (e.g. GSP-Phot candidates, which are not
  published as a list).
- **Visible slope.** A-types and Sa, and several C/X subclasses, differ mainly below 0.75 µm, which SPHEREx
  does not cover.
- The star cutout cache (`data/raw/spherex_cutouts_solar_analogs/`, 8.7 GB) can be deleted; the correction
  can be re-derived from `data/calibration/solar_analogs/*.csv` with `--from-saved`.
