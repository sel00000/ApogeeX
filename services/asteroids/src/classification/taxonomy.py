"""Stage 4a: spectral type candidates, ranked by relative probability.

Method (default) - shape and slope compared separately, following DeMeo et al. (2009, Icarus 202,
160), who remove the spectral slope before PCA "thus making PCA more sensitive to other features"
and tabulate the slope as a separate parameter (for near-infrared-only data they normalise at
1.2 um). For each Bus-DeMeo class mean T (resampled to SPHEREx, R ~ 40):

    model_i = s_g(i) * T(lambda_i) * [1 + beta (lambda_i - lambda_norm)]

  * s_g: free brightness scale per normalisation group g (groups are visits whose relative
    brightness the repeated observations could not link - see preprocessing.temporal_analysis);
  * beta: free slope difference between asteroid and class mean. The shape term is therefore
    slope-independent: a red continuum alone cannot make a spectrum look like a featureless class;
  * slope term: beta^2 / (sigma_class_slope^2 + sigma_slope_sys^2). sigma_slope_sys is the
    systematic slope uncertainty from the observation-time normalisation (None = slope not
    constrained -> slope term off). For classes that have a high-slope "w" variant (S, Sq, Sr, Sv,
    V, Q; DeMeo et al. 2009) a redder slope (beta > 0) is not penalised: it is reported as "w".
  deviance_c = chi2_shape + slope term,  P_c = exp(-(dev_c - dev_min) / (2 s)) / sum,
  s = max(chi2_red of the most probable class, 1).

The observed spectrum is binned onto the 0.05-um reference grid (within each normalisation group)
and classes without a published intra-class sigma (Cg, O, R) get the median sigma of all classes.

Likelihood: with classification.likelihood = "gaussian" the deviance is the full Gaussian -2 ln L,
including ln det of the class covariance; the intra-class shape sigma is correlated over
classification.class_variance_correlation_um (member spectra differ from the mean smoothly).

Confidence reflects how well the data separate the best complex from the alternatives: High if the
runner-up complex is >= high_confidence_gap scaled deviance units worse, Medium if >= distinguished_gap,
otherwise Low. Both gaps are calibrated by injection-recovery of real asteroid spectra sampled like
SPHEREx observations (settings.yaml): a wrong complex is reported as distinguished in <= 5% (Medium) and
<= 1% (High) of the injections. Confidence is capped at Low when S-complex and D-type are not
distinguished, when the 1-um band region is not covered, or when a featureless class ranks first
although a 1-um band is detected. A subclass is named only if it is class_distinguished_gap ahead of
the next class of the same complex; otherwise the result is the complex.
P_c is conditional on the 25 Bus-DeMeo classes and this model - NOT the probability that the
asteroid contains a mineral. No target-specific information enters the classification.

Method 2 - PCA in SPHEREx sampling, built from the resampled reference spectra.
Method 3 - supervised ML via `train_classifier`, only with an independent labelled training set.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar

from ..common import status
from ..common.config import settings
from .reference_library import COMPLEXES, complex_of, load_busdemeo, resample_reference, sigma_decomposition

# Classes with a high-slope "w" variant (DeMeo et al. 2009, Sect. 4.3 and Sect. 6).
W_ELIGIBLE = {"S", "Sq", "Sr", "Sv", "V", "Q"}
# Fallbacks if the calibrated gaps are missing from the settings (the pre-calibration values)
DEFAULT_DISTINGUISHED_GAP, DEFAULT_HIGH_GAP, DEFAULT_CLASS_GAP = 4.0, 9.0, 4.0
# Classes without a 1-um absorption band at SPHEREx wavelengths (described as linear / featureless
# in the near-infrared by DeMeo et al. 2009).
FEATURELESS_NIR = {"B", "C", "Cb", "Cg", "Cgh", "Ch", "D", "T", "X", "Xc", "Xe", "Xn"}


@dataclass
class TaxonomyResult:
    status: str
    candidates: list = field(default_factory=list)       # top-N of `ranking`
    ranking: list = field(default_factory=list)          # all classes, most probable first
    complex_ranking: list = field(default_factory=list)  # [{rank, complex, probability}]
    probability_scale: float | None = None
    complex_scores: dict = field(default_factory=dict)
    best_class: str = status.UNKNOWN
    best_complex: str = status.UNKNOWN
    confidence: str = status.CONF_NONE
    confidence_reasons: list = field(default_factory=list)
    wavelength_range_um: tuple | None = None
    n_points: int = 0
    n_norm_groups: int = 1
    slope_used: bool = True
    slope_sys_per_um: float | None = None
    complex_separation: float | None = None          # deviance gap best vs runner-up complex (scaled)
    subclass_separation: float | None = None         # deviance gap best vs next class of the same complex
    s_vs_d: dict = field(default_factory=dict)
    pca: dict | None = None
    lightcurve_sensitivity: dict | None = None          # see integration.spectrum_analysis
    visit_jackknife: dict | None = None                 # see integration.spectrum_analysis
    saturation_sensitivity: dict | None = None          # see integration.spectrum_analysis
    saturation_limit: dict | None = None                # see integration.spectrum_analysis
    confidence_classifier: str | None = None            # confidence before the analysis-level downgrades
    limitations: list = field(default_factory=list)
    method: str = "shape+slope (DeMeo et al. 2009 slope treatment)"
    complex_score: dict = field(default_factory=dict)   # complex -> -2 ln sum exp(-w/2) (scaled, incl. prior)
    complex_ranking_spectral: list = field(default_factory=list)   # spectral term only (no prior)
    complex_ranking_no_albedo: list = field(default_factory=list)  # prior without the albedo term
    prior: dict | None = None                           # TargetPrior.summary() when a prior was used


def _class_slope_sigma(rr, rs, x):
    """Intra-class slope spread (relative, per um), estimated from the published class sigma at long
    lever arms and bounded to [slope_sigma_min, slope_sigma_max] (config). The bounds bracket the
    half-widths of the slope ranges that separate featureless classes in DeMeo et al. (2009):
    T 0.25-0.38 and X 0.2-0.38 per um, i.e. half-widths of 0.065-0.09."""
    cfg = settings()["classification"]
    lo, hi = cfg.get("slope_sigma_min", 0.03), cfg.get("slope_sigma_max", 0.10)
    m = np.isfinite(rr) & np.isfinite(rs) & (np.abs(x) > 0.3) & (rr > 0)
    if m.sum() < 2:
        return float(hi)
    return float(np.clip(np.median(rs[m] / rr[m] / np.abs(x[m])), lo, hi))


def _class_correlation(x, length_um):
    """Correlation of the intra-class deviations between wavelengths: None = independent per point;
    otherwise squared-exponential with the given length (member spectra differ from the class mean
    smoothly, e.g. by band depth, not point by point)."""
    if not length_um:
        return None
    d = x[:, None] - x[None, :]
    return np.exp(-0.5 * (d / float(length_um)) ** 2)


def _fit_class(R, E, g, rr, rs, x, slope_sigma, w_eligible, likelihood, slope_mode, Cobs=None,
               corr_length_um=None):
    """Profile over beta (closed-form group scales); returns chi2_shape, penalty, beta, deviance, scale,
    variance term. With Cobs (full observational covariance of the binned spectrum) the fit is
    generalised least squares; otherwise errors E are treated as independent.

    The class tolerance (intra-class shape sigma) enters the covariance, so the classes compared have
    different covariances. With likelihood="gaussian" the deviance is the full Gaussian -2 ln L:
    chi2 + ln det(C_obs + C_class) - ln det(C_obs) (the last term is common to all classes and only keeps
    the numbers small). Without the log-determinant a wider class always has the smaller chi2 for the
    same residuals, so wide classes (B, Xn, Sa, Xe, Cgh) win whenever no class fits well."""
    groups = np.unique(g)
    K = _class_correlation(x, corr_length_um)
    if K is not None and Cobs is None:
        Cobs = np.diag(np.asarray(E, float) ** 2)
    if Cobs is not None:
        from .covariance import gls
        gidx = {k: i for i, k in enumerate(groups)}
        logdet_obs = float(np.linalg.slogdet(Cobs + 1e-12 * np.eye(len(Cobs)) * np.mean(np.diag(Cobs)))[1])

        def evaluate_cov(beta):
            M = rr * (1 + beta * x)
            Ms = rs * np.abs(1 + beta * x)
            sc = np.ones(len(R))
            for _ in range(3):
                X = np.zeros((len(R), len(groups)))
                for i in range(len(R)):
                    X[i, gidx[g[i]]] = M[i]
                D = sc * Ms
                C = Cobs + (np.diag(D ** 2) if K is None else np.outer(D, D) * K)
                coef, _, chi2 = gls(X, R, C)
                sc = np.array([coef[gidx[k]] for k in g])
            vt = 0.0
            if likelihood == "gaussian":
                vt = float(np.linalg.slogdet(C + 1e-12 * np.eye(len(C)) * np.mean(np.diag(C)))[1]) - logdet_obs
            if slope_sigma is None or (w_eligible and beta > 0):
                pen = 0.0
            else:
                pen = float(beta ** 2 / slope_sigma ** 2)
            return chi2, pen, float(np.median(sc)), vt

        if slope_mode == "absolute":
            c2, _, sc, vt = evaluate_cov(0.0)
            return c2, 0.0, 0.0, c2 + vt, sc, vt
        opt = minimize_scalar(lambda b: (lambda r: r[0] + r[1] + r[3])(evaluate_cov(b)), bounds=(-0.75, 2.0),
                              method="bounded", options={"xatol": 1e-4})
        c2, pen, sc, vt = evaluate_cov(opt.x)
        return c2, pen, float(opt.x), c2 + pen + vt, sc, vt

    def evaluate(beta):
        M = rr * (1 + beta * x)
        Ms = rs * np.abs(1 + beta * x)
        sg = np.ones(len(R))
        for _ in range(3):
            var = E ** 2 + (sg * Ms) ** 2
            w = 1 / var
            for k in groups:
                m = g == k
                den = np.sum(w[m] * M[m] ** 2)
                sg[m] = np.sum(w[m] * R[m] * M[m]) / den if den > 0 else 1.0
        var = E ** 2 + (sg * Ms) ** 2
        chi2 = float(np.sum((R - sg * M) ** 2 / var))
        vt = float(np.sum(np.log(var / E ** 2))) if likelihood == "gaussian" else 0.0
        if slope_sigma is None or (w_eligible and beta > 0):
            pen = 0.0
        else:
            pen = float(beta ** 2 / slope_sigma ** 2)
        return chi2, pen, float(np.median(sg)), vt

    if slope_mode == "absolute":            # legacy: template scale only, slope compared implicitly
        c2, _, sc, vt = evaluate(0.0)
        return c2, 0.0, 0.0, c2 + vt, sc, vt
    opt = minimize_scalar(lambda b: (lambda r: r[0] + r[1] + r[3])(evaluate(b)), bounds=(-0.75, 2.0),
                          method="bounded", options={"xatol": 1e-4})
    c2, pen, sc, vt = evaluate(opt.x)
    return c2, pen, float(opt.x), c2 + pen + vt, sc, vt


def _softmax(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, float)
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _complex_scores(tab: pd.DataFrame, col: str) -> dict:
    """-2 ln sum_k exp(-w_k / 2) over the classes of each complex."""
    out = {}
    for c, g in tab.groupby("complex"):
        x = -0.5 * g[col].to_numpy(float)
        mx = x.max()
        out[c] = float(-2.0 * (mx + np.log(np.exp(x - mx).sum())))
    return out


def _ranking_from_scores(scores: dict) -> list:
    s = pd.Series(scores).sort_values()
    p = _softmax(-0.5 * s.values)
    return [{"rank": i + 1, "complex": k, "probability": float(v)} for i, (k, v) in enumerate(zip(s.index, p))]


def _prior_terms(tab: pd.DataFrame, prior) -> tuple[np.ndarray, np.ndarray]:
    """Per-class prior terms (scaled deviance units): with and without the albedo likelihood."""
    if prior is None:
        z = np.zeros(len(tab))
        return z, z
    n_c = tab.groupby("complex")["class"].transform("count").to_numpy(float)
    t = 2.0 * np.log(n_c)
    if prior.complex_log_prior:
        lp = prior.complex_log_prior
        floor = min(lp.values()) if lp else 0.0
        t = t - 2.0 * tab["complex"].map(lambda c: lp.get(c, floor)).to_numpy(float)
    ta = t.copy()
    if prior.albedo_loglike:
        al = prior.albedo_loglike
        floor = min(al.values())
        ta = ta - 2.0 * tab["complex"].map(lambda c: al.get(c, floor)).to_numpy(float)
    return ta, t


def classify(refl: pd.DataFrame, value_col="reflectance", err_col="reflectance_err",
             likelihood: str | None = None, bin_to_reference_grid: bool | None = None,
             group_col: str = "norm_group", slope_sys_per_um: float | None = 0.0,
             band_evidence: dict | None = None, slope_mode: str = "separate",
             prior=None) -> TaxonomyResult:
    """refl: reflectance table (wavelength_um, value, error, optional norm_group).
    slope_sys_per_um: systematic slope uncertainty from the observation-time normalisation;
    None means the slope is not constrained (slope term off).
    band_evidence: {"band_I_detected": bool, ...} from the band analysis (consistency check only).
    slope_mode: "separate" (default) or "absolute" (legacy comparison without the slope parameter).
    prior: classification.priors.TargetPrior (population, orbit and albedo terms) or None (flat over classes)."""
    cfg = settings()["classification"]
    likelihood = likelihood or cfg.get("likelihood", "chi2")
    bin_to_reference_grid = cfg.get("bin_to_reference_grid", False) if bin_to_reference_grid is None \
        else bin_to_reference_grid
    lam_norm = settings()["reflectance"]["normalization_wavelength_um"]
    lib = load_busdemeo()
    lim_lo = max(0.75, min(r.wavelength_um.min() for r in lib.values()))
    lim_hi = min(r.wavelength_um.max() for r in lib.values())
    d = refl.copy()
    if group_col not in d:
        d[group_col] = 0
    d = d[(d["wavelength_um"] >= lim_lo) & (d["wavelength_um"] <= lim_hi) & np.isfinite(d[value_col])
          & np.isfinite(d[err_col]) & (d[err_col] > 0)]
    limitations = [
        "No visible-wavelength data (<0.75 um): classes separated mainly by visible slope cannot be distinguished.",
        f"Reference class means end at {lim_hi:.2f} um; features beyond are analysed separately (band analysis).",
        f"Spectra normalised at {lam_norm} um (DeMeo et al. 2009 near-infrared convention) instead of 0.55 um.",
        "Probabilities are relative among the Bus-DeMeo reference classes for this model; they are not "
        "probabilities that specific minerals are present.",
    ]
    if len(d) < cfg["min_overlap_points"]:
        return TaxonomyResult(status=status.INSUFFICIENT_DATA, n_points=int(len(d)),
                              limitations=limitations + [f"Only {int(len(d))} usable points in "
                                                         f"{lim_lo:.2f}-{lim_hi:.2f} um (need {cfg['min_overlap_points']})."])
    lam, R, E, G = [], [], [], []
    Cobs = None
    from .covariance import bin_with_covariance, has_visit_structure, point_covariance
    if bin_to_reference_grid and has_visit_structure(d):
        grid = next(iter(lib.values())).wavelength_um
        step = float(np.median(np.diff(grid)))
        edges = np.concatenate([grid - step / 2, [grid[-1] + step / 2]])
        Rp, pp, vp, visp = point_covariance(d, value_col, err_col)
        lam_b, R_b, Cobs, G_b = bin_with_covariance(d["wavelength_um"].values, Rp, pp, vp, visp,
                                                    d[group_col].values, edges)
        lam, R, G = list(lam_b), list(R_b), list(G_b)
        E = list(np.sqrt(np.diag(Cobs)))
        limitations.append("Errors: photometric noise plus visit-correlated normalisation error (full covariance).")
    elif bin_to_reference_grid:
        from ..preprocessing.spectrum_cleaning import bin_spectrum
        grid = next(iter(lib.values())).wavelength_um
        step = float(np.median(np.diff(grid)))
        edges = np.concatenate([grid - step / 2, [grid[-1] + step / 2]])
        for gk, gg in d.groupby(group_col):
            c, v, e, _ = bin_spectrum(gg["wavelength_um"].values, gg[value_col].values, gg[err_col].values, edges)
            lam += list(c); R += list(v); E += list(e); G += [gk] * len(c)
    else:
        lam, R, E, G = (list(d[c].values) for c in ("wavelength_um", value_col, err_col, group_col))
    order = np.argsort(lam)
    lam, R, E, G = (np.asarray(a)[order] for a in (lam, R, E, G))
    if Cobs is not None:
        Cobs = Cobs[np.ix_(order, order)]
    n_groups = int(len(np.unique(G)))
    x = lam - lam_norm
    slope_used = slope_sys_per_um is not None and slope_mode == "separate"
    if not slope_used and slope_mode == "separate":
        limitations.append("Spectral slope not used for classification: the relative brightness of the spectral "
                           "segments is not constrained by the observations.")
    if n_groups > 1:
        limitations.append(f"{n_groups} normalisation groups fitted with independent brightness scales: only the "
                           "spectral shape within each group is used.")

    resampled = {name: resample_reference(ref, lam, cfg["spherex_resolving_power"], lam_norm)
                 for name, ref in lib.items()}
    # Intra-class variance: slope-like part -> slope prior; residual -> shape tolerance (see
    # reference_library.sigma_decomposition). Slope and scale are free parameters here, so using the
    # full published sigma as shape tolerance would count slope variation twice.
    decomp = {name: sigma_decomposition(ref) for name, ref in lib.items()}
    norms = {name: float(np.interp(lam_norm, ref.wavelength_um, ref.reflectance)) for name, ref in lib.items()}
    shape_rel = [decomp[n][0] / norms[n] for n in lib if decomp[n][0] is not None]
    shape_floor = float(np.median(shape_rel)) if shape_rel else 0.02
    sl_cfg = cfg.get("slope_sigma_min", 0.03), cfg.get("slope_sigma_max", 0.10)
    no_sigma, rows = [], []
    for name, (rr, rs, inside) in resampled.items():
        shp, slp = decomp[name]
        if shp is None:
            no_sigma.append(name)
            rs = np.full_like(rr, shape_floor) * rr
            sl_class = float(sl_cfg[1])
        else:
            rs = np.full_like(rr, shp / norms[name]) * rr / np.where(rr > 0, rr, 1.0)
            mean_ref = float(np.nanmean(lib[name].reflectance[(lib[name].wavelength_um >= 0.75)]))
            sl_class = float(np.clip(slp / mean_ref, *sl_cfg))
        sl_sigma = np.hypot(sl_class, slope_sys_per_um) if slope_used else None
        c2, pen, beta, dev, sc, vt = _fit_class(R, E, G, rr, rs, x, sl_sigma, name in W_ELIGIBLE, likelihood,
                                                slope_mode, Cobs=Cobs,
                                                corr_length_um=cfg.get("class_variance_correlation_um"))
        n = len(R)
        rows.append({"class": name, "complex": complex_of(name), "chi2": c2, "slope_penalty": pen,
                     "variance_term": vt, "deviance": dev,
                     "chi2_red": c2 / max(n - n_groups - 1, 1), "beta_slope": beta, "scale": sc,
                     "class_slope_sigma": sl_class, "n": n, "sigma_assumed": name in no_sigma})
    if no_sigma:
        limitations.append(f"Classes without published intra-class sigma ({', '.join(sorted(no_sigma))}) use the "
                           "median shape sigma of all classes and the upper slope tolerance.")
    tab = pd.DataFrame(rows).dropna(subset=["deviance"])
    scale = float(max(tab.loc[tab["deviance"].idxmin(), "chi2_red"], 1.0))
    # Class scores (scaled deviance units): spectral term plus the prior terms of classification.priors
    # (zero without a TargetPrior: flat prior over the 25 classes, the behaviour before 2026-11-15).
    tab["spectral_score"] = tab["deviance"] / scale
    pt_all, pt_no_alb = _prior_terms(tab, prior)
    tab["prior_term"] = pt_all
    tab["score_total"] = tab["spectral_score"] + tab["prior_term"]
    tab["probability"] = _softmax(-0.5 * tab["score_total"].values)
    tab["probability_spectral"] = _softmax(-0.5 * tab["spectral_score"].values)
    cscore = _complex_scores(tab, "score_total")
    cscore_spec = _complex_scores(tab, "spectral_score")
    cscore_noalb = _complex_scores(tab.assign(_s=tab["spectral_score"] + pt_no_alb), "_s")
    tab = tab.sort_values(["probability", "deviance"], ascending=[False, True]).reset_index(drop=True)
    tab.insert(0, "rank", np.arange(1, len(tab) + 1))
    tab["score"] = tab["probability"]            # backward-compatible alias
    cx = tab.groupby("complex")["probability"].sum().sort_values(ascending=False)
    # The most probable complex decides; the class is the best class of that complex (with a prior the single
    # best class can lie in another complex - before 2026-11-15 the record then named one complex and the
    # complex ranking another, e.g. 10 Hygiea "X-complex" with C-complex first at 60%).
    best_cx = min(cscore, key=cscore.get)
    best = tab[tab["complex"] == best_cx].sort_values("score_total").iloc[0]
    best_label = best["class"]
    dist_gap = float(cfg.get("distinguished_gap", DEFAULT_DISTINGUISHED_GAP))
    high_gap = float(cfg.get("high_confidence_gap", DEFAULT_HIGH_GAP))
    class_gap = float(cfg.get("class_distinguished_gap", DEFAULT_CLASS_GAP))
    # Subclass: the first class must be distinguished (class_distinguished_gap) from the next class of the
    # same complex; otherwise the result is the complex, with the leading subclasses listed
    # (Sa 60% / S 32% with a gap of 1.3 is "S-complex"). The prior terms are equal within a complex.
    same = tab[(tab["complex"] == best["complex"]) & (tab["class"] != best["class"])]
    subclass_gap = float(same["score_total"].min() - best["score_total"]) if len(same) else float("inf")
    if subclass_gap < class_gap:
        runner = same.sort_values("deviance").iloc[0]
        best_label = (f"{best['complex']} (subclass not determined: {best['class']} {best['probability']:.0%}, "
                      f"{runner['class']} {runner['probability']:.0%})")
    else:
        for grp in cfg["visible_dependent_groups"]:
            if best["class"] in grp:
                gscore = tab[tab["class"].isin(grp)]["probability"].sum()
                best_label = f"{best['class']} (ambiguous within {'/'.join(grp)}; group probability {gscore:.0%})"
    if best["class"] in W_ELIGIBLE and slope_used:
        sig_b = np.hypot(best["class_slope_sigma"], slope_sys_per_um)
        if best["beta_slope"] > 2 * sig_b:
            best_label += " - high slope ('w', DeMeo et al. 2009)"

    # confidence from the separation between complexes (complex scores, the same quantity as the ranking)
    cdev = pd.Series(cscore).sort_values()
    sep = float(cdev.iloc[1] - cdev.iloc[0]) if len(cdev) > 1 else np.inf
    reasons = []
    conf = status.CONF_HIGH if sep >= high_gap else status.CONF_MEDIUM if sep >= dist_gap else status.CONF_LOW
    reasons.append(f"best complex {cdev.index[0]} vs runner-up {cdev.index[1] if len(cdev) > 1 else '-'}: "
                   f"delta score {sep:.1f} (scaled deviance" + (" incl. prior)" if prior is not None else ")"))
    s_vs_d = {}
    if "D-type" in cdev and "S-complex" in cdev:
        dsd = float(cdev["D-type"] - cdev["S-complex"])
        s_vs_d = {"delta_deviance_D_minus_S": dsd, "distinguished": bool(abs(dsd) >= dist_gap),
                  "favoured": "S-complex" if dsd > 0 else "D-type"}
        if abs(dsd) < dist_gap and cdev.index[0] in ("S-complex", "D-type"):
            conf = status.CONF_LOW
            reasons.append(f"insufficient to distinguish S-complex from D-type (delta {dsd:+.1f} < {dist_gap:g})")
    band_region = (lam < 1.10).sum()
    if band_region < 3:
        # Without the 1-um region neither a band nor its absence can be established: beyond 1.1 um an
        # S-type is nearly as featureless as C/X (433 Eros without it: C-complex 87%). Low for any class.
        reasons.append("1-um band region (<1.1 um) not covered")
        conf = status.CONF_LOW
    if band_evidence and band_evidence.get("band_I_detected") and best["class"] in FEATURELESS_NIR:
        conf = status.CONF_LOW
        reasons.append(f"featureless class {best['class']} ranked first although a 1-um band is detected")
    if not slope_used and best["class"] in FEATURELESS_NIR:
        conf = status.CONF_LOW
        reasons.append("featureless classes are separated mainly by slope, which is not constrained here")
    if scale > 1.5:
        limitations.append(f"Best-fit chi2_red = {scale:.1f}: probabilities were computed with errors inflated "
                           f"by sqrt({scale:.1f}) to account for unexplained scatter.")
    ranking = tab.drop(columns=[c for c in ("_s",) if c in tab]).to_dict("records")
    complex_ranking = [{"rank": i + 1, "complex": k, "probability": float(v)} for i, (k, v) in enumerate(cx.items())]
    if prior is not None:
        limitations.append("Class probabilities include a prior: tempered population frequency of the complexes"
                           + (" and their frequency at this orbit" if (prior.info or {}).get("orbit_used") else "")
                           + (f", and the albedo likelihood (pV {prior.albedo['pV']:.3f}, {prior.albedo['source']})"
                              if prior.albedo else "") + ". The spectral-only ranking is kept separately.")
    res = TaxonomyResult(
        status="CANDIDATE", candidates=ranking[: cfg["top_n_candidates"]], ranking=ranking,
        complex_ranking=complex_ranking, probability_scale=scale,
        complex_scores={k: float(v) for k, v in cx.items()}, best_class=best_label,
        best_complex=str(best["complex"]), confidence=conf, confidence_reasons=reasons,
        wavelength_range_um=(float(lam.min()), float(lam.max())), n_points=int(len(lam)), n_norm_groups=n_groups,
        slope_used=slope_used, slope_sys_per_um=slope_sys_per_um, complex_separation=sep,
        subclass_separation=subclass_gap if np.isfinite(subclass_gap) else None, s_vs_d=s_vs_d,
        limitations=limitations, complex_score={k: float(v) for k, v in cscore.items()},
        complex_ranking_spectral=_ranking_from_scores(cscore_spec),
        complex_ranking_no_albedo=_ranking_from_scores(cscore_noalb),
        prior=prior.summary() if prior is not None else None)
    try:
        res.pca = pca_projection(lam, R, lib, lam_norm)
    except Exception as err:  # noqa: BLE001
        res.pca = {"status": f"PCA unavailable: {err}"}
    return res


def pca_projection(lam, R, lib, lam_norm, n_components=3):
    from sklearn.decomposition import PCA
    R_cfg = settings()["classification"]["spherex_resolving_power"]
    names, X = [], []
    for name, ref in lib.items():
        rr, _, inside = resample_reference(ref, lam, R_cfg, lam_norm)
        if np.isfinite(rr).all():
            names.append(name)
            X.append(rr)
    X = np.array(X)
    pca = PCA(n_components=min(n_components, len(X) - 1)).fit(X)
    ref_scores = pca.transform(X)
    obs = pca.transform(np.asarray(R)[None, :])[0]
    d = np.linalg.norm(ref_scores - obs, axis=1)
    order = np.argsort(d)
    return {"status": "OK", "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "observed_scores": obs.tolist(),
            "reference_scores": {n: s.tolist() for n, s in zip(names, ref_scores)},
            "nearest_classes": [(names[i], float(d[i])) for i in order[:5]],
            "note": "PCA basis built from Bus-DeMeo class means resampled to the observed SPHEREx wavelengths."}


def train_classifier(features: np.ndarray, labels: np.ndarray, groups: np.ndarray,
                     model: str = "random_forest", test_size: float = 0.25, seed: int = 0) -> dict:
    """Train a supervised classifier on an independent labelled set (e.g. resampled
    laboratory/telescopic spectra). `groups` identifies the object of each spectrum so the
    same object never appears in both training and validation sets."""
    from sklearn.metrics import classification_report
    from sklearn.model_selection import GroupShuffleSplit

    if len(np.unique(labels)) < 2 or len(labels) < 20:
        raise ValueError("Training data insufficient: need >= 20 labelled spectra and >= 2 classes.")
    split = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    tr, te = next(split.split(features, labels, groups))
    leak = set(groups[tr]) & set(groups[te])
    if leak:
        raise RuntimeError(f"Data leakage: objects in both splits: {sorted(leak)[:5]}")
    counts = pd.Series(labels[tr]).value_counts()
    if model == "random_forest":
        from sklearn.ensemble import RandomForestClassifier
        clf = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=seed)
    elif model == "svm":
        from sklearn.svm import SVC
        clf = SVC(probability=True, class_weight="balanced", random_state=seed)
    elif model == "xgboost":
        from xgboost import XGBClassifier  # optional dependency
        clf = XGBClassifier(n_estimators=300, random_state=seed)
    else:
        raise ValueError(model)
    clf.fit(features[tr], labels[tr])
    report = classification_report(labels[te], clf.predict(features[te]), output_dict=True, zero_division=0)
    return {"model": clf, "validation_report": report, "train_class_counts": counts.to_dict(),
            "imbalance_ratio": float(counts.max() / counts.min()), "n_train": len(tr), "n_validation": len(te)}
