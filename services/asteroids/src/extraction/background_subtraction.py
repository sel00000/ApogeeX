"""Local background estimation.

The IMAGE extension contains astrophysical sources, zodiacal light, other diffuse
emission and detector residuals. The ZODI extension is a model and is not assumed to
have been subtracted. The default method estimates the total local background in an
annulus (sigma-clipped median, flagged pixels excluded), which removes zodiacal light
and other smooth backgrounds together. With `zodi_model_plus_annulus`, the ZODI model
is subtracted first and the annulus then measures the residual.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..common.config import settings


@dataclass
class Background:
    level: float              # MJy/sr per pixel
    error: float              # uncertainty of the mean level
    n_pixels: int
    method: str
    zodi_at_target: float | None


def sigma_clipped_stats(values: np.ndarray, sigma: float = 3.0, iters: int = 5):
    v = values[np.isfinite(values)]
    for _ in range(iters):
        if v.size < 5:
            break
        med = np.median(v)
        mad = 1.4826 * np.median(np.abs(v - med))
        if mad == 0:
            break
        keep = np.abs(v - med) < sigma * mad
        if keep.all():
            break
        v = v[keep]
    if v.size == 0:
        return np.nan, np.nan, 0
    med = float(np.median(v))
    std = float(1.4826 * np.median(np.abs(v - med))) if v.size > 1 else np.nan
    return med, std, int(v.size)


def estimate_background(img, x0: float, y0: float, bad: np.ndarray) -> Background:
    cfg = settings()["extraction"]
    r_in, r_out = cfg["background_inner_radius_pix"], cfg["background_outer_radius_pix"]
    yy, xx = np.indices(img.image.shape)
    rr = np.hypot(xx - x0, yy - y0)
    ann = (rr >= r_in) & (rr <= r_out) & ~bad
    data = img.image.copy()
    zodi_t = None
    method = cfg.get("background_method", "local_annulus")
    if img.zodi is not None:
        iy, ix = int(round(y0)), int(round(x0))
        if 0 <= iy < img.zodi.shape[0] and 0 <= ix < img.zodi.shape[1]:
            zodi_t = float(img.zodi[iy, ix])
        if method == "zodi_model_plus_annulus":
            data = data - img.zodi
    level, std, n = sigma_clipped_stats(data[ann], sigma=cfg["background_sigma_clip"])
    err = std / np.sqrt(n) * np.sqrt(np.pi / 2) if n > 1 else np.nan   # error of a median
    return Background(level=level, error=err, n_pixels=n, method=method, zodi_at_target=zodi_t)


def background_subtracted_image(img, background: Background) -> np.ndarray:
    """Use the same image domain as the annulus estimator, including spatial ZODI.

    ``level`` is a residual only when a ZODI plane was actually available. Without
    that plane, the estimator measures the total local background as usual.
    Non-finite model pixels remain non-finite and must be excluded from the fit.
    """
    data = img.image - background.level
    if background.method == "zodi_model_plus_annulus" and img.zodi is not None:
        data = data - img.zodi
    return data
