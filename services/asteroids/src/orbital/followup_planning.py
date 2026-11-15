"""Follow-up observation requirements, independent of any specific facility.

The plan states WHAT is needed (filters, cadence, phase-angle range, depth, sky position
and visibility windows) so that any suitable facility can be selected afterwards.
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from ..acquisition.jpl_client import HorizonsClient


def plan_photometric_followup(designation: str, days: int = 120, spkid: str | None = None,
                              min_elongation_deg: float = 60.0, snr_goal: float = 30.0) -> dict:
    start = dt.date.today()
    stop = start + dt.timedelta(days=days)
    eph = HorizonsClient().range_ephemeris(designation, start.isoformat(), stop.isoformat(), "1d",
                                           center="500@399", spkid=spkid)
    t = eph.table
    vis = t[t.get("elongation_deg", pd.Series(180, index=t.index)) >= min_elongation_deg]
    out = {
        "designation": designation,
        "window": f"{start} to {stop}",
        "ephemeris_source": eph.source.to_dict(),
        "requirements": [
            "Calibrated photometry in V or a filter with a verified transformation to V.",
            "Multiple nights spanning >= 10 deg of phase angle; include alpha < 7 deg if reachable.",
            "Within each night, sampling sufficient to average or model the rotational lightcurve.",
            f"Per-point S/N >= {snr_goal:.0f} (sigma_m <~ {1.0857 / snr_goal:.3f} mag).",
            "Non-sidereal tracking or exposure times short enough to avoid trailing beyond the seeing.",
            "Avoid crowded stellar fields; check for background contamination at each epoch.",
        ],
        "facility_selection": "Any facility able to reach the predicted magnitude at the required S/N "
                              "during the visibility windows below; none is pre-selected.",
    }
    if vis.empty:
        out["visibility"] = "Not observable above the elongation limit in this window."
        return out
    out["visibility"] = {
        "n_days": int(len(vis)),
        "first_mjd": float(vis["mjd"].min()), "last_mjd": float(vis["mjd"].max()),
        "vmag_range": [float(np.nanmin(vis["vmag"])), float(np.nanmax(vis["vmag"]))],
        "phase_range_deg": [float(vis["phase_deg"].min()), float(vis["phase_deg"].max())],
        "dec_range_deg": [float(vis["dec_deg"].min()), float(vis["dec_deg"].max())],
    }
    out["table"] = vis[["mjd", "ra_deg", "dec_deg", "vmag", "r_au", "delta_au", "phase_deg"]
                       + (["elongation_deg"] if "elongation_deg" in vis else [])].to_dict("records")
    return out
