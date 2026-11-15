"""Physical priors learned from the asteroid population (catalogue tables from
src/acquisition/population_catalogue.py):

  1. Albedo from orbit and size: a gradient-boosted regression (scikit-learn HistGradientBoosting, the
     LightGBM algorithm) of log10 pV on (a, e, sin i, H). Families share albedos, the inner belt is brighter
     than the outer belt, and small catalogued objects are brighter than large ones; the regression learns
     these population trends. Model choice (5-fold CV, about 139 000 catalogue diameters; error in log10 D):
     constant pV 0.171, ridge 0.152, MLP 0.110, random forest 0.107, gradient boosting 0.106 dex
     (docs/METHODS.md section 5b). The catalogue albedo is never an input: an object whose diameter is
     unknown has no albedo either.
  2. Albedo of a taxonomic complex: the distribution of log10 pV of SMASSII-classified asteroids, by complex.
     On SMASSII-classified objects the complex alone predicts D better than the orbit (0.113 vs 0.151 dex),
     and the two combined by inverse-variance weighting give 0.108 dex.
  3. Complex frequency along the orbit: a random forest P(complex | a, e, sin i, H) trained on SMASSII
     classes, at least 15 objects per leaf (5-fold CV comparison in outputs/validation/population_priors.md:
     random forests beat the base rates, logistic regression, SVM, gradient boosting, a single tree and kNN).

The target variable is log10 pV_eff = 2 log10(1329 10^(-H/5) / D) with the current H, so that
D = 1329 / sqrt(pV) 10^(-H/5) with the current H reproduces the catalogue diameter.
The models are priors, not measurements: they are used by the classifier (albedo and orbit terms) and for
the statistical diameter of objects without a thermal diameter, and they are always labelled as such.
"""
from __future__ import annotations

import hashlib
import json
import pickle
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common.config import settings

FEATURES = ["a", "e", "sin_i", "H"]
H_BINS = [(-10.0, 10.0), (10.0, 12.0), (12.0, 14.0), (14.0, 16.0), (16.0, 40.0)]
MIN_KDE_POINTS = 8


def _features(a, e, i_deg, H) -> np.ndarray:
    return np.array([[float(a), float(e), float(np.sin(np.radians(i_deg))), float(H)]])


