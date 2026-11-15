# Analysis Report: 2566

Generated 2026-11-15T02:49:05+00:00 - model version 0.1.0

## Identification

- Designation: 2566 Kirghizia (1979 FR2)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 213
- Spectral points: 213
- Quality flags: {'WARN': 136, 'GOOD': 77}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 20 (60 exposures, 14.06 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 23 bins / 49 points
- Brightness variability between visits: detected (p = 9.2e-47, visit-offset rms 0.41 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -3.81 | 0 |
| B2-B3 | -4.14 | 0 |
| B3-B4 | +7.95 | 0 |
| B4-B5 | -3.13 | 0 |
| B5-B6 | -4.82 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 14.06 d (phase angle 21.0-23.2 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 23 repeat bins (p = 9.2e-47); visit-offset rms 0.41 mag.
  - ⚠ Rotational lightcurve (P = 4.451 h) fitted to repeated observations only (peak-to-peak 1.32 mag, Delta-BIC 259); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: INSUFFICIENT_THERMAL
- Beaming parameter eta: N/A (fixed)
- Sub-solar temperature T_ss (K): N/A
- Reduced chi^2: N/A
- Thermal excess S/N: 1.6
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal excess S/N = 1.6 < 3.0: no diameter is derived. Reflectance beyond ~3 um may include unmodelled thermal emission.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | V | V-type | 100.0% | 2.10 |
| 2 | R | R-type | <0.1% | 4.56 |
| 3 | Sv | S-complex | <0.1% | 5.12 |
| 4 | Sr | S-complex | <0.1% | 5.09 |
| 5 | B | C-complex | <0.1% | 4.60 |
| 6 | S | S-complex | <0.1% | 5.40 |
| 7 | Xn | X-complex | <0.1% | 5.34 |
| 8 | O | O-type | <0.1% | 6.00 |
| 9 | Xe | X-complex | <0.1% | 6.27 |
| 10 | Sq | S-complex | <0.1% | 6.57 |
| 11 | Cgh | C-complex | <0.1% | 6.37 |
| 12 | Q | Q-type | <0.1% | 6.79 |
| 13 | X | X-complex | <0.1% | 6.66 |
| 14 | L | L-type | <0.1% | 7.01 |
| 15 | D | D-type | <0.1% | 6.29 |
| 16 | Sa | S-complex | <0.1% | 6.98 |
| 17 | K | K-type | <0.1% | 7.28 |
| 18 | Xk | X-complex | <0.1% | 7.47 |
| 19 | T | T-type | <0.1% | 7.84 |
| 20 | Cg | C-complex | <0.1% | 7.56 |
| 21 | Ch | C-complex | <0.1% | 7.93 |
| 22 | Xc | X-complex | <0.1% | 8.22 |
| 23 | Cb | C-complex | <0.1% | 8.05 |
| 24 | C | C-complex | <0.1% | 8.74 |
| 25 | A | A-type | <0.1% | 9.44 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | V-type | 100.0% |
| 2 | R-type | <0.1% |
| 3 | S-complex | <0.1% |
| 4 | C-complex | <0.1% |
| 5 | X-complex | <0.1% |
| 6 | O-type | <0.1% |
| 7 | Q-type | <0.1% |
| 8 | L-type | <0.1% |
| 9 | D-type | <0.1% |
| 10 | K-type | <0.1% |
| 11 | T-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **V** — Confidence: High
  - best complex V-type vs runner-up R-type: delta score 35.6 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +30.4; favours S-complex)
- Spectral slope used: yes (systematic 0.043 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.450 au, e 0.076, i 5.1 deg)
- Albedo term: pV 0.306 ± 0.12 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2011ApJ...741...68M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| V-type | 100.0% | 100.0% |
| R-type | <0.1% | <0.1% |
| S-complex | <0.1% | <0.1% |
| C-complex | <0.1% | <0.1% |
| X-complex | <0.1% | <0.1% |
| O-type | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Best-fit chi2_red = 2.1: probabilities were computed with errors inflated by sqrt(2.1) to account for unexplained scatter.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.306, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2011ApJ...741...68M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | DETECTED | 0.927 ± 0.039 | 0.542 ± 0.038 | 0.113 | full_band, within_segment |
| Band II | DETECTED | 1.949 (uncertainty not provided) | 0.294 ± 0.079 | 0.094 | within_segment |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Orthopyroxene | Band I 0.927 um, Band II 1.949 um, BAR 2.29 | Low |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 12.440 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026L10
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: INSUFFICIENT_THERMAL
- Diameter (km): N/A
- Conditional range (no H): N/A
- Catalogue diameter (km): 7.816 ± 0.172 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2011ApJ...741...68M))
- Difference: N/A km (N/A sigma)
- Confidence: None
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 22.2 deg, x1.12 for 3.5-5 um: eta 1.02 at 100 km, 1.07 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 104 (5 normalisation group(s), 26 of 30 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 1.8 — Beaming parameter eta (posterior median, 68%): 1.18 (0.96-1.45)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 6.1.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 6.854 km (68%: 6.068-7.745; 95%: 5.401-8.704) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 6.854 km (68%: 6.068-7.745) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 8.392 km (68%: 7.256-9.743 km; 95%: 6.278-11.23 km) — Confidence: Medium
- Prior albedo of the same draws: 0.265 (68%: 0.197-0.355) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: 7.022 km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): V-type 100%

## Geometric Albedo

- Status: Not estimable from available data
- Geometric albedo pV (V band): N/A
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 12.440 (uncertainty not provided) — JPL SBDB
- D: N/A km — N/A
- Correlation: N/A
- Missing inputs: diameter (INSUFFICIENT_THERMAL)

## Mass and Density

- Mass (kg): N/A —  
- Status: Unknown (Mass unknown)
- Bulk density (kg/m^3): N/A
- Shape assumption: N/A — 

## Missing Data

- diameter
- geometric albedo
- mass

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"2566\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:48:24+00:00",
  "version": "orbit_id=63; soln_date=2026-06-05 06:39:00",
  "identifier": "20002566",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"2566\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:48:24+00:00",
  "version": "orbit_id=63; soln_date=2026-06-05 06:39:00",
  "identifier": "20002566",
  "origin": "OBSERVED"
 }
]
```
