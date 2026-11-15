# Taxonomy Validation: 764 Gedania (A913 SF)

- Reference taxonomy: C (C-complex) — JPL SBDB spec_T (Tholen): C

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 24 visits over 14.95 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'none' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'none'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex C-complex (28.9%), reference C-complex at rank 1; reference best by deviance; gap to the next complex X-complex: 0.3 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class T; reference class C at rank 10, behind T by 2.4 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.12192792041072953,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "none",
 "norm_groups": 1,
 "slope_sys_per_um": 0.04670115469435515,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.074634126547742,
 "diameter_km": 77.63184671311646,
 "diameter_err_km": 17.784852073990926,
 "taxonomy_top_class": "C-complex (subclass not determined: Ch 6%, Cg 5%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "C-complex",
   28.93
  ],
  [
   "X-complex",
   25.27
  ],
  [
   "T-type",
   18.13
  ],
  [
   "K-type",
   13.16
  ],
  [
   "L-type",
   7.73
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   33.98
  ],
  [
   "X-complex",
   28.58
  ],
  [
   "S-complex",
   13.36
  ],
  [
   "K-type",
   6.47
  ],
  [
   "L-type",
   6.24
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.07047107162533424,
   "log10_pv": -1.151989124310441,
   "sigma_log10": 0.1048143328404217,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 53.11057665532728,
 "statistical_diameter_68_km": [
  39.45808659655972,
  76.91923711098778
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/A913_SF/stage2_spectrum.csv"
}
```