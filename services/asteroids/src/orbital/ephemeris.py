"""Ephemeris and observing geometry (JPL Horizons). Geometry for photometry epochs uses
the observatory code when available (topocentric), else the geocentre."""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..acquisition.jpl_client import HorizonsClient, align_ephemeris_epochs


def geometry_for_epochs(designation: str, mjd, spkid: str | None = None,
                        observatory_codes=None) -> tuple[pd.DataFrame, list]:
    """Return r_au, delta_au, phase_deg for each epoch (same order as input)."""
    hz = HorizonsClient()
    mjd = np.atleast_1d(np.asarray(mjd, float))
    if mjd.ndim != 1 or not np.isfinite(mjd).all():
        raise ValueError("Photometry epochs must be a finite one-dimensional MJD list.")
    out = pd.DataFrame({"mjd": mjd, "r_au": np.nan, "delta_au": np.nan, "phase_deg": np.nan})
    sources = []
    codes = (np.asarray(observatory_codes, dtype=str) if observatory_codes is not None
             else np.array(["500"] * len(mjd)))
    if codes.ndim != 1 or len(codes) != len(mjd):
        raise ValueError("Every photometry epoch must have one observatory code.")
    for code in np.unique(codes):
        idx = np.where(codes == code)[0]
        center = f"{code.strip()}@399" if code.strip() and code.strip() not in ("500", "nan") else "500@399"
        try:
            eph = hz.observer_ephemeris(designation, mjd[idx], center=center, spkid=spkid)
        except Exception:  # unknown site code -> geocentre
            eph = hz.observer_ephemeris(designation, mjd[idx], center="500@399", spkid=spkid)
        sources.append(eph.source)
        t = align_ephemeris_epochs(eph.table, mjd[idx])
        out.loc[idx, "r_au"] = t["r_au"].values
        out.loc[idx, "delta_au"] = t["delta_au"].values
        out.loc[idx, "phase_deg"] = t["phase_deg"].values
    return out, sources
