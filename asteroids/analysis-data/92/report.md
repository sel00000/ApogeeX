# Analysis Report: 92

Generated 2026-11-15T02:49:31+00:00 - model version 0.1.0

## Identification

- Designation: 92 Undina (A867 NA)
- Status: Catalogued (JPL SBDB)

## SPHEREx Observations

- Exposures: 350
- Spectral points: 350
- Quality flags: {'WARN': 264, 'GOOD': 80, 'BAD': 6}

## Relative Spectral Calibration (solar analogs)

- Status: applied - fluxes divided by the SPHEREx response measured on solar-analog stars
- Solar-analog stars: 14 (Gaia DR3 1021495028608838016, Gaia DR3 1325938803224554752, Gaia DR3 1565876532739593600, Gaia DR3 2972362529862291200, Gaia DR3 4662850696812855168, Gaia DR3 4769435292423335168, Gaia DR3 5050053165460308224, Gaia DR3 633604815435763712, Gaia DR3 6425579316029502080, Gaia DR3 667330101236907776, Gaia DR3 6833816717724281472, Gaia DR3 6909894018898836608, Landolt 107-998, Landolt 98-978)
- Largest correction |C - 1|: 10.6%
- Slope uncertainty of the correction (star-to-star colour scatter): SWIR 0.23 %/um, MWIR 0.14 %/um
- Reduced chi^2 of the star fit: 1.57
- Correction file: data/calibration/solar_analog_correction.csv
  - ⚠ 1 points outside the wavelength range covered by the solar-analog calibration were left uncorrected.

## Observation-Time Structure

- Visits: 22 (59 exposures, 295.15 d)
- Detector families: B1+B4, B2+B5, B3+B6
- Repeated observations: 30 bins / 70 points
- Brightness variability between visits: detected (p = 2.9e-123, visit-offset rms 0.08 mag)
- Rotational lightcurve correction: applied - supported by repeats
- Correction applied: periodic_lightcurve; Normalisation groups: 1

| Adjacent segments | Median time difference (d) | Shared visits |
|---|---|---|
| B1-B2 | -26.30 | 0 |
| B2-B3 | -1.02 | 0 |
| B3-B4 | +27.31 | 0 |
| B4-B5 | -26.30 | 0 |
| B5-B6 | -1.02 | 0 |

  - ⚠ Spectrum assembled from 22 visits over 295.15 d (phase angle 13.6-17.3 deg).
  - ⚠ Adjacent spectral segments never observed together (B1-B2, B2-B3, B3-B4, B4-B5, B5-B6): their relative brightness depends on variability between visits.
  - ⚠ Observations span 2 observing seasons (gaps > 30 d): viewing geometry and aspect differ between them, so one brightness offset per season is fitted to the 12 repeat bins that link seasons (season 1: -0.20 +- 0.05 mag); variability is tested within seasons.
  - ⚠ Brightness varies between visits within observing seasons: constant-brightness model rejected on 30 repeat bins (p = 2.9e-123); visit-offset rms 0.08 mag.
  - ⚠ Rotational lightcurve (P = 15.941 h) fitted to repeated observations only (peak-to-peak 0.36 mag, Delta-BIC 162); all points normalised to the rotation-averaged brightness.

## Reflected / Thermal Separation

- Status: Insufficient Data
- Beaming parameter eta: N/A (fixed)
- Sub-solar temperature T_ss (K): N/A
- Reduced chi^2: N/A
- Thermal excess S/N: N/A
- Internal 2-um reflectance parameter (not pV): N/A
  - ⚠ No data at lambda >= 3.5 um; thermal emission cannot be constrained.

## Spectral Type Candidates

