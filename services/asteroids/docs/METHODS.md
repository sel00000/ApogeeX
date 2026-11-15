# Scientific methods, assumptions and limitations

## 1. Moving-object identification
Asteroid positions are predicted with JPL Horizons, using the SPHEREx spacecraft (−163182) as the
observer, at the mid-time of each exposure. Fixed-source catalogue matching is never used.
Predicted and measured positions are compared, and a match needs an offset below
`search.max_position_offset_arcsec` (12″, about 2 pixels).
Unidentified detections are labelled as follows:
- `Unmatched Candidate`: a single detection.
- `Uncatalogued Candidate`: linked into a linear-motion tracklet of at least 3 points.

Neither label is a discovery claim. Confirming either one needs follow-up astrometry and an orbit.

## 2. Spectral extraction
SPHEREx images through Linear Variable Filters, so each exposure gives one wavelength per detector
at the source position. The spectrum is assembled from many exposures.
- Background: sigma-clipped median in an annulus of 6–12 px. It removes zodiacal light and other
  smooth emission together.
- Flux: weighted least-squares amplitude of the zone-matched EPSF on a 7×7 stamp. The flux is
  F = A·Ω_pix, with Ω_pix from `OMEGA_MEDIAN`. Errors are scaled by √χ²_red when the PSF under-fits.
- The EPSF is an *effective* PSF (Anderson & King 2000), already integrated over the pixel. It is
  sampled at native-pixel centres with bicubic interpolation. An earlier version also summed
  5×5 sub-samples, which integrated over the pixel twice. On real DR1 data (433 Eros and field
  stars) that gave fluxes 5–15% low, with a band-dependent bias, and χ²_red of about 100. After
  the fix, PSF fluxes agree with r = 4 px aperture sums to 1–3%.
- Moving objects: the PSF is averaged along the trail during the exposure. Midpoint samples are
  spaced ≤ 0.1 px, using the Horizons rates and the MJD-BEG/END span.
- The SPHEREx `OUTLIER` flag ("Detect Outliers") is raised by the moving object itself, because it
  appears in only one of the overlapping exposures. On Eros it covers 49% of core pixels versus
  1.3% of background pixels. It is therefore ignored inside the PSF stamp, but still rejects
  pixels in the background annulus (`extraction.moving_object_flags`).
- Wavelength: the official CWAVE/CBAND calibration when configured. Otherwise the WCS-WAVE lookup,
  flagged `APPROX_LOOKUP`.
- Saturation: the SPHEREx PSF is undersampled (40–80% of the flux in the brightest pixel), and that
  pixel saturates for bright sources (`OVERFLOW`, `SUR_ERROR` or `NONLINEAR` in `FLAGS`). Saturated
  pixels are rejected, so the flux then comes from the unsaturated PSF wings. Each point records the
  FLAGS planes set in its PSF core (`core_flags`), and saturated points carry the reason "saturated
  PSF core"; extraction keeps them as WARN (`extraction.saturated_core_policy`).
  - Accuracy, measured on the calibration stars (same star and band, about the model fitted to the
    clean points): saturated points scatter by 7.0, 7.8, 5.9, 3.4, 2.8 and 3.2% rms in B1–B6, against
    2.2, 2.5, 3.1, 1.6, 2.1 and 2.8% for clean points, with star-dependent offsets of −15% to +5%.
  - Criterion (`temporal.saturated_points: inflated`, default): a saturated point is used in every
    step with that per-band scatter added to its error (`saturated_flux_error_frac_by_band`). It is
    not dropped, because dropping selects points by flux: a bright target loses its bright continuum
    points and its brightest rotational phases (433 Eros: lightcurve phase coverage 100% → 60%).
    Nominal errors (`all`) are not used: they understate the error of wing-only photometry about
    threefold and let these points set the brightness of whole segments.
  - Check: the classification is repeated without the saturated points; if the most probable
    complex changes, the confidence is Low (§4).
- Quality: GOOD, WARN (e.g. a SOURCE-flagged pixel in the core, trailing, approximate wavelength)
  or BAD. All reasons are stored.
- Limitations:
  - The median pixel solid angle is used, not a per-pixel map.
  - The PSF is resampled by nearest sub-sample (1/5 px).
  - Rotational lightcurve variation between exposures adds scatter, which the reduced-χ² scaling
    absorbs.

## 2b. Observation-time structure and brightness correction
A SPHEREx spectrum is assembled from many visits, each lasting minutes. In each exposure one SWIR
and one MWIR detector see the same field (D1+D4, D2+D5, D3+D6), so a visit samples one detector
family. The families are observed hours to days apart: for 433 Eros, B1, B2 and B3 were never
observed together. Rotation (Eros: ~1.3 mag), geometry and calibration changes between visits can
therefore masquerade as spectral slope or band depth (`src/preprocessing/temporal_analysis.py`).

- **Detection.** The analysis reports the visits (gap > 30 min), the families, the time offsets
  between adjacent segments, and the λ–time correlation.
- **Repeated observations.** These are the same wavelength (within λ/80) measured in different
  visits. They measure brightness changes independently of the spectral shape, through the model
  ln f − ln g = μ_bin + s_visit. The constant-brightness model is tested (variability detected if
  p < 10⁻³).
- **Periodic lightcurve.** Given the period (SBDB rot_per), a zero-mean Fourier model is fitted to the
  repeats only. The number of harmonics (1–5, `lightcurve_harmonics_max`) is chosen by BIC on the
  repeats (χ² + 2k ln n), considering only models with at least 3 degrees of freedom per lightcurve
  parameter. A fixed two-harmonic model under-fits elongated rotators, whose minima are sharper than
  their maxima: for 433 Eros the BIC fell from 730 (2 harmonics) to 426 (5). Faint-phase points were
  then under-corrected, which lowered B3 and made a V-type 2-µm band. The model is applied only if
  all of these hold:
  - at least 6 repeat bins;
  - rotational-phase coverage of at least 60%;
  - ΔBIC of at least 10;
  - it explains at least 70% of the variance that free visit offsets explain;
  - SWIR and MWIR agree. If they don't (Eros: p = 6×10⁻⁵), each arm is tested and normalised to
    its own rotation average.
- **No variability detected.** Nothing is corrected. The spread of the fitted visit offsets is kept as a
  visit-correlated error for the visits of the largest repeat-linked group (the reference); every other
  visit, including members of smaller groups that are linked only among themselves, keeps the untested
  prior of 0.1 mag.
- **Lightcurve-model uncertainty.** With BIC weights for the chosen and the runner-up number of
  harmonics, w = 1/(1 + e^{ΔBIC/2}), the variance of the two-model mixture of each point's correction,
  w(1 − w)·d², is added to its visit-correlated error.
- **Fallbacks.** With repeats but no supported period model, relative visit offsets are applied
  within connected components, which then form independent normalisation groups. Without any
  repeats, nothing is corrected and the cross-visit consistency is reported as untested.
- **Errors.** Correction uncertainties are propagated as visit-correlated errors (full covariance,
  `src/classification/covariance.py`). On Eros, treating them as independent drowned the
  within-visit shape (χ²_red 0.14).
- **Effect on Eros.** The thermal fit went from χ²_red 47 (joint lightcurve inside the thermal fit)
  to 0.77 (repeat-based correction). D = 15.6 ± 1.8 km against the NEAR value of 16.84 km.
- **Observing seasons (2026-11-15).** SPHEREx sees an asteroid in windows of days to weeks about every
  six months, and phase angle and aspect change between windows. Exposures more than
  `temporal.season_gap_days` (30) apart form seasons. Every model above (constant brightness, visit
  offsets, lightcurve) includes one free brightness offset per season linked by repeats, and
  variability is tested within seasons. Without it, 24 of 120 points of 92 Undina from a season 250 d
  later made the brightness "variable"; visit offsets then left 11 unlinked groups and the class went
  X → S. Tests: `tests/test_temporal_analysis.py` (two seasons with an offset; lightcurve fitted with a
  season offset). The records of 216, 624, 64 and 92 written before this change were re-run with it
  on 2026-11-15.

