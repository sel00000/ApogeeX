"""Shared analysis chain for an extracted spectrum (used by the pipeline and by validation):

  quality selection -> relative spectral calibration (solar analogs; OBSERVED data) ->
  observation-time analysis -> data-supported brightness correction ->
  reflected/thermal fit (one normalisation group; excess test) -> diameter posterior from all points ->
  reflectance for every point ->
  band analysis -> classification (shape + slope, band evidence) -> consistency downgrades.

No target-specific information is used: the inputs are the spectrum, an optional H result and an
optional rotation period. Reference taxonomies are only used by src/validation. The solar-analog
correction is built from stars only (src/preprocessing/solar_analog_calibration.py).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..classification.mineral_identification import analyse_minerals
from ..classification.taxonomy import classify
from ..common import status
from ..physical.albedo import albedo_from_thermal_fit
from ..physical.statistical_diameter import consistency_with_thermal, estimate_statistical_diameter
from ..common.config import settings
from ..preprocessing.solar_analog_calibration import (SolarAnalogCorrection, apply_correction,
                                                      calibration_slope_sigma, load_correction)
from ..preprocessing.spectrum_cleaning import reject_outliers, select_usable
from ..preprocessing.temporal_analysis import (analyse_temporal, apply_temporal_correction, geometric_log_scale,
                                               slope_systematic_per_um)
from ..physical.phase_function import PhaseLaw
from ..preprocessing.thermal_separation import ThermalSeparator, reflectance_spectrum


@dataclass
class SpectrumAnalysis:
    clean: pd.DataFrame
    temporal: object
    corrected: pd.DataFrame
    thermal: object = None
    diameter: object = None
    albedo: object = None
    reflectance: pd.DataFrame | None = None
    minerals: object = None
    taxonomy: object = None
    slope_sys_per_um: float | None = None
    thermal_fit_group: int | None = None
    reflected_only: dict | None = None          # set when the reflectance was made without a thermal fit
    separator: object = None
    calibration: dict | None = None
    saturation: dict | None = None
    prior: object = None                        # classification.priors.TargetPrior used by the classifier
    statistical_diameter: object = None         # physical.statistical_diameter.StatisticalDiameterResult
    diameter_posterior: object = None           # physical.diameter_posterior.DiameterPosterior (all points)
    corrected_all: pd.DataFrame | None = None    # every point, when the classification used a subset
    log: list = field(default_factory=list)


def saturated_mask(df: pd.DataFrame) -> np.ndarray:
    """Points whose PSF core contains a saturation plane (extraction.saturation_flags)."""
    flags = set(settings()["extraction"].get("saturation_flags", []))
    if "core_flags" not in df or not flags:
        return np.zeros(len(df), bool)
    return df["core_flags"].fillna("").astype(str).map(lambda s: bool(set(s.split("|")) & flags)).values


def _implausible_saturation(clean: pd.DataFrame, H, G, phase=None) -> tuple[pd.DataFrame, int]:
    """Points whose PSF core carries a saturation plane although the object is predicted fainter than
    extraction.saturation_possible_brighter_than_v at that geometry (reflected-light wavelengths below
    extraction.saturation_v_test_max_um). The object cannot have saturated the core, so another source did
    (a field star - most often for fast near-Earth asteroids crossing star fields - or an artefact), and the
    photometry measures that source: the points are removed, not kept as wing-only photometry of the object.
    On 2026-11-15 such points of 35107 (V ~15) were 10-40x brighter than their neighbours. Requires H."""
    cfg = settings()["extraction"]
    vlim = cfg.get("saturation_possible_brighter_than_v")
    if H is None or vlim is None or not len(clean) or not {"r_au", "delta_au", "phase_deg"} <= set(clean.columns):
        return clean, 0
    sat = saturated_mask(clean)
    if not sat.any():
        return clean, 0
    with np.errstate(divide="ignore", invalid="ignore"):
        v = (float(H) + 5 * np.log10(clean["r_au"].values * clean["delta_au"].values)
             - 2.5 * np.log10((phase or PhaseLaw(G=G)).phi(clean["phase_deg"].values)))
    bad = sat & (v > float(vlim)) & (clean["wavelength_um"].values < float(cfg.get("saturation_v_test_max_um", 3.0)))
    return clean[~bad].reset_index(drop=True), int(bad.sum())


def _handle_saturated(clean: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Apply temporal.saturated_points to the points with a saturated PSF core (wing-only photometry):
      inflated        - used everywhere with an error floor (temporal.saturated_flux_error_frac, the scatter
                        measured on the calibration stars); the classification is also repeated without
                        them (saturation_sensitivity) and its confidence lowered if the result changes;
      lightcurve_only - used, with the floor, for the observation-time analysis only;
      exclude         - not used;   all - used everywhere with nominal errors.
    Saturated points are marked in the column saturated_core."""
    cfg = settings()["temporal"]
    mode = cfg.get("saturated_points", "inflated")
    sat = saturated_mask(clean)
    info = {"n_saturated": int(sat.sum()), "mode": mode, "drop_from_spectrum": False}
    if not sat.any() or mode == "all":
        info["use"] = "used everywhere with nominal errors" if sat.any() else "none"
        return clean, info
    if mode == "exclude":
        info["use"] = "excluded"
        return clean[~sat].reset_index(drop=True), info
    floor = float(cfg.get("saturated_flux_error_frac", 0.08))
    by_band = cfg.get("saturated_flux_error_frac_by_band") or {}
    fl = (clean["band"].map(lambda b: float(by_band.get(b, floor))).values if "band" in clean
          else np.full(len(clean), floor))
    out = clean.copy()
    out["saturated_core"] = sat
    out.loc[sat, "flux_err_uJy"] = np.hypot(out.loc[sat, "flux_err_uJy"].values, fl[sat] * out.loc[sat, "flux_uJy"].abs().values)
    info["error_floor_frac"] = {str(k): float(v) for k, v in by_band.items()} if by_band else floor
    if mode == "lightcurve_only":
        info["drop_from_spectrum"] = True
        info["use"] = ("used for the brightness (lightcurve) analysis only, with the per-band error of wing-only "
                       "photometry; excluded from the thermal fit, reflectance and classification")
    else:
        info["use"] = ("used with the per-band error of wing-only photometry measured on the calibration stars; "
                       "the classification is repeated without them")
    return out, info


