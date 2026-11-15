"""Stage 4b: absorption-band analysis and mineral candidates.

Band I (~0.9-1.1 um) and Band II (~1.9-2.3 um): continuum removal with straight lines
between local reflectance maxima, band centre from a polynomial fit around the minimum,
depth = 1 - min(continuum-removed reflectance), Band Area Ratio BAR = area(II)/area(I).
3-um region (thermally corrected reflectance): depth relative to a linear continuum
anchored at 2.40-2.55 um (and beyond 3.6 um where available) at
  2.7-2.9 um  (OH, phyllosilicates), 3.0-3.2 um (H2O ice / NH4), 3.35-3.55 um (C-H, organics).

Interpretation thresholds (indicative, from Cloutis et al. 1986 and Gaffey et al. 1993):
  BI centre >= 1.04 um and BAR < 0.3             -> olivine-dominated
  BI 0.90-0.95 um, BII 1.90-2.00 um, BAR > 1.0   -> orthopyroxene-rich (HED-like)
  BI 0.95-1.04 um with Band II                   -> olivine + pyroxene mixture
  BII centre > 2.1 um                            -> clinopyroxene present
A feature is "detected" only if depth / sigma >= min_band_depth_sigma and it spans at
least min_band_width_resolution_elements resolution elements. Otherwise the result is a
non-detection or upper limit - never a confirmed mineral.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common import status
from ..common.config import settings


DETECTED, NOT_DETECTED, NOT_EVALUABLE = "DETECTED", "NOT_DETECTED", "NOT_EVALUABLE"
# Classes carrying 1- and/or 2-um bands, used only to estimate the depth a typical band-bearing
# asteroid would show with the SAME sampling and errors ("is a band detectable in these data?").
BAND_BEARING_CLASSES = ["S", "Sa", "Sq", "Sr", "Sv", "Q", "V", "A", "O", "R", "K"]


@dataclass
class BandMeasurement:
    name: str
    detected: bool
    center_um: float | None = None
    center_err_um: float | None = None
    depth: float | None = None
    depth_err: float | None = None
    area: float | None = None
    width_res_elements: float | None = None
    note: str = ""
    status: str = NOT_EVALUABLE          # DETECTED | NOT_DETECTED | NOT_EVALUABLE
    reason: str = ""
    evidence: list = field(default_factory=list)          # which tests found it
    min_detectable_depth: float | None = None             # 3 sigma
    upper_limit_depth: float | None = None                # for non-detections
    within_segment: dict | None = None
    typical_depth: float | None = None                    # band-bearing classes, same sampling
    false_alarm_depth: float | None = None                # Monte Carlo null threshold (full band)
    detectable: bool | None = None                        # typical_depth >= min_detectable_depth


@dataclass
class MineralResult:
    bands: list = field(default_factory=list)
    candidates: list = field(default_factory=list)   # [{mineral, evidence, confidence}]
    spectral_slope_per_um: float | None = None
    spectral_slope_err: float | None = None
    limitations: list = field(default_factory=list)

    def band(self, name: str):
        return next((b for b in self.bands if b.name == name), None)


def _continuum_removed(lam, R, lo_win, hi_win):
    ml = (lam >= lo_win[0]) & (lam <= lo_win[1])
    mh = (lam >= hi_win[0]) & (lam <= hi_win[1])
    if ml.sum() < 1 or mh.sum() < 1:
        return None
    il = np.where(ml)[0][np.argmax(R[ml])]
    ih = np.where(mh)[0][np.argmax(R[mh])]
    cont = R[il] + (R[ih] - R[il]) * (lam - lam[il]) / (lam[ih] - lam[il])
    seg = (lam >= lam[il]) & (lam <= lam[ih])
    return cont, seg, il, ih


def measure_band(lam, R, E, name, lo_win, hi_win, search, R_res, rng, n_mc=200) -> BandMeasurement:
    """Full band: linear continuum between the shoulder maxima, depth at the minimum."""
    cfg = settings()["minerals"]
    out = _continuum_removed(lam, R, lo_win, hi_win)
    if out is None:
        return BandMeasurement(name, False, status=NOT_EVALUABLE, reason="continuum shoulders not covered",
                               note="Continuum shoulders not covered by data.")
    cont, seg, il, ih = out
    cr = R / cont
    cre = E / cont
    s = seg & (lam >= search[0]) & (lam <= search[1])
    if s.sum() < 3:
        return BandMeasurement(name, False, status=NOT_EVALUABLE, reason="too few points inside the band",
                               note="Too few points inside the band.")
    imin = np.where(s)[0][np.argmin(cr[s])]
    depth = 1 - cr[imin]
    depth_err = cre[imin]
    below = s & (cr < 1 - 0.5 * depth)
    width_um = (lam[below].max() - lam[below].min()) if below.sum() > 1 else 0.0
    width_res = width_um / (lam[imin] / R_res)
    detected = depth_err > 0 and depth / depth_err >= cfg["min_band_depth_sigma"] and \
        width_res >= cfg["min_band_width_resolution_elements"]

    def centre(crv):
        w = s & (np.abs(lam - lam[imin]) < 0.15)
        if w.sum() < 4:
            return lam[imin]
        c = np.polyfit(lam[w], crv[w], 2)
        return -c[1] / (2 * c[0]) if c[0] > 0 else lam[imin]

    c0 = centre(cr)
    cs = [centre(cr + rng.normal(0, 1, len(cr)) * cre) for _ in range(n_mc)]
    area = float(np.trapezoid(1 - cr[seg], lam[seg])) if hasattr(np, "trapezoid") else \
        float(np.trapz(1 - cr[seg], lam[seg]))
    note = "" if detected else "Not significant (depth/sigma or width below threshold); treat as non-detection."
    return BandMeasurement(name, bool(detected), float(c0), float(np.std(cs)), float(depth), float(depth_err),
                           area, float(width_res), note, status=DETECTED if detected else NOT_DETECTED,
                           evidence=["full_band"] if detected else [],
                           min_detectable_depth=float(3 * depth_err),
                           upper_limit_depth=None if detected else float(max(depth, 0) + 3 * depth_err))


def within_segment_test(lam, R, E, window, vertex_range, rng, n_mc=300, C=None) -> dict:
    """Band minimum inside ONE detector segment (points of one normalisation group): weighted
    quadratic fit R = c0 + c1 l + c2 l^2 over `window`. A band is indicated by significant
    upward curvature (c2/sigma >= min_band_depth_sigma) with the vertex inside `vertex_range`.
    Because all points share one normalisation, the test is insensitive to brightness changes
    between visits that are not linked."""
    cfg = settings()["minerals"]
    m = (lam >= window[0]) & (lam <= window[1]) & np.isfinite(R) & (E > 0)
    if m.sum() < 5 or (lam[m].max() - lam[m].min()) < 0.6 * (window[1] - window[0]):
        return {"evaluable": False, "reason": f"fewer than 5 points or partial coverage of {window[0]}-{window[1]} um"}
    x, y, e = lam[m], R[m], E[m]
    xc = x - np.mean(x)
    A = np.vstack([np.ones_like(xc), xc, xc ** 2]).T
    if C is not None:                    # generalised least squares with the full error covariance
        from .covariance import gls
        coef, cov, chi2_tot = gls(A, y, C[np.ix_(m, m)])
    else:
        Aw = A / e[:, None]
        coef, *_ = np.linalg.lstsq(Aw, y / e, rcond=None)
        cov = np.linalg.inv(Aw.T @ Aw)
        chi2_tot = float(np.sum((y / e - Aw @ coef) ** 2))
    chi2 = float(chi2_tot / max(m.sum() - 3, 1))
    cov = cov * max(chi2, 1.0)
    c2, c2e = coef[2], np.sqrt(cov[2, 2])
    lo, hi = x.min() - np.mean(x), x.max() - np.mean(x)

    def depth_of(c):
        if c[2] <= 0:
            return 0.0, None
        v = -c[1] / (2 * c[2])
        if not (lo <= v <= hi):
            return 0.0, None
        q = lambda t: c[0] + c[1] * t + c[2] * t ** 2            # noqa: E731
        chord = q(lo) + (q(hi) - q(lo)) * (v - lo) / (hi - lo)
        return float(1 - q(v) / chord), float(v + np.mean(x))

    depth, vtx = depth_of(coef)
    draws = rng.multivariate_normal(coef, cov, n_mc)
    dd = np.array([depth_of(c)[0] for c in draws])
    derr = float(np.std(dd)) if np.std(dd) > 0 else float(c2e)
    sig = bool(c2 > 0 and c2 / c2e >= cfg["min_band_depth_sigma"] and vtx is not None
               and vertex_range[0] <= vtx <= vertex_range[1])
    return {"evaluable": True, "significant": sig, "curvature_sigma": float(c2 / c2e), "vertex_um": vtx,
            "depth": depth, "depth_err": derr, "min_detectable_depth": float(3 * derr), "n_points": int(m.sum()),
            "chi2_red": chi2, "window_um": list(window), "covariance": "full" if C is not None else "diagonal"}


def _binned_by_group(d, value_col, err_col, group_col):
    from ..preprocessing.spectrum_cleaning import bin_spectrum, resolution_bin_edges
    R_res = settings()["classification"]["spherex_resolving_power"]
    edges = resolution_bin_edges(0.70, 5.05, R=R_res)
    out = {}
    for gk, g in d.groupby(group_col):
        c, v, e, n = bin_spectrum(g["wavelength_um"].values, g[value_col].values, g[err_col].values, edges)
        out[gk] = (c, v, e)
    return out


def _null_depth_threshold(lam, E, lo_win, hi_win, search, R_res, rng, n_null=150):
    """Monte Carlo false-alarm calibration: apply the same estimator to featureless (linear) spectra
    with the observed sampling and errors. Selecting shoulder maxima and the band minimum biases the
    depth of pure noise upwards; the detection threshold is mean + 3 std of these null depths."""
    m = (lam >= lo_win[0]) & (lam <= hi_win[1])
    depths = []
    for _ in range(n_null):
        y = np.ones(m.sum()) + rng.normal(0, 1, m.sum()) * E[m]
        b = measure_band(lam[m], y, E[m], "null", lo_win, hi_win, search, R_res, rng, n_mc=1)
        if b.depth is not None:
            depths.append(b.depth)
    if len(depths) < 20:
        return None
    return float(np.mean(depths) + 3 * np.std(depths))


def _evaluate_band(name, binned, lo_win, hi_win, search, seg_window, seg_vertex, R_res, rng, typical,
                   centre_range, pointwise=None):
    """Full-band measurement in the best single normalisation group plus the within-segment test.
    A full-band detection needs depth/sigma >= 3, depth above the Monte Carlo false-alarm threshold
    and a band centre inside `centre_range`."""
    full = None
    for gk, (lam, R, E) in binned.items():
        b = measure_band(lam, R, E, name, lo_win, hi_win, search, R_res, rng)
        if b.status == NOT_EVALUABLE:
            continue
        if b.detected:
            thr = _null_depth_threshold(lam, E, lo_win, hi_win, search, R_res, rng)
            reasons = []
            if thr is not None and b.depth < thr:
                reasons.append(f"depth {b.depth:.3f} below the false-alarm threshold {thr:.3f}")
            if not (centre_range[0] <= (b.center_um or 0) <= centre_range[1]):
                reasons.append(f"minimum at {b.center_um:.2f} um outside {centre_range[0]}-{centre_range[1]} um")
            if reasons:
                b.detected, b.status, b.evidence = False, NOT_DETECTED, []
                b.note = "Full-band candidate rejected: " + "; ".join(reasons) + "."
                b.upper_limit_depth = float(max(thr or b.depth, b.depth))
            b.false_alarm_depth = thr
        if full is None or (b.depth_err or 9) < (full.depth_err or 9):
            full = b
    if full is None:
        full = BandMeasurement(name, False, status=NOT_EVALUABLE,
                               reason="band shoulders and centre not observed within one normalisation group",
                               note="Band shoulders and centre not observed within one normalisation group.")
    seg = {"evaluable": False, "reason": "no segment data"}
    best_n = -1
    if pointwise:          # unbinned points with full covariance (visit-correlated errors)
        for gk, (lam, R, E, C) in pointwise.items():
            t = within_segment_test(lam, R, E, seg_window, seg_vertex, rng, C=C)
            if t["evaluable"] and t["n_points"] > best_n:
                seg, best_n = t, t["n_points"]
    else:
        for gk, (lam, R, E) in binned.items():
            t = within_segment_test(lam, R, E, seg_window, seg_vertex, rng)
            if t["evaluable"] and t["n_points"] > best_n:
                seg, best_n = t, t["n_points"]
    full.within_segment = seg
    full.typical_depth = typical
    evidence = list(full.evidence)
    if seg.get("significant"):
        evidence.append("within_segment")
    full.evidence = evidence
    evaluable = full.status != NOT_EVALUABLE or seg.get("evaluable")
    mdds = [x for x in (full.min_detectable_depth if full.status != NOT_EVALUABLE else None,
                        seg.get("min_detectable_depth") if seg.get("evaluable") else None) if x is not None]
    if mdds:
        full.min_detectable_depth = float(min(mdds))
        full.detectable = bool(typical is not None and typical >= full.min_detectable_depth)
    if evidence:
        full.status, full.detected = DETECTED, True
        full.reason = "detected by " + " and ".join(evidence)
        if "full_band" not in evidence and seg.get("vertex_um"):
            # only the within-segment test found the band: report its centre and depth
            full.center_um, full.depth, full.depth_err = seg["vertex_um"], seg["depth"], seg["depth_err"]
            full.center_err_um = None
    elif evaluable:
        full.status, full.detected = NOT_DETECTED, False
        lim = full.upper_limit_depth if full.upper_limit_depth is not None else \
            (max(seg.get("depth", 0), 0) + 3 * seg.get("depth_err", 0) if seg.get("evaluable") else None)
        full.upper_limit_depth = lim
        full.reason = ("not detected; " + ("a typical band-bearing asteroid would be detectable here"
                                           if full.detectable else "data not sensitive enough to detect a typical band"))
    else:
        full.status, full.detected = NOT_EVALUABLE, False
        full.reason = full.reason or seg.get("reason", "not covered")
    return full


def _typical_band_depths(binned_shape):
    """Depth that typical band-bearing classes would show with the same sampling (no noise)."""
    from .reference_library import load_busdemeo, resample_reference
    lib = load_busdemeo()
    R_res = settings()["classification"]["spherex_resolving_power"]
    lam_norm = settings()["reflectance"]["normalization_wavelength_um"]
    rng = np.random.default_rng(0)
    d1, d2 = [], []
    for cls in BAND_BEARING_CLASSES:
        if cls not in lib:
            continue
        for lam in binned_shape:
            rr, _, inside = resample_reference(lib[cls], lam, R_res, lam_norm)
            ok = inside & np.isfinite(rr)
            if ok.sum() < 5:
                continue
            e = np.full(ok.sum(), 1e-3)
            t1 = within_segment_test(lam[ok], rr[ok], e, (0.75, 1.10), (0.85, 1.05), rng, n_mc=5)
            t2 = within_segment_test(lam[ok], rr[ok], e, (1.63, 2.41), (1.80, 2.20), rng, n_mc=5)
            b1 = measure_band(lam[ok], rr[ok], e, "I", (0.75, 0.85), (1.20, 1.70), (0.85, 1.25), R_res, rng, n_mc=5)
            b2 = measure_band(lam[ok], rr[ok], e, "II", (1.20, 1.70), (2.30, 2.50), (1.70, 2.40), R_res, rng, n_mc=5)
            d1 += [x for x in (t1.get("depth"), b1.depth) if x]
            d2 += [x for x in (t2.get("depth"), b2.depth) if x]
            break
    return (float(np.median(d1)) if d1 else None), (float(np.median(d2)) if d2 else None)


def three_micron_features(lam, R, E, R_res) -> list[BandMeasurement]:
    cfg = settings()["minerals"]
    anchor = ((lam >= 2.40) & (lam <= 2.55)) | ((lam >= 3.6) & (lam <= 3.8))
    out = []
    if anchor.sum() < 2:
        return [BandMeasurement("3-um region", False, status=NOT_EVALUABLE, reason="no continuum anchors",
                                note="No continuum anchors at 2.40-2.55 um / 3.6-3.8 um.")]
    p = np.polyfit(lam[anchor], R[anchor], 1 if (lam[anchor] > 3.5).any() else 0)
    cont = np.polyval(p, lam)
    for name, (a, b) in {"OH / phyllosilicate (2.7-2.9 um)": (2.65, 2.95),
                         "H2O ice / NH4 (3.0-3.2 um)": (2.95, 3.25),
                         "C-H organics (3.35-3.55 um)": (3.35, 3.55)}.items():
        m = (lam >= a) & (lam <= b)
        if m.sum() < 2:
            out.append(BandMeasurement(name, False, status=NOT_EVALUABLE, reason="no data in window",
                                       note="No data in window."))
            continue
        w = 1 / E[m] ** 2
        mean_cr = np.sum(w * R[m] / cont[m]) / np.sum(w)
        err = np.sqrt(1 / np.sum(w)) / np.mean(cont[m])
        depth = 1 - mean_cr
        width_res = (b - a) / (0.5 * (a + b) / R_res)
        det = depth / err >= cfg["min_band_depth_sigma"] and width_res >= cfg["min_band_width_resolution_elements"]
        out.append(BandMeasurement(name, bool(det), 0.5 * (a + b), (b - a) / 2, float(depth), float(err), None,
                                   float(width_res),
                                   "Thermal-corrected; depends on thermal model accuracy." if det else
                                   "Not significant; upper limit on depth = depth + 3 sigma.",
                                   status=DETECTED if det else NOT_DETECTED,
                                   min_detectable_depth=float(3 * err),
                                   upper_limit_depth=None if det else float(max(depth, 0) + 3 * err)))
    return out


def analyse_minerals(refl: pd.DataFrame, value_col="reflectance", err_col="reflectance_err",
                     albedo_pV: float | None = None, seed: int = 2, thermal_removed: bool = True,
                     spectrum_fit_chi2_red: float | None = None, group_col: str = "norm_group") -> MineralResult:
    """Band I (~1 um) and Band II (~2 um) are always evaluated and reported as DETECTED,
    NOT_DETECTED (with upper limit and whether a typical band would have been detectable) or
    NOT_EVALUABLE (with the reason). Evidence comes from (a) the full band in one normalisation
    group and (b) a within-segment curvature test (B1 for Band I, B3 for Band II) that does not
    depend on brightness changes between visits.
    thermal_removed: False -> the 3-um windows are not evaluated.
    spectrum_fit_chi2_red: best taxonomy chi2_red; > 5 (or bands deeper than 0.5) downgrades the
    mineral candidates to Low confidence."""
    R_res = settings()["classification"]["spherex_resolving_power"]
    rng = np.random.default_rng(seed)
    d = refl.dropna(subset=[value_col, err_col]).sort_values("wavelength_um").copy()
    if group_col not in d:
        d[group_col] = 0
    lam, R, E = d["wavelength_um"].values, d[value_col].values, d[err_col].values
    res = MineralResult(limitations=[
        "SPHEREx begins at 0.75 um: the short-wavelength shoulder of Band I is at the edge of coverage, "
        "so Band I centres may be biased.",
        "Spectral resolution R~35-130 cannot resolve narrow features; detections need >= 1.5 resolution elements.",
        "Mineral candidates are consistency statements, not identifications.",
    ])
    if len(lam) < 8:
        res.limitations.append(status.INSUFFICIENT_DATA)
        res.bands = [BandMeasurement("Band I", False, status=NOT_EVALUABLE, reason="fewer than 8 points"),
                     BandMeasurement("Band II", False, status=NOT_EVALUABLE, reason="fewer than 8 points")]
        return res
    m = (lam >= 0.75) & (lam <= 2.45) & (E > 0)
    if m.sum() >= 4 and d[group_col].nunique() == 1:
        p, cov = np.polyfit(lam[m], R[m], 1, w=1 / E[m], cov="unscaled")
        res.spectral_slope_per_um, res.spectral_slope_err = float(p[0]), float(np.sqrt(cov[0, 0]))
    binned = _binned_by_group(d, value_col, err_col, group_col)
    typ1, typ2 = _typical_band_depths([v[0] for v in binned.values()])
    pointwise = None
    from .covariance import covariance_matrix, has_visit_structure, point_covariance
    if has_visit_structure(d):
        pointwise = {}
        for gk, g in d.groupby(group_col):
            g = g.sort_values("wavelength_um")
            Rg, pg, vg, visg = point_covariance(g, value_col, err_col)
            pointwise[gk] = (g["wavelength_um"].values, Rg, g[err_col].values, covariance_matrix(Rg, pg, vg, visg))
    b1 = _evaluate_band("Band I", binned, (0.75, 0.85), (1.20, 1.70), (0.85, 1.25), (0.75, 1.10), (0.85, 1.05),
                        R_res, rng, typ1, centre_range=(0.85, 1.12), pointwise=pointwise)
    b2 = _evaluate_band("Band II", binned, (1.20, 1.70), (2.30, 2.50), (1.70, 2.40), (1.63, 2.41), (1.80, 2.20),
                        R_res, rng, typ2, centre_range=(1.75, 2.35), pointwise=pointwise)
    if d[group_col].nunique() > 1:
        res.limitations.append("Several normalisation groups: full-band depths use one group; the within-segment "
                               "test is used across visits that could not be linked.")
    if thermal_removed:
        lam_r, R_r, E_r = lam, R, E
        if d[group_col].nunique() > 1:
            g0 = d[group_col].value_counts().index[0]
            sel = (d[group_col] == g0).values
            lam_r, R_r, E_r = lam[sel], R[sel], E[sel]
        res.bands = [b1, b2] + three_micron_features(lam_r, R_r, E_r, R_res)
    else:
        res.bands = [b1, b2, BandMeasurement("3-um region", False, status=NOT_EVALUABLE,
                                             reason="thermal emission was not removed",
                                             note="Not evaluated: thermal emission was not removed.")]
        res.limitations.append("3-um features not evaluated because no thermal model was subtracted.")

    cands = []
    bar = (b2.area / b1.area) if (b1.detected and b2.detected and b1.area and b2.area) else None
    if b1.detected:
        c1 = b1.center_um
        if c1 is not None and c1 >= 1.04 and (bar is None or bar < 0.3):
            cands.append(("Olivine", f"Band I centre {c1:.3f} um, BAR {bar if bar is None else round(bar, 2)}"))
        elif c1 is not None and 0.90 <= c1 <= 0.95 and b2.detected and b2.center_um and \
                1.90 <= b2.center_um <= 2.00 and (bar or 0) > 1.0:
            cands.append(("Orthopyroxene", f"Band I {c1:.3f} um, Band II {b2.center_um:.3f} um, BAR {bar:.2f}"))
        elif b2.detected:
            cands.append(("Olivine-pyroxene mixture", f"Band I {c1:.3f} um with Band II "
                          f"{b2.center_um:.3f} um" if c1 and b2.center_um else "Band I with Band II"))
        else:
            cands.append(("Mafic silicates (olivine and/or pyroxene)", f"Band I ({', '.join(b1.evidence)})"))
        if b2.detected and b2.center_um and b2.center_um > 2.1:
            cands.append(("Clinopyroxene", f"Band II centre {b2.center_um:.3f} um > 2.1 um"))
    for b in res.bands[2:]:
        if b.detected:
            label = {"OH": "Phyllosilicates / OH-bearing minerals", "H2O": "Water ice or NH4-bearing phases",
                     "C-H": "Organic-rich materials"}[b.name.split()[0]]
            cands.append((label, f"{b.name}: depth {b.depth:.3f} +/- {b.depth_err:.3f}"))
    featureless = not b1.detected and not b2.detected and not any(b.detected for b in res.bands[2:])
    if featureless:
        if albedo_pV is not None and albedo_pV < 0.1:
            cands.append(("Carbonaceous materials", f"Featureless spectrum with pV = {albedo_pV:.3f} < 0.1"))
        elif albedo_pV is not None and 0.1 <= albedo_pV <= 0.3 and (res.spectral_slope_per_um or 0) > 0:
            cands.append(("Metal-rich materials (possible)", "Featureless, red slope, moderate pV; "
                          "radar or 3-um data needed to confirm"))
        else:
            cands.append((status.UNKNOWN, "Featureless spectrum; albedo needed to discriminate "
                          "carbonaceous vs metal-rich vs other"))
    suspect = []
    if spectrum_fit_chi2_red is not None and spectrum_fit_chi2_red > 5:
        suspect.append(f"spectrum matches no reference class (chi2_red {spectrum_fit_chi2_red:.1f})")
    deep = [b.name for b in res.bands if b.detected and b.depth is not None and b.depth > 0.5]
    if deep:
        suspect.append(f"implausibly deep band(s) {', '.join(deep)} (> 0.5): likely residual lightcurve, "
                       "thermal or calibration artefacts")
    if suspect:
        res.limitations.append("Candidates downgraded to Low confidence: " + "; ".join(suspect) + ".")
    for mineral, ev in cands:
        conf = status.CONF_NONE if mineral == status.UNKNOWN else (status.CONF_LOW if suspect else status.CONF_MEDIUM)
        res.candidates.append({"mineral": mineral, "evidence": ev, "confidence": conf})
    return res