## 2c. Relative spectral calibration with solar-analog stars
Reflectance divides the asteroid flux by a solar model (E490, averaged over each SPHEREx bandpass).
Any wavelength-dependent error of the SPHEREx flux calibration or of the PSF photometry, and any
mismatch of the solar model at SPHEREx resolution, goes straight into the reflectance. Ground-based
asteroid spectroscopy removes these by dividing by a solar-analog star observed with the same
instrument. The same is done here with SPHEREx data (`src/preprocessing/solar_analog_calibration.py`,
`python main.py solar-analog-calibration`).

- **Stars.** The 11 solar analogs of the SMASS and MITHNEOS surveys, from Table 1 of Marsset et al.
  (2020, ApJS 247, 73), listed in `config/solar_analogs.yaml`. Each is matched to Gaia DR3 (within
  0.3–2.1″ of the table position; G − V = −0.12 to −0.19; BP − RP = 0.77–0.82 against a solar 0.82).
  Marsset et al. find that the stellar mean slopes of these stars spread by 1.4 %/µm (1σ) over
  0.8–2.4 µm.
- **Search and photometry.** SPHEREx L2 images containing the star come from an ObsCore position
  query; the science-file URL of each comes from its DataLink record
  (`src/acquisition/fixed_source_search.py`). The position is propagated from Gaia DR3 (J2016.0) with
  the proper motion. Photometry uses the same forced-PSF code as for asteroids, without a trail.
- **Model.** For every point i of star s, ln q_si = ln(F_si / F_sun(λ_si)) = a_s + c_d(b) + noise:
  a_s is a free scale per star and c_d(b) a response term per detector d and wavelength bin b
  (width λ/2R). The gauge is the reflectance normalisation: the weighted mean of c over the bins
  within 1.2 ± 0.05 µm is zero, so the correction never changes the normalisation. The fit is
  weighted least squares (photometric error plus a 1% floor), with iterative 4σ clipping and errors
  scaled by √χ²_red. A bin counts as determined with at least 3 points from at least 2 stars.
- **Star-to-star differences.** The analogs are not identical to the Sun. A linear trend of each
  star's residuals (SWIR and MWIR separately) gives the colour spread; its standard deviation / √N
  is the slope uncertainty of the mean correction. It is added in quadrature to the classification's
  systematic slope uncertainty. The per-star MWIR − SWIR mean residual measures how well the MWIR
  level is tied to the 1.2-µm gauge; its spread / √N is added to the MWIR bin errors.
- **Application.** The correction is applied in the shared analysis chain right after quality
  selection, to OBSERVED spectra only: F' = F / C(λ), C = exp(c) interpolated within each detector,
  with σ'² = (σ/C)² + (F σ_C/C²)². Points outside the calibrated range are left uncorrected and
  counted. The report, the integrated record (`spectral_calibration`) and the database provenance
  state whether it was applied, from how many stars, and with what slope uncertainty.
- **Independence.** The correction is built from stars only. No asteroid data, target names or
  reference taxonomies enter it. Using the validation asteroids themselves to define a common
  pattern would make the validation circular, so that is not done.
- **Star-level outliers.** A star whose SWIR residual slope or MWIR − SWIR level lies more than
  4 robust standard deviations (1.4826 MAD over the stars) from the others is not a usable solar
  proxy and is dropped before the final fit (`solar_analog_star_clip_sigma`).
- **Result (DR1, built 2026-11-14).** 15 stars, 150 images each (25 per detector). Landolt 110-361
  was dropped (MWIR − SWIR level −5.5% against a median of −0.3%, robust σ 0.8%; it lies at
  b = +2°). 14 stars, 1657 clean points, χ²_red 1.57, 199 of 216 bins determined with a median
  error of 0.8–1.1%. Slope uncertainty of the mean correction 0.23 %/µm (SWIR) and 0.14 %/µm (MWIR);
  MWIR level uncertainty 0.24%. Per-star SWIR residual slopes spread by ±1.3 %/µm, in line with
  the 1.4 %/µm of Marsset et al. (2020).
  - Shape, relative to 1.2 µm: B1 +2–3% at 0.80–0.88 µm, a dip to +0.1–1.0% at 0.89–0.93 µm and
    +4–5.5% at 1.03–1.12 µm; B2 ≈ 0 at 1.15–1.31 µm and +3.5–5.8% from 1.35 µm; B3 +2.5–11%;
    B4–B6 +3.4–12.5%. Fluxes are divided by C, so the long-wavelength reflectance and thermal
    fluxes go down by these amounts.
  - Split test: curves from the stars at |β| < 30° and at |β| ≥ 30° agree (134 common bins,
    χ²/N = 0.91, median difference 1.1%).
  - Effect on the validation asteroids (literature class mean, scale and slope free): the fit
    improves for 10 Hygiea (χ²_red 1.09 → 0.95), 246 Asporina (1.22 → 1.10) and 624 Hektor
    (0.18 → 0.12) and is unchanged for 433 Eros (1.05 → 1.07) with saturated points excluded; no
    complex-level classification changes. The narrow B1 structure correlates with the residuals of
    the bright Hygiea (r = 0.5–0.7) but not with those of the faint Hektor (r = 0.04), so part of
    it may depend on brightness; that cannot be tested with stars of one brightness (G 11.3–11.8).

## 2d. Point cleaning when the viewing geometry changes (2026-11-15)
Both problems were found with 35107 (1991 VH), a near-Earth asteroid observed at Δ 0.09–0.29 au and
phase angles of 59–92° (one of the three targets added on 2026-11-15; `docs/STAGE_STATUS.md`).

**Outliers compared at one geometry.**
- The running-median outlier test (4σ against the point error and the local scatter) used raw fluxes.
- For 35107 the fluxes within a 0.08-µm window differed by a factor of ~30 from distance and phase
  alone, so star blends 10–40× too bright were not flagged.
- For main-belt objects seen in two seasons, the old test discarded points that were brighter only
  because the object was closer: 1–3 points each for 433 Eros, 64 Angelina and 92 Undina.
- The fluxes are now divided by the reflected-light geometry factor Φ_HG(α)/(rΔ)², relative to the
  median geometry, before the test (`reject_outliers(scale_col=...)`).
- The reflected scaling is used at all wavelengths. A thermal (NEATM) scaling at ≥ 3 µm mis-scaled the
  reflected-dominated 3.0–3.5 µm points of main-belt objects: a 92 Undina point at r = 3.31 au was
  predicted 1.7× brighter than its neighbours and rejected.

**Saturation flags on an object too faint to saturate.**
- A PSF core with OVERFLOW, SUR_ERROR or NONLINEAR was always taken as saturated photometry of the
  object: wing-only, with an inflated error (§2b).
- Saturation needs a bright object: 433 Eros at V 10.7 had 38% of its points saturated, 10 Hygiea at
  V 11.8–12.1 7%, and the calibration stars are clean at G 11.3–11.8.
- When the object is predicted fainter than V 13 (V = H + 5 log(rΔ) − 2.5 log Φ(α)), the flag comes
  from another source in the core, a field star or an artefact, and the point measures that source.
- Such points below 3 µm are removed (`extraction.saturation_possible_brighter_than_v`). Above 3 µm a
  hot near-Earth asteroid can be far brighter than its V suggests, so the rule does not apply there.
- 35107: 4 points, 10–40× too bright. Across the 21 analysed targets the rule removed 1–4 points in 10
  of them.

## 3. Reflected and thermal separation (NEATM, Harris 1998)
For each point, with its own r, Δ and α:
`F = F_sun(λ)/r² · Φ_HG(α) · K(λ)/Δ² + NEATM(λ; D, η, A, ε)`, where K(λ) = p_λ R² = K0[1 + s(λ − 2 µm)].

Model details:
- The continuum is fitted on 1.6–2.5 µm and extrapolated. The 2.5–3.5 µm region is excluded from
  the fit to protect the 3-µm features.
- With H: the Bond albedo is A = q·pV, with pV = (1329·10^(−H/5)/D)², so D and pV are constrained
  together.
- Without H: the fit is repeated over a pV grid, and only a conditional D range is reported. No
  albedo is given.
