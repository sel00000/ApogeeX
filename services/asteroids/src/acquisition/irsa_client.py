"""IRSA access: SPHEREx ObsCore (TAP), Moving Object Search Tool (MOST), image cutouts."""
from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import data_sources, resolve
from ..common.http import DataAccessError, request
from ..common.provenance import DataSource


class IrsaClient:
    def __init__(self):
        cfg = data_sources()["irsa"]
        self.cfg = cfg
        self.timeout = cfg.get("timeout_s", 300)

    # ------------------------------------------------------------------ TAP
    def tap_query(self, adql: str) -> tuple[pd.DataFrame, DataSource]:
        text = request("POST", self.cfg["tap_sync_url"],
                       data={"QUERY": adql, "FORMAT": "csv", "LANG": "ADQL", "REQUEST": "doQuery"},
                       timeout=self.timeout)
        if text.lstrip().startswith("<"):
            raise DataAccessError("TAP error: " + text[:500])
        df = pd.read_csv(io.StringIO(text))
        src = DataSource(name="IRSA TAP", url=self.cfg["tap_sync_url"], query=adql)
        return df, src

    def images_at_position(self, ra: float, dec: float, mjd_min: float | None = None,
                           mjd_max: float | None = None, collection: str | None = None):
        """SPHEREx images whose footprint contains a fixed sky position."""
        where = [f"CONTAINS(POINT('ICRS', {ra:.7f}, {dec:.7f}), s_region)=1"]
        if collection:
            where.append(f"obs_collection='{collection}'")
        if mjd_min is not None:
            where.append(f"t_min >= {mjd_min:.6f}")
        if mjd_max is not None:
            where.append(f"t_max <= {mjd_max:.6f}")
        adql = ("SELECT obs_id, obs_collection, energy_bandpassname, em_min, em_max, t_min, t_max, "
                "t_exptime, s_region, access_url, calib_level, obs_publisher_did "
                f"FROM {self.cfg['obscore_table']} WHERE " + " AND ".join(where))
        return self.tap_query(adql)

    # ----------------------------------------------------------------- MOST
    def most_query(self, *, naifid: str | None = None, name: str | None = None,
                   obs_begin: str, obs_end: str, ephem_step: float = 0.25,
                   mpc_data: str | None = None, obj_type: str = "Asteroid"):
        """Run MOST against the SPHEREx catalogue. Returns one row per (exposure, detector)
        intersecting the predicted path, with MOST's object position and geometry."""
        data = {"catalog": self.cfg.get("most_catalog", "spherex"), "output_mode": "Brief",
                "obs_begin": obs_begin, "obs_end": obs_end, "ephem_step": str(ephem_step)}
        if naifid:
            data.update(input_type="naifid_input", obj_naifid=str(naifid))
        elif mpc_data:
            data.update(input_type="mpc_input", mpc_data=mpc_data, obj_type=obj_type)
        elif name:
            data.update(input_type="name_input", obj_name=name)
        else:
            raise ValueError("MOST query needs naifid, name or mpc_data")
        src = DataSource(name="IRSA MOST", url=self.cfg["most_url"], query=json.dumps(data))
        last = None
        for attempt in range(4):
            text = request("POST", self.cfg["most_url"], data=data, timeout=self.timeout)
            try:
                return self.parse_most_ipac_table(text), src
            except DataAccessError as err:
                last = err
                # MOST reports transient back-end failures (e.g. its Horizons connection) inside an
                # HTTP 200 page; those are retried, anything else is raised immediately.
                if "Error connecting" not in str(err) and "Unable to load ephemeris" not in str(err):
                    raise
                import time
                time.sleep(10 * (attempt + 1))
        raise last

    @staticmethod
    def parse_most_ipac_table(text: str) -> pd.DataFrame:
        lines = text.splitlines()
        hdr_idx = next((i for i, ln in enumerate(lines) if ln.startswith("|") and "ra_obj" in ln), None)
        if hdr_idx is None:
            msg = " ".join(l.strip() for l in lines[:12])
            raise DataAccessError("MOST returned no result table: " + msg[:600])
        names = [c.strip() for c in lines[hdr_idx].strip("|").split("|")]
        # Fixed-width IPAC table: use the '|' positions of the header row.
        bounds = [i for i, ch in enumerate(lines[hdr_idx]) if ch == "|"]
        data_lines = [ln for ln in lines[hdr_idx + 1:] if ln and not ln.startswith(("|", "\\"))]
        rows = []
        for ln in data_lines:
            rows.append([ln[bounds[k]:bounds[k + 1] + 1].strip() for k in range(len(bounds) - 1)])
        df = pd.DataFrame(rows, columns=names)
        for c in df.columns:
            if c not in ("proposal_id", "target_name", "observationid", "planeid", "productid",
                         "instrument", "start_date", "end_date", "uri", "target_moving"):
                df[c] = pd.to_numeric(df[c], errors="coerce")
        return df

    # ------------------------------------------------------------- cutouts
    def image_url(self, uri_or_url: str) -> str:
        if uri_or_url.startswith("http"):
            return uri_or_url
        return self.cfg["data_base_url"].rstrip("/") + "/" + uri_or_url.lstrip("/")

    def download_cutout(self, image_url: str, ra: float, dec: float, size_pix: int,
                        out_dir: str | Path) -> tuple[Path, DataSource]:
        """IBE cutout of a SPHEREx L2 image. The cutout keeps all extensions (IMAGE, FLAGS,
        VARIANCE, ZODI, PSF, WCS-WAVE) with WCS keywords updated for the cutout."""
        out_dir = resolve(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        url = f"{image_url}?center={ra:.7f},{dec:.7f}&size={int(size_pix)}pix"
        name = Path(image_url.split("?")[0]).stem + f"_cut_{ra:.5f}_{dec:+.5f}_{size_pix}.fits"
        path = out_dir / name
        if not path.exists():
            blob = request("GET", url, timeout=self.timeout, binary=True)
            if not blob.startswith(b"SIMPLE"):
                raise DataAccessError(f"Cutout service did not return FITS: {blob[:200]!r}")
            tmp = path.with_name(path.name + f".part{id(blob)}")
            tmp.write_bytes(blob)          # atomic: a cached file is never half-written
            tmp.replace(path)
        src = DataSource(name="IRSA IBE cutout", url=url, identifier=Path(image_url).name,
                         version=_release_from_url(image_url))
        return path, src


def _release_from_url(url: str) -> str:
    # e.g. .../dr1/level2/2025W17_4B/l2b-v27-2026-196/1/... -> dr1 l2b-v27-2026-196
    parts = url.split("/")
    rel = [p for p in parts if p.startswith(("dr", "qr")) and len(p) <= 4]
    proc = [p for p in parts if p.startswith("l2b-")]
    return " ".join(rel[:1] + proc[:1])
