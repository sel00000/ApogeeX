# Analysis Report: 216

Generated 2026-11-15T04:23:59+00:00 - model version 0.1.0

## Identification

- Designation: 216 Kleopatra (A880 GB)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 406
- Spectral points: 406
- Quality flags: {'WARN': 328, 'GOOD': 62, 'BAD': 16}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 12.0%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 21 (59 exposures, 284.05 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 20 bins / 45 points
- Brightness variability between visits: detected (p = 1.6e-73, visit-offset rms 0.14 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -2.31 | 0 |
| B2-B3 | -3.87 | 0 |
| B3-B4 | +6.18 | 0 |
| B4-B5 | -2.31 | 0 |
| B5-B6 | -3.87 | 0 |

  - ⚠ Spectrum assembled from 21 visits over 284.05 d (phase angle 14.4-18.0 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Observations span 2 observing seasons (gaps > 30 d): viewing geometry and aspect differ between them, so one brightness offset per season is fitted to the 7 repeat bins that link seasons (season 1: +0.30 +- 0.14 mag); variability is tested within seasons.
  - ⚠ Brightness varies between visits within observing seasons: constant-brightness model rejected on 20 repeat bins (p = 1.6e-73); visit-offset rms 0.14 mag.
  - ⚠ Rotational lightcurve (P = 5.385 h) fitted to repeated observations only (peak-to-peak 0.27 mag, Delta-BIC 40); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: OK
- Beaming parameter eta: 1.062 ± 0.1505 (fitted)
- Sub-solar temperature T_ss (K): 217.7 ± 7.7
- Reduced chi^2: 2.67
- Thermal excess S/N: 4.4
- Internal 2-um reflectance parameter (not pV): 0.06188
  - ⚠ eta fitted with literature prior eta = 0.87 + 0.01 * alpha[deg] at alpha=17.2 deg -> eta0=1.04 (-0.3/+0.55); Trilling et al. (2016).
  - ⚠ A = q pV with pV from H and D: thermal and optical constraints fitted jointly.
  - ⚠ Diameter from the posterior of all 194 fit points (eta prior neowise_population); the single-group least-squares fit gave D = 231.6 +- 145.3 km.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | L | L-type | 26.1% | 0.94 |
| 2 | K | K-type | 18.1% | 0.96 |
| 3 | Sq | S-complex | 11.1% | 0.93 |
| 4 | S | S-complex | 9.8% | 0.92 |
| 5 | D | D-type | 4.5% | 0.91 |
| 6 | Xe | X-complex | 4.0% | 0.93 |
| 7 | Sr | S-complex | 3.9% | 0.99 |
| 8 | X | X-complex | 3.2% | 0.95 |
| 9 | Xn | X-complex | 3.2% | 0.92 |
| 10 | Q | Q-type | 2.9% | 0.99 |
| 11 | Xk | X-complex | 2.8% | 1.00 |
| 12 | T | T-type | 2.4% | 0.99 |
| 13 | Cgh | C-complex | 1.9% | 0.93 |
| 14 | Xc | X-complex | 1.8% | 1.03 |
| 15 | Ch | C-complex | 1.0% | 1.01 |
| 16 | Cg | C-complex | 0.7% | 1.02 |
| 17 | Sa | S-complex | 0.5% | 1.05 |
| 18 | B | C-complex | 0.5% | 0.87 |
| 19 | Cb | C-complex | 0.5% | 1.05 |
| 20 | Sv | S-complex | 0.4% | 1.16 |
| 21 | C | C-complex | 0.2% | 1.12 |
| 22 | A | A-type | 0.1% | 1.16 |
| 23 | O | O-type | 0.1% | 1.21 |
| 24 | R | R-type | <0.1% | 1.35 |
| 25 | V | V-type | <0.1% | 1.59 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | L-type | 26.1% |
| 2 | S-complex | 25.8% |
| 3 | K-type | 18.1% |
| 4 | X-complex | 15.0% |
| 5 | C-complex | 4.8% |
| 6 | D-type | 4.5% |
| 7 | Q-type | 2.9% |
| 8 | T-type | 2.4% |
| 9 | A-type | 0.1% |
| 10 | O-type | 0.1% |
| 11 | R-type | <0.1% |
| 12 | V-type | <0.1% |

- Most probable: **L** — Confidence: Low
  - best complex L-type vs runner-up S-complex: delta score 0.0 (scaled deviance incl. prior)
  - most probable complex changes (L-type -> S-complex) with the lightcurve correction scaled by 1 -/+ 0.10 or computed with the BIC runner-up number of harmonics
  - most probable complex changes when single visits are left out (8 of 19 samples: S-complex)
  - most probable complex changes (L-type -> S-complex) without the 9 saturated (wing-only) points
- S-complex vs D-type: not distinguished (D minus S deviance +3.5; favours S-complex)
- Spectral slope used: yes (systematic 0.119 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 2.795 au, e 0.250, i 13.1 deg)
- Albedo term: pV 0.185 ± 0.29 dex (catalogue diameter with current H; catalogue albedo 0.116 disagrees by +0.20 dex beyond the population offset (H revision?): uncertainty increased ([Shepard, M. K. et al. (2018) Icarus 311, 197-209]))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| L-type | 26.1% | 8.7% |
| S-complex | 25.8% | 24.9% |
| K-type | 18.1% | 6.7% |
| X-complex | 15.0% | 24.7% |
| C-complex | 4.8% | 18.7% |
| D-type | 4.5% | 6.1% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.185, catalogue diameter with current H; catalogue albedo 0.116 disagrees by +0.20 dex beyond the population offset (H revision?): uncertainty increased ([Shepard, M. K. et al. (2018) Icarus 311, 197-209])). The spectral-only ranking is kept separately.
- The classification depends on the rotational-lightcurve model: with the correction scaled by 1 -/+ 0.10, or with the BIC runner-up number of harmonics, the most probable complex becomes S-complex.
- The classification is not stable against leaving out single visits: 8 of 19 leave-one-visit-out samples give S-complex instead of L-type.
- The classification depends on 9 points with a saturated PSF core: without them the most probable complex is S-complex.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 0.997 ± 2.001 | 0.090 ± 0.261 | 0.085 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 2.067 ± 0.484 | 0.201 ± 0.149 | 0.221 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 7.020 (uncertainty not provided)
- G: 0.29
- Source: JPL SBDB MPO980524
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.

## Diameter

- Status: OK
- Diameter (km): 131.5 ± 24.78
- Conditional range (no H): N/A
- Catalogue diameter (km): 122 ± 30 ([Shepard, M. K. et al. (2018) Icarus 311, 197-209])
- Difference: 9.471 km (0.2 sigma)
- Confidence: Medium
- Catalogue shape at the SPHEREx geometry, effective diameter (km): 158.8 - what a spherical NEATM gives for the catalogue shape (f = 1.30 x the volume-equivalent diameter; ellipsoid 266.2 x 90.67 x 75.23 km; phase 18 deg; spin pole RA/Dec 69/42 deg, median sub-observer latitude +54 deg, sub-solar +50 deg). A NEATM diameter is an effective diameter; a shape-model diameter is volume-equivalent.
- Best diameter against the catalogue (z, log space): -0.3 against the catalogue diameter, +0.6 against the effective diameter of the catalogue shape (negative: SPHEREx larger)
- Diameter, 68% / 95% interval (km): 110.2-159.8 / 94.51-196.4
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 17.3 deg, x1.12 for 3.5-5 um: eta 0.99 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 194 (2 normalisation group(s), 68 of 69 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 36.9 — Beaming parameter eta (posterior median, 68%): 1.06 (0.92-1.22)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 2.7.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 133.6 km (68%: 115.2-157.3; 95%: 101.3-188) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 133.6 km (68%: 115.2-157.3) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 148.2 km (68%: 112.3-215.1 km; 95%: 88.55-311 km) — Confidence: Low
- Prior albedo of the same draws: 0.125 (68%: 0.059-0.218) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: N/A km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): L-type 20%, X-complex 20%, S-complex 18%, K-type 14%, C-complex 13%, D-type 9%, T-type 3%, Q-type 3%
- Thermal vs statistical diameter: thermal 131.5 km / statistical 148.2 km = 0.89, z = -0.3 — consistent

## Geometric Albedo

- Status: ESTIMATED
- Geometric albedo pV (V band): 0.159 ± 0.060
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 7.020 (uncertainty not provided) — JPL SBDB MPO980524
- D: 131.5 ± 24.78 km — SPHEREx NEATM diameter posterior (all points)
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
  "query": "{\"sstr\": \"216\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=157; soln_date=2026-06-05 03:18:06",
  "identifier": "20000216",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"216\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T04:21:57+00:00",
  "version": "orbit_id=157; soln_date=2026-06-05 03:18:06",
  "identifier": "20000216",
  "origin": "OBSERVED"
 }
]
```