- η is fitted with a literature phase-angle prior (default `eta_mode: phase_prior`):
  η₀(α) = 0.87 + 0.01·α[deg], with an asymmetric 1σ range of −0.30/+0.55. This comes from
  Trilling et al. (2016, AJ 152, 172; arXiv:1608.03673), from Warm Spitzer 3.6/4.5 µm NEATM fits
  of NEOs, which is the same wavelength regime as SPHEREx. The alternative
  `eta_prior_relation: mainzer2011` uses Mainzer et al. (2011, ApJ 743, 156):
  η = 0.00963·α + 0.761, from WISE 12/22 µm, with the Trilling scatter since no object-to-object
  scatter is quoted there.
  - The prior enters the least-squares fit as one extra residual, so weak thermal data leave η
    near η₀ and strong data can move it.
  - If the model leaves unexplained scatter (χ²_red > 1.5), the data errors are rescaled to
    χ²_red = 1 before being weighed against the prior. This is the same scaling the covariance
    uses. Without it, poorly fitting data are over-trusted and swamp the prior: for Eros, η went
    from 0.53 to 0.97 and D from 12.0 to 15.8 km once the rescaling was applied.
  - The relation was derived from NEOs. For main-belt objects it is an assumption, and phase
    angles outside 0–100° are flagged.
  - The legacy mode (`eta_mode: fixed`) fixes η = 1.0 ± 0.3.
- Fits are refused when the thermal excess has S/N < 3. Fits are flagged when χ²_red > 3 or a
  parameter sits on a bound.
- The thermal-excess S/N uses the full covariance of the extrapolated continuum, because the
  thermal points share one continuum. Errors are also inflated by the continuum-fit scatter.
  Treating the points as independent had given a noise-only S/N spread of 3.3 instead of 1.
- If a free η runs to its bound (the D–η degeneracy), the fit is repeated with η fixed and its
  prior propagated.
- Rotational lightcurve: when SBDB gives a rotation period, a zero-mean two-harmonic Fourier term
  in magnitudes multiplies the whole model. Without it, an elongated body's lightcurve (Eros: up
  to ~1 mag between exposures) is aliased into the spectral shape. D then refers to the
  rotation-averaged cross-section, and reflected and thermal light are assumed to share the
  lightcurve.
- The internal 2-µm reflectance parameter K0/R² is stored separately and is never reported as pV.

Limitations:
- The 3.5–5 µm range sits on the Wien side of the thermal emission for most objects, so D and η are
  strongly correlated there.
- Objects farther than about 2.5 au show little thermal signal at 5 µm.
- The model assumes a spherical body and the NEATM temperature distribution.
- TPM is not implemented. It would need thermal inertia, a spin state and a shape model.
- The solar spectrum is sbpy E490_2014. If sbpy is missing, a 5772 K blackbody is used and flagged.

**Thermal fit group and reflected-only fallback (2026-11-15).**
- The thermal fit uses a normalisation group with ≥ 4 points in the reflected continuum (1.6–2.5 µm).
  Among those, it takes the best joint coverage of continuum and thermal region.
- If no thermal fit is possible, the reflectance uses the points below 2.5 µm whose thermal flux is
  bounded below 1% of the observed flux. The bound puts the whole disk at the NEATM subsolar
  temperature, with bond albedo 0, η 0.756 and emissivity 0.9, and takes the size from H with
  pV 0.02.
- That reflectance is used without thermal removal, and the log says so.

**Continuum slope prior (2026-11-15).**
- The reflected continuum K(λ) = K0[1 + s(λ − 2 µm)] is fitted on 1.6–2.5 µm and extrapolated to
  3.5–5 µm, a lever arm of about ×3. A sparse, scattered continuum can therefore produce any slope.
  35107 got s = +1.32 /µm and a thermal excess S/N of 0.5, although about 90% of its 4–5 µm flux is
  thermal.
- The 25 Bus–DeMeo class means have s = −0.10 to +0.27 /µm over 1.6–2.45 µm (median 0.04).
- s now has a Gaussian prior N(0.05, 0.20) /µm, in the detection test and in the NEATM fit
  (`thermal_model.continuum_slope_prior`). For 35107: s = 0.09, excess S/N 7.9, D = 1.41 ± 0.38 km
  (catalogue 0.93 km, +1.2σ).
- **Synthetic test** (`tests/test_added_target_robustness.py`): a 1-km NEA at 1.05 au with ~14 continuum
  points at S/N 6 and 0.6 (ln) scatter between visits. With the prior it is detected in 13 of 20 draws
  (median |s| 0.06, median D 0.99 km); without it in 7 of 20 (median |s| 0.34).
- **Noise-only calibration.** With true slopes drawn from the prior range, the excess S/N has std 0.85
  and no false alarm in 40 draws (0.82 without the prior). With one fixed slope for every draw it is
  conservative (std 0.38): it uses the posterior slope uncertainty, which is the right one for an
  asteroid whose slope is unknown.
- **Effect on the 21 analysed targets** (full re-run, 2026-11-15):
  - Existing thermal diameters change by at most 3%. The exception is 69 Hesperia (110 → 92 km),
    whose change comes from the outlier test of §2d (one 5-µm point), not from the prior.
  - New detections: 236 Honoria (62 ± 27 km, catalogue 78 km) and 35107. No other target gained a
    detection, and every noise-only target stayed below threshold.
  - 596 Scheila keeps its earlier detection (89 ± 20 km). SBDB/NEOWISE gives 160 km and IRAS 113 km;
    with the current H the NEOWISE value implies pV 0.019.

## 3b. Diameter posterior and the beaming-parameter prior (2026-11-15)
**Why the diameter errors were large.** Error budget of the 10 thermal diameters (least-squares NEATM fit,
re-run on the saved spectra):
- With η held at its fitted value, the data fix D to 1–7%. The quoted 12–44% came almost entirely from the
  η prior: at 3.5–5 µm the flux is on the Wien side, F ∝ D² exp(−hc/λkT_ss) with T_ss ∝ η^(−1/4), so D ∝ η^~1.5 at
  fixed flux. The prior was the NEO relation of Trilling et al. (2016), −0.30/+0.55 about η₀(α) ≈ 1.07 at 20°, i.e.
  −30%/+50% in η.
- The fit used one normalisation group: 22 of 116 points for 236 Honoria (11 groups), 48 of 115 for 221 Eos, 76 of
  186 for 433 Eros, none for 729 Watsonia.
- The visit-correction error of the temporal analysis (lightcurve, visit and season offsets) was added to every point
  as an independent error. It is shared by the points of a visit, so it averaged down, and a normalisation error
  between the B5 visits (3.8–4.4 µm) and the B6 visits (4.4–5.0 µm) acted as a measured thermal colour: 308 Polyxo
  got η = 1.22 ± 0.09 and D = 184 ± 22 km (catalogue 129 km, −2.9σ).
- When a free η ran to its bound, it was fixed at η₀ and the whole prior range propagated (433 Eros: 27.6 ± 10.6 km).
- Extraction took the first `max_images` exposures in time, which is almost always one observing season. The other
  seasons (196–552 exposures per target) were never used, although they are often closer to the Sun (236 Honoria:
  r = 2.36 au unused, 2.95 au used).
- Statistical diameters (no thermal diameter): the albedo prior of the complex mixture (σ log pV: X 0.34, C 0.23,
  L 0.20 dex) and a thermal non-detection whose likelihood used the broad NEO η prior.

**Likelihood** (`src/physical/diameter_posterior.py`). For every point i of visit v and normalisation group g:

`F_i = exp(γ_g + δ_v) · [S_i K0 (1 + s(λ_i − 2 µm)) + D² g_i(u)]`,  u = ((1 − A)/η)^(1/4), A = q·pV(D, H)

- g_i(u) is the NEATM flux of a 1-km body at the point's r, Δ, α, tabulated in u (exact NEATM, 320 values).
- γ_g: one free offset per normalisation group (gauge: the largest group), so that every group enters.
- δ_v ~ N(0, σ_v), with σ_v the visit-correction uncertainty of the temporal analysis (0 for the gauge visit of a
  group). The photometric errors no longer contain it.
- s ~ N(0.05, 0.20) /µm, the continuum slope prior of §3.
- χ²(D, η) is minimised over (K0, K0·s, γ, δ) by alternating linear least squares on a grid of 300 values of log D
  (0.003 ≤ pV ≤ 1.5) and 41 values of η (0.5–3.5). L = exp(−(χ² − χ²_min)/(2κ)), with κ = max(χ²_min/dof, 1) for
  unexplained scatter, as in §3.
