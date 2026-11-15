# Analysis Report: 579

Generated 2026-11-15T02:46:47+00:00 - model version 0.1.0

## Identification

- Designation: 579 Sidonia (A905 VK)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 285
- Spectral points: 285
- Quality flags: {'WARN': 153, 'GOOD': 128, 'BAD': 4}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 20 (60 exposures, 15.42 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 25 bins / 63 points
- Brightness variability between visits: detected (p = 1.5e-11, visit-offset rms 0.05 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +5.02 | 0 |
| B2-B3 | +4.69 | 0 |
| B3-B4 | -9.71 | 0 |
| B4-B5 | +5.02 | 0 |
| B5-B6 | +4.69 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 15.42 d (phase angle 20.2-20.4 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 25 repeat bins (p = 1.5e-11); visit-offset rms 0.05 mag.
  - ⚠ Rotational lightcurve (P = 16.29 h) fitted to repeated observations only (peak-to-peak 1.64 mag, Delta-BIC 62); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 0.9498 ± 0.1337 (fitted)
- Sub-solar temperature T_ss (K): 232.1 ± 8.2
- Reduced chi^2: 2.76
- Thermal excess S/N: 9.8
- Internal 2-um reflectance parameter (not pV): 0.1379
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=18.8 deg -> eta0=1.06 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ Free eta reached its bound (0.50); D-eta degenerate for these data. Refitted with eta fixed at 1.06 and uncertainty -0.3/+0.55 propagated.
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 141 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 103.9 +- 68.6 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | K | K-type | 38.7% | 0.76 |
| 2 | L | L-type | 34.2% | 0.72 |
| 3 | Xc | X-complex | 5.3% | 0.73 |
| 4 | Xk | X-complex | 4.8% | 0.71 |
| 5 | T | T-type | 2.9% | 0.74 |
| 6 | Xe | X-complex | 2.9% | 0.71 |
| 7 | Xn | X-complex | 2.2% | 0.71 |
| 8 | X | X-complex | 2.2% | 0.72 |
| 9 | Ch | C-complex | 1.4% | 0.73 |
| 10 | Cb | C-complex | 1.1% | 0.73 |
| 11 | Cg | C-complex | 1.1% | 0.73 |
| 12 | C | C-complex | 0.8% | 0.77 |
| 13 | S | S-complex | 0.7% | 0.84 |
| 14 | Cgh | C-complex | 0.7% | 0.73 |
| 15 | D | D-type | 0.3% | 0.80 |
| 16 | Sq | S-complex | 0.3% | 0.95 |
| 17 | Sr | S-complex | 0.1% | 0.99 |
| 18 | Sv | S-complex | 0.1% | 1.02 |
| 19 | B | C-complex | 0.1% | 0.72 |
| 20 | Q | Q-type | <0.1% | 1.14 |
| 21 | Sa | S-complex | <0.1% | 1.24 |
| 22 | R | R-type | <0.1% | 1.57 |
| 23 | A | A-type | <0.1% | 1.90 |
| 24 | V | V-type | <0.1% | 1.97 |
| 25 | O | O-type | <0.1% | 2.62 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | K-type | 38.7% |
| 2 | L-type | 34.2% |
| 3 | X-complex | 17.4% |
| 4 | C-complex | 5.2% |
| 5 | T-type | 2.9% |
| 6 | S-complex | 1.2% |
| 7 | D-type | 0.3% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | A-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | O-type | <0.1% |

- Most probable: **K** — Confidence: Low
  - best complex K-type vs runner-up L-type: delta score 0.3 (scaled deviance incl. prior)
  - most probable complex changes when single visits are left out (4 of 20 samples: L-type)
- S-complex vs D-type: not distinguished (D minus S deviance +3.0; favours S-complex)
- Spectral slope used: yes (systematic 0.192 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.013 au, e 0.076, i 11.0 deg)
- Albedo term: pV 0.151 ± 0.12 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| K-type | 38.7% | 5.4% |
| L-type | 34.2% | 10.4% |
| X-complex | 17.4% | 35.3% |
| C-complex | 5.2% | 39.0% |
| T-type | 2.9% | 6.4% |
| S-complex | 1.2% | 2.4% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.151, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.
- The classification is not stable against leaving out single visits: 4 of 20 leave-one-visit-out samples give L-type instead of K-type.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.092 ± 0.073 | 0.109 ± 0.187 | 0.111 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.914 ± 0.765 | 0.101 ± 0.156 | 0.060 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 8.010 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026E47
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 87.99 ± 17.15
- Conditional range (no H): N/A
- Catalogue diameter (km): 85.57 ± 2.2 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: 2.422 km (0.1 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 73.18-107.5 / 61.89-132.8
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 18.9 deg, x1.12 for 3.5-5 um: eta 1.00 at 100 km, 1.05 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 141 (5 normalisation group(s), 33 of 37 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 47.8 — Beaming parameter eta (posterior median, 68%): 0.95 (0.82-1.09)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.8.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 90.81 km (68%: 78.38-106.1; 95%: 68.22-126.7) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 90.81 km (68%: 78.38-106.1) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 99.55 km (68%: 76.72-140.2 km; 95%: 57.21-195.2 km) — Confidence: Low
- Prior albedo of the same draws: 0.111 (68%: 0.056-0.188) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 27%, X-complex 24%, L-type 22%, K-type 22%, T-type 3%, S-complex 1%, D-type 1%
- Thermal vs statistical diameter: thermal 87.99 km / statistical 99.55 km = 0.88, z = -0.3 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.143 ± 0.056
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 8.010 (uncertainty not provided) — JPL SBDB E2026E47
- D: 87.99 ± 17.15 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
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
  "query": "{\"sstr\": \"579\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:45:23+00:00",
  "version": "orbit_id=89; soln_date=2026-06-05 03:47:12",
  "identifier": "20000579",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"579\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:45:23+00:00",
  "version": "orbit_id=89; soln_date=2026-06-05 03:47:12",
  "identifier": "20000579",
  "origin": "OBSERVED"
 }
]
```
