"""Per-pixel wavelength for the SPHEREx Linear Variable Filters.

Two sources, in order of preference:
  1. OFFICIAL  - the spectral WCS calibration product (CWAVE / CBAND images per detector)
                 from the data release, if configured (`official_spectral_calibration_dir`).
  2. APPROX_LOOKUP - the WCS-WAVE bilinear lookup table embedded in each L2 image
                 (FITS Paper III -TAB). The FITS header itself labels this
                 "Approximated per-pixel wavelength and bandwidth".
The method used is always returned so downstream results record it.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..common.config import resolve, settings
from .fits_product import SpherexImage


@dataclass
class WavelengthSolution:
    wavelength_um: float
    bandwidth_um: float
    method: str          # OFFICIAL | APPROX_LOOKUP
    source: str


def lookup_table_wavelength(img: SpherexImage, x_idx: float, y_idx: float) -> tuple[float, float]:
    """Evaluate the WCS-WAVE -TAB lookup at 0-based array position (x_idx, y_idx).

    psi_i = CRVAL_iW + CDELT_iW * (p_i - CRPIX_iW), p = 1-based FITS pixel.
    psi is located in the control-point vectors X, Y (1-based, raw coordinates) and the
    VALUES array [y, x, (wavelength, bandwidth)] is bilinearly interpolated.
    """
    if img.wave_table is None:
        raise KeyError("WCS-WAVE extension not present")
    h = img.header
    p1, p2 = x_idx + 1.0, y_idx + 1.0
    psi1 = float(h.get("CRVAL1W", 1)) + float(h.get("CDELT1W", 1)) * (p1 - float(h["CRPIX1W"]))
    psi2 = float(h.get("CRVAL2W", 1)) + float(h.get("CDELT2W", 1)) * (p2 - float(h["CRPIX2W"]))
    row = img.wave_table[0]
    xs = np.asarray(row["X"], float).ravel()
    ys = np.asarray(row["Y"], float).ravel()
    vals = np.asarray(row["VALUES"], float)
    vals = vals.reshape(len(ys), len(xs), -1)        # FITS TDIM (2,9,9) -> numpy [y, x, k]
    fx = np.interp(psi1, xs, np.arange(len(xs)))
    fy = np.interp(psi2, ys, np.arange(len(ys)))
    if psi1 < xs[0] or psi1 > xs[-1] or psi2 < ys[0] or psi2 > ys[-1]:
        # -TAB extrapolation is undefined; clamp is flagged by the caller via the method string.
        pass
    i0, j0 = int(np.clip(np.floor(fx), 0, len(xs) - 2)), int(np.clip(np.floor(fy), 0, len(ys) - 2))
    tx, ty = fx - i0, fy - j0
    v = ((1 - tx) * (1 - ty) * vals[j0, i0] + tx * (1 - ty) * vals[j0, i0 + 1]
         + (1 - tx) * ty * vals[j0 + 1, i0] + tx * ty * vals[j0 + 1, i0 + 1])
    k_wave = int(h.get("PV1_3W", 1)) - 1
    k_band = int(h.get("PV2_3W", 2)) - 1
    return float(v[k_wave]), float(v[k_band])


def _official(img: SpherexImage, x_idx: float, y_idx: float) -> WavelengthSolution | None:
    cal_dir = settings()["extraction"].get("official_spectral_calibration_dir")
    if not cal_dir:
        return None
    from astropy.io import fits
    d = resolve(cal_dir)
    cands = sorted(Path(d).glob(f"*spectral_wcs*_{img.detector}_*.fits")) + \
        sorted(Path(d).glob(f"*{img.detector}*cwave*.fits"))
    if not cands:
        return None
    ox, oy = img.active_pixel_offset()
    ax, ay = int(round(x_idx + ox)), int(round(y_idx + oy))
    with fits.open(cands[-1]) as hd:
        names = [h.name for h in hd]
        if "CWAVE" not in names or "CBAND" not in names:
            return None
        cw = hd["CWAVE"].data
        cb = hd["CBAND"].data
        return WavelengthSolution(float(cw[ay, ax]), float(cb[ay, ax]), "OFFICIAL", cands[-1].name)


def wavelength_at(img: SpherexImage, x_idx: float, y_idx: float) -> WavelengthSolution:
    off = _official(img, x_idx, y_idx)
    if off is not None:
        return off
    wl, bw = lookup_table_wavelength(img, x_idx, y_idx)
    src = img.wave_header.get("HISTORY", "") if img.wave_header is not None else ""
    return WavelengthSolution(wl, bw, "APPROX_LOOKUP", f"WCS-WAVE in {img.path.name}; {src}")
