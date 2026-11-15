# Analysis Report: A913 SF

Generated 2026-11-15T02:39:54+00:00 - model version 0.1.0

## Identification

- Designation: 764 Gedania (A913 SF)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 315
- Spectral points: 315
- Quality flags: {'WARN': 269, 'GOOD': 38, 'BAD': 8}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 12.2%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 24 (60 exposures, 14.95 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 25 bins / 64 points
- Brightness variability between visits: not detected (p = 0.36)
- Rotational lightcurve correction: not applied - no significant variability between visits
- Correction applied: none; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -2.44 | 0 |
| B2-B3 | -7.95 | 0 |
| B3-B4 | +9.65 | 0 |
| B4-B5 | -1.70 | 0 |
| B5-B6 | -7.47 | 0 |

  - ⚠ Spectrum assembled from 24 visits over 14.95 d (phase angle 14.6-16.3 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness consistent between visits on 25 repeat bins (p = 0.36): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.177 mag for the 7 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 17 visits not linked to it (14 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.056 ± 0.1405 (fitted)
- Sub-solar temperature T_ss (K): 213.4 ± 7.1
- Reduced chi^2: 1.07
- Thermal excess S/N: 2.6
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ Thermal emission detected by the likelihood of all points (36.3 sigma, 76% of the 4.4-5 um flux), although the single-group excess test gave S/N 2.6.
  - ⚠ Diameter from the posterior of all 143 fit points (eta prior neowise_population).

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | T | T-type | 18.1% | 3.79 |
| 2 | K | K-type | 13.2% | 3.76 |
| 3 | L | L-type | 7.7% | 3.77 |
| 4 | Xc | X-complex | 6.4% | 3.75 |
| 5 | D | D-type | 6.2% | 3.81 |
| 6 | Ch | C-complex | 5.9% | 3.76 |
| 7 | Xe | X-complex | 5.5% | 3.73 |
| 8 | Cg | C-complex | 5.5% | 3.76 |
| 9 | Xk | X-complex | 5.4% | 3.77 |
| 10 | C | C-complex | 5.3% | 3.78 |
| 11 | Cgh | C-complex | 5.2% | 3.74 |
| 12 | Cb | C-complex | 5.0% | 3.78 |
| 13 | Xn | X-complex | 4.2% | 3.77 |
| 14 | X | X-complex | 3.7% | 3.79 |
| 15 | B | C-complex | 2.0% | 3.82 |
| 16 | Q | Q-type | 0.3% | 4.03 |
| 17 | O | O-type | <0.1% | 4.72 |
| 18 | S | S-complex | <0.1% | 3.87 |
| 19 | Sq | S-complex | <0.1% | 3.91 |
| 20 | Sr | S-complex | <0.1% | 4.00 |
| 21 | Sv | S-complex | <0.1% | 4.10 |
| 22 | Sa | S-complex | <0.1% | 4.04 |
| 23 | A | A-type | <0.1% | 4.34 |
| 24 | V | V-type | <0.1% | 4.96 |
| 25 | R | R-type | <0.1% | 4.35 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | C-complex | 28.9% |
| 2 | X-complex | 25.3% |
| 3 | T-type | 18.1% |
| 4 | K-type | 13.2% |
| 5 | L-type | 7.7% |
| 6 | D-type | 6.2% |
| 7 | Q-type | 0.3% |
| 8 | S-complex | 0.2% |
| 9 | O-type | <0.1% |
| 10 | A-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | R-type | <0.1% |

- Most probable: **C-complex (subclass not determined: Ch 6%, Cg 5%)** — Confidence: Low
  - best complex C-complex vs runner-up X-complex: delta score 0.3 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance -6.7; favours D-type)
- Spectral slope used: yes (systematic 0.047 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.196 au, e 0.092, i 10.0 deg)
- Albedo term: pV 0.070 ± 0.10 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139024 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| C-complex | 28.9% | 34.0% |
| X-complex | 25.3% | 28.6% |
| T-type | 18.1% | 4.7% |
| K-type | 13.2% | 6.5% |
| L-type | 7.7% | 6.2% |
| D-type | 6.2% | 3.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Best-fit chi2_red = 3.8: probabilities were computed with errors inflated by sqrt(3.8) to account for unexplained scatter.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.070, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.132 ± 0.031 | 0.124 ± 0.112 | 0.240 | not detected; data not sensitive enough to detect a typical band |
| Band II | NOT_DETECTED | 1.999 ± 0.089 | 0.109 ± 0.420 | 0.230 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 9.670 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB MPO964278
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 77.63 ± 17.78
- Conditional range (no H): N/A
- Catalogue diameter (km): 58.28 ± 1.4 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: 19.35 km (1.1 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 62.16-97.73 / 50.51-123.1
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 16.3 deg, x1.13 for 3.5-5 um: eta 0.99 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 143 (6 normalisation group(s), 43 of 48 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 36.3 — Beaming parameter eta (posterior median, 68%): 1.05 (0.92-1.20)

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 70.05 km (68%: 57.57-84.74; 95%: 48-101.9) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 70.05 km (68%: 57.57-84.74) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 53.11 km (68%: 39.46-76.92 km; 95%: 29.48-107.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.085 (68%: 0.040-0.154) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): X-complex 28%, C-complex 22%, K-type 18%, L-type 12%, T-type 10%, D-type 4%, S-complex 4%, Q-type 1%
- Thermal vs statistical diameter: thermal 77.63 km / statistical 53.11 km = 1.46, z = +0.9 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.040 ± 0.018
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 9.670 (uncertainty not provided) — JPL SBDB MPO964278
- D: 77.63 ± 17.78 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"A913 SF\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:38:26+00:00",
  "version": "orbit_id=74; soln_date=2026-06-05 04:01:50",
  "identifier": "20000764",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"A913 SF\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:38:26+00:00",
  "version": "orbit_id=74; soln_date=2026-06-05 04:01:50",
  "identifier": "20000764",
  "origin": "OBSERVED"
 }
]
```
