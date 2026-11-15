"""SPHEREx effective PSF (EPSF) handling.

The PSF extension tabulates oversampled PSFs (OVSMPX x OVSMPY, here 5x5) per detector
zone, with zone centres XCENTER/YCENTER in detector (active-pixel) coordinates.
"""
from __future__ import annotations

import numpy as np


def select_psf(img, x_active: float, y_active: float):
    """Return (oversampled psf, oversampling, zone info) for the zone closest to the target."""
    tab = img.psf_table
    if tab is None:
        raise KeyError("No PSF extension in image")
    d2 = (np.asarray(tab["XCENTER"]) - x_active) ** 2 + (np.asarray(tab["YCENTER"]) - y_active) ** 2
    k = int(np.argmin(d2))
    psf = np.asarray(tab["EPSF"][k], float)
    n = int(round(np.sqrt(psf.size)))
    psf = psf.reshape(n, n)
    ovs = int(img.psf_header.get("OVSMPX", 5))
    info = {"zone_index": k, "xcenter": float(tab["XCENTER"][k]), "ycenter": float(tab["YCENTER"][k]),
            "distance_pix": float(np.sqrt(d2[k])), "oversampling": ovs}
    for col in ("CWAVE", "CBAND"):
        if col in tab.columns.names:
            info[col.lower() + "_um"] = float(tab[col][k])
    return psf, ovs, info


def native_psf_stamp(psf_os: np.ndarray, ovs: int, dx: float, dy: float, size: int) -> np.ndarray:
    """Native-pixel model of a point source from an oversampled *effective* PSF (ePSF).

    The SPHEREx EPSF (Anderson & King 2000 convention, as built by photutils' EPSFBuilder) is
    already integrated over the pixel response: its value at sub-pixel offset (u, v) is the
    fraction of flux falling in a native pixel whose centre lies (u, v) from the source.
    The model is therefore obtained by SAMPLING the ePSF at native-pixel centres (bicubic
    interpolation between oversampled nodes), not by summing sub-samples - summing would
    integrate over the pixel a second time and broaden the model (found on real DR1 data:
    ~10% flux deficit and chi2_red ~100 for bright sources).

    Normalisation: an ePSF sampled on any native-pixel grid sums to ~1, so the oversampled
    array sums to ~ovs^2; we divide by sum/ovs^2. The stamp sum is the fraction of flux
    inside the stamp. (dx, dy): source offset from the centre of the stamp's central pixel.
    """
    from scipy.ndimage import map_coordinates

    psf = np.nan_to_num(np.asarray(psf_os, float)) / (np.nansum(psf_os) / ovs ** 2)
    n = psf.shape[0]
    c = (n - 1) / 2.0                      # centre node of the oversampled ePSF
    half = size // 2
    off = np.arange(size) - half
    yy, xx = np.meshgrid(off - dy, off - dx, indexing="ij")   # pixel centre minus source position
    coords = np.vstack([(c + yy * ovs).ravel(), (c + xx * ovs).ravel()])
    stamp = map_coordinates(psf, coords, order=3, mode="constant", cval=0.0).reshape(size, size)
    return np.clip(stamp, 0.0, None)
