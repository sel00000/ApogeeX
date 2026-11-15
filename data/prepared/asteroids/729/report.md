# Analysis Report: 729

Generated 2026-11-15T02:38:23+00:00 - model version 0.1.0

## Identification

- Designation: 729 Watsonia (A912 CE)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 321
- Spectral points: 321
- Quality flags: {'WARN': 279, 'GOOD': 25, 'BAD': 17}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.1%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 20 (59 exposures, 11.14 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 37 bins / 81 points
- Brightness variability between visits: detected (p = 2.9e-08, visit-offset rms 0.29 mag)
- Rotational lightcurve correction: not applied - periodic model explains 30% of the visit-to-visit variation (< 70%)
- Correction applied: visit_offsets; Normalisation groups: 4

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +5.98 | 0 |
| B2-B3 | +1.36 | 0 |
| B3-B4 | -7.33 | 0 |
| B4-B5 | +5.78 | 1 |
| B5-B6 | +1.56 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 11.14 d (phase angle 19.5-19.8 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 37 repeat bins (p = 2.9e-08); visit-offset rms 0.29 mag.
  - ⚠ Periodic lightcurve correction NOT applied: periodic model explains 30% of the visit-to-visit variation (< 70%).
  - ⚠ 4 normalisation groups could not be linked: their relative brightness (and the spectral slope across them) is not constrained by the data.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 0.9847 ± 0.1351 (fitted)
- Sub-solar temperature T_ss (K): 233.6 ± 8.0
- Reduced chi^2: 1.59
- Thermal excess S/N: 20.0
- Internal 2-um reflectance parameter (not pV): 0.3519
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=19.8 deg -> eta0=1.07 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 158 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 40.9 +- 11.5 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | L | L-type | 19.4% | 1.14 |
| 2 | T | T-type | 17.6% | 1.18 |
| 3 | Xc | X-complex | 13.3% | 1.10 |
| 4 | Xk | X-complex | 11.5% | 1.10 |
| 5 | K | K-type | 9.3% | 1.26 |
| 6 | Cb | C-complex | 5.1% | 1.08 |
| 7 | C | C-complex | 5.0% | 1.11 |
| 8 | X | X-complex | 4.9% | 1.10 |
| 9 | Cg | C-complex | 3.5% | 1.07 |
| 10 | Ch | C-complex | 3.5% | 1.12 |
| 11 | Xe | X-complex | 3.3% | 1.11 |
| 12 | Cgh | C-complex | 1.5% | 1.11 |
| 13 | D | D-type | 1.1% | 1.23 |
| 14 | Xn | X-complex | 0.8% | 1.22 |
| 15 | S | S-complex | 0.1% | 1.42 |
| 16 | Sq | S-complex | <0.1% | 1.74 |
| 17 | B | C-complex | <0.1% | 1.36 |
| 18 | Sr | S-complex | <0.1% | 1.86 |
| 19 | Sv | S-complex | <0.1% | 2.07 |
| 20 | Sa | S-complex | <0.1% | 1.98 |
| 21 | Q | Q-type | <0.1% | 2.59 |
| 22 | A | A-type | <0.1% | 3.48 |
| 23 | R | R-type | <0.1% | 3.60 |
| 24 | V | V-type | <0.1% | 4.41 |
| 25 | O | O-type | <0.1% | 5.44 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | X-complex | 33.7% |
| 2 | L-type | 19.4% |
| 3 | C-complex | 18.6% |
| 4 | T-type | 17.6% |
| 5 | K-type | 9.3% |
| 6 | D-type | 1.1% |
| 7 | S-complex | 0.2% |
| 8 | Q-type | <0.1% |
| 9 | A-type | <0.1% |
| 10 | R-type | <0.1% |
| 11 | V-type | <0.1% |
| 12 | O-type | <0.1% |

- Most probable: **X-complex (subclass not determined: Xc 13%, Xk 11%)** — Confidence: Low
  - best complex X-complex vs runner-up L-type: delta score 1.1 (scaled deviance incl. prior)
- S-complex vs D-type: not distinguished (D minus S deviance -3.8; favours D-type)
- Spectral slope used: yes (systematic 0.002 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.762 au, e 0.095, i 18.1 deg)
- Albedo term: pV 0.107 ± 0.14 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| X-complex | 33.7% | 33.7% |
| L-type | 19.4% | 4.7% |
| C-complex | 18.6% | 52.4% |
| T-type | 17.6% | 6.4% |
| K-type | 9.3% | 1.7% |
| D-type | 1.1% | 0.6% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- 4 normalisation groups fitted with independent brightness scales: only the spectral shape within each group is used.
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.107, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | N/A | N/A | 0.070 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 9.550 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026E92
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 55.68 ± 11.04
- Conditional range (no H): N/A
- Catalogue diameter (km): 50.02 ± 0.415 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))
- Difference: 5.656 km (0.5 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 45.96-68.04 / 38.63-83.55
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 19.8 deg, x1.12 for 3.5-5 um: eta 1.01 at 100 km, 1.06 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 158 (3 normalisation group(s), 37 of 40 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 41.9 — Beaming parameter eta (posterior median, 68%): 0.99 (0.86-1.13)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 1.6.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 56.7 km (68%: 47.98-67.67; 95%: 41.2-80.63) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 56.7 km (68%: 47.98-67.67) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 61.52 km (68%: 44.17-86.15 km; 95%: 32.02-118.7 km) — Confidence: Low
- Prior albedo of the same draws: 0.071 (68%: 0.036-0.137) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): X-complex 35%, C-complex 34%, L-type 13%, T-type 11%, K-type 5%, D-type 1%
- Thermal vs statistical diameter: thermal 55.68 km / statistical 61.52 km = 0.91, z = -0.3 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.086 ± 0.034
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 9.550 (uncertainty not provided) — JPL SBDB E2026E92
- D: 55.68 ± 11.04 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"729\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:37:08+00:00",
  "version": "orbit_id=83; soln_date=2026-06-05 03:58:28",
  "identifier": "20000729",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"729\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:37:08+00:00",
  "version": "orbit_id=83; soln_date=2026-06-05 03:58:28",
  "identifier": "20000729",
  "origin": "OBSERVED"
 }
]
```
