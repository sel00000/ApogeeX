# Taxonomy Validation: 216 Kleopatra

- Reference taxonomy: Xe (X-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Xe; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): Xe; JPL SBDB spec_T (Tholen): M

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> X-complex. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 21 visits over 284.05 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex L-type (26.1%), reference X-complex at rank 4; reference behind L-type by 1.1 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class L; reference class Xe at rank 6, behind L by 3.8 (distinguished at >= 10). |

**Summary:** PASS 6, FAIL 0, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.12049046085358195,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.11854609439210168,
 "thermal_status": "OK",
 "thermal_chi2_red": 2.674714348294216,
 "diameter_km": 131.4714698426961,
 "diameter_err_km": 24.78415240222383,
 "taxonomy_top_class": "L",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "L-type",
   26.13
  ],
  [
   "S-complex",
   25.82
  ],
  [
   "K-type",
   18.11
  ],
  [
   "X-complex",
   14.96
  ],
  [
   "C-complex",
   4.83
  ]
 ],
 "complex_ranking_spectral": [
  [
   "S-complex",
   24.91
  ],
  [
   "X-complex",
   24.71
  ],
  [
   "C-complex",
   18.68
  ],
  [
   "L-type",
   8.69
  ],
  [
   "K-type",
   6.67
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.184641917033847,
   "log10_pv": -0.7336696994640324,
   "sigma_log10": 0.29286629936985736,
   "source": "catalogue diameter with current H; catalogue albedo 0.116 disagrees by +0.20 dex beyond the population offset (H revision?): uncertainty increased ([Shepard, M. K. et al. (2018) Icarus 311, 197-209])"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 148.16813437556831,
 "statistical_diameter_68_km": [
  112.27690424525693,
  215.1085299374501
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/216/stage2_spectrum.csv"
}
```