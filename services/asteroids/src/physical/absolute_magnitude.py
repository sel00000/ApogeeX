"""Absolute magnitude H: retrieval, validation and estimation from optical photometry.

Order of precedence
  1. JPL SBDB H (with its reference and uncertainty, if given).
  2. Other authoritative catalogues / archives (pluggable providers).
  3. Estimate from multi-epoch optical photometry (any facility; none is preferred):
       V_i     = m_i + c(band)                (only verified band corrections, if enabled)
       V_red,i = V_i - 5 log10(r_i * Delta_i)
       V_red,i = H - 2.5 log10(Phi(alpha_i; G))       (H-G; H-G1-G2 via sbpy)
     G is fitted only when the phase-angle span allows it; otherwise G is fixed and the
     choice is recorded. Rotational variability is included as an extra error term
     (configured amplitude, or inferred from residual scatter and flagged).
If requirements are not met, H is not estimated and the follow-up needs are listed.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.optimize import least_squares

from ..common import status
from ..common.config import band_corrections, model_version, settings
from ..common.provenance import Provenance
from .phase_function import hg_phi, hg1g2_available, hg1g2_reduced_mag


@dataclass
class HResult:
    status: str                         # CATALOG | ESTIMATED | H unavailable | Insufficient optical photometry
    H: float | None = None
    H_err: float | None = None
    H_err_provided: bool = False
    G: float | None = None
    G_err: float | None = None
    G_fitted: bool = False
    G1: float | None = None
    G2: float | None = None
    G1_err: float | None = None
    G2_err: float | None = None
    band: str = "V"
    source: str = ""
    reference: str = ""
    phase_model: str = ""
    n_points: int = 0
    n_nights: int = 0
    phase_range_deg: tuple | None = None
    rms_mag: float | None = None
    rotational_error_mag: float | None = None
    rotational_error_inferred: bool = False
    excluded: dict = field(default_factory=dict)
    photometry_sources: list = field(default_factory=list)
    filters: list = field(default_factory=list)
    followup_requirements: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    residuals: list = field(default_factory=list)
    provenance: dict | None = None

    @property
    def reliable(self) -> bool:
        return self.status in ("CATALOG", "ESTIMATED") and self.H is not None


def h_from_sbdb(sbdb) -> HResult:
    if sbdb is None or not sbdb.found:
        return HResult(status=status.H_UNAVAILABLE, warnings=["Object not found in JPL SBDB."])
    p = sbdb.param("H")
    if p is None or p.value is None:
        return HResult(status=status.H_UNAVAILABLE, warnings=["JPL SBDB has no H for this object."])
    g = sbdb.param("G")
    res = HResult(status="CATALOG", H=p.value, H_err=p.sigma, H_err_provided=p.sigma is not None,
                  G=g.value if g else None, band="V", source="JPL SBDB", reference=p.reference,
                  phase_model="H-G (catalog)")
    if p.sigma is None:
        res.warnings.append("SBDB gives no H uncertainty; derived albedo uncertainty excludes the H term "
                            "and is a lower bound.")
    if g is None:
        res.warnings.append("SBDB gives no G; G=0.15 convention implied by the catalogue H.")
    return res


def _nights(mjd):
    return len(np.unique(np.floor(np.asarray(mjd) + 0.5)))


def estimate_h(phot: pd.DataFrame, geometry: pd.DataFrame, G_default: float | None = None,
               model: str | None = None) -> HResult:
    """phot: standard photometry table; geometry: per-row r_au, delta_au, phase_deg
    (same index/order as phot) from an ephemeris service."""
    cfg = settings()["photometry"]
    model = model or cfg["default_phase_model"]
    if model not in ("HG", "HG1G2"):
        raise ValueError(f"Unsupported phase model: {model}")
    prov = Provenance(step="absolute_magnitude", model_version=model_version("photometry"),
                      formula="V_red = m + c(band) - 5 log10(r Delta) = H - 2.5 log10 Phi(alpha)",
                      assumptions={"phase_model": model, "allow_band_corrections": cfg["allow_band_corrections"],
                                   "min_points": cfg["min_points"], "min_nights": cfg["min_nights"]})
    df = phot.reset_index(drop=True).join(geometry.reset_index(drop=True)[["r_au", "delta_au", "phase_deg"]])
    excluded = {}
    if "duplicate" in df:
        excluded["duplicate"] = int(df["duplicate"].sum())
        df = df[~df["duplicate"].astype(bool)]
    bad_geom = df[["r_au", "delta_au", "phase_deg"]].isna().any(axis=1)
    excluded["missing_geometry"] = int(bad_geom.sum())
    df = df[~bad_geom]

    bc = band_corrections()
    corr = bc.get("corrections", {})
    if cfg["allow_band_corrections"] and bc.get("verified_by_user"):
        known = df["band"].isin(list(corr))
        excluded["band_without_verified_correction"] = int((~known).sum())
        df = df[known].copy()
        df["V"] = df["mag"] + df["band"].map(corr)
        sys_err = float(bc.get("systematic_sigma_mag", 0.1))
        df["sys_err"] = np.where(df["band"].isin(["V", "v"]), 0.0, sys_err)
        prov.add_source({"name": "band corrections", "identifier": bc.get("source", "")})
    else:
        isV = df["band"].isin(["V"])
        excluded["non_V_band_no_correction_enabled"] = int((~isV).sum())
        df = df[isV].copy()
        df["V"] = df["mag"]
        df["sys_err"] = 0.0

    n, nn = len(df), _nights(df["mjd"]) if len(df) else 0
    reqs = followup_requirements_text(n, nn, df["phase_deg"] if n else pd.Series(dtype=float))
    if model == "HG1G2" and not hg1g2_available():
        return HResult(status=status.H_UNAVAILABLE, phase_model="H-G1-G2", n_points=n, n_nights=nn,
                       provenance=prov.to_dict(), warnings=["H-G1-G2 requires sbpy; no other phase model was substituted."])
    if n < cfg["min_points"] or nn < cfg["min_nights"]:
        return HResult(status=status.INSUFFICIENT_PHOTOMETRY, n_points=n, n_nights=nn, excluded=excluded,
                       followup_requirements=reqs, provenance=prov.to_dict(),
                       warnings=[f"{n} usable points over {nn} nights (need {cfg['min_points']} over "
                                 f"{cfg['min_nights']})."])

    vred = df["V"].values - 5 * np.log10(df["r_au"].values * df["delta_au"].values)
    alpha = df["phase_deg"].values
    meas_err = df["mag_err"].values.astype(float)
    have_err = np.isfinite(meas_err)
    warnings = []
    if not have_err.all():
        warnings.append(f"{int((~have_err).sum())} points lack uncertainties; scatter-based weights used.")
    span = float(alpha.max() - alpha.min())
    fit_G = span >= cfg["min_phase_span_deg_fit_G"]
    G0 = 0.15 if G_default is None else G_default

    rot_cfg = cfg.get("rotational_error_floor_mag")

    def run(err):
        if model == "HG1G2":
            def f(p):
                # Fit on the physical simplex: G1=p1, G2=(1-G1)*p2.
                return (vred - hg1g2_reduced_mag(alpha, p[0], p[1], (1 - p[1]) * p[2])) / err
            x0, lb, ub = [np.median(vred), 0.3, 0.3], [-5, 0, 0], [35, 1, 1]
        else:
            if fit_G:
                def f(p):
                    return (vred - (p[0] - 2.5 * np.log10(hg_phi(alpha, p[1])))) / err
                x0, lb, ub = [np.median(vred), G0], [-5, -0.25], [35, 1.0]
            else:
                def f(p):
                    return (vred - (p[0] - 2.5 * np.log10(hg_phi(alpha, G0)))) / err
                x0, lb, ub = [np.median(vred)], [-5], [35]
        return least_squares(f, x0, bounds=(lb, ub))

    base_err = np.where(have_err, meas_err, np.nan)
    base_err = np.hypot(np.nan_to_num(base_err, nan=0.0), df["sys_err"].values)
    if rot_cfg is not None:
        rot = float(rot_cfg)
        inferred = False
    else:
        # infer the extra scatter (rotation + unmodelled) from an initial fit
        first = run(np.where(base_err > 0, base_err, 0.1))
        resid = first.fun * np.where(base_err > 0, base_err, 0.1)
        excess = np.var(resid) - np.mean(np.where(base_err > 0, base_err, 0) ** 2)
        rot = float(np.sqrt(max(excess, 0.0)))
        inferred = True
        warnings.append(f"Rotational/unmodelled scatter inferred from residuals: {rot:.3f} mag.")
    err = np.sqrt(base_err ** 2 + rot ** 2)
    err = np.where(err > 0, err, 0.1)
    sol = run(err)
    dof = max(n - len(sol.x), 1)
    chi2r = float(np.sum(sol.fun ** 2) / dof)
    _, singular, Vt = np.linalg.svd(sol.jac, full_matrices=False)
    if len(singular) != len(sol.x) or singular[-1] <= singular[0] * np.sqrt(np.finfo(float).eps):
        return HResult(status=status.INSUFFICIENT_PHOTOMETRY, phase_model=model, n_points=n, n_nights=nn,
                       provenance=prov.to_dict(), warnings=["Phase-angle coverage does not constrain the phase-model parameters."],
                       followup_requirements=reqs)
    cov = ((Vt.T / singular ** 2) @ Vt) * max(chi2r, 1.0)
    H, H_err = float(sol.x[0]), float(np.sqrt(cov[0, 0]))
    Gv = float(sol.x[1]) if len(sol.x) > 1 else G0
    Ge = float(np.sqrt(cov[1, 1])) if len(sol.x) > 1 else None
    g1 = g2 = g1err = g2err = None
    if model == "HG1G2":
        g1, g2 = float(sol.x[1]), float((1 - sol.x[1]) * sol.x[2])
        g1err = Ge
        grad_g2 = np.array([-sol.x[2], 1 - sol.x[1]])
        g2err = float(np.sqrt(max(float(grad_g2 @ cov[1:3, 1:3] @ grad_g2), 0)))
        Gv = Ge = None
    if not fit_G and model != "HG1G2":
        warnings.append(f"Phase span {span:.1f} deg < {cfg['min_phase_span_deg_fit_G']} deg: G fixed at {G0}.")
    if alpha.min() > 7:
        warnings.append("No data below 7 deg phase: the opposition effect is unconstrained; H may be biased.")
    resid_mag = sol.fun * err
    return HResult(
        status="ESTIMATED", H=H, H_err=H_err, H_err_provided=True, G=Gv, G_err=Ge, G_fitted=bool(fit_G or model == "HG1G2"),
        G1=g1, G2=g2, G1_err=g1err, G2_err=g2err,
        band="V", source="Estimated from optical photometry", phase_model="H-G1-G2" if model == "HG1G2"
        else "H-G (Bowell et al. 1989)", n_points=n, n_nights=nn,
        phase_range_deg=(float(alpha.min()), float(alpha.max())), rms_mag=float(np.std(resid_mag)),
        rotational_error_mag=rot, rotational_error_inferred=inferred, excluded=excluded,
        photometry_sources=sorted(df["provider"].astype(str).unique().tolist()),
        filters=sorted(df["band"].astype(str).unique().tolist()), warnings=warnings,
        residuals=resid_mag.tolist(), provenance=prov.to_dict())


def followup_requirements_text(n, nights, phases) -> list[str]:
    cfg = settings()["photometry"]
    req = []
    if n < cfg["min_points"]:
        req.append(f"At least {cfg['min_points']} calibrated photometric measurements (currently {n}).")
    if nights < cfg["min_nights"]:
        req.append(f"Observations on at least {cfg['min_nights']} separate nights (currently {nights}).")
    if len(phases) == 0 or (phases.max() - phases.min()) < cfg["min_phase_span_deg_fit_G"]:
        req.append(f"Phase-angle coverage spanning >= {cfg['min_phase_span_deg_fit_G']} deg, including alpha < 7 deg "
                   "if possible, to constrain the phase function.")
    req.append("Standard V (or a filter with a verified, documented transformation to V) and photometric "
               "calibration against a reference catalogue; report uncertainties.")
    req.append("Dense time sampling within each night, or a known rotation period, to average the lightcurve.")
    req.append("Any facility meeting these requirements is suitable; the required limiting magnitude follows "
               "from the predicted V magnitude in the follow-up plan.")
    return req
