# Taxonomy Validation: 624 Hektor

- Reference taxonomy: D (D-type) — JPL SBDB spec_T (Tholen): D (not in DeMeo et al. 2009)

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 21 visits over 247.28 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'season_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'season_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex D-type (74.2%), reference D-type at rank 1; reference best by deviance; gap to the next complex T-type: 3.1 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class D; reference class first; gap to the next class T: 3.1 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.09225258603880104,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "season_offsets",
 "norm_groups": 1,
 "slope_sys_per_um": 0.0866489679069862,
 "thermal_status": "INSUFFICIENT_THERMAL",
 "thermal_chi2_red": null,
 "diameter_km": null,
 "diameter_err_km": null,
 "taxonomy_top_class": "D",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "D-type",
   74.17
  ],
  [
   "T-type",
   15.47
  ],
  [
   "X-complex",
   7.1
  ],
  [
   "C-complex",
   2.56
  ],
  [
   "L-type",
   0.61
  ]
 ],
 "complex_ranking_spectral": [
  [
   "D-type",
   41.86
  ],
  [
   "T-type",
   24.9
  ],
  [
   "X-complex",
   18.74
  ],
  [
   "S-complex",
   8.68
  ],
  [
   "C-complex",
   4.01
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.04117986567573624,
   "log10_pv": -1.3853150743372609,
   "sigma_log10": 0.23870140142300392,
   "source": "catalogue diameter with current H; catalogue albedo 0.025 disagrees by +0.22 dex beyond the population offset (H revision?): uncertainty increased (J.G. Williams 9-90)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 187.126488781358,
 "statistical_diameter_68_km": [
  140.48484427818397,
  246.59177555654463
 ],
 "thermal_upper_limit_km": 227.60989584341988,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/624/stage2_spectrum.csv"
}
```