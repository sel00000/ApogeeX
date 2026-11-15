# Analysis Report: 35107

Generated 2026-11-15T02:45:53+00:00 - model version 0.1.0

## Identification

- Designation: 35107 (1991 VH)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 672
- Spectral points: 672
- Quality flags: {'WARN': 621, 'GOOD': 28, 'BAD': 23}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.9%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 24 (59 exposures, 57.61 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 26 bins / 68 points
- Brightness variability between visits: detected (p = 3.5e-81, visit-offset rms 0.32 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -4.89 | 0 |
| B2-B3 | -35.80 | 0 |
| B3-B4 | +40.62 | 0 |
| B4-B5 | -4.82 | 0 |
| B5-B6 | -15.12 | 0 |

  - ⚠ Spectrum assembled from 24 visits over 57.61 d (phase angle 59.0-92.5 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 26 repeat bins (p = 3.5e-81); visit-offset rms 0.32 mag.
  - ⚠ Rotational lightcurve (P = 2.6236 h) fitted to repeated observations only (peak-to-peak 1.88 mag, Delta-BIC 282); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.764 ± 0.4087 (fitted)
- Sub-solar temperature T_ss (K): 334.0 ± 19.3
- Reduced chi^2: 2.49
- Thermal excess S/N: 16.8
- Internal 2-um reflectance parameter (not pV): 0.3218
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=60.0 deg -> eta0=1.47 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 318 fit points (eta prior trilling2016); the single-group least-squares fit gave D = 1.2 +- 0.3 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | V | V-type | 49.7% | 1.90 |
| 2 | Q | Q-type | 11.6% | 2.11 |
| 3 | R | R-type | 11.6% | 2.00 |
| 4 | O | O-type | 7.1% | 2.02 |
| 5 | Sv | S-complex | 4.2% | 2.08 |
| 6 | Sr | S-complex | 3.9% | 2.09 |
| 7 | S | S-complex | 3.1% | 2.12 |
| 8 | Sq | S-complex | 3.0% | 2.13 |
| 9 | A | A-type | 2.4% | 2.31 |
| 10 | Sa | S-complex | 1.5% | 2.24 |
| 11 | L | L-type | 0.8% | 2.27 |
| 12 | K | K-type | 0.2% | 2.25 |
| 13 | X | X-complex | 0.2% | 2.25 |
| 14 | Xk | X-complex | 0.2% | 2.25 |
| 15 | Xn | X-complex | 0.2% | 2.26 |
| 16 | Xe | X-complex | 0.1% | 2.28 |
| 17 | Xc | X-complex | 0.1% | 2.29 |
| 18 | T | T-type | <0.1% | 2.26 |
| 19 | Cgh | C-complex | <0.1% | 2.26 |
| 20 | Cg | C-complex | <0.1% | 2.27 |
| 21 | Cb | C-complex | <0.1% | 2.28 |
| 22 | Ch | C-complex | <0.1% | 2.28 |
| 23 | C | C-complex | <0.1% | 2.29 |
| 24 | B | C-complex | <0.1% | 2.34 |
| 25 | D | D-type | <0.1% | 2.22 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | V-type | 49.7% |
| 2 | S-complex | 15.7% |
| 3 | Q-type | 11.6% |
| 4 | R-type | 11.6% |
| 5 | O-type | 7.1% |
| 6 | A-type | 2.4% |
| 7 | X-complex | 0.9% |
| 8 | L-type | 0.8% |
| 9 | K-type | 0.2% |
| 10 | C-complex | <0.1% |
| 11 | T-type | <0.1% |
| 12 | D-type | <0.1% |

- Most probable: **V** — Confidence: Low
  - best complex V-type vs runner-up S-complex: delta score 2.3 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +16.3; favours S-complex)
- Spectral slope used: yes (systematic 0.163 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 1.137 au, e 0.144, i 13.9 deg)
- Albedo term: pV 0.369 ± 0.11 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[neos] (http://adsabs.harvard.edu/abs/2016AJ....152...63N)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| V-type | 49.7% | 16.9% |
| S-complex | 15.7% | 27.4% |
| Q-type | 11.6% | 6.0% |
| R-type | 11.6% | 12.1% |
| O-type | 7.1% | 10.3% |
| A-type | 2.4% | 1.5% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Best-fit chi2_red = 1.9: probabilities were computed with errors inflated by sqrt(1.9) to account for unexplained scatter.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.369, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[neos] (http://adsabs.harvard.edu/abs/2016AJ....152...63N))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | DETECTED | 0.984 (uncertainty not provided) | 0.470 ± 0.118 | 0.275 | within_segment |
| Band II | NOT_DETECTED | 1.747 ± 0.049 | 0.717 ± 0.049 | 0.146 | not detected; data not sensitive enough to detect a typical band |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | 91.383 ± -5.176 | -15.529 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | -10.549 ± 3.045 | 9.134 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | -1.524 ± 0.677 | 2.032 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Mafic silicates (olivine and/or pyroxene) | Band I (within_segment) | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 16.860 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026L10
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 1.098 ± 0.2545
- Conditional range (no H): N/A
- Catalogue diameter (km): 0.929 ± 0.035 (urn:nasa:pds:neowise_diameters_albedos::2.0[neos] (http://adsabs.harvard.edu/abs/2016AJ....152...63N))
- Difference: 0.1689 km (0.7 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 0.8876-1.397 / 0.7365-1.759
- Beaming-parameter prior: trilling2016: eta0 1.59 (-0.3/+0.55) at alpha 72.1 deg (neo)
- Points in the thermal likelihood: 318 (3 normalisation group(s), 91 of 93 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 11.9 — Beaming parameter eta (posterior median, 68%): 1.76 (1.39-2.21)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.5.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 1.138 km (68%: 0.984-1.332; 95%: 0.8601-1.584) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 1.138 km (68%: 0.984-1.332) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 1.198 km (68%: 0.9826-1.539 km; 95%: 0.8002-2.168 km) — Confidence: Low
- Prior albedo of the same draws: 0.222 (68%: 0.134-0.330) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): V-type 31%, S-complex 18%, O-type 15%, Q-type 14%, R-type 6%, X-complex 4%, A-type 3%, L-type 3%, T-type 2%, C-complex 2%, K-type 2%, D-type 1%
- Thermal vs statistical diameter: thermal 1.098 km / statistical 1.198 km = 0.92, z = -0.3 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.264 ± 0.122
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 16.860 (uncertainty not provided) — JPL SBDB E2026L10
- D: 1.098 ± 0.2545 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"35107\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:42:18+00:00",
  "version": "orbit_id=788; soln_date=2026-08-31 06:24:41",
  "identifier": "20035107",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"35107\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:42:18+00:00",
  "version": "orbit_id=788; soln_date=2026-08-31 06:24:41",
  "identifier": "20035107",
  "origin": "OBSERVED"
 }
]
```
