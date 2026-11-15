# Analysis Report: 308

Generated 2026-11-15T02:40:13+00:00 - model version 0.1.0

## Identification

- Designation: 308 Polyxo (A891 FA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 257
- Spectral points: 257
- Quality flags: {'GOOD': 137, 'WARN': 115, 'BAD': 5}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 20 (60 exposures, 28.87 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 32 bins / 76 points
- Brightness variability between visits: detected (p = 6.4e-21, visit-offset rms 0.05 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +1.23 | 0 |
| B2-B3 | +1.76 | 0 |
| B3-B4 | -2.99 | 0 |
| B4-B5 | +1.23 | 0 |
| B5-B6 | +1.76 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 28.87 d (phase angle 20.9-22.1 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 32 repeat bins (p = 6.4e-21); visit-offset rms 0.05 mag.
  - ⚠ Rotational lightcurve (P = 12.031 h) fitted to repeated observations only (peak-to-peak 0.16 mag, Delta-BIC 102); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.011 ± 0.1337 (fitted)
- Sub-solar temperature T_ss (K): 241.4 ± 8.0
- Reduced chi^2: 3.80
- Thermal excess S/N: N/A
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ No data at lambda >= 3.5 um; thermal emission cannot be constrained.
  - ⚠ Thermal emission detected by the likelihood of all points (44.1 sigma, 90% of the 4.4-5 um flux), although the single-group excess test gave no test.
  - ⚠ Diameter from the posterior of all 142 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | T | T-type | 69.9% | 0.72 |
| 2 | D | D-type | 23.7% | 0.64 |
| 3 | X | X-complex | 4.3% | 0.71 |
| 4 | Xk | X-complex | 1.7% | 0.83 |
| 5 | Xc | X-complex | 0.2% | 0.85 |
| 6 | Cg | C-complex | 0.1% | 1.04 |
| 7 | L | L-type | <0.1% | 0.82 |
| 8 | Cgh | C-complex | <0.1% | 0.91 |
| 9 | Cb | C-complex | <0.1% | 1.18 |
| 10 | Ch | C-complex | <0.1% | 0.95 |
| 11 | Xe | X-complex | <0.1% | 1.03 |
| 12 | Xn | X-complex | <0.1% | 1.20 |
| 13 | S | S-complex | <0.1% | 1.33 |
| 14 | C | C-complex | <0.1% | 1.72 |
| 15 | K | K-type | <0.1% | 1.40 |
| 16 | B | C-complex | <0.1% | 1.43 |
| 17 | Sr | S-complex | <0.1% | 2.13 |
| 18 | Sq | S-complex | <0.1% | 2.43 |
| 19 | Sa | S-complex | <0.1% | 2.59 |
| 20 | Sv | S-complex | <0.1% | 2.90 |
| 21 | Q | Q-type | <0.1% | 3.69 |
| 22 | V | V-type | <0.1% | 4.64 |
| 23 | R | R-type | <0.1% | 5.33 |
| 24 | O | O-type | <0.1% | 8.07 |
| 25 | A | A-type | <0.1% | 8.65 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | T-type | 69.9% |
| 2 | D-type | 23.7% |
| 3 | X-complex | 6.2% |
| 4 | C-complex | 0.2% |
| 5 | L-type | <0.1% |
| 6 | S-complex | <0.1% |
| 7 | K-type | <0.1% |
| 8 | Q-type | <0.1% |
| 9 | V-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **T** — Confidence: Low
  - best complex T-type vs runner-up D-type: delta score 2.2 (scaled deviance incl. prior)
  - most probable complex changes (T-type -> D-type) with the lightcurve correction scaled by 1 -/+ 0.10 or computed with the BIC runner-up number of harmonics
- S-complex vs D-type: distinguished (D minus S deviance -27.0; favours D-type)
- Spectral slope used: yes (systematic 0.014 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.749 au, e 0.038, i 4.4 deg)
- Albedo term: pV 0.058 ± 0.13 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| T-type | 69.9% | 55.3% |
| D-type | 23.7% | 32.5% |
| X-complex | 6.2% | 12.0% |
| C-complex | 0.2% | 0.2% |
| L-type | <0.1% | <0.1% |
| S-complex | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.058, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.
- The classification depends on the rotational-lightcurve model: with the correction scaled by 1 -/+ 0.10, or with the BIC runner-up number of harmonics, the most probable complex becomes D-type.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.861 ± 0.126 | 0.037 ± 0.032 | 0.005 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 2.069 ± 0.617 | 0.067 ± 0.044 | 0.027 | not detected; a typical band-bearing asteroid would be detectable here |
| OH / phyllosilicate (2.7-2.9 um) | DETECTED | 2.800 ± 0.150 | 0.170 ± 0.012 | 0.037 | Thermal-corrected; depends on thermal model accuracy. |
| H2O ice / NH4 (3.0-3.2 um) | DETECTED | 3.100 ± 0.150 | 0.083 ± 0.016 | 0.049 | Thermal-corrected; depends on thermal model accuracy. |
| C-H organics (3.35-3.55 um) | NOT_EVALUABLE | N/A | N/A | N/A | no data in window |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Phyllosilicates / OH-bearing minerals | OH / phyllosilicate (2.7-2.9 um): depth 0.170 +/- 0.012 | Medium |
| Water ice or NH4-bearing phases | H2O ice / NH4 (3.0-3.2 um): depth 0.083 +/- 0.016 | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 8.170 (uncertainty not provided)
- G: 0.21
- Source: JPL SBDB MPO964269
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 155.7 ± 35.65
- Conditional range (no H): N/A
- Catalogue diameter (km): 128.6 ± 1.557 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: 27.12 km (0.8 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 124.6-195.9 / 101.3-246.5
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 20.8 deg, x1.12 for 3.5-5 um: eta 1.02 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 142 (7 normalisation group(s), 30 of 34 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 44.1 — Beaming parameter eta (posterior median, 68%): 1.01 (0.89-1.15)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 3.8.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 140.1 km (68%: 118.4-166.3; 95%: 100.9-197.4) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 140.1 km (68%: 118.4-166.3) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 121.4 km (68%: 93.38-158.9 km; 95%: 70.49-208.7 km) — Confidence: Low
- Prior albedo of the same draws: 0.065 (68%: 0.038-0.109) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): T-type 69%, D-type 22%, X-complex 9%
- Thermal vs statistical diameter: thermal 155.7 km / statistical 121.4 km = 1.28, z = +0.7 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.039 ± 0.018
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 8.170 (uncertainty not provided) — JPL SBDB MPO964269
- D: 155.7 ± 35.65 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H and D treated as independent (no joint sensitivity available).
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 3.8). Albedo on hold.

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
  "query": "{\"sstr\": \"308\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:38:48+00:00",
  "version": "orbit_id=132; soln_date=2026-06-05 03:26:37",
  "identifier": "20000308",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"308\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:38:48+00:00",
  "version": "orbit_id=132; soln_date=2026-06-05 03:26:37",
  "identifier": "20000308",
  "origin": "OBSERVED"
 }
]
```