def saturation_limit(refl: pd.DataFrame, tax, window=(0.75, 2.45)) -> dict:
    """Spectrum-level criterion: if more than classification.max_saturated_fraction of the points in the
    classification window have a saturated PSF core, the spectrum is saturation-limited and the
    confidence is capped at Low. The wing-only photometry of those points scatters about three times more
    than clean photometry, with object-dependent offsets of several percent, and they then set the
    brightness of whole segments (0.75-2.45 um points: 433 Eros 2026-02 38%, 16 Psyche 93%). The value is
    recorded for every spectrum."""
    lim = float(settings()["classification"].get("max_saturated_fraction", 0.2))
    w = refl[(refl["wavelength_um"] >= window[0]) & (refl["wavelength_um"] <= window[1])]
    n_sat = int(w["saturated_core"].astype(bool).sum()) if "saturated_core" in w else 0
    frac = n_sat / max(len(w), 1)
    res = {"n_points": int(len(w)), "n_saturated": n_sat, "fraction": float(frac), "limit": lim,
           "saturation_limited": bool(frac > lim)}
    tax.saturation_limit = res
    if res["saturation_limited"]:
        tax.confidence = status.CONF_LOW
        msg = (f"saturation-limited spectrum: {n_sat} of {len(w)} points in {window[0]}-{window[1]} um "
               f"({100 * frac:.0f}%) have a saturated PSF core (limit {100 * lim:.0f}%)")
        tax.confidence_reasons.append(msg)
        tax.limitations.append(msg[0].upper() + msg[1:] + "; a fainter observing window is needed.")
    return res


def saturation_sensitivity(refl: pd.DataFrame, tax, slope_sys_per_um, band_I, prior=None) -> dict | None:
    """Classification with and without the saturated points (mode 'inflated'). Their wing-only photometry
    scatters by 7-8% with star-dependent offsets of several percent, so a conclusion that changes when they
    are left out depends on that photometry: the confidence is then Low."""
    if "saturated_core" not in refl or not refl["saturated_core"].astype(bool).any():
        return None
    base = tax.complex_ranking[0]["complex"]
    t = classify(refl[~refl["saturated_core"].astype(bool)], slope_sys_per_um=slope_sys_per_um,
                 band_evidence={"band_I_detected": bool(band_I is not None and band_I.detected)}, prior=prior)
    alt = t.complex_ranking[0]["complex"] if t.complex_ranking else None
    res = {"baseline_complex": base, "n_saturated": int(refl["saturated_core"].astype(bool).sum()),
           "without_saturated": {"complex": alt, "status": t.status,
                                 "probability": float(t.complex_ranking[0]["probability"]) if t.complex_ranking else None},
           "stable": alt == base}
    tax.saturation_sensitivity = res
    if alt != base:
        tax.confidence = status.CONF_LOW
        tax.confidence_reasons.append(f"most probable complex changes ({base} -> {alt or t.status}) without the "
                                      f"{res['n_saturated']} saturated (wing-only) points")
        tax.limitations.append(f"The classification depends on {res['n_saturated']} points with a saturated PSF core: "
                               f"without them the most probable complex is {alt or t.status}.")
    return res


def resolve_calibration(calibration, spectrum: pd.DataFrame) -> SolarAnalogCorrection | None:
    """calibration: a SolarAnalogCorrection (used as given), None/False (none), or "auto": the stored
    correction (settings reflectance.solar_analog_correction) if enabled, and only for OBSERVED data -
    it is an instrument calibration of real SPHEREx images, so it is never applied to SIMULATED data
    by default."""
    if isinstance(calibration, SolarAnalogCorrection):
        return calibration
    if calibration != "auto":
        return None
    if not settings()["reflectance"].get("apply_solar_analog_correction", False):
        return None
    origin = spectrum["origin"] if "origin" in spectrum else pd.Series([status.ORIGIN_OBSERVED])
    if len(origin) and not (origin == status.ORIGIN_OBSERVED).all():
        return None
    return load_correction()


def _model_averaging_error(corrected: pd.DataFrame, temporal, temporal_alt, nh_alt) -> tuple[pd.DataFrame, dict]:
    """Lightcurve-model uncertainty as a visit-correlated error. With BIC weights w_alt = 1 / (1 + exp(dBIC/2))
    for the runner-up and 1 - w_alt for the chosen model, the variance of the two-model mixture of the
    per-point correction is w_alt (1 - w_alt) d^2, d = correction_alt - correction. It is added in quadrature
    to temporal_corr_err_ln (and the flux error). When the data clearly prefer one model (dBIC >> 2) it
    vanishes; when two models are equally supported (246 Asporina: dBIC = 2 between 3 and 4 harmonics) the
    inter-segment levels, and therefore the slope, carry their difference."""
    bic = (temporal.lightcurve or {}).get("harmonics_bic") or {}
    nh = (temporal.lightcurve or {}).get("harmonics")
    if nh not in bic or nh_alt not in bic:
        return corrected, {"weight_alt": 0.0, "rms_mag": 0.0}
    dbic = float(bic[nh_alt] - bic[nh])
    w = 1.0 / (1.0 + np.exp(0.5 * dbic))
    d = (temporal_alt.points["corr_ln"].values - temporal.points["corr_ln"].values)
    sig_m = np.sqrt(w * (1.0 - w)) * np.abs(d)
    out = corrected.copy()
    rel = out["flux_err_uJy"].values / np.abs(out["flux_uJy"].values)
    out["temporal_corr_err_ln"] = np.hypot(out["temporal_corr_err_ln"].values, sig_m)
    out["flux_err_uJy"] = np.abs(out["flux_uJy"].values) * np.hypot(rel, sig_m)
    out["lightcurve_model_err_ln"] = sig_m
    return out, {"weight_alt": float(w), "delta_bic": dbic, "rms_mag": float(1.0857 * np.sqrt(np.mean(sig_m ** 2)))}


def _alternative_lightcurve(clean, temporal, rotation_period_h, G, eta0, temporal_cfg, phase=None):
    """The observation-time correction recomputed with the BIC runner-up number of harmonics, when a periodic
    correction was applied and the runner-up is itself supported by the repeats (else None)."""
    lc = temporal.lightcurve or {}
    bic = lc.get("harmonics_bic") or {}
    if not str(temporal.correction).startswith("periodic") or len(bic) < 2:
        return None, None
    nh = lc.get("harmonics")
    nh_alt = min((k for k in bic if k != nh), key=lambda k: bic[k])
    cfg = dict(temporal_cfg or settings()["temporal"])
    cfg["_force_harmonics"] = nh_alt
    alt = analyse_temporal(clean, rotation_period_h=rotation_period_h, G=G, eta0=eta0, cfg=cfg, phase=phase)
    if not str(alt.correction).startswith("periodic") or alt.points is None or len(alt.points) != len(clean):
        return None, None
    return alt, int(nh_alt)


