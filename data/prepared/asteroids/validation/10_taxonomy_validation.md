# Taxonomy Validation: 10 Hygiea

- Reference taxonomy: C (C-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: C; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): C; JPL SBDB spec_T (Tholen): C

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; a typical band-bearing asteroid would be detectable here. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 21 visits over 11.08 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'none' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'none'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex C-complex (79.1%), reference C-complex at rank 1; reference best by deviance; gap to the next complex X-complex: 3.0 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class C; reference class first; gap to the next class Cb: 0.8 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11570281931571169,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "none",
 "norm_groups": 1,
 "slope_sys_per_um": 0.0531083391007361,
 "thermal_status": "OK",
 "thermal_chi2_red": 5.049288921502589,
 "diameter_km": 357.28066655744175,
 "diameter_err_km": 81.37286575665448,
 "taxonomy_top_class": "C-complex (subclass not determined: C 27%, Cb 18%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "C-complex",
   79.1
  ],
  [
   "X-complex",
   18.08
  ],
  [
   "T-type",
   1.28
  ],
  [
   "L-type",
   0.95
  ],
  [
   "K-type",
   0.57
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   60.39
  ],
  [
   "X-complex",
   36.28
  ],
  [
   "K-type",
   1.34
  ],
  [
   "L-type",
   1.31
  ],
  [
   "T-type",
   0.64
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.058560541801258637,
   "log10_pv": -1.2323949138450128,
   "sigma_log10": 0.13314985399279902,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 413.88400080439163,
 "statistical_diameter_68_km": [
  299.17101497691493,
  562.5877667942187
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/10/stage2_spectrum.csv"
}
```