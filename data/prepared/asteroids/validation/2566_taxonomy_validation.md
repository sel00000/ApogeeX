# Taxonomy Validation: 2566 Kirghizia

- Reference taxonomy: V (V-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: V; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): V

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Band I detected (full_band, within_segment) at 0.927 um. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: DETECTED; detected by within_segment. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 14.06 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence High (classifier; reported High); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **PASS** | Most probable complex V-type (100.0%), reference V-type at rank 1; reference best by deviance; gap to the next complex R-type: 35.6 (distinguished at >= 6); confidence High. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **PASS** | Most probable class V; reference class first; gap to the next class R: 35.6 (distinguished at >= 10). |

**Summary:** PASS 9, FAIL 0, INCONCLUSIVE 0

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.110425836410315,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.04295526326547341,
 "thermal_status": "INSUFFICIENT_THERMAL",
 "thermal_chi2_red": null,
 "diameter_km": null,
 "diameter_err_km": null,
 "taxonomy_top_class": "V",
 "taxonomy_confidence": "High",
 "complex_ranking": [
  [
   "V-type",
   100.0
  ],
  [
   "R-type",
   0.0
  ],
  [
   "S-complex",
   0.0
  ],
  [
   "C-complex",
   0.0
  ],
  [
   "X-complex",
   0.0
  ]
 ],
 "complex_ranking_spectral": [
  [
   "V-type",
   100.0
  ],
  [
   "R-type",
   0.0
  ],
  [
   "C-complex",
   0.0
  ],
  [
   "S-complex",
   0.0
  ],
  [
   "X-complex",
   0.0
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.3055489956124699,
   "log10_pv": -0.5149191395359692,
   "sigma_log10": 0.11844543511052859,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2011ApJ...741...68M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 8.39231835672049,
 "statistical_diameter_68_km": [
  7.255830020917642,
  9.743435362675552
 ],
 "thermal_upper_limit_km": 7.0223811490878365,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/2566/stage2_spectrum.csv"
}
```