def lightcurve_sensitivity(refl: pd.DataFrame, temporal, tax, slope_sys_per_um, band_I, prior=None) -> dict | None:
    """Stability of the classification against the rotational-lightcurve model (spec 11.2: sensitivity
    analysis). When a periodic lightcurve correction was applied, the per-point corrections are scaled by
    1 -/+ temporal.lightcurve_sensitivity_frac and the spectrum is re-classified. The statistical error of
    the Fourier fit is already in the covariance; this covers the model itself (harmonics, shape), which
    the repeats constrain less well. On 433 Eros two defensible data treatments changed the fitted SWIR
    amplitude by 7% (1.26 vs 1.35 mag) and the class from S to V. If the most probable complex changes,
    the confidence is set to Low. The reflected-light spectrum is perturbed directly (the thermal part
    below 2.45 um is small), so no thermal refit is needed."""
    if not str(temporal.correction).startswith("periodic") or "temporal_corr_mag" not in refl:
        return None
    frac = float(settings()["temporal"].get("lightcurve_sensitivity_frac", 0.10))
    base = tax.complex_ranking[0]["complex"]
    corr_ln = refl["temporal_corr_mag"].fillna(0.0).values / 1.0857
    res = {"fraction": frac, "baseline_complex": base, "perturbed": {}}
    for k in (1.0 - frac, 1.0 + frac):
        r = refl.copy()
        r["reflectance"] = r["reflectance"].values * np.exp(-(k - 1.0) * corr_ln)
        t = classify(r, slope_sys_per_um=slope_sys_per_um,
                     band_evidence={"band_I_detected": bool(band_I is not None and band_I.detected)}, prior=prior)
        res["perturbed"][f"x{k:.2f}"] = {"complex": t.complex_ranking[0]["complex"] if t.complex_ranking else None,
                                         "probability": float(t.complex_ranking[0]["probability"]) if t.complex_ranking else None}
    if "temporal_corr_mag_alt" in refl and refl["temporal_corr_mag_alt"].notna().any():
        # the lightcurve model with the BIC runner-up number of harmonics (model form, not just amplitude)
        d = (refl["temporal_corr_mag_alt"].fillna(refl["temporal_corr_mag"]) - refl["temporal_corr_mag"]).values / 1.0857
        r = refl.copy()
        r["reflectance"] = r["reflectance"].values * np.exp(-d)
        t = classify(r, slope_sys_per_um=slope_sys_per_um,
                     band_evidence={"band_I_detected": bool(band_I is not None and band_I.detected)}, prior=prior)
        nh_alt = int(refl["lightcurve_alt_harmonics"].dropna().iloc[0]) if "lightcurve_alt_harmonics" in refl else None
        res["perturbed"][f"{nh_alt}_harmonics"] = {
            "complex": t.complex_ranking[0]["complex"] if t.complex_ranking else None,
            "probability": float(t.complex_ranking[0]["probability"]) if t.complex_ranking else None,
            "rms_change_mag": float(1.0857 * np.sqrt(np.mean(d ** 2)))}
    changed = [v["complex"] for v in res["perturbed"].values() if v["complex"] != base]
    res["stable"] = not changed
    tax.lightcurve_sensitivity = res
    if changed:
        tax.confidence = status.CONF_LOW
        tax.confidence_reasons.append(
            f"most probable complex changes ({base} -> {', '.join(sorted(set(changed)))}) with the lightcurve "
            f"correction scaled by 1 -/+ {frac:.2f} or computed with the BIC runner-up number of harmonics")
        tax.limitations.append("The classification depends on the rotational-lightcurve model: with the correction "
                               f"scaled by 1 -/+ {frac:.2f}, or with the BIC runner-up number of harmonics, the most "
                               f"probable complex becomes {', '.join(sorted(set(changed)))}.")
    return res


def visit_jackknife(refl: pd.DataFrame, tax, slope_sys_per_um, band_I, window=(0.75, 2.45), prior=None) -> dict | None:
    """Leave-one-visit-out stability of the classification (spec 11.2: stability against changes of the
    input). A visit is the unit that shares a rotational phase and a calibration state, so a result that
    one visit decides is not robust - e.g. a sparsely sampled band once the saturated points of a bright,
    fast rotator are removed (433 Eros: 3 points left at 0.92-1.04 um). Each visit with points in the
    classification window is removed in turn and the spectrum re-classified; if the most probable complex
    changes in any of these samples, the confidence is set to Low."""
    if "visit" not in refl:
        return None
    w = refl[(refl["wavelength_um"] >= window[0]) & (refl["wavelength_um"] <= window[1])]
    visits = sorted(w["visit"].dropna().unique())
    if len(visits) < 3:
        return None
    base = tax.complex_ranking[0]["complex"]
    ev = {"band_I_detected": bool(band_I is not None and band_I.detected)}
    changes = {}
    for v in visits:
        t = classify(refl[refl["visit"] != v], slope_sys_per_um=slope_sys_per_um, band_evidence=ev, prior=prior)
        top = t.complex_ranking[0]["complex"] if t.complex_ranking else None
        if top != base:
            changes[int(v)] = {"complex": top, "n_points_removed": int((w["visit"] == v).sum())}
    res = {"baseline_complex": base, "n_samples": len(visits), "n_agree": len(visits) - len(changes),
           "changed": changes, "stable": not changes}
    tax.visit_jackknife = res
    if changes:
        tax.confidence = status.CONF_LOW
        alt = sorted({c["complex"] or "none" for c in changes.values()})
        tax.confidence_reasons.append(f"most probable complex changes when single visits are left out "
                                      f"({len(changes)} of {len(visits)} samples: {', '.join(alt)})")
        tax.limitations.append(f"The classification is not stable against leaving out single visits: {len(changes)} of "
                               f"{len(visits)} leave-one-visit-out samples give {', '.join(alt)} instead of {base}.")
    return res


def _not_applied_reason(calibration, corr, df: pd.DataFrame) -> str:
    if calibration is None or calibration is False:
        return "not requested"
    if corr is not None:
        return "spectrum has no detector column" if len(df) else "empty spectrum"
    if not settings()["reflectance"].get("apply_solar_analog_correction", False):
        return "disabled in settings (reflectance.apply_solar_analog_correction)"
    if "origin" in df and len(df) and not (df["origin"] == status.ORIGIN_OBSERVED).all():
        return "the stored correction is applied to OBSERVED data only"
    return "no stored correction (build it with: python main.py solar-analog-calibration)"


