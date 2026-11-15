"""Pixel and measurement quality based on the FLAGS bitmask and VARIANCE."""
from __future__ import annotations

import numpy as np

from ..common import status
from ..common.config import settings


def mask_from_names(flag_planes: dict, names: list[str]) -> int:
    m = 0
    for n in names:
        if n in flag_planes:
            m |= int(flag_planes[n])
    return m


def bad_pixel_mask(img, for_moving_target_core: bool = False) -> np.ndarray:
    """True where a pixel must not be used. With for_moving_target_core=True, flags that a moving
    object raises by itself (moving_object_flags, e.g. OUTLIER) are not treated as defects."""
    cfg = settings()["extraction"]
    names = list(cfg["reject_flags"])
    if for_moving_target_core:
        names = [n for n in names if n not in cfg.get("moving_object_flags", [])]
    reject = mask_from_names(img.flag_planes, names)
    bad = (img.flags & reject) != 0
    bad |= ~np.isfinite(img.image) | ~np.isfinite(img.variance) | (img.variance <= 0)
    return bad


def warn_pixel_mask(img) -> np.ndarray:
    cfg = settings()["extraction"]
    warn = mask_from_names(img.flag_planes, cfg["warn_flags"])
    return (img.flags & warn) != 0


def decode_flags(value: int, flag_planes: dict) -> list[str]:
    return [name for name, bit in flag_planes.items() if int(value) & int(bit)]


def measurement_quality(n_bad_core: int, n_warn_core: int, snr: float, fit_ok: bool,
                        trailed: bool) -> tuple[str, list[str]]:
    reasons = []
    if not fit_ok:
        reasons.append("PSF fit failed")
    if n_bad_core > 0:
        reasons.append(f"{n_bad_core} rejected pixel(s) in PSF core")
    if n_warn_core > 0:
        reasons.append(f"{n_warn_core} pixel(s) in PSF core flagged (e.g. SOURCE/ghost): possible contamination")
    if trailed:
        reasons.append("object trailed during exposure")
    if not np.isfinite(snr) or snr < 3:
        reasons.append("SNR < 3")
    if not fit_ok or n_bad_core > 2 or not np.isfinite(snr):
        return status.Q_BAD, reasons
    if reasons:
        return status.Q_WARN, reasons
    return status.Q_GOOD, reasons