- χ² is split into the part across the D–η valley (how well the thermal flux level fits at each η) and the part
  along it (χ²_min(η) − χ²_min: which η the 3.5–5 µm colour prefers). The colour part is divided by κ once more.
  A model that leaves unexplained scatter misjudges a small difference between bands first. Hold-out 110 Lydia
  (κ 6.5) went to η 1.45 and D = 126 km with the colour fully trusted, and to η 1.10 and D = 86 km with it weighted
  by 1/κ (NEOWISE: η 0.97, D = 88 km). On the registered targets the choice changes nothing (combined rms z 1.04,
  1.03, 1.05 for full weight, 1/κ, no colour information); at κ ≈ 1 it has no effect.
- At fixed η the valley in D is only 1–7% wide, and it moves as D ∝ η^1.5. Between grid values of η the likelihood
  curves are interpolated after shifting them to a common maximum (6 steps), so the marginal has no comb of spikes.

**η prior** (`src/physical/eta_prior.py`, `python main.py eta-prior`).
- NEOs (q < 1.3 au) and objects beyond 5.4 au: the Trilling et al. (2016) relation, as in the least-squares fit.
- Main belt (incl. Mars-crossers), Hildas, Jupiter Trojans: NEOWISE fits with a free beaming parameter (NEOWISE
  Diameters and Albedos V2.0, Mainzer et al. 2019, PDS, doi:10.26033/18S3-2Z54; IRSA TAP `neowisesbpropv2`; 72 749
  fits, 69 879 main belt). The phase angle of every fit at its mean epoch comes from the JPL SBDB elements: WISE
  observed at elongation 88–97°, at phase angles of 16–30° for main-belt objects, the SPHEREx geometry.
  - ln η = μ_pop(log D) + b_pop(α − 20°) + ln f(α), with μ and σ the median and the 16–84% half-width in size bins.
    Main belt: η(20°) 1.00 at 3 km, 0.93 at 12 km, 0.90 above 30 km; σ ln η 0.20 → 0.08; b = +0.0069/deg.
    Hildas 0.83–0.88, Trojans 0.79–0.91.
  - f(α) = η_Trilling(α)/η_Mainzer(α) (1.12 at 20°): fits at 3.6/4.5 µm give ~12% higher η than at 12/22 µm for NEOs
    at the same phase angle. Without it the 13 main-belt targets with a thermal signal came out 10–15% small
    (mean z +0.8).
  - σ² = σ_pop² + σ_x², σ_x = 0.12. It is calibrated on the 23 registered targets. With σ_x = 0, the thermal diameters
    scattered 1.6 times their errors about the catalogue values (rms z 1.62); with 0.12, 1.1. Metal-rich M-types have
    high η (216 Kleopatra: NEOWISE η 1.34; 69 Hesperia and 92 Undina need about 1.3). The hold-out targets of
    `docs/STAGE_STATUS.md` were not used.
  - The validation targets, the injection set and the analysed object are removed before fitting.
  - Since D is a grid variable, the prior is conditional on D: p(η | D) for every log D.

**Results stored.**
- *Thermal diameter* (`diameter_km`, 68% and 95% intervals): likelihood × η prior, flat in log D. It replaces the
  least-squares diameter when that fit passes its thermal-excess test (S/N ≥ 3). It is the only diameter used for the
  albedo. The per-point components (reflectance, plots) are evaluated at its median, with η from the χ² valley.
- *Combined diameter* (`diameter_combined_km`): × the population albedo prior of §5b (complex probabilities without
  the albedo term, orbit, H). It is the best diameter unless a thermal diameter disagrees with the H + albedo prior
  (|z| ≥ 2, §5b), in which case the thermal diameter is reported. It is never used for an albedo.
- *Conflict between the thermal data and the prior.* When the thermal likelihood alone (with the η prior) and the
  H + albedo prior disagree by |z| ≥ 3 (`statistical_diameter.combined_conflict_sigma`), their product piles up where
  the two tails meet, with a narrow interval. The combined diameter is then the geometric mean of the two, with the
  68% and 95% intervals spanning both, and the record says so.
  - 64 Angelina (E-type, catalogue pV 0.48): thermal alone 39 km, prior 120 km, z −3.4. The product gave 42 ± 4 km
    against 58 km; the flagged result is 69 km (35–172 km).
  - Its 4–5 µm flux is 10–15% below what an ordinary E-type of the catalogue size would give: a cooler surface (high η)
    or a reflectance downturn beyond 3.5 µm would explain it.
  - A curvature term in the continuum (prior ±4% at 5 µm) was tried and not adopted. It left 64 and 2566 where they
    were, and it turned 92 Undina into a low thermal detection (97 against 126 km). 624 Hektor (5.15 au) keeps within
    ±1% of the linear continuum up to 4.4 µm.
- For a non-detection the posterior is also the thermal 95% upper limit (0.003 ≤ pV ≤ 1.5).
- `diameter_posterior` keeps the η prior, the η posterior, the number of points, groups and visits, κ and the
  thermal signal (√(Δχ²/κ) against the smallest D of the grid).

**Synthetic tests** (`tests/test_diameter_posterior.py`): D recovered within its errors; D follows the η prior about
as η^1.5 when the data carry little colour information; visit offsets of 0.08 (ln) widen the posterior and do not
bias it; three groups with unknown offsets all enter; no comb in the marginal; the combined interval is narrower and
keeps the truth.

**Exposure selection** (`select_exposures`, `src/extraction/spectral_extraction.py`). A cap on the number of exposures is
shared among the observing seasons in proportion to their size; each season contributes its earliest exposures, so
that visits stay complete. `validate-batch` and the validation targets now use all exposures (the first 120 before),
and the dashboard's "Run new analysis" panel defaults to 400 (60 before).

**Data for the diameter and for the classification.** The diameter, the reported thermal fit and the albedo use every
extracted image. When the data span several observing seasons, the reflectance spectrum and the classification use the
earliest `classification.max_images` (120) images, the sampling the classifier was calibrated and validated on; data from
one season are used in full (433 Eros: 191 images, as validated) (`classification_subset`,
`src/integration/spectrum_analysis.py`; the extraction records each image's place in the stage-1 table as
`image_rank`, so the subset is the same image set as before). With every season in the classification, 10 Hygiea
became a PASS and 92 Undina came out X-complex, but 236 Honoria went L → O and 216 Kleopatra Xe → A, both "wrong and
distinguished" (visit-to-visit brightness rms 0.44–0.47 mag across seasons). Using more seasons for the classification
needs its own study of the brightness model across seasons. With this rule every target classifies from the same
images as before, except 764 Gedania (60 images before, 120 now; still C-complex first).

**Horizons epochs** (`HorizonsClient.observer_ephemeris`). Every exposure is listed twice (SWIR and MWIR detector at the
same time), and Horizons refuses a TLIST chunk made only of identical times. 773 Irmintraud lost its whole geometry
(r, Δ, α) that way, so no thermal analysis was possible. Unique epochs are now queried and mapped back to every row.

## 4. Taxonomy and minerals

**Current method (supersedes the description below where they differ).**
- Following DeMeo et al. (2009, §3.1), slope and shape are separated. For each class the model is
  s_g·T(λ)·[1 + β(λ − 1.2 µm)], with a free scale per normalisation group and a free slope β. The
  slope then enters as a separate term β²/(σ_slope,class² + σ_slope,sys²).
- **High-slope ("w") classes.** S, Sq, Sr, Sv, V and Q have high-slope "w" variants in DeMeo et al.
  For these classes a redder slope is not penalised; it is reported as "w".
- **Class scatter.** The published intra-class σ is split into a slope part and a shape residual:
  σ(λ) ≈ a + b(λ − 0.55). The full σ would double-count slope variation, which made the broad
  D class absorb a 1-µm band.
- **Systematic slope error.** σ_slope,sys comes from the per-family normalisation uncertainty. It
  is None (slope term off) when consistency between visits is untested.
