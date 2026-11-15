"""Calibration of the classifier by injection-recovery of REAL asteroid spectra.

Each spectrum of the injection set (data/reference/injection_set: 190 MIT SMASS SpeX spectra with a
Bus-DeMeo class from DeMeo et al. 2009) is sampled exactly like a SPHEREx observation:
  * the observation's own points (wavelengths), normalisation groups and visits,
  * Gaussian convolution to the SPHEREx resolving power,
  * photometric noise and visit-correlated noise with the observation's own error model
    (classification.covariance.point_covariance),
and classified with the observation's slope systematic. The outcome per injection is the scaled deviance
gap of the true complex (and class) to the first one. From these:
  * accuracy - the true complex is first;
  * "distinguished wrong" rate at a gap T - the true complex is behind the first by >= T (what C7 calls
    FAIL); the calibrated thresholds in config/settings.yaml are the smallest T with this rate <= 5%
    (Medium) and <= 1% (High), and for the class level <= 5%.

No validation target's reference class is used: the targets only lend their sampling.
Command: python main.py classifier-calibration --targets 433 246 ... [--models chi2 gaussian gaussian_corr0.2]
"""
from __future__ import annotations

import json
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import cache_directory, resolve, settings

SET_DIR = "data/reference/injection_set"
W_SUFFIX = {"Sw": "S", "Sqw": "Sq", "Srw": "Sr", "Svw": "Sv", "Vw": "V"}


def download_injection_set(log=print) -> Path:
    """Fetch the SpeX files listed in injection_set.csv into data/raw/smass_spex/ (skips existing files)."""
    from ..common.http import request
    idx = pd.read_csv(resolve(SET_DIR) / "injection_set.csv")
    out = cache_directory("smass_spex")
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for r in idx.itertuples():
        f = out / Path(r.smass_file).name
        if f.exists() and f.stat().st_size > 0:
            continue
        f.write_text(request("GET", r.url, timeout=60))
        n += 1
        time.sleep(0.1)
    log(f"{n} spectra downloaded, {len(idx) - n} already cached in {out}")
    return out


