# Taxonomy Validation: 433 Eros

- Reference taxonomy: S (S-complex) — JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): S; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **FAIL** | A typical band would be detectable with these data, but none was detected. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 24 visits over 14.33 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Not scored - saturation-limited spectrum (38% of points saturated, limit 20%). Most probable complex R-type (63.7%), reference S-complex at rank 2; reference behind the first by 1.9 (distinguished at >= 4); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |

**Summary:** PASS 6, FAIL 1, INCONCLUSIVE 1

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.12202729562802173,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.05254138272513945,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.0951018919424462,
 "diameter_km": 12.54962225060708,
 "diameter_err_km": 1.686365184901011,
 "taxonomy_top_class": "R",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "R-type",
   63.74
  ],
  [
   "S-complex",
   34.59
  ],
  [
   "V-type",
   1.64
  ],
  [
   "Q-type",
   0.01
  ],
  [
   "D-type",
   0.01
  ]
 ]
}
```