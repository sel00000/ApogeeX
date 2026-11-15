"""Laboratory reference-spectrum matching (RELAB, NASA PDS, other documented sources).

Library layout: data/reference/lab/<name>.csv  (columns wavelength_um, reflectance)
                data/reference/lab/<name>.provenance.json with at least
                {"source": ..., "sample_id": ..., "mineral": ..., "url_or_doi": ...}
Spectra without a complete provenance record are rejected. No spectra are bundled:
laboratory data must be obtained from the original archive by the user.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import data_sources, resolve, settings
from .reference_library import ReferenceSpectrum, resample_reference

REQUIRED_KEYS = {"source", "sample_id", "mineral", "url_or_doi"}


def load_lab_library(directory: str | None = None):
    d = resolve(directory or data_sources()["reference_spectra"]["lab_library_dir"])
    lib, rejected = {}, []
    if not d.exists():
        return lib, rejected
    for csv in sorted(Path(d).glob("*.csv")):
        pj = csv.with_suffix(".provenance.json")
        if not pj.exists():
            rejected.append((csv.name, "missing provenance file"))
            continue
        meta = json.loads(pj.read_text())
        miss = REQUIRED_KEYS - set(meta)
        if miss:
            rejected.append((csv.name, f"provenance missing {sorted(miss)}"))
            continue
        df = pd.read_csv(csv)
        lib[csv.stem] = (ReferenceSpectrum(csv.stem, df["wavelength_um"].values, df["reflectance"].values, None,
                                           f"{meta['source']} {meta['sample_id']} ({meta['url_or_doi']})"), meta)
    return lib, rejected


def match_lab_spectra(refl: pd.DataFrame, top_n: int = 5, value_col="reflectance", err_col="reflectance_err"):
    lib, rejected = load_lab_library()
    if not lib:
        return {"status": "No laboratory library available", "rejected": rejected, "matches": []}
    R_res = settings()["classification"]["spherex_resolving_power"]
    lam_norm = settings()["reflectance"]["normalization_wavelength_um"]
    lam, R, E = refl["wavelength_um"].values, refl[value_col].values, refl[err_col].values
    rows = []
    for name, (ref, meta) in lib.items():
        rr, _, inside = resample_reference(ref, lam, R_res, lam_norm)
        m = inside & np.isfinite(R) & np.isfinite(rr) & (E > 0)
        if m.sum() < 5:
            continue
        w = 1 / E[m] ** 2
        a = np.sum(w * R[m] * rr[m]) / np.sum(w * rr[m] ** 2)
        chi2 = np.sum(w * (R[m] - a * rr[m]) ** 2) / (m.sum() - 1)
        rows.append({"name": name, "mineral": meta["mineral"], "source": ref.source, "chi2_red": float(chi2),
                     "n_points": int(m.sum())})
    rows.sort(key=lambda r: r["chi2_red"])
    return {"status": "OK", "rejected": rejected, "matches": rows[:top_n],
            "note": "Similarity to laboratory spectra does not establish surface composition."}
