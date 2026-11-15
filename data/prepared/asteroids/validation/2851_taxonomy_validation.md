# Taxonomy Validation: 2851 Harbin

- Reference taxonomy: V (V-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: V; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): V

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Band I detected (within_segment) at 0.906 um (sensitivity marginal). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 9.99 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'none' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'none'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence High (classifier; reported High); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **PASS** | Most probable complex V-type (100.0%), reference V-type at rank 1; reference best by deviance; gap to the next complex R-type: 18.6 (distinguished at >= 6); confidence High. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **PASS** | Most probable class V; reference class first; gap to the next class R: 18.6 (distinguished at >= 10). |

**Summary:** PASS 9, FAIL 0, INCONCLUSIVE 0

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.09443843867842405,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "none",
 "norm_groups": 1,
 "slope_sys_per_um": 0.07044369070267807,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.986101783303196,
 "diameter_km": 9.361685419386415,
 "diameter_err_km": 1.949845052915272,
 "taxonomy_top_class": "V",
 "taxonomy_confidence": "High",
 "complex_ranking": [
  [
   "V-type",
   99.99
  ],
  [
   "R-type",
   0.01
  ],
  [
   "S-complex",
   0.0
  ],
  [
   "Q-type",
   0.0
  ],
  [
   "D-type",
   0.0
  ]
 ],
 "complex_ranking_spectral": [
  [
   "V-type",
   99.98
  ],
  [
   "R-type",
   0.02
  ],
  [
   "S-complex",
   0.01
  ],
  [
   "Q-type",
   0.0
  ],
  [
   "D-type",
   0.0
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.2434119902873142,
   "log10_pv": -0.6136580325670848,
   "sigma_log10": 0.1951153672100948,
   "source": "catalogue diameter with current H; catalogue albedo 0.358 disagrees by -0.17 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 8.64543773591538,
 "statistical_diameter_68_km": [
  7.474667625238889,
  10.03729975124032
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/2851/stage2_spectrum.csv"
}
```