- **Likelihood and thresholds (2026-11-14, §4b).** The deviance is the full Gaussian −2 ln L,
  including ln det of the class covariance. The class shape σ is correlated over 0.2 µm. The
  "distinguished" gaps are calibrated by injection–recovery of real asteroid spectra: 6 for a
  complex (Medium), 12 for High (10 before the prior of §4c), and 10 for naming a subclass. The values
  4 and 9 below were the earlier, uncalibrated thresholds. Since 2026-11-15 the gaps are between complex
  scores that include the population, orbit and albedo prior (§4c).
- **Confidence.** It comes from the deviance gap between the best and the runner-up complex
  (≥ 9: High, ≥ 4: Medium). It is capped at Low when:
  - S-complex and D-type are within 4;
  - the 1-µm region (< 1.1 µm) is not covered, for any class: without it neither a band nor its
    absence can be established (433 Eros without it: C-complex 87%). An earlier exemption for C/X
    results was removed;
  - a featureless class wins although a 1-µm band is detected;
  - the slope is unconstrained and a featureless class wins;
  - more than 20% of the points in 0.75–2.45 µm have a saturated PSF core (saturation-limited
    spectrum, `classification.max_saturated_fraction`);
  - a stability check changes the most probable complex (spec §11.2). The checks repeat the
    classification (1) with the applied periodic lightcurve correction scaled by 0.9 and 1.1, and
    computed with the BIC runner-up number of harmonics (model form); (2) leaving out each visit with
    points in 0.75–2.45 µm in turn; (3) without the saturated points. Their results are stored with
    the taxonomy (`lightcurve_sensitivity`, `visit_jackknife`, `saturation_sensitivity`).
- **Trade-off.** On exact class means this recovers 73% of classes and 88% of complexes, against
  92% for slope-inside-shape. The misses are near neighbours. In exchange, a red continuum alone
  cannot produce a featureless class.
- **Band analysis.** Band I and Band II are always reported as DETECTED, NOT_DETECTED or
  NOT_EVALUABLE, with the minimum detectable depth (3σ) and whether a typical band-bearing class
  would be detectable with the same sampling. The evidence comes from two tests:
  - the full band within one normalisation group, with a Monte Carlo false-alarm threshold (shoulder
    maxima and a band minimum bias the depth of pure noise) and the centre inside 0.85–1.12 µm or
    1.75–2.35 µm;
  - a within-segment curvature test (B1 or B3 points with full covariance), which is insensitive to
    unlinked brightness changes.
  On all 25 class means (S/N 50 and 5, 3 noise draws) this gives no false detections in featureless
  classes, and band patterns that match the class descriptions.

The earlier description follows.
- References: the Bus-DeMeo class means (0.45–2.45 µm), convolved to R = 40, interpolated onto the
  observed wavelengths and renormalised at 1.25 µm. The Bus-DeMeo PCA coefficients and boundaries
  are **not** reused.
- Ranking: every class is listed by relative probability, highest first, and probabilities are
  also summed per complex.
  - The observed spectrum is binned onto the 0.05 µm reference grid first.
  - The χ² uses a free scale factor, with both the measurement error and the intra-class σ.
    Classes without a published σ (Cg, O, R) get the median σ of all classes.
  - P_i ∝ exp(−(χ²_i − χ²_min)/(2s)), with s = max(χ²_red of the best class, 1), so a poorly
    fitting spectrum does not yield spurious 100%/0% certainty.
  - This configuration was chosen by recovering the 25 class means (3 noise draws, S/N 50):
    83% of classes and 92% of complexes were recovered. The misses are pairs that differ mainly
    in the visible (Sv/Sr, Xc/Xe, T/Xk, Ch/Xe). A Gaussian deviance (χ² + Σ ln σ²) recovered only
    47–51%, because the class σ is correlated across wavelength.
  - The probabilities are relative among the reference classes. They are not probabilities that
    a mineral is present.
- Classes that are told apart mainly by their visible slope are reported as ambiguous groups:
  C/B subclasses, X subclasses and S subclasses.
- Bands:
  - Band I and Band II: continuum removal, polynomial band centre with a Monte-Carlo error, depth,
    and BAR (band area ratio).
  - 3-µm windows: 2.7–2.9 µm (OH), 3.0–3.2 µm (H₂O/NH₄) and 3.35–3.55 µm (C–H), measured on the
    thermally corrected reflectance.
  - A band counts as detected only with depth/σ ≥ 3 and a width of at least 1.5 resolution elements.
- Mineral candidates come from indicative Cloutis/Gaffey criteria. They are consistency statements,
  not identifications.
- ML (RF/SVM/XGBoost) is available only with an independent labelled set. Training and validation
  are split by object, a leakage check runs, and class imbalance is reported.

## 4b. Calibration of the classifier with real asteroid spectra (injection–recovery)
**Why.** The DR1 validation added on 2026-11-14 gave three wrong complexes reported as distinguished:
- 221 Eos (K) → C, gap 6.6;
- 387 Aquitania (L) → X, gap 9.3;
- 69 Hesperia (Xk) → C, gap 18.6.

The winning classes were nearly always those with the widest intra-class shape σ: B 7.3%, Xn 4.6%,
Sa 4.5%, Xe 3.8%, Cgh 3.5%, against K 2.5%, L 2.2%, A 2.0% and C 0.55%. The deviance was χ² with the
class σ in the denominator but without its normalisation term ln det C. A wider class then always
has the smaller χ² for the same residuals, so it wins whenever no class fits well.

**Test.** `python main.py classifier-calibration --targets … --models …`
(`src/validation/injection_recovery.py`):
- Injected spectra: 190 MIT SMASS SpeX spectra whose Bus–DeMeo class is listed in DeMeo et al.
  (2009, Appendix). The list is in `data/reference/injection_set/`; the files are downloaded to
  `data/raw/smass_spex/`.
- Sampling: each spectrum is sampled like each of 10 DR1 observations (433, 246, 624, 10, 16, 221,
  387, 308, 2045, 69). It gets the same points, normalisation groups and visits, the same
  photometric and visit-correlated error model and the same slope systematic.
- Scoring: each injection is classified, and the scaled deviance gap of the true complex and of
  the true class to the first is recorded.
- No validation target's reference class is used; the targets only lend their sampling.
- The decision rule was fixed before the results (scratch note, 2026-11-14): the lowest rate of
  wrong-and-distinguished complexes, then the highest rate of right-and-distinguished complexes
  at a threshold calibrated to ≤ 5% wrong.

| Model (1900 injections each) | Complex first | Wrong complex at gap ≥ 4 | Calibrated gap (≤ 5% wrong) | Right and distinguished there |
|---|---|---|---|---|
| χ² (previous default) | 56.2% | 20.2% | 12 | 10.5% |
| Gaussian, class σ independent per point | 56.4% | 11.7% | 8 | 15.9% |
| **Gaussian, class σ correlated over 0.2 µm (adopted)** | 57.8% | 7.4% | **6** | 17.4% |

- Correlation length 0.1 and 0.4 µm give 7.9% and 7.1% wrong at gap ≥ 4, and a calibrated gap of 6
  in both cases.
- With the adopted model, wrong complexes are reported as distinguished in 1.0% of injections at
  gap ≥ 10, so High confidence needs a gap of 10.
- At class level, 2.8% are wrong at gap ≥ 10, so a subclass is named only with a gap of 10 to the
  next class of the same complex. Otherwise the result is the complex, with the leading subclasses
  listed ("S-complex (subclass not determined: Sa 60%, S 32%)").
- The earlier choice of χ² came from injecting the 25 class *means*. Those have no member diversity,
  which favours tolerant classes.

**What the numbers say about DR1 spectra.**
- Even with the adopted model, the true complex comes first in only 58% of injections, and only 17%
  are right and distinguished.
- Results differ by class:
  - V-types are recovered: 95% first, 85% right and distinguished.
  - L-types are not: 12% first. K-types: 28% first.
  - T-types are first in 68% of injections but never distinguished.
- Results differ by sampling. An observation split into five unlinked normalisation groups
  (221 Eos) recovers 32% of complexes. One linked by a periodic lightcurve (387, 308, 246) recovers
  about 70%.
- Most DR1 classifications should therefore end as "not distinguished". The calibrated thresholds
  make the reported confidence say so.

**Limitations.**
- The injected spectra are among those from which the class means were built (in-sample), so the
  rates are optimistic.
