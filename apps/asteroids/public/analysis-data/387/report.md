# Analysis Report: 387

Generated 2026-11-15T02:48:07+00:00 - model version 0.1.0

## Identification

- Designation: 387 Aquitania (A894 EC)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 252
- Spectral points: 252
- Quality flags: {'WARN': 143, 'GOOD': 103, 'BAD': 6}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 10.8%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 19 (59 exposures, 12.36 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 26 bins / 61 points
- Brightness variability between visits: detected (p = 5.5e-09, visit-offset rms 0.05 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +3.50 | 0 |
| B2-B3 | +1.84 | 0 |
| B3-B4 | -5.78 | 0 |
| B4-B5 | +3.94 | 0 |
| B5-B6 | +1.84 | 0 |

  - ⚠ Spectrum assembled from 19 visits over 12.36 d (phase angle 19.7-20.0 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 26 repeat bins (p = 5.5e-09); visit-offset rms 0.05 mag.
  - ⚠ Rotational lightcurve (P = 24.144 h) fitted to repeated observations only (peak-to-peak 0.22 mag, Delta-BIC 59); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.068 ± 0.157 (fitted)
- Sub-solar temperature T_ss (K): 231.4 ± 8.5
- Reduced chi^2: 7.86
- Thermal excess S/N: N/A
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ No data at lambda >= 3.5 um; thermal emission cannot be constrained.
  - ⚠ Thermal emission detected by the likelihood of all points (31.6 sigma, 69% of the 4.4-5 um flux), although the single-group excess test gave no test.
  - ⚠ Diameter from the posterior of all 139 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | L | L-type | 56.1% | 1.39 |
| 2 | Xc | X-complex | 15.1% | 1.49 |
| 3 | Xk | X-complex | 9.7% | 1.45 |
| 4 | K | K-type | 4.7% | 1.66 |
| 5 | T | T-type | 3.6% | 1.49 |
| 6 | Ch | C-complex | 3.5% | 1.43 |
| 7 | Xe | X-complex | 2.7% | 1.39 |
| 8 | X | X-complex | 1.8% | 1.43 |
| 9 | Cgh | C-complex | 0.9% | 1.36 |
| 10 | Cb | C-complex | 0.7% | 1.58 |
| 11 | Xn | X-complex | 0.6% | 1.46 |
| 12 | Cg | C-complex | 0.5% | 1.56 |
| 13 | S | S-complex | 0.1% | 1.86 |
| 14 | D | D-type | <0.1% | 1.70 |
| 15 | C | C-complex | <0.1% | 2.08 |
| 16 | B | C-complex | <0.1% | 1.44 |
| 17 | Sr | S-complex | <0.1% | 2.53 |
| 18 | Sq | S-complex | <0.1% | 2.67 |
| 19 | Sv | S-complex | <0.1% | 3.55 |
| 20 | Sa | S-complex | <0.1% | 3.27 |
| 21 | Q | Q-type | <0.1% | 3.68 |
| 22 | V | V-type | <0.1% | 4.67 |
| 23 | R | R-type | <0.1% | 5.22 |
| 24 | O | O-type | <0.1% | 8.13 |
| 25 | A | A-type | <0.1% | 8.21 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | L-type | 56.1% |
| 2 | X-complex | 29.8% |
| 3 | C-complex | 5.6% |
| 4 | K-type | 4.7% |
| 5 | T-type | 3.6% |
| 6 | S-complex | 0.1% |
| 7 | D-type | <0.1% |
| 8 | Q-type | <0.1% |
| 9 | V-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **L** — Confidence: Low
  - best complex L-type vs runner-up X-complex: delta score 1.3 (scaled deviance incl. prior)
  - most probable complex changes (L-type -> X-complex) with the lightcurve correction scaled by 1 -/+ 0.10 or computed with the BIC runner-up number of harmonics
- S-complex vs D-type: not distinguished (D minus S deviance +1.0; favours S-complex)
- Spectral slope used: yes (systematic 0.035 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.737 au, e 0.238, i 18.1 deg)
- Albedo term: pV 0.176 ± 0.11 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| L-type | 56.1% | 12.2% |
| X-complex | 29.8% | 40.2% |
| C-complex | 5.6% | 39.2% |
| K-type | 4.7% | 1.1% |
| T-type | 3.6% | 6.9% |
| S-complex | 0.1% | 0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.176, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.
- The classification depends on the rotational-lightcurve model: with the correction scaled by 1 -/+ 0.10, or with the BIC runner-up number of harmonics, the most probable complex becomes X-complex.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.263 ± 0.879 | 0.096 ± 0.040 | 0.032 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.919 ± 0.980 | 0.130 ± 0.072 | 0.157 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | DETECTED | 2.800 ± 0.150 | 0.054 ± 0.017 | 0.051 | Thermal-corrected; depends on thermal model accuracy. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | 0.031 ± 0.019 | 0.056 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | 0.008 ± 0.027 | 0.082 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Phyllosilicates / OH-bearing minerals | OH / phyllosilicate (2.7-2.9 um): depth 0.054 +/- 0.017 | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.490 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2025L21
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 108.8 ± 22
- Conditional range (no H): N/A
- Catalogue diameter (km): 100.5 ± 2.9 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: 8.331 km (0.4 sigma)
- Confidence: Low
- Diameter, 68% / 95% interval (km): 89.96-134 / 76.1-166.3
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 20.0 deg, x1.12 for 3.5-5 um: eta 1.01 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 139 (7 normalisation group(s), 29 of 33 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 31.6 — Beaming parameter eta (posterior median, 68%): 1.06 (0.91-1.23)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 7.9.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 119.1 km (68%: 101.2-141.8; 95%: 86.96-170.7) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 119.1 km (68%: 101.2-141.8) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 153.9 km (68%: 111.3-219.9 km; 95%: 82.78-307.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.075 (68%: 0.037-0.144) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): X-complex 35%, C-complex 31%, L-type 28%, T-type 4%, K-type 2%
- Thermal vs statistical diameter: thermal 108.8 km / statistical 153.9 km = 0.71, z = -0.9 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.150 ± 0.061
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.490 (uncertainty not provided) — JPL SBDB E2025L21
- D: 108.8 ± 22 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H and D treated as independent (no joint sensitivity available).
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 7.9). Albedo on hold.

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
  "query": "{\"sstr\": \"387\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:46:51+00:00",
  "version": "orbit_id=148; soln_date=2026-06-05 03:32:10",
  "identifier": "20000387",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"387\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:46:51+00:00",
  "version": "orbit_id=148; soln_date=2026-06-05 03:32:10",
  "identifier": "20000387",
  "origin": "OBSERVED"
 }
]
```