MIN_CONTINUUM_POINTS = 4      # ThermalSeparator.fit needs this many points in the reflected continuum


def _reference_group(df: pd.DataFrame, sep: ThermalSeparator):
    """Normalisation group for the thermal fit: one that has the continuum points the fit needs
    (>= MIN_CONTINUUM_POINTS in the reflected continuum window), and among those the best joint coverage of
    continuum and thermal region (a diameter needs both under one normalisation), then the most continuum
    points. 92 Undina (2026-11-15): the old rule took a group with 3 continuum and 33 thermal points, the
    fit failed and no reflectance was made at all."""
    lo, hi = sep.cfg["reflected_continuum_region_um"]
    rows = []
    for g, gg in df.groupby("norm_group"):
        n_c = int(((gg["wavelength_um"] >= lo) & (gg["wavelength_um"] <= hi)).sum())
        n_t = int((gg["wavelength_um"] >= sep.cfg["thermal_region_min_um"]).sum())
        rows.append((n_c >= MIN_CONTINUUM_POINTS, min(n_c, n_t), n_c, g))
    best = max(rows, key=lambda r: r[:3])
    return best[3], best[1]


def thermal_upper_bound_fraction(df: pd.DataFrame, H: float) -> np.ndarray:
    """Upper bound on thermal flux / observed flux per point: the whole disk at the NEATM subsolar
    temperature of the hottest plausible surface (bond albedo 0, beaming eta 0.756, emissivity 0.9) and the
    largest plausible body (pV 0.02 with this H)."""
    D_km = 1329.0 / np.sqrt(0.02) * 10 ** (-H / 5)
    r = df["r_au"].to_numpy(float)
    T = 393.6 * (1.0 / (0.756 * 0.9)) ** 0.25 / np.sqrt(r)
    lam_m = df["wavelength_um"].to_numpy(float) * 1e-6
    h, c, k = 6.62607015e-34, 2.99792458e8, 1.380649e-23
    nu = c / lam_m
    x = np.clip(h * nu / (k * T), None, 700)
    B_nu = 2 * h * nu ** 3 / c ** 2 / np.expm1(x)                       # W m-2 Hz-1 sr-1
    omega = np.pi * (D_km / 2 / (df["delta_au"].to_numpy(float) * 1.495978707e8)) ** 2
    F_uJy = 0.9 * omega * B_nu * 1e26 * 1e6
    return F_uJy / np.abs(df["flux_uJy"].to_numpy(float))


def _reflected_only(corrected: pd.DataFrame, h_result, max_fraction: float = 0.01):
    """Points below 2.5 um whose thermal upper bound is < max_fraction of the observed flux, prepared for
    reflectance_spectrum without thermal removal. None if H is unknown (no bound possible)."""
    H = getattr(h_result, "H", None) if h_result is not None else None
    if H is None or not np.isfinite(H) or corrected.empty:
        return None, {}
    p = corrected[corrected["wavelength_um"] <= 2.5].copy()
    if p.empty:
        return None, {}
    frac = thermal_upper_bound_fraction(p, float(H))
    keep = frac < max_fraction
    p = p[keep].copy()
    p["reflected_flux_uJy"] = p["flux_uJy"]
    p["reflected_flux_err_uJy"] = p["flux_err_uJy"]
    p["model_thermal_uJy"] = 0.0
    info = {"n_points": int(keep.sum()), "n_dropped": int((~keep).sum()),
            "max_fraction_kept": float(frac[keep].max()) if keep.any() else None,
            "lambda_max_um": float(p["wavelength_um"].max()) if len(p) else None}
    return p, info


def classification_subset(spectrum: pd.DataFrame, max_images: int | None = None) -> pd.DataFrame:
    """The images the reflectance and the classification use. Data from one observing season: every image. Data
    spanning several seasons: the earliest `classification.max_images` images (stage-1 table order, kept as
    image_rank; time order without it) - the sampling the classifier was validated on (until 2026-11-15 the extraction
    itself stopped at the first 120 images, 191 for 433 Eros, whose window is one season). With every season in the
    classification, two of the first nine validation targets re-run became confidently wrong (236 Honoria L -> O,
    216 Kleopatra Xe -> A; visit-to-visit brightness rms 0.44-0.47 mag across seasons), so the cap keeps seasons
    apart while the diameter uses every image (docs/METHODS.md section 3b)."""
    n = max_images if max_images is not None else settings()["classification"].get("max_images")
    if not n or len(spectrum) <= int(n):
        return spectrum
    if "mjd" in spectrum:
        gap = float(settings()["temporal"].get("season_gap_days", 30.0))
        t = np.sort(spectrum["mjd"].to_numpy(float))
        if not (np.diff(t[np.isfinite(t)]) > gap).any():
            return spectrum                                  # one observing season: no cap
    if "image_rank" in spectrum and spectrum["image_rank"].notna().all():
        key = spectrum["image_rank"].to_numpy(float)          # stage-1 table order, as the extraction cap used
    elif "mjd" in spectrum:
        key = spectrum["mjd"].to_numpy(float)
    else:
        return spectrum
    order = np.argsort(key, kind="stable")
    return spectrum.iloc[np.sort(order[: int(n)])]