- SpeX data start at 0.8 µm, so SPHEREx points at 0.75–0.8 µm are not tested.
- The noise follows the pipeline's own error model. Calibration residuals or lightcurve-model
  errors beyond it are not included, so real data can do worse than the injections.

## 4c. Prior over classes: population, orbit and albedo (2026-11-15)
**Why.** With the calibrated likelihood (§4b) the DR1 validation still put K-types (221 Eos, 579 Sidonia)
in C/X, L-types (387 Aquitania, 236 Honoria) in X/C, a T-type (96 Aegle) in C, and an Xk-type (69 Hesperia)
in C/B. Most of these were "not distinguished", so they were not wrong verdicts, but they were wrong
first answers. In the near-infrared at R ≈ 40, with several unlinked normalisation groups, the shapes of
C, X, K, L and T differ by less than the noise. Their albedos differ a lot. The catalogue albedos of the
SMASSII-classified asteroids give these medians:

| C | D | T | X | K | L | S | V |
|---|---|---|---|---|---|---|---|
| 0.048 | 0.051 | 0.076 | 0.095, but broad (σ 0.37 dex: P, M and E types) | 0.13 | 0.15 | 0.23 | 0.30 |

Two biases of the earlier ranking were found on the way:
- **Class-count bias.** Complex probabilities were sums of class probabilities under a flat prior over
  the 25 classes. A complex with six classes (C) therefore got up to six times the prior mass of K, L or
  T, which have one class each.
- **Inconsistent complex.** The record's `spectral_complex` was the complex of the single best class,
  while the complex ranking was by summed probability. The two could disagree: 10 Hygiea was reported as
  "X-complex" while the ranking had C-complex first at 60%, and 387 Aquitania as "C-complex" with
  X-complex first (40% vs 39%).

**Hint taken from two reference Kaggle notebooks** (`99-49-asteroid-classification-mult-models` and
`asteroid-diameter-prediction-mlp-catboost-lgbm`; not part of this repository): compare several model
families on held-out data and look at which features carry the information. H, albedo and orbit are the strong features
there. Both are applied here to information that SPHEREx spectra lack, with the leakage of the notebooks
removed (§5b).

**Method** (`src/classification/priors.py`, `src/physical/population_priors.py`,
`src/integration/population_context.py`). The class score is

`w_k = deviance_k / s + 2 ln n_c − 2 ln P(c) − 2 ln p(pV | c)`

and complex scores are `−2 ln Σ_k exp(−w_k/2)` over the classes of a complex. The complex order, the
complex probabilities, the confidence gap, C7 and the reported complex therefore use one quantity. The
best class is the best class of the most probable complex.
- `2 ln n_c` spreads the prior of a complex over its n_c classes. This removes the class-count bias.
- `P(c) ∝ base(c)^β · [P(c | orbit)/base(c)]^τ` with β = 0.25 and τ = 0.5.
  - base(c) is the frequency of the complex among the 1471 SMASSII-classified SBDB asteroids.
  - P(c | orbit) comes from a random forest on (a, e, sin i, H) with at least 15 objects per leaf. In
    5-fold CV its log-loss is 1.30, against 1.53 for the base rates (`outputs/validation/population_priors.md`).
    The other families score: random forest with 5 per leaf 1.29 (equal within noise; 15 per leaf was chosen
    by the injection test below), SVM 1.44, logistic regression 1.47, HistGB 1.48, decision tree 1.51,
    kNN 1.60. Permutation importance: a 0.28, e 0.06, sin i 0.05, H 0.04.
  - The exponents temper both terms. SMASSII is a magnitude-limited sample, and random-forest
    probabilities are noisy for complexes with 4–13 members.
- `p(pV | c)` is a Gaussian kernel density of the catalogue log10 pV of each complex, convolved with the
  measurement error.
  - The albedo is the catalogue value, taken as the pV that reproduces the catalogue diameter with the
    current H. If there is none, the SPHEREx thermal pV is used when it is estimated with at least Medium
    confidence. The source is recorded; the floor on the error is 0.1 dex.
  - Catalogue albedos come first because the dedicated thermal-infrared surveys use 12–22 µm data. On the
    Wien side the SPHEREx thermal pV is less reliable, e.g. 387 Aquitania: SPHEREx 0.052 against
    catalogue 0.18.
- **Leakage control.** The validation targets and the 190 injection objects are removed from all training
  rows, and so are the analysed object's own rows (designation match). No object's catalogue class
  enters its own prior. The prior model is retrained without the object when needed (about 5 s). Only
  SMASSII classes are used: Tholen E/M/P were assigned with the albedo.
- **Without a prior** (catalogue unavailable or `classification.prior.enabled: false`), classify()
  behaves as before: flat over classes, but with the consistent complex scores.

**Selection** (injection–recovery of §4b, 1900 injections). Each injected SpeX object gets its own orbit
and catalogue albedo (168 of 190 have one). The models are trained without those objects. The rule was
set after a first grid had been seen: maximise the mean of the overall and the class-balanced log
score of the true complex, with ≤ 5% wrong-and-distinguished at gap 6.

| Variant | True complex first | Class-balanced | Mean ln P(true) | Right & distinguished (gap 6) | Wrong & distinguished (gap 6) |
|---|---|---|---|---|---|
| Flat over classes (before) | 62.3% | 53.9% | −1.00 | 18.9% | 4.2% |
| Flat over complexes | 45.6% | 58.2% | −1.32 | 15.1% | 4.1% |
| β 0.25, τ 0.5, no albedo | 61.6% | 60.3% | −1.00 | 20.3% | 3.5% |
| Flat over classes + albedo | 72.3% | 58.3% | −0.84 | 23.1% | 3.9% |
| β 0.25, τ 0.5, albedo (forest leaves ≥ 5) | 70.7% | 64.3% | −0.85 | 24.7% | 3.8% |
| **β 0.25, τ 0.5, albedo (forest leaves ≥ 15, adopted)** | **69.8%** | **65.7%** | **−0.87** | **23.1%** | **3.7%** |
| Population prior (β 1) + albedo | 76.5% | 49.4% | −0.78 | 24.4% (gap 8) | 5.6% |

The forest leaf size was checked after a DR1 target showed an implausible prior: at the orbit of
16 Psyche, next to the single R-type 349 Dembowska, the R-type prior was 16%. Under the same rule
the mean log scores were −1.020 for 5 objects per leaf, −1.015 for 15 and −1.032 for 30, so 15 is used.

The pipeline run of the adopted variant (`python main.py classifier-calibration --targets …`; random
forest of 300 trees, ≥ 15 objects per leaf) gives 69.4% first, 65.1% class-balanced and ln P −0.88. Its
thresholds:

| Level | Gap | Wrong-and-distinguished |
|---|---|---|
| Complex, Medium (≤ 5%) | 6 | 4.1% |
| Complex, High (≤ 1%) | 12 | 0.4% (1.4% at 10) |
| Class (≤ 5%) | 10 | 3.4% |

High confidence therefore moves from 10 to 12. The no-prior baseline of the same code is stored as
`settings_no_prior` in `outputs/validation/classifier_calibration.json`.

Recovery by true complex, before → after:

| Complex | Before | After |
|---|---|---|
| A | 53% | 63% |
| C | 64% | 79% |
| D | 55% | 77% |
| K | 18% | 32% |
| L | 5% | 40% |
| Q | 62% | 82% |
| S | 72% | 75% |
| X | 34% | 36% |
| V | 92% | 95% |
| T | 38% | 38% |

With 5 objects per leaf, T-types fell to 30%, because the orbit term is noisy for 9 SMASSII T-types.
Using the full population prior (β 1) would drop T to 0% and A to 33%.

**Albedo uncertainty from the catalogue itself (2026-11-15, after the added targets).**
- **Why.** 596 Scheila (T) ended as C7 FAIL: X-complex first, T 9.0 behind. On the spectrum alone T had
  21%; the albedo term took it to 1%.
- **Cause.** SBDB lists pV 0.040 for Scheila, but its catalogue diameter (159.7 km) with the current H
  (8.92) implies pV_eff 0.019. Across the catalogue, log10(pV_eff/pV) has median −0.108 dex and robust
  σ 0.076, so Scheila's −0.33 dex is a 3σ outlier: the catalogue albedo was computed with an H about
  0.8 mag brighter.
