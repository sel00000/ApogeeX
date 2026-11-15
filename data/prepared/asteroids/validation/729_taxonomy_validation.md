# Taxonomy Validation: 729 Watsonia

- Reference taxonomy: L (L-type) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: L; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): L; JPL SBDB spec_T (Tholen): STGD

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **INCONCLUSIVE** | Band II not evaluable: band shoulders and centre not observed within one normalisation group. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 20 visits over 11.14 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'visit_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex X-complex (33.7%), reference L-type at rank 2; reference behind X-complex by 1.1 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class L; reference class first; gap to the next class T: 0.2 (distinguished at >= 10). |

**Summary:** PASS 6, FAIL 0, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11051042568219538,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "visit_offsets",
 "norm_groups": 4,
 "slope_sys_per_um": 0.002289740967574337,
 "thermal_status": "OK",
 "thermal_chi2_red": 1.5946284094893939,
 "diameter_km": 55.68111594970404,
 "diameter_err_km": 11.041084113357773,
 "taxonomy_top_class": "X-complex (subclass not determined: Xc 13%, Xk 11%)",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "X-complex",
   33.7
  ],
  [
   "L-type",
   19.44
  ],
  [
   "C-complex",
   18.59
  ],
  [
   "T-type",
   17.64
  ],
  [
   "K-type",
   9.35
  ]
 ],
 "complex_ranking_spectral": [
  [
   "C-complex",
   52.42
  ],
  [
   "X-complex",
   33.73
  ],
  [
   "T-type",
   6.35
  ],
  [
   "L-type",
   4.68
  ],
  [
   "K-type",
   1.71
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.10682570490863375,
   "log10_pv": -0.9713242327310343,
   "sigma_log10": 0.1380523340411183,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 61.51990031045109,
 "statistical_diameter_68_km": [
  44.17041714392315,
  86.14804032630659
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/729/stage2_spectrum.csv"
}
```