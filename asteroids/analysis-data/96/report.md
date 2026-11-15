# Analysis Report: 96

Generated 2026-11-15T02:43:12+00:00 - model version 0.1.0

## Identification

- Designation: 96 Aegle (A868 DA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 459
- Spectral points: 459
- Quality flags: {'WARN': 294, 'GOOD': 158, 'BAD': 7}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 10.7%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 2 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 19 (60 exposures, 12.70 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 34 bins / 68 points
- Brightness variability between visits: detected (p = 4.8e-06, visit-offset rms 0.09 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +7.81 | 0 |
| B2-B3 | +2.31 | 0 |
| B3-B4 | -9.55 | 0 |
| B4-B5 | +7.24 | 0 |
| B5-B6 | +2.31 | 0 |

  - ⚠ Spectrum assembled from 19 visits over 12.70 d (phase angle 16.8-17.1 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 34 repeat bins (p = 4.8e-06); visit-offset rms 0.09 mag.
  - ⚠ Rotational lightcurve (P = 13.868 h) fitted to repeated observations only (peak-to-peak 0.94 mag, Delta-BIC 41); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.048 ± 0.148 (fitted)
- Sub-solar temperature T_ss (K): 213.7 ± 7.5
- Reduced chi^2: 4.46
- Thermal excess S/N: 21.8
- Internal 2-um reflectance parameter (not pV): 0.2873
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=16.9 deg -> eta0=1.04 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 247 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 86.7 +- 20.0 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | Ch | C-complex | 13.9% | 2.34 |
| 2 | Cgh | C-complex | 12.5% | 2.15 |
| 3 | Cg | C-complex | 11.3% | 2.28 |
| 4 | Cb | C-complex | 10.1% | 2.38 |
| 5 | C | C-complex | 9.6% | 2.45 |
| 6 | D | D-type | 7.6% | 2.30 |
| 7 | B | C-complex | 6.8% | 1.99 |
| 8 | Xk | X-complex | 5.4% | 2.27 |
| 9 | L | L-type | 5.2% | 2.19 |
| 10 | Xn | X-complex | 4.3% | 2.06 |
| 11 | Xe | X-complex | 3.2% | 2.20 |
| 12 | Xc | X-complex | 3.1% | 2.49 |
| 13 | X | X-complex | 3.0% | 2.26 |
| 14 | T | T-type | 3.0% | 2.57 |
| 15 | K | K-type | 1.0% | 2.32 |
| 16 | S | S-complex | <0.1% | 2.16 |
| 17 | Sv | S-complex | <0.1% | 2.85 |
| 18 | Sr | S-complex | <0.1% | 2.75 |
| 19 | Sq | S-complex | <0.1% | 2.89 |
| 20 | Q | Q-type | <0.1% | 4.22 |
| 21 | Sa | S-complex | <0.1% | 3.84 |
| 22 | V | V-type | <0.1% | 5.10 |
| 23 | A | A-type | <0.1% | 7.11 |
| 24 | O | O-type | <0.1% | 9.14 |
| 25 | R | R-type | <0.1% | 5.75 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | C-complex | 64.1% |
| 2 | X-complex | 19.1% |
| 3 | D-type | 7.6% |
| 4 | L-type | 5.2% |
| 5 | T-type | 3.0% |
| 6 | K-type | 1.0% |
| 7 | S-complex | <0.1% |
| 8 | Q-type | <0.1% |
| 9 | V-type | <0.1% |
| 10 | A-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | R-type | <0.1% |

- Most probable: **C-complex (subclass not determined: Ch 14%, Cgh 13%)** — Confidence: Low
  - best complex C-complex vs runner-up X-complex: delta score 2.4 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance -9.8; favours D-type)
- Spectral slope used: yes (systematic 0.170 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.048 au, e 0.143, i 16.0 deg)
- Albedo term: pV 0.048 ± 0.10 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| C-complex | 64.1% | 37.5% |
| X-complex | 19.1% | 32.0% |
| D-type | 7.6% | 2.6% |
| L-type | 5.2% | 9.9% |
| T-type | 3.0% | 3.1% |
| K-type | 1.0% | 5.2% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Best-fit chi2_red = 2.2: probabilities were computed with errors inflated by sqrt(2.2) to account for unexplained scatter.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.048, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.223 ± 0.000 | 0.534 ± 0.074 | 0.074 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.660 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2025-UO9
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 181.1 ± 43.66
- Conditional range (no H): N/A
- Catalogue diameter (km): 177.8 ± 1.543 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))
- Difference: 3.326 km (0.1 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 143.5-230.8 / 116.4-296.6
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 17.1 deg, x1.12 for 3.5-5 um: eta 0.99 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 247 (3 normalisation group(s), 57 of 59 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 51.0 — Beaming parameter eta (posterior median, 68%): 1.05 (0.91-1.20)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 4.5.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 166.5 km (68%: 135.4-203.4; 95%: 113.6-246.7) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 166.5 km (68%: 135.4-203.4) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 135.3 km (68%: 100-196.4 km; 95%: 76.95-274.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.083 (68%: 0.039-0.152) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 31%, L-type 22%, X-complex 21%, K-type 13%, D-type 5%, S-complex 5%, T-type 3%
- Thermal vs statistical diameter: thermal 181.1 km / statistical 135.3 km = 1.34, z = +0.7 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.046 ± 0.022
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.660 (uncertainty not provided) — JPL SBDB E2025-UO9
- D: 181.1 ± 43.66 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 4.5). Albedo on hold.

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
  "query": "{\"sstr\": \"96\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:17+00:00",
  "version": "orbit_id=144; soln_date=2026-06-05 03:08:51",
  "identifier": "20000096",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"96\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:17+00:00",
  "version": "orbit_id=144; soln_date=2026-06-05 03:08:51",
  "identifier": "20000096",
  "origin": "OBSERVED"
 }
]
```
