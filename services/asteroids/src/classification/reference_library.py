"""Reference spectra and their transformation to SPHEREx sampling.

The Bus-DeMeo class means (DeMeo et al. 2009) cover 0.45-2.45 um, normalised at 0.55 um.
SPHEREx starts at 0.75 um, so for comparison every reference spectrum is
  1. convolved with a Gaussian of FWHM = lambda / R_SPHEREx,
  2. interpolated onto the observed wavelengths inside the overlap (0.75-2.45 um),
  3. renormalised at the SPHEREx normalisation wavelength (default 1.25 um).
Bus-DeMeo PCA coefficients and boundaries are NOT reused, because they rely on the
visible part of the spectrum.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import resolve, settings

COMPLEXES = {
    "C-complex": ["B", "C", "Cb", "Cg", "Cgh", "Ch"],
    "S-complex": ["S", "Sa", "Sq", "Sr", "Sv"],
    "X-complex": ["X", "Xc", "Xe", "Xk", "Xn"],
}
END_MEMBERS = ["A", "D", "K", "L", "O", "Q", "R", "T", "V"]


def complex_of(cls: str) -> str:
    for cx, members in COMPLEXES.items():
        if cls in members:
            return cx
    return f"{cls}-type" if cls in END_MEMBERS else "Other"


@dataclass
class ReferenceSpectrum:
    name: str
    wavelength_um: np.ndarray
    reflectance: np.ndarray
    sigma: np.ndarray | None
    source: str


def load_busdemeo(path: str | None = None) -> dict[str, ReferenceSpectrum]:
    path = resolve(path or settings()["classification"]["reference_library"])
    prov_path = Path(str(path).replace(".csv", ".provenance.json"))
    if not prov_path.exists():
        raise FileNotFoundError(f"Reference library {path} has no provenance file; refusing to use it.")
    prov = json.loads(prov_path.read_text())
    df = pd.read_csv(path)
    lam = df["Wavelength"].values.astype(float)
    out = {}
    for col in df.columns:
        if not col.endswith("_Mean"):
            continue
        name = col[:-5]
        sig = df.get(f"{name}_Sigma")
        sig = None if sig is None or (sig.values <= -0.9).all() else np.where(sig.values < 0, np.nan, sig.values)
        out[name] = ReferenceSpectrum(name, lam, df[col].values.astype(float), sig,
                                      f"{prov['reference']} ({prov['source_url']})")
    return out


def convolve_to_resolution(lam, refl, R: float, lam_out):
    """Gaussian smoothing to resolving power R evaluated at lam_out."""
    lam, refl = np.asarray(lam, float), np.asarray(refl, float)
    out = np.empty(len(lam_out))
    fine = np.linspace(lam.min(), lam.max(), 2000)
    rf = np.interp(fine, lam, refl)
    for i, l0 in enumerate(lam_out):
        s = l0 / R / 2.3548
        w = np.exp(-0.5 * ((fine - l0) / s) ** 2)
        out[i] = np.sum(w * rf) / np.sum(w)
    return out


def resample_reference(ref: ReferenceSpectrum, lam_obs, R: float, lam_norm: float):
    lam_obs = np.asarray(lam_obs, float)
    inside = (lam_obs >= ref.wavelength_um.min()) & (lam_obs <= ref.wavelength_um.max())
    r = np.full(len(lam_obs), np.nan)
    s = np.full(len(lam_obs), np.nan)
    if inside.any():
        r[inside] = convolve_to_resolution(ref.wavelength_um, ref.reflectance, R, lam_obs[inside])
        if ref.sigma is not None and np.isfinite(ref.sigma).any():
            sg = np.where(np.isfinite(ref.sigma), ref.sigma, np.nanmedian(ref.sigma))
            s[inside] = np.interp(lam_obs[inside], ref.wavelength_um, sg)
    norm = convolve_to_resolution(ref.wavelength_um, ref.reflectance, R, [lam_norm])[0]
    return r / norm, s / norm, inside


def sigma_decomposition(ref: ReferenceSpectrum, window=(0.75, 2.45)):
    """Split the published intra-class sigma (DeMeo et al. 2009 class means, normalised at 0.55 um)
    into a slope-like part and a residual shape part:
        sigma(l) ~ a + b (l - 0.55)
    Member spectra differ mostly by slope, so sigma grows linearly away from the 0.55-um
    normalisation point. When scale and slope are fitted freely, only the residual part is shape
    variance. Returns (shape_sigma_abs, slope_sigma_abs_per_um) in 0.55-normalised units, or
    (None, None) if the class has no published sigma."""
    if ref.sigma is None:
        return None, None
    m = (ref.wavelength_um >= window[0]) & (ref.wavelength_um <= window[1]) & np.isfinite(ref.sigma)
    if m.sum() < 5:
        return None, None
    x = ref.wavelength_um[m] - 0.55
    A = np.vstack([np.ones_like(x), x]).T
    (a, b), *_ = np.linalg.lstsq(A, ref.sigma[m], rcond=None)
    resid = ref.sigma[m] - A @ np.array([a, b])
    shape = float(np.sqrt(max(a, 0.0) ** 2 + np.mean(resid ** 2)))
    return shape, float(max(b, 0.0))