| Rank | Class | Complex | Relative probability | chi²_red |
|---|---|---|---|---|
| 1 | L | L-type | 23.7% | 1.06 |
| 2 | Xc | X-complex | 14.7% | 0.97 |
| 3 | T | T-type | 11.4% | 1.02 |
| 4 | Xk | X-complex | 8.9% | 1.00 |
| 5 | K | K-type | 8.1% | 1.10 |
| 6 | X | X-complex | 6.2% | 0.98 |
| 7 | Xn | X-complex | 6.1% | 0.92 |
| 8 | Xe | X-complex | 5.8% | 0.97 |
| 9 | C | C-complex | 4.0% | 0.95 |
| 10 | Cb | C-complex | 2.8% | 0.96 |
| 11 | Ch | C-complex | 2.6% | 0.98 |
| 12 | Cg | C-complex | 2.1% | 0.97 |
| 13 | S | S-complex | 1.3% | 1.20 |
| 14 | Cgh | C-complex | 1.3% | 0.98 |
| 15 | Sv | S-complex | 0.4% | 1.36 |
| 16 | Sr | S-complex | 0.3% | 1.34 |
| 17 | D | D-type | 0.3% | 1.13 |
| 18 | Sq | S-complex | <0.1% | 1.46 |
| 19 | B | C-complex | <0.1% | 0.99 |
| 20 | Q | Q-type | <0.1% | 1.62 |
| 21 | R | R-type | <0.1% | 1.84 |
| 22 | Sa | S-complex | <0.1% | 1.97 |
| 23 | V | V-type | <0.1% | 2.34 |
| 24 | O | O-type | <0.1% | 2.76 |
| 25 | A | A-type | <0.1% | 3.80 |

**Ranking by complex**

| Rank | Complex | Relative probability |
|---|---|---|
| 1 | X-complex | 41.7% |
| 2 | L-type | 23.7% |
| 3 | C-complex | 12.8% |
| 4 | T-type | 11.4% |
| 5 | K-type | 8.1% |
| 6 | S-complex | 2.1% |
| 7 | D-type | 0.3% |
| 8 | Q-type | <0.1% |
| 9 | R-type | <0.1% |
| 10 | V-type | <0.1% |
| 11 | O-type | <0.1% |
| 12 | A-type | <0.1% |

- Most probable: **X-complex (subclass not determined: Xc 15%, Xk 9%)** — Confidence: Low
  - best complex X-complex vs runner-up L-type: delta score 1.1 (scaled deviance incl. prior)
  - most probable complex changes (X-complex -> S-complex) with the lightcurve correction scaled by 1 -/+ 0.10 or computed with the BIC runner-up number of harmonics
  - most probable complex changes when single visits are left out (1 of 22 samples: L-type)
- S-complex vs D-type: not distinguished (D minus S deviance +4.0; favours S-complex)
- Spectral slope used: yes (systematic 0.079 /um)

**Prior (population, orbit, albedo)**

- Population frequency of the complexes: beta 0.25, orbit information: tau 0.5 (a 3.186 au, e 0.105, i 9.9 deg)
- Albedo term: pV 0.223 ± 0.11 dex (catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0))
- Population model: 139025 catalogue diameters, 1470 classified objects; the object's own catalogue rows excluded from training

| Complex | Relative probability | Spectrum only |
|---|---|---|
| X-complex | 41.7% | 34.5% |
| L-type | 23.7% | 3.1% |
| C-complex | 12.8% | 53.4% |
| T-type | 11.4% | 5.9% |
| K-type | 8.1% | 1.8% |
| S-complex | 2.1% | 0.8% |

- Relative probabilities among the 25 Bus-DeMeo reference classes, from the spectral deviance (errors scaled by the best-fit reduced chi-square) and, when listed below, a population, orbit and albedo prior. They do not give the probability that a mineral is present.
- No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.
- Reference class means end at 2.45 um; features beyond are analysed separately (band analysis).
- Spectra normalised at 1.2 um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.
- Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not probabilities that specific minerals are present.
- Errors: photometric noise plus visit-correlated normalisation error (full covariance).
- Classes without published intra-class sigma (Cg, O, R) use the median shape sigma of all classes and the upper slope tolerance.
- Class probabilities include a prior: tempered population frequency of the complexes and their frequency at this orbit, and the albedo likelihood (pV 0.223, catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)). The spectral-only ranking is kept separately.
- The classification depends on the rotational-lightcurve model: with the correction scaled by 1 -/+ 0.10, or with the BIC runner-up number of harmonics, the most probable complex becomes S-complex.
- The classification is not stable against leaving out single visits: 1 of 22 leave-one-visit-out samples give L-type instead of X-complex.

## Mineral Candidates and Absorption Features

