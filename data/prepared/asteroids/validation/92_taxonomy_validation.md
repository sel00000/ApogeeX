# Taxonomy Validation: 92 Undina

- Reference taxonomy: Xk (X-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Xk; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): Xc; JPL SBDB spec_T (Tholen): X

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 22 visits over 295.15 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex X-complex (41.7%), reference X-complex at rank 1; reference best by deviance; gap to the next complex L-type: 1.1 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class L; reference class Xk at rank 4, behind L by 2.0 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10551661470178098,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.07887855052269496,
 "thermal_status": "Insufficient Data",
 "thermal_chi2_red": null,
 "diameter_km": null,
 "diameter_err_km": null,
 "taxonomy_top_class": "X-complex (subclass not determined: Xc 15%, Xk 9%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "X-complex",
   41.66
  ],
  [
   "L-type",
   23.66
  ],
  [
   "C-complex",
   12.81
  ],
  [
   "T-type",
   11.4
  ],
  [
   "K-type",
   8.07
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   53.45
  ],
  [
   "X-complex",
   34.48
  ],
  [
   "T-type",
   5.91
  ],
  [
   "L-type",
   3.09
  ],
  [
   "K-type",
   1.85
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.22254528113243538,
   "log10_pv": -0.6525816100980238,
   "sigma_log10": 0.1127500021973362,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 232.35126877906225,
 "statistical_diameter_68_km": [
  166.7754979719303,
  320.52557206130024
 ],
 "thermal_upper_limit_km": 133.16594886707242,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/92/stage2_spectrum.csv"
}
```