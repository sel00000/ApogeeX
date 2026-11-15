# Taxonomy Validation: 579 Sidonia

- Reference taxonomy: K (K-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: K; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): K; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **FAIL** | A typical band would be detectable with these data, but none was detected. |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> X-complex. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 15.42 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex K-type (38.7%), reference K-type at rank 1; reference best by deviance; gap to the next complex L-type: 0.3 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class K; reference class first; gap to the next class L: 0.3 (distinguished at >= 10). |

**Summary:** PASS 5, FAIL 1, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.109549626459297,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.1918587282490388,
 "thermal_status": "OK",
 "thermal_chi2_red": 2.7616012558182264,
 "diameter_km": 87.99177729647373,
 "diameter_err_km": 17.151825839716246,
 "taxonomy_top_class": "K",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "K-type",
   38.75
  ],
  [
   "L-type",
   34.19
  ],
  [
   "X-complex",
   17.39
  ],
  [
   "C-complex",
   5.2
  ],
  [
   "T-type",
   2.94
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   39.03
  ],
  [
   "X-complex",
   35.35
  ],
  [
   "L-type",
   10.38
  ],
  [
   "T-type",
   6.4
  ],
  [
   "K-type",
   5.42
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.15080192935084805,
   "log10_pv": -0.8215931020931222,
   "sigma_log10": 0.11879914978037115,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 99.55002485833688,
 "statistical_diameter_68_km": [
  76.72071694930233,
  140.22036471250246
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/579/stage2_spectrum.csv"
}
```