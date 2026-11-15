"""Spectrum, component separation, reference comparison and residual plots.
Colours: src/visualization/style.py (the dashboard's dark surface; one scheme for every figure)."""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from ..classification.reference_library import load_busdemeo, resample_reference  # noqa: E402
from ..common.config import settings  # noqa: E402
from ..i18n import t  # noqa: E402
from . import style  # noqa: E402

style.apply()
QCOLOR = {q: c for q, (c, _) in style.QUALITY.items()}


def plot_spectrum(df, target, ax=None, simulated=False):
    style.apply()
    ax = ax or plt.subplots(figsize=(8, 4.5))[1]
    for q, g in df.groupby("quality_flag"):
        color, marker = style.QUALITY.get(q, (style.MUTED, "o"))
        ax.errorbar(g["wavelength_um"], g["flux_uJy"], yerr=g["flux_err_uJy"], fmt=marker, ms=4, color=color,
                    ecolor=color, elinewidth=0.8, label=f"{t('plot.observed')} ({q})", alpha=0.9)
    ax.set_xlabel(t("plot.wavelength"))
    ax.set_ylabel(t("plot.flux"))
    ax.set_yscale("log")
    ax.set_xlim(0.7, 5.05)
    ax.set_title(t("plot.spectrum_title", target=target) + (" [SIMULATED]" if simulated else ""))
    ax.legend(fontsize=8)
    return ax


def plot_separation(points, target, ax=None, simulated=False):
    style.apply()
    ax = ax or plt.subplots(figsize=(8, 4.5))[1]
    p = points.sort_values("wavelength_um")
    ax.errorbar(p["wavelength_um"], p["flux_uJy"], yerr=p["flux_err_uJy"], fmt="o", ms=4, color=style.TEXT,
                ecolor=style.MUTED, elinewidth=0.8, label=t("plot.observed"), zorder=3)
    # total first, components on top: where the thermal part is zero the reflected line coincides with it
    ax.plot(p["wavelength_um"], p["model_total_uJy"], "-", color=style.AQUA, label=t("plot.model_total"))
    ax.plot(p["wavelength_um"], p["model_reflected_uJy"], "--", color=style.BLUE, label=t("plot.model_reflected"))
    th = p["model_thermal_uJy"]
    ax.plot(p["wavelength_um"], np.where(th > 0, th, np.nan), ":", color=style.ORANGE, label=t("plot.model_thermal"))
    if "thermal_err_uJy" in p:
        ax.fill_between(p["wavelength_um"], th - p["thermal_err_uJy"], th + p["thermal_err_uJy"], color=style.ORANGE,
                        alpha=0.2, linewidth=0)
    ax.set_yscale("log")
    # keep the data readable: the thermal model can fall to 1e-18 uJy at short wavelengths
    f = p["flux_uJy"].to_numpy(float)
    f = f[np.isfinite(f) & (f > 0)]
    if len(f):
        ax.set_ylim(f.min() / 5, f.max() * 3)
    ax.set_xlabel(t("plot.wavelength"))
    ax.set_ylabel(t("plot.flux"))
    ax.set_title(t("plot.separation_title", target=target) + (" [SIMULATED]" if simulated else ""))
    ax.legend(fontsize=8)
    return ax


def plot_residuals(points, target, ax=None):
    style.apply()
    ax = ax or plt.subplots(figsize=(8, 3))[1]
    p = points.sort_values("wavelength_um")
    used = p.get("used_in_fit", np.zeros(len(p), bool)).astype(bool)
    ax.axhline(0, color=style.AXIS, lw=1.0)
    ax.plot(p["wavelength_um"][used], p["residual_sigma"][used], "o", ms=4, color=style.BLUE, label="used in fit")
    ax.plot(p["wavelength_um"][~used], p["residual_sigma"][~used], "o", ms=4, mfc="none", color=style.MUTED,
            label="not used")
    ax.set_xlabel(t("plot.wavelength"))
    ax.set_ylabel(t("plot.residual_sigma"))
    ax.set_title(t("plot.residual_title", target=target))
    ax.legend(fontsize=8)
    return ax


def plot_reference_comparison(refl, taxonomy, target, ax=None, n=3):
    style.apply()
    ax = ax or plt.subplots(figsize=(8, 4.5))[1]
    lib = load_busdemeo()
    R_cfg = settings()["classification"]["spherex_resolving_power"]
    lam_norm = settings()["reflectance"]["normalization_wavelength_um"]
    # the comparison covers the class means' range (0.75-2.45 um); thermally dominated points beyond it are
    # in the separation plot and would only stretch the axis
    r = refl.dropna(subset=["reflectance"]).sort_values("wavelength_um")
    r = r[r["wavelength_um"] <= 2.5]
    ax.errorbar(r["wavelength_um"], r["reflectance"], yerr=r["reflectance_err"], fmt="o", ms=4, color=style.TEXT,
                ecolor=style.MUTED, elinewidth=0.8, label=t("plot.observed"), zorder=3)
    grid = np.linspace(0.75, 2.45, 200)
    ys = [r["reflectance"].to_numpy(float)]
    for c, color in zip((taxonomy.candidates[:n] if taxonomy and taxonomy.candidates else []), style.SERIES):
        rr, _, _ = resample_reference(lib[c["class"]], grid, R_cfg, lam_norm)
        model = rr * c.get("scale", 1.0) * (1 + c.get("beta_slope", 0.0) * (grid - lam_norm))
        ys.append(np.asarray(model, float))
        ax.plot(grid, model, color=color, label=f"{c['class']} ({100 * c.get('probability', c.get('score', 0)):.1f}%)")
    y = np.concatenate(ys)
    y = y[np.isfinite(y)]
    if len(y):
        lo, hi = np.percentile(y, [1, 99])
        pad = 0.15 * (hi - lo if hi > lo else abs(hi) or 1.0)
        ax.set_ylim(lo - pad, hi + pad)
    ax.set_xlim(0.7, 2.5)
    ax.set_xlabel(t("plot.wavelength"))
    ax.set_ylabel(t("plot.reflectance"))
    ax.set_title(t("plot.reflectance_title", target=target))
    ax.legend(fontsize=8)
    return ax


def save(fig_or_ax, path):
    fig = fig_or_ax.figure if hasattr(fig_or_ax, "figure") else fig_or_ax
    fig.tight_layout()
    fig.savefig(path, dpi=130, facecolor=fig.get_facecolor())
    plt.close(fig)
    return path
