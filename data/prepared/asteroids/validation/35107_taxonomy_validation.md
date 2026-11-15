# Taxonomy Validation: 35107 (1991 VH)

- Reference taxonomy: Sq (S-complex) — DeMeo et al. 2009 (Bus-DeMeo, 0.45-2.45 um), Appendix: Sq; JPL SBDB spec_B (SMASSII, Bus & Binzel 2002): Sk (S-complex)

| Criterion | Result | Explanation |
|---|---|---|
| C1 1-um band detected when supported by the data | **PASS** | Band I detected (within_segment) at 0.984 um (sensitivity marginal). |
| C2 2-um band evaluated | **PASS** | Band II evaluated: NOT_DETECTED; not detected; data not sensitive enough to detect a typical band. |
| C3 Red slope alone does not cause D-type | **INCONCLUSIVE** | Observed spectrum: no D-type driven by slope. Counterfactual: band-bearing templates reddened to D-like slope classified as S->S-complex, Sq->S-complex, Sr->S-complex, V->V-type, Q->S-complex; D template -> S-complex. The D-type control is not recovered with this sampling, so the test cannot be made. |
| C4 Observation-time differences detected | **PASS** | 24 visits over 57.61 d detected; segments never observed together: B1-B2, B2-B3, B3-B4, B4-B5, B5-B6; variability detected. |
| C5 No unsupported rotational correction | **PASS** | Applied correction 'periodic_lightcurve' meets the support criteria; without repeated observations: 'none' (no repeated observations: a rotational correction cannot be constrained); without rotation period: 'visit_offsets'. |
| C6 Confidence decreases when S vs D is not distinguishable | **PASS** | Baseline confidence Low (classifier; reported Low); without the 1-um region -> Low; with errors x4 -> Low. |
| C7 Most probable complex matches the reference | **INCONCLUSIVE** | Most probable complex V-type (49.7%), reference S-complex at rank 2; reference behind V-type by 2.3 (distinguished at >= 6); confidence Low. |
| C8 No target-specific information in the classifier | **PASS** | No target names, reference taxonomies or validation files in the analysis/classification code. |
| C9 Most probable class matches the reference class | **INCONCLUSIVE** | Most probable class V; reference class Sq at rank 8, behind V by 5.6 (distinguished at >= 10). |

**Summary:** PASS 6, FAIL 0, INCONCLUSIVE 3

## Analysis summary

```json
{
 "solar_analog_calibration": {
  "applied": true,
  "reason": null,
  "n_stars": 14,
  "max_abs_correction": 0.11898662610715971,
  "slope_sigma_per_um": {
   "SWIR": 0.002289740967574337,
   "MWIR": 0.001413917081249607
  }
 },
 "temporal_correction": "periodic_lightcurve",
 "norm_groups": 1,
 "slope_sys_per_um": 0.162752769439721,
 "thermal_status": "OK",
 "thermal_chi2_red": 2.4930939422320337,
 "diameter_km": 1.0979467121697943,
 "diameter_err_km": 0.25451406639117685,
 "taxonomy_top_class": "V",
 "taxonomy_confidence": "Low",
 "complex_ranking": [
  [
   "V-type",
   49.69
  ],
  [
   "S-complex",
   15.69
  ],
  [
   "Q-type",
   11.56
  ],
  [
   "R-type",
   11.55
  ],
  [
   "O-type",
   7.08
  ]
 ],
 "complex_ranking_spectral": [
  [
   "S-complex",
   27.44
  ],
  [
   "V-type",
   16.85
  ],
  [
   "R-type",
   12.11
  ],
  [
   "O-type",
   10.32
  ],
  [
   "C-complex",
   8.74
  ]
 ],
 "prior": {
  "albedo": {
   "pV": 0.3689933453490096,
   "log10_pv": -0.4329814661018195,
   "sigma_log10": 0.1091081655904167,
   "source": "catalogue diameter with current H (urn:nasa:pds:neowise_diameters_albedos::2.0[neos] (http://adsabs.harvard.edu/abs/2016AJ....152...63N))"
  },
  "orbit_used": true
 },
 "statistical_diameter_km": 1.1983352423668445,
 "statistical_diameter_68_km": [
  0.9825698947788837,
  1.5391697987746291
 ],
 "thermal_upper_limit_km": null,
 "spectrum_file": "/mnt/c/Users/a0102/spherex/spherex-asteroid-analysis/outputs/35107/stage2_spectrum.csv"
}
```