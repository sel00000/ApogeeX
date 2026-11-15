# Taxonomy Validation: 64 Angelina

- Reference taxonomy: Xe (X-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Xe; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): Xe; JPL SBDB spec_T (Tholen): E

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Reference class has no 1-um band: no band claimed (correct). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **PASS** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->Q-type; D template -> D-type. |
| C4 Observation-time differences detected | **PASS** | 18 visits over 163.20 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability tested. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'season_offsets' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'season_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex L-type (51.6%), reference X-complex at rank 2; reference behind L-type by 0.9 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class L; reference class Xe at rank 5, behind L by 5.0 (distinguished at >= 10). |

**Summary:** PASS 7, FAIL 0, INCONCLUSIVE 2

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11070533698387042,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "season_offsets",
 "norm_groups": 1,
 "slope_sys_per_um": 0.04035308448942668,
 "thermal_status": "INSUFFICIENT_THERMAL",
 "thermal_chi2_red": null,
 "diameter_km": null,
 "diameter_err_km": null,
 "taxonomy_top_class": "L",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "L-type",
   51.56
  ],
  [
   "X-complex",
   33.16
  ],
  [
   "C-complex",
   7.16
  ],
  [
   "K-type",
   4.07
  ],
  [
   "S-complex",
   3.97
  ]
 ],
 "complex_ranking_spectral": [
  [
   "X-complex",
   41.51
  ],
  [
   "C-complex",
   32.93
  ],
  [
   "L-type",
   19.98
  ],
  [
   "K-type",
   3.02
  ],
  [
   "S-complex",
   1.7
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.4244553866086442,
   "log10_pv": -0.37216795057408086,
   "sigma_log10": 0.11466866333998108,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 120.35861660615728,
 "statistical_diameter_68_km": [
  90.98468113994453,
  171.8640601785778
 ],
 "thermal_upper_limit_km": 47.19959021058409,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/64/stage2_spectrum.csv"
}
```