# Taxonomy Validation: 433 Eros

- Reference taxonomy: S (S-complex) — JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): S; JPL SBDB spec_T (Tholen): S; DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Sw (S with a high slope; class S)

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **INCONCLUSIVE** | Data not sensitive enough or region not covered: band shoulders and centre not observed within one normalisation group. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 31 visits over 24.66 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'visit_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex S-complex (82.8%), reference S-complex at rank 1; reference best by deviance; gap to the next complex Q-type: 4.2 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class Sq; reference class S at rank 2, behind Sq by 1.8 (distinguished at >= 10). |

**Summary:** PASS 6, FAIL 0, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.12364396377807285,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "visit_offsets",
 "norm_groups": 8,
 "slope_sys_per_um": 0.002289740967574337,
 "thermal_status": "OK",
 "thermal_chi2_red": 2.432437302796635,
 "diameter_km": 24.119451258988907,
 "diameter_err_km": 5.303588956508742,
 "taxonomy_top_class": "S-complex (subclass not determined: Sq 49%, S 20%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "S-complex",
   82.79
  ],
  [
   "Q-type",
   10.03
  ],
  [
   "A-type",
   4.13
  ],
  [
   "K-type",
   1.2
  ],
  [
   "X-complex",
   0.91
  ]
 ],
 "complex_ranking_spectral": [
  [
   "S-complex",
   80.97
  ],
  [
   "Q-type",
   5.91
  ],
  [
   "X-complex",
   4.19
  ],
  [
   "C-complex",
   3.21
  ],
  [
   "K-type",
   1.71
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.4308893772839075,
   "log10_pv": -0.36563421244179756,
   "sigma_log10": 0.25670439988813926,
   "source": "catalogue diameter with current H; catalogue albedo 0.250 disagrees by +0.24 dex beyond the population offset (H revision?): uncertainty increased (Yeomans et al. (2000) Science v.289,pp.2085-2088)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 23.645793643152466,
 "statistical_diameter_68_km": [
  20.081485795640592,
  28.27668833334885
 ],
 "thermal_upper_limit_km": null
}
```