"""NEOWISE thermal-model fits of asteroids (beaming parameter eta), used to train the eta prior of the SPHEREx
thermal fit (src/physical/eta_prior.py).

Two tables are fetched once and cached in data/raw/neowise/ with a provenance file:
  * "fits"   - IRSA TAP table neowisesbpropv2, "NEOWISE Diameters and Albedos V2.0" (Mainzer et al. 2019, PDS,
               doi:10.26033/18S3-2Z54): every published NEOWISE NEATM fit (D, pV, eta, fit code, number of
               detections per band, mean epoch). Only fits whose fit code marks eta as a free parameter are used.
  * "orbits" - JPL SBDB Query API: osculating elements (a, e, i, node, peri, M, epoch) of every asteroid with a
               catalogue diameter, to compute the phase angle of each NEOWISE fit at its mean epoch.

Leakage control is done by the consumer: rows of the validation targets, of the classifier-injection set and of
the analysed object are removed before the prior is fitted, as for the population albedo prior.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from ..common.config import cache_directory, data_sources, resolve, settings
import os
from ..common.http import DataAccessError, get_json, session
from ..common.provenance import utc_now

FIT_COLUMNS = ["asteroid_number", "prov_desig", "mpc_packed_name", "absolute_mag", "slope_param", "mean_jd",
               "n_w1", "n_w2", "n_w3", "n_w4", "fit_code", "diameter", "diameter_err", "v_albedo", "v_albedo_err",
               "ir_albedo", "ir_albedo_err", "beaming_param", "beaming_param_err", "reference", "type"]
ORBIT_FIELDS = ["pdes", "a", "e", "i", "om", "w", "ma", "epoch"]


def catalogue_dir() -> Path:
    if os.environ.get('SPHEREX_ASTEROID_CACHE_DIR'):
        return cache_directory('neowise')
    cfg = settings()["thermal_model"]["eta_prior_relations"].get("neowise_population", {})
    return resolve(cfg.get("catalogue_dir", "data/raw/neowise"))


def _tap_async(adql: str, log=print, poll_s: float = 20.0, max_wait_s: float = 3600.0) -> str:
    """Run an IRSA TAP async query and return the CSV text (the full table does not fit a sync request)."""
    url = data_sources()["irsa"]["tap_async_url"]
    s = session()
    r = s.post(url, data={"QUERY": adql, "FORMAT": "csv", "LANG": "ADQL", "PHASE": "RUN"},
               allow_redirects=False, timeout=120)
    job = r.headers.get("Location")
    if not job:
        raise DataAccessError(f"IRSA TAP async: no job location (HTTP {r.status_code}): {r.text[:300]}")
    t0 = time.time()
    while True:
        phase = s.get(job + "/phase", timeout=60).text.strip()
        if phase in ("COMPLETED", "ERROR", "ABORTED"):
            break
        if time.time() - t0 > max_wait_s:
            raise DataAccessError(f"IRSA TAP async job {job} still {phase} after {max_wait_s:.0f} s")
        time.sleep(poll_s)
    if phase != "COMPLETED":
        raise DataAccessError(f"IRSA TAP async job {job} ended with {phase}: {s.get(job + '/error', timeout=60).text[:500]}")
    log(f"IRSA TAP job {job} completed after {time.time() - t0:.0f} s; downloading the result")
    res = s.get(job + "/results/result", timeout=1800)
    if res.status_code >= 400:
        raise DataAccessError(f"IRSA TAP result download failed: HTTP {res.status_code}")
    return res.text


def fetch(kind: str, refresh: bool = False, log=print) -> pd.DataFrame:
    """The cached table of `kind` ("fits" | "orbits"); downloaded when missing or refresh=True."""
    out = catalogue_dir()
    path = out / ("neowisesbpropv2.csv" if kind == "fits" else "sbdb_orbits.json")
    prov_path = out / f"{kind}.provenance.json"
    if refresh or not path.exists():
        out.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        if kind == "fits":
            table = data_sources()["irsa"].get("neowise_table", "neowisesbpropv2")
            adql = f"SELECT {', '.join(FIT_COLUMNS)} FROM {table}"
            text = _tap_async(adql, log=log)
            tmp = path.with_suffix(".part")
            tmp.write_text(text)
            tmp.replace(path)
            prov = {"source": "IRSA TAP (NEOWISE Diameters and Albedos V2.0, Mainzer et al. 2019, PDS, "
                              "doi:10.26033/18S3-2Z54)", "url": data_sources()["irsa"]["tap_async_url"],
                    "query": adql, "rows": int(text.count("\n") - 1)}
        elif kind == "orbits":
            url = data_sources()["jpl"].get("sbdb_query_api", "https://ssd-api.jpl.nasa.gov/sbdb_query.api")
            params = {"fields": ",".join(ORBIT_FIELDS), "sb-kind": "a", "sb-cdata": json.dumps({"AND": ["diameter|DF"]})}
            data = get_json(url, params=params, timeout=600)
            if "data" not in data:
                raise DataAccessError(f"SBDB Query API returned no orbits: {str(data)[:300]}")
            path.write_text(json.dumps(data))
            prov = {"source": "NASA/JPL SBDB Query API", "url": url, "params": params, "rows": data.get("count")}
        else:
            raise ValueError(kind)
        prov.update({"retrieved_utc": utc_now(), "seconds": round(time.time() - t0, 1)})
        prov_path.write_text(json.dumps(prov, indent=2))
        log(f"NEOWISE prior catalogue '{kind}': {prov.get('rows')} rows saved to {path}")
    if kind == "fits":
        df = pd.read_csv(path, low_memory=False)
    else:
        data = json.loads(path.read_text())
        df = pd.DataFrame(data["data"], columns=data["fields"])
        for c in ORBIT_FIELDS[1:]:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        df["pdes"] = df["pdes"].astype(str)
    df.attrs["provenance"] = json.loads(prov_path.read_text()) if prov_path.exists() else {}
    return df


def fitted_eta_table(refresh: bool = False, log=print) -> pd.DataFrame:
    """NEOWISE fits with a free beaming parameter, joined to SBDB orbits, with the phase angle, heliocentric
    distance and solar elongation at the mean epoch of each fit (two-body propagation of the osculating
    elements; Earth from the low-precision solar ephemeris, WISE being in a low Earth orbit)."""
    fits = fetch("fits", refresh=refresh, log=log)
    orb = fetch("orbits", refresh=refresh, log=log).drop_duplicates("pdes")
    b = fits[fits["fit_code"].astype(str).str[2] == "B"].copy()
    num = pd.to_numeric(b["asteroid_number"], errors="coerce")
    b["pdes"] = np.where(num.notna(), num.astype("Int64").astype(str), b["prov_desig"].astype(str))
    m = b.merge(orb, on="pdes", how="inner")
    t = m["mean_jd"].to_numpy(float)
    a, e = m["a"].to_numpy(float), m["e"].to_numpy(float)
    n_deg = 0.9856076686 / a ** 1.5
    M = np.radians((m["ma"].to_numpy(float) + n_deg * (t - m["epoch"].to_numpy(float))) % 360.0)
    E = M.copy()
    for _ in range(40):
        E = E - (E - e * np.sin(E) - M) / (1 - e * np.cos(E))
    xp, yp = a * (np.cos(E) - e), a * np.sqrt(1 - e ** 2) * np.sin(E)
    inc, om, w = (np.radians(m[c].to_numpy(float)) for c in ("i", "om", "w"))
    cO, sO, cw, sw, ci, si = np.cos(om), np.sin(om), np.cos(w), np.sin(w), np.cos(inc), np.sin(inc)
    X = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp
    Y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp
    Z = (sw * si) * xp + (cw * si) * yp
    d = t - 2451545.0
    g = np.radians(357.528 + 0.9856003 * d)
    lam = np.radians(280.460 + 0.9856474 * d + 1.915 * np.sin(g) + 0.020 * np.sin(2 * g))
    R = 1.00014 - 0.01671 * np.cos(g) - 0.00014 * np.cos(2 * g)
    Xe, Ye = -R * np.cos(lam), -R * np.sin(lam)
    r = np.sqrt(X ** 2 + Y ** 2 + Z ** 2)
    dx, dy, dz = X - Xe, Y - Ye, Z
    delta = np.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
    m["r_au"] = r
    m["phase_deg"] = np.degrees(np.arccos(np.clip((X * dx + Y * dy + Z * dz) / (r * delta), -1, 1)))
    m["elongation_deg"] = np.degrees(np.arccos(np.clip(-(Xe * dx + Ye * dy) / (R * delta), -1, 1)))
    m["ln_eta"] = np.log(m["beaming_param"].astype(float))
    m["ln_eta_err"] = m["beaming_param_err"].astype(float) / m["beaming_param"].astype(float)
    m = m[np.isfinite(m["ln_eta"]) & np.isfinite(m["phase_deg"]) & (m["diameter"] > 0)].reset_index(drop=True)
    m.attrs["provenance"] = {"fits": fits.attrs.get("provenance", {}), "orbits": orb.attrs.get("provenance", {})}
    return m
