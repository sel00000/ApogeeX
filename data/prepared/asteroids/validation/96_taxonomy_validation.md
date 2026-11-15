# Taxonomy Validation: 96 Aegle

- Reference taxonomy: T (T-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: T; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): T; JPL SBDB spec_T (Tholen): T

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **INCONCLUSIVE** | Band II not evaluable: band shoulders and centre not observed within one normalisation group. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> T-type. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 19 visits over 12.70 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **FAIL** | Most probable complex C-complex (64.1%), reference T-type at rank 5; reference behind C-complex by 6.1 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class Ch; reference class T at rank 14, behind Ch by 3.1 (distinguished at >= 10). |

**Summary:** PASS 5, FAIL 1, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10746078279007043,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.17033112981235385,
 "thermal_status": "OK",
 "thermal_chi2_red": 4.4630094009444425,
 "diameter_km": 181.0999063799103,
 "diameter_err_km": 43.656207045670996,
 "taxonomy_top_class": "C-complex (subclass not determined: Ch 14%, Cgh 13%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "C-complex",
   64.07
  ],
  [
   "X-complex",
   19.13
  ],
  [
   "D-type",
   7.58
  ],
  [
   "L-type",
   5.16
  ],
  [
   "T-type",
   3.0
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   37.55
  ],
  [
   "X-complex",
   31.95
  ],
  [
   "L-type",
   9.85
  ],
  [
   "S-complex",
   9.76
  ],
  [
   "K-type",
   5.17
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.04822957924631782,
   "log10_pv": -1.316686526836141,
   "sigma_log10": 0.10002146850132823,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 135.30853763702032,
 "statistical_diameter_68_km": [
  100.00934246353376,
  196.42838238540173
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/96/stage2_spectrum.csv"
}
```