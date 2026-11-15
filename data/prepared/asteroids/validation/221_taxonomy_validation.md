# Taxonomy Validation: 221 Eos

- Reference taxonomy: K (K-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: K; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): K; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **INCONCLUSIVE** | Data not sensitive enough or region not covered: band shoulders and centre not observed within one normalisation group. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> C-complex. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 21 visits over 22.62 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'visit_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex K-type (48.8%), reference K-type at rank 1; reference best by deviance; gap to the next complex L-type: 1.4 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class K; reference class first; gap to the next class L: 1.4 (distinguished at >= 10). |

**Summary:** PASS 5, FAIL 0, INCONCLUSIVE 4

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10979016361359384,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "visit_offsets",
 "norm_groups": 5,
 "slope_sys_per_um": 0.002289740967574337,
 "thermal_status": "OK",
 "thermal_chi2_red": 6.785345711349608,
 "diameter_km": 112.53446740259744,
 "diameter_err_km": 23.261752370889397,
 "taxonomy_top_class": "K",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "K-type",
   48.83
  ],
  [
   "L-type",
   24.79
  ],
  [
   "X-complex",
   14.28
  ],
  [
   "C-complex",
   4.96
  ],
  [
   "T-type",
   3.36
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   42.18
  ],
  [
   "X-complex",
   31.94
  ],
  [
   "T-type",
   7.47
  ],
  [
   "L-type",
   6.69
  ],
  [
   "K-type",
   5.97
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.1597074644682901,
   "log10_pv": -0.796674785166277,
   "sigma_log10": 0.10139854453126938,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 115.46220648847878,
 "statistical_diameter_68_km": [
  89.35392604948703,
  162.24157398993842
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/221/stage2_spectrum.csv"
}
```