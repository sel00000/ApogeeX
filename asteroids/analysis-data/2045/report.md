# Analysis Report: 2045

Generated 2026-11-15T02:44:22+00:00 - model version 0.1.0

## Identification

- Designation: 2045 Peking (1964 TB1)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 227
- Spectral points: 227
- Quality flags: {'GOOD': 118, 'WARN': 105, 'BAD': 4}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 25 (61 exposures, 361.12 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 25 bins / 58 points
- Brightness variability between visits: detected (p = 4.2e-95, visit-offset rms 0.48 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -4.28 | 0 |
| B2-B3 | -1.77 | 0 |
| B3-B4 | +6.05 | 0 |
| B4-B5 | -4.28 | 0 |
| B5-B6 | -1.77 | 0 |

  - ⚠ Spectrum assembled from 25 visits over 361.12 d (phase angle 21.8-26.6 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Observations span 2 observing seasons (gaps > 30 d): viewing geometry and aspect differ between them, so one brightness offset per season is fitted to the 1 repeat bins that link seasons (season 1: +0.95 +- 1.14 mag); variability is tested within seasons.
  - ⚠ Brightness varies between visits within observing seasons: constant-brightness model rejected on 25 repeat bins (p = 4.2e-95); visit-offset rms 0.48 mag.
  - ⚠ Rotational lightcurve (P = 158.7 h) fitted to repeated observations only (peak-to-peak 1.12 mag, Delta-BIC 467); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.067 ± 0.1817 (fitted)
- Sub-solar temperature T_ss (K): 252.2 ± 10.7
- Reduced chi^2: 1.63
- Thermal excess S/N: 4.2
- Internal 2-um reflectance parameter (not pV): 0.1965
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=25.1 deg -> eta0=1.12 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 115 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 12.5 +- 7.4 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | V | V-type | 100.0% | 0.69 |
| 2 | R | R-type | <0.1% | 1.93 |
| 3 | Sv | S-complex | <0.1% | 2.46 |
| 4 | Sr | S-complex | <0.1% | 2.48 |
| 5 | S | S-complex | <0.1% | 2.75 |
| 6 | O | O-type | <0.1% | 3.06 |
| 7 | Sq | S-complex | <0.1% | 3.24 |
| 8 | Q | Q-type | <0.1% | 3.24 |
| 9 | Xn | X-complex | <0.1% | 2.99 |
| 10 | B | C-complex | <0.1% | 2.67 |
| 11 | Xe | X-complex | <0.1% | 3.51 |
| 12 | X | X-complex | <0.1% | 3.64 |
| 13 | L | L-type | <0.1% | 3.72 |
| 14 | K | K-type | <0.1% | 3.69 |
| 15 | Xk | X-complex | <0.1% | 3.81 |
| 16 | Cgh | C-complex | <0.1% | 3.56 |
| 17 | Sa | S-complex | <0.1% | 3.95 |
| 18 | D | D-type | <0.1% | 3.71 |
| 19 | T | T-type | <0.1% | 4.09 |
| 20 | Cg | C-complex | <0.1% | 3.84 |
| 21 | Cb | C-complex | <0.1% | 4.01 |
| 22 | Xc | X-complex | <0.1% | 4.14 |
| 23 | Ch | C-complex | <0.1% | 4.02 |
| 24 | C | C-complex | <0.1% | 4.20 |
| 25 | A | A-type | <0.1% | 5.74 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | V-type | 100.0% |
| 2 | R-type | <0.1% |
| 3 | S-complex | <0.1% |
| 4 | O-type | <0.1% |
| 5 | X-complex | <0.1% |
| 6 | Q-type | <0.1% |
| 7 | C-complex | <0.1% |
| 8 | L-type | <0.1% |
| 9 | K-type | <0.1% |
| 10 | D-type | <0.1% |
| 11 | T-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **V** — Confidence: High
  - best complex V-type vs runner-up R-type: delta score 28.0 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +43.9; favours S-complex)
- Spectral slope used: yes (systematic 0.067 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.380 au, e 0.055, i 6.9 deg)
- Albedo term: pV 0.261 ± 0.10 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| V-type | 100.0% | 100.0% |
| R-type | <0.1% | <0.1% |
| S-complex | <0.1% | <0.1% |
| O-type | <0.1% | <0.1% |
| X-complex | <0.1% | <0.1% |
| Q-type | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.261, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | DETECTED | 0.919 (uncertainty not provided) | 0.335 ± 0.038 | 0.113 | within_segment |
| Band II | DETECTED | 1.922 (uncertainty not provided) | 0.280 ± 0.063 | 0.188 | within_segment |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Orthopyroxene | Band I 0.919 um, Band II 1.922 um, BAR 1.84 | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 12.150 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2025R13
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 10.52 ± 2.139
- Conditional range (no H): N/A
- Catalogue diameter (km): 9.664 ± 0.098 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: 0.8559 km (0.4 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 8.638-12.92 / 7.223-15.85
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 25.1 deg, x1.12 for 3.5-5 um: eta 1.04 at 100 km, 1.09 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 115 (7 normalisation group(s), 26 of 33 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 20.5 — Beaming parameter eta (posterior median, 68%): 1.07 (0.90-1.26)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 1.6.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 9.677 km (68%: 8.61-10.89; 95%: 7.696-12.22) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 9.677 km (68%: 8.61-10.89) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 9.282 km (68%: 8.025-10.78 km; 95%: 6.944-12.42 km) — Confidence: Medium
- Prior albedo of the same draws: 0.283 (68%: 0.210-0.379) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): V-type 100%
- Thermal vs statistical diameter: thermal 10.52 km / statistical 9.282 km = 1.13, z = +0.5 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.220 ± 0.090
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 12.150 (uncertainty not provided) — JPL SBDB E2025R13
- D: 10.52 ± 2.139 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"2045\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:43:16+00:00",
  "version": "orbit_id=77; soln_date=2026-06-05 06:08:07",
  "identifier": "20002045",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"2045\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:43:16+00:00",
  "version": "orbit_id=77; soln_date=2026-06-05 06:08:07",
  "identifier": "20002045",
  "origin": "OBSERVED"
 }
]
```