def _prepare_points(spectrum: pd.DataFrame, h_result, G, sep, calibration, temporal_cfg, rotation_period_h, L):
    """Quality selection, outliers, saturation, solar-analog calibration and the data-supported brightness corrections:
    (clean, temporal, corrected, sat_info, cal_info, corr) - corr is the solar-analog correction used, or None."""
    clean = select_usable(spectrum)
    alpha = float(np.median(clean["phase_deg"])) if len(clean) and "phase_deg" in clean else 0.0
    eta0 = sep.eta_prior(alpha)["eta0"] if sep.cfg.get("eta_mode") == "phase_prior" else sep.cfg["eta_default"]
    clean, n_contam = _implausible_saturation(clean, getattr(h_result, "H", None), G, sep.phase)
    if n_contam:
        L(f"  [quality] {n_contam} points with a saturated PSF core although the object is predicted too faint to "
          "saturate: the flag comes from another source in the core (star, artefact); points not used.")
    scale_col = None
    if len(clean) and {"r_au", "delta_au", "phase_deg"} <= set(clean.columns) and \
            clean[["r_au", "delta_au", "phase_deg"]].notna().all().all():
        # reflected-light scaling Phi(alpha) / (r Delta)^2 at every wavelength: the test only needs the gross trend
        # with distance; the NEATM scaling at >= 3 um mis-scaled reflected-dominated 3.0-3.5 um points of main-belt
        # objects (92 Undina: a point at r 3.31 au predicted 1.7x brighter than its neighbours and rejected)
        clean = clean.assign(_geom_ln=geometric_log_scale(clean, G, eta0, sep.cfg["emissivity"],
                                                          thermal_min_um=np.inf, phase=sep.phase))
        scale_col = "_geom_ln"
    clean = reject_outliers(clean, "flux_uJy", "flux_err_uJy", scale_col=scale_col)
    n_out = int(clean["outlier"].sum())
    clean = clean[~clean["outlier"]].drop(columns=[c for c in ("_geom_ln",) if c in clean]).reset_index(drop=True)
    if n_out:
        L(f"  [quality] {n_out} outliers against the running median of geometry-normalised fluxes removed.")
    clean, sat_info = _handle_saturated(clean)
    if sat_info["n_saturated"]:
        L(f"  [saturation] {sat_info['n_saturated']} points with a saturated PSF core: {sat_info['use']}.")
    corr = resolve_calibration(calibration, clean)
    if corr is not None and len(clean) and "detector" in clean:
        clean, cal_info = apply_correction(clean, corr)
        L(f"  [calibration] solar-analog relative correction applied ({cal_info['n_stars']} stars; largest "
          f"|C - 1| = {100 * cal_info['max_abs_correction']:.1f}%; slope uncertainty "
          f"{100 * calibration_slope_sigma(corr):.2f} %/um)")
        for w in cal_info["warnings"]:
            L("  [calibration] " + w)
    else:
        cal_info = {"applied": False, "reason": _not_applied_reason(calibration, corr, clean)}
        if calibration == "auto":
            L(f"  [calibration] solar-analog relative correction not applied: {cal_info['reason']}.")
    temporal = analyse_temporal(clean, rotation_period_h=rotation_period_h, G=G, eta0=eta0, cfg=temporal_cfg, phase=sep.phase)
    for w in temporal.warnings:
        L("  [time] " + w)
    temporal_alt, nh_alt = _alternative_lightcurve(clean, temporal, rotation_period_h, G, eta0, temporal_cfg, sep.phase)
    corrected = apply_temporal_correction(clean, temporal)
    if temporal_alt is not None:
        corrected["temporal_corr_mag_alt"] = 1.0857 * temporal_alt.points["corr_ln"].values
        corrected["lightcurve_alt_harmonics"] = nh_alt
        corrected, ma = _model_averaging_error(corrected, temporal, temporal_alt, nh_alt)
        if ma["weight_alt"] > 1e-3:
            L(f"  [time] lightcurve model uncertainty: BIC weight {ma['weight_alt']:.2f} for {nh_alt} harmonics; "
              f"rms {ma['rms_mag']:.3f} mag added to the visit-correlated errors.")
        L(f"  [time] lightcurve model check: {temporal.lightcurve.get('harmonics')} harmonics chosen by BIC; the "
          f"runner-up ({nh_alt} harmonics) is used for the sensitivity test of the classification.")
    if sat_info.get("drop_from_spectrum") and "saturated_core" in corrected:
        # saturated points informed the brightness corrections only; the spectrum uses the others
        corrected = corrected[~corrected["saturated_core"].astype(bool)].reset_index(drop=True)
    return clean, temporal, corrected, sat_info, cal_info, corr


def _fit_group(corrected: pd.DataFrame, sep, L=None):
    """(reference normalisation group or None, the points of the least-squares NEATM fit)."""
    if corrected["norm_group"].nunique() > 1:
        g, _ = _reference_group(corrected, sep)
        if L is not None:
            L(f"  [thermal] fitted on normalisation group {g} only ({int((corrected['norm_group'] == g).sum())} "
              "points): other groups are not linked to it by the data.")
        return g, corrected[corrected["norm_group"] == g]
    return None, corrected


