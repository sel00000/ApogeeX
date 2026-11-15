"""Linking detections across epochs.

Known objects: observations are linked by designation (Stage 1 ephemeris search).
Unknown detections: linear-motion tracklets (see acquisition.asteroid_identification).
An orbit is NOT fitted here; candidate tracklets are exported in MPC-style form for an
external orbit-determination service, as required before any discovery claim.
"""
from __future__ import annotations

import pandas as pd

from ..acquisition.asteroid_identification import Detection, classify_unmatched, link_detections  # noqa: F401


def motion_summary(observations: pd.DataFrame) -> pd.DataFrame:
    """Per-exposure motion of a known object (from the ephemeris), and total arc."""
    cols = [c for c in ("obs_id", "detector", "mjd_mid", "pred_ra_deg", "pred_dec_deg",
                        "rate_ra_arcsec_h", "rate_dec_arcsec_h") if c in observations]
    df = observations[cols].sort_values("mjd_mid").copy()
    if {"rate_ra_arcsec_h", "rate_dec_arcsec_h"} <= set(df):
        df["rate_total_arcsec_h"] = (df["rate_ra_arcsec_h"] ** 2 + df["rate_dec_arcsec_h"] ** 2) ** 0.5
    return df


def export_tracklet_ades_like(track: list[Detection]) -> pd.DataFrame:
    return pd.DataFrame([{"trkSub": track[0].candidate_id, "obsTime_mjd": d.mjd, "ra": d.ra_deg, "dec": d.dec_deg,
                          "snr": d.snr, "obs_id": d.obs_id, "band": d.band} for d in track])
