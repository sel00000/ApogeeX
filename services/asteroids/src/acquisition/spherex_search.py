"""Stage 1: find SPHEREx exposures containing a (known) asteroid.

Workflow
  1. Resolve the object in JPL SBDB (designation, SPK-ID, orbit solution).
  2. Ask IRSA MOST which SPHEREx exposures intersect the predicted path.
  3. Recompute the position at each exposure mid-time with JPL Horizons, using the
     SPHEREx spacecraft as observer (Horizons centre 500@-163182). This removes the
     Earth-orbit parallax (~10 arcsec at 1 au) that a geocentric ephemeris would leave.
  4. Verify that the refined position falls inside the detector footprint.
Fixed-source catalogue matching is never used for moving objects.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common.config import settings
from ..common.constants import band_for_detector
from ..common.geometry import point_in_polygon
from ..common.http import DataAccessError
from ..common.provenance import DataSource, Provenance
from .irsa_client import IrsaClient
from .jpl_client import HorizonsClient, SBDBClient, SBDBRecord


@dataclass
class SearchResult:
    designation: str
    sbdb: SBDBRecord
    observations: pd.DataFrame
    provenance: Provenance
    messages: list = field(default_factory=list)


def _detector_from_row(row) -> int:
    for key in ("planeid", "productid", "uri"):
        val = str(row.get(key, ""))
        if key == "productid" and val.startswith("D") and val[1:].isdigit():
            return int(val[1:])
    uri = str(row.get("uri", ""))
    # .../l2b-v27-2026-213/6/level2_..._1D6_spx_...
    try:
        return int(uri.split("/")[-2])
    except (ValueError, IndexError):
        return -1


def search_known_asteroid(designation: str, obs_begin: str, obs_end: str,
                          refine_with_horizons: bool = True) -> SearchResult:
    cfg = settings()["search"]
    prov = Provenance(step="spherex_search", model_version=settings()["project"]["model_version"],
                      inputs={"designation": designation, "obs_begin": obs_begin, "obs_end": obs_end},
                      assumptions={"observer_center": cfg["observer_center"],
                                   "ephemeris_step_days": cfg["ephemeris_step_days"]})
    sbdb = SBDBClient().lookup(designation)
    if sbdb.source:
        prov.add_source(sbdb.source)
    messages = []
    if not sbdb.found:
        messages.append(f"SBDB lookup failed for '{designation}': {sbdb.message}. "
                        "This does not imply the object is uncatalogued; try other identifiers or the MPC.")
        return SearchResult(designation, sbdb, pd.DataFrame(), prov, messages)

    irsa = IrsaClient()
    most, src = irsa.most_query(naifid=sbdb.spkid, obs_begin=obs_begin, obs_end=obs_end,
                                ephem_step=cfg["ephemeris_step_days"])
    prov.add_source(src)
    if most.empty:
        messages.append("MOST found no SPHEREx exposures intersecting the predicted path.")
        return SearchResult(designation, sbdb, pd.DataFrame(), prov, messages)

    obs = pd.DataFrame({
        "obs_id": most["observationid"],
        "detector": [_detector_from_row(r) for _, r in most.iterrows()],
        "mjd_start": most["mjd_start"], "mjd_end": most["mjd_end"],
        "mjd_mid": 0.5 * (most["mjd_start"] + most["mjd_end"]),
        "exposure_s": most["exposure_time"],
        "most_ra_deg": most["ra_obj"], "most_dec_deg": most["dec_obj"],
        "image_url": [irsa.image_url(u) for u in most["uri"]],
        "corners": [list(zip([r[f"ra{k}"] for k in range(1, 5)], [r[f"dec{k}"] for k in range(1, 5)]))
                    for _, r in most.iterrows()],
        "most_vmag": most["vmag"],
    })
    obs["band"] = [band_for_detector(d) for d in obs["detector"]]

    if refine_with_horizons:
        hz = HorizonsClient()
        try:
            eph = hz.observer_ephemeris(designation, obs["mjd_mid"].values,
                                        center=cfg["observer_center"], spkid=sbdb.spkid)
            prov.add_source(eph.source)
            t = eph.table.reset_index(drop=True)
            obs["pred_ra_deg"] = t["ra_deg"].values
            obs["pred_dec_deg"] = t["dec_deg"].values
            obs["rate_ra_arcsec_h"] = t["dra_cosdec_arcsec_h"].values
            obs["rate_dec_arcsec_h"] = t["ddec_arcsec_h"].values
            obs["r_au"] = t["r_au"].values
            obs["delta_au"] = t["delta_au"].values
            obs["phase_deg"] = t["phase_deg"].values
            obs["pred_vmag"] = t["vmag"].values
            obs["ephemeris_source"] = f"JPL Horizons center={cfg['observer_center']} orbit_id={sbdb.orbit_id}"
        except DataAccessError as err:
            prov.warn(f"Horizons refinement failed ({err}); MOST positions used without SPHEREx-centred refinement.")
            for c, m in (("pred_ra_deg", "most_ra_deg"), ("pred_dec_deg", "most_dec_deg")):
                obs[c] = obs[m]
            obs["ephemeris_source"] = "IRSA MOST (not refined)"
    else:
        obs["pred_ra_deg"], obs["pred_dec_deg"] = obs["most_ra_deg"], obs["most_dec_deg"]
        obs["ephemeris_source"] = "IRSA MOST"

    obs["inside_footprint"] = [point_in_polygon(r.pred_ra_deg, r.pred_dec_deg,
                                                [c[0] for c in r.corners], [c[1] for c in r.corners])
                               for r in obs.itertuples()]
    n_out = int((~obs["inside_footprint"]).sum())
    if n_out:
        prov.warn(f"{n_out} exposures listed by MOST have the refined position outside the footprint; kept but flagged.")
    obs["designation"] = sbdb.designation
    obs["sbdb_registered"] = True
    obs["orbit_solution"] = f"JPL {sbdb.orbit_source} orbit_id={sbdb.orbit_id}"
    # Duplicate observations of the same object (same exposure listed twice) are dropped.
    obs = obs.drop_duplicates(subset=["obs_id", "detector"]).reset_index(drop=True)
    return SearchResult(designation, sbdb, obs, prov, messages)


def save_search_result(res: SearchResult, out_csv: str) -> None:
    df = res.observations.copy()
    if "corners" in df:
        df["corners"] = df["corners"].astype(str)
    df.to_csv(out_csv, index=False)