@dataclass
class PopulationPriorModel:
    albedo_regressor: object
    orbit_sigma_by_H: list                      # [(H_lo, H_hi, sigma_log10_pv)] from out-of-fold residuals
    complex_albedo: dict                        # complex -> array of log10 pV_eff
    complex_stats: dict                         # complex -> {"median", "sigma", "n"}
    combined_sigma: dict                        # complex -> CV rms of the (complex, orbit) combination
    orbit_classifier: object
    complexes: list
    base_rates: dict
    info: dict = field(default_factory=dict)

    # ------------------------------------------------------------------ albedo
    def orbit_albedo(self, a, e, i_deg, H) -> tuple[float, float]:
        """(mean, sigma) of log10 pV from orbit and H alone."""
        mu = float(self.albedo_regressor.predict(_features(a, e, i_deg, H))[0])
        sig = next((s for lo, hi, s in self.orbit_sigma_by_H if lo <= H < hi), self.orbit_sigma_by_H[-1][2])
        return mu, float(sig)

    def albedo_given_complex(self, a, e, i_deg, H, cx: str) -> tuple[float, float]:
        """(mean, sigma) of log10 pV for complex cx at this orbit: inverse-variance combination of the
        complex distribution and the orbit regression; sigma is the cross-validated rms of that combination
        for the complex (not the formal combined error, which ignores their correlation)."""
        mu_o, s_o = self.orbit_albedo(a, e, i_deg, H)
        st = self.complex_stats.get(cx)
        if st is None:
            return mu_o, s_o
        w1, w2 = 1 / st["sigma"] ** 2, 1 / s_o ** 2
        mu = (w1 * st["median"] + w2 * mu_o) / (w1 + w2)
        sig = self.combined_sigma.get(cx, float(np.sqrt(1 / (w1 + w2))))
        return float(mu), float(sig)

    def albedo_loglike(self, log10_pv: float, sigma_meas: float) -> dict:
        """ln p(measured log10 pV | complex) for every complex: a Gaussian kernel density of the catalogue
        values of that complex, convolved with the measurement error (Gaussian for complexes with fewer than
        MIN_KDE_POINTS objects)."""
        out = {}
        for cx in self.complexes:
            v = self.complex_albedo.get(cx, np.array([]))
            st = self.complex_stats.get(cx)
            if len(v) < MIN_KDE_POINTS:
                m = st["median"] if st else -1.0
                s = np.hypot(st["sigma"] if st else 0.3, sigma_meas)
                out[cx] = float(-0.5 * ((log10_pv - m) / s) ** 2 - np.log(s * np.sqrt(2 * np.pi)))
                continue
            h = max(1.06 * float(np.std(v)) * len(v) ** -0.2, 0.06)
            s = float(np.hypot(h, sigma_meas))
            dens = np.mean(np.exp(-0.5 * ((log10_pv - v) / s) ** 2)) / (s * np.sqrt(2 * np.pi))
            out[cx] = float(np.log(max(dens, 1e-300)))
        return out

    # ------------------------------------------------------------------ complex frequency
    def complex_probabilities_from_orbit(self, a, e, i_deg, H) -> dict:
        p = self.orbit_classifier.predict_proba(_features(a, e, i_deg, H))[0]
        return {c: float(v) for c, v in zip(self.orbit_classifier.classes_, p)}

    def complex_log_prior(self, a=None, e=None, i_deg=None, H=None, *, population_exponent: float = 0.25,
                          orbit_exponent: float = 0.5, floor: float = 1e-3) -> dict:
        """ln P(complex), normalised over the complexes:
            P(c) ∝ base(c)^beta * [P(c | orbit) / base(c)]^tau
        beta tempers the population frequencies (SMASSII is a magnitude-limited sample), tau the orbit
        information (random-forest probabilities are noisy for rare complexes). beta = 0, tau = 0 is a flat
        prior over complexes. Without orbit or H only the population term is used."""
        lp = {}
        orbit = None
        if None not in (a, e, i_deg, H) and orbit_exponent:
            orbit = self.complex_probabilities_from_orbit(a, e, i_deg, H)
        for c in self.complexes:
            b = max(self.base_rates.get(c, 0.0), floor)
            v = population_exponent * np.log(b)
            if orbit is not None:
                v += orbit_exponent * (np.log(max(orbit.get(c, 0.0), floor)) - np.log(b))
            lp[c] = float(v)
        mx = max(lp.values())
        z = mx + np.log(sum(np.exp(v - mx) for v in lp.values()))
        return {c: v - z for c, v in lp.items()}


# ---------------------------------------------------------------------- training
def _hgb(cfg):
    from sklearn.ensemble import HistGradientBoostingRegressor
    r = cfg.get("albedo_regressor", {})
    return HistGradientBoostingRegressor(max_iter=int(r.get("max_iter", 500)),
                                         learning_rate=float(r.get("learning_rate", 0.08)),
                                         max_leaf_nodes=int(r.get("max_leaf_nodes", 63)),
                                         random_state=int(r.get("random_state", 17)))


def _rf(cfg):
    from sklearn.ensemble import RandomForestClassifier
    r = cfg.get("orbit_classifier", {})
    return RandomForestClassifier(n_estimators=int(r.get("n_estimators", 300)),
                                  min_samples_leaf=int(r.get("min_samples_leaf", 15)),
                                  random_state=int(r.get("random_state", 1234)), n_jobs=int(r.get("n_jobs", 4)))


def _complex_stats(df: pd.DataFrame) -> tuple[dict, dict]:
    stats, samples = {}, {}
    for cx, g in df.groupby("complex"):
        v = g["log10_pv_eff"].to_numpy(float)
        v = v[np.isfinite(v)]
        if not len(v):
            continue
        samples[cx] = v
        stats[cx] = {"median": float(np.median(v)), "sigma": float(max(np.std(v), 0.1)), "n": int(len(v))}
    return stats, samples


