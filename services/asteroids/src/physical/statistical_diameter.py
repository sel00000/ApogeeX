"""Statistical diameter for objects without a thermal diameter, and a consistency check of thermal diameters.

    D = 1329 km / sqrt(pV) * 10^(-H/5)

with pV drawn from the population prior (src/physical/population_priors.py):
  * the complex c is drawn from the classifier's complex probabilities WITHOUT the albedo term (an albedo
    measured elsewhere would otherwise feed back into the diameter that it was derived from);
  * log10 pV | c, orbit, H ~ N(mu_c, sigma_c): inverse-variance combination of the complex albedo
    distribution and the orbit regression, with the cross-validated error of that combination;
  * if the SPHEREx thermal test found no significant excess, each draw is weighted by the likelihood of the
    measured excess statistic X = sum_i w_i (F_i - F_ref,i) under NEATM with that D, pV and an eta drawn from
    the eta(alpha) prior: a large, dark body that would have produced a detectable excess is down-weighted.
    The same likelihood alone (flat prior in log D for 0.01 <= pV <= 1) gives a 95% upper limit on D.

The result is an ESTIMATE from population statistics, not a measurement: it is stored apart from the thermal
diameter, never used to compute an albedo, and its confidence is at most Medium.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..common import status
from ..common.config import settings
from .phase_function import PhaseLaw
from .thermal_model import neatm_flux_jy


@dataclass
class StatisticalDiameterResult:
    status: str                                    # ESTIMATED | Not estimable from available data
    diameter_km: float | None = None               # median of the distribution
    interval_68_km: tuple | None = None            # 16th-84th percentile
    interval_95_km: tuple | None = None            # 2.5th-97.5th percentile
    pV_median: float | None = None                 # prior-based albedo of the same draws (not a measurement)
    pV_interval_68: tuple | None = None
    thermal_upper_limit_km: float | None = None    # 95% upper limit from the SPHEREx thermal test alone
    thermal_weighting: bool = False
    effective_samples: float | None = None
    complex_weights: dict = field(default_factory=dict)
    H_used: float | None = None
    method: str = ("D = 1329 km / sqrt(pV) 10^(-H/5); pV from the population prior (complex probabilities "
                   "without albedo, orbit regression)")
    confidence: str = status.CONF_NONE
    consistency: dict | None = None                # thermal diameter vs this estimate (when both exist)
    warnings: list = field(default_factory=list)
    inputs: dict = field(default_factory=dict)

    def summary(self) -> dict:
        return dict(self.__dict__)


def _asym_normal(rng, n, mu, s_lo, s_hi):
    z = rng.normal(size=n)
    return mu + np.where(z < 0, z * s_lo, z * s_hi)


def thermal_likelihood(test: dict, H: float, G: float, eta_prior: dict, cfg: dict | None = None,
                       n_D: int = 90, n_eta: int = 13, *, phase: PhaseLaw | None = None):
    """Marginal likelihood of the measured excess statistic on a grid of log10 D (eta marginalised over its
    prior). Returns (log10_D grid, likelihood (max 1), 95% upper limit on D with a flat prior in log D over
    0.01 <= pV <= 1)."""
    cfg = cfg or settings()["thermal_model"]
    lam = np.asarray(test["wavelength_um"], float)
    w = np.asarray(test["weights"], float)
    X, sX = float(test["excess_stat"]), float(test["excess_stat_sigma"])
    D_lo = 1329.0 / np.sqrt(1.0) * 10 ** (-H / 5)
    D_hi = 1329.0 / np.sqrt(0.01) * 10 ** (-H / 5)
    lgD = np.linspace(np.log10(D_lo) - 0.15, np.log10(D_hi) + 0.15, n_D)
    lo, hi = cfg["eta_bounds"]
    etas = np.linspace(lo, hi, n_eta)
    e0, sm, sp = eta_prior["eta0"], eta_prior["sigma_minus"], eta_prior["sigma_plus"]
    pe = np.exp(-0.5 * ((etas - e0) / np.where(etas < e0, sm, sp)) ** 2)
    pe /= pe.sum()
    q = (phase or PhaseLaw(G=G)).phase_integral()
    L = np.zeros(n_D)
    for j, lg in enumerate(lgD):
        D = 10 ** lg
        pV = (1329.0 * 10 ** (-H / 5) / D) ** 2
        A = min(q * pV, 0.99)
        like = 0.0
        for eta, p in zip(etas, pe):
            th = neatm_flux_jy(lam, D, eta, test["r_au"], test["delta_au"], test["phase_deg"], A,
                               cfg["emissivity"], nodes=24)
            Xp = float(np.dot(w, th))
            like += p * np.exp(-0.5 * ((X - Xp) / sX) ** 2)
        L[j] = like
    L = L / L.max() if L.max() > 0 else L
    m = (lgD >= np.log10(D_lo)) & (lgD <= np.log10(D_hi))
    c = np.cumsum(L[m])
    ul = float(10 ** np.interp(0.95 * c[-1], c, lgD[m])) if c[-1] > 0 else None
    return lgD, L, ul


def estimate_statistical_diameter(H: float | None, prior, complex_probabilities: list | None, *,
                                  H_err: float | None = None, thermal_test: dict | None = None,
                                  G: float = 0.15, eta_prior: dict | None = None,
                                  n_samples: int | None = None, seed: int = 0, phase: PhaseLaw | None = None) -> StatisticalDiameterResult:
    """H: V-band absolute magnitude (the population model is trained with SBDB H, so the H-system scatter is
    already in its residuals; H_err is added only for an H from another source).
    prior: classification.priors.TargetPrior with its population model and orbit.
    complex_probabilities: [{"complex", "probability"}] without the albedo term (None -> orbit regression only).
    thermal_test: ThermalFitResult.thermal_test of a non-detection (None -> no thermal weighting)."""
    cfg = settings().get("statistical_diameter", {})
    n = int(n_samples or cfg.get("monte_carlo_samples", 20000))
    res = StatisticalDiameterResult(status=status.ALBEDO_NOT_ESTIMABLE, H_used=H)
    model = getattr(prior, "model", None)
    orbit = getattr(prior, "orbit", None) or {}
    if H is None or not np.isfinite(H):
        res.warnings.append("H unavailable: no statistical diameter.")
        return res
    if model is None or not orbit:
        res.warnings.append("Population prior or orbit unavailable: no statistical diameter.")
        return res
    a, e, i = orbit["a_au"], orbit["e"], orbit["i_deg"]
    rng = np.random.default_rng(seed)
    if complex_probabilities:
        cx = [c["complex"] for c in complex_probabilities]
        p = np.array([c["probability"] for c in complex_probabilities], float)
        p = p / p.sum()
        draw = rng.choice(len(cx), size=n, p=p)
        mus, sigs = zip(*(model.albedo_given_complex(a, e, i, H, c) for c in cx))
        mus, sigs = np.array(mus), np.array(sigs)
        lpv = mus[draw] + sigs[draw] * rng.normal(size=n)
        res.complex_weights = {c: float(v) for c, v in zip(cx, p) if v >= 0.005}
        res.method += "; complex drawn from the SPHEREx classification"
    else:
        mu, sig = model.orbit_albedo(a, e, i, H)
        lpv = mu + sig * rng.normal(size=n)
        draw = None
        res.method += "; no classification: orbit regression only"
    Hs = H + (H_err or 0.0) * rng.normal(size=n)
    D = 1329.0 / np.sqrt(10 ** lpv) * 10 ** (-Hs / 5)
    wts = np.ones(n)
    if thermal_test is not None and eta_prior is not None and cfg.get("thermal_likelihood", True):
        lgD, L, ul = thermal_likelihood(thermal_test, H, G, eta_prior, phase=phase)
        wts = np.interp(np.log10(D), lgD, L, left=L[0], right=L[-1])
        res.thermal_upper_limit_km = ul
        res.thermal_weighting = True
        res.method += "; weighted by the SPHEREx thermal non-detection (NEATM, eta prior)"
    if wts.sum() <= 0:
        res.warnings.append("Thermal likelihood excludes every draw: prior and thermal data disagree.")
        return res
    ess = float(wts.sum() ** 2 / np.sum(wts ** 2))
    res.effective_samples = ess
    if ess < 200:
        res.warnings.append(f"Only {ess:.0f} effective samples after thermal weighting.")

    def q(x, qs):
        o = np.argsort(x)
        cw = np.cumsum(wts[o]) / wts.sum()
        return [float(np.interp(v, cw, x[o])) for v in qs]

    d50, d16, d84, d2, d97 = q(D, [0.5, 0.16, 0.84, 0.025, 0.975])
    p50, p16, p84 = q(10 ** lpv, [0.5, 0.16, 0.84])
    res.status = "ESTIMATED"
    res.diameter_km, res.interval_68_km, res.interval_95_km = d50, (d16, d84), (d2, d97)
    res.pV_median, res.pV_interval_68 = p50, (p16, p84)
    if draw is not None and res.thermal_weighting:
        post = {c: float(wts[draw == k].sum() / wts.sum()) for k, c in enumerate(cx)}
        res.inputs["complex_weights_after_thermal"] = {c: v for c, v in post.items() if v >= 0.005}
    ratio = d84 / d16
    res.confidence = status.CONF_MEDIUM if ratio <= float(cfg.get("medium_max_ratio_84_16", 1.35)) else status.CONF_LOW
    res.inputs.update({"H": H, "H_err": H_err, "orbit": orbit, "n_samples": n,
                       "population_model": {k: v for k, v in (model.info or {}).items() if k != "catalogue"}})
    return res


def consistency_with_thermal(stat: StatisticalDiameterResult, D_km: float | None, D_err_km: float | None,
                             threshold_sigma: float | None = None) -> dict | None:
    """z = (log D_thermal - log D_statistical) / sqrt(sigma_th^2 + sigma_stat^2) in log10 space (sigma_stat
    from the 68% interval). |z| >= threshold flags a thermal diameter that the H + albedo prior does not
    support - on the Wien side (3.5-5 um) D and eta are degenerate, and a wrong eta moves D."""
    if stat is None or stat.diameter_km is None or not D_km or not D_err_km:
        return None
    thr = float(threshold_sigma or settings().get("statistical_diameter", {}).get("consistency_sigma", 2.0))
    s_stat = 0.5 * (np.log10(stat.interval_68_km[1]) - np.log10(stat.interval_68_km[0]))
    s_th = D_err_km / D_km / np.log(10)
    z = float((np.log10(D_km) - np.log10(stat.diameter_km)) / np.hypot(s_th, s_stat))
    return {"thermal_km": float(D_km), "thermal_err_km": float(D_err_km), "statistical_km": stat.diameter_km,
            "ratio": float(D_km / stat.diameter_km), "z": z, "threshold": thr, "consistent": bool(abs(z) < thr)}
