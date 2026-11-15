"""Stage 1 for fixed (sidereal) sources, e.g. the solar-analog calibration stars.

A star's position comes from an astrometric catalogue, not from an orbit:
  1. Gaia DR3 astrometry (position at epoch J2016.0, proper motion) by source_id, from the IRSA TAP
     copy of gaia_dr3_source;
  2. SPHEREx L2 images whose footprint (ObsCore s_region) contains the source (IRSA TAP);
  3. the science-file URL of each image (IVOA DataLink of the ObsCore row, semantics '#this');
  4. the position propagated to each exposure mid-time with the proper motion. Parallax is
     neglected (< 0.03 arcsec for the calibration stars, against 6.2-arcsec pixels).
The output has the same columns as the asteroid search (src/acquisition/spherex_search.py), so stars
and asteroids go through the same forced-photometry code (src/extraction/spectral_extraction.py).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common.config import settings
from ..common.constants import band_for_detector
from ..common.geometry import parse_stc_polygon, point_in_polygon
from ..common.provenance import DataSource, Provenance
from .irsa_client import IrsaClient

GAIA_DR3_EPOCH_MJD = 57388.5          # J2016.0 (Gaia DR3 reference epoch)
MAS_PER_DEG = 3.6e6


@dataclass
class FixedSourceSearch:
    name: str
    astrometry: dict
    observations: pd.DataFrame
    provenance: Provenance
    messages: list = field(default_factory=list)


def gaia_dr3_astrometry(source_ids, client: IrsaClient | None = None) -> tuple[pd.DataFrame, DataSource]:
    """Gaia DR3 astrometry and photometry for the given source_ids (IRSA TAP)."""
    client = client or IrsaClient()
    ids = ", ".join(str(int(s)) for s in source_ids)
    adql = ("SELECT source_id, ra, dec, pmra, pmdec, parallax, ref_epoch, phot_g_mean_mag, bp_rp, ruwe "
            f"FROM gaia_dr3_source WHERE source_id IN ({ids})")
    df, src = client.tap_query(adql)
    src.name = "Gaia DR3 (gaia_dr3_source via IRSA TAP)"
    src.version = "Gaia DR3"
    return df, src


def propagate_position(ra_deg, dec_deg, pmra_mas_yr, pmdec_mas_yr, mjd, ref_mjd=GAIA_DR3_EPOCH_MJD):
    """Linear proper-motion propagation (pmra includes cos(dec), as in Gaia). Accurate to << 0.1 arcsec
    over a decade for |pm| < 1 arcsec/yr."""
    dt_yr = (np.asarray(mjd, float) - ref_mjd) / 365.25
    pmra = 0.0 if pmra_mas_yr is None or not np.isfinite(pmra_mas_yr) else float(pmra_mas_yr)
    pmdec = 0.0 if pmdec_mas_yr is None or not np.isfinite(pmdec_mas_yr) else float(pmdec_mas_yr)
    dec = dec_deg + pmdec * dt_yr / MAS_PER_DEG
    ra = ra_deg + pmra * dt_yr / MAS_PER_DEG / np.cos(np.radians(dec_deg))
    return np.mod(ra, 360.0), dec


def _datalink_this(xml: str | bytes) -> str | None:
    """access_url of the '#this' (science file) row of an IVOA DataLink response."""
    import io

    from astropy.io.votable import parse
    vot = parse(io.BytesIO(xml if isinstance(xml, bytes) else xml.encode()))
    for res in vot.resources:
        for tab in res.tables:
            t = tab.to_table(use_names_over_ids=True)      # IRSA field IDs are col_N; names are standard
            if "semantics" not in t.colnames or "access_url" not in t.colnames:
                continue
            for sem, url in zip(t["semantics"], t["access_url"]):
                if str(sem).strip() == "#this" and str(url).startswith("http"):
                    return str(url).strip()
    return None


def image_paths(access_urls: dict, workers: int | None = None) -> tuple[dict, DataSource]:
    """{obs_publisher_did: ObsCore access_url (a DataLink service URL)} -> {did: science-image URL}.
    One DataLink request per image (about 0.5 s each), run concurrently. A CAOM plane/artifact join in
    TAP gives the same paths but took over a minute per query on 2026-11-14."""
    from concurrent.futures import ThreadPoolExecutor

    from ..common.http import DataAccessError, request
    workers = workers or int(settings()["extraction"].get("download_workers", 1))

    def one(item):
        did, url = item
        try:
            return did, _datalink_this(request("GET", url, timeout=120, binary=True))
        except (DataAccessError, ValueError, KeyError):
            return did, None

    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        out = {d: u for d, u in ex.map(one, list(access_urls.items())) if u}
    example = next(iter(access_urls.values()), "")
    src = DataSource(name="IRSA DataLink (SPHEREx science-image URLs)", url=example.split("?")[0],
                     query=f"{len(access_urls)} DataLink requests, semantics '#this'")
    return out, src


def search_fixed_source(name: str, ra_deg: float, dec_deg: float, start_mjd: float, end_mjd: float,
                        pmra_mas_yr: float | None = None, pmdec_mas_yr: float | None = None,
                        ref_mjd: float = GAIA_DR3_EPOCH_MJD, collection: str | None = None,
                        max_images: int | None = None, client: IrsaClient | None = None) -> FixedSourceSearch:
    """Images containing the source. With max_images, a detector- and time-balanced subset of the
    images inside the footprint is chosen BEFORE the file URLs are resolved (stars near the ecliptic
    poles have thousands of DR1 images)."""
    client = client or IrsaClient()
    collection = collection or settings()["search"]["default_collection"]
    prov = Provenance(step="fixed_source_search", model_version=settings()["project"]["model_version"],
                      inputs={"name": name, "ra_deg": ra_deg, "dec_deg": dec_deg, "pmra_mas_yr": pmra_mas_yr,
                              "pmdec_mas_yr": pmdec_mas_yr, "ref_epoch_mjd": ref_mjd, "start_mjd": start_mjd,
                              "end_mjd": end_mjd, "collection": collection, "max_images": max_images},
                      formula="position(t) = position(ref) + pm * (t - ref); parallax neglected")
    astrom = {"ra_deg": ra_deg, "dec_deg": dec_deg, "pmra_mas_yr": pmra_mas_yr, "pmdec_mas_yr": pmdec_mas_yr,
              "ref_epoch_mjd": ref_mjd}
    mid = 0.5 * (start_mjd + end_mjd)
    ra_m, dec_m = propagate_position(ra_deg, dec_deg, pmra_mas_yr, pmdec_mas_yr, mid, ref_mjd)
    imgs, src = client.images_at_position(float(ra_m), float(dec_m), mjd_min=start_mjd, mjd_max=end_mjd,
                                          collection=collection)
    prov.add_source(src)
    messages = []
    if imgs.empty:
        messages.append(f"No {collection} images contain {name} between MJD {start_mjd:.1f} and {end_mjd:.1f}.")
        return FixedSourceSearch(name, astrom, pd.DataFrame(), prov, messages)
    imgs = imgs[imgs["calib_level"] == 2] if "calib_level" in imgs else imgs
    det = imgs["energy_bandpassname"].astype(str).str.extract(r"D(\d)")[0].astype(float)
    mjd = 0.5 * (imgs["t_min"].values + imgs["t_max"].values)
    ra_t, dec_t = propagate_position(ra_deg, dec_deg, pmra_mas_yr, pmdec_mas_yr, mjd, ref_mjd)
    obs = pd.DataFrame({
        "obs_id": imgs["obs_id"].values,
        "detector": det.fillna(-1).astype(int).values,
        "mjd_start": imgs["t_min"].values, "mjd_end": imgs["t_max"].values, "mjd_mid": mjd,
        "exposure_s": imgs["t_exptime"].values,
        "obs_publisher_did": imgs["obs_publisher_did"].values,
        "access_url": imgs["access_url"].values,
        "pred_ra_deg": ra_t, "pred_dec_deg": dec_t,
        "rate_ra_arcsec_h": 0.0, "rate_dec_arcsec_h": 0.0,
        "s_region": imgs["s_region"].values,
    })
    obs["band"] = [band_for_detector(d) for d in obs["detector"]]
    inside = []
    for r in obs.itertuples():
        try:
            pra, pdec = parse_stc_polygon(r.s_region)
            inside.append(point_in_polygon(r.pred_ra_deg, r.pred_dec_deg, pra, pdec))
        except (ValueError, TypeError):
            inside.append(False)
    obs["inside_footprint"] = inside
    obs = obs.drop_duplicates(subset=["obs_id", "detector"]).sort_values("mjd_mid").reset_index(drop=True)
    n_all, n_in = len(obs), int(obs["inside_footprint"].sum())
    obs = balanced_subset(obs[obs["inside_footprint"]], max_images)
    if len(obs) < n_in:
        messages.append(f"{n_all} images found ({n_in} with the source inside the footprint); "
                        f"{len(obs)} chosen (balanced over detectors and time).")
    paths, psrc = image_paths(dict(zip(obs["obs_publisher_did"], obs["access_url"])))
    prov.add_source(psrc)
    obs["image_url"] = [client.image_url(paths[d]) if d in paths else None for d in obs["obs_publisher_did"]]
    n_nourl = int(obs["image_url"].isna().sum())
    if n_nourl:
        prov.warn(f"{n_nourl} images without a science-file URL in their DataLink record were dropped.")
    obs = obs[obs["image_url"].notna()].reset_index(drop=True)
    obs["designation"] = name
    obs["ephemeris_source"] = "Gaia DR3 astrometry, linear proper-motion propagation"
    return FixedSourceSearch(name, astrom, obs, prov, messages)


def balanced_subset(obs: pd.DataFrame, max_images: int | None, seed: int = 0) -> pd.DataFrame:
    """At most max_images rows, spread evenly over detectors and, within a detector, over time
    (every k-th exposure), so that the wavelength coverage of each band is preserved."""
    if max_images is None or len(obs) <= max_images:
        return obs.reset_index(drop=True)
    dets = sorted(obs["detector"].unique())
    per = max(1, max_images // len(dets))
    parts = []
    for d in dets:
        g = obs[obs["detector"] == d].sort_values("mjd_mid")
        if len(g) > per:
            idx = np.unique(np.linspace(0, len(g) - 1, per).round().astype(int))
            g = g.iloc[idx]
        parts.append(g)
    return pd.concat(parts).sort_values("mjd_mid").reset_index(drop=True)
