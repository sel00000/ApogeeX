# Taxonomy Validation: 69 Hesperia

- Reference taxonomy: Xk (X-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Xk; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): X; JPL SBDB spec_T (Tholen): M

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 16.10 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex X-complex (43.6%), reference X-complex at rank 1; reference best by deviance; gap to the next complex T-type: 0.8 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class T; reference class Xk at rank 2, behind T by 0.8 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11330453061424972,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.02365888314281404,
 "thermal_status": "OK",
 "thermal_chi2_red": 3.05498642889171,
 "diameter_km": 92.69904748731892,
 "diameter_err_km": 15.541043805085472,
 "taxonomy_top_class": "X-complex (subclass not determined: Xk 20%, X 18%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "X-complex",
   43.59
  ],
  [
   "T-type",
   28.8
  ],
  [
   "L-type",
   13.53
  ],
  [
   "D-type",
   6.6
  ],
  [
   "C-complex",
   3.89
  ]
 ],
 "complex_ranking_spectral": [
  [
   "X-complex",
   54.11
  ],
  [
   "T-type",
   26.23
  ],
  [
   "C-complex",
   9.49
  ],
  [
   "D-type",
   3.58
  ],
  [
   "S-complex",
   3.57
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.12091326214791405,
   "log10_pv": -0.9175260617382694,
   "sigma_log10": 0.11887454212121379,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 165.31904872116627,
 "statistical_diameter_68_km": [
  116.51458782344501,
  231.9602254395031
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/69/stage2_spectrum.csv"
}
```