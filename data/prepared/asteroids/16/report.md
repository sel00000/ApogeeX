# Analysis Report: 16

Generated 2026-11-15T04:23:23+00:00 - model version 0.1.0

## Identification

- Designation: 16 Psyche (A852 FA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 295
- Spectral points: 295
- Quality flags: {'WARN': 253, 'GOOD': 31, 'BAD': 11}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.8%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 2 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 21 (60 exposures, 12.36 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 16 bins / 34 points
- Brightness variability between visits: not detected (p = 0.015)
- Rotational lightcurve correction: not applied - no significant variability between visits
- Correction applied: none; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +6.18 | 0 |
| B2-B3 | +3.54 | 0 |
| B3-B4 | -9.71 | 0 |
| B4-B5 | +6.18 | 0 |
| B5-B6 | +3.53 | 0 |

  - ⚠ Spectrum assembled from 21 visits over 12.36 d (phase angle 22.8-23.0 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness consistent between visits on 16 repeat bins (p = 0.015): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.069 mag for the 6 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 15 visits not linked to it (10 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.035 ± 0.1483 (fitted)
- Sub-solar temperature T_ss (K): 239.1 ± 8.6
- Reduced chi^2: 10.73
- Thermal excess S/N: 16.8
- Internal 2-um reflectance parameter (not pV): 0.1931
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=22.7 deg -> eta0=1.10 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ Free eta reached its bound (0.50); D-eta degenerate for these data. Refitted with eta fixed at 1.10 and uncertainty -0.3/+0.55 propagated.
  - ⚠ Poor fit: reduced chi^2 = 4.85 > 3.0. Model may not describe the data (rotation, calibration, contamination).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 162 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 258.1 +- 150.9 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | T | T-type | 28.9% | 0.56 |
| 2 | K | K-type | 16.5% | 0.62 |
| 3 | L | L-type | 13.6% | 0.57 |
| 4 | Xk | X-complex | 11.6% | 0.56 |
| 5 | Xc | X-complex | 6.1% | 0.57 |
| 6 | X | X-complex | 5.4% | 0.57 |
| 7 | Cb | C-complex | 4.1% | 0.58 |
| 8 | C | C-complex | 2.9% | 0.61 |
| 9 | D | D-type | 2.8% | 0.59 |
| 10 | Cg | C-complex | 2.7% | 0.58 |
| 11 | Ch | C-complex | 2.0% | 0.58 |
| 12 | Xe | X-complex | 1.2% | 0.59 |
| 13 | Cgh | C-complex | 1.1% | 0.58 |
| 14 | S | S-complex | 0.5% | 0.69 |
| 15 | Xn | X-complex | 0.3% | 0.63 |
| 16 | Sq | S-complex | 0.1% | 0.83 |
| 17 | Sr | S-complex | <0.1% | 0.83 |
| 18 | Sv | S-complex | <0.1% | 0.96 |
| 19 | Q | Q-type | <0.1% | 1.01 |
| 20 | B | C-complex | <0.1% | 0.78 |
| 21 | Sa | S-complex | <0.1% | 1.05 |
| 22 | R | R-type | <0.1% | 1.36 |
| 23 | O | O-type | <0.1% | 2.26 |
| 24 | V | V-type | <0.1% | 2.02 |
| 25 | A | A-type | <0.1% | 2.19 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | T-type | 28.9% |
| 2 | X-complex | 24.6% |
| 3 | K-type | 16.5% |
| 4 | L-type | 13.6% |
| 5 | C-complex | 12.9% |
| 6 | D-type | 2.8% |
| 7 | S-complex | 0.7% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | O-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **T** — Confidence: Low
  - best complex T-type vs runner-up X-complex: delta score 0.3 (scaled deviance incl. prior)
  - most probable complex changes when single visits are left out (1 of 18 samples: K-type)
  - most probable complex changes (T-type -> Insufficient Data) without the 63 saturated (wing-only) points
  - saturation-limited spectrum: 52 of 56 points in 0.75-2.45 um (93%) have a saturated PSF core (limit 20%)
- S-complex vs D-type: not distinguished (D minus S deviance -2.7; favours D-type)
- Spectral slope used: yes (systematic 0.046 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.926 au, e 0.135, i 3.1 deg)
- Albedo term: pV 0.119 ± 0.10 dex (catalogue diameter with current H (Shepard et al. (2021), The Planetary Science Journal 2, 125))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| T-type | 28.9% | 20.8% |
| X-complex | 24.6% | 35.0% |
| K-type | 16.5% | 2.4% |
| L-type | 13.6% | 3.5% |
| C-complex | 12.9% | 34.4% |
| D-type | 2.8% | 2.5% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.119, catalogue diameter with current H (Shepard et al. (2021), The Planetary Science Journal 2, 125)). The spectral-only ranking is kept separately.
- The classification is not stable against leaving out single visits: 1 of 18 leave-one-visit-out samples give K-type instead of T-type.
- The classification depends on 63 points with a saturated PSF core: without them the most probable complex is Insufficient Data.
- Saturation-limited spectrum: 52 of 56 points in 0.75-2.45 um (93%) have a saturated PSF core (limit 20%); a fainter observing window is needed.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.133 ± 0.415 | 0.222 ± 0.113 | 0.024 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.837 ± 0.562 | 0.224 ± 0.111 | 0.105 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | 0.072 ± 0.055 | 0.165 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | 0.051 ± 0.049 | 0.146 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | 0.056 ± 0.049 | 0.148 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 6.200 (uncertainty not provided)
- G: 0.2
- Source: JPL SBDB E2024-XU9
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 259.5 ± 54.49
- Conditional range (no H): N/A
- Catalogue diameter (km): 222 (uncertainty not provided) (Shepard et al. (2021), The Planetary Science Journal 2, 125)
- Difference: 37.46 km (0.7 sigma)
- Confidence: Low
- Catalogue shape at the SPHEREx geometry, effective diameter (km): 208 (190.4-253.8) - what a spherical NEATM gives for the catalogue shape (f = 0.94 x the volume-equivalent diameter; ellipsoid 274.9 x 235.4 x 169.1 km; phase 23 deg; no spin pole in SBDB: median and 68% range over isotropic poles). A NEATM diameter is an effective diameter; a shape-model diameter is volume-equivalent.
  - ⚠ No spin pole in SBDB: f is the median over isotropic poles, and its 68% range is part of the comparison uncertainty.
- Best diameter against the catalogue (z, log space): -0.9 against the catalogue diameter, -1.0 against the effective diameter of the catalogue shape (negative: SPHEREx larger)
- Diameter, 68% / 95% interval (km): 212.3-321.3 / 177.6-401.1
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 20.9 deg, x1.12 for 3.5-5 um: eta 1.02 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 162 (4 normalisation group(s), 40 of 44 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 29.3 — Beaming parameter eta (posterior median, 68%): 1.03 (0.89-1.19)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 10.7.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 258.7 km (68%: 217.9-309.3; 95%: 186.6-369.5) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 258.7 km (68%: 217.9-309.3) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 258.5 km (68%: 188.7-355.8 km; 95%: 135.9-477.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.088 (68%: 0.046-0.164) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 36%, X-complex 25%, T-type 19%, L-type 8%, K-type 7%, D-type 3%, S-complex 1%
- Thermal vs statistical diameter: thermal 259.5 km / statistical 258.5 km = 1.00, z = +0.0 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.087 ± 0.036
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 6.200 (uncertainty not provided) — JPL SBDB E2024-XU9
- D: 259.5 ± 54.49 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 10.7). Albedo on hold.

## Mass and Density

- Mass (kg): 2.399e+19 ± 2.547e+17 — D: database GM (JPL SBDB) Farnocchia et al. (2024), AJ 168, 21
- Status: ON_HOLD_VALIDATION (based on a Low-confidence SPHEREx diameter; relative uncertainty 0.63 > 0.5)
- Bulk density (kg/m^3): 2623 ± 1653
- Shape assumption: spherical_assumption — V = 4/3 pi (D/2)^3

## Missing Data

- none

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"16\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=92; soln_date=2025-02-06 14:15:44",
  "identifier": "20000016",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"16\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=92; soln_date=2025-02-06 14:15:44",
  "identifier": "20000016",
  "origin": "OBSERVED"
 }
]
```