- **Fix.** When an object has both a catalogue diameter and a catalogue albedo, their disagreement beyond
  the population median is added in quadrature to the albedo uncertainty (Scheila: 0.10 → 0.24 dex).
  An albedo without a diameter is shifted by the median offset.
- **Result.** Scheila: T is no longer excluded; the result is "not distinguished" (C, 2.5 ahead of T).
  Injection test (1900):

  | | Before | After |
  |---|---|---|
  | True complex first | 69.4% | 70.3% |
  | Class-balanced | 65.1% | 65.0% |
  | ln P(true) | −0.88 | −0.81 |
  | Right & distinguished (gap 6) | 22.6% | 27.3% |
  | Wrong & distinguished (gap 6) | 4.1% | 2.8% |
  | K / T recovery | 32% / 38% | 40% / 40% |

  So the catalogue albedos had been slightly overconfident in general.
- **Recalibrated thresholds:** complex Medium 6 (2.8% wrong), High 10 (0.9%; it had been 12),
  class 10 (2.9%).
- **Tested and rejected.** Shrinking the albedo distributions of rare complexes (T, D, A, Q, O, R have
  4–13 SMASSII members) toward the pooled distribution, with weight n/(n + n0), made the leave-one-out
  prediction of catalogued albedos worse for every n0 tried. Mean log-likelihood: 0.296 (n0 = 0),
  0.281 (10), 0.218 (80); T-types also got worse. It is not used.

**Limitations.**
- The albedo term uses data from outside SPHEREx when no SPHEREx albedo is good enough. The report
  shows the spectral-only complex ranking next to the final one.
- The injected spectra are in-sample for the class means (§4b), so the absolute rates are optimistic.
  The prior models are out-of-sample.
- Objects without any albedo get only the population and orbit terms: 61.6% first, 60.3%
  class-balanced in the injection test.
- The rule was fixed after the first grid had been seen. The candidate set was small (one family,
  3 × 2 × 2 settings plus three reference variants, then three leaf sizes), but the choice is not a
  blind one.

## 5. Absolute magnitude H
The order of sources is:
1. JPL SBDB H, with its reference.
2. Other catalogues.
3. An estimate from multi-epoch photometry from any provider (MPC archive, or a user CSV from any
   facility).

The estimate uses `V_red = m − 5 log10(rΔ) = H − 2.5 log10 Φ(α)`, with H-G (Bowell et al. 1989) or
H-G1-G2 through sbpy. The rules are:
- G is fitted only if the phase angles span at least 10°.
- Rotational scatter is either configured or inferred from the residuals (and flagged).
- At least 5 points over at least 3 nights are needed.
- Only V-band data is used unless verified band corrections are enabled.

If the requirements are not met, the status is `Insufficient optical photometry` and the follow-up
requirements are listed. No facility is pre-selected.

## 5b. Statistical diameter, thermal upper limit and consistency check (2026-11-15)
**Can SPHEREx give a diameter for the targets without one?** 11 of the 18 analysed targets have no
SPHEREx thermal diameter:
- In nine, the thermal excess at 3.5–5 µm has S/N −0.4 to 2.2 (threshold 3) at r = 2.2–5.2 au.
- In two (92 Undina, 729 Watsonia), no normalisation group covers both the continuum and the thermal
  region.

For these objects the DR1 thermal data contain no measurable diameter, and lowering the threshold would
only turn noise into diameters. What they do contain is a **non-detection**: a large, dark body would
have shown an excess. The diameter can therefore be estimated from H and an albedo prior, constrained by
that non-detection.

**Method** (`src/physical/statistical_diameter.py`; 20 000 Monte Carlo draws):
1. The complex c is drawn from the classifier's complex probabilities **without the albedo term**
   (`complex_ranking_no_albedo`). A catalogue albedo would otherwise feed back into the diameter it was
   derived from.
2. log10 pV given c, the orbit and H is drawn from N(μ_c, σ_c). Here μ_c is the inverse-variance
   combination of the complex albedo distribution and the orbit regression (§4c), and σ_c is the
   cross-validated rms of that combination for the complex: S 0.13, C 0.23, X 0.34, K 0.13, L 0.20 dex.
3. D = 1329 km / √pV · 10^(−H/5). The model was trained with SBDB H, so the H-system scatter is already in
   σ_c. The error of an H from another source is added.
4. **Thermal non-detection.** The thermal test stores the statistic X = Σ w_i (F_i − F_ref,i), with
   w = 1/σ² and σ_X from the full covariance, including the continuum extrapolation. Each draw is
   weighted by the likelihood of the measured X under NEATM, with that D, the Bond albedo q·pV and η
   marginalised over the η(α) prior. With a flat prior in log D over 0.01 ≤ pV ≤ 1, the same likelihood
   alone gives a 95% upper limit on D. *Since 2026-11-15 this weighting is used only when the diameter
   posterior of §3b cannot be computed; otherwise the statistical diameter is the H + albedo prior alone, and the
   thermal data enter through the combined diameter (§3b), which uses every point instead of one statistic.*
5. **Output.** The result is the median and the 68% and 95% intervals. Confidence is Medium when
   D84/D16 ≤ 1.35, else Low, and never High. The estimate is stored apart from the thermal diameter
   (`diameter_statistical_*`) and is never used for an albedo or a density. `diameter_best_km` is the
   combined diameter of §3b (thermal likelihood × η prior × this albedo prior) when it exists and a thermal diameter,
   if any, passes the consistency check below; else the thermal diameter; else the statistical estimate. Before
   2026-11-15 it was the thermal diameter when there was one, else the statistical estimate.
6. **Consistency check of thermal diameters.**
   `z = (log D_thermal − log D_stat) / √(σ_th² + σ_stat²)` uses the statistical estimate without thermal
   weighting. When |z| ≥ 2 the record notes that the thermal diameter is not supported by the H +
   albedo prior; the usual cause is the D–η degeneracy on the Wien side.

**Model choice** (5-fold CV, 139 026 catalogue diameters with the current H; `python main.py
population-priors --compare`):
- **Albedo is never an input.** The diameter notebook used the albedo as a feature, but an object with
  an unknown diameter has no albedo, and with the albedo D is nearly a function of the inputs.
- **Target.** The target is log10 pV, and errors are quoted in log10 D. The notebook regressed D in km,
  whose MSE is dominated by the largest bodies.
- **Results** (rms in log10 D):

  | Predictor | rms log10 D |
  |---|---|
  | Constant pV | 0.171 |
  | Ridge | 0.153 |
  | MLP | 0.112 |
  | Random forest | 0.107 |
  | HistGB (adopted) | 0.106 (64% of diameters within 20%) |

- **Feature importance** (permutation): a 0.077, H 0.058, sin i 0.012, e 0.008.
- **With a spectral complex** (1238 SMASSII objects with a diameter, rms log10 D):

  | Predictor | rms log10 D |
  |---|---|
  | Orbit only | 0.149 |
  | Complex median only | 0.113 |
  | Complex + orbit (adopted) | 0.107 |

  By complex: S 0.063, K 0.065, V 0.063, C 0.109, X 0.171.

**Validation on the analysed targets** (catalogue diameter never used as input; the targets are
excluded from all training): see `docs/STAGE_STATUS.md`, "Statistical diameters".

## 6. Albedo
`pV = (1329·10^(−H/5)/D)²`, computed only for a V-band H and a thermal-model D.
- Errors: the H uncertainty is propagated both directly and through the H-dependent thermal fit,
  using dD/dH from refits at H ± σ_H.
- Values outside 0.01–1.0, or with relative error above 0.5, are shown as `ON_HOLD_VALIDATION`.
  They are never clipped.
- Geometric albedo, Bond albedo and spectral reflectance are kept as separate quantities.
- The statistical diameter (§5b) is never used for pV: its albedo is the prior itself. The prior pV of
  its draws is shown next to it, labelled as a prior.
- When the SPHEREx pV is estimated with at least Medium confidence and no catalogue albedo exists, it
  enters the classifier's albedo term (§4c).

## 7. Mass and density
Mass comes only from dynamical results: a database GM (M = GM/G), Kepler III for binaries, or
published perturbation and spacecraft-tracking results with references. It is never derived from
diameter or taxonomy.

