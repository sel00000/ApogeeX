# Taxonomy Validation: 246 Asporina

- Reference taxonomy: A (A-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: A; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): A; JPL SBDB spec_T (Tholen): A

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Band I detected (full_band) at 1.091 um. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 22 visits over 11.68 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Medium (classifier; reported High); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **PASS** | Most probable complex A-type (99.5%), reference A-type at rank 1; reference best by deviance; gap to the next complex S-complex: 10.4 (distinguished at >= 6); confidence High. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **PASS** | Most probable class A; reference class first; gap to the next class Sa: 10.4 (distinguished at >= 10). |

**Summary:** PASS 9, FAIL 0, INCONCLUSIVE 0

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.09317368448620522,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.022735262870554985,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.7139653832350867,
 "diameter_km": 57.68148396275851,
 "diameter_err_km": 10.79304018959187,
 "taxonomy_top_class": "A",
 "taxonomy_confidence": "High",
 "complex_ranking": [
  [
   "A-type",
   99.46
  ],
  [
   "S-complex",
   0.54
  ],
  [
   "Q-type",
   0.0
  ],
  [
   "C-complex",
   0.0
  ],
  [
   "O-type",
   0.0
  ]
 ],
 "complex_ranking_spectral": [
  [
   "A-type",
   98.44
  ],
  [
   "S-complex",
   1.56
  ],
  [
   "Q-type",
   0.0
  ],
  [
   "C-complex",
   0.0
  ],
  [
   "O-type",
   0.0
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.24309050304053906,
   "log10_pv": -0.6142320076628526,
   "sigma_log10": 0.141570410232294,
   "source": "catalogue diameter with current H; catalogue albedo 0.193 disagrees by +0.10 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 55.42709842462619,
 "statistical_diameter_68_km": [
  47.784394992023785,
  64.53488925625939
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/246/stage2_spectrum.csv"
}
```