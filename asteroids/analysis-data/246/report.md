# Analysis Report: 246

Generated 2026-11-15T02:40:18+00:00 - model version 0.1.0

## Identification

- Designation: 246 Asporina (A885 EA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 282
- Spectral points: 282
- Quality flags: {'WARN': 247, 'GOOD': 25, 'BAD': 10}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 9.3%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 22 (59 exposures, 11.68 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 39 bins / 82 points
- Brightness variability between visits: detected (p = 7.8e-46, visit-offset rms 0.11 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +3.09 | 0 |
| B2-B3 | +2.99 | 0 |
| B3-B4 | -6.08 | 0 |
| B4-B5 | +3.74 | 0 |
| B5-B6 | +2.34 | 0 |

  - ⚠ Spectrum assembled from 22 visits over 11.68 d (phase angle 19.4-19.6 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 39 repeat bins (p = 7.8e-46); visit-offset rms 0.11 mag.
  - ⚠ Rotational lightcurve (P = 16.222 h) fitted to repeated observations only (peak-to-peak 0.41 mag, Delta-BIC 262); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.078 ± 0.1535 (fitted)
- Sub-solar temperature T_ss (K): 229.5 ± 8.2
- Reduced chi^2: 1.71
- Thermal excess S/N: -0.7
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal emission detected by the likelihood of all points (30.2 sigma, 48% of the 4.4-5 um flux), although the single-group excess test gave S/N -0.7.
  - ⚠ Diameter from the posterior of all 143 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | A | A-type | 99.5% | 1.09 |
| 2 | Sa | S-complex | 0.5% | 1.35 |
| 3 | Q | Q-type | <0.1% | 3.26 |
| 4 | S | S-complex | <0.1% | 3.38 |
| 5 | Sq | S-complex | <0.1% | 3.70 |
| 6 | B | C-complex | <0.1% | 2.77 |
| 7 | O | O-type | <0.1% | 3.84 |
| 8 | K | K-type | <0.1% | 3.77 |
| 9 | D | D-type | <0.1% | 4.20 |
| 10 | X | X-complex | <0.1% | 4.20 |
| 11 | Xn | X-complex | <0.1% | 3.80 |
| 12 | Xe | X-complex | <0.1% | 3.88 |
| 13 | Cgh | C-complex | <0.1% | 3.98 |
| 14 | Sr | S-complex | <0.1% | 5.08 |
| 15 | Cg | C-complex | <0.1% | 4.70 |
| 16 | L | L-type | <0.1% | 5.33 |
| 17 | R | R-type | <0.1% | 6.93 |
| 18 | Xk | X-complex | <0.1% | 6.83 |
| 19 | Cb | C-complex | <0.1% | 6.56 |
| 20 | V | V-type | <0.1% | 7.36 |
| 21 | C | C-complex | <0.1% | 7.90 |
| 22 | T | T-type | <0.1% | 8.80 |
| 23 | Ch | C-complex | <0.1% | 7.96 |
| 24 | Xc | X-complex | <0.1% | 8.83 |
| 25 | Sv | S-complex | <0.1% | 13.51 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | A-type | 99.5% |
| 2 | S-complex | 0.5% |
| 3 | Q-type | <0.1% |
| 4 | C-complex | <0.1% |
| 5 | O-type | <0.1% |
| 6 | K-type | <0.1% |
| 7 | X-complex | <0.1% |
| 8 | D-type | <0.1% |
| 9 | L-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | T-type | <0.1% |

- Most probable: **A** — Confidence: High
  - best complex A-type vs runner-up S-complex: delta score 10.4 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +57.3; favours S-complex)
- Spectral slope used: yes (systematic 0.023 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.696 au, e 0.107, i 15.6 deg)
- Albedo term: pV 0.243 ± 0.14 dex (catalogue diameter with current H; catalogue albedo 0.193 disagrees by +0.10 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| A-type | 99.5% | 98.4% |
| S-complex | 0.5% | 1.6% |
| Q-type | <0.1% | <0.1% |
| C-complex | <0.1% | <0.1% |
| O-type | <0.1% | <0.1% |
| K-type | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.243, catalogue diameter with current H; catalogue albedo 0.193 disagrees by +0.10 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | DETECTED | 1.091 ± 0.012 | 0.330 ± 0.023 | 0.028 | full_band |
| Band II | NOT_DETECTED | 2.155 ± 0.000 | 0.099 ± 0.038 | 0.114 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Olivine | Band I centre 1.091 um, BAR None | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 8.620 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026E71
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 57.68 ± 10.79
- Conditional range (no H): N/A
- Catalogue diameter (km): 50.89 ± 0.439 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: 6.79 km (0.6 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 48.39-69.98 / 41.47-85.57
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 19.6 deg, x1.12 for 3.5-5 um: eta 1.01 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 143 (1 normalisation group(s), 37 of 37 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 30.2 — Beaming parameter eta (posterior median, 68%): 1.07 (0.93-1.24)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 1.7.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 56.13 km (68%: 50.08-63.02; 95%: 44.95-70.76) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 56.13 km (68%: 50.08-63.02) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 55.43 km (68%: 47.78-64.53 km; 95%: 41.23-74.6 km) — Confidence: Low
- Prior albedo of the same draws: 0.205 (68%: 0.151-0.276) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): A-type 99%, S-complex 1%
- Thermal vs statistical diameter: thermal 57.68 km / statistical 55.43 km = 1.04, z = +0.2 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.189 ± 0.071
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 8.620 (uncertainty not provided) — JPL SBDB E2026E71
- D: 57.68 ± 10.79 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"246\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:39:21+00:00",
  "version": "orbit_id=92; soln_date=2026-06-05 03:20:47",
  "identifier": "20000246",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"246\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:39:21+00:00",
  "version": "orbit_id=92; soln_date=2026-06-05 03:20:47",
  "identifier": "20000246",
  "origin": "OBSERVED"
 }
]
```
