"""Identification of detections against known small bodies.

A detection that cannot be matched to JPL / MPC objects is labelled
`Unmatched Candidate` (single detection) or `Uncatalogued Candidate` (linked
tracklet with consistent motion). Neither label claims a discovery: confirmation
requires follow-up astrometry and an orbit determination.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common import status
from ..common.config import settings
from ..common.geometry import angular_separation_deg
from ..common.http import DataAccessError
from .jpl_client import SBDBClient, SBIdentClient


@dataclass
class Detection:
    candidate_id: str
    mjd: float
    ra_deg: float
    dec_deg: float
    snr: float
    obs_id: str = ""
    band: str = ""
    image_url: str = ""


@dataclass
class IdentificationResult:
    candidate_id: str
    status: str                     # "Matched" | Unmatched Candidate | Uncatalogued Candidate
    matched_designation: str = ""
    jpl_registered: bool | None = None
    mpc_registered: bool | None = None
    offset_arcsec: float | None = None
    confidence: str = status.CONF_NONE
    needs_followup: bool = True
    notes: list = field(default_factory=list)


def compare_predicted_measured(pred_ra, pred_dec, meas_ra, meas_dec) -> float:
    return float(angular_separation_deg(pred_ra, pred_dec, meas_ra, meas_dec) * 3600.0)


def identification_confidence(offset_arcsec: float, snr: float) -> str:
    max_off = settings()["search"]["max_position_offset_arcsec"]
    if offset_arcsec is None or not np.isfinite(offset_arcsec):
        return status.CONF_NONE
    if offset_arcsec <= 0.5 * max_off and snr >= 10:
        return status.CONF_HIGH
    if offset_arcsec <= max_off and snr >= settings()["search"]["min_detection_snr"]:
        return status.CONF_MEDIUM
    return status.CONF_LOW


def identify_detection(det: Detection, parallax_margin_arcsec: float = 15.0) -> IdentificationResult:
    """Query JPL SB-Ident around a detection. The geocentric query radius is widened by
    the SPHEREx-geocentre parallax margin, then candidates are ranked by offset."""
    max_off = settings()["search"]["max_position_offset_arcsec"]
    try:
        df, _ = SBIdentClient().identify(det.ra_deg, det.dec_deg, det.mjd,
                                         radius_arcsec=max_off + parallax_margin_arcsec)
    except DataAccessError as err:
        return IdentificationResult(det.candidate_id, status.UNKNOWN,
                                    notes=[f"SB-Ident unavailable: {err}"])
    if df.empty:
        return IdentificationResult(det.candidate_id, status.UNMATCHED_CANDIDATE, jpl_registered=False,
                                    notes=["No known object within search radius (JPL SB-Ident). "
                                           "MPC cross-check and follow-up astrometry required."])
    name_col = next((c for c in df.columns if "Object name" in c or c.lower().startswith("object")), df.columns[0])
    ra_col = next((c for c in df.columns if "RA" in c), None)
    dec_col = next((c for c in df.columns if "Dec" in c or "DEC" in c), None)
    best = df.iloc[0]
    off = None
    if ra_col and dec_col:
        try:
            ra = _sexa_to_deg(str(best[ra_col]), hours=True)
            dec = _sexa_to_deg(str(best[dec_col]), hours=False)
            off = compare_predicted_measured(ra, dec, det.ra_deg, det.dec_deg)
        except ValueError:
            off = None
    conf = identification_confidence(off, det.snr) if off is not None else status.CONF_LOW
    return IdentificationResult(det.candidate_id, "Matched", matched_designation=str(best[name_col]).strip(),
                                jpl_registered=True, offset_arcsec=off, confidence=conf,
                                needs_followup=conf == status.CONF_LOW,
                                notes=["Geocentric SB-Ident match; offset includes SPHEREx parallax."])


def _sexa_to_deg(s: str, hours: bool) -> float:
    s = s.strip()
    sign = -1.0 if s.startswith("-") else 1.0
    parts = [float(p) for p in s.lstrip("+-").replace(":", " ").split()]
    if len(parts) == 1:
        return sign * parts[0]
    val = parts[0] + parts[1] / 60 + (parts[2] if len(parts) > 2 else 0) / 3600
    return sign * val * (15.0 if hours else 1.0)


def link_detections(dets: list[Detection], max_rate_arcsec_h: float = 300.0,
                    min_rate_arcsec_h: float = 0.5, max_dt_days: float = 2.0) -> list[list[Detection]]:
    """Greedy linking of unmatched detections into tracklets with approximately constant
    sky motion. Detections at the same position at different times are stationary sources
    and are not linked (min_rate)."""
    dets = sorted(dets, key=lambda d: d.mjd)
    used: set[str] = set()
    tracklets = []
    for a, b in itertools.combinations(dets, 2):
        if a.candidate_id in used or b.candidate_id in used:
            continue
        dt_h = (b.mjd - a.mjd) * 24
        if dt_h <= 0 or dt_h > max_dt_days * 24:
            continue
        rate = angular_separation_deg(a.ra_deg, a.dec_deg, b.ra_deg, b.dec_deg) * 3600 / dt_h
        if not (min_rate_arcsec_h <= rate <= max_rate_arcsec_h):
            continue
        track = [a, b]
        # extend with detections consistent with linear motion
        # A short track can cross RA=0 in either direction. Work with the signed
        # shortest angular displacement, never the discontinuity in stored RA.
        dra = (b.ra_deg - a.ra_deg + 180.0) % 360.0 - 180.0
        vra = dra / (b.mjd - a.mjd)
        vdec = (b.dec_deg - a.dec_deg) / (b.mjd - a.mjd)
        for c in dets:
            if c in track or c.candidate_id in used or c.mjd <= b.mjd:
                continue
            dtc = c.mjd - a.mjd
            pra = (a.ra_deg + vra * dtc) % 360.0
            pdec = a.dec_deg + vdec * dtc
            if angular_separation_deg(pra, pdec, c.ra_deg, c.dec_deg) * 3600 < 12.0:
                track.append(c)
        if len(track) >= 3:
            tracklets.append(track)
            used.update(d.candidate_id for d in track)
    return tracklets


def classify_unmatched(dets: list[Detection]) -> pd.DataFrame:
    """Return a table of candidates with status Unmatched / Uncatalogued Candidate."""
    tracks = link_detections(dets)
    in_track = {d.candidate_id: i for i, tr in enumerate(tracks) for d in tr}
    rows = []
    for d in dets:
        tid = in_track.get(d.candidate_id)
        rows.append({
            "candidate_id": d.candidate_id, "mjd": d.mjd, "ra_deg": d.ra_deg, "dec_deg": d.dec_deg,
            "snr": d.snr, "obs_id": d.obs_id, "band": d.band,
            "tracklet_id": f"TRK{tid:04d}" if tid is not None else "",
            "status": status.UNCATALOGUED_CANDIDATE if tid is not None else status.UNMATCHED_CANDIDATE,
            "jpl_registered": False, "mpc_registered": None, "needs_followup": True,
            "note": "Not a confirmed discovery; follow-up astrometry and orbit determination required.",
        })
    return pd.DataFrame(rows)


def resolve_identifiers(identifiers: list[str]):
    """Try several identifiers (number, name, provisional designation) in SBDB before
    concluding that an object is not registered."""
    client = SBDBClient()
    tried = []
    for ident in identifiers:
        rec = client.lookup(ident)
        tried.append((ident, rec.found, rec.message))
        if rec.found:
            return rec, tried
    return None, tried
