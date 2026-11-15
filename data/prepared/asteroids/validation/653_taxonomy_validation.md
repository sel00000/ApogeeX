# Taxonomy Validation: 653 Berenike

- Reference taxonomy: K (K-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: K; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): K; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **FAIL** | A typical band would be detectable with these data, but none was detected. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 18 visits over 11.41 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex K-type (81.9%), reference K-type at rank 1; reference best by deviance; gap to the next complex L-type: 3.9 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class K; reference class first; gap to the next class L: 3.9 (distinguished at >= 10). |

**Summary:** PASS 6, FAIL 1, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10798750161611315,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.021223668756447225,
 "thermal_status": "OK",
 "thermal_chi2_red": 3.6771444405230107,
 "diameter_km": 45.47753225972469,
 "diameter_err_km": 9.111047720029369,
 "taxonomy_top_class": "K",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "K-type",
   81.92
  ],
  [
   "L-type",
   11.79
  ],
  [
   "X-complex",
   2.72
  ],
  [
   "C-complex",
   2.05
  ],
  [
   "S-complex",
   1.45
  ]
 ],
 "complex_ranking_spectral": [
  [
   "K-type",
   30.93
  ],
  [
   "C-complex",
   26.5
  ],
  [
   "X-complex",
   15.9
  ],
  [
   "L-type",
   15.3
  ],
  [
   "S-complex",
   10.8
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.12963234453470124,
   "log10_pv": -0.887286624234281,
   "sigma_log10": 0.2087986001381589,
   "source": "catalogue diameter with current H; catalogue albedo 0.085 disagrees by +0.18 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 49.96218005100656,
 "statistical_diameter_68_km": [
  41.942402940579036,
  60.41895376004373
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/653/stage2_spectrum.csv"
}
```