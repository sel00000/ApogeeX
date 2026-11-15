# Analysis Report: 236

Generated 2026-11-15T02:38:45+00:00 - model version 0.1.0

## Identification

- Designation: 236 Honoria (A884 HA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 359
- Spectral points: 359
- Quality flags: {'WARN': 271, 'GOOD': 82, 'BAD': 6}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 12.1%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 3 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 22 (60 exposures, 15.42 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 19 bins / 40 points
- Brightness variability between visits: detected (p = 7.4e-04, visit-offset rms 0.07 mag)
- Rotational lightcurve correction: not applied - periodic model explains 68% of the visit-to-visit variation (< 70%)
- Correction applied: visit_offsets; Normalisation groups: 11

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -5.03 | 0 |
| B2-B3 | -2.24 | 0 |
| B3-B4 | +7.74 | 0 |
| B4-B5 | -5.50 | 0 |
| B5-B6 | -2.24 | 0 |

  - ⚠ Spectrum assembled from 22 visits over 15.42 d (phase angle 16.3-18.9 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 19 repeat bins (p = 7.4e-04); visit-offset rms 0.07 mag.
  - ⚠ Periodic lightcurve correction NOT applied: periodic model explains 68% of the visit-to-visit variation (< 70%).
  - ⚠ 11 normalisation groups could not be linked: their relative brightness (and the spectral slope across them) is not constrained by the data.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.028 ± 0.1258 (fitted)
- Sub-solar temperature T_ss (K): 257.7 ± 7.9
- Reduced chi^2: 2.80
- Thermal excess S/N: 1.3
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal emission detected by the likelihood of all points (34.6 sigma, 72% of the 4.4-5 um flux), although the single-group excess test gave S/N 1.3.
  - ⚠ Diameter from the posterior of all 154 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | K | K-type | 41.2% | 1.47 |
| 2 | L | L-type | 26.2% | 1.53 |
| 3 | Sq | S-complex | 18.2% | 1.43 |
| 4 | S | S-complex | 3.5% | 1.49 |
| 5 | Xc | X-complex | 2.6% | 1.75 |
| 6 | Q | Q-type | 2.0% | 1.66 |
| 7 | Cg | C-complex | 1.0% | 1.49 |
| 8 | B | C-complex | 1.0% | 1.14 |
| 9 | Xe | X-complex | 0.9% | 1.55 |
| 10 | Sr | S-complex | 0.6% | 1.72 |
| 11 | Xk | X-complex | 0.6% | 1.76 |
| 12 | Xn | X-complex | 0.5% | 1.52 |
| 13 | Ch | C-complex | 0.5% | 1.76 |
| 14 | C | C-complex | 0.3% | 1.81 |
| 15 | Cgh | C-complex | 0.2% | 1.59 |
| 16 | Sa | S-complex | 0.2% | 1.73 |
| 17 | T | T-type | 0.2% | 2.00 |
| 18 | D | D-type | 0.1% | 1.56 |
| 19 | Cb | C-complex | <0.1% | 1.88 |
| 20 | Sv | S-complex | <0.1% | 2.17 |
| 21 | X | X-complex | <0.1% | 1.90 |
| 22 | A | A-type | <0.1% | 1.93 |
| 23 | R | R-type | <0.1% | 2.14 |
| 24 | O | O-type | <0.1% | 3.05 |
| 25 | V | V-type | <0.1% | 3.16 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | K-type | 41.2% |
| 2 | L-type | 26.2% |
| 3 | S-complex | 22.5% |
| 4 | X-complex | 4.7% |
| 5 | C-complex | 3.1% |
| 6 | Q-type | 2.0% |
| 7 | T-type | 0.2% |
| 8 | D-type | 0.1% |
| 9 | A-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | V-type | <0.1% |

- Most probable: **K** — Confidence: Low
  - best complex K-type vs runner-up L-type: delta score 0.9 (scaled deviance incl. prior)
  - most probable complex changes when single visits are left out (1 of 22 samples: L-type)
- S-complex vs D-type: distinguished (D minus S deviance +10.3; favours S-complex)
- Spectral slope used: yes (systematic 0.002 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.800 au, e 0.190, i 7.7 deg)
- Albedo term: pV 0.155 ± 0.10 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| K-type | 41.2% | 17.5% |
| L-type | 26.2% | 11.2% |
| S-complex | 22.5% | 29.2% |
| X-complex | 4.7% | 11.9% |
| C-complex | 3.1% | 25.4% |
| Q-type | 2.0% | 4.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- 11 normalisation groups fitted with independent brightness scales: only the spectral shape within each group is used.
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.155, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.
- The classification is not stable against leaving out single visits: 1 of 22 leave-one-visit-out samples give L-type instead of K-type.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| Band II | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | no continuum anchors |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 8.190 (uncertainty not provided)
- G: -0.02
- Source: JPL SBDB E2025-OF6
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 72.14 ± 11.62
- Conditional range (no H): N/A
- Catalogue diameter (km): 77.71 ± 1.234 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: -5.564 km (-0.5 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 61.74-84.99 / 53.5-100.4
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 25.3 deg, x1.12 for 3.5-5 um: eta 1.04 at 100 km, 1.09 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 154 (4 normalisation group(s), 48 of 52 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 34.6 — Beaming parameter eta (posterior median, 68%): 1.03 (0.91-1.16)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.8.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 75.05 km (68%: 65.89-86.04; 95%: 58.58-98.81) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 75.05 km (68%: 65.89-86.04) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 86.35 km (68%: 67.02-121.5 km; 95%: 54.63-179.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.125 (68%: 0.063-0.208) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): K-type 26%, S-complex 23%, C-complex 21%, L-type 19%, X-complex 7%, Q-type 2%
- Thermal vs statistical diameter: thermal 72.14 km / statistical 86.35 km = 0.84, z = -0.5 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.180 ± 0.058
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 8.190 (uncertainty not provided) — JPL SBDB E2025-OF6
- D: 72.14 ± 11.62 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H and D treated as independent (no joint sensitivity available).
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.

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
  "query": "{\"sstr\": \"236\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:37:09+00:00",
  "version": "orbit_id=79; soln_date=2026-06-05 03:19:58",
  "identifier": "20000236",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"236\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:37:09+00:00",
  "version": "orbit_id=79; soln_date=2026-06-05 03:19:58",
  "identifier": "20000236",
  "origin": "OBSERVED"
 }
]
```
