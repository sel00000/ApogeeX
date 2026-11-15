"""Selection of faint solar analogs for the SPHEREx relative calibration.

Why: the classical solar analogs of asteroid spectroscopy (Marsset et al. 2020, V = 8.1-12.4) are
mostly too bright for SPHEREx. On DR1 images Landolt 115-271 (V = 9.7) had OVERFLOW at the peak pixel
in 39 of 72 exposures and no usable B1/B2 point, while Landolt 110-361 (V = 12.4) had no saturation
flag in its core (peak ~30 MJy/sr in B1).

Source: the Gaia DR3 golden sample of solar analogues (Gaia Collaboration, Creevey et al. 2023,
A&A 674, A39, Sect. 7.2; archive table gaiadr3.gold_sample_solar_analogues, 5863 stars). Its
criteria: GSP-Spec Teff = 5772 +/- 100 K, log g = 4.44 +/- 0.25, [M/H] = 0 +/- 0.1 (after the mean
offsets found on known solar twins), good GSP-Spec flags, FLAME mass 0.95-1.05 Msun and radius
0.8-1.2 Rsun, G < 16 and parallax / error > 20.

Additional cuts for SPHEREx (all recorded with the selection):
  * G within g_range (default 11.3-13.0): unsaturated in B1/B2, S/N of tens per point;
  * |b| > min_abs_b (default 20 deg): uncrowded fields;
  * RUWE < max_ruwe (default 1.4): no sign of an unresolved companion;
  * BP - RP within bp_rp_range (default 0.80-0.84, solar 0.82 +/- 0.02, Casagrande & VandenBerg
    2018): limits reddening, which would tilt the near-infrared slope (E(BP-RP) = 0.03 is ~2 %/um);
  * no Gaia DR3 source within neighbour_radius_arcsec (30) brighter than G + neighbour_max_dg (5);
  * stratified in ecliptic latitude (default |beta| 0-20, 20-50, 50-90 deg), so that some stars see
    the bright zodiacal background that asteroids see; random choice with a fixed seed.
"""
from __future__ import annotations

import io

import numpy as np
import pandas as pd

from ..common.config import data_sources
from ..common.http import request
from ..common.provenance import DataSource

GOLD_QUERY = (
    "SELECT s.source_id, s.ra, s.dec, s.l, s.b, s.ecl_lat, s.phot_g_mean_mag, s.bp_rp, s.ruwe, s.parallax, "
    "s.pmra, s.pmdec, a.teff_gspspec, a.logg_gspspec, a.mh_gspspec, a.ag_gspphot "
    "FROM gaiadr3.gold_sample_solar_analogues AS g JOIN gaiadr3.gaia_source AS s ON s.source_id = g.source_id "
    "LEFT JOIN gaiadr3.astrophysical_parameters AS a ON a.source_id = g.source_id")


def _gaia_tap(adql: str) -> tuple[pd.DataFrame, DataSource]:
    url = data_sources().get("gaia", {}).get("tap_sync_url", "https://gea.esac.esa.int/tap-server/tap/sync")
    txt = request("POST", url, data={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql},
                  timeout=300)
    if txt.lstrip().startswith("<"):
        raise RuntimeError("Gaia archive TAP error: " + txt[:400])
    return pd.read_csv(io.StringIO(txt)), DataSource(name="ESA Gaia archive TAP", url=url, query=adql,
                                                    version="Gaia DR3")


def query_gold_sample() -> tuple[pd.DataFrame, DataSource]:
    return _gaia_tap(GOLD_QUERY)


def neighbours(ra: float, dec: float, g_mag: float, radius_arcsec: float = 30.0, max_dg: float = 5.0) -> pd.DataFrame:
    """Gaia DR3 sources within radius of (ra, dec) and brighter than g_mag + max_dg (the star itself
    excluded by separation < 0.5 arcsec)."""
    df, _ = _gaia_tap(
        "SELECT source_id, ra, dec, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source WHERE "
        f"1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.7f}, {dec:.7f}, {radius_arcsec / 3600:.7f})) "
        f"AND phot_g_mean_mag < {g_mag + max_dg:.3f}")
    sep = np.hypot((df["ra"] - ra) * np.cos(np.radians(dec)), df["dec"] - dec) * 3600
    df["sep_arcsec"] = sep
    return df[sep > 0.5].reset_index(drop=True)


def select_solar_analogs(per_group: int = 4, g_range=(11.3, 13.0), min_abs_b: float = 20.0, max_ruwe: float = 1.4,
                         bp_rp_range=(0.80, 0.84), beta_groups=((0, 20), (20, 50), (50, 90.01)),
                         neighbour_radius_arcsec: float = 30.0, neighbour_max_dg: float = 5.0, seed: int = 0,
                         log=print) -> tuple[pd.DataFrame, dict]:
    gold, src = query_gold_sample()
    m = (gold["phot_g_mean_mag"].between(*g_range) & (gold["b"].abs() > min_abs_b) & (gold["ruwe"] < max_ruwe)
         & gold["bp_rp"].between(*bp_rp_range))
    # TAP returns rows in no guaranteed order: sort first, so that the seeded choice is reproducible.
    cand = gold[m].sort_values("source_id").reset_index(drop=True)
    rng = np.random.default_rng(seed)
    chosen, groups, rejected = [], [], []
    for lo, hi in beta_groups:
        grp = cand[cand["ecl_lat"].abs().between(lo, hi, inclusive="left")]
        order = rng.permutation(len(grp))
        n_ok = 0
        for i in order:
            if n_ok >= per_group:
                break
            # Column-wise access: a row Series (grp.iloc[i]) is cast to float64, which corrupts the
            # 19-digit source_id (float64 keeps 53 bits; on 2026-11-14 that changed 9 of 12 IDs).
            idx = grp.index[i]
            ra, dec, g = (float(grp.at[idx, c]) for c in ("ra", "dec", "phot_g_mean_mag"))
            nb = neighbours(ra, dec, g, neighbour_radius_arcsec, neighbour_max_dg)
            if len(nb):
                rejected.append({"source_id": int(grp.at[idx, "source_id"]), "reason": f"{len(nb)} neighbour(s), "
                                 f"nearest {nb['sep_arcsec'].min():.1f} arcsec, dG {nb['phot_g_mean_mag'].min() - g:+.1f}"})
                continue
            chosen.append(idx)
            groups.append(f"{lo:g}-{min(hi, 90):g}")
            n_ok += 1
        log(f"  |beta| {lo:g}-{min(hi, 90):g} deg: {len(grp)} candidates, {n_ok} chosen")
    out = cand.loc[chosen].copy()
    out["beta_group"] = groups
    assert out["source_id"].dtype == np.int64
    meta = {"source": "Gaia DR3 golden sample of solar analogues (Creevey et al. 2023, A&A 674, A39, Sect. 7.2)",
            "archive_table": "gaiadr3.gold_sample_solar_analogues", "n_gold": int(len(gold)),
            "cuts": {"G": list(g_range), "abs_b_deg_min": min_abs_b, "ruwe_max": max_ruwe, "bp_rp": list(bp_rp_range),
                     "neighbours": f"none within {neighbour_radius_arcsec} arcsec brighter than G + {neighbour_max_dg}",
                     "ecliptic_latitude_groups_deg": [list(g) for g in beta_groups], "per_group": per_group,
                     "seed": seed},
            "n_after_cuts": int(len(cand)), "rejected_for_neighbours": rejected, "query": src.to_dict()}
    return out.reset_index(drop=True), meta