| Feature | Status | Centre (um) | Depth | Min. detectable depth (3 sigma) | Evidence / reason |
|---|---|---|---|---|---|
| Band I | NOT_DETECTED | 1.186 ± 1.656 | 0.077 ± 0.076 | 0.083 | not detected; a typical band-bearing asteroid would be detectable here |
| Band II | NOT_DETECTED | 2.284 ± 0.166 | 0.229 ± 0.137 | 0.199 | not detected; data not sensitive enough to detect a typical band |
| 3-um region | NOT_EVALUABLE | N/A | N/A | N/A | thermal emission was not removed |

| Mineral candidate | Evidence | Confidence |
|---|---|---|
| Unknown | Featureless spectrum; albedo needed to discriminate carbonaceous vs metal-rich vs other | None |

## Absolute Magnitude H

- Status: CATALOG
- H (mag): 6.740 (uncertainty not provided)
- G: N/A
- Source: JPL SBDB MPO980522
- Method: H-G (catalog)
  - ⚠ SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term and is a lower bound.
  - ⚠ SBDB gives no G; G=0.15 convention implied by the catalogue H.

## Diameter

- Status: Insufficient Data
- Diameter (km): N/A
- Conditional range (no H): N/A
- Catalogue diameter (km): 126.4 ± 3.4 (IRAS-A-FPA-3-RDR-IMPS-V6.0)
- Difference: N/A km (N/A sigma)
- Confidence: None
- Beaming-parameter prior: NEOWISE mainbelt population at alpha 16.9 deg, x1.12 for 3.5-5 um: eta 0.99 at 100 km, 1.04 at 10 km (sigma ln eta 0.15-0.19)
- Points in the thermal likelihood: 182 (5 normalisation group(s), 51 of 53 visits with a shared brightness error)
- Thermal signal in the likelihood (sigma): 10.2 — Beaming parameter eta (posterior median, 68%): 1.01 (0.88-1.17)
  - ⚠ Unexplained scatter: likelihood widened by chi2_red = 4.5.

### Combined diameter (SPHEREx thermal likelihood x population albedo prior)

- Combined diameter: 112 km (68%: 93.98-135.5; 95%: 81.11-163.9) — best estimate of D; it uses the population albedo prior, so no albedo is derived from it
- Best diameter: 112 km (68%: 93.98-135.5) — combined (SPHEREx thermal + albedo prior)

### Statistical diameter (H + albedo prior)

- Statistical diameter: 232.4 km (68%: 166.8-320.5 km; 95%: 119.4-432.5 km) — Confidence: Low
- Prior albedo of the same draws: 0.066 (68%: 0.035-0.128) — population prior, not a measurement
- 95% upper limit on D from the SPHEREx thermal test: 133.2 km
- Method: D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities without albedo, orbit regression); complex drawn from the SPHEREx classification
- Complex weights (classification without albedo): C-complex 48%, X-complex 30%, T-type 10%, L-type 7%, K-type 4%, D-type 1%

## Geometric Albedo

- Status: Not estimable from available data
- Geometric albedo pV (V band): N/A
- Method: pV = (1329 10^(-H/5) / D)^2
- H: 6.740 (uncertainty not provided) — JPL SBDB
- D: N/A km — N/A
- Correlation: N/A
- Missing inputs: diameter (Insufficient Data)

## Mass and Density

- Mass (kg): N/A —  
- Status: Unknown (Mass unknown)
- Bulk density (kg/m^3): N/A
- Shape assumption: N/A — 

## Missing Data

- diameter
- geometric albedo
- mass

## Data Sources and Provenance

```json
[
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"92\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:48:02+00:00",
  "version": "orbit_id=136; soln_date=2026-06-05 03:08:37",
  "identifier": "20000092",
  "origin": "OBSERVED"
 },
 {
  "name": "JPL SBDB",
  "url": "https://ssd-api.jpl.nasa.gov/sbdb.api",
  "query": "{\"sstr\": \"92\", \"phys-par\": \"1\", \"full-prec\": \"1\"}",
  "retrieved_utc": "2026-11-15T02:48:02+00:00",
  "version": "orbit_id=136; soln_date=2026-06-05 03:08:37",
  "identifier": "20000092",
  "origin": "OBSERVED"
 }
]
```
