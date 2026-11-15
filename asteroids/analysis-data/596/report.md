# Analysis Report: 596

Generated 2026-11-15T02:42:15+00:00 - model version 0.1.0

## Identification

- Designation: 596 Scheila (A906 DL)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 280
- Spectral points: 280
- Quality flags: {'WARN': 168, 'GOOD': 107, 'BAD': 5}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 11.1%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv

## Observation-Time Structure

- Visits: 20 (61 exposures, 10.46 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 12 bins / 30 points
- Brightness variability between visits: not detected (p = 0.5)
- Rotational lightcurve correction: not applied - no significant variability between visits
- Correction applied: none; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | +2.86 | 0 |
| B2-B3 | +4.35 | 0 |
| B3-B4 | -7.20 | 0 |
| B4-B5 | +2.86 | 0 |
| B5-B6 | +4.35 | 0 |

  - ⚠ Spectrum assembled from 20 visits over 10.46 d (phase angle 17.9-18.1 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Brightness consistent between visits on 12 repeat bins (p = 0.5): no correction applied. Visit-to-visit uncertainty kept in the error covariance: 0.036 mag for the 5 visits linked by repeats to the largest group, 0.10 mag (untested prior) for 15 visits not linked to it (4 of them linked only within smaller groups).

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 0.744 ± 0.07598 (fitted)
- Sub-solar temperature T_ss (K): 242.9 ± 6.2
- Reduced chi^2: 1.67
- Thermal excess S/N: 57.5
- Internal 2-um reflectance parameter (not pV): 0.09502
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=18.1 deg -> eta0=1.05 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 154 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 93.0 +- 19.2 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | Cgh | C-complex | 17.6% | 0.89 |
| 2 | Ch | C-complex | 15.3% | 0.99 |
| 3 | D | D-type | 15.1% | 0.90 |
| 4 | T | T-type | 11.8% | 0.96 |
| 5 | Xk | X-complex | 10.9% | 0.98 |
| 6 | Xc | X-complex | 7.5% | 1.01 |
| 7 | X | X-complex | 5.1% | 0.95 |
| 8 | Cg | C-complex | 3.7% | 1.06 |
| 9 | Xe | X-complex | 3.3% | 0.93 |
| 10 | L | L-type | 3.2% | 0.99 |
| 11 | Cb | C-complex | 3.1% | 1.11 |
| 12 | Xn | X-complex | 1.9% | 0.91 |
| 13 | C | C-complex | 0.8% | 1.23 |
| 14 | K | K-type | 0.5% | 1.11 |
| 15 | S | S-complex | <0.1% | 1.01 |
| 16 | B | C-complex | <0.1% | 1.02 |
| 17 | Sr | S-complex | <0.1% | 1.17 |
| 18 | Sv | S-complex | <0.1% | 1.26 |
| 19 | Sq | S-complex | <0.1% | 1.26 |
| 20 | Q | Q-type | <0.1% | 1.64 |
| 21 | R | R-type | <0.1% | 1.75 |
| 22 | Sa | S-complex | <0.1% | 1.68 |
| 23 | V | V-type | <0.1% | 2.38 |
| 24 | O | O-type | <0.1% | 3.61 |
| 25 | A | A-type | <0.1% | 3.45 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | C-complex | 40.5% |
| 2 | X-complex | 28.7% |
| 3 | D-type | 15.1% |
| 4 | T-type | 11.8% |
| 5 | L-type | 3.2% |
| 6 | K-type | 0.5% |
| 7 | S-complex | 0.1% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | V-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **C-complex (subclass not determined: Cgh 18%, Ch 15%)** — Confidence: Low
  - best complex C-complex vs runner-up X-complex: delta score 0.7 (scaled deviance incl. prior)
- S-complex vs D-type: distinguished (D minus S deviance -10.0; favours D-type)
- Spectral slope used: yes (systematic 0.050 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.933 au, e 0.160, i 14.6 deg)
- Albedo term: pV 0.019 ± 0.34 dex (catalogue diameter with current H; catalogue albedo 0.040 disagrees by -0.33 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M)))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| C-complex | 40.5% | 26.8% |
| X-complex | 28.7% | 37.0% |
| D-type | 15.1% | 5.7% |
| T-type | 11.8% | 21.2% |
| L-type | 3.2% | 4.8% |
| K-type | 0.5% | 0.9% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.019, catalogue diameter with current H; catalogue albedo 0.040 disagrees by -0.33 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))). The spectral-only ranking is kept separately.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.906 ± 0.168 | 0.074 ± 0.089 | 0.075 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 1.774 ± 0.194 | 0.126 ± 0.085 | 0.050 | not detected; a typical band-bearing asteroid would be detectable here |
| OH / phyllosilicate (2.7-2.9 um) | NOT_DETECTED | 2.800 ± 0.150 | -0.045 ± 0.051 | 0.154 | Not significant; upper limit on depth = depth + 3 sigma. |
| H2O ice / NH4 (3.0-3.2 um) | NOT_DETECTED | 3.100 ± 0.150 | -0.021 ± 0.061 | 0.183 | Not significant; upper limit on depth = depth + 3 sigma. |
| C-H organics (3.35-3.55 um) | NOT_DETECTED | 3.450 ± 0.100 | -0.012 ± 0.069 | 0.208 | Not significant; upper limit on depth = depth + 3 sigma. |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Carbonaceous materials | Featureless spectrum with pV = 0.061 < 0.1 | Medium |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 8.920 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB E2026-EA1
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: OK
- Diameter (km): 97.06 ± 14.76
- Conditional range (no H): N/A
- Catalogue diameter (km): 159.7 ± 1.103 (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))
- Difference: -62.67 km (-4.2 sigma)
- Confidence: Medium
- Diameter, 68% / 95% interval (km): 83.76-113.3 / 72.64-131.9
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 18.1 deg, x1.12 for 3.5-5 um: eta 1.00 at 100 km, 1.05 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 154 (8 normalisation group(s), 34 of 42 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 143.0 — Beaming parameter eta (posterior median, 68%): 0.74 (0.67-0.82)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 1.7.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 93.73 km (68%: 82.21-107.5; 95%: 72.06-122.8) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 93.73 km (68%: 82.21-107.5) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 78.81 km (68%: 56.5-108.8 km; 95%: 41.15-147.6 km) — Confidence: Low
- Prior albedo of the same draws: 0.077 (68%: 0.040-0.150) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): X-complex 29%, C-complex 26%, T-type 18%, L-type 12%, D-type 10%, S-complex 2%, K-type 2%
- Thermal vs statistical diameter: thermal 97.06 km / statistical 78.81 km = 1.23, z = +0.6 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.051 ± 0.015
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 8.920 (uncertainty not provided) — JPL SBDB E2026-EA1
- D: 97.06 ± 14.76 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"596\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:53+00:00",
  "version": "orbit_id=119; soln_date=2026-06-05 03:48:27",
  "identifier": "20000596",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"596\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:40:53+00:00",
  "version": "orbit_id=119; soln_date=2026-06-05 03:48:27",
  "identifier": "20000596",
  "origin": "OBSERVED"
 }
]
```
