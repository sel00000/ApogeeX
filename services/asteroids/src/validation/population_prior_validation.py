"""Model comparison for the population priors, in the manner of the two reference notebooks
(Kaggle notebooks asteroid-diameter-prediction-mlp-catboost-lgbm and 99-49-asteroid-classification-mult-models;
not part of this repository):
several model families are cross-validated on the same folds and compared on held-out data, and the
feature importance of the chosen models is measured (permutation importance on held-out data).

Differences from the notebooks, on purpose:
  * the albedo is never a feature - an asteroid without a diameter has no albedo either (the diameter notebook
    used it, which makes D nearly a function of the inputs: D = 1329 / sqrt(pV) 10^(-H/5));
  * the target is log10 pV with the current H (errors quoted in log10 D), not D in km, whose MSE is
    dominated by the few largest bodies;
  * classifier probabilities are scored by log-loss (they are used as a prior), not only by accuracy;
  * validation targets and the injection set are excluded from all training.

Command: python main.py population-priors --compare  ->  outputs/validation/population_priors.{json,md}
"""
from __future__ import annotations

import json
import time
import warnings

import numpy as np
import pandas as pd

from ..acquisition.population_catalogue import load_training_tables
from ..common.config import resolve, settings
from ..physical.population_priors import FEATURES, _complex_stats


def _metrics_logD(pred_lpv, true_lpv) -> dict:
    r = 0.5 * (np.asarray(pred_lpv) - np.asarray(true_lpv))          # error in log10 D
    return {"rms_log10_D": float(np.sqrt(np.mean(r ** 2))),
            "robust_sigma_log10_D": float(1.4826 * np.median(np.abs(r - np.median(r)))),
            "frac_within_20pct": float(np.mean(np.abs(10 ** r - 1) < 0.2)),
            "frac_within_50pct": float(np.mean(np.abs(10 ** r - 1) < 0.5))}


