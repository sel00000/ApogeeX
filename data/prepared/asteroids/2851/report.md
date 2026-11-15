# Analysis Report: 2851

Generated 2026-11-15T02:46:21+00:00 - model version 0.1.0

## Identification

- Designation: 2851 Harbin (1978 UQ2)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 355
- Spectral points: 355
- Quality flags: {'WARN': 303, 'GOOD': 38, 'BAD': 14}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 9.4%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 20 (60 exposures, 9.99 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 20 bins / 52 points
- Brightness variability between visits: not detected (p = 0.67)
- Rotational lightcurve correction: not applied - no significant variability between visits
- Correction applied: none; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +4.83 | 0 |
| B2-B3 | +4.00 | 0 |
| B3-B4 | -8.83 | 0 |
| B4-B5 | +4.49 | 0 |
| B5-B6 | +4.34 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 9.99 d (phase angle 27.2-27.4 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness consistent between visits on 20 repeat bins (p = 0.67): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.146 mag for the 6 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 14 visits not linked to it (4 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.104 ± 0.1944 (fitted)
- Sub-solar temperature T_ss (K): 260.2 ± 11.5
- Reduced chi^2: 1.99
- Thermal excess S/N: 8.1
- Internal 2-um reflectance parameter (not pV): 0.119
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=26.6 deg -> eta0=1.14 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 197 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 15.8 +- 6.5 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | V | V-type | 100.0% | 0.89 |
| 2 | R | R-type | <0.1% | 1.75 |
| 3 | Sv | S-complex | <0.1% | 1.86 |
| 4 | Sr | S-complex | <0.1% | 2.00 |
| 5 | S | S-complex | <0.1% | 2.26 |
| 6 | Sq | S-complex | <0.1% | 2.58 |
| 7 | Q | Q-type | <0.1% | 2.67 |
| 8 | D | D-type | <0.1% | 2.64 |
| 9 | O | O-type | <0.1% | 2.75 |
| 10 | Xn | X-complex | <0.1% | 2.68 |
| 11 | Sa | S-complex | <0.1% | 2.99 |
| 12 | X | X-complex | <0.1% | 2.93 |
| 13 | L | L-type | <0.1% | 3.02 |
| 14 | B | C-complex | <0.1% | 2.73 |
| 15 | Xe | X-complex | <0.1% | 2.98 |
| 16 | Xk | X-complex | <0.1% | 3.04 |
| 17 | T | T-type | <0.1% | 3.13 |
| 18 | Cgh | C-complex | <0.1% | 2.95 |
| 19 | K | K-type | <0.1% | 3.19 |
| 20 | Cg | C-complex | <0.1% | 3.15 |
| 21 | Xc | X-complex | <0.1% | 3.32 |
| 22 | Ch | C-complex | <0.1% | 3.30 |
| 23 | Cb | C-complex | <0.1% | 3.37 |
| 24 | A | A-type | <0.1% | 3.96 |
| 25 | C | C-complex | <0.1% | 3.53 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | V-type | 100.0% |
| 2 | R-type | <0.1% |
| 3 | S-complex | <0.1% |
| 4 | Q-type | <0.1% |
| 5 | D-type | <0.1% |
| 6 | O-type | <0.1% |
| 7 | X-complex | <0.1% |
| 8 | L-type | <0.1% |
| 9 | C-complex | <0.1% |
| 10 | T-type | <0.1% |
| 11 | K-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **V** — Confidence: High
  - best complex V-type vs runner-up R-type: delta score 18.6 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance +24.0; favours S-complex)
- Spectral slope used: yes (systematic 0.070 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.480 au, e 0.123, i 8.5 deg)
- Albedo term: pV 0.243 ± 0.20 dex (catalogue diameter with current H; catalogue albedo 0.358 disagrees by -0.17 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| V-type | 100.0% | 100.0% |
| R-type | <0.1% | <0.1% |
| S-complex | <0.1% | <0.1% |
| Q-type | <0.1% | <0.1% |
| D-type | <0.1% | <0.1% |
| O-type | <0.1% | <0.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.243, catalogue diameter with current H; catalogue albedo 0.358 disagrees by -0.17 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | DETECTED | 0.906 (uncertainty not provided) | 0.477 ± 0.063 | 0.189 | within_segment |
| Band II | NOT_DETECTED | 1.824 ± 0.266 | 0.392 ± 0.248 | 0.387 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Mafic silicates (olivine and/or pyroxene) | Band I (within_segment) | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 12.420 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB MPO980566
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 9.362 ± 1.95
- Conditional range (no H): N/A
- Catalogue diameter (km): 8.838 ± 0.236 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))
- Difference: 0.5237 km (0.3 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 7.642-11.54 / 6.361-14.24
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 27.2 deg, x1.12 for 3.5-5 um: eta 1.06 at 100 km, 1.11 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 197 (4 normalisation group(s), 46 of 49 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 14.5 — Beaming parameter eta (posterior median, 68%): 1.10 (0.92-1.31)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.0.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 8.865 km (68%: 7.869-9.99; 95%: 7.021-11.22) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 8.865 km (68%: 7.869-9.99) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 8.645 km (68%: 7.475-10.04 km; 95%: 6.467-11.57 km) — Confidence: Medium
- Prior albedo of the same draws: 0.254 (68%: 0.189-0.340) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): V-type 100%
- Thermal vs statistical diameter: thermal 9.362 km / statistical 8.645 km = 1.08, z = +0.3 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.217 ± 0.090
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 12.420 (uncertainty not provided) — JPL SBDB MPO980566
- D: 9.362 ± 1.95 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"2851\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:44:25+00:00",
  "version": "orbit_id=68; soln_date=2026-06-05 06:59:59",
  "identifier": "20002851",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"2851\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:44:25+00:00",
  "version": "orbit_id=68; soln_date=2026-06-05 06:59:59",
  "identifier": "20002851",
  "origin": "OBSERVED"
 }
]
```