def load_injection_set(min_points: int = 50) -> list[dict]:
    from ..classification.reference_library import complex_of
    idx = pd.read_csv(resolve(SET_DIR) / "injection_set.csv")
    d = cache_directory("smass_spex")
    spectra = []
    for r in idx.itertuples():
        f = d / Path(r.smass_file).name
        if not f.exists():
            continue
        vals = np.array(f.read_text().split(), float)
        a = vals[: len(vals) // 4 * 4].reshape(-1, 4)
        a = a[(a[:, 1] > 0) & (a[:, 2] > 0) & (a[:, 3] > 0)]
        a = a[np.argsort(a[:, 0])]
        if len(a) < min_points:
            continue
        cls = str(r.busdemeo_class).rstrip(":")
        cls = W_SUFFIX.get(cls, cls)
        spectra.append({"number": int(r.number), "class": cls, "complex": complex_of(cls),
                        "lam": a[:, 0], "R": a[:, 1]})
    return spectra


def resample(spec: dict, lam: np.ndarray, resolving_power: float | None = None) -> np.ndarray:
    """Gaussian convolution (FWHM = lambda / R) at lam; NaN outside the spectrum's coverage."""
    rp = resolving_power or settings()["classification"]["spherex_resolving_power"]
    out = np.full(len(lam), np.nan)
    lo, hi = spec["lam"].min() + 0.01, spec["lam"].max() - 0.01
    for i, l0 in enumerate(lam):
        if l0 < lo or l0 > hi:
            continue
        s = l0 / rp / 2.3548
        w = np.exp(-0.5 * ((spec["lam"] - l0) / s) ** 2)
        m = w > 1e-3
        if m.sum() >= 3:
            out[i] = np.sum(w[m] * spec["R"][m]) / np.sum(w[m])
    return out


def sampling_from_analysis(ana) -> dict:
    """The parts of a SpectrumAnalysis that define how SPHEREx sampled the spectrum."""
    r = ana.reflectance
    r = r[np.isfinite(r["reflectance"]) & (r["wavelength_um"] <= 2.45)].copy()
    return {"refl": r, "slope_sys": ana.slope_sys_per_um}


def set_model(model: str) -> None:
    """chi2 | gaussian | gaussian_corr<L>: likelihood and class-variance correlation for this process."""
    from ..common import config
    cfg = config._load("settings.yaml")["classification"]
    if model == "chi2":
        cfg["likelihood"], cfg["class_variance_correlation_um"] = "chi2", None
    elif model == "gaussian":
        cfg["likelihood"], cfg["class_variance_correlation_um"] = "gaussian", None
    elif model.startswith("gaussian_corr"):
        cfg["likelihood"], cfg["class_variance_correlation_um"] = "gaussian", float(model[len("gaussian_corr"):])
    elif model != "settings":
        raise ValueError(f"unknown model {model}")


def inject_and_classify(sampling: dict, spec: dict, seed: int, prior=None) -> dict | None:
    """prior: TargetPrior of the injected object (its orbit and catalogue albedo, population model trained
    without the injection set), or None for the spectral classifier alone."""
    from ..classification.covariance import point_covariance
    from ..classification.taxonomy import classify
    r = sampling["refl"].copy()
    Rt = resample(spec, r["wavelength_um"].values)
    keep = np.isfinite(Rt)
    r, Rt = r[keep].copy(), Rt[keep]
    if len(r) < settings()["classification"]["min_overlap_points"]:
        return None
    _, p, v, visit = point_covariance(r)
    rng = np.random.default_rng(seed)
    eta = {vv: rng.normal() for vv in np.unique(visit)}
    Ri = Rt * (1 + p * rng.normal(size=len(Rt)) + v * np.array([eta[vv] for vv in visit]))
    rel = (r["reflectance_err"] / r["reflectance"].abs()).values
    r["reflectance"], r["reflectance_err"] = Ri, np.abs(Ri) * rel
    tax = classify(r, slope_sys_per_um=sampling["slope_sys"], band_evidence=None, prior=prior)
    if not tax.ranking:
        return None
    # class and complex scores as used by the classifier (scaled, incl. the prior)
    dev = {q["class"]: q["score_total"] for q in tax.ranking}
    cdev = dict(tax.complex_score)
    top_c, top = min(cdev, key=cdev.get), min(dev, key=dev.get)
    nxt_c = min(v_ for k_, v_ in cdev.items() if k_ != top_c)
    nxt = min(v_ for k_, v_ in dev.items() if k_ != top)
    tc, tk = spec["complex"], spec["class"]
    p_true = next((c["probability"] for c in tax.complex_ranking if c["complex"] == tc), 0.0)
    return {"number": spec["number"], "true_class": tk, "true_complex": tc, "top_class": top, "top_complex": top_c,
            "complex_gap": cdev[tc] - cdev[top_c] if tc != top_c else -(nxt_c - cdev[top_c]),
            "class_gap": dev[tk] - dev[top] if tk != top else -(nxt - dev[top]),
            "p_true_complex": float(p_true), "prior_albedo": bool(prior is not None and prior.albedo),
            "n_points": int(len(r)), "confidence": tax.confidence}


def _worker(args):
    model, name, k, seed = args
    set_model(model)
    pri = _worker.priors.get(str(_worker.spectra[k]["number"])) if _worker.priors else None
    res = inject_and_classify(_worker.samplings[name], _worker.spectra[k], seed, prior=pri)
    if res:
        res.update(model=model, sampling=name)
    return res


def _init(samplings, spectra, priors=None):
    _worker.samplings, _worker.spectra, _worker.priors = samplings, spectra, priors


def run_injection(samplings: dict, model: str = "settings", n_proc: int | None = None, log=print,
                  use_prior: bool | None = None) -> pd.DataFrame:
    """use_prior: classify with each object's TargetPrior (default: classification.prior.enabled)."""
    spectra = load_injection_set()
    if not spectra:
        raise FileNotFoundError("No injection spectra cached; run download_injection_set() first.")
    if use_prior is None:
        use_prior = bool(settings()["classification"].get("prior", {}).get("enabled", False))
    priors = None
    if use_prior:
        from ..integration.population_context import injection_priors
        priors = injection_priors([s["number"] for s in spectra], log=log)
        log(f"  priors for {len(priors)} injected objects "
            f"({sum(1 for p in priors.values() if p.albedo)} with a catalogue albedo)")
    jobs = [(model, name, k, 1000 * i + k) for i, name in enumerate(samplings) for k in range(len(spectra))]
    n_proc = n_proc or max(1, min(10, (__import__("os").cpu_count() or 2) - 2))
    t0, rows = time.time(), []
    with Pool(n_proc, initializer=_init, initargs=(samplings, spectra, priors)) as pool:
        for i, r in enumerate(pool.imap_unordered(_worker, jobs, chunksize=4)):
            if r:
                rows.append(r)
            if i and i % 500 == 0:
                log(f"  {model}: {i}/{len(jobs)} injections ({time.time() - t0:.0f} s)")
    return pd.DataFrame(rows)


def threshold_table(df: pd.DataFrame, gaps=(4, 6, 8, 10, 12, 15, 20, 25, 30)) -> pd.DataFrame:
    return pd.DataFrame([{"gap": T, "complex_wrong_distinguished": float((df.complex_gap >= T).mean()),
                          "complex_right_distinguished": float((df.complex_gap <= -T).mean()),
                          "class_wrong_distinguished": float((df.class_gap >= T).mean()),
                          "class_right_distinguished": float((df.class_gap <= -T).mean())} for T in gaps])


def calibrated_gaps(df: pd.DataFrame) -> dict:
    tab = threshold_table(df)

    def first(col, limit):
        ok = tab[tab[col] <= limit]
        return float(ok["gap"].min()) if len(ok) else None

    return {"distinguished_gap": first("complex_wrong_distinguished", 0.05),
            "high_confidence_gap": first("complex_wrong_distinguished", 0.01),
            "class_distinguished_gap": first("class_wrong_distinguished", 0.05),
            "complex_accuracy": float((df.top_complex == df.true_complex).mean()),
            "complex_accuracy_class_balanced": float((df.top_complex == df.true_complex).groupby(df.true_complex).mean().mean()),
            "mean_log_p_true_complex": (float(np.log(np.clip(df.p_true_complex, 1e-6, 1)).mean())
                                        if "p_true_complex" in df else None),
            "class_accuracy": float((df.top_class == df.true_class).mean()),
            "complex_wrong_distinguished_at_4": float((df.complex_gap >= 4).mean()),
            "n_injections": int(len(df))}


def save_calibration(results: dict, out_dir: str | None = None) -> Path:
    out = resolve(out_dir) if out_dir is not None else resolve(settings()["project"]["output_dir"]) / "validation"
    out.mkdir(parents=True, exist_ok=True)
    p = out / "classifier_calibration.json"
    summary = {}
    if p.exists():                       # keep the entries of models not run this time
        try:
            summary = json.loads(p.read_text())
        except ValueError:
            summary = {}
    for model, df in results.items():
        df.to_csv(out / f"classifier_calibration_{model}.csv", index=False)
        summary[model] = {"calibrated": calibrated_gaps(df), "thresholds": threshold_table(df).to_dict("records"),
                          "by_true_complex": df.assign(ok=df.top_complex == df.true_complex,
                                                       wrong=df.complex_gap >= 4)
                          .groupby("true_complex")[["ok", "wrong"]].mean().round(3).to_dict("index")}
    p.write_text(json.dumps(summary, indent=2))
    return p