Density is ρ = M/V. The volume comes from, in order of preference:
1. the SPHEREx thermal diameter;
2. the SBDB volume-equivalent diameter;
3. as a last resort, the triaxial extent.

SBDB extents are maximum dimensions, so their ellipsoid volume is biased for irregular bodies.
In validation it was +11% for Eros and −18% for Ryugu. Sphere-based volumes are flagged
`spherical_assumption`. Errors are propagated assuming independent inputs.

## 8. Validation
`python main.py validate` compares the system's calculations against SBDB values for objects
measured by spacecraft (Ceres, Vesta, Psyche, Lutetia, Bennu, Ryugu, Eros). Differences are
reported and interpreted, never tuned away. Catalogue pV values often come from H and D values
other than those listed in the same record.

## 8b. Comparing a thermal diameter with a shape-model diameter (2026-11-15)
**Two different quantities.** A NEATM diameter is the diameter of the sphere that emits the observed 3.5–5 µm flux
at the observing geometry: an *effective* diameter. A spacecraft, radar or adaptive-optics diameter is
*volume-equivalent*. For a round body they agree. For an elongated body the effective diameter depends on how it is
seen and lit. In 2025-07 SPHEREx saw 433 Eros (34.4 × 11.2 × 11.2 km, NEAR) 3–8° from its south pole, with the Sun
30–40° from the pole and a phase angle of 37°. It therefore saw the largest cross-section (area-equivalent 20.3 km),
and the sunlit side is flatter than a sphere's, so more of it is hot. A spherical NEATM then needs a 22.1 km sphere,
1.31 times the volume-equivalent 16.84 km, to emit the same flux. Comparing SPHEREx's 23.7 km with 16.84 km mixed the
two quantities (z = −2.7).

**Reference** (`src/validation/shape_reference.py`). When SBDB gives a triaxial `extent`, the catalogue diameter is
taken as volume-equivalent. A warning is raised if it differs from the extent's volume-equivalent diameter by more than
15%. A thermal diameter is then also compared with D_eff = f × D_vol, the diameter that the same spherical NEATM gives
for that shape at the same geometry:
- shape: an ellipsoid with the extent's proportions, scaled to D_vol (`thermal_model.ellipsoid_facets`, 90 × 180
  facets);
- geometry: Sun and SPHEREx directions at the epochs of the thermal points (≥ 3.5 µm), computed from the target's
  predicted RA/Dec and Δ and the low-precision solar coordinates of the Astronomical Almanac. The recomputed r and α
  agree with the stored Horizons values to 1e-4 au and 0.001° for Eros. The spin pole is SBDB's (RA/Dec, J2000), and
  the flux is averaged over 36 rotation phases, because the exposures sample random phases;
- model: the NEATM temperature rule on every facet (`thermal_model.facet_neatm_flux_jy`; it equals `neatm_flux_jy`
  for a sphere to 0.3%). η is the centre of the target's η prior and the Bond albedo is q(G) × the catalogue pV. The
  ellipsoid and the volume-equivalent sphere use the same η and albedo, so f measures the shape alone:
  f = exp(mean of ½ ln(F_ellipsoid / F_sphere)) over the thermal points;
- without an SBDB pole: f is the median over 48 isotropic poles, and its 68% range is added (in ln D) to the
  comparison uncertainty, together with the catalogue error.

The record stores `catalog_effective_diameter_km` (with a 68% interval without a pole), `shape_reference` (f, axes,
pole, median sub-observer and sub-solar latitudes, η, albedo), `diameter_catalog_z` and `diameter_effective_z`
(z = ln(D_ref / D_best) / σ, as in `docs/STAGE_STATUS.md`). Here σ combines half the 68% interval of ln D_best with the
reference's own relative error: the catalogue error, plus the f range when there is no pole. The tables in STAGE_STATUS
leave out catalogue errors. The reference uses no SPHEREx flux and never changes the SPHEREx diameter
(`tests/test_shape_reference.py`).

| Target | Catalogue (volume-equivalent) | Geometry of the thermal points | f | D_eff (km) | SPHEREx best (km) | z: catalogue → effective |
|---|---|---|---|---|---|---|
| 433 Eros (2025-07) | 16.84 km, 34.4 × 11.2 × 11.2 km, pole 11.37/17.22 | sub-observer −86°, sub-solar −54°, α 37° | 1.31 | 22.1 | 23.7 (20.9–27.0) | −2.7 → −0.5 |
| 216 Kleopatra | 122 ± 30 km, 276 × 94 × 78 km, pole 69/42 | sub-observer +54°, sub-solar +50°, α 18° | 1.30 | 159 | 134 (115–157) | −0.3 → +0.6 |
| 16 Psyche | 222 km, 278 × 238 × 171 km, no pole in SBDB | α 23° | 0.94 (0.86–1.14) | 208 (190–254) | 259 (218–309) | −0.9 → −1.0 |

**Limits.** An ellipsoid approximates an irregular shape and casts no shadows: Eros has a saddle, and Kleopatra is
bilobed with a narrow waist, so its curvature near the sub-solar point (which dominates f on the Wien side) differs from
an ellipsoid's. Thermal inertia and roughness are absorbed in η, as in NEATM. The comparison now matches the quantity
measured. It does not give a volume-equivalent SPHEREx diameter, which the density needs (ρ ∝ D⁻³; Eros stays on hold).
That needs the shape in the thermal likelihood itself. **Pitfall:** Horizons' sub-observer and sub-solar latitudes
(quantities 14 and 15) are planetodetic on the target's reference ellipsoid. For Eros they read −89.5° and −85.5°,
which contradicts the 37° phase angle; the aspect must be computed from the pole and the direction vectors, as here.

## 9. Taxonomy validation (433 Eros)
`python main.py validate-taxonomy --target 433` scores nine criteria (C1–C9) against the reference
taxonomy in `config/validation_targets.yaml`, cross-checked with SBDB spec_B. That reference is
read only by `src/validation`, and C8 verifies statically that the analysis and classification code
contains no target names or reference taxonomies. Counterfactuals use the observation's own
sampling and error structure:
- band-bearing templates reddened to the slope of the D-type mean (must not become D), with a D
  template as control;
- repeats removed, or no rotation period (no rotational correction may be applied);
- the 1-µm region removed, or errors ×4 (confidence must not rise; it must be Low without the band
  region).
  The counterfactuals are plain classifier runs, so C6 compares them with the classifier's own
  confidence for the full data (`confidence_classifier`), not with the reported confidence after the
  analysis-level downgrades (thermal-fit quality, stability checks, saturation limit).
- C7 compares the reference complex with the best other complex by deviance, using the classifier's
  calibrated threshold for "distinguished" (scaled deviance gap ≥ 6, §4b; ≥ 4 before 2026-11-14). It
  is PASS if the reference is ahead by the threshold, FAIL if it is behind by the threshold, and
  otherwise INCONCLUSIVE. The order by summed complex probability can differ from the order by
  deviance; the deviance is what the confidence uses.
- C9 applies the same rule at class level, with threshold 10 (§4b). The reference class is the
  Bus–DeMeo class, with "w" dropped (Sw → S). C9 makes a subclass result such as Sa for an S-type
  visible; a complex-level PASS hid it before. For one-class types (A, D, K, L, O, Q, R, T, V), C9
  repeats C7.
- Validation windows must not be saturation-limited (§2); on a saturation-limited spectrum C7 is reported
  but not scored. For 433 Eros the window is 2025-07 (V ≈ 13.2, 3% saturated points), chosen by that
  rule before its result was known; in 2026-02 (V ≈ 10.7) 38% of the 0.75–2.45 µm points were saturated.
- Choice of validation targets. Targets are chosen by a rule applied to screening numbers (MOST exposure
  count and predicted V) before any target is analysed. Each class needs a reference taxonomy that
  includes the near-infrared (the Bus–DeMeo class of DeMeo et al. 2009), agreeing with SMASSII. Each
  target must also pass the saturation and signal limits; per class, the brightest is the primary and
  the second brightest a replicate (`docs/STAGE_STATUS.md`, "Added validation targets").
  Targets without a config entry fall back to the SBDB taxonomy fields (`spec_B`, else `spec_T`).
