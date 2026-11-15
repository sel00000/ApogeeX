"""Diameter posterior from all SPHEREx points: likelihood on a (log10 D, eta) grid, marginalised over eta with the
population eta prior (src/physical/eta_prior.py), optionally combined with the population albedo prior.

Model for every point i (visit v, normalisation group g), with its own r, Delta, alpha:
    F_i = exp(gamma_g + delta_v) [ S_i K0 (1 + s (lambda_i - 2 um)) + D^2 g_i(u) ],   u = ((1 - A) / eta)^(1/4)
  * g_i(u): NEATM flux of a 1-km body whose subsolar temperature is u (S0 / (eps sigma r_i^2))^(1/4), tabulated
    in u once per spectrum (exact NEATM, interpolated in ln flux); A = q pV with pV = (1329 10^(-H/5) / D)^2.
  * gamma_g: one free brightness offset per normalisation group (a group's brightness relative to the others is
    not constrained by the repeats); the largest group is the gauge. The thermal fit therefore uses every group,
    not only the one with the best coverage (236 Honoria: 63 points instead of 22).
  * delta_v ~ N(0, sigma_v): the brightness correction of each visit (lightcurve, visit offsets, season offsets) is
    uncertain by sigma_v (temporal analysis); that error is shared by all points of the visit. Spread over the points
    as independent errors it averaged down, so that a cross-visit normalisation error between the B5 and B6 visits
    acted as a measured thermal colour: 308 Polyxo then gave eta 1.22 +- 0.09 and D = 184 km (catalogue 129 km);
    with delta_v, eta 0.95 and D = 129 km.
  * s ~ N(s0, sigma_s): the continuum slope prior of the NEATM fit (thermal_model.continuum_slope_prior).
chi2(D, eta) is minimised over (K0, K0 s, gamma, delta) by alternating linear least squares, warm-started along D.
The likelihood exp(-(chi2 - chi2_min) / (2 kappa)) uses kappa = max(chi2_min / dof, 1) for unmodelled scatter, as
the least-squares fit does.

Marginalising over eta: at fixed eta the data fix D to 1-7%, while D ~ eta^1.5 along the Wien-side degeneracy. Between
the fitted eta values the chi2 curves are interpolated after shifting them to a common minimum (the valley moves
smoothly with eta), so that the marginal of D has no comb of spikes at the eta grid.

The thermal-only posterior (flat in log D for 0.003 <= pV <= 1.5) is the SPHEREx thermal diameter; it is reported
as a measurement only when the thermal-excess test of the NEATM fit is passed. The combined posterior multiplies in
the population albedo prior (complex probabilities without the albedo term, orbit and H): it is the best diameter
estimate, never used for an albedo.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common import status
from .phase_function import PhaseLaw
from .thermal_model import neatm_flux_jy

LAMBDA_C = 2.0
U_MIN, U_MAX, N_U = 0.50, 1.25, 320
LNC_MAX = 2.0
PV_RANGE = (0.003, 1.5)


@dataclass
class DiameterPosterior:
    status: str
    thermal: dict | None = None                # median, lo68, hi68, lo95, hi95 (thermal likelihood x eta prior)
    eta: dict | None = None                    # posterior median and 68% interval of eta
    detection_sigma: float | None = None       # sqrt(chi2 difference / kappa) against the smallest D of the grid
    thermal_fraction: float | None = None      # median thermal / total model flux at 4.4-5.0 um, at the median D
    combined: dict | None = None               # x population albedo prior
    combined_inputs: dict = field(default_factory=dict)
    eta_prior: dict | None = None
    kappa: float | None = None
    chi2_min: float | None = None
    dof: int | None = None
    n_points: int = 0
    n_groups: int = 0
    n_visits: int = 0
    n_visits_with_offset_error: int = 0
    method: str = ("NEATM likelihood on a (D, eta) grid from all points (free offset per normalisation group, "
                   "visit-correlated brightness errors as nuisance parameters), marginalised over the eta prior")
    warnings: list = field(default_factory=list)
    # internal arrays
    lgD: np.ndarray | None = None
    etas: np.ndarray | None = None
    chi2: np.ndarray | None = None
    _P: dict | None = None
    _eta_prior_obj: object = None

    def summary(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if k not in ("lgD", "etas", "chi2", "_P", "_eta_prior_obj")}

    def eta_prior_centre(self, D_km: float) -> float | None:
        """Median eta of the prior for a body of diameter D_km (the NEOWISE prior depends on size), or None."""
        if self._eta_prior_obj is None or not D_km or D_km <= 0:
            return None
        return float(self._eta_prior_obj.median_sigma(np.log10(D_km))[0][0])


# ------------------------------------------------------------------------------------------------- data
def prepare(df: pd.DataFrame, separator, H: float, G: float, *, phase: PhaseLaw | None = None) -> dict:
    """Points inside the NEATM fit windows with photometric errors, visit and group indices and the NEATM table.
    Points without a finite flux, positive error or geometry are left out (and counted), not the whole spectrum."""
    d = df.sort_values("wavelength_um").reset_index(drop=True)
    separator.phase = phase or PhaseLaw(G=G)
    separator.G = separator.phase.G
    d = d[separator._fit_mask(d["wavelength_um"].to_numpy(float))].reset_index(drop=True)
    shared = {"flux_err_uJy_raw", "flux_uJy_raw", "visit", "temporal_corr_err_ln"} <= set(d.columns)
    F = d["flux_uJy"].to_numpy(float) * 1e-6
    with np.errstate(divide="ignore", invalid="ignore"):
        if shared:
            # photometric error only: the visit-correction error enters once per visit (delta_v)
            E = np.abs(F) * (d["flux_err_uJy_raw"].to_numpy(float) / np.abs(d["flux_uJy_raw"].to_numpy(float)))
        else:
            E = d["flux_err_uJy"].to_numpy(float) * 1e-6
        S = np.asarray(separator.reflected_scale(d), float)
    geo = d[["r_au", "delta_au", "phase_deg"]].to_numpy(float)
    ok = np.isfinite(F) & np.isfinite(E) & (E > 0) & np.isfinite(S) & np.isfinite(geo).all(axis=1)
    n_dropped = int((~ok).sum())
    d, F, E, S = d[ok].reset_index(drop=True), F[ok], E[ok], S[ok]
    lam = d["wavelength_um"].to_numpy(float)
    if shared and len(d):
        vis = d["visit"].to_numpy()
        uv = np.unique(vis)
        vidx = np.searchsorted(uv, vis)
        sig_v = np.array([float(np.nanmedian(d.loc[vis == v, "temporal_corr_err_ln"])) for v in uv])
        sig_v = np.where(np.isfinite(sig_v), sig_v, 0.0)
    else:
        vidx, sig_v, uv = np.zeros(len(d), int), np.zeros(1), np.array([0])
    if "norm_group" in d and d["norm_group"].nunique() > 1:
        order = list(d["norm_group"].value_counts().index)
        gidx = d["norm_group"].map({g: k for k, g in enumerate(order)}).to_numpy(int)
        groups = order
    else:
        gidx, groups = np.zeros(len(d), int), [d["norm_group"].iloc[0] if "norm_group" in d and len(d) else 0]
    us = np.exp(np.linspace(np.log(U_MIN), np.log(U_MAX), N_U))
    cfg = separator.cfg
    tab = np.array([neatm_flux_jy(lam, 1.0, 1.0 / u ** 4, d["r_au"].to_numpy(float), d["delta_au"].to_numpy(float),
                                  d["phase_deg"].to_numpy(float), 0.0, cfg["emissivity"], cfg["integration_nodes"])
                    for u in us]) if len(d) else np.zeros((N_U, 0))
    return dict(d=d, lam=lam, F=F, E=E, S=S, x=lam - LAMBDA_C, gidx=gidx, n_g=len(groups), groups=groups,
                vidx=vidx, sig_v=sig_v, visits=uv, H=float(H), G=separator.G, phase_function=separator.phase.to_dict(), lnu=np.log(us),
                ltab=np.log(np.maximum(tab, 1e-300)), q=separator.phase.phase_integral(), n_dropped=n_dropped)


def thermal_flux(P: dict, D: float, eta: float) -> np.ndarray | None:
    pV = (1329.0 * 10 ** (-P["H"] / 5) / D) ** 2
    A = min(P["q"] * pV, 0.99)
    lu = 0.25 * np.log((1 - A) / eta)
    if lu < P["lnu"][0] or lu > P["lnu"][-1]:
        return None
    k = int(np.clip(np.searchsorted(P["lnu"], lu) - 1, 0, len(P["lnu"]) - 2))
    f = (lu - P["lnu"][k]) / (P["lnu"][k + 1] - P["lnu"][k])
    return D ** 2 * np.exp((1 - f) * P["ltab"][k] + f * P["ltab"][k + 1])


class NuisanceFit:
    """chi2 at fixed thermal flux, minimised over the continuum (K0, K1), group offsets and visit offsets."""

    def __init__(self, P: dict, s0: float, s_sig: float):
        self.P, self.s0, self.s_sig = P, float(s0), float(s_sig)
        free = P["sig_v"] > 0
        self.vfree = np.where(free)[0]
        pos = -np.ones(len(P["sig_v"]), int)
        pos[self.vfree] = np.arange(len(self.vfree))
        self.cols_g = P["n_g"] - 1
        n = len(P["F"])
        self.n_un = self.cols_g + len(self.vfree)
        J = np.zeros((n, self.n_un))
        rows = np.arange(n)
        hg = P["gidx"] > 0
        J[rows[hg], P["gidx"][hg] - 1] = 1.0
        fv = free[P["vidx"]]
        J[rows[fv], self.cols_g + pos[P["vidx"][fv]]] = 1.0
        self.J = J
        self.Pm = np.zeros((len(self.vfree), self.n_un))
        self.Pm[np.arange(len(self.vfree)), self.cols_g + np.arange(len(self.vfree))] = 1.0 / P["sig_v"][self.vfree]

    def fit(self, Th: np.ndarray, sol0: np.ndarray | None = None, n_iter: int = 12):
        P = self.P
        F, E, S, x = P["F"], P["E"], P["S"], P["x"]
        sol = np.zeros(self.n_un) if sol0 is None else sol0.copy()
        lnc = self.J @ sol if self.n_un else np.zeros_like(F)
        K0 = K1 = None
        for _ in range(n_iter):
            c = np.exp(lnc)
            Aw = np.vstack([c * S, c * S * x]).T / E[:, None]
            yw = (F - c * Th) / E
            k0ref = K0 if K0 else max(float(np.sum(Aw[:, 0] * yw) / np.sum(Aw[:, 0] ** 2)), 1e-30)
            M = np.vstack([Aw, np.array([[-self.s0, 1.0]]) / (abs(k0ref) * self.s_sig)])
            coef, *_ = np.linalg.lstsq(M, np.append(yw, 0.0), rcond=None)
            K0, K1 = float(coef[0]), float(coef[1])
            if not np.isfinite(K0) or K0 <= 0:
                return np.inf, None, None
            if self.n_un == 0:
                break
            m = c * (S * (K0 + K1 * x) + Th)
            sw = m / E
            MM = np.vstack([self.J * sw[:, None], self.Pm])
            bb = np.concatenate([(self.J @ sol + (F - m) / m) * sw, np.zeros(len(self.vfree))])
            new, *_ = np.linalg.lstsq(MM, bb, rcond=None)
            new = np.clip(new, -LNC_MAX, LNC_MAX)
            done = float(np.max(np.abs(new - sol))) < 1e-5
            sol, lnc = new, self.J @ new
            if done:
                break
        c = np.exp(lnc)
        m = c * (S * (K0 + K1 * x) + Th)
        chi2 = float(np.sum(((F - m) / E) ** 2)) + float(((K1 / K0 - self.s0) / self.s_sig) ** 2)
        if self.n_un:
            chi2 += float(np.sum((sol[self.cols_g:] / P["sig_v"][self.vfree]) ** 2))
        return chi2, sol, (K0, K1)


def _grids(H: float, cfg: dict, n_D: int, n_eta: int):
    lg0 = np.log10(1329.0 * 10 ** (-H / 5))
    lgD = np.linspace(lg0 - 0.5 * np.log10(PV_RANGE[1]), lg0 - 0.5 * np.log10(PV_RANGE[0]), n_D)
    lo, hi = cfg["eta_bounds"]
    return lgD, np.exp(np.linspace(np.log(lo), np.log(hi), n_eta))


def _nuisance(P: dict, separator) -> NuisanceFit:
    sp = separator.cfg.get("continuum_slope_prior") or {"mean_per_um": 0.05, "sigma_per_um": 0.20}
    return NuisanceFit(P, sp["mean_per_um"], sp["sigma_per_um"])


def chi2_grid(P: dict, separator, lgD: np.ndarray, etas: np.ndarray) -> np.ndarray:
    nf = _nuisance(P, separator)
    chi = np.full((len(etas), len(lgD)), np.inf)
    for j, eta in enumerate(etas):
        sol = None
        for k, lg in enumerate(lgD):
            Th = thermal_flux(P, 10 ** lg, eta)
            if Th is None:
                continue
            c2, s_new, _ = nf.fit(Th, sol)
            chi[j, k] = c2
            if s_new is not None:
                sol = s_new
    return chi


def _refine_eta(lgD, etas, L, n_sub: int):
    """Insert n_sub eta values between grid values, interpolating each likelihood curve L(lgD) after shifting it to
    the position of its maximum (the degeneracy valley moves smoothly with eta)."""
    if n_sub <= 1 or len(etas) < 2:
        return etas, L
    peak = lgD[np.argmax(L, axis=1)]
    has = L.max(axis=1) > 0
    out_e, out_L = [], []
    for j in range(len(etas) - 1):
        for t in np.linspace(0, 1, n_sub, endpoint=False):
            out_e.append(np.exp((1 - t) * np.log(etas[j]) + t * np.log(etas[j + 1])))
            if not (has[j] and has[j + 1]):
                out_L.append((1 - t) * L[j] + t * L[j + 1])
                continue
            pk = (1 - t) * peak[j] + t * peak[j + 1]
            a = np.interp(lgD - (pk - peak[j]), lgD, L[j], left=0.0, right=0.0)
            b = np.interp(lgD - (pk - peak[j + 1]), lgD, L[j + 1], left=0.0, right=0.0)
            out_L.append(np.exp((1 - t) * np.log(np.maximum(a, 1e-300)) + t * np.log(np.maximum(b, 1e-300))))
    out_e.append(etas[-1])
    out_L.append(L[-1])
    return np.array(out_e), np.array(out_L)


def _quantiles(lgD, p) -> dict:
    p = np.asarray(p, float)
    if not np.isfinite(p).all() or p.sum() <= 0:
        return None
    p = p / p.sum()
    cdf = np.cumsum(p) - 0.5 * p
    q = lambda v: float(10 ** np.interp(v, cdf, lgD))
    return {"median": q(0.5), "lo68": q(0.16), "hi68": q(0.84), "lo95": q(0.025), "hi95": q(0.975),
            "err_km": 0.5 * (q(0.84) - q(0.16))}


def _marginal(post: DiameterPosterior, extra: np.ndarray | None = None, n_sub: int = 6):
    """Posterior weights on (refined eta, log D). The chi2 is split into the part across the D-eta valley (how well
    the thermal flux level fits at each eta) and the part along it (which eta the 3.5-5 um colour prefers,
    chi2_min(eta) - chi2_min). Both are divided by kappa; the colour part once more by kappa, because a model that
    leaves unexplained scatter first misjudges a small difference between bands: 110 Lydia (hold-out, kappa 6.5)
    went to eta 1.45 and D = 126 km with the colour fully trusted, eta 1.10 and D = 86 km with it weighted by
    1/kappa (NEOWISE: eta 0.97, D = 88 km). At kappa ~ 1 nothing changes."""
    chi = post.chi2
    fin = np.isfinite(chi)
    rowmin = np.where(fin, chi, np.inf).min(axis=1)
    rowmin = np.where(np.isfinite(rowmin), rowmin, post.chi2_min)
    w = 1.0 / post.kappa
    eff = (chi - rowmin[:, None]) + w * (rowmin[:, None] - post.chi2_min)
    L = np.where(fin, np.exp(-0.5 * eff / post.kappa), 0.0)
    e_f, L_f = _refine_eta(post.lgD, post.etas, L, n_sub)
    W = post._eta_prior_obj.weights(e_f, post.lgD)
    p2 = L_f * W
    if extra is not None:
        p2 = p2 * extra[None, :]
    return e_f, p2


def thermal_posterior(df: pd.DataFrame, H: float | None, G: float, separator, eta_prior, n_D: int = 300,
                      n_eta: int = 41, *, phase: PhaseLaw | None = None) -> DiameterPosterior:
    """Thermal-only diameter posterior (likelihood x eta prior, flat in log D)."""
    if H is None or not np.isfinite(H):
        return DiameterPosterior(status=status.ALBEDO_NOT_ESTIMABLE, warnings=["H unavailable: no diameter posterior."])
    need = {"wavelength_um", "flux_uJy", "flux_err_uJy", "r_au", "delta_au", "phase_deg"}
    if df is None or df.empty or not need <= set(df.columns):
        return DiameterPosterior(status=status.ALBEDO_NOT_ESTIMABLE, warnings=["No spectrum with per-point geometry."])
    P = prepare(df, separator, H, G, phase=phase)
    n_th = int((P["lam"] >= separator.cfg["thermal_region_min_um"]).sum())
    lo, hi = separator.cfg["reflected_continuum_region_um"]
    n_c = int(((P["lam"] >= lo) & (P["lam"] <= hi)).sum())
    if n_th == 0 or n_c < 4:
        return DiameterPosterior(status=status.ALBEDO_NOT_ESTIMABLE, n_points=len(P["F"]),
                                 warnings=[f"Too few usable points for the thermal likelihood ({n_c} continuum, {n_th} "
                                           f"thermal; {P['n_dropped']} without finite flux, error or geometry)."])
    lgD, etas = _grids(H, separator.cfg, n_D, n_eta)
    chi = chi2_grid(P, separator, lgD, etas)
    fin = np.isfinite(chi)
    if not fin.any():
        return DiameterPosterior(status=status.ALBEDO_NOT_ESTIMABLE, warnings=["Thermal likelihood undefined on the grid."])
    n = len(P["F"])
    dof = max(n - 2 - (P["n_g"] - 1) - 2, 1)
    cmin = float(chi[fin].min())
    post = DiameterPosterior(status="OK", lgD=lgD, etas=etas, chi2=chi, kappa=max(cmin / dof, 1.0), chi2_min=cmin,
                             dof=dof, n_points=n, n_groups=P["n_g"], n_visits=len(P["visits"]),
                             n_visits_with_offset_error=int((P["sig_v"] > 0).sum()), eta_prior=eta_prior.summary())
    post._P = P
    post._eta_prior_obj = eta_prior
    e_f, p2 = _marginal(post)
    post.thermal = _quantiles(lgD, p2.sum(axis=0))
    pe = p2.sum(axis=1)
    pe = pe / pe.sum()
    c = np.cumsum(pe) - 0.5 * pe
    post.eta = {k: float(np.exp(np.interp(v, c, np.log(e_f)))) for k, v in (("median", 0.5), ("lo68", 0.16), ("hi68", 0.84))}
    small = chi[:, 0][np.isfinite(chi[:, 0])]
    post.detection_sigma = float(np.sqrt(max(small.min() - cmin, 0.0) / post.kappa)) if small.size else None
    if post.thermal:
        post.thermal_fraction = _thermal_fraction(post, separator, post.thermal["median"])
    if post.thermal and post.thermal["hi95"] >= 0.98 * 10 ** lgD[-1]:
        post.warnings.append("The thermal likelihood does not bound the diameter from above within pV >= 0.003.")
    if post.kappa > 1.5:
        post.warnings.append(f"Unexplained scatter: likelihood widened by chi2_red = {post.kappa:.1f}.")
    if P["n_dropped"]:
        post.warnings.append(f"{P['n_dropped']} fit-window points without a finite flux, positive error or geometry "
                             "left out of the thermal likelihood.")
    return post


def _thermal_fraction(post: DiameterPosterior, separator, D_km: float, lam_min: float = 4.4) -> float | None:
    """Median share of the thermal component in the model flux of the fit points at lam >= lam_min (B6)."""
    P = post._P
    m = P["lam"] >= lam_min
    if not m.any():
        return None
    nf = _nuisance(P, separator)
    Th = thermal_flux(P, D_km, eta_at(post, D_km))
    _, _, K = nf.fit(Th)
    if K is None:
        return None
    refl = P["S"] * (K[0] + K[1] * P["x"])
    return float(np.median((Th / (refl + Th))[m]))


def albedo_prior_lgD(lgD: np.ndarray, H: float, prior, complex_probabilities: list | None,
                     H_err: float | None = None) -> np.ndarray | None:
    """p(log10 D) implied by the population albedo prior (src/physical/population_priors.py): a mixture over the
    complexes (probabilities without the albedo term) or the orbit regression alone."""
    model = getattr(prior, "model", None)
    orbit = getattr(prior, "orbit", None) or {}
    if model is None or not orbit:
        return None
    a, e, i = orbit["a_au"], orbit["e"], orbit["i_deg"]
    lgpv = 2 * (np.log10(1329.0) - H / 5 - lgD)
    extra = 0.4 * float(H_err or 0.0)
    dens = np.zeros_like(lgD)
    if complex_probabilities:
        ps = np.array([c["probability"] for c in complex_probabilities], float)
        ps = ps / ps.sum()
        for c, p in zip(complex_probabilities, ps):
            if p < 1e-4:
                continue
            mu, sig = model.albedo_given_complex(a, e, i, H, c["complex"])
            s = float(np.hypot(sig, extra))
            dens += p * np.exp(-0.5 * ((lgpv - mu) / s) ** 2) / s
    else:
        mu, sig = model.orbit_albedo(a, e, i, H)
        s = float(np.hypot(sig, extra))
        dens = np.exp(-0.5 * ((lgpv - mu) / s) ** 2) / s
    return dens / dens.sum() if dens.sum() > 0 else None


def combine(post: DiameterPosterior, prior, complex_probabilities: list | None, H: float,
            H_err: float | None = None) -> dict | None:
    """Thermal likelihood x eta prior x population albedo prior."""
    if post is None or post.status != "OK":
        return None
    pa = albedo_prior_lgD(post.lgD, H, prior, complex_probabilities, H_err)
    if pa is None:
        return None
    _, p2 = _marginal(post, extra=pa)
    q = _quantiles(post.lgD, p2.sum(axis=0))
    post.combined = q
    post.combined_inputs = {"complex_weights": {c["complex"]: float(c["probability"]) for c in (complex_probabilities or [])
                                                if c["probability"] >= 0.005} or "orbit regression only",
                            "H": H, "H_err": H_err}
    return q


def likelihood_lgD(post: DiameterPosterior) -> tuple[np.ndarray, np.ndarray] | None:
    """Thermal likelihood of log10 D marginalised over the eta prior (max 1), for weighting prior draws."""
    if post is None or post.status != "OK":
        return None
    _, p2 = _marginal(post)
    L = p2.sum(axis=0)
    return (post.lgD, L / L.max()) if L.max() > 0 else None


def eta_at(post: DiameterPosterior, D_km: float) -> float:
    """eta of the chi2 valley at D (the most likely eta for that diameter)."""
    k = int(np.argmin(np.abs(post.lgD - np.log10(D_km))))
    col = post.chi2[:, k]
    if not np.isfinite(col).any():
        return float(post.eta["median"]) if post.eta else 1.0
    j = int(np.nanargmin(np.where(np.isfinite(col), col, np.nan)))
    if 0 < j < len(post.etas) - 1 and np.isfinite(col[j - 1]) and np.isfinite(col[j + 1]):
        y0, y1, y2 = col[j - 1], col[j], col[j + 1]
        den = y0 - 2 * y1 + y2
        off = 0.5 * (y0 - y2) / den if den > 0 else 0.0
        le = np.log(post.etas)
        return float(np.exp(le[j] + np.clip(off, -1, 1) * (le[j + 1] - le[j])))
    return float(post.etas[j])


def components(post: DiameterPosterior, df_all: pd.DataFrame, separator, D_km: float, D_lo: float | None = None,
               D_hi: float | None = None) -> pd.DataFrame:
    """Per-point reflected and thermal components at diameter D (eta from the chi2 valley), for every point of the
    spectrum (same columns as ThermalFitResult.points). The group and visit offsets of the fit scale both components
    of their points; the observed fluxes are not renormalised (reflected_flux = F - thermal)."""
    P = post._P
    nf = _nuisance(P, separator)
    eta = eta_at(post, D_km)
    _, sol, (K0, K1) = nf.fit(thermal_flux(P, D_km, eta))
    gam = np.zeros(P["n_g"])
    dlt = np.zeros(len(P["sig_v"]))
    if sol is not None and nf.n_un:
        gam[1:] = sol[:nf.cols_g]
        dlt[nf.vfree] = sol[nf.cols_g:]
    d = df_all.sort_values("wavelength_um").reset_index(drop=True)
    lam = d["wavelength_um"].to_numpy(float)
    gmap = {g: k for k, g in enumerate(P["groups"])}
    vmap = {v: k for k, v in enumerate(P["visits"])}
    gi = d["norm_group"].map(gmap) if "norm_group" in d else pd.Series(0, index=d.index)
    vi = d["visit"].map(vmap) if "visit" in d else pd.Series(np.nan, index=d.index)
    lnc = np.where(gi.notna(), gam[gi.fillna(0).astype(int)], 0.0) + \
        np.where(vi.notna(), dlt[vi.fillna(0).astype(int)], 0.0)
    c = np.exp(lnc)
    sub = _table_for(d, separator, P)          # NEATM table at every point of the spectrum
    th = c * thermal_flux(sub, D_km, eta)
    S = separator.reflected_scale(d)
    refl = c * S * (K0 + K1 * (lam - LAMBDA_C))
    th_err = np.zeros_like(th)
    if D_lo and D_hi:
        t_lo = c * thermal_flux(sub, D_lo, eta_at(post, D_lo))
        t_hi = c * thermal_flux(sub, D_hi, eta_at(post, D_hi))
        th_err = 0.5 * np.abs(t_hi - t_lo)
    F = d["flux_uJy"].to_numpy(float) * 1e-6
    E = d["flux_err_uJy"].to_numpy(float) * 1e-6
    out = d.copy()
    out["lightcurve_factor"] = 1.0
    out["model_reflected_uJy"] = refl * 1e6
    out["model_thermal_uJy"] = th * 1e6
    out["model_total_uJy"] = (refl + th) * 1e6
    out["thermal_err_uJy"] = th_err * 1e6
    out["residual_uJy"] = (F - refl - th) * 1e6
    out["residual_sigma"] = (F - refl - th) / E
    out["used_in_fit"] = separator._fit_mask(lam)
    out["reflected_flux_uJy"] = (F - th) * 1e6
    out["reflected_flux_err_uJy"] = np.hypot(E, th_err) * 1e6
    out["brightness_offset_ln"] = lnc
    return out


def _table_for(d: pd.DataFrame, separator, P: dict) -> dict:
    us = np.exp(P["lnu"])
    cfg = separator.cfg
    lam = d["wavelength_um"].to_numpy(float)
    tab = np.array([neatm_flux_jy(lam, 1.0, 1.0 / u ** 4, d["r_au"].to_numpy(float), d["delta_au"].to_numpy(float),
                                  d["phase_deg"].to_numpy(float), 0.0, cfg["emissivity"], cfg["integration_nodes"])
                    for u in us])
    return dict(H=P["H"], q=P["q"], lnu=P["lnu"], ltab=np.log(np.maximum(tab, 1e-300)))