def analyse_spectrum(spectrum: pd.DataFrame, *, h_result=None, sbdb=None, rotation_period_h: float | None = None,
                     G: float | None = None, log=print, temporal_cfg: dict | None = None,
                     separator: ThermalSeparator | None = None, calibration="auto",
                     prior=None) -> SpectrumAnalysis:
    """prior: classification.priors.TargetPrior (population, orbit and albedo terms of the classifier, and the
    statistical diameter); None = classification with a flat prior over classes and no statistical diameter.
    The classification uses the earliest classification.max_images images (classification_subset); the
    diameter, the thermal fit reported and the albedo use every point (_diameter_chain)."""
    msgs = []

    def L(m):
        msgs.append(m)
        log(m)

    full = spectrum
    spectrum = classification_subset(full)
    if len(spectrum) < len(full):
        L(f"  [data] observations span several seasons: classification from the earliest "
          f"{settings()['classification'].get('max_images')} images "
          f"({len(spectrum)} of {len(full)} points, the validated sampling); diameter and albedo from all points.")
    sep = separator or ThermalSeparator()          # lightcurve handled upstream from repeated observations
    G = G if G is not None else (h_result.G if h_result is not None and h_result.G is not None
                                 else sep.cfg["default_G"])
    sep.phase = PhaseLaw(G=G) if h_result is None else PhaseLaw.from_h_result(h_result, G)
    clean, temporal, corrected, sat_info, cal_info, corr = _prepare_points(spectrum, h_result, G, sep, calibration,
                                                                           temporal_cfg, rotation_period_h, L)
    out = SpectrumAnalysis(clean=clean, temporal=temporal, corrected=corrected, separator=sep, log=msgs,
                           calibration=cal_info, saturation=sat_info, prior=prior)

    def finish():
        _diameter_chain(out, full if len(spectrum) < len(full) else None, h_result, sbdb, sep, G, L, calibration,
                        temporal_cfg, rotation_period_h)
        _statistical_diameter(out, h_result, G, L)
        return out

    if corrected.empty:
        return finish()

    g, fit_df = _fit_group(corrected, sep, L)
    out.thermal_fit_group = g
    albedo, dres = albedo_from_thermal_fit(fit_df, h_result, sep, sbdb=sbdb, phase=sep.phase)
    out.albedo, out.diameter = albedo, dres
    thermal = dres.thermal_fit if dres is not None else None
    out.thermal = thermal
    if thermal is None or thermal.points is None or thermal.status == status.INSUFFICIENT_DATA:
        # No thermal fit (e.g. no normalisation group covers both the reflected continuum and the thermal
        # region). Below 2.5 um the thermal flux of a main-belt asteroid is usually negligible: use the points
        # whose upper bound on it is < 1% of the observed flux, without thermal removal.
        pts, info = _reflected_only(corrected, h_result)
        why = (thermal.warnings[0] if thermal is not None and thermal.warnings else "no thermal fit")
        if pts is None or len(pts) < MIN_CONTINUUM_POINTS:
            return finish()
        L(f"  [thermal] {why} Reflectance from {info['n_points']} points below {info['lambda_max_um']:.2f} um "
          f"without thermal removal: upper bound on the thermal fraction {info['max_fraction_kept']:.1e} "
          f"(bond albedo 0, eta 0.756, pV 0.02); {info['n_dropped']} points with a bound >= 1% left out.")
        out.reflected_only = info
        thermal_ok = False
    else:
        pts = thermal.points
        if len(fit_df) != len(corrected):
            other = sep.components(corrected, thermal)
            if other is not None:
                pts = other
        thermal_ok = thermal.status == "OK"
    refl = reflectance_spectrum(pts, sep.solar, sep.G, phase=sep.phase)
    if not refl["reflectance"].notna().any():
        # e.g. no points on both sides of the normalisation wavelength: there is no spectrum to classify
        L(f"  [reflectance] {refl.attrs.get('normalization', 'not normalised')}: no reflectance spectrum.")
        return finish()
    out.reflectance = refl

    pre = analyse_minerals(refl, thermal_removed=thermal_ok)
    b1 = pre.band("Band I")
    out.slope_sys_per_um = slope_systematic_per_um(refl, temporal)
    if cal_info.get("applied") and out.slope_sys_per_um is not None:
        # the mean correction's slope is uncertain by the star-to-star colour scatter / sqrt(N)
        out.slope_sys_per_um = float(np.hypot(out.slope_sys_per_um, calibration_slope_sigma(corr, "SWIR")))
    prior = _albedo_for_classification(prior, albedo, L)
    out.prior = prior
    tax = classify(refl, slope_sys_per_um=out.slope_sys_per_um,
                   band_evidence={"band_I_detected": bool(b1 is not None and b1.detected)}, prior=prior)
    # the classifier's own confidence, before the downgrades below; counterfactual tests that call
    # classify() directly (taxonomy validation C6) compare against this value
    tax.confidence_classifier = tax.confidence
    if thermal_ok and thermal.chi2_red is not None and thermal.chi2_red > sep.cfg["chi2_red_warning"]:
        msg = (f"Thermal model fits poorly (chi2_red {thermal.chi2_red:.1f}); reflectance derived from it "
               "is less reliable.")
        if tax.candidates:
            tax.confidence = status.CONF_LOW
            tax.confidence_reasons.append(msg)
        tax.limitations.append(msg)
        if albedo is not None and albedo.status == "ESTIMATED":
            albedo.status = "ON_HOLD_VALIDATION"
            albedo.warnings.append(msg + " Albedo on hold.")
    if tax.candidates:
        lightcurve_sensitivity(refl, temporal, tax, out.slope_sys_per_um, b1, prior=prior)
        visit_jackknife(refl, tax, out.slope_sys_per_um, b1, prior=prior)
        saturation_sensitivity(refl, tax, out.slope_sys_per_um, b1, prior=prior)
        saturation_limit(refl, tax)
    out.taxonomy = tax
    out.minerals = analyse_minerals(
        refl, albedo_pV=albedo.geometric_albedo if albedo is not None and albedo.status == "ESTIMATED" else None,
        thermal_removed=thermal_ok,
        spectrum_fit_chi2_red=tax.candidates[0]["chi2_red"] if tax.candidates else None)
    return finish()


def _albedo_for_classification(prior, albedo, L):
    """Adds the SPHEREx thermal albedo to the prior when the prior has no (catalogue) albedo and the
    thermal albedo is estimated with at least Medium confidence (classification.prior.albedo_sources)."""
    if prior is None or prior.albedo is not None:
        if prior is not None and prior.albedo is not None:
            L(f"  [prior] albedo term: pV {prior.albedo['pV']:.3f} (sigma {prior.albedo['sigma_log10']:.2f} dex; "
              f"{prior.albedo['source']}).")
        return prior
    cfg = settings()["classification"].get("prior", {})
    if not cfg.get("albedo", True) or "spherex_thermal" not in cfg.get("albedo_sources", []):
        return prior
    if albedo is None or albedo.status != "ESTIMATED" or not albedo.geometric_albedo or not albedo.albedo_err:
        return prior
    if albedo.confidence not in (status.CONF_MEDIUM, status.CONF_HIGH):
        return prior
    lp = float(np.log10(albedo.geometric_albedo))
    s = float(albedo.albedo_err / albedo.geometric_albedo / np.log(10))
    L(f"  [prior] albedo term from the SPHEREx thermal fit: pV {albedo.geometric_albedo:.3f} ({s:.2f} dex).")
    return prior.with_albedo(lp, s, "SPHEREx NEATM thermal fit")


def _orbit_of(out: SpectrumAnalysis, sbdb) -> dict | None:
    orbit = getattr(out.prior, "orbit", None) if out.prior is not None else None
    if orbit:
        return orbit
    if sbdb is not None and getattr(sbdb, "found", False):
        el = sbdb.elements or {}
        a, e, i = (el.get(k, {}).get("value") for k in ("a", "e", "i"))
        if a is not None and e is not None:
            return {"a_au": a, "e": e, "i_deg": i}
    return None


def _diameter_chain(out: SpectrumAnalysis, full: pd.DataFrame | None, h_result, sbdb, sep, G, L, calibration,
                    temporal_cfg, rotation_period_h) -> None:
    """Diameter, reported thermal fit and albedo from every point. When the classification used a subset (full is not
    None), the points are prepared again from the full spectrum with their own brightness corrections and the
    least-squares excess test is repeated on them; the diameter posterior then replaces the diameter, the thermal
    components and the albedo (_diameter_posterior)."""
    if not (sep.cfg.get("diameter_posterior", {}) or {}).get("enabled", False):
        return
    corrected = out.corrected
    if full is not None:
        _, temporal_all, corrected_all, _, _, _ = _prepare_points(full, h_result, G, sep, calibration, temporal_cfg,
                                                                  rotation_period_h, lambda m: None)
        if corrected_all.empty:
            return
        L(f"  [diameter] all {len(corrected_all)} points: {temporal_all.n_seasons} observing season(s), "
          f"{temporal_all.n_norm_groups} normalisation group(s), brightness correction '{temporal_all.correction}'.")
        _, fit_df = _fit_group(corrected_all, sep)
        albedo_all, dres_all = albedo_from_thermal_fit(fit_df, h_result, sep, sbdb=sbdb, phase=sep.phase)
        out.albedo, out.diameter = albedo_all, dres_all
        out.thermal = dres_all.thermal_fit if dres_all is not None else None
        out.corrected_all = corrected_all
        corrected = corrected_all
    _diameter_posterior(out, corrected, h_result, sbdb, sep, G, L)


