"""Relative spectral calibration from SPHEREx observations of solar-analog stars.

Asteroid reflectance is R(lambda) = F_ast(lambda) / F_sun(lambda). Two things can bias it at the
few-percent level over narrow wavelength ranges:
  * the SPHEREx flux calibration and the PSF photometry, which vary with position on the Linear
    Variable Filters (and therefore with wavelength);
  * the solar model used for F_sun (E490, averaged over each SPHEREx bandpass).
Ground-based asteroid spectroscopy removes both by dividing by a solar-analog star observed with
the same instrument. This module does the same with SPHEREx data:

  1. Stars: solar analogs from the literature (config/solar_analogs.yaml, from Marsset et al. 2020,
     ApJS 247, 73, Table 1: the stars of the SMASS and MITHNEOS surveys), with Gaia DR3 astrometry.
  2. Photometry: the same forced-PSF code as for asteroids (src/extraction), without a trail.
  3. Per point i of star s:  q_si = F_si / F_sun(lambda_si; bandwidth_si), with the same E490
     bandpass average as Stage 3 (ThermalSeparator.reflected_scale).
  4. Joint fit  ln q_si = a_s + c_d(b) + noise:  a_s is a free scale per star and c_d(b) is the
     response term of detector d in wavelength bin b (width lambda / (bin_factor R)). Gauge:
     c = 0 at the reflectance normalisation wavelength (1.2 um), so the correction never changes
     the normalisation. Weighted least squares with iterative clipping; errors are rescaled by the
     residual scatter (reduced chi-square).
  5. Colour scatter of the stars: a linear trend of each star's residuals (SWIR and MWIR separately)
     measures how different the analogs are; its standard deviation / sqrt(N_stars) is the slope
     uncertainty of the mean correction. It is added to the classification's systematic slope
     uncertainty when the correction is applied.

Application (shared analysis chain, OBSERVED data only): F' = F / C(lambda), with C = exp(c)
interpolated within each detector, and sigma'^2 = (sigma / C)^2 + (F sigma_C / C^2)^2.

The correction is derived from stars only. No asteroid data, target names or reference
taxonomies enter it.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..common import status
from ..common.config import cache_directory, config_hash, resolve, settings
from ..common.constants import SPHEREX_BANDS
from ..common.provenance import Provenance
from .solar_spectrum import SolarSpectrum, load_solar_spectrum

CORRECTION_COLUMNS = ["detector", "band", "bin_lo_um", "bin_hi_um", "wavelength_um", "ln_corr", "ln_corr_err",
                      "correction", "correction_err", "n_points", "n_stars", "determined"]


@dataclass
class SolarAnalogCorrection:
    table: pd.DataFrame                      # one row per (detector, bin); columns CORRECTION_COLUMNS
    slope_sigma_per_um: dict                 # {"SWIR": s, "MWIR": s}: slope uncertainty of the mean correction
    summary: dict = field(default_factory=dict)
    path: str | None = None

    # ------------------------------------------------------------------ evaluation
    def evaluate(self, wavelength_um, detector):
        """C(lambda), sigma_C, method for each point ('bin', 'interpolated', 'edge', 'none')."""
        lam = np.atleast_1d(np.asarray(wavelength_um, float))
        det = np.atleast_1d(np.asarray(detector)).astype(int)
        C = np.ones(len(lam))
        E = np.zeros(len(lam))
        how = np.array(["none"] * len(lam), dtype=object)
        for d in np.unique(det):
            t = self.table[(self.table["detector"] == d) & self.table["determined"]].sort_values("wavelength_um")
            m = det == d
            if len(t) < 2:
                continue
            x = t["wavelength_um"].values
            lo, hi = float(t["bin_lo_um"].min()), float(t["bin_hi_um"].max())
            lc = np.interp(lam[m], x, t["ln_corr"].values)
            le = np.interp(lam[m], x, t["ln_corr_err"].values)
            inside = (lam[m] >= lo) & (lam[m] <= hi)
            C[m] = np.where(inside, np.exp(lc), 1.0)
            E[m] = np.where(inside, np.exp(lc) * le, 0.0)
            # bin containing the point is itself determined -> 'bin'; else interpolated from neighbours
            in_bin = np.zeros(m.sum(), bool)
            for r in t.itertuples():
                in_bin |= (lam[m] >= r.bin_lo_um) & (lam[m] < r.bin_hi_um)
            how_d = np.where(in_bin, "bin", "interpolated")
            how_d = np.where((lam[m] < x[0]) | (lam[m] > x[-1]), "edge", how_d)
            how[m] = np.where(inside, how_d, "none")
        return C, E, how

    def to_files(self, csv_path: str | Path) -> Path:
        p = resolve(csv_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        self.table[CORRECTION_COLUMNS].to_csv(p, index=False)
        meta = dict(self.summary, slope_sigma_per_um=self.slope_sigma_per_um)
        p.with_suffix(".json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")
        return p


def load_correction(csv_path: str | Path | None = None) -> SolarAnalogCorrection | None:
    """The stored correction, or None if it has not been built (python main.py solar-analog-calibration)."""
    csv_path = csv_path or settings()["reflectance"].get("solar_analog_correction")
    if not csv_path:
        return None
    p = resolve(csv_path)
    if not p.exists() or not p.with_suffix(".json").exists():
        return None
    tab = pd.read_csv(p)
    tab["determined"] = tab["determined"].astype(str).str.lower() == "true"
    meta = json.loads(p.with_suffix(".json").read_text(encoding="utf-8"))
    # record the path as configured (project-relative), not the machine-specific absolute path
    return SolarAnalogCorrection(tab, meta.pop("slope_sigma_per_um", {}), meta, str(csv_path))


# ---------------------------------------------------------------------------- derivation
def bin_edges_for_detector(detector: int, bin_factor: float) -> np.ndarray:
    """Logarithmic bins of width lambda / (bin_factor R) over the nominal band of the detector."""
    for info in SPHEREX_BANDS.values():
        if info["detector"] == int(detector):
            lo, hi, R = info["min_um"], info["max_um"], info["R"]
            # small margin: the LVF band edges of a release differ slightly from the nominal table
            lo, hi = lo * (1 - 1.0 / R), hi * (1 + 1.0 / R)
            n = int(np.ceil(np.log(hi / lo) / np.log(1 + 1.0 / (bin_factor * R))))
            return lo * (1 + 1.0 / (bin_factor * R)) ** np.arange(n + 1)
    raise ValueError(f"Unknown SPHEREx detector {detector}")


def clean_star_points(spectrum: pd.DataFrame, allowed_core_flags=None) -> tuple[pd.DataFrame, dict]:
    """Calibration points must be free of saturation and detector artefacts in the PSF core: GOOD/WARN,
    no rejected core pixel, and no FLAGS plane in the core other than `allowed_core_flags` (default
    SOURCE - the star itself is a detected source). Bright stars lose their saturated points here
    (OVERFLOW / BLOOM / SUR_ERROR at the peak) instead of being fitted on their PSF wings."""
    from .spectrum_cleaning import select_usable
    allowed = set(allowed_core_flags if allowed_core_flags is not None else
                  settings()["reflectance"].get("solar_analog_allowed_core_flags", ["SOURCE"]))
    n0 = len(spectrum)
    d = select_usable(spectrum).copy()
    n_usable = len(d)
    rej = d["quality_reasons"].fillna("").str.contains("rejected pixel") if "quality_reasons" in d else \
        pd.Series(False, index=d.index)
    if "core_flags" in d:
        extra = d["core_flags"].fillna("").map(lambda s: bool(set(filter(None, str(s).split("|"))) - allowed))
    else:
        extra = pd.Series(False, index=d.index)
    d = d[~rej & ~extra]
    d = d[(d["flux_uJy"] > 0) & np.isfinite(d["wavelength_um"])]
    return d, {"n_points": n0, "n_usable": n_usable, "n_rejected_core_pixel": int(rej.sum()),
               "n_other_core_flags": int((extra & ~rej).sum()), "n_clean": int(len(d))}


def star_ratio_points(spectrum: pd.DataFrame, star: str, solar: SolarSpectrum) -> pd.DataFrame:
    """Per-point ratio of a star's SPHEREx flux to the solar model in the same bandpass (clean points)."""
    d, _ = clean_star_points(spectrum)
    fsun = solar.at(d["wavelength_um"].values,
                    bandwidth_um=d["bandwidth_um"].values if "bandwidth_um" in d else None)
    d["star"] = star
    d["ln_q"] = np.log(d["flux_uJy"].values * 1e-6 / fsun)
    d["ln_q_err"] = d["flux_err_uJy"].values / d["flux_uJy"].values
    return d


