"""Error covariance of a SPHEREx reflectance spectrum.

Two error components with different correlation:
  * photometric noise - independent from point to point (PSF fit error and a photometric floor);
  * brightness-normalisation error from the observation-time correction (lightcurve model or visit
    offsets) - common to all points of the same visit, because they share a rotational phase.
Treating the second as independent noise drowns the precisely measured within-visit spectral shape
(on 433 Eros the within-segment fit gave chi2_red = 0.14 with diagonal errors). The covariance is
    C_ij = delta_ij (R_i p_i)^2 + [visit_i == visit_j] R_i R_j v_i v_j
with p the relative photometric error and v the relative normalisation error.
Binning onto a coarser grid is a linear map b = W r, so Cov(b) = W C W^T.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..common.config import settings


def has_visit_structure(df: pd.DataFrame) -> bool:
    return {"visit", "temporal_corr_err_ln"} <= set(df.columns)


def point_covariance(df: pd.DataFrame, value_col: str = "reflectance", err_col: str = "reflectance_err"):
    """Returns (R, p, v, visit) for the rows of df (order preserved)."""
    R = df[value_col].values.astype(float)
    floor = settings()["temporal"]["photometric_floor_frac"]
    if {"flux_uJy_raw", "flux_err_uJy_raw"} <= set(df.columns):
        p = df["flux_err_uJy_raw"].values / np.abs(df["flux_uJy_raw"].values)
    else:
        p = df[err_col].values / np.abs(R)
    p = np.hypot(p, floor)
    v = df["temporal_corr_err_ln"].values.astype(float) if "temporal_corr_err_ln" in df else np.zeros(len(df))
    visit = df["visit"].values if "visit" in df else np.arange(len(df))
    return R, p, v, visit


def covariance_matrix(R, p, v, visit) -> np.ndarray:
    C = np.diag((R * p) ** 2)
    a = R * v
    same = visit[:, None] == visit[None, :]
    return C + same * np.outer(a, a)


def bin_with_covariance(lam, R, p, v, visit, groups, edges):
    """Inverse-variance (photometric) binning within each normalisation group; full covariance of
    the binned values. Returns lam_b, R_b, C_b, group_b."""
    C = covariance_matrix(R, p, v, visit)
    rows, lam_b, grp_b = [], [], []
    w_pt = 1.0 / (R * p) ** 2
    for g in np.unique(groups):
        for lo, hi in zip(edges[:-1], edges[1:]):
            m = (groups == g) & (lam >= lo) & (lam < hi)
            if not m.any():
                continue
            w = np.zeros(len(R))
            w[m] = w_pt[m] / w_pt[m].sum()
            rows.append(w)
            lam_b.append(float(np.sum(w * lam)))
            grp_b.append(g)
    W = np.array(rows)
    order = np.argsort(lam_b)
    W = W[order]
    return np.asarray(lam_b)[order], W @ R, W @ C @ W.T, np.asarray(grp_b)[order]


def gls(A, y, C):
    """Generalised least squares: coef, covariance, chi2."""
    L = np.linalg.cholesky(C + 1e-12 * np.eye(len(C)) * np.mean(np.diag(C)))
    Aw = np.linalg.solve(L, A)
    yw = np.linalg.solve(L, y)
    coef, *_ = np.linalg.lstsq(Aw, yw, rcond=None)
    r = yw - Aw @ coef
    cov = np.linalg.pinv(Aw.T @ Aw)
    return coef, cov, float(r @ r)
