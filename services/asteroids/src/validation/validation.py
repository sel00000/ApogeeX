"""Validation against objects with independently measured properties.

For each validation object, catalogue/literature values from JPL SBDB are compared with
this system's calculations performed from the same primary inputs (e.g. density from
GM and diameter; pV from H and D). Discrepancies are reported, never tuned away.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..acquisition.jpl_client import SBDBClient
from ..physical.albedo import compute_albedo
from ..physical.density import compute_density, parse_extent
from ..physical.mass import mass_from_sbdb

# Objects with spacecraft-derived masses and shapes, plus well-characterised bodies.
VALIDATION_OBJECTS = ["1", "4", "16", "21", "101955", "162173", "433"]


def validate_object(designation: str) -> list[dict]:
    rec = SBDBClient().lookup(designation)
    rows = []
    if not rec.found:
        return [{"object": designation, "quantity": "lookup", "note": rec.message}]
    name = rec.fullname
    H, D, pv_cat, rho_cat = (rec.param(k) for k in ("H", "diameter", "albedo", "density"))
    if H and D and H.value and D.value:
        a = compute_albedo(D.value, D.sigma, H.value, H.sigma, H_source=f"SBDB {H.reference}",
                           D_source=f"SBDB {D.reference}", H_err_provided=H.sigma is not None)
        rows.append(_row(name, "geometric albedo pV", pv_cat, a.geometric_albedo, a.albedo_err,
                         "pV from SBDB H and diameter vs SBDB albedo (often from a different D/H source)",
                         interp="Differences reflect inconsistent H/D sources in the catalogue, not a code error, "
                                "when both inputs come from different studies." if pv_cat else ""))
    m = mass_from_sbdb(rec)
    if m.mass_kg is not None and (D and D.value):
        ext = rec.param("extent")
        ax = parse_extent(ext.raw_value, str(ext.sigma) if ext.sigma is not None else None) if ext else None
        dens_sph = compute_density(m, D.value, D.sigma)
        rows.append(_row(name, "bulk density (sphere, kg/m^3)", rho_cat, dens_sph.density_kg_m3,
                         dens_sph.density_err_kg_m3, "M = GM/G, V = 4/3 pi (D/2)^3", scale_cat=1000.0))
        if ax:
            dens_ell = compute_density(m, extent_axes_km=ax[0], extent_err_km=ax[1])
            rows.append(_row(name, "bulk density (ellipsoid, kg/m^3)", rho_cat, dens_ell.density_kg_m3,
                             dens_ell.density_err_kg_m3, "M = GM/G, V = 4/3 pi abc", scale_cat=1000.0))
    return rows


def _row(obj, qty, cat_param, value, err, method, scale_cat=1.0, interp=""):
    ref = cat_param.value * scale_cat if cat_param is not None and cat_param.value is not None else None
    ref_err = cat_param.sigma * scale_cat if cat_param is not None and cat_param.sigma is not None else None
    abs_err = (value - ref) if (value is not None and ref is not None) else None
    rel_err = abs_err / ref if abs_err is not None and ref else None
    n_sigma = abs_err / np.hypot(err or 0, ref_err or 0) if abs_err is not None and (err or ref_err) else None
    return {"object": obj, "quantity": qty, "reference_value": ref, "reference_uncertainty": ref_err,
            "reference_source": cat_param.reference if cat_param is not None else "",
            "system_value": value, "system_uncertainty": err, "absolute_error": abs_err,
            "relative_error": rel_err, "n_sigma": n_sigma, "method": method, "interpretation": interp}


def run_validation(objects=None) -> pd.DataFrame:
    rows = []
    for o in objects or VALIDATION_OBJECTS:
        try:
            rows.extend(validate_object(o))
        except Exception as err:  # noqa: BLE001
            rows.append({"object": o, "quantity": "error", "interpretation": str(err)})
    return pd.DataFrame(rows)
