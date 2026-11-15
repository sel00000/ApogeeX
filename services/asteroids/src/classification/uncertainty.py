"""Classification stability under measurement noise (Monte Carlo)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..common.config import settings


def monte_carlo_stability(refl: pd.DataFrame, classify_fn, n: int | None = None, seed: int = 1) -> dict:
    n = n or settings()["classification"]["monte_carlo_samples"]
    rng = np.random.default_rng(seed)
    best, cx = [], []
    for _ in range(n):
        p = refl.copy()
        p["reflectance"] = p["reflectance"] + rng.normal(0, 1, len(p)) * p["reflectance_err"]
        r = classify_fn(p)
        if r.candidates:
            best.append(r.candidates[0]["class"])
            cx.append(r.best_complex)
    if not best:
        return {"status": "no valid realisations"}
    b = pd.Series(best).value_counts(normalize=True)
    c = pd.Series(cx).value_counts(normalize=True)
    return {"n": len(best), "class_frequency": b.to_dict(), "complex_frequency": c.to_dict(),
            "note": "Fraction of noise realisations in which each class/complex ranks first."}
