# Analysis Report: 221

Generated 2026-11-15T02:45:20+00:00 - model version 0.1.0

## Identification

- Designation: 221 Eos (A882 BA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 310
- Spectral points: 310
- Quality flags: {'WARN': 252, 'GOOD': 51, 'BAD': 7}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 2 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 21 (60 exposures, 22.62 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 31 bins / 81 points
- Brightness variability between visits: detected (p = 5.6e-06, visit-offset rms 0.10 mag)
- Rotational lightcurve correction: not applied - periodic model explains 62% of the visit-to-visit variation (< 70%)
- Correction applied: visit_offsets; Normalisation groups: 5

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -1.49 | 0 |
| B2-B3 | -7.06 | 0 |
| B3-B4 | +8.56 | 0 |
| B4-B5 | -1.49 | 0 |
| B5-B6 | -7.06 | 0 |

  - ⚠ Spectrum assembled from 21 visits over 22.62 d (phase angle 17.0-20.5 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness varies between visits: constant-brightness model rejected on 31 repeat bins (p = 5.6e-06); visit-offset rms 0.10 mag.
  - ⚠ Periodic lightcurve correction NOT applied: periodic model explains 62% of the visit-to-visit variation (< 70%).
  - ⚠ 5 normalisation groups could not be linked: their relative brightness (and the spectral slope across them) is not constrained by the data.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.056 ± 0.1522 (fitted)
- Sub-solar temperature T_ss (K): 236.6 ± 8.5
- Reduced chi^2: 6.79
- Thermal excess S/N: 17.7
- Internal 2-um reflectance parameter (not pV): 0.1196
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=21.2 deg -> eta0=1.08 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ Free eta reached its bound (0.50); D-eta degenerate for these data. Refitted with eta fixed at 1.08 and uncertainty -0.3/+0.55 propagated.
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 189 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 119.7 +- 74.1 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | K | K-type | 48.8% | 0.68 |
| 2 | L | L-type | 24.8% | 0.69 |
| 3 | Xc | X-complex | 8.7% | 0.70 |
| 4 | Xk | X-complex | 3.7% | 0.71 |
| 5 | T | T-type | 3.4% | 0.76 |
| 6 | Ch | C-complex | 1.9% | 0.69 |
| 7 | Sq | S-complex | 1.6% | 0.80 |
| 8 | C | C-complex | 1.4% | 0.73 |
| 9 | Xe | X-complex | 0.8% | 0.68 |
| 10 | S | S-complex | 0.8% | 0.75 |
| 11 | Cb | C-complex | 0.7% | 0.74 |
| 12 | X | X-complex | 0.7% | 0.74 |
| 13 | Cg | C-complex | 0.7% | 0.69 |
| 14 | Sv | S-complex | 0.4% | 0.97 |
| 15 | D | D-type | 0.4% | 0.78 |
| 16 | Xn | X-complex | 0.4% | 0.68 |
| 17 | Cgh | C-complex | 0.3% | 0.67 |
| 18 | Sr | S-complex | 0.3% | 0.89 |
| 19 | Q | Q-type | 0.2% | 0.95 |
| 20 | A | A-type | <0.1% | 1.22 |
| 21 | Sa | S-complex | <0.1% | 1.03 |
| 22 | B | C-complex | <0.1% | 0.69 |
| 23 | O | O-type | <0.1% | 1.28 |
| 24 | R | R-type | <0.1% | 1.50 |
| 25 | V | V-type | <0.1% | 2.03 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | K-type | 48.8% |
| 2 | L-type | 24.8% |
| 3 | X-complex | 14.3% |
| 4 | C-complex | 5.0% |
| 5 | T-type | 3.4% |
| 6 | S-complex | 3.1% |
| 7 | D-type | 0.4% |
| 8 | Q-type | 0.2% |
| 9 | A-type | <0.1% |
| 10 | O-type | <0.1% |
| 11 | R-type | <0.1% |
| 12 | V-type | <0.1% |

- Most probable: **K** — Confidence: Low
  - best complex K-type vs runner-up L-type: delta score 1.4 (scaled deviance incl. prior)
- S-complex vs D-type: not distinguished (D minus S deviance +4.3; favours S-complex)
- Spectral slope used: yes (systematic 0.002 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.012 au, e 0.101, i 10.9 deg)
- Albedo term: pV 0.160 ± 0.10 dex (catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| K-type | 48.8% | 6.0% |
| L-type | 24.8% | 6.7% |
| X-complex | 14.3% | 31.9% |
| C-complex | 5.0% | 42.2% |
| T-type | 3.4% | 7.5% |
| S-complex | 3.1% | 4.5% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- 5 normalisation groups fitted with independent brightness scales: only the spectral shape within each group is used.
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.160, catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_EVALUABLE | N/A | N/A | N/A | band shoulders and centre not observed within one normalisation group |
| Band II | NOT_DETECTED | N/A | N/A | 0.100 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | no continuum anchors |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.710 (uncertainty not provided)
- G: 0.13
- Source: JPL SBDB MPO964268
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 112.5 ± 23.26
- Conditional range (no H): N/A
- Catalogue diameter (km): 95.47 ± 1.684 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))
- Difference: 17.07 km (0.7 sigma)
- Confidence: Low
- Diameter, 68% / 95% interval (km): 92.39-138.9 / 77.56-172.9
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 21.3 deg, x1.12 for 3.5-5 um: eta 1.02 at 100 km, 1.07 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 189 (4 normalisation group(s), 48 of 51 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 50.1 — Beaming parameter eta (posterior median, 68%): 1.05 (0.91-1.21)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 6.8.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 111.5 km (68%: 96.03-132.1; 95%: 83.48-159.9) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 111.5 km (68%: 96.03-132.1) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 115.5 km (68%: 89.35-162.2 km; 95%: 67.73-227.3 km) — Confidence: Low
- Prior albedo of the same draws: 0.109 (68%: 0.055-0.182) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 30%, K-type 28%, X-complex 20%, L-type 15%, T-type 4%, S-complex 2%, D-type 1%
- Thermal vs statistical diameter: thermal 112.5 km / statistical 115.5 km = 0.97, z = -0.1 — consistent

## Geometric Albedo

- Status: ON_HOLD_VALIDATION
- Geometric albedo pV (V band): 0.115 ± 0.048
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.710 (uncertainty not provided) — JPL SBDB MPO964268
- D: 112.5 ± 23.26 km — SPHEREx NEATM diameter posterior (all points)
- Correlation: H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H.
  - ⚠ Uncertainty is a lower bound: an input uncertainty was not provided by its source.
  - ⚠ Thermal model fits poorly (chi2_red 6.8). Albedo on hold.

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
  "query": "{\"sstr\": \"221\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:43:15+00:00",
  "version": "orbit_id=76; soln_date=2026-06-05 03:18:40",
  "identifier": "20000221",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"221\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:43:15+00:00",
  "version": "orbit_id=76; soln_date=2026-06-05 03:18:40",
  "identifier": "20000221",
  "origin": "OBSERVED"
 }
]
```