def compare_models(out_dir: str | None = None, log=print) -> str:
    from sklearn.ensemble import (HistGradientBoostingClassifier, HistGradientBoostingRegressor,
                                  RandomForestClassifier, RandomForestRegressor)
    from sklearn.inspection import permutation_importance
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.metrics import accuracy_score, log_loss
    from sklearn.model_selection import KFold, StratifiedKFold, cross_val_predict, train_test_split
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.neural_network import MLPRegressor
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC
    from sklearn.tree import DecisionTreeClassifier
    warnings.filterwarnings("ignore")
    t0 = time.time()
    d, tx = load_training_tables(log=log)
    X, y = d[FEATURES].to_numpy(float), d["log10_pv_eff"].to_numpy(float)
    kf = KFold(5, shuffle=True, random_state=17)
    out = {"n_diameters": int(len(d)), "n_classified": int(len(tx)), "features": FEATURES,
           "excluded_designations": len(d.attrs.get("excluded", [])), "albedo_regression": {}, "complex_albedo": {},
           "orbit_complex_classifier": {}}
    # ---- 1. albedo regression (orbit + H -> log10 pV), error in log10 D
    regs = {"constant (median pV)": None,
            "Ridge (linear)": make_pipeline(StandardScaler(), Ridge()),
            "MLP (64, 32)": make_pipeline(StandardScaler(), MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=200,
                                                                         early_stopping=True, random_state=17)),
            "Random forest": RandomForestRegressor(200, min_samples_leaf=5, n_jobs=8, random_state=17),
            "Gradient boosting (HistGB, adopted)": HistGradientBoostingRegressor(max_iter=500, learning_rate=0.08,
                                                                                 max_leaf_nodes=63, random_state=17)}
    oof_hgb = None
    for name, m in regs.items():
        t1 = time.time()
        p = np.full_like(y, np.median(y)) if m is None else cross_val_predict(m, X, y, cv=kf)
        if "adopted" in name:
            oof_hgb = p
        out["albedo_regression"][name] = dict(_metrics_logD(p, y), seconds=round(time.time() - t1, 1))
        log(f"  albedo regression {name}: rms log10 D {out['albedo_regression'][name]['rms_log10_D']:.3f}")
    # permutation importance of the adopted regressor on a held-out split
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=17)
    hgb = HistGradientBoostingRegressor(max_iter=500, learning_rate=0.08, max_leaf_nodes=63,
                                        random_state=17).fit(Xtr, ytr)
    pi = permutation_importance(hgb, Xte, yte, n_repeats=5, random_state=17, scoring="neg_mean_squared_error")
    out["albedo_regression_permutation_importance"] = {f: float(v) for f, v in zip(FEATURES, pi.importances_mean)}
    # ---- 2. complex albedo vs orbit, on SMASSII-classified objects with a diameter
    oof = pd.Series(oof_hgb, index=d["pdes"].values)
    oof = oof[~oof.index.duplicated()]
    tt = tx[np.isfinite(tx["log10_pv_eff"])].copy()
    tt["orbit_oof"] = oof.reindex(tt["pdes"].values).values
    tt = tt[np.isfinite(tt["orbit_oof"])].reset_index(drop=True)
    yt, po = tt["log10_pv_eff"].to_numpy(float), tt["orbit_oof"].to_numpy(float)
    s_o = float(np.std(yt - po))
    pc, pi_ = np.zeros_like(yt), np.zeros_like(yt)
    for tr, te in KFold(5, shuffle=True, random_state=3).split(tt):
        st, _ = _complex_stats(tt.iloc[tr])
        for i in te:
            c = tt.at[i, "complex"]
            m_, s_ = (st[c]["median"], st[c]["sigma"]) if c in st else (np.median(yt[tr]), 0.3)
            pc[i] = m_
            pi_[i] = (m_ / s_ ** 2 + po[i] / s_o ** 2) / (1 / s_ ** 2 + 1 / s_o ** 2)
    out["complex_albedo"] = {"n": int(len(tt)),
                             "orbit regression only": _metrics_logD(po, yt),
                             "complex median only": _metrics_logD(pc, yt),
                             "complex + orbit, inverse-variance (adopted)": _metrics_logD(pi_, yt),
                             "by complex (adopted)": {c: dict(_metrics_logD(pi_[g.index], yt[g.index]), n=int(len(g)))
                                                      for c, g in tt.groupby("complex")}}
    # ---- 3. P(complex | orbit, H)
    Xc, yc = tx[FEATURES].to_numpy(float), tx["complex"].to_numpy(str)
    labels = sorted(set(yc))
    base = pd.Series(yc).value_counts(normalize=True).reindex(labels).to_numpy()
    skf = StratifiedKFold(5, shuffle=True, random_state=1234)
    out["orbit_complex_classifier"]["base rates only"] = {
        "log_loss": float(log_loss(yc, np.tile(base, (len(yc), 1)), labels=labels)), "accuracy": float(base.max())}
    clfs = {"Logistic regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
            "Decision tree": DecisionTreeClassifier(max_depth=5, min_samples_leaf=20, random_state=1234),
            "SVM (RBF)": make_pipeline(StandardScaler(), SVC(probability=True, random_state=1234)),
            "k nearest neighbours (25)": make_pipeline(StandardScaler(), KNeighborsClassifier(25, weights="distance")),
            "Gradient boosting (HistGB)": HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05,
                                                                         max_leaf_nodes=15, l2_regularization=1.0,
                                                                         random_state=1234),
            "Random forest (leaf 5)": RandomForestClassifier(300, min_samples_leaf=5, random_state=1234, n_jobs=8),
            "Random forest (leaf 15, adopted)": RandomForestClassifier(300, min_samples_leaf=15, random_state=1234,
                                                                       n_jobs=8)}
    for name, m in clfs.items():
        pr = cross_val_predict(m, Xc, yc, cv=skf, method="predict_proba")
        pr = np.clip(pr, 1e-4, 1)
        pr /= pr.sum(1, keepdims=True)
        idx = [labels.index(v) for v in yc]
        pt = pr[np.arange(len(yc)), idx]
        out["orbit_complex_classifier"][name] = {
            "log_loss": float(log_loss(yc, pr, labels=labels)),
            "accuracy": float(accuracy_score(yc, np.array(labels)[pr.argmax(1)])),
            "mean_p_true_by_complex": {c: float(v) for c, v in pd.Series(pt).groupby(yc).mean().items()}}
        log(f"  orbit classifier {name}: log-loss {out['orbit_complex_classifier'][name]['log_loss']:.3f}")
    Xtr, Xte, ytr, yte = train_test_split(Xc, yc, test_size=0.25, random_state=1234, stratify=yc)
    rf = RandomForestClassifier(300, min_samples_leaf=15, random_state=1234, n_jobs=8).fit(Xtr, ytr)
    pi = permutation_importance(rf, Xte, yte, n_repeats=10, random_state=1234, scoring="neg_log_loss")
    out["orbit_classifier_permutation_importance"] = {f: float(v) for f, v in zip(FEATURES, pi.importances_mean)}
    out["base_rates"] = {c: float(v) for c, v in zip(labels, base)}
    out["seconds"] = round(time.time() - t0, 1)
    od = resolve(out_dir) if out_dir is not None else resolve(settings()["project"]["output_dir"]) / "validation"
    od.mkdir(parents=True, exist_ok=True)
    (od / "population_priors.json").write_text(json.dumps(out, indent=2))
    (od / "population_priors.md").write_text(_markdown(out), encoding="utf-8")
    return str(od / "population_priors.md")