def _diameter_posterior(out: SpectrumAnalysis, corrected: pd.DataFrame, h_result, sbdb, sep, G, L):
    """Diameter posterior from all points (src/physical/diameter_posterior.py). When the thermal-excess test of the
    least-squares fit is passed, the posterior replaces its single-group diameter, eta and components, and the albedo
    is recomputed from it. Returns the per-point components for the reflectance, or None."""
    from ..acquisition.population_catalogue import designation_keys
    from ..physical.albedo import compute_albedo
    from ..physical.diameter_posterior import components, eta_at, thermal_posterior
    from ..physical.eta_prior import target_eta_prior
    from ..physical.thermal_model import subsolar_temperature

    cfg = sep.cfg
    pc = cfg.get("diameter_posterior", {}) or {}
    if not pc.get("enabled", False) or h_result is None or not getattr(h_result, "reliable", False) or corrected.empty:
        return None
    H = float(h_result.H)
    lam = corrected["wavelength_um"].to_numpy(float)
    th_pts = lam >= cfg["thermal_region_min_um"]
    ph = corrected["phase_deg"].to_numpy(float)
    alpha = float(np.median(ph[th_pts] if th_pts.any() else ph))
    excl = designation_keys(sbdb) if sbdb is not None and getattr(sbdb, "found", False) else set()
    eta_p = target_eta_prior(_orbit_of(out, sbdb), alpha, exclude=excl, cfg=cfg, log=L)
    post = thermal_posterior(corrected, H, G, sep, eta_p, n_D=int(pc.get("n_diameters", 300)),
                             n_eta=int(pc.get("n_eta", 41)), phase=sep.phase)
    out.diameter_posterior = post
    if post.status != "OK" or post.thermal is None:
        L("  [diameter] no diameter posterior: " + "; ".join(post.warnings))
        return None
    q = post.thermal
    L(f"  [diameter] thermal likelihood from {post.n_points} points ({post.n_groups} normalisation group(s), "
      f"{post.n_visits_with_offset_error} visits with a shared brightness error); eta prior {eta_p.relation} "
      f"({eta_p.population}, alpha {alpha:.1f} deg): D {q['median']:.1f} km (68%: {q['lo68']:.1f}-{q['hi68']:.1f}), "
      f"eta {post.eta['median']:.2f} (68%: {post.eta['lo68']:.2f}-{post.eta['hi68']:.2f}), "
      f"thermal signal {post.detection_sigma:.1f} sigma, likelihood widened x{post.kappa:.1f}.")
    thermal, dres = out.thermal, out.diameter
    if thermal is None or dres is None:
        return None
    if q["hi95"] >= 0.98 * 10 ** post.lgD[-1]:
        L("  [diameter] posterior not bounded within the grid" + (": the least-squares diameter is kept."
                                                                  if thermal.status == "OK" else "."))
        return None
    ls_ok = thermal.status == "OK"
    joint_ok = (post.detection_sigma is not None and post.thermal_fraction is not None
                and post.detection_sigma >= float(pc.get("min_signal_sigma", 5.0))
                and post.thermal_fraction >= float(pc.get("min_thermal_fraction", 0.20)))
    if not (ls_ok or joint_ok):
        return None
    if not ls_ok:
        # the single-group excess test missed a thermal signal that all points show (the continuum extrapolated
        # from 1.6-2.5 um alone is uncertain by ~50% at 4.7 um); the thermal-fraction condition rejects continuum
        # curvature, which in the synthetic null test faked at most 8% thermal at 4.4-5 um
        msg = (f"Thermal emission detected by the likelihood of all points ({post.detection_sigma:.1f} sigma, "
               f"{100 * post.thermal_fraction:.0f}% of the 4.4-5 um flux), although the single-group excess test "
               f"gave {'S/N %.1f' % thermal.thermal_excess_snr if thermal.thermal_excess_snr is not None else 'no test'}.")
        L("  [diameter] " + msg)
        thermal.status, dres.status = "OK", "OK"
        thermal.warnings = [w for w in thermal.warnings if "no diameter is derived" not in w] + [msg]
        dres.warnings = [w for w in dres.warnings if "no diameter is derived" not in w] + [msg]
        thermal.H_used = H
    ls_D, ls_err = thermal.D_km, dres.diameter_total_err_km
    eta = eta_at(post, q["median"])
    pV = (1329.0 * 10 ** (-H / 5) / q["median"]) ** 2
    A = min(sep.phase.phase_integral() * pV, 0.99)
    r_med = float(np.median(corrected["r_au"].to_numpy(float)[th_pts] if th_pts.any() else corrected["r_au"]))
    thermal.D_km, thermal.D_err_km, thermal.D_err_eta_sys_km = q["median"], q["err_km"], None
    thermal.eta, thermal.eta_err, thermal.eta_fitted = eta, 0.5 * (post.eta["hi68"] - post.eta["lo68"]), True
    thermal.bond_albedo_used = float(A)
    thermal.T_ss_K = float(subsolar_temperature(r_med, eta, A, cfg["emissivity"]))
    thermal.T_ss_err_K = float(thermal.T_ss_K / 4 * thermal.eta_err / eta)
    thermal.chi2_red = float(post.chi2_min / post.dof)
    thermal.n_fit_points = post.n_points
    thermal.eta_prior = post.eta_prior
    note = (f"Diameter from the posterior of all {post.n_points} fit points (eta prior {eta_p.relation})"
            + (f"; the single-group least-squares fit gave D = {ls_D:.1f} +- {ls_err or float('nan'):.1f} km."
               if ls_D else "."))
    thermal.warnings.append(note)
    dres.warnings.append(note)
    dres.diameter_km, dres.diameter_err_km, dres.diameter_sys_err_km = q["median"], q["err_km"], None
    dres.diameter_total_err_km = q["err_km"]
    dres.diameter_interval_68_km, dres.diameter_interval_95_km = (q["lo68"], q["hi68"]), (q["lo95"], q["hi95"])
    dres.eta, dres.eta_fitted, dres.chi2_red = eta, True, thermal.chi2_red
    dres.model = "NEATM (posterior, all points)"
    dres.posterior = post.summary()
    rel = q["err_km"] / q["median"]
    dres.confidence = (status.CONF_HIGH if rel < 0.1 and thermal.chi2_red < 2 else
                       status.CONF_MEDIUM if rel < 0.3 and thermal.chi2_red < 5 else status.CONF_LOW)
    if dres.catalog_diameter_km:
        dres.difference_km = dres.diameter_km - dres.catalog_diameter_km
        sig = float(np.hypot(dres.diameter_total_err_km, dres.catalog_diameter_err_km or 0.0))
        dres.difference_sigma = float(dres.difference_km / sig) if sig > 0 else None
    old = out.albedo
    dD_dH = ((old.provenance or {}).get("inputs") or {}).get("dD_dH") if old is not None else None
    out.albedo = compute_albedo(dres.diameter_km, dres.diameter_total_err_km, H, h_result.H_err,
                                H_source=f"{h_result.source} {h_result.reference}".strip(),
                                D_source="SPHEREx NEATM diameter posterior (all points)", dD_dH=dD_dH,
                                H_err_provided=h_result.H_err_provided)
    if thermal.chi2_red > cfg["chi2_red_warning"] and out.albedo.status == "ESTIMATED":
        out.albedo.status = "ON_HOLD_VALIDATION"
        out.albedo.warnings.append(f"Thermal model fits poorly (chi2_red {thermal.chi2_red:.1f}). Albedo on hold.")
    pts = components(post, corrected, sep, q["median"], q["lo68"], q["hi68"])
    thermal.points = pts
    return pts


