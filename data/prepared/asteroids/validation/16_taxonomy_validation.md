# Taxonomy Validation: 16 Psyche

- Reference taxonomy: Xk (X-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Xk; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): X; JPL SBDB spec_T (Tholen): M

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 21 visits over 12.36 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'none' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'none'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Not scored - saturation-limited spectrum (93% of points saturated, limit 20%). Most probable complex T-type (28.9%), reference X-complex at rank 2; reference behind T-type by 0.3 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Not scored - saturation-limited spectrum (93% of points saturated). Most probable class T; reference class Xk at rank 4, behind T by 1.8 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11810290152317715,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "none",
 "norm_groups": 1,
 "slope_sys_per_um": 0.04601098494610143,
 "thermal_status": "OK",
 "thermal_chi2_red": 10.734653968594932,
 "diameter_km": 259.461225779431,
 "diameter_err_km": 54.492353764483795,
 "taxonomy_top_class": "T",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "T-type",
   28.91
  ],
  [
   "X-complex",
   24.64
  ],
  [
   "K-type",
   16.51
  ],
  [
   "L-type",
   13.59
  ],
  [
   "C-complex",
   12.87
  ]
 ],
 "complex_ranking_spectral": [
  [
   "X-complex",
   35.01
  ],
  [
   "C-complex",
   34.38
  ],
  [
   "T-type",
   20.79
  ],
  [
   "L-type",
   3.52
  ],
  [
   "D-type",
   2.5
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.11867083904279954,
   "log10_pv": -0.9256559870158132,
   "sigma_log10": 0.10017517415296634,
   "source": "catalogue diameter with current H (Shepard et al. (2021), The Planetary Science Journal 2, 125)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 258.4857360767316,
 "statistical_diameter_68_km": [
  188.6634320406335,
  355.8461181915625
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/16/stage2_spectrum.csv"
}
```