# Analysis Report: 624

Generated 2026-11-15T02:41:29+00:00 - model version 0.1.0

## Identification

- Designation: 624 Hektor (A907 CF)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 273
- Spectral points: 273
- Quality flags: {'WARN': 136, 'GOOD': 131, 'BAD': 6}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 9.2%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 21 (60 exposures, 247.28 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 34 bins / 78 points
- Brightness variability between visits: not detected (p = 0.0022)
- Rotational lightcurve correction: not applied - no significant variability between visits within observing seasons
- Correction applied: season_offsets; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +3.80 | 0 |
| B2-B3 | +2.31 | 0 |
| B3-B4 | -6.10 | 0 |
| B4-B5 | +3.80 | 0 |
| B5-B6 | +2.31 | 0 |

  - ⚠ Spectrum assembled from 21 visits over 247.28 d (phase angle 10.6-11.3 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Observations span 2 observing seasons (gaps > 30 d): viewing geometry and aspect differ between them, so one brightness offset per season is fitted to the 29 repeat bins that link seasons (season 0: -0.04 +- 0.01 mag); variability is tested within seasons.
  - ⚠ Brightness consistent between visits on 34 repeat bins (p = 0.0022): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.064 mag for the 4 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 17 visits not linked to it (14 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: INSUFFICIENT_THERMAL
- Beaming parameter eta: N/A (fixed)
- Sub-solar temperature T_ss (K): N/A
- Reduced chi^2: N/A
- Thermal excess S/N: -0.7
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal excess S/N = -0.7 < 3.0: no diameter is derived. Reflectance beyond ~3 um may include unmodelled thermal emission.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | D | D-type | 74.2% | 0.50 |
| 2 | T | T-type | 15.5% | 0.59 |
| 3 | Xk | X-complex | 3.2% | 0.62 |
| 4 | X | X-complex | 3.1% | 0.61 |
| 5 | Cgh | C-complex | 0.9% | 0.60 |
| 6 | L | L-type | 0.6% | 0.58 |
| 7 | Ch | C-complex | 0.6% | 0.67 |
| 8 | Xc | X-complex | 0.5% | 0.68 |
| 9 | Cg | C-complex | 0.5% | 0.79 |
| 10 | Cb | C-complex | 0.4% | 0.82 |
| 11 | Xe | X-complex | 0.2% | 0.63 |
| 12 | Xn | X-complex | <0.1% | 0.64 |
| 13 | C | C-complex | <0.1% | 1.01 |
| 14 | S | S-complex | <0.1% | 0.69 |
| 15 | K | K-type | <0.1% | 0.84 |
| 16 | Sv | S-complex | <0.1% | 0.92 |
| 17 | Sr | S-complex | <0.1% | 0.85 |
| 18 | Sq | S-complex | <0.1% | 1.14 |
| 19 | B | C-complex | <0.1% | 0.88 |
| 20 | Q | Q-type | <0.1% | 1.59 |
| 21 | R | R-type | <0.1% | 1.68 |
| 22 | Sa | S-complex | <0.1% | 1.80 |
| 23 | V | V-type | <0.1% | 2.46 |
| 24 | O | O-type | <0.1% | 3.44 |
| 25 | A | A-type | <0.1% | 4.46 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | D-type | 74.2% |
| 2 | T-type | 15.5% |
| 3 | X-complex | 7.1% |
| 4 | C-complex | 2.6% |
| 5 | L-type | 0.6% |
| 6 | S-complex | <0.1% |
| 7 | K-type | <0.1% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | V-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **D** — Confidence: Low
  - best complex D-type vs runner-up T-type: delta score 3.1 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance -13.9; favours D-type)
- Spectral slope used: yes (systematic 0.087 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 5.277 au, e 0.024, i 18.1 deg)
- Albedo term: pV 0.041 ± 0.24 dex (catalogue diameter with current H; catalogue albedo 0.025 disagrees by +0.22 dex beyond the population offset (H revision?): uncertainty increased (J.G. Williams 9-90))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| D-type | 74.2% | 41.9% |
| T-type | 15.5% | 24.9% |
| X-complex | 7.1% | 18.7% |
| C-complex | 2.6% | 4.0% |
| L-type | 0.6% | 1.7% |
| S-complex | <0.1% | 8.7% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.041, catalogue diameter with current H; catalogue albedo 0.025 disagrees by +0.22 dex beyond the population offset (H revision?): uncertainty increased (J.G. Williams 9-90)). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.863 ± 0.151 | 0.177 ± 0.067 | 0.045 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.992 ± 0.813 | 0.012 ± 0.100 | 0.300 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.320 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026E71
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: INSUFFICIENT_THERMAL
- Diameter (km): N/A
- Conditional range (no H): N/A
- Catalogue diameter (km): 225 (uncertainty not provided) (J.G. Williams 9-90)
- Difference: N/A km (N/A sigma)
- Confidence: None
- Beaming-parameter prior: NEOWISE jupiter_trojans population at alpha 11.0 deg, x1.13 for 3.5-5 um: eta 0.87 at 100 km, 1.00 at 10 km (sigma ln eta 0.14-0.19)
- Points in the thermal likelihood: 142 (6 normalisation group(s), 37 of 43 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 4.2 — Beaming parameter eta (posterior median, 68%): 0.89 (0.77-1.01)

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 155.3 km (68%: 125.6-190.7; 95%: 101.7-232.3) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 155.3 km (68%: 125.6-190.7) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 187.1 km (68%: 140.5-246.6 km; 95%: 101.5-319.1 km) — Confidence: Low
- Prior albedo of the same draws: 0.060 (68%: 0.034-0.106) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: 227.6 km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): D-type 64%, T-type 21%, X-complex 9%, L-type 2%, C-complex 2%, S-complex 2%

## Geometric Albedo

- Status: Not estimable from available data
- Geometric albedo pV (V band): N/A
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.320 (uncertainty not provided) — JPL SBDB
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
  "query": "{\"sstr\": \"624\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:21+00:00",
  "version": "orbit_id=139; soln_date=2026-06-05 03:50:35",
  "identifier": "20000624",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"624\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:21+00:00",
  "version": "orbit_id=139; soln_date=2026-06-05 03:50:35",
  "identifier": "20000624",
  "origin": "OBSERVED"
 }
]
```