def catalogue_albedo_offset(diameters: pd.DataFrame) -> dict:
    """log10(pV_eff / catalogue pV) over the catalogue: pV_eff reproduces the catalogue diameter with the current H,
    the catalogue pV was computed with the H of its time. Median -0.108 dex, robust sigma 0.076 dex (2026-11-15);
    a larger difference for one object means its H and catalogue values do not agree (see
    integration.population_context.catalogue_albedo)."""
    if "albedo" not in diameters:
        return {}
    m = np.isfinite(diameters["albedo"]) & (diameters["albedo"] > 0) & np.isfinite(diameters["log10_pv_eff"])
    if m.sum() < 100:
        return {}
    d = diameters.loc[m, "log10_pv_eff"].to_numpy(float) - np.log10(diameters.loc[m, "albedo"].to_numpy(float))
    med = float(np.median(d))
    return {"pv_eff_minus_catalogue_median_dex": med,
            "pv_eff_minus_catalogue_robust_sigma_dex": float(1.4826 * np.median(np.abs(d - med)))}


def build_model(diameters: pd.DataFrame, taxonomy: pd.DataFrame, cross_validate: bool = True,
                reuse_sigmas: PopulationPriorModel | None = None, log=print) -> PopulationPriorModel:
    """Train the three priors. With cross_validate the error models (orbit sigma by H, combined sigma by
    complex) are measured out of fold; otherwise they are taken from `reuse_sigmas`."""
    from sklearn.model_selection import KFold
    cfg = settings()["population_prior"]
    t0 = time.time()
    Xd, yd = diameters[FEATURES].to_numpy(float), diameters["log10_pv_eff"].to_numpy(float)
    reg = _hgb(cfg).fit(Xd, yd)
    info = {"n_diameters": int(len(diameters)), "n_taxonomy": int(len(taxonomy))}
    tax_d = taxonomy[np.isfinite(taxonomy["log10_pv_eff"])].copy()
    if cross_validate:
        oof = np.full(len(yd), np.nan)
        for tr, te in KFold(5, shuffle=True, random_state=17).split(Xd):
            oof[te] = _hgb(cfg).fit(Xd[tr], yd[tr]).predict(Xd[te])
        res = oof - yd
        sig_by_H = []
        for lo, hi in H_BINS:
            m = (diameters["H"].to_numpy() >= lo) & (diameters["H"].to_numpy() < hi)
            sig_by_H.append((lo, hi, float(np.sqrt(np.mean(res[m] ** 2))) if m.sum() > 30 else float(np.std(res))))
        info["orbit_cv_rms_log10_pv"] = float(np.sqrt(np.mean(res ** 2)))
        # combined (complex, orbit) error per complex, on SMASSII objects with a diameter
        oof_by = pd.Series(oof, index=diameters["pdes"].values)
        oof_by = oof_by[~oof_by.index.duplicated()]
        tax_d["orbit_oof"] = oof_by.reindex(tax_d["pdes"].values).values
        tt = tax_d[np.isfinite(tax_d["orbit_oof"])].reset_index(drop=True)
        pred = np.full(len(tt), np.nan)
        for tr, te in KFold(5, shuffle=True, random_state=3).split(tt):
            st, _ = _complex_stats(tt.iloc[tr])
            for i in te:
                c = tt.at[i, "complex"]
                s_o = next((s for lo, hi, s in sig_by_H if lo <= tt.at[i, "H"] < hi), sig_by_H[-1][2])
                if c in st:
                    w1, w2 = 1 / st[c]["sigma"] ** 2, 1 / s_o ** 2
                    pred[i] = (w1 * st[c]["median"] + w2 * tt.at[i, "orbit_oof"]) / (w1 + w2)
                else:
                    pred[i] = tt.at[i, "orbit_oof"]
        r = pred - tt["log10_pv_eff"].to_numpy(float)
        pooled = float(np.sqrt(np.nanmean(r ** 2)))
        comb = {}
        for c, g in pd.Series(r).groupby(tt["complex"].values):
            comb[c] = float(np.sqrt(np.nanmean(g ** 2))) if g.notna().sum() >= 10 else pooled
        info["combined_cv_rms_log10_pv"] = pooled
        info["combined_cv_n"] = int(np.isfinite(r).sum())
    else:
        sig_by_H = list(reuse_sigmas.orbit_sigma_by_H)
        comb = dict(reuse_sigmas.combined_sigma)          # copy: the cached standard model stays unchanged
        info.update({k: v for k, v in reuse_sigmas.info.items() if "cv" in k})
    info.update(catalogue_albedo_offset(diameters))
    stats, samples = _complex_stats(tax_d)
    for c in stats:                     # complexes without a CV estimate use the pooled value
        comb.setdefault(c, info.get("combined_cv_rms_log10_pv", 0.25))
    Xt = taxonomy[FEATURES].to_numpy(float)
    yt = taxonomy["complex"].to_numpy(str)
    rf = _rf(cfg).fit(Xt, yt)
    counts = pd.Series(yt).value_counts()
    base = (counts / counts.sum()).to_dict()
    info["seconds"] = round(time.time() - t0, 1)
    info["catalogue"] = {"diameters": diameters.attrs.get("provenance", {}).get("retrieved_utc"),
                         "taxonomy": taxonomy.attrs.get("provenance", {}).get("retrieved_utc")}
    info["n_excluded"] = len(diameters.attrs.get("excluded", []))
    return PopulationPriorModel(albedo_regressor=reg, orbit_sigma_by_H=sig_by_H, complex_albedo=samples,
                                complex_stats=stats, combined_sigma=comb, orbit_classifier=rf,
                                complexes=sorted(set(stats) | set(base)), base_rates={k: float(v) for k, v in base.items()},
                                info=info)