def _combined_conflict(post, sd, threshold: float, L) -> None:
    """When the thermal likelihood (alone, with the eta prior) and the H + albedo prior disagree by |z| >= threshold, their
    product is no estimate: it piles up where the two tails meet with a narrow interval. 64 Angelina (E-type, pV 0.48)
    got 42 +- 4 km against 58 km that way (thermal alone 39 km, prior 120 km, z -3.4). The combined result is then the
    geometric mean of the two, with the interval spanning both, and flagged."""
    th = post.thermal
    s_th = 0.5 * np.log10(th["hi68"] / th["lo68"])
    s_st = 0.5 * np.log10(sd.interval_68_km[1] / sd.interval_68_km[0])
    z = float((np.log10(th["median"]) - np.log10(sd.diameter_km)) / np.hypot(s_th, s_st))
    post.combined_inputs["thermal_vs_prior_z"] = z
    if abs(z) < threshold:
        return
    med = float(10 ** (0.5 * (np.log10(th["median"]) + np.log10(sd.diameter_km))))
    lo68, hi68 = min(th["lo68"], sd.interval_68_km[0]), max(th["hi68"], sd.interval_68_km[1])
    lo95, hi95 = min(th["lo95"], sd.interval_95_km[0]), max(th["hi95"], sd.interval_95_km[1])
    post.combined = {"median": med, "lo68": lo68, "hi68": hi68, "lo95": lo95, "hi95": hi95,
                     "err_km": 0.5 * (hi68 - lo68), "conflict": True}
    msg = (f"SPHEREx thermal likelihood ({th['median']:.4g} km) and the H + albedo prior ({sd.diameter_km:.4g} km) disagree "
           f"(z = {z:+.1f}): combined diameter {med:.4g} km with the interval spanning both ({lo68:.4g}-{hi68:.4g} km).")
    post.warnings.append(msg)
    L("  [diameter] " + msg)


def _statistical_diameter(out: SpectrumAnalysis, h_result, G, L) -> None:
    """Statistical diameter (H + population albedo prior) and, with the diameter posterior, the combined estimate
    (thermal likelihood x eta prior x albedo prior). Without a posterior the statistical diameter is weighted by the
    thermal non-detection, as before. For a thermal diameter, the statistical one is its consistency check."""
    prior = out.prior
    cfg = settings().get("statistical_diameter", {})
    if prior is None or prior.model is None or not cfg.get("enabled", True):
        return
    H = getattr(h_result, "H", None) if h_result is not None and h_result.reliable else prior.H
    if H is None:
        return
    H_err = None if (getattr(h_result, "source", "") or "").startswith("JPL SBDB") else getattr(h_result, "H_err", None)
    tax = out.taxonomy
    cp = tax.complex_ranking_no_albedo if tax is not None and tax.complex_ranking_no_albedo else None
    th = out.thermal
    post = out.diameter_posterior
    use_post = post is not None and post.status == "OK"
    test = th.thermal_test if (not use_post and th is not None and th.status == "INSUFFICIENT_THERMAL") else None
    sd = estimate_statistical_diameter(H, prior, cp, H_err=H_err, thermal_test=test, G=G,
                                       eta_prior=test.get("eta_prior") if test else None, phase=out.separator.phase)
    if use_post:
        from ..physical.diameter_posterior import combine
        comb = combine(post, prior, cp, float(H), H_err)
        detected = th is not None and th.status == "OK"
        if not detected and post.thermal and post.thermal["hi95"] < 0.98 * 10 ** post.lgD[-1]:
            sd.thermal_upper_limit_km = post.thermal["hi95"]
        if comb is not None:
            L(f"  [diameter] combined (thermal likelihood x eta prior x albedo prior): {comb['median']:.1f} km "
              f"(68%: {comb['lo68']:.1f}-{comb['hi68']:.1f})")
    dres = out.diameter
    if dres is not None and dres.diameter_km:
        sd.consistency = consistency_with_thermal(sd, dres.diameter_km, dres.diameter_total_err_km)
    if use_post and post.combined and post.thermal and sd.diameter_km is not None:
        _combined_conflict(post, sd, float(cfg.get("combined_conflict_sigma", 3.0)), L)
    out.statistical_diameter = sd
    if sd.diameter_km is None:
        L("  [diameter] statistical diameter not estimable: " + "; ".join(sd.warnings))
        return
    lo, hi = sd.interval_68_km
    L(f"  [diameter] statistical estimate {sd.diameter_km:.1f} km (68%: {lo:.1f}-{hi:.1f}; prior pV "
      f"{sd.pV_median:.3f})" + (f"; thermal 95% upper limit {sd.thermal_upper_limit_km:.1f} km"
                                if sd.thermal_upper_limit_km else ""))
    if sd.consistency is not None:
        c = sd.consistency
        L(f"  [diameter] thermal {c['thermal_km']:.1f} km vs statistical {c['statistical_km']:.1f} km: "
          f"z = {c['z']:+.1f} ({'consistent' if c['consistent'] else 'INCONSISTENT'} at {c['threshold']:g} sigma)")
