# Taxonomy Validation: 308 Polyxo

- Reference taxonomy: T (T-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: T; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): T; JPL SBDB spec_T (Tholen): T

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; a typical band-bearing asteroid would be detectable here. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 28.87 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex T-type (69.9%), reference T-type at rank 1; reference best by deviance; gap to the next complex D-type: 2.2 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class T; reference class first; gap to the next class D: 2.2 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10994523655923705,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.014464413374551904,
 "thermal_status": "OK",
 "thermal_chi2_red": 3.8026418158673865,
 "diameter_km": 155.69774006507112,
 "diameter_err_km": 35.65008043101099,
 "taxonomy_top_class": "T",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "T-type",
   69.89
  ],
  [
   "D-type",
   23.69
  ],
  [
   "X-complex",
   6.24
  ],
  [
   "C-complex",
   0.15
  ],
  [
   "L-type",
   0.03
  ]
 ],
 "complex_ranking_spectral": [
  [
   "T-type",
   55.3
  ],
  [
   "D-type",
   32.48
  ],
  [
   "X-complex",
   12.01
  ],
  [
   "C-complex",
   0.16
  ],
  [
   "L-type",
   0.05
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.05763902550171561,
   "log10_pv": -1.2392833703772221,
   "sigma_log10": 0.13361619174083406,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 121.41950090931205,
 "statistical_diameter_68_km": [
  93.37885225750206,
  158.85992575874027
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/308/stage2_spectrum.csv"
}
```