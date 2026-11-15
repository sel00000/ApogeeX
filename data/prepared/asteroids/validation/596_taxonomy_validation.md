# Taxonomy Validation: 596 Scheila

- Reference taxonomy: T (T-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: T; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): T; JPL SBDB spec_T (Tholen): PCD

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; a typical band-bearing asteroid would be detectable here. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 10.46 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'none' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'none'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex C-complex (40.5%), reference T-type at rank 4; reference behind C-complex by 2.5 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class Cgh; reference class T at rank 4, behind Cgh by 0.8 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11089506498629276,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "none",
 "norm_groups": 1,
 "slope_sys_per_um": 0.05026016852835278,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.6738918975581982,
 "diameter_km": 97.05960510630896,
 "diameter_err_km": 14.75606151623849,
 "taxonomy_top_class": "C-complex (subclass not determined: Cgh 18%, Ch 15%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "C-complex",
   40.54
  ],
  [
   "X-complex",
   28.73
  ],
  [
   "D-type",
   15.14
  ],
  [
   "T-type",
   11.79
  ],
  [
   "L-type",
   3.2
  ]
 ],
 "complex_ranking_spectral": [
  [
   "X-complex",
   36.97
  ],
  [
   "C-complex",
   26.81
  ],
  [
   "T-type",
   21.23
  ],
  [
   "D-type",
   5.66
  ],
  [
   "L-type",
   4.82
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.01871969335201575,
   "log10_pv": -1.7277012697335021,
   "sigma_log10": 0.3445903209564184,
   "source": "catalogue diameter with current H; catalogue albedo 0.040 disagrees by -0.33 dex beyond the population offset (H revision?): uncertainty increased (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2012ApJ...759L...8M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 78.80983174815977,
 "statistical_diameter_68_km": [
  56.50474884448166,
  108.75000645693237
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/596/stage2_spectrum.csv"
}
```