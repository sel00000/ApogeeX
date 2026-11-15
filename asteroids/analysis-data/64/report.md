# Analysis Report: 64

Generated 2026-11-15T02:51:44+00:00 - model version 0.1.0

## Identification

- Designation: 64 Angelina (A861 EA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 367
- Spectral points: 367
- Quality flags: {'WARN': 248, 'GOOD': 114, 'BAD': 5}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.1%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 18 (60 exposures, 163.20 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 28 bins / 72 points
- Brightness variability between visits: not detected (p = 0.96)
- Rotational lightcurve correction: not applied - no significant variability between visits within observing seasons
- Correction applied: season_offsets; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +6.52 | 0 |
| B2-B3 | +3.94 | 0 |
| B3-B4 | -10.46 | 0 |
| B4-B5 | +6.52 | 0 |
| B5-B6 | +3.94 | 0 |

  - ⚠ Spectrum assembled from 18 visits over 163.20 d (phase angle 17.9-19.6 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Observations span 2 observing seasons (gaps > 30 d): viewing geometry and aspect differ between them, so one brightness offset per season is fitted to the 6 repeat bins that link seasons (season 1: -0.03 +- 0.02 mag); variability is tested within seasons.
  - ⚠ Brightness consistent between visits on 28 repeat bins (p = 0.96): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.030 mag for the 4 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 14 visits not linked to it (11 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: INSUFFICIENT_THERMAL
- Beaming parameter eta: N/A (fixed)
- Sub-solar temperature T_ss (K): N/A
- Reduced chi^2: N/A
- Thermal excess S/N: -1.8
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal excess S/N = -1.8 < 3.0: no diameter is derived. Reflectance beyond ~3 um may include unmodelled thermal emission.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | L | L-type | 51.6% | 0.85 |
| 2 | Xc | X-complex | 19.8% | 0.90 |
| 3 | Xk | X-complex | 6.6% | 0.87 |
| 4 | Ch | C-complex | 4.5% | 0.89 |
| 5 | Xe | X-complex | 4.1% | 0.85 |
| 6 | K | K-type | 4.1% | 0.97 |
| 7 | S | S-complex | 2.7% | 0.96 |
| 8 | Xn | X-complex | 2.4% | 0.84 |
| 9 | Cgh | C-complex | 1.2% | 0.84 |
| 10 | Sq | S-complex | 0.8% | 1.12 |
| 11 | Cg | C-complex | 0.8% | 0.96 |
| 12 | Cb | C-complex | 0.4% | 1.00 |
| 13 | Sr | S-complex | 0.3% | 1.14 |
| 14 | C | C-complex | 0.2% | 1.12 |
| 15 | X | X-complex | 0.2% | 0.95 |
| 16 | Sv | S-complex | <0.1% | 1.29 |
| 17 | T | T-type | <0.1% | 0.93 |
| 18 | B | C-complex | <0.1% | 0.90 |
| 19 | Q | Q-type | <0.1% | 1.47 |
| 20 | D | D-type | <0.1% | 0.89 |
| 21 | R | R-type | <0.1% | 1.98 |
| 22 | Sa | S-complex | <0.1% | 1.71 |
| 23 | O | O-type | <0.1% | 2.52 |
| 24 | A | A-type | <0.1% | 2.31 |
| 25 | V | V-type | <0.1% | 2.62 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | L-type | 51.6% |
| 2 | X-complex | 33.2% |
| 3 | C-complex | 7.2% |
| 4 | K-type | 4.1% |
| 5 | S-complex | 4.0% |
| 6 | T-type | <0.1% |
| 7 | Q-type | <0.1% |
| 8 | D-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | O-type | <0.1% |
| 11 | A-type | <0.1% |
| 12 | V-type | <0.1% |

- Most probable: **L** — Confidence: Low
  - best complex L-type vs runner-up X-complex: delta score 0.9 (scaled deviance incl. prior)
  - most probable complex changes when single visits are left out (1 of 18 samples: X-complex)
- S-complex vs D-type: distinguished (D minus S deviance +14.8; favours S-complex)
- Spectral slope used: yes (systematic 0.040 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.680 au, e 0.127, i 1.3 deg)
- Albedo term: pV 0.424 ± 0.11 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| L-type | 51.6% | 20.0% |
| X-complex | 33.2% | 41.5% |
| C-complex | 7.2% | 32.9% |
| K-type | 4.1% | 3.0% |
| S-complex | 4.0% | 1.7% |
| T-type | <0.1% | 0.7% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.424, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.
- The classification is not stable against leaving out single visits: 1 of 18 leave-one-visit-out samples give X-complex instead of L-type.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.009 ± 0.352 | 0.044 ± 0.071 | 0.059 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.727 ± 0.056 | 0.086 ± 0.093 | 0.059 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.720 (uncertainty not provided)
- G: 0.48
- Source: JPL SBDB MPO964265
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: INSUFFICIENT_THERMAL
- Diameter (km): N/A
- Conditional range (no H): N/A
- Catalogue diameter (km): 58.29 ± 1.082 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: N/A km (N/A sigma)
- Confidence: None
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 19.5 deg, x1.12 for 3.5-5 um: eta 1.01 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 145 (4 normalisation group(s), 35 of 38 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 4.4 — Beaming parameter eta (posterior median, 68%): 1.03 (0.89-1.20)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 4.4.
  - ⚠ SPHEREx thermal likelihood (39.32 km) and the H + albedo prior (120.4 km) disagree (z = -3.4): combined diameter 68.79 km with the interval spanning both (35.28-171.9 km).

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 68.79 km (68%: 35.28-171.9; 95%: 32.36-245.1) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 68.79 km (68%: 35.28-171.9) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 120.4 km (68%: 90.98-171.9 km; 95%: 69.24-245.1 km) — Confidence: Low
- Prior albedo of the same draws: 0.100 (68%: 0.049-0.174) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: 47.2 km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): L-type 42%, X-complex 25%, C-complex 25%, K-type 6%, S-complex 1%, T-type 1%

## Geometric Albedo

- Status: Not estimable from available data
- Geometric albedo pV (V band): N/A
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.720 (uncertainty not provided) — JPL SBDB
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
  "query": "{\"sstr\": \"64\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:51:14+00:00",
  "version": "orbit_id=161; soln_date=2026-06-05 03:06:38",
  "identifier": "20000064",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"64\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:51:14+00:00",
  "version": "orbit_id=161; soln_date=2026-06-05 03:06:38",
  "identifier": "20000064",
  "origin": "OBSERVED"
 }
]
```