def _joint_fit(star_idx, bin_idx, y, sig, n_s, n_b, gauge_w):
    """Weighted LSQ of y = a[star] + c[bin] in the gauge sum_b gauge_w[b] c[b] = 0.
    The model is degenerate by one constant (a + k, c - k); the minimum-norm solution is moved to the
    gauge by T = I + n g^T (n = (+1 stars, -1 bins), g = (0, gauge_w)), and so is its covariance."""
    A = np.zeros((len(y), n_s + n_b))
    A[np.arange(len(y)), star_idx] = 1.0
    A[np.arange(len(y)), n_s + bin_idx] = 1.0
    w = 1.0 / sig
    Aw = A * w[:, None]
    theta, *_ = np.linalg.lstsq(Aw, y * w, rcond=None)
    cov = np.linalg.pinv(Aw.T @ Aw)
    n = np.concatenate([np.ones(n_s), -np.ones(n_b)])
    g = np.concatenate([np.zeros(n_s), gauge_w])
    T = np.eye(n_s + n_b) + np.outer(n, g)
    theta, cov = T @ theta, T @ cov @ T.T
    return theta, cov


def derive_correction(points: pd.DataFrame, *, normalization_um: float | None = None, bin_factor: float = 2.0,
                      floor_frac: float = 0.01, clip_sigma: float = 4.0, min_points: int = 3, min_stars: int = 2,
                      max_iter: int = 8, gauge_halfwidth_um: float = 0.05, solar_name: str = "",
                      sources: list | None = None) -> SolarAnalogCorrection:
    """Joint fit of star scales and per-detector response bins (see module docstring).
    points: rows from star_ratio_points (columns star, detector, wavelength_um, ln_q, ln_q_err).
    Gauge: the weighted mean of the response over the bins within +/- gauge_halfwidth_um of the
    normalisation wavelength is zero (the same window the reflectance normalisation uses)."""
    lam0 = normalization_um or settings()["reflectance"]["normalization_wavelength_um"]
    d = points.reset_index(drop=True).copy()
    d["detector"] = d["detector"].astype(int)
    lo_hi, d["bin_key"] = {}, -1
    for det in sorted(d["detector"].unique()):
        edges = bin_edges_for_detector(det, bin_factor)
        m = (d["detector"] == det).values
        b = np.digitize(d.loc[m, "wavelength_um"].values, edges) - 1
        d.loc[m, "bin_key"] = np.where((b >= 0) & (b < len(edges) - 1), det * 1000 + b, -1)
        for k in range(len(edges) - 1):
            lo_hi[det * 1000 + k] = (float(edges[k]), float(edges[k + 1]))
    d = d[d["bin_key"] >= 0].reset_index(drop=True)
    stars = sorted(d["star"].unique())
    spos = {s: i for i, s in enumerate(stars)}
    sig0 = np.hypot(d["ln_q_err"].values, floor_frac)
    det0 = next(i["detector"] for i in SPHEREX_BANDS.values() if i["min_um"] <= lam0 <= i["max_um"])
    keep = np.ones(len(d), bool)
    for it in range(max_iter + 1):
        bins = sorted(set(d.loc[keep, "bin_key"]))
        bpos = {k: i for i, k in enumerate(bins)}
        gauge_bins = [k for k in bins if k // 1000 == det0 and abs(0.5 * sum(lo_hi[k]) - lam0) <= gauge_halfwidth_um]
        if not gauge_bins:
            raise ValueError(f"No star data within {gauge_halfwidth_um} um of the normalisation wavelength "
                             f"{lam0} um (detector {det0}).")
        n_g = np.array([float((keep & (d["bin_key"] == k).values).sum()) for k in gauge_bins])
        gw = np.zeros(len(bins))
        gw[[bpos[k] for k in gauge_bins]] = n_g / n_g.sum()
        dd = d[keep]
        theta, cov = _joint_fit(dd["star"].map(spos).values, dd["bin_key"].map(bpos).values, dd["ln_q"].values,
                                sig0[keep], len(stars), len(bins), gw)
        known = d["bin_key"].isin(bpos).values
        model_all = np.full(len(d), np.nan)
        model_all[known] = theta[d.loc[known, "star"].map(spos).values] + \
            theta[len(stars) + d.loc[known, "bin_key"].map(bpos).values]
        resid = (d["ln_q"].values - model_all) / sig0
        dof = max(int(keep.sum()) - (len(stars) + len(bins) - 1), 1)
        chi2_red = float(np.nansum(resid[keep] ** 2) / dof)
        new_keep = np.isfinite(resid) & (np.abs(resid) < clip_sigma * np.sqrt(max(chi2_red, 1.0)))
        if it == max_iter or np.array_equal(new_keep, keep):
            break
        keep = new_keep
    cov = cov * max(chi2_red, 1.0)
    d["used"] = keep
    d["model_ln_q"] = model_all
    d["resid_ln"] = d["ln_q"].values - model_all
    n_s = len(stars)
    coef = theta

    # per-star colour trends of the residuals -> slope uncertainty of the mean correction
    slope_sig, star_slopes = {}, {}
    for arm, (a, b) in {"SWIR": (0.7, 2.42), "MWIR": (2.42, 5.1)}.items():
        sl = []
        for s in stars:
            m = keep & (d["star"] == s).values & (d["wavelength_um"].values >= a) & (d["wavelength_um"].values < b)
            if m.sum() >= 6 and np.ptp(d.loc[m, "wavelength_um"]) > 0.3:
                x = d.loc[m, "wavelength_um"].values
                p = np.polyfit(x - x.mean(), d.loc[m, "resid_ln"].values, 1, w=1 / sig0[m])
                sl.append(float(p[0]))
                star_slopes.setdefault(s, {})[arm] = float(p[0])
        slope_sig[arm] = float(np.std(sl, ddof=1) / np.sqrt(len(sl))) if len(sl) >= 3 else None
    # Level of the MWIR response relative to the SWIR gauge: it rests on the stars' 1-5 um colours being
    # solar on average. Per-star mean residual MWIR - SWIR measures their spread; std / sqrt(N) is added
    # in quadrature to the MWIR bin errors.
    arm_off = []
    for s in stars:
        ms = keep & (d["star"] == s).values
        sw, mw = ms & (d["wavelength_um"].values < 2.42), ms & (d["wavelength_um"].values >= 2.42)
        if sw.sum() >= 6 and mw.sum() >= 6:
            off = float(np.average(d.loc[mw, "resid_ln"], weights=1 / sig0[mw] ** 2)
                        - np.average(d.loc[sw, "resid_ln"], weights=1 / sig0[sw] ** 2))
            arm_off.append(off)
            star_slopes.setdefault(s, {})["MWIR_minus_SWIR_level"] = off
    mwir_level_sigma = float(np.std(arm_off, ddof=1) / np.sqrt(len(arm_off))) if len(arm_off) >= 3 else None

    rows = []
    for key, (lo, hi) in sorted(lo_hi.items()):
        det = key // 1000
        m = keep & (d["bin_key"] == key).values
        n_pts = int(m.sum())
        n_st = int(d.loc[m, "star"].nunique()) if n_pts else 0
        lam_c = float(np.average(d.loc[m, "wavelength_um"], weights=1 / sig0[m] ** 2)) if n_pts else float(np.sqrt(lo * hi))
        if key in bpos:
            j = n_s + bpos[key]
            c, ce = float(coef[j]), float(np.sqrt(max(cov[j, j], 0.0)))
            if lam_c >= 2.42 and mwir_level_sigma is not None:
                ce = float(np.hypot(ce, mwir_level_sigma))
        else:
            c, ce = np.nan, np.nan
        det_ok = bool(n_pts >= min_points and n_st >= min_stars and np.isfinite(c))
        band = next(b for b, i in SPHEREX_BANDS.items() if i["detector"] == det)
        rows.append({"detector": det, "band": band, "bin_lo_um": lo, "bin_hi_um": hi, "wavelength_um": lam_c,
                     "ln_corr": c, "ln_corr_err": ce, "correction": float(np.exp(c)) if np.isfinite(c) else np.nan,
                     "correction_err": float(np.exp(c) * ce) if np.isfinite(c) else np.nan,
                     "n_points": n_pts, "n_stars": n_st, "determined": det_ok})
    tab = pd.DataFrame(rows, columns=CORRECTION_COLUMNS)
    star_scale = {s: float(coef[spos[s]]) for s in stars}
    cfg_r = settings()["reflectance"]
    releases = sorted({str(x) for x in d.get("data_release", pd.Series(dtype=str)).dropna().unique()})
    summary = {
        "method": "joint fit ln(F_star/F_sun) = a_star + c_detector(bin); gauge c=0 at the normalisation wavelength",
        "normalization_um": lam0, "bin_factor": bin_factor, "floor_frac": floor_frac, "clip_sigma": clip_sigma,
        "chi2_red": chi2_red, "n_points_total": int(len(d)), "n_points_used": int(keep.sum()),
        "n_stars": n_s, "stars": stars, "star_ln_scale": star_scale, "star_residual_slopes_per_um": star_slopes,
        "mwir_level_sigma_ln": mwir_level_sigma,
        "n_bins_determined": int(tab["determined"].sum()), "n_bins_total": int(len(tab)),
        "solar_spectrum": solar_name, "data_releases": releases, "origin": status.ORIGIN_OBSERVED
        if (points.get("origin", pd.Series([status.ORIGIN_OBSERVED])) == status.ORIGIN_OBSERVED).all()
        else status.ORIGIN_SIMULATED,
        "config_hash": config_hash(cfg_r), "sources": sources or [],
    }
    corr = SolarAnalogCorrection(tab, slope_sig, summary)
    corr.points = d
    return corr


def derive_correction_robust(points: pd.DataFrame, *, star_clip_sigma: float = 4.0, min_stars_for_clip: int = 5,
                             max_rounds: int = 2, **kw) -> SolarAnalogCorrection:
    """derive_correction with star-level outlier rejection. A solar analog whose colour differs from
    the others (per-star SWIR residual slope, or MWIR - SWIR residual level) by more than
    star_clip_sigma robust standard deviations (1.4826 MAD, computed over the stars) is not a usable
    solar proxy - e.g. a reddened hotter star, or a star in a crowded field - and is removed before
    the final fit. Excluded stars and the reason are recorded in the summary."""
    excluded = {}
    pts = points
    for _ in range(max_rounds + 1):
        corr = derive_correction(pts, **kw)
        stats = corr.summary.get("star_residual_slopes_per_um", {})
        new = {}
        for key, label in (("MWIR_minus_SWIR_level", "MWIR - SWIR level"), ("SWIR", "SWIR slope")):
            vals = {s: v[key] for s, v in stats.items() if key in v and np.isfinite(v[key])}
            if len(vals) < min_stars_for_clip:
                continue
            x = np.array(list(vals.values()))
            med = float(np.median(x))
            sig = 1.4826 * float(np.median(np.abs(x - med)))
            if sig <= 0:
                continue
            for s, v in vals.items():
                if abs(v - med) > star_clip_sigma * sig and s not in new:
                    new[s] = (f"{label} {100 * v:+.2f}% against median {100 * med:+.2f}% "
                              f"(robust sigma {100 * sig:.2f}%; > {star_clip_sigma:g} sigma)")
        if not new:
            break
        excluded.update(new)
        pts = pts[~pts["star"].isin(excluded)]
    corr.summary["excluded_stars"] = excluded
    corr.summary["star_clip_sigma"] = star_clip_sigma
    return corr


def rebuild_correction_from_saved(out_dir: str = "data/calibration", log=print) -> SolarAnalogCorrection:
    """Re-derive the correction from the saved per-star spectra (no network access), e.g. after a change
    of the fit settings. The provenance of the original build is kept."""
    out = resolve(out_dir)
    old = load_correction()
    files = sorted((out / "solar_analogs").glob("*_spectrum.csv"))
    if not files:
        raise RuntimeError(f"No saved star spectra in {out / 'solar_analogs'}; run the full build first.")
    solar = load_solar_spectrum()
    use = {s["name"] for s in load_star_list()["stars"] if s.get("use", True)}
    pts, clean_stats = [], {}
    for f in files:
        spec = pd.read_csv(f)
        star = str(spec["star"].iloc[0])
        if star not in use:
            log(f"  {star}: not enabled in config/solar_analogs.yaml; skipped.")
            continue
        clean_stats[star] = clean_star_points(spec)[1]
        pts.append(star_ratio_points(spec, star, solar))
    rc = settings()["reflectance"]
    corr = derive_correction_robust(pd.concat(pts, ignore_index=True), bin_factor=rc.get("solar_analog_bin_factor", 2.0),
                                    floor_frac=rc.get("solar_analog_floor_frac", 0.01), solar_name=solar.name,
                                    star_clip_sigma=rc.get("solar_analog_star_clip_sigma", 4.0),
                                    sources=(old.summary.get("sources") if old else []))
    for k in ("provenance", "window", "star_list"):
        if old is not None and k in old.summary:
            corr.summary[k] = old.summary[k]
    corr.summary["point_selection"] = clean_stats
    corr.summary["rebuilt_from_saved_spectra"] = True
    path = corr.to_files(rc.get("solar_analog_correction") or (out / "solar_analog_correction.csv"))
    corr.path = str(rc.get("solar_analog_correction") or path)
    corr.points.drop(columns=["bin_key"]).to_csv(out / "solar_analog_points.csv", index=False)
    return corr


# ---------------------------------------------------------------------------- application
def release_version(tag: str) -> str:
    """'dr1 l2b-v27-2026-238' -> 'dr1 l2b-v27': data release and L2 pipeline version, without the
    weekly processing stamp (which differs between images of the same release)."""
    import re
    return re.sub(r"(l2b-v\d+)-\d{4}-\d{3}", r"\1", str(tag)).strip()


def apply_correction(spectrum: pd.DataFrame, corr: SolarAnalogCorrection) -> tuple[pd.DataFrame, dict]:
    """Divide the fluxes by C(lambda) of their detector and propagate sigma_C. Adds the columns
    solar_analog_corr, solar_analog_corr_err, solar_analog_corr_method. Returns (table, info)."""
    out = spectrum.copy()
    if out.empty:
        return out, {"applied": False, "reason": "empty spectrum"}
    C, E, how = corr.evaluate(out["wavelength_um"].values, out["detector"].values)
    f, e = out["flux_uJy"].values, out["flux_err_uJy"].values
    out["flux_uJy_uncalibrated"], out["flux_err_uJy_uncalibrated"] = f, e
    out["flux_uJy"] = f / C
    out["flux_err_uJy"] = np.hypot(e / C, f * E / C ** 2)
    out["solar_analog_corr"], out["solar_analog_corr_err"], out["solar_analog_corr_method"] = C, E, how
    n_none = int((how == "none").sum())
    rel_cal = {release_version(x) for x in corr.summary.get("data_releases", [])}
    rel_obs = {release_version(x) for x in out.get("data_release", pd.Series(dtype=str)).dropna().unique()}
    info = {"applied": True, "file": corr.path, "n_stars": corr.summary.get("n_stars"),
            "stars": corr.summary.get("stars"), "chi2_red": corr.summary.get("chi2_red"),
            "slope_sigma_per_um": corr.slope_sigma_per_um, "n_points": int(len(out)),
            "n_uncorrected": n_none, "max_abs_correction": float(np.max(np.abs(C - 1.0))),
            "data_releases_calibration": sorted(rel_cal), "data_releases_observation": sorted(rel_obs),
            "warnings": []}
    if n_none:
        info["warnings"].append(f"{n_none} points outside the wavelength range covered by the solar-analog "
                                "calibration were left uncorrected.")
    if rel_obs and rel_cal and not rel_obs <= rel_cal:
        info["warnings"].append("Observation data releases " + ", ".join(sorted(rel_obs - rel_cal)) +
                                " are not among the releases used for the solar-analog calibration.")
    return out, info


def calibration_slope_sigma(corr: SolarAnalogCorrection | None, arm: str = "SWIR") -> float:
    if corr is None:
        return 0.0
    v = (corr.slope_sigma_per_um or {}).get(arm)
    return float(v) if v is not None and np.isfinite(v) else 0.0


# ---------------------------------------------------------------------------- star list
def load_star_list(path: str | Path = "config/solar_analogs.yaml") -> dict:
    import yaml
    with open(resolve(path), encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _sexagesimal_deg(ra_hms: str, dec_dms: str) -> tuple[float, float]:
    h, m, x = (float(v) for v in ra_hms.split(":"))
    sg = -1.0 if dec_dms.strip().startswith("-") else 1.0
    d, dm, dx = (float(v) for v in dec_dms.strip().lstrip("+-").split(":"))
    return 15.0 * (h + m / 60 + x / 3600), sg * (d + dm / 60 + dx / 3600)


def verify_star_identity(entry: dict, gaia_row) -> tuple[bool, str]:
    """The Gaia DR3 record fetched by source_id must be the configured star: G and position must
    agree with the values recorded at selection time (guards against corrupted identifiers -
    a 19-digit source_id passed through float64 points to another star of the same HEALPix cell)."""
    g_mag, ra, dec = float(gaia_row["phot_g_mean_mag"]), float(gaia_row["ra"]), float(gaia_row["dec"])
    if "gaia_ra_dec_j2016" in entry:
        ra0, dec0 = entry["gaia_ra_dec_j2016"]
        tol_as, g_ref, tol_g = 0.5, float(entry.get("G", g_mag)), 0.01
    elif "j2000" in entry:
        ra0, dec0 = _sexagesimal_deg(*entry["j2000"])
        tol_as, g_ref, tol_g = 5.0, float(entry["V"]) - 0.2, 1.0       # proper motion 2000 -> 2016
    else:
        return True, "no reference position recorded"
    sep = float(np.hypot((ra - ra0) * np.cos(np.radians(dec0)), dec - dec0) * 3600)
    if sep > tol_as:
        return False, f"position {sep:.1f} arcsec from the recorded one (> {tol_as})"
    if abs(g_mag - g_ref) > tol_g:
        return False, f"G = {g_mag:.2f} against {g_ref:.2f} (tolerance {tol_g})"
    return True, f"position within {sep:.2f} arcsec, G = {g_mag:.3f}"


def build_correction(start: str, end: str, *, max_images_per_star: int | None = None, stars: list | None = None,
                     cache_dir: str | None = None, out_dir: str = "data/calibration",
                     log=print) -> SolarAnalogCorrection:
    """Search, photometer and combine the configured solar analogs (needs IRSA access)."""
    from astropy.time import Time

    from ..acquisition.fixed_source_search import gaia_dr3_astrometry, search_fixed_source
    from ..extraction.spectral_extraction import extract_spectrum, save_spectrum

    cache_dir = cache_dir or str(cache_directory("spherex_cutouts_solar_analogs"))
    cfg = load_star_list()
    entries = [s for s in cfg["stars"] if (s["name"] in stars if stars else s.get("use", True))]
    if not entries:
        raise ValueError("No solar analogs selected.")
    prov = Provenance(step="solar_analog_calibration", model_version=settings()["project"]["model_version"],
                      inputs={"start": start, "end": end, "max_images_per_star": max_images_per_star,
                              "stars": [s["name"] for s in entries]},
                      assumptions={"star_list": cfg.get("reference"), "selection": cfg.get("selection")},
                      formula="ln(F_star/F_sun) = a_star + c_detector(bin)")
    gaia, gsrc = gaia_dr3_astrometry([s["gaia_dr3_source_id"] for s in entries])
    prov.add_source(gsrc)
    gaia = gaia.set_index("source_id")
    solar = load_solar_spectrum()
    mjd0, mjd1 = Time(start).mjd, Time(end).mjd
    out = resolve(out_dir)
    (out / "solar_analogs").mkdir(parents=True, exist_ok=True)
    pts, clean_stats = [], {}
    for s in entries:
        sid = int(s["gaia_dr3_source_id"])
        if sid not in gaia.index:
            log(f"  {s['name']}: Gaia DR3 source {sid} not returned; skipped.")
            continue
        g = gaia.loc[sid]
        ok, why = verify_star_identity(s, g)
        if not ok:
            log(f"  {s['name']}: Gaia DR3 {sid} does not match the configured star ({why}); skipped.")
            prov.warn(f"{s['name']}: identity check failed: {why}")
            continue
        try:
            res = search_fixed_source(s["name"], float(g["ra"]), float(g["dec"]), mjd0, mjd1,
                                      float(g["pmra"]), float(g["pmdec"]), max_images=max_images_per_star)
        except Exception as err:  # noqa: BLE001 - one unreachable star must not stop the build
            log(f"  {s['name']}: search failed ({err}); skipped.")
            prov.warn(f"{s['name']}: search failed: {err}")
            continue
        for w in res.provenance.warnings + res.messages:
            log(f"  {s['name']}: {w}")
        obs = res.observations
        if obs.empty:
            continue
        obs = obs[obs["inside_footprint"]]
        log(f"  {s['name']}: {len(obs)} images ({', '.join(f'{b} {n}' for b, n in obs.groupby('band').size().items())})")
        spec, p2 = extract_spectrum(obs, cache_dir=cache_dir)
        for w in p2.warnings[:5]:
            log(f"  {s['name']}: {w}")
        prov.add_source({"name": f"SPHEREx photometry of {s['name']}", "identifier": f"Gaia DR3 {sid}",
                         "query": f"{len(obs)} images", "origin": status.ORIGIN_OBSERVED})
        if spec.empty:
            continue
        spec["star"] = s["name"]
        stem = "".join(ch if ch.isalnum() else "_" for ch in s["name"])
        save_spectrum(spec, out / "solar_analogs" / f"{stem}_spectrum.csv")
        q = spec["quality_flag"].value_counts().to_dict()
        _, cl = clean_star_points(spec)
        clean_stats[s["name"]] = cl
        log(f"  {s['name']}: {len(spec)} points {q}; clean for calibration: {cl['n_clean']} "
            f"(rejected core pixel {cl['n_rejected_core_pixel']}, other core flags {cl['n_other_core_flags']})")
        pts.append(star_ratio_points(spec, s["name"], solar))
    if not pts:
        raise RuntimeError("No solar-analog photometry could be extracted.")
    allp = pd.concat(pts, ignore_index=True)
    rc = settings()["reflectance"]
    corr = derive_correction_robust(allp, bin_factor=rc.get("solar_analog_bin_factor", 2.0),
                                    floor_frac=rc.get("solar_analog_floor_frac", 0.01), solar_name=solar.name,
                                    star_clip_sigma=rc.get("solar_analog_star_clip_sigma", 4.0),
                                    sources=prov.to_dict()["sources"])
    for star, why in corr.summary.get("excluded_stars", {}).items():
        log(f"  {star}: excluded as a solar proxy - {why}")
    corr.summary["provenance"] = prov.to_dict()
    corr.summary["window"] = [start, end]
    corr.summary["point_selection"] = clean_stats
    corr.summary["star_list"] = {s["name"]: {k: v for k, v in s.items() if k != "name"} for s in entries}
    path = corr.to_files(rc.get("solar_analog_correction") or (out / "solar_analog_correction.csv"))
    corr.path = str(rc.get("solar_analog_correction") or path)
    corr.points.drop(columns=["bin_key"]).to_csv(out / "solar_analog_points.csv", index=False)
    return corr
