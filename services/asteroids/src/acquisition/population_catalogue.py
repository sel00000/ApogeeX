"""Population catalogue from the JPL SBDB Query API, used to train the physical priors
(src/physical/population_priors.py): the albedo of asteroids of a given orbit, size and taxonomic complex,
and the frequency of the complexes along the orbit.

Two tables are fetched once and cached in data/raw/sbdb_physical/ with a provenance file:
  * "diameters" - every asteroid with a catalogue diameter: orbit, H, D, pV (about 140 000 objects, mostly
    NEOWISE). Trains the albedo regression (orbit + H -> pV) and the albedo distribution of each complex.
  * "taxonomy"  - every asteroid with a SMASSII (Bus & Binzel 2002) or Tholen class (about 2 200 objects).
    Only the SMASSII classes are used: they come from visible spectra alone, whereas the Tholen E/M/P
    classes were assigned with the albedo, which would make an albedo prior circular.

Leakage control: the rows of the validation targets (config/validation_targets.yaml), of the
classifier-calibration injection set (data/reference/injection_set) and of the analysed object itself are
removed before training, so that no object's own catalogue class or diameter enters its own prior.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from ..classification.reference_library import complex_of
from ..common.config import PROJECT_ROOT, cache_directory, data_sources, resolve, settings
from ..common.http import DataAccessError, get_json
from ..common.provenance import utc_now

FIELDS = {
    "diameters": ["spkid", "full_name", "pdes", "a", "e", "i", "q", "ad", "H", "G", "diameter",
                  "diameter_sigma", "albedo", "class", "spec_B"],
    "taxonomy": ["spkid", "full_name", "pdes", "a", "e", "i", "q", "ad", "H", "diameter", "albedo", "class",
                 "spec_B", "spec_T"],
}
CONSTRAINTS = {
    "diameters": {"AND": ["diameter|DF"]},
    "taxonomy": {"OR": ["spec_B|DF", "spec_T|DF"]},
}
NUMERIC = ["a", "e", "i", "q", "ad", "H", "G", "diameter", "diameter_sigma", "albedo"]
# SMASSII classes without a Bus-DeMeo counterpart of the same name (Bus & Binzel 2002 put Sk and Sl in the
# S-complex; Ld is the steeper variant of L).
SMASSII_TO_BUSDEMEO = {"Sk": "S", "Sl": "S", "Ld": "L"}


def catalogue_dir() -> Path:
    if os.environ.get('SPHEREX_ASTEROID_CACHE_DIR'):
        return cache_directory('sbdb_physical')
    return resolve(settings()["population_prior"]["catalogue_dir"])


def _query_url() -> str:
    return data_sources()["jpl"].get("sbdb_query_api", "https://ssd-api.jpl.nasa.gov/sbdb_query.api")


def fetch(kind: str, refresh: bool = False, log=print) -> pd.DataFrame:
    """The cached table of `kind` ("diameters" | "taxonomy"); downloaded when missing or refresh=True."""
    out = catalogue_dir()
    path, prov_path = out / f"sbdb_{kind}.json", out / f"sbdb_{kind}.provenance.json"
    if refresh or not path.exists():
        out.mkdir(parents=True, exist_ok=True)
        params = {"fields": ",".join(FIELDS[kind]), "sb-kind": "a", "sb-cdata": json.dumps(CONSTRAINTS[kind])}
        t0 = time.time()
        data = get_json(_query_url(), params=params, timeout=600)
        if "data" not in data:
            raise DataAccessError(f"SBDB Query API returned no data for {kind}: {str(data)[:300]}")
        path.write_text(json.dumps(data))
        prov_path.write_text(json.dumps({
            "source": "NASA/JPL SBDB Query API", "url": _query_url(), "params": params,
            "retrieved_utc": utc_now(), "count": data.get("count"), "seconds": round(time.time() - t0, 1),
            "signature": data.get("signature")}, indent=2))
        log(f"SBDB {kind}: {data.get('count')} objects downloaded to {path}")
    data = json.loads(path.read_text())
    df = pd.DataFrame(data["data"], columns=data["fields"])
    for c in NUMERIC:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    df["pdes"] = df["pdes"].astype(str)
    if "spec_B" in df:
        df["complex"] = df["spec_B"].map(smassii_complex)
    df.attrs["provenance"] = json.loads(prov_path.read_text()) if prov_path.exists() else {}
    return df


def smassii_complex(cls) -> str | None:
    """Bus-DeMeo complex of a SMASSII class (None if empty or not one of the reference classes)."""
    if not isinstance(cls, str) or not cls.strip():
        return None
    c = cls.strip().rstrip(":")
    c = SMASSII_TO_BUSDEMEO.get(c, c)
    cx = complex_of(c)
    return None if cx == "Other" else cx


def standard_exclusions() -> set[str]:
    """Designations whose catalogue values must never train a prior: validation targets and the injection
    set of the classifier calibration (both are scored against catalogue/literature classes)."""
    out: set[str] = set()
    vt = PROJECT_ROOT / "config" / "validation_targets.yaml"
    if vt.exists():
        out |= {str(k) for k in (yaml.safe_load(vt.read_text(encoding="utf-8")) or {}).get("targets", {})}
    inj = PROJECT_ROOT / "data" / "reference" / "injection_set" / "injection_set.csv"
    if inj.exists():
        out |= set(pd.read_csv(inj)["number"].astype(str))
    return out


def designation_keys(sbdb) -> set[str]:
    """Identifiers under which an SBDB record can appear in the catalogue tables (pdes / number)."""
    keys = set()
    for v in (getattr(sbdb, "designation", None), getattr(sbdb, "query", None)):
        if v:
            keys.add(str(v).strip())
    full = getattr(sbdb, "fullname", "") or ""
    if full.strip().split(" ")[0].isdigit():
        keys.add(full.strip().split(" ")[0])
    return keys


def load_training_tables(exclude: set[str] | None = None, refresh: bool = False, log=print):
    """(diameters, taxonomy) with the excluded designations removed and derived columns:
    log10_pv_eff = 2 log10(1329 10^(-H/5) / D) - the albedo that reproduces the catalogue D with the CURRENT
    SBDB H (catalogue pV values were computed with older H values: median offset 0.05 dex, measured
    2026-11-15), and sin_i."""
    excl = standard_exclusions() | set(exclude or ())
    d = fetch("diameters", refresh=refresh, log=log)
    tx = fetch("taxonomy", refresh=refresh, log=log)
    for df in (d, tx):
        df["sin_i"] = np.sin(np.radians(df["i"]))
        with np.errstate(divide="ignore", invalid="ignore"):
            df["log10_pv_eff"] = 2 * np.log10(1329.0 * 10 ** (-df["H"] / 5.0) / df["diameter"])
    keep_d = (~d["pdes"].isin(excl)) & d[["a", "e", "i", "H"]].notna().all(axis=1) & np.isfinite(d["log10_pv_eff"])
    keep_t = (~tx["pdes"].isin(excl)) & tx[["a", "e", "i", "H"]].notna().all(axis=1) & tx["complex"].notna()
    d, tx = d[keep_d].reset_index(drop=True), tx[keep_t].reset_index(drop=True)
    d.attrs["excluded"] = tx.attrs["excluded"] = sorted(excl)
    return d, tx
