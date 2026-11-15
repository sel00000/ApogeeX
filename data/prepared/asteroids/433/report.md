# Analysis Report: 433

Generated 2026-11-15T04:22:54+00:00 - model version 0.1.0

## Identification

- Designation: 433 Eros (A898 PA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 191
- Spectral points: 191
- Quality flags: {'WARN': 97, 'GOOD': 92, 'BAD': 2}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 12.4%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 31 (95 exposures, 24.66 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 52 bins / 153 points
- Brightness variability between visits: detected (p = 1.9e-06, visit-offset rms 0.03 mag)
- Rotational lightcurve correction: not applied - periodic model explains 63% of the visit-to-visit variation (< 70%)
- Correction applied: visit_offsets; Normalisation groups: 8

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +3.63 | 0 |
| B2-B3 | +10.26 | 0 |
| B3-B4 | -13.93 | 0 |
| B4-B5 | +3.67 | 0 |
| B5-B6 | +10.26 | 0 |

  - ⚠ Spectrum assembled from 31 visits over 24.66 d (phase angle 36.7-37.6 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 52 repeat bins (p = 1.9e-06); visit-offset rms 0.03 mag.
  - ⚠ Periodic lightcurve correction NOT applied: periodic model explains 63% of the visit-to-visit variation (< 70%).
  - ⚠ 8 normalisation groups could not be linked: their relative brightness (and the spectral slope across them) is not constrained by the data.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.098 ± 0.2515 (fitted)
- Sub-solar temperature T_ss (K): 294.7 ± 16.9
- Reduced chi^2: 2.43
- Thermal excess S/N: 81.4
- Internal 2-um reflectance parameter (not pV): 0.1922
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=37.6 deg -> eta0=1.25 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ Free eta reached its bound (0.50); D-eta degenerate for these data. Refitted with eta fixed at 1.25 and uncertainty -0.3/+0.55 propagated.
  - ⚠ Poor fit: reduced chi^2 = 3.04 > 3.0. Model may not describe the data (rotation, calibration, contamination).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 116 fit points (eta prior trilling2016); the single-group least-squares fit gave D = 27.6 +- 10.6 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | Sq | S-complex | 48.8% | 1.81 |
| 2 | S | S-complex | 19.7% | 1.70 |
| 3 | Q | Q-type | 10.0% | 2.10 |
| 4 | Sr | S-complex | 9.5% | 1.90 |
| 5 | A | A-type | 4.1% | 2.20 |
| 6 | Sa | S-complex | 3.5% | 1.86 |
| 7 | Sv | S-complex | 1.3% | 2.44 |
| 8 | K | K-type | 1.2% | 2.01 |
| 9 | L | L-type | 0.6% | 2.21 |
| 10 | Xk | X-complex | 0.5% | 2.26 |
| 11 | T | T-type | 0.2% | 2.45 |
| 12 | Xc | X-complex | 0.2% | 2.50 |
| 13 | X | X-complex | 0.2% | 2.17 |
| 14 | Cg | C-complex | <0.1% | 2.16 |
| 15 | D | D-type | <0.1% | 2.17 |
| 16 | Xe | X-complex | <0.1% | 2.19 |
| 17 | Xn | X-complex | <0.1% | 2.10 |
| 18 | Cb | C-complex | <0.1% | 2.48 |
| 19 | C | C-complex | <0.1% | 2.66 |
| 20 | Ch | C-complex | <0.1% | 2.42 |
| 21 | Cgh | C-complex | <0.1% | 2.16 |
| 22 | R | R-type | <0.1% | 2.91 |
| 23 | B | C-complex | <0.1% | 2.29 |
| 24 | V | V-type | <0.1% | 3.30 |
| 25 | O | O-type | <0.1% | 4.39 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | S-complex | 82.8% |
| 2 | Q-type | 10.0% |
| 3 | A-type | 4.1% |
| 4 | K-type | 1.2% |
| 5 | X-complex | 0.9% |
| 6 | L-type | 0.6% |
| 7 | T-type | 0.2% |
| 8 | C-complex | 0.1% |
| 9 | D-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | O-type | <0.1% |

- Most probable: **S-complex (subclass not determined: Sq 49%, S 20%)** — Confidence: Low
  - best complex S-complex vs runner-up Q-type: delta score 4.2 (scaled deviance incl. prior)
  - Thermal model fits poorly (chi2_red 3.0); reflectance derived from it is less reliable.
- S-complex vs D-type: distinguished (D minus S deviance +15.4; favours S-complex)
- Spectral slope used: yes (systematic 0.002 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 1.458 au, e 0.223, i 10.8 deg)
- Albedo term: pV 0.431 ± 0.26 dex (catalogue diameter with current H; catalogue albedo 0.250 disagrees by +0.24 dex beyond the population offset (H revision?): uncertainty increased (Yeomans et al. (2000) Science v.289,pp.2085-2088))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| S-complex | 82.8% | 81.0% |
| Q-type | 10.0% | 5.9% |
| A-type | 4.1% | 1.6% |
| K-type | 1.2% | 1.7% |
| X-complex | 0.9% | 4.2% |
| L-type | 0.6% | 0.5% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- 8 normalisation groups fitted with independent brightness scales: only the spectral shape within each group is used.
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Best-fit chi2_red = 1.8: probabilities were computed with errors inflated by sqrt(1.8) to account for unexplained scatter.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.431, catalogue diameter with current H; catalogue albedo 0.250 disagrees by +0.24 dex beyond the population offset (H revision?): uncertainty increased (Yeomans et al. (2000) Science v.289,pp.2085-2088)). The spectral-only ranking is kept separately.
- Thermal model fits poorly (chi2_red 3.0); reflectance derived from it is less reliable.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| Band II | NOT_DETECTED | N/A | N/A | 0.011 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | no continuum anchors |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 10.400 (uncertainty not provided)
- G: 0.46
- Source: JPL SBDB E2026L10
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 24.12 ± 5.304
- Conditional range (no H): N/A
- Catalogue diameter (km): 16.84 ± 0.06 (Yeomans et al. (2000) Science v.289,pp.2085-2088)
- Difference: 7.279 km (1.4 sigma)
- Confidence: Medium
- Catalogue shape at the SPHEREx geometry, effective diameter (km): 22.13 - what a spherical NEATM gives for the catalogue shape (f = 1.31 x the volume-equivalent diameter; ellipsoid 35.58 x 11.58 x 11.58 km; phase 37 deg; spin pole RA/Dec 11.37/17.22 deg, median sub-observer latitude -86 deg, sub-solar -54 deg). A NEATM diameter is an effective diameter; a shape-model diameter is volume-equivalent.
- Best diameter against the catalogue (z, log space): -2.7 against the catalogue diameter, -0.5 against the effective diameter of the catalogue shape (negative: SPHEREx larger)
- Diameter, 68% / 95% interval (km): 19.48-30.08 / 16.06-38.44
- Beaming-parameter prior: trilling2016: eta0 1.24 (-0.3/+0.55) at alpha 37.3 deg (neo)
- Points in the thermal likelihood: 116 (6 normalisation group(s), 21 of 27 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 111.5 — Beaming parameter eta (posterior median, 68%): 1.09 (0.85-1.36)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.4.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 23.68 km (68%: 20.87-26.96; 95%: 18.37-30.99) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 23.68 km (68%: 20.87-26.96) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 23.65 km (68%: 20.08-28.28 km; 95%: 16.88-37.21 km) — Confidence: Low
- Prior albedo of the same draws: 0.219 (68%: 0.153-0.303) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): S-complex 76%, Q-type 10%, A-type 4%, K-type 3%, X-complex 3%, C-complex 2%, L-type 1%, T-type 1%, D-type 1%
- Thermal vs statistical diameter: thermal 24.12 km / statistical 23.65 km = 1.02, z = +0.1 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.210 ± 0.092
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 10.400 (uncertainty not provided) — JPL SBDB E2026L10
- D: 24.12 ± 5.304 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.

## Mass and Density

- Mass (kg): 6.687e+15 ± 1.498e+12 — D: database GM (JPL SBDB) Yeomans et al. (2000) Science v.289,pp.2085-2088
- Status: ON_HOLD_VALIDATION (relative uncertainty 0.66 > 0.5)
- Bulk density (kg/m^3): 910 ± 600
- Shape assumption: spherical_assumption — V = 4/3 pi (D/2)^3

## Missing Data

- none

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"433\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=659; soln_date=2021-05-24 17:55:05",
  "identifier": "20000433",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"433\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=659; soln_date=2021-05-24 17:55:05",
  "identifier": "20000433",
  "origin": "OBSERVED"
 }
]
```
