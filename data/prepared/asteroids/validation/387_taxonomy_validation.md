# Taxonomy Validation: 387 Aquitania

- Reference taxonomy: L (L-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: L; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): L; JPL SBDB spec_T (Tholen): S

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 19 visits over 12.36 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex L-type (56.1%), reference L-type at rank 1; reference best by deviance; gap to the next complex X-complex: 1.3 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class L; reference class first; gap to the next class Xc: 2.6 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.10798721644990028,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.03519412266105774,
 "thermal_status": "OK",
 "thermal_chi2_red": 7.856874252683212,
 "diameter_km": 108.84077525582379,
 "diameter_err_km": 21.996967295989442,
 "taxonomy_top_class": "L",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "L-type",
   56.08
  ],
  [
   "X-complex",
   29.78
  ],
  [
   "C-complex",
   5.64
  ],
  [
   "K-type",
   4.69
  ],
  [
   "T-type",
   3.58
  ]
 ],
 "complex_ranking_spectral": [
  [
   "X-complex",
   40.23
  ],
  [
   "C-complex",
   39.23
  ],
  [
   "L-type",
   12.2
  ],
  [
   "T-type",
   6.92
  ],
  [
   "K-type",
   1.14
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.17645396268870253,
   "log10_pv": -0.7533685840905656,
   "sigma_log10": 0.10503254149054037,
   "source": "catalogue diameter with current H (IRAS-A-FPA-3-RDR-IMPS-V6.0)"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 153.88567603961084,
 "statistical_diameter_68_km": [
  111.3335536567884,
  219.9042691912637
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/387/stage2_spectrum.csv"
}
```