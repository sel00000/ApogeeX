# Analysis Report: 433

Generated 2026-11-14T14:04:42+00:00 - model version 0.1.0

## Identification

- Designation: 433 Eros (A898 PA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 218
- Spectral points: 160
- Quality flags: {'WARN': 142, 'BAD': 10, 'GOOD': 8}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 12.2%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 24 (75 exposures, 14.33 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 29 bins / 80 points
- Brightness variability between visits: detected (p = 0.0e+00, visit-offset rms 0.41 mag)
- Rotational lightcurve correction: applied - supported per arm: MWIR, SWIR
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -1.63 | 0 |
| B2-B3 | -1.90 | 0 |
| B3-B4 | +3.53 | 0 |
| B4-B5 | -1.63 | 0 |
| B5-B6 | -3.02 | 0 |

  - ⚠ Spectrum assembled from 24 visits over 14.33 d (phase angle 58.9-60.3 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 29 repeat bins (p = 0.0e+00); visit-offset rms 0.41 mag.
  - ⚠ SWIR and MWIR lightcurves differ (p = 2.0e-06); each arm is tested and corrected separately (normalised to its own rotation-averaged brightness).
  - ⚠ SWIR lightcurve applied (peak-to-peak 1.25 mag, Delta-BIC 1919, phase coverage 100%).
  - ⚠ MWIR lightcurve applied (peak-to-peak 2.14 mag, Delta-BIC 3816, phase coverage 80%).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 0.6493 ± 0.2269 (fitted)
- Sub-solar temperature T_ss (K): 360.5 ± 31.5
- Reduced chi^2: 1.10
- Thermal excess S/N: 15.1
- Internal 2-um reflectance parameter (not pV): 0.5028
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=59.5 deg -> eta0=1.47 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | R | R-type | 74.0% | 1.28 |
| 2 | Sv | S-complex | 12.0% | 1.50 |
| 3 | Sr | S-complex | 10.3% | 1.44 |
| 4 | S | S-complex | 2.4% | 1.54 |
| 5 | Sq | S-complex | 1.1% | 1.68 |
| 6 | Q | Q-type | 0.2% | 1.85 |
| 7 | V | V-type | <0.1% | 1.81 |
| 8 | D | D-type | <0.1% | 2.07 |
| 9 | Xn | X-complex | <0.1% | 1.96 |
| 10 | Cgh | C-complex | <0.1% | 2.08 |
| 11 | X | X-complex | <0.1% | 2.21 |
| 12 | K | K-type | <0.1% | 2.18 |
| 13 | Xe | X-complex | <0.1% | 2.14 |
| 14 | B | C-complex | <0.1% | 1.89 |
| 15 | L | L-type | <0.1% | 2.19 |
| 16 | Sa | S-complex | <0.1% | 2.25 |
| 17 | Xk | X-complex | <0.1% | 2.48 |
| 18 | O | O-type | <0.1% | 2.46 |
| 19 | Cg | C-complex | <0.1% | 2.52 |
| 20 | T | T-type | <0.1% | 2.68 |
| 21 | Ch | C-complex | <0.1% | 2.64 |
| 22 | Cb | C-complex | <0.1% | 2.80 |
| 23 | Xc | X-complex | <0.1% | 2.83 |
| 24 | C | C-complex | <0.1% | 3.26 |
| 25 | A | A-type | <0.1% | 3.19 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | R-type | 74.0% |
| 2 | S-complex | 25.8% |
| 3 | Q-type | 0.2% |
| 4 | V-type | <0.1% |
| 5 | X-complex | <0.1% |
| 6 | D-type | <0.1% |
| 7 | C-complex | <0.1% |
| 8 | K-type | <0.1% |
| 9 | L-type | <0.1% |
| 10 | O-type | <0.1% |
| 11 | T-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **R** — Confidence: Low
  - best complex R-type vs runner-up S-complex: delta deviance 3.6 (scaled)
  - most probable complex changes when single visits are left out (2 of 24 samples: S-complex)
  - saturation-limited spectrum: 26 of 69 points in 0.75-2.45 um (38%) have a saturated PSF core (limit 20%)
- S-complex vs D-type: distinguished (D minus S deviance +15.4; favours S-complex)
- Spectral slope used: yes (systematic 0.053 /um)
- Relative probabilities among the 25 Bus-DeMeo reference classes, computed from chi-square with errors scaled by the best-fit reduced chi-square. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- The classification is not stable against leaving out single visits: 2 of 24 leave-one-visit-out samples give S-complex instead of R-type.
- Saturation-limited spectrum: 26 of 69 points in 0.75-2.45 um (38%) have a saturated PSF core (limit 20%); a fainter observing window is needed.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.164 ± 0.312 | 0.263 ± 0.082 | 0.116 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.973 ± 0.127 | 0.470 ± 0.054 | 0.131 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | 0.084 ± 0.126 | 0.377 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | 0.074 ± 0.084 | 0.253 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | DETECTED | 3.450 ± 0.100 | 0.403 ± 0.133 | 0.399 | Thermal-corrected; depends on thermal model accuracy. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Organic-rich materials | C-H organics (3.35-3.55 um): depth 0.403 +/- 0.133 | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 10.400 (uncertainty not provided)
- G: 0.46
- Source: JPL SBDB E2026L10
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 12.55 ± 1.686
- Conditional range (no H): N/A
- Catalogue diameter (km): 16.84 ± 0.06 (Yeomans et al. (2000) Science v.289,pp.2085-2088)
- Difference: -4.29 km (-2.5 sigma)
- Confidence: Medium

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.776 ± 0.209
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 10.400 (uncertainty not provided) — JPL SBDB E2026L10
- D: 12.55 ± 1.686 km — SPHEREx NEATM fit (eta fitted)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.

## Mass and Density

- Mass (kg): 6.687e+15 ± 1.498e+12 — D: database GM (JPL SBDB) Yeomans et al. (2000) Science v.289,pp.2085-2088
- Status: ESTIMATED
- Bulk density (kg/m^3): 6461 ± 2605
- Shape assumption: spherical_assumption — V = 4/3 pi (D/2)^3

## Missing Data

- none

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"433\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-14T14:04:34+00:00",
  "version": "orbit_id=659; soln_date=2021-05-24 17:55:05",
  "identifier": "20000433",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"433\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-14T14:04:34+00:00",
  "version": "orbit_id=659; soln_date=2021-05-24 17:55:05",
  "identifier": "20000433",
  "origin": "OBSERVED"
 }
]
```
