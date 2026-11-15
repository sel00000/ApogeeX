"""Observation-time structure of a SPHEREx asteroid spectrum, and data-supported correction of
brightness changes between observations.

SPHEREx builds a spectrum from many exposures taken at different times:
  * a *visit* is a run of consecutive exposures (gaps < visit_gap_min), lasting minutes;
  * in each exposure one SWIR and one MWIR detector see the same field (e.g. D1+D4), so a visit
    samples one detector *family* (e.g. B1+B4);
  * different families, and different visits of the same family, are hours to days apart.
Rotation (lightcurve), changing viewing geometry and calibration drifts therefore change the
brightness between visits, and that can masquerade as spectral shape (slope, band depth).

Repeated observations - the same wavelength (within lambda/(f R)) observed in different visits -
measure these changes independently of the spectral shape. For the points of a repeat bin b:
    y_i = ln f_i - ln g_i = mu_b + s_v(i) + noise
(g_i: geometric scaling to the reference geometry; mu_b: unknown spectral value; s_v: brightness
offset of visit v). Visit offsets are defined only *relative within connected components* of the
visit-bin graph. With a known rotation period, a periodic model s = L(phi) (zero-mean Fourier
series) can link all visits - but it is adopted only if the repeats support it:
    - the brightness is significantly variable (constant-brightness model rejected),
    - enough repeat bins and rotational-phase coverage,
    - Delta-BIC of the periodic model >= threshold,
    - it explains most of the variance that free visit offsets explain,
    - SWIR and MWIR repeats agree (achromatic lightcurve).
No correction is applied that the repeats cannot support. Without repeats, variability between
visits cannot be tested, and that is reported as an untested assumption.

Observing seasons. SPHEREx sees an asteroid in windows of days to weeks about every six months. Between
seasons the phase angle and the aspect change, and the geometric scaling (H-G phase function with an
assumed G) does not remove that exactly, so every model above includes one free brightness offset per
season (s_season, for seasons linked by repeats; gauge: the season with most repeat points). Variability
is then tested, and the lightcurve fitted, within seasons. Without the offsets a few points from another
season made the whole spectrum "variable" (92 Undina, 2026-11-15: 24 of 120 points from a season 250 d
later; visit offsets left 11 unlinked normalisation groups and the class went X -> S; with the main
season alone the visits were consistent and X came first).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import stats

from ..common.config import settings
from ..physical.phase_function import PhaseLaw
from ..physical.thermal_model import neatm_flux_jy

LIGHT_TIME_S_PER_AU = 499.004784


@dataclass
class TemporalResult:
    n_points: int
    n_exposures: int
    n_visits: int
    time_span_days: float
    n_seasons: int = 1
    season_offsets: dict = field(default_factory=dict)  # season -> {"offset_mag", "err_mag"} (seasons linked by repeats)
    visits: list = field(default_factory=list)
    families: dict = field(default_factory=dict)           # band -> family label
    band_epochs: dict = field(default_factory=dict)
    segment_time_offsets: list = field(default_factory=list)
    geometry_ranges: dict = field(default_factory=dict)
    lambda_time_correlation: dict = field(default_factory=dict)
    n_repeat_bins: int = 0
    n_repeat_points: int = 0
    components: list = field(default_factory=list)
    variability: dict = field(default_factory=dict)
    lightcurve: dict = field(default_factory=dict)
    correction: str = "none"            # periodic_lightcurve | visit_offsets | none
    cross_visit_verified: bool = False  # brightness consistency between visits tested by repeats
    n_norm_groups: int = 1
    warnings: list = field(default_factory=list)
    points: pd.DataFrame | None = None

    def summary(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if k != "points"}


# ----------------------------------------------------------------------------- structure
def assign_visits(mjd: np.ndarray, gap_min: float) -> np.ndarray:
    order = np.argsort(mjd)
    t = mjd[order]
    v = np.concatenate([[0], np.cumsum(np.diff(t) * 1440.0 > gap_min)])
    out = np.empty(len(mjd), int)
    out[order] = v
    return out


def assign_seasons(mjd: np.ndarray, gap_days: float) -> np.ndarray:
    """Observing seasons: runs of exposures separated by less than gap_days."""
    order = np.argsort(mjd)
    t = mjd[order]
    s = np.concatenate([[0], np.cumsum(np.diff(t) > gap_days)])
    out = np.empty(len(mjd), int)
    out[order] = s
    return out


def _season_design(rep: pd.DataFrame) -> tuple[np.ndarray, list]:
    """Design matrix of the free season offsets on the repeat points: one column per season except the
    reference (most repeat points) of each connected component of the season / repeat-bin graph. A season
    not linked to another by a repeat bin gets no column (its offset cannot be measured)."""
    if "season" not in rep or rep["season"].nunique() < 2:
        return np.zeros((len(rep), 0)), []
    comps = _components(rep.groupby("repeat_cluster")["season"].unique())
    n_pts = rep.groupby("season").size()
    ref = {max(c, key=lambda s: (int(n_pts.get(s, 0)), -int(s))) for c in comps}
    free = sorted(int(s) for s in set(rep["season"]) - ref)
    pos = {s: k for k, s in enumerate(free)}
    S = np.zeros((len(rep), len(free)))
    for row, s in enumerate(rep["season"].values):
        if int(s) in pos:
            S[row, pos[int(s)]] = 1.0
    return S, free


def _season_map(seasons: pd.Series, values: dict) -> np.ndarray:
    return seasons.map(lambda s: values.get(int(s), 0.0)).to_numpy(float)


def detector_families(df: pd.DataFrame) -> dict:
    """Bands observed in the same exposure belong to one family (data-driven; for SPHEREx
    D1+D4, D2+D5, D3+D6)."""
    parent = {b: b for b in df["band"].unique()}

    def find(b):
        while parent[b] != b:
            parent[b] = parent[parent[b]]
            b = parent[b]
        return b

    if "obs_id" in df:
        for _, g in df.groupby("obs_id"):
            bs = list(g["band"].unique())
            for b in bs[1:]:
                parent[find(b)] = find(bs[0])
    groups = defaultdict(list)
    for b in parent:
        groups[find(b)].append(b)
    return {b: "+".join(sorted(groups[find(b)])) for b in parent}


def repeat_clusters(df: pd.DataFrame, R: float, factor: float) -> np.ndarray:
    """Cluster points of the same band whose wavelengths differ by < lambda / (factor R)."""
    cid = np.full(len(df), -1)
    k = 0
    for _, g in df.groupby("band"):
        g = g.sort_values("wavelength_um")
        idx = g.index.values
        lam = g["wavelength_um"].values
        start = 0
        for i in range(1, len(lam) + 1):
            if i == len(lam) or lam[i] - lam[start] > lam[start] / (factor * R):
                cid[df.index.get_indexer(idx[start:i])] = k
                k += 1
                start = i
    return cid


def geometric_log_scale(df: pd.DataFrame, G: float, eta0: float, emissivity: float,
                        thermal_min_um: float = 3.0, *, phase: PhaseLaw | None = None) -> np.ndarray:
    """ln of the flux change caused by viewing geometry, relative to the median geometry.
    Reflected light (lambda < thermal_min_um): F ~ Phi(alpha) / (r Delta)^2.
    Thermal (lambda >= thermal_min_um): ratio of NEATM fluxes (the diameter cancels exactly)."""
    r, d, a = (df[c].values.astype(float) for c in ("r_au", "delta_au", "phase_deg"))
    lam = df["wavelength_um"].values.astype(float)
    r0, d0, a0 = np.median(r), np.median(d), np.median(a)
    phase = phase or PhaseLaw(G=G)
    refl = -2 * np.log(r / r0) - 2 * np.log(d / d0) + np.log(phase.phi(a) / phase.phi(a0))
    out = refl.copy()
    th = lam >= thermal_min_um
    if th.any():
        A = phase.phase_integral() * 0.2          # nominal Bond albedo; enters only via r-dependence
        f = neatm_flux_jy(lam[th], 1.0, eta0, r[th], d[th], a[th], A, emissivity)
        f0 = neatm_flux_jy(lam[th], 1.0, eta0, np.full(th.sum(), r0), np.full(th.sum(), d0),
                           np.full(th.sum(), a0), A, emissivity)
        out[th] = np.log(f / f0)
    return out


def _components(visit_lists):
    """Connected components of visits linked by shared repeat bins."""
    parent = {}

    def find(v):
        parent.setdefault(v, v)
        while parent[v] != v:
            parent[v] = parent[parent[v]]
            v = parent[v]
        return v

    for vs in visit_lists:
        vs = list(vs)
        for v in vs:
            find(v)
        for v in vs[1:]:
            parent[find(v)] = find(vs[0])
    comp = defaultdict(list)
    for v in parent:
        comp[find(v)].append(v)
    return [sorted(c) for c in comp.values()]


def _wls(A, y, sig):
    w = 1.0 / sig
    Aw, yw = A * w[:, None], y * w
    coef, *_ = np.linalg.lstsq(Aw, yw, rcond=None)
    resid = yw - Aw @ coef
    cov = np.linalg.pinv(Aw.T @ Aw)
    return coef, float(resid @ resid), cov


def _fourier(phase, n_harm):
    cols = []
    for k in range(1, n_harm + 1):
        cols += [np.cos(k * phase), np.sin(k * phase)]
    return np.column_stack(cols)


# ----------------------------------------------------------------------------- main
def analyse_temporal(spectrum: pd.DataFrame, rotation_period_h: float | None = None, G: float = 0.15,
                     eta0: float = 1.0, cfg: dict | None = None, *, phase: PhaseLaw | None = None) -> TemporalResult:
    cfg = cfg or settings()["temporal"]
    R = settings()["classification"]["spherex_resolving_power"]
    emiss = settings()["thermal_model"]["emissivity"]
    df = spectrum.reset_index(drop=True).copy()
    warnings = []
    need = {"mjd", "wavelength_um", "flux_uJy", "flux_err_uJy", "band", "r_au", "delta_au", "phase_deg"}
    if not need <= set(df.columns) or df[list(need - {"band"})].isna().any().any() or len(df) < 2:
        res = TemporalResult(len(df), 0, 0, 0.0, warnings=["Observation times or geometry missing: temporal "
                                                            "structure cannot be analysed."])
        df["visit"], df["norm_group"], df["corr_ln"], df["corr_ln_err"] = 0, 0, 0.0, 0.0
        res.points = df
        return res

    df["visit"] = assign_visits(df["mjd"].values, cfg["visit_gap_min"])
    season_gap = float(cfg.get("season_gap_days", 30.0))
    df["season"] = assign_seasons(df["mjd"].values, season_gap)
    fam = detector_families(df)
    df["family"] = df["band"].map(fam)
    df["arm"] = np.where(df["wavelength_um"] < 2.42, "SWIR", "MWIR")
    t_body = df["mjd"].values - df["delta_au"].values * LIGHT_TIME_S_PER_AU / 86400.0
    if rotation_period_h:
        df["rot_phase"] = (t_body * 24.0 / rotation_period_h) % 1.0
    res = TemporalResult(
        n_points=len(df), n_exposures=int(df["obs_id"].nunique()) if "obs_id" in df else len(df),
        n_visits=int(df["visit"].nunique()), time_span_days=float(df["mjd"].max() - df["mjd"].min()),
        n_seasons=int(df["season"].nunique()), families={b: f for b, f in fam.items()})
    for v, g in df.groupby("visit"):
        res.visits.append({"visit": int(v), "mjd_start": float(g["mjd"].min()), "mjd_end": float(g["mjd"].max()),
                           "bands": sorted(g["band"].unique()), "family": g["family"].iloc[0],
                           "n_points": int(len(g)),
                           "rot_phase": float(g["rot_phase"].mean()) if "rot_phase" in g else None})
    for b, g in df.groupby("band"):
        res.band_epochs[b] = {"n": int(len(g)), "n_visits": int(g["visit"].nunique()),
                              "mjd_min": float(g["mjd"].min()), "mjd_max": float(g["mjd"].max()),
                              "mjd_median": float(g["mjd"].median())}
        if len(g) >= 4 and g["mjd"].nunique() > 1:
            res.lambda_time_correlation[b] = float(stats.spearmanr(g["wavelength_um"], g["mjd"])[0])
    bands = sorted(res.band_epochs)
    for b1, b2 in zip(bands[:-1], bands[1:]):
        dt = res.band_epochs[b2]["mjd_median"] - res.band_epochs[b1]["mjd_median"]
        shared = set(df.loc[df["band"] == b1, "visit"]) & set(df.loc[df["band"] == b2, "visit"])
        res.segment_time_offsets.append({"segments": f"{b1}-{b2}", "median_dt_days": float(dt),
                                         "shared_visits": len(shared)})
    res.geometry_ranges = {c: [float(df[c].min()), float(df[c].max())] for c in ("phase_deg", "r_au", "delta_au")}
    if res.n_visits > 1:
        unshared = [s["segments"] for s in res.segment_time_offsets if s["shared_visits"] == 0]
        warnings.append(f"Spectrum assembled from {res.n_visits} visits over {res.time_span_days:.2f} d "
                        f"(phase angle {res.geometry_ranges['phase_deg'][0]:.1f}-{res.geometry_ranges['phase_deg'][1]:.1f} deg).")
        if unshared:
            warnings.append(f"Adjacent spectral segments never observed together ({', '.join(unshared)}): their "
                            "relative brightness depends on variability between visits.")

    # repeated observations
    df["repeat_cluster"] = repeat_clusters(df, R, cfg["repeat_resolution_factor"])
    nvis = df.groupby("repeat_cluster")["visit"].nunique()
    rep_ids = nvis[nvis >= 2].index
    rep = df[df["repeat_cluster"].isin(rep_ids)].copy()
    res.n_repeat_bins, res.n_repeat_points = int(len(rep_ids)), int(len(rep))
    lng = geometric_log_scale(df, G, eta0, emiss, phase=phase)
    y_all = np.log(np.clip(df["flux_uJy"].values, 1e-30, None)) - lng
    sig_all = np.hypot(df["flux_err_uJy"].values / np.abs(df["flux_uJy"].values), cfg["photometric_floor_frac"])
    df["corr_ln"], df["corr_ln_err"] = 0.0, 0.0

    if res.n_repeat_bins == 0:
        res.cross_visit_verified = False
        res.variability = {"tested": False, "reason": "no repeated observations of the same wavelength"}
        res.lightcurve = {"period_h": rotation_period_h, "supported": False,
                          "reason": "no repeated observations: a rotational correction cannot be constrained"}
        if res.n_visits > 1:
            prior = cfg.get("untested_visit_sigma_mag", 0.1)
            df["corr_ln_err"] = prior / 1.0857
            warnings.append("No repeated observations: brightness changes between visits cannot be tested or "
                            f"corrected; a visit-to-visit uncertainty of {prior} mag rms (typical asteroid "
                            "lightcurve) is assumed in the error covariance (untested).")
        df["norm_group"] = 0
        res.correction, res.n_norm_groups, res.warnings, res.points = "none", 1, warnings, df
        return res

    ri = rep.index.values
    y, sig = y_all[ri], sig_all[ri]
    bin_codes = pd.Categorical(rep["repeat_cluster"]).codes
    B = np.eye(bin_codes.max() + 1)[bin_codes]
    # null model: constant brightness within each observing season (one free offset per linked season)
    Sm, s_free = _season_design(rep)
    coef0, chi0, cov0 = _wls(np.hstack([B, Sm]), y, sig)
    dof0 = len(y) - B.shape[1] - Sm.shape[1]
    infl0 = max(chi0 / max(dof0, 1), 1.0)
    s_season = {s: float(coef0[B.shape[1] + k]) for k, s in enumerate(s_free)}
    s_season_err = {s: float(np.sqrt(cov0[B.shape[1] + k, B.shape[1] + k] * infl0)) for k, s in enumerate(s_free)}
    res.season_offsets = {s: {"offset_mag": 1.0857 * v, "err_mag": 1.0857 * s_season_err[s]} for s, v in s_season.items()}
    if s_free:
        n_cross = int((rep.groupby("repeat_cluster")["season"].nunique() >= 2).sum())
        warnings.append(f"Observations span {res.n_seasons} observing seasons (gaps > {season_gap:g} d): viewing "
                        "geometry and aspect differ between them, so one brightness offset per season is fitted to the "
                        f"{n_cross} repeat bins that link seasons ("
                        + ", ".join(f"season {s}: {1.0857 * v:+.2f} +- {1.0857 * s_season_err[s]:.2f} mag"
                                    for s, v in s_season.items())
                        + "); variability is tested within seasons.")
    comps = _components(rep.groupby("repeat_cluster")["visit"].unique())
    res.components = [[int(v) for v in c] for c in comps]
    # free visit offsets (gauge: first visit of each component fixed at 0)
    ref_vis = {c[0] for c in comps}
    vis_free = sorted(set(rep["visit"]) - ref_vis)
    V = np.zeros((len(rep), len(vis_free)))
    vpos = {v: k for k, v in enumerate(vis_free)}
    for row, v in enumerate(rep["visit"].values):
        if v in vpos:
            V[row, vpos[v]] = 1.0
    coef1, chi1, cov1 = _wls(np.hstack([B, V]), y, sig)
    dof1 = dof0 - V.shape[1]
    p_const = float(stats.chi2.sf(chi0, max(dof0, 1)))
    detected = p_const < cfg["variability_p_threshold"]
    s_vis = {v: 0.0 for v in ref_vis}
    s_vis.update({v: float(coef1[B.shape[1] + k]) for v, k in vpos.items()})
    for c in comps:                                   # re-centre offsets within each component
        m = np.mean([s_vis[v] for v in c])
        for v in c:
            s_vis[v] -= m
    rms_ln = float(np.std(list(s_vis.values()))) if len(s_vis) > 1 else 0.0
    res.variability = {"tested": True, "n_repeat_bins": res.n_repeat_bins, "n_repeat_points": res.n_repeat_points,
                       "chi2_constant": chi0, "dof_constant": int(dof0), "p_constant": p_const,
                       "chi2_visit_offsets": chi1, "dof_visit_offsets": int(dof1), "detected": bool(detected),
                       "visit_offset_rms_mag": 1.0857 * rms_ln, "n_components": len(comps),
                       "photometric_floor_frac": cfg["photometric_floor_frac"],
                       "null_model": "constant within observing seasons" if s_free else "constant",
                       "n_seasons": res.n_seasons, "season_offsets_mag": {s: v["offset_mag"] for s, v in res.season_offsets.items()}}
    res.cross_visit_verified = True

    if not detected:
        # "Not detected" is not "zero": the spread of the fitted visit offsets bounds the variability
        # between visits that the repeats could test, and applies to visits they could not link.
        sig_v = max(rms_ln, cfg["photometric_floor_frac"])
        prior = cfg.get("untested_visit_sigma_mag", 0.1) / 1.0857
        # Only the visits of ONE connected component are tested against each other: the largest (most
        # points) is the reference. A smaller component is consistent internally, but its brightness
        # relative to the reference is untested (10 Hygiea: visits 0 and 5 were linked only to each other,
        # 10% fainter than the rest, and with the small tested error they made a false 0.9-um band).
        n_pts = rep.groupby("visit").size()
        main = max(comps, key=lambda c: (int(n_pts.reindex(c).fillna(0).sum()), len(c))) if comps else []
        linked = set(main)
        df["corr_ln_err"] = [sig_v if v in linked else prior for v in df["visit"].values]
        if s_free:                     # season offsets measured by the repeats: divided out, error propagated
            df["corr_ln"] = _season_map(df["season"], s_season)
            df["corr_ln_err"] = np.hypot(df["corr_ln_err"].to_numpy(float), _season_map(df["season"], s_season_err))
        n_unlinked = int(df.loc[~df["visit"].isin(linked), "visit"].nunique())
        n_side = sum(len(c) for c in comps if c is not main)
        warnings.append(f"Brightness consistent between visits on {res.n_repeat_bins} repeat bins "
                        f"(p = {p_const:.2g}): no correction applied. Visit-to-visit uncertainty kept in the "
                        f"error covariance: {1.0857 * sig_v:.3f} mag for the {len(main)} visits linked by repeats "
                        "to the largest group"
                        + (f", {1.0857 * prior:.2f} mag (untested prior) for {n_unlinked} visits not linked to it"
                           + (f" ({n_side} of them linked only within smaller groups)" if n_side else "")
                           if n_unlinked else "") + ".")
        res.lightcurve = {"period_h": rotation_period_h, "supported": False,
                          "reason": "no significant variability between visits"
                                    + (" within observing seasons" if s_free else "")}
        df["norm_group"] = 0
        res.correction = "season_offsets" if s_free else "none"
        res.n_norm_groups, res.warnings, res.points = 1, warnings, df
        return res
    warnings.append(f"Brightness varies between visits{' within observing seasons' if s_free else ''}: "
                    f"constant-brightness model rejected on {res.n_repeat_bins} repeat bins (p = {p_const:.1e}); "
                    f"visit-offset rms {1.0857 * rms_ln:.2f} mag.")

    # periodic lightcurve model, only if supported by the repeats
    if not rotation_period_h:
        res.lightcurve = {"period_h": None, "tested": False, "supported": False, "reason": "rotation period unknown"}
        warnings.append("Rotation period unknown: no periodic correction; visits linked only through repeats.")
        return _fallback_offsets(df, res, rep, comps, s_vis, vpos, cov1, B, chi1, dof1, warnings, set())

    nh, bic_table = select_harmonics(rep, y, sig, bin_codes, cfg, res.n_repeat_bins)
    joint = _periodic_model(rep, y, sig, bin_codes, nh, cfg, n_bins_total=res.n_repeat_bins)
    arms = {}
    for arm in ("SWIR", "MWIR"):
        m = (rep["arm"] == arm).values
        if m.sum() >= 2 * nh + 4:
            arms[arm] = _periodic_model(rep[m], y[m], sig[m], pd.Categorical(bin_codes[m]).codes, nh, cfg,
                                        n_bins_total=int(rep.loc[m, "repeat_cluster"].nunique()))
    ach_p = None
    if len(arms) == 2:
        d = np.asarray(arms["SWIR"]["coeffs_ln"]) - np.asarray(arms["MWIR"]["coeffs_ln"])
        Cs = np.asarray(arms["SWIR"]["cov_ln"]) + np.asarray(arms["MWIR"]["cov_ln"])
        ach_p = float(stats.chi2.sf(float(d @ np.linalg.pinv(Cs) @ d), len(d)))
    achromatic = ach_p is None or ach_p >= cfg["achromatic_p_threshold"]
    lc = {"period_h": rotation_period_h, "tested": True, "harmonics": nh, "harmonics_bic": bic_table,
          "achromatic_p": ach_p,
          "joint": _public(joint), "per_arm": {a: _public(v) for a, v in arms.items()}}
    phase_all = 2 * np.pi * df["rot_phase"].values
    X = _fourier(phase_all, nh)

    def apply(model, mask):
        c = np.asarray(model["coeffs_ln"])
        C = np.asarray(model["cov_ln"])
        L = X[mask] @ c
        Lerr = np.sqrt(np.einsum("ij,jk,ik->i", X[mask], C, X[mask]))
        so = _season_map(df.loc[mask, "season"], model.get("season_offsets_ln") or {})
        se = _season_map(df.loc[mask, "season"], model.get("season_offsets_err_ln") or {})
        df.loc[mask, "corr_ln"] = L + so
        df.loc[mask, "corr_ln_err"] = np.sqrt(Lerr ** 2 + model["resid_extra_ln"] ** 2 + se ** 2)

    if achromatic and joint["supported"]:
        apply(joint, np.ones(len(df), bool))
        df["norm_group"] = 0
        lc.update({"supported": True, "mode": "achromatic", "reason": "supported by repeats",
                   "amplitude_mag": joint["amplitude_mag"]})
        warnings.append(f"Rotational lightcurve (P = {rotation_period_h} h) fitted to repeated observations only "
                        f"(peak-to-peak {joint['amplitude_mag']:.2f} mag, Delta-BIC {joint['delta_bic']:.0f}); all "
                        "points normalised to the rotation-averaged brightness.")
        res.lightcurve, res.correction, res.n_norm_groups, res.warnings, res.points = lc, "periodic_lightcurve", 1, warnings, df
        return res

    # chromatic (or joint model not supported): separate lightcurves per arm, each tested on its own
    if not achromatic:
        warnings.append(f"SWIR and MWIR lightcurves differ (p = {ach_p:.1e}); each arm is tested and corrected "
                        "separately (normalised to its own rotation-averaged brightness).")
    corrected_arms = set()
    for arm, model in arms.items():
        if model["supported"] and not achromatic:
            apply(model, (df["arm"] == arm).values)
            corrected_arms.add(arm)
            warnings.append(f"{arm} lightcurve applied (peak-to-peak {model['amplitude_mag']:.2f} mag, "
                            f"Delta-BIC {model['delta_bic']:.0f}, phase coverage {model['phase_coverage']:.0%}).")
        elif not achromatic:
            warnings.append(f"{arm} lightcurve NOT applied: {model['reason']}.")
    if achromatic and not joint["supported"]:
        warnings.append("Periodic lightcurve correction NOT applied: " + joint["reason"] + ".")
    lc["supported"] = bool(corrected_arms)
    lc["mode"] = "per_arm" if corrected_arms else "none"
    lc["corrected_arms"] = sorted(corrected_arms)
    lc["reason"] = ("supported per arm: " + ", ".join(sorted(corrected_arms))) if corrected_arms else \
        (joint["reason"] if achromatic else "no arm passes the support criteria")
    res.lightcurve = lc
    if corrected_arms == {"SWIR", "MWIR"}:
        df["norm_group"] = 0
        res.correction, res.n_norm_groups, res.warnings, res.points = "periodic_lightcurve", 1, warnings, df
        return res
    return _fallback_offsets(df, res, rep, comps, s_vis, vpos, cov1, B, chi1, dof1, warnings, corrected_arms)


def select_harmonics(rep, y, sig, codes, cfg, n_bins_total) -> tuple[int, dict]:
    """Number of Fourier harmonics of the rotational lightcurve, chosen by BIC on the repeated observations
    (chi2 + 2 k ln n; the bin means are common to all models). A fixed two-harmonic model under-fits
    large-amplitude, elongated rotators, whose minima are sharper than their maxima (433 Eros: BIC
    797 -> 478 from 2 to 5 harmonics). cfg: lightcurve_harmonics (used when lightcurve_harmonics_max is
    absent), lightcurve_harmonics_max, and an optional forced value _force_harmonics (sensitivity runs).
    Only models with at least 3 degrees of freedom (repeat points minus bin means minus lightcurve terms)
    per lightcurve parameter are considered."""
    nh0 = int(cfg.get("lightcurve_harmonics", 2))
    if cfg.get("_force_harmonics"):
        return int(cfg["_force_harmonics"]), {}
    nh_max = int(cfg.get("lightcurve_harmonics_max", nh0))
    n = len(y)
    n_bins = int(pd.Series(codes).nunique())
    bic = {}
    for k in range(1, nh_max + 1):
        if n - n_bins - 2 * k < 3 * (2 * k):       # at least 3 degrees of freedom per lightcurve parameter
            break
        m = _periodic_model(rep, y, sig, codes, k, cfg, n_bins_total=n_bins_total)
        bic[k] = float(m["chi2"] + 2 * k * np.log(n))
    if not bic:
        return nh0, {}
    return min(bic, key=bic.get), bic


def _public(model: dict) -> dict:
    return {k: v for k, v in model.items() if k not in ("cov_ln",)}


def _periodic_model(rep, y, sig, codes, nh, cfg, n_bins_total) -> dict:
    """Constant / free-visit-offset / periodic models on a set of repeat points, and the support
    decision for the periodic model. The constant and periodic models include the free season offsets
    (_season_design); the free visit offsets contain them."""
    codes = pd.Categorical(codes).codes
    B = np.eye(codes.max() + 1)[codes]
    Sm, s_free = _season_design(rep)
    BS = np.hstack([B, Sm])
    _, chi0, _ = _wls(BS, y, sig)
    dof0 = len(y) - BS.shape[1]
    comps = _components(rep.groupby("repeat_cluster")["visit"].unique())
    ref = {c[0] for c in comps}
    free = sorted(set(rep["visit"]) - ref)
    V = np.zeros((len(rep), len(free)))
    pos = {v: k for k, v in enumerate(free)}
    for row, v in enumerate(rep["visit"].values):
        if v in pos:
            V[row, pos[v]] = 1.0
    _, chi1, _ = _wls(np.hstack([B, V]), y, sig)
    ph = 2 * np.pi * rep["rot_phase"].values
    Fm = _fourier(ph, nh)
    coef2, chi2v, cov2 = _wls(np.hstack([BS, Fm]), y, sig)
    dof2 = max(dof0 - Fm.shape[1], 1)
    dbic = float((chi0 - chi2v) - Fm.shape[1] * np.log(len(y)))
    expl = float((chi0 - chi2v) / (chi0 - chi1)) if chi0 > chi1 else 0.0
    cover = float(np.mean(np.histogram(rep["rot_phase"], bins=10, range=(0, 1))[0] > 0))
    infl = max(chi2v / dof2, 1.0)
    nb = BS.shape[1]
    c_lc = coef2[nb:]
    cov_lc = cov2[nb:, nb:] * infl
    season_off = {s: float(coef2[B.shape[1] + k]) for k, s in enumerate(s_free)}
    season_err = {s: float(np.sqrt(cov2[B.shape[1] + k, B.shape[1] + k] * infl)) for k, s in enumerate(s_free)}
    grid = np.linspace(0, 2 * np.pi, 361)
    Lg = _fourier(grid, nh) @ c_lc
    reasons = []
    if n_bins_total < cfg["lightcurve_min_repeat_bins"]:
        reasons.append(f"only {n_bins_total} repeat bins (< {cfg['lightcurve_min_repeat_bins']})")
    if cover < cfg["lightcurve_min_phase_coverage"]:
        reasons.append(f"rotational-phase coverage {cover:.0%} (< {cfg['lightcurve_min_phase_coverage']:.0%})")
    if dbic < cfg["lightcurve_min_delta_bic"]:
        reasons.append(f"Delta-BIC {dbic:.1f} (< {cfg['lightcurve_min_delta_bic']})")
    if expl < cfg["lightcurve_min_variance_explained"]:
        reasons.append(f"periodic model explains {expl:.0%} of the visit-to-visit variation "
                       f"(< {cfg['lightcurve_min_variance_explained']:.0%})")
    return {"n_points": int(len(y)), "n_bins": int(n_bins_total), "coeffs_ln": c_lc.tolist(), "cov_ln": cov_lc.tolist(),
            "amplitude_mag": float(1.0857 * (Lg.max() - Lg.min())), "delta_bic": dbic, "variance_explained": expl,
            "phase_coverage": cover, "chi2": float(chi2v), "dof": int(dof2),
            "season_offsets_ln": season_off, "season_offsets_err_ln": season_err,
            "resid_extra_ln": float(np.sqrt(max(chi2v / dof2 - 1.0, 0.0)) * float(np.median(sig))),
            "supported": not reasons, "reason": "; ".join(reasons) if reasons else "supported by repeats"}


def _fallback_offsets(df, res, rep, comps, s_vis, vpos, cov1, B, chi1, dof1, warnings, corrected_arms):
    """Relative visit offsets within connected components for the arms not corrected by a periodic
    model. Components (and visits without repeats) remain independent normalisation groups."""
    arm_ok = df["arm"].isin(corrected_arms).values
    comp_of = {v: k + 1 for k, c in enumerate(comps) for v in c}     # group 0 = periodic-corrected arms
    nxt = len(comps) + 1
    groups = []
    err1 = {v: float(np.sqrt(cov1[B.shape[1] + k, B.shape[1] + k] * max(chi1 / max(dof1, 1), 1.0)))
            for v, k in vpos.items()}
    for i, v in enumerate(df["visit"].values):
        if arm_ok[i]:
            groups.append(0)
            continue
        if v not in comp_of:
            comp_of[v] = nxt
            nxt += 1
        groups.append(comp_of[v])
        df.iat[i, df.columns.get_loc("corr_ln")] = s_vis.get(v, 0.0)
        df.iat[i, df.columns.get_loc("corr_ln_err")] = err1.get(v, 0.0)
    df["norm_group"] = pd.Categorical(groups).codes if not arm_ok.any() else groups
    if arm_ok.any():   # keep 0 for the periodic-corrected arm(s), renumber the rest consecutively
        uniq = sorted(set(groups) - {0})
        remap = {g: k + 1 for k, g in enumerate(uniq)}
        remap[0] = 0
        df["norm_group"] = [remap[g] for g in groups]
    res.correction = "periodic_lightcurve+visit_offsets" if corrected_arms else "visit_offsets"
    res.n_norm_groups = int(df["norm_group"].nunique())
    if res.n_norm_groups > 1:
        warnings.append(f"{res.n_norm_groups} normalisation groups could not be linked: their relative "
                        "brightness (and the spectral slope across them) is not constrained by the data.")
    res.warnings, res.points = warnings, df
    return res


def apply_temporal_correction(spectrum: pd.DataFrame, temporal: TemporalResult) -> pd.DataFrame:
    """Divide out the supported brightness corrections and propagate their uncertainty. Adds
    columns visit, family, norm_group, temporal_corr_mag; flux_uJy / flux_err_uJy become the
    corrected values (originals kept as flux_uJy_raw / flux_err_uJy_raw)."""
    p = temporal.points
    out = spectrum.reset_index(drop=True).copy()
    if p is None or len(p) != len(out):
        out["norm_group"] = 0
        return out
    for c in ("visit", "season", "family", "norm_group", "rot_phase"):
        if c in p:
            out[c] = p[c].values
    corr = p["corr_ln"].values
    cerr = p["corr_ln_err"].values
    out["flux_uJy_raw"], out["flux_err_uJy_raw"] = out["flux_uJy"], out["flux_err_uJy"]
    f = out["flux_uJy"].values * np.exp(-corr)
    rel = np.hypot(out["flux_err_uJy"].values / np.abs(out["flux_uJy"].values), cerr)
    out["flux_uJy"], out["flux_err_uJy"] = f, np.abs(f) * rel
    out["temporal_corr_mag"] = 1.0857 * corr
    out["temporal_corr_err_ln"] = cerr
    return out


def slope_systematic_per_um(points: pd.DataFrame, temporal: TemporalResult,
                            window: tuple = (0.75, 2.45)) -> float | None:
    """Systematic uncertainty (relative, per um) of the spectral slope across detector families,
    caused by the uncertainty of the brightness normalisation between visits.
      * one visit, or brightness verified constant: 0;
      * several visits but no repeated observations (consistency untested): None (slope unconstrained);
      * several normalisation groups: 0 here - the classification fits independent group scales,
        so only within-group slopes are used;
      * corrected: per-family normalisation error delta_f = sqrt(sum_v sigma_v^2) / n_v from the
        per-visit correction errors, propagated through an unweighted linear fit across the family
        mean wavelengths: Var = sum_f delta_f^2 (l_f - l_mean)^2 / (sum_f (l_f - l_mean)^2)^2."""
    if temporal.n_visits <= 1:
        return 0.0
    if not temporal.cross_visit_verified:
        return None
    p = points[(points["wavelength_um"] >= window[0]) & (points["wavelength_um"] <= window[1])]
    if "norm_group" in p and p["norm_group"].nunique() > 1:
        return 0.0
    if "family" not in p or p["family"].nunique() < 2 or "temporal_corr_err_ln" not in p:
        return 0.0
    lam_f, delta_f = [], []
    for _, g in p.groupby("family"):
        per_visit = g.groupby("visit")["temporal_corr_err_ln"].median().values
        lam_f.append(float(g["wavelength_um"].mean()))
        delta_f.append(float(np.sqrt(np.sum(per_visit ** 2)) / max(len(per_visit), 1)))
    lam_f, delta_f = np.array(lam_f), np.array(delta_f)
    dl = lam_f - lam_f.mean()
    den = np.sum(dl ** 2)
    if den <= 0:
        return 0.0
    return float(np.sqrt(np.sum(delta_f ** 2 * dl ** 2)) / den)
