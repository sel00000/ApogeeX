# Taxonomy Validation: 236 Honoria

- Reference taxonomy: L (L-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: L; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): L; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **INCONCLUSIVE** | Band II not evaluable: band shoulders and centre not observed within one normalisation group. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> T-type. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 22 visits over 15.42 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'visit_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex K-type (41.2%), reference L-type at rank 2; reference behind K-type by 0.9 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class K; reference class L at rank 2, behind K by 0.9 (distinguished at >= 10). |

**Summary:** PASS 5, FAIL 0, INCONCLUSIVE 4

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.12120113783772957,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "visit_offsets",
 "norm_groups": 11,
 "slope_sys_per_um": 0.002289740967574337,
 "thermal_status": "OK",
 "thermal_chi2_red": 2.799013339516798,
 "diameter_km": 72.14360313263883,
 "diameter_err_km": 11.622125381255259,
 "taxonomy_top_class": "K",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "K-type",
   41.22
  ],
  [
   "L-type",
   26.19
  ],
  [
   "S-complex",
   22.54
  ],
  [
   "X-complex",
   4.66
  ],
  [
   "C-complex",
   3.11
  ]
 ],
 "complex_ranking_spectral": [
  [
   "S-complex",
   29.16
  ],
  [
   "C-complex",
   25.36
  ],
  [
   "K-type",
   17.55
  ],
  [
   "X-complex",
   11.94
  ],
  [
   "L-type",
   11.21
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.15492392769944768,
   "log10_pv": -0.8098815011219624,
   "sigma_log10": 0.1000451729673259,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 86.34554295359152,
 "statistical_diameter_68_km": [
  67.0220412367155,
  121.53526741173809
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/236/stage2_spectrum.csv"
}
```