def _markdown(o: dict) -> str:
    L = ["# Population priors: model comparison", "",
         f"Training: {o['n_diameters']} catalogue diameters, {o['n_classified']} SMASSII-classified objects; "
         f"{o['excluded_designations']} designations excluded (validation targets, injection set). "
         "5-fold cross-validation; errors in log10 D.", "",
         "## Albedo regression (a, e, sin i, H -> log10 pV)", "",
         "| Model | rms log10 D | robust sigma | within 20% | within 50% |", "|---|---|---|---|---|"]
    for k, v in o["albedo_regression"].items():
        L.append(f"| {k} | {v['rms_log10_D']:.3f} | {v['robust_sigma_log10_D']:.3f} | {v['frac_within_20pct']:.2f} | "
                 f"{v['frac_within_50pct']:.2f} |")
    L += ["", "Permutation importance (increase of MSE in log10 pV when the feature is shuffled): "
          + ", ".join(f"{k} {v:.4f}" for k, v in sorted(o["albedo_regression_permutation_importance"].items(),
                                                       key=lambda x: -x[1])), "",
          f"## Albedo of a complex (SMASSII objects with a diameter, n = {o['complex_albedo']['n']})", "",
          "| Predictor | rms log10 D | robust sigma | within 20% | within 50% |", "|---|---|---|---|---|"]
    for k, v in o["complex_albedo"].items():
        if isinstance(v, dict) and "rms_log10_D" in v:
            L.append(f"| {k} | {v['rms_log10_D']:.3f} | {v['robust_sigma_log10_D']:.3f} | {v['frac_within_20pct']:.2f} | "
                     f"{v['frac_within_50pct']:.2f} |")
    L += ["", "| Complex (adopted predictor) | n | rms log10 D | within 20% |", "|---|---|---|---|"]
    for c, v in o["complex_albedo"]["by complex (adopted)"].items():
        L.append(f"| {c} | {v['n']} | {v['rms_log10_D']:.3f} | {v['frac_within_20pct']:.2f} |")
    L += ["", "## Complex frequency along the orbit (a, e, sin i, H -> complex)", "",
          "| Model | log-loss | accuracy |", "|---|---|---|"]
    for k, v in o["orbit_complex_classifier"].items():
        L.append(f"| {k} | {v['log_loss']:.3f} | {v['accuracy']:.3f} |")
    L += ["", "Permutation importance (increase of log-loss): "
          + ", ".join(f"{k} {v:.4f}" for k, v in sorted(o["orbit_classifier_permutation_importance"].items(),
                                                       key=lambda x: -x[1])), ""]
    return "\n".join(L)
