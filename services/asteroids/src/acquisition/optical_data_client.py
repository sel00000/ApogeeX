"""Facility-agnostic optical photometry ingestion for absolute magnitude (H) estimation.

No telescope, observatory, survey or country is a default or required source.
Each provider implements `fetch(designation)` and returns a standard table:

    mjd, mag, mag_err, band, photometric_system, observatory_code, source_id,
    provider, quality, note

Providers shipped:
  * MPCObservationsProvider - MPC observation archive (OBS80 photometry fields). These
    magnitudes are astrometric by-products of heterogeneous quality; they are flagged
    accordingly and band-to-V corrections are only applied if explicitly enabled.
  * CSVPhotometryProvider    - any user-supplied photometry (archive exports, literature,
    dedicated follow-up), with mandatory provenance columns.
New providers (other archives, surveys, literature compilations) plug in by subclassing.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import data_sources
from ..common.http import DataAccessError, request
from ..common.provenance import DataSource

STANDARD_COLUMNS = ["mjd", "mag", "mag_err", "band", "photometric_system", "observatory_code",
                    "source_id", "provider", "quality", "note"]


class PhotometryProvider(ABC):
    name = "abstract"

    @abstractmethod
    def fetch(self, designation: str) -> tuple[pd.DataFrame, DataSource]:
        ...


def _obs80_date_to_mjd(date_str: str) -> float:
    # 'YYYY MM DD.ddddd'
    y, m, d = date_str.split()
    y, m, dd = int(y), int(m), float(d)
    day = int(dd)
    frac = dd - day
    # Julian day number (Fliegel & Van Flandern) -> MJD
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    jdn = day + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return jdn - 2400000.5 - 0.5 + frac


class MPCObservationsProvider(PhotometryProvider):
    name = "MPC Observations API"

    def __init__(self):
        cfg = data_sources()["mpc"]
        self.url = cfg["observations_api"]
        self.timeout = cfg.get("timeout_s", 120)

    def fetch(self, designation: str):
        body = {"desigs": [designation], "output_format": ["OBS80"]}
        src = DataSource(name=self.name, url=self.url, query=json.dumps(body))
        text = request("GET", self.url, json_body=body, timeout=self.timeout)
        data = json.loads(text)
        if not data or not data[0].get("OBS80"):
            return pd.DataFrame(columns=STANDARD_COLUMNS), src
        rows = []
        for line in data[0]["OBS80"].splitlines():
            if len(line) < 80:
                continue
            note2 = line[14]
            if note2 in "RrSsVvXx":    # radar, roving, satellite 2nd lines, etc.: no photometry
                continue
            mag_s, band = line[65:70].strip(), line[70].strip()
            if not mag_s:
                continue
            try:
                mag = float(mag_s)
                mjd = _obs80_date_to_mjd(line[15:32])
            except ValueError:
                continue
            rows.append({"mjd": mjd, "mag": mag, "mag_err": np.nan, "band": band or "B?",
                         "photometric_system": "unspecified (OBS80)", "observatory_code": line[77:80],
                         "source_id": line.strip()[:80], "provider": self.name,
                         "quality": "astrometric-photometry",
                         "note": "Magnitude reported with astrometry; precision and calibration unspecified."})
        return pd.DataFrame(rows, columns=STANDARD_COLUMNS), src


class CSVPhotometryProvider(PhotometryProvider):
    """User-supplied photometry. Required columns: mjd, mag, mag_err, band, source_id,
    provider. Rows without uncertainties are kept but flagged."""
    name = "User CSV"

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def fetch(self, designation: str):
        df = pd.read_csv(self.path)
        missing = {"mjd", "mag", "band", "source_id", "provider"} - set(df.columns)
        if missing:
            raise ValueError(f"Photometry CSV {self.path} is missing columns: {sorted(missing)}")
        for c in STANDARD_COLUMNS:
            if c not in df.columns:
                df[c] = np.nan if c == "mag_err" else ""
        if "designation" in df.columns:
            df = df[df["designation"].astype(str) == str(designation)]
        df.loc[df["mag_err"].isna(), "quality"] = "no-uncertainty"
        src = DataSource(name=self.name, url=str(self.path), identifier=self.path.name)
        return df[STANDARD_COLUMNS].copy(), src


def collect_photometry(designation: str, providers: list[PhotometryProvider]):
    """Query every provider; failures are recorded, never silently ignored."""
    frames, sources, errors = [], [], []
    for p in providers:
        try:
            df, src = p.fetch(designation)
            frames.append(df)
            sources.append(src)
        except (DataAccessError, ValueError, OSError) as err:
            errors.append(f"{p.name}: {err}")
    table = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=STANDARD_COLUMNS)
    # duplicate detection: same mjd (to 1e-5 d), band and observatory
    if not table.empty:
        key = (table["mjd"].round(5).astype(str) + table["band"].astype(str)
               + table["observatory_code"].astype(str))
        table["duplicate"] = key.duplicated()
    return table, sources, errors
