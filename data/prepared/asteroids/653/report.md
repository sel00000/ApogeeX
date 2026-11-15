# Analysis Report: 653

Generated 2026-11-15T02:50:07+00:00 - model version 0.1.0

## Identification

- Designation: 653 Berenike (A907 WC)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 195
- Spectral points: 195
- Quality flags: {'WARN': 109, 'GOOD': 82, 'BAD': 4}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 10.8%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 18 (60 exposures, 11.41 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 18 bins / 43 points
- Brightness variability between visits: detected (p = 1.6e-20, visit-offset rms 0.12 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -2.99 | 0 |
| B2-B3 | -1.49 | 0 |
| B3-B4 | +4.48 | 0 |
| B4-B5 | -2.99 | 0 |
| B5-B6 | -1.49 | 0 |

  - ⚠ Spectrum assembled from 18 visits over 11.41 d (phase angle 16.9-18.6 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 18 repeat bins (p = 1.6e-20); visit-offset rms 0.12 mag.
  - ⚠ Rotational lightcurve (P = 12.4886 h) fitted to repeated observations only (peak-to-peak 0.37 mag, Delta-BIC 114); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 0.9629 ± 0.1414 (fitted)
- Sub-solar temperature T_ss (K): 234.9 ± 8.6
- Reduced chi^2: 3.68
- Thermal excess S/N: 7.7
- Internal 2-um reflectance parameter (not pV): 0.1956
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=18.0 deg -> eta0=1.05 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ Data errors rescaled by 1.3x (unexplained scatter) before weighing against the eta prior.
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 106 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 41.6 +- 16.8 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | K | K-type | 81.9% | 1.15 |
| 2 | L | L-type | 11.8% | 1.23 |
| 3 | Xe | X-complex | 1.0% | 1.18 |
| 4 | S | S-complex | 1.0% | 1.17 |
| 5 | Xn | X-complex | 0.7% | 1.14 |
| 6 | Cg | C-complex | 0.7% | 1.25 |
| 7 | Ch | C-complex | 0.6% | 1.35 |
| 8 | Xc | X-complex | 0.5% | 1.45 |
| 9 | Cgh | C-complex | 0.5% | 1.19 |
| 10 | Xk | X-complex | 0.5% | 1.35 |
| 11 | Sq | S-complex | 0.4% | 1.31 |
| 12 | Cb | C-complex | 0.2% | 1.35 |
| 13 | Q | Q-type | <0.1% | 1.40 |
| 14 | C | C-complex | <0.1% | 1.51 |
| 15 | B | C-complex | <0.1% | 1.06 |
| 16 | Sr | S-complex | <0.1% | 1.46 |
| 17 | X | X-complex | <0.1% | 1.37 |
| 18 | T | T-type | <0.1% | 1.59 |
| 19 | D | D-type | <0.1% | 1.57 |
| 20 | R | R-type | <0.1% | 2.20 |
| 21 | Sv | S-complex | <0.1% | 2.39 |
| 22 | Sa | S-complex | <0.1% | 2.11 |
| 23 | O | O-type | <0.1% | 3.07 |
| 24 | V | V-type | <0.1% | 3.05 |
| 25 | A | A-type | <0.1% | 4.68 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | K-type | 81.9% |
| 2 | L-type | 11.8% |
| 3 | X-complex | 2.7% |
| 4 | C-complex | 2.0% |
| 5 | S-complex | 1.4% |
| 6 | Q-type | <0.1% |
| 7 | T-type | <0.1% |
| 8 | D-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | O-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **K** — Confidence: Low
  - best complex K-type vs runner-up L-type: delta score 3.9 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +14.6; favours S-complex)
- Spectral slope used: yes (systematic 0.021 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.014 au, e 0.045, i 11.3 deg)
- Albedo term: pV 0.130 ± 0.21 dex (catalogue diameter with current H; catalogue albedo 0.085 disagrees by +0.18 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| K-type | 81.9% | 30.9% |
| L-type | 11.8% | 15.3% |
| X-complex | 2.7% | 15.9% |
| C-complex | 2.0% | 26.5% |
| S-complex | 1.4% | 10.8% |
| Q-type | <0.1% | 0.6% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.130, catalogue diameter with current H; catalogue albedo 0.085 disagrees by +0.18 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.158 ± 0.214 | 0.214 ± 0.023 | 0.069 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.827 ± 0.019 | 0.384 ± 0.062 | 0.113 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | 0.019 ± 0.019 | 0.058 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | 0.038 ± 0.025 | 0.075 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | -0.024 ± 0.040 | 0.119 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Metal-rich materials (possible) | Featureless, red slope, moderate pV; radar or 3-um data needed to confirm | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 9.350 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026L10
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 45.48 ± 9.111
- Conditional range (no H): N/A
- Catalogue diameter (km): 49.79 ± 0.416 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: -4.315 km (-0.5 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 37.64-55.87 / 31.81-69.16
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 18.1 deg, x1.12 for 3.5-5 um: eta 1.00 at 100 km, 1.05 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 106 (7 normalisation group(s), 23 of 30 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 21.9 — Beaming parameter eta (posterior median, 68%): 0.96 (0.83-1.12)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 3.7.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 47.73 km (68%: 41.97-54.39; 95%: 36.98-62.14) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 47.73 km (68%: 41.97-54.39) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 49.96 km (68%: 41.94-60.42 km; 95%: 34.58-82.89 km) — Confidence: Low
- Prior albedo of the same draws: 0.129 (68%: 0.088-0.183) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): K-type 74%, L-type 12%, C-complex 7%, X-complex 5%, S-complex 2%
- Thermal vs statistical diameter: thermal 45.48 km / statistical 49.96 km = 0.91, z = -0.3 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.155 ± 0.062
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 9.350 (uncertainty not provided) — JPL SBDB E2026L10
- D: 45.48 ± 9.111 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 3.7). Albedo on hold.

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
  "query": "{\"sstr\": \"653\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:49:34+00:00",
  "version": "orbit_id=81; soln_date=2026-06-05 03:53:00",
  "identifier": "20000653",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"653\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:49:34+00:00",
  "version": "orbit_id=81; soln_date=2026-06-05 03:53:00",
  "identifier": "20000653",
  "origin": "OBSERVED"
 }
]
```