# ---------------------------------------------------------------------- cache
_MEMORY: dict = {}


def _key(excluded: list, prov: dict) -> str:
    blob = json.dumps({"excluded": sorted(excluded), "catalogue": prov,
                       "cfg": settings()["population_prior"]}, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def get_model(diameters: pd.DataFrame, taxonomy: pd.DataFrame, cache_dir, extra_excluded: set | None = None,
              log=print) -> PopulationPriorModel:
    """The model trained on the given tables (standard exclusions already applied), cached on disk.
    extra_excluded: designations (the analysed object) whose rows are removed as well; the model is then
    refitted without cross-validation, reusing the error models of the standard model."""
    from pathlib import Path
    cache_dir = Path(cache_dir)
    prov = {"d": diameters.attrs.get("provenance", {}).get("retrieved_utc"),
            "t": taxonomy.attrs.get("provenance", {}).get("retrieved_utc")}
    base_key = _key(diameters.attrs.get("excluded", []), prov)
    if base_key not in _MEMORY:
        p = cache_dir / "models" / f"population_prior_{base_key}.pkl"
        if p.exists():
            _MEMORY[base_key] = pickle.loads(p.read_bytes())
        else:
            log("Training the population priors (albedo regression, complex albedos, orbit complex frequencies)...")
            m = build_model(diameters, taxonomy, cross_validate=True, log=log)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(pickle.dumps(m))
            _MEMORY[base_key] = m
            log(f"Population priors trained in {m.info['seconds']} s ({m.info['n_diameters']} diameters, "
                f"{m.info['n_taxonomy']} classified objects); cached in {p}")
    model = _MEMORY[base_key]
    extra = {str(x) for x in (extra_excluded or ()) if x}
    hit_d = diameters["pdes"].isin(extra)
    hit_t = taxonomy["pdes"].isin(extra)
    if not hit_d.any() and not hit_t.any():
        model.info["target_rows_removed"] = 0
        return model
    key = base_key + "|" + ",".join(sorted(extra))
    if key not in _MEMORY:
        d2, t2 = diameters[~hit_d].reset_index(drop=True), taxonomy[~hit_t].reset_index(drop=True)
        d2.attrs, t2.attrs = diameters.attrs, taxonomy.attrs
        m = build_model(d2, t2, cross_validate=False, reuse_sigmas=model, log=log)
        m.info["target_rows_removed"] = int(hit_d.sum() + hit_t.sum())
        _MEMORY[key] = m
    return _MEMORY[key]
