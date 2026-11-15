# Analysis Report: 10

Generated 2026-11-15T03:14:17+00:00 - model version 0.1.0

## Identification

- Designation: 10 Hygiea (A849 GA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 263
- Spectral points: 263
- Quality flags: {'WARN': 256, 'BAD': 5, 'GOOD': 2}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.6%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 21 (58 exposures, 11.08 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 22 bins / 54 points
- Brightness variability between visits: not detected (p = 0.83)
- Rotational lightcurve correction: not applied - no significant variability between visits
- Correction applied: none; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +4.62 | 0 |
| B2-B3 | +3.26 | 0 |
| B3-B4 | -7.88 | 0 |
| B4-B5 | +4.62 | 0 |
| B5-B6 | +3.26 | 0 |

  - ⚠ Spectrum assembled from 21 visits over 11.08 d (phase angle 16.8-16.9 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness consistent between visits on 22 repeat bins (p = 0.83): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.039 mag for the 9 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 12 visits not linked to it (6 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.004 ± 0.1434 (fitted)
- Sub-solar temperature T_ss (K): 215.5 ± 7.7
- Reduced chi^2: 5.05
- Thermal excess S/N: N/A
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ No data at lambda >= 3.5 um; thermal emission cannot be constrained.
  - ⚠ Thermal emission detected by the likelihood of all points (24.9 sigma, 57% of the 4.4-5 um flux), although the single-group excess test gave no test.
  - ⚠ Diameter from the posterior of all 141 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | C | C-complex | 26.8% | 0.64 |
| 2 | Cb | C-complex | 18.2% | 0.61 |
| 3 | Cg | C-complex | 16.9% | 0.60 |
| 4 | Ch | C-complex | 12.9% | 0.69 |
| 5 | Xc | X-complex | 10.6% | 0.66 |
| 6 | Cgh | C-complex | 4.1% | 0.63 |
| 7 | Xe | X-complex | 3.1% | 0.56 |
| 8 | Xk | X-complex | 1.9% | 0.70 |
| 9 | Xn | X-complex | 1.9% | 0.53 |
| 10 | T | T-type | 1.3% | 0.77 |
| 11 | L | L-type | 0.9% | 0.78 |
| 12 | X | X-complex | 0.6% | 0.62 |
| 13 | K | K-type | 0.6% | 0.76 |
| 14 | B | C-complex | 0.3% | 0.51 |
| 15 | D | D-type | <0.1% | 0.92 |
| 16 | S | S-complex | <0.1% | 0.96 |
| 17 | Sr | S-complex | <0.1% | 1.32 |
| 18 | Q | Q-type | <0.1% | 1.50 |
| 19 | Sq | S-complex | <0.1% | 1.42 |
| 20 | Sv | S-complex | <0.1% | 1.77 |
| 21 | Sa | S-complex | <0.1% | 1.61 |
| 22 | R | R-type | <0.1% | 2.12 |
| 23 | V | V-type | <0.1% | 2.26 |
| 24 | O | O-type | <0.1% | 3.72 |
| 25 | A | A-type | <0.1% | 5.38 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | C-complex | 79.1% |
| 2 | X-complex | 18.1% |
| 3 | T-type | 1.3% |
| 4 | L-type | 0.9% |
| 5 | K-type | 0.6% |
| 6 | D-type | <0.1% |
| 7 | S-complex | <0.1% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | V-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **C-complex (subclass not determined: C 27%, Cb 18%)** — Confidence: Low
  - best complex C-complex vs runner-up X-complex: delta score 3.0 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance -7.2; favours D-type)
- Spectral slope used: yes (systematic 0.053 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.151 au, e 0.107, i 3.8 deg)
- Albedo term: pV 0.059 ± 0.13 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| C-complex | 79.1% | 60.4% |
| X-complex | 18.1% | 36.3% |
| T-type | 1.3% | 0.6% |
| L-type | 0.9% | 1.3% |
| K-type | 0.6% | 1.3% |
| D-type | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.059, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.914 ± 0.216 | 0.166 ± 0.064 | 0.120 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.733 ± 0.000 | 0.098 ± 0.088 | 0.032 | not detected; a typical band-bearing asteroid would be detectable here |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 5.650 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026E39
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 357.3 ± 81.37
- Conditional range (no H): N/A
- Catalogue diameter (km): 407.1 ± 6.8 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: -49.84 km (-0.6 sigma)
- Confidence: Low
- Diameter, 68% / 95% interval (km): 287.9-450.6 / 237.2-572.1
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 16.8 deg, x1.12 for 3.5-5 um: eta 0.99 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 141 (5 normalisation group(s), 40 of 41 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 24.9 — Beaming parameter eta (posterior median, 68%): 1.01 (0.87-1.16)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 5.0.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 377 km (68%: 313.2-454.7; 95%: 263.4-546.2) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 377 km (68%: 313.2-454.7) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 413.9 km (68%: 299.2-562.6 km; 95%: 211.7-754 km) — Confidence: Low
- Prior albedo of the same draws: 0.057 (68%: 0.031-0.108) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 66%, X-complex 28%, L-type 3%, K-type 2%, T-type 1%
- Thermal vs statistical diameter: thermal 357.3 km / statistical 413.9 km = 0.86, z = -0.4 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.076 ± 0.035
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 5.650 (uncertainty not provided) — JPL SBDB E2026E39
- D: 357.3 ± 81.37 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H and D treated as independent (no joint sensitivity available).
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 5.0). Albedo on hold.

## Mass and Density

- Mass (kg): 1.049e+20 (uncertainty not provided) — D: database GM (JPL SBDB) Scholl et al., A&A, v.179, p.311, 1987
- Status: ON_HOLD_VALIDATION (mass uncertainty not provided; based on a Low-confidence SPHEREx diameter; relative uncertainty 0.68 > 0.5)
- Bulk density (kg/m^3): 4392 ± 3001
- Shape assumption: spherical_assumption — V = 4/3 pi (D/2)^3

## Missing Data

- none

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"10\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T03:13:20+00:00",
  "version": "orbit_id=129; soln_date=2026-06-16 11:32:04",
  "identifier": "20000010",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"10\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T03:13:20+00:00",
  "version": "orbit_id=129; soln_date=2026-06-16 11:32:04",
  "identifier": "20000010",
  "origin": "OBSERVED"
 }
]
```
