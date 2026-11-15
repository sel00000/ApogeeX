# Analysis Report: 69

Generated 2026-11-15T02:47:59+00:00 - model version 0.1.0

## Identification

- Designation: 69 Hesperia (A861 HC)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 266
- Spectral points: 266
- Quality flags: {'WARN': 143, 'GOOD': 120, 'BAD': 3}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.3%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 2 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 20 (60 exposures, 16.10 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 20 bins / 42 points
- Brightness variability between visits: detected (p = 2.6e-15, visit-offset rms 0.08 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +3.97 | 0 |
| B2-B3 | +2.41 | 0 |
| B3-B4 | -6.38 | 0 |
| B4-B5 | +4.41 | 0 |
| B5-B6 | +1.97 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 16.10 d (phase angle 20.8-21.0 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 20 repeat bins (p = 2.6e-15); visit-offset rms 0.08 mag.
  - ⚠ Rotational lightcurve (P = 5.655 h) fitted to repeated observations only (peak-to-peak 0.24 mag, Delta-BIC 68); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.041 ± 0.1454 (fitted)
- Sub-solar temperature T_ss (K): 225.2 ± 7.9
- Reduced chi^2: 3.05
- Thermal excess S/N: N/A
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ No data at lambda >= 3.5 um; thermal emission cannot be constrained.
  - ⚠ Thermal emission detected by the likelihood of all points (13.5 sigma, 34% of the 4.4-5 um flux), although the single-group excess test gave no test.
  - ⚠ Diameter from the posterior of all 143 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | T | T-type | 28.8% | 1.43 |
| 2 | Xk | X-complex | 19.6% | 1.38 |
| 3 | X | X-complex | 18.4% | 1.26 |
| 4 | L | L-type | 13.5% | 1.42 |
| 5 | D | D-type | 6.6% | 1.40 |
| 6 | Xc | X-complex | 2.8% | 1.57 |
| 7 | S | S-complex | 2.0% | 1.42 |
| 8 | Xe | X-complex | 1.9% | 1.34 |
| 9 | K | K-type | 1.5% | 1.70 |
| 10 | Cgh | C-complex | 1.3% | 1.36 |
| 11 | Cg | C-complex | 1.1% | 1.52 |
| 12 | Xn | X-complex | 1.0% | 1.30 |
| 13 | Ch | C-complex | 0.9% | 1.54 |
| 14 | Cb | C-complex | 0.6% | 1.65 |
| 15 | Sr | S-complex | 0.1% | 1.76 |
| 16 | B | C-complex | <0.1% | 1.42 |
| 17 | C | C-complex | <0.1% | 2.11 |
| 18 | Sv | S-complex | <0.1% | 2.31 |
| 19 | Sq | S-complex | <0.1% | 2.27 |
| 20 | Sa | S-complex | <0.1% | 2.41 |
| 21 | Q | Q-type | <0.1% | 3.06 |
| 22 | V | V-type | <0.1% | 3.23 |
| 23 | R | R-type | <0.1% | 3.57 |
| 24 | A | A-type | <0.1% | 7.40 |
| 25 | O | O-type | <0.1% | 7.82 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | X-complex | 43.6% |
| 2 | T-type | 28.8% |
| 3 | L-type | 13.5% |
| 4 | D-type | 6.6% |
| 5 | C-complex | 3.9% |
| 6 | S-complex | 2.1% |
| 7 | K-type | 1.5% |
| 8 | Q-type | <0.1% |
| 9 | V-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | A-type | <0.1% |
| 12 | O-type | <0.1% |

- Most probable: **X-complex (subclass not determined: Xk 20%, X 18%)** — Confidence: Low
  - best complex X-complex vs runner-up T-type: delta score 0.8 (scaled deviance incl. prior)
  - most probable complex changes when single visits are left out (1 of 20 samples: T-type)
- S-complex vs D-type: not distinguished (D minus S deviance -2.3; favours D-type)
- Spectral slope used: yes (systematic 0.024 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.977 au, e 0.169, i 8.6 deg)
- Albedo term: pV 0.121 ± 0.12 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| X-complex | 43.6% | 54.1% |
| T-type | 28.8% | 26.2% |
| L-type | 13.5% | 2.8% |
| D-type | 6.6% | 3.6% |
| C-complex | 3.9% | 9.5% |
| S-complex | 2.1% | 3.6% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.121, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.
- The classification is not stable against leaving out single visits: 1 of 20 leave-one-visit-out samples give T-type instead of X-complex.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.935 ± 0.244 | 0.041 ± 0.047 | 0.071 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 2.002 ± 0.344 | 0.134 ± 0.038 | 0.113 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | 0.034 ± 0.023 | 0.068 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | 0.063 ± 0.025 | 0.074 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | 0.045 ± 0.019 | 0.058 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.210 (uncertainty not provided)
- G: 0.19
- Source: JPL SBDB MPO980522
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 92.7 ± 15.54
- Conditional range (no H): N/A
- Catalogue diameter (km): 138.1 ± 4.7 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: -45.43 km (-2.8 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 79.2-110.3 / 68.94-132.7
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 17.7 deg, x1.12 for 3.5-5 um: eta 1.00 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 143 (6 normalisation group(s), 38 of 39 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 13.5 — Beaming parameter eta (posterior median, 68%): 1.03 (0.90-1.19)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 3.1.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 103.8 km (68%: 89.15-122.3; 95%: 77.35-145.4) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 103.8 km (68%: 89.15-122.3) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 165.3 km (68%: 116.5-232 km; 95%: 82.26-323.2 km) — Confidence: Low
- Prior albedo of the same draws: 0.084 (68%: 0.043-0.170) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): X-complex 48%, T-type 20%, C-complex 11%, D-type 9%, L-type 8%, S-complex 4%, K-type 1%
- Thermal vs statistical diameter: thermal 92.7 km / statistical 165.3 km = 0.56, z = -1.5 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.268 ± 0.090
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.210 (uncertainty not provided) — JPL SBDB MPO980522
- D: 92.7 ± 15.54 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H and D treated as independent (no joint sensitivity available).
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 3.1). Albedo on hold.

## Mass and Density

- Mass (kg): N/A —  
- Status: Unknown (Mass unknown)
- Bulk density (kg/m^3): N/A
- Shape assumption: N/A — 

## Missing Data

- mass

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"69\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:46:24+00:00",
  "version": "orbit_id=158; soln_date=2026-06-05 03:07:02",
  "identifier": "20000069",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"69\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:46:24+00:00",
  "version": "orbit_id=158; soln_date=2026-06-05 03:07:02",
  "identifier": "20000069",
  "origin": "OBSERVED"
 }
]
```
