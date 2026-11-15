"""Geometric albedo from diameter and absolute magnitude.

    D[km] = 1329 * 10^(-H/5) / sqrt(pV)      =>      pV = (1329 * 10^(-H/5) / D)^2

Valid only when H is a V-band absolute magnitude (H-G system convention) and D is a
spherical-equivalent diameter. Uncertainty propagation:
    d ln pV = -2 d ln D - (2 ln10 / 5) dH
    (sigma_pV / pV)^2 = (2 sigma_D / D)^2 + (0.921 sigma_H)^2      for independent errors,
    extended for the correlation that arises because the thermal fit used H (via A = q pV):
    the total derivative dpV/dH = dpV/dH|_D + dpV/dD * dD/dH, with dD/dH from refitting.
Geometric albedo, Bond albedo and spectral reflectance are distinct quantities and are
never substituted for one another. Values are never clipped to a plausible range.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..common import status
from ..common.config import model_version, settings
from ..common.provenance import Provenance
from .phase_function import PhaseLaw

LN10 = np.log(10.0)


@dataclass
class AlbedoResult:
    status: str                          # ESTIMATED | ON_HOLD_VALIDATION | Not estimable from available data
    geometric_albedo: float | None = None
    albedo_err: float | None = None
    albedo_err_is_lower_bound: bool = False
    band: str = "V"
    method: str = "pV = (1329 10^(-H/5) / D)^2"
    H: float | None = None
    H_err: float | None = None
    H_source: str = ""
    D_km: float | None = None
    D_err_km: float | None = None
    D_source: str = ""
    correlation_treatment: str = ""
    confidence: str = status.CONF_NONE
    missing_inputs: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    provenance: dict | None = None


def compute_albedo(D_km, D_err_km, H, H_err, *, H_source: str, D_source: str, H_band: str = "V",
                   dD_dH: float | None = None, H_err_provided: bool = True) -> AlbedoResult:
    cfg = settings()["albedo"]
    const = cfg["relation_constant_km"]
    prov = Provenance(step="albedo", model_version=model_version("albedo"),
                      formula=f"pV = ({const} * 10^(-H/5) / D)^2",
                      inputs={"D_km": D_km, "D_err_km": D_err_km, "H": H, "H_err": H_err, "dD_dH": dD_dH,
                              "H_source": H_source, "D_source": D_source})
    missing = []
    if D_km is None or not np.isfinite(D_km):
        missing.append("diameter")
    if H is None or not np.isfinite(H):
        missing.append("absolute magnitude H")
    if missing:
        return AlbedoResult(status=status.ALBEDO_NOT_ESTIMABLE, missing_inputs=missing, provenance=prov.to_dict())
    if H_band.upper() != "V":
        return AlbedoResult(status=status.ALBEDO_NOT_ESTIMABLE, missing_inputs=[f"V-band H (given {H_band})"],
                            warnings=["H and D must be in compatible systems; the 1329 km relation is for V."],
                            provenance=prov.to_dict())
    pV = (const * 10 ** (-H / 5.0) / D_km) ** 2
    dlnp_dD = -2.0 / D_km
    dlnp_dH_direct = -2.0 * LN10 / 5.0
    sD = D_err_km if D_err_km is not None else 0.0     # missing -> uncertainty flagged as lower bound
    sH = H_err if H_err is not None else 0.0
    if dD_dH is not None:
        # H uncertainty propagates both directly and through the H-dependent thermal solution
        dlnp_dH_total = dlnp_dH_direct + dlnp_dD * dD_dH
        var = (dlnp_dD * sD) ** 2 + (dlnp_dH_total * sH) ** 2
        corr = "H propagated jointly through the thermal fit (dD/dH from refitting); D fit error treated as independent of H."
    else:
        var = (dlnp_dD * sD) ** 2 + (dlnp_dH_direct * sH) ** 2
        corr = "H and D treated as independent (no joint sensitivity available)."
    err = float(pV * np.sqrt(var)) if np.isfinite(var) else None
    res = AlbedoResult(status="ESTIMATED", geometric_albedo=float(pV), albedo_err=err,
                       albedo_err_is_lower_bound=not H_err_provided or D_err_km is None, H=H, H_err=H_err,
                       H_source=H_source, D_km=D_km, D_err_km=D_err_km, D_source=D_source,
                       correlation_treatment=corr)
    if res.albedo_err_is_lower_bound:
        res.warnings.append("Uncertainty is a lower bound: an input uncertainty was not provided by its source.")
    lo, hi = cfg["plausible_range"]
    if not (lo <= pV <= hi):
        res.status = "ON_HOLD_VALIDATION"
        res.warnings.append(f"pV = {pV:.3f} outside plausible range [{lo}, {hi}]. Value shown but on hold: "
                            "re-check source data, units, model and identification. Not clipped.")
    if err is None or err / pV > cfg["max_relative_uncertainty"]:
        res.status = status.ALBEDO_NOT_ESTIMABLE if err is None else "ON_HOLD_VALIDATION"
        res.warnings.append(f"Relative uncertainty {np.nan if err is None else err / pV:.2f} exceeds "
                            f"{cfg['max_relative_uncertainty']}.")
    rel = (err or np.inf) / pV
    res.confidence = status.CONF_HIGH if rel < 0.15 else status.CONF_MEDIUM if rel < 0.3 else status.CONF_LOW
    for w in res.warnings:
        prov.warn(w)
    res.provenance = prov.to_dict()
    return res


def albedo_from_thermal_fit(spectrum, h_result, separator, sbdb=None, *, phase: PhaseLaw | None = None):
    """Full chain: joint thermal fit with H, sensitivity dD/dH by refitting at H +/- sigma_H,
    then pV with correlated propagation. Returns (AlbedoResult, DiameterResult)."""
    from .diameter import estimate_diameter

    if h_result is None or not h_result.reliable:
        reason = h_result.status if h_result is not None else status.H_UNAVAILABLE
        return AlbedoResult(status=status.ALBEDO_NOT_ESTIMABLE, missing_inputs=[f"reliable H ({reason})"]), \
            estimate_diameter(spectrum, H=None, G=None, sbdb=sbdb, separator=separator, phase=phase)
    phase = phase or PhaseLaw.from_h_result(h_result, separator.cfg["default_G"])
    dres = estimate_diameter(spectrum, H=h_result.H, H_err=h_result.H_err, G=h_result.G, sbdb=sbdb,
                             separator=separator, phase=phase)
    if dres.status != "OK":
        return AlbedoResult(status=status.ALBEDO_NOT_ESTIMABLE, missing_inputs=[f"diameter ({dres.status})"],
                            H=h_result.H, H_err=h_result.H_err, H_source=h_result.source), dres
    dH = h_result.H_err if h_result.H_err else 0.1
    try:
        up = separator.fit(spectrum, H=h_result.H + dH, phase=phase)
        dn = separator.fit(spectrum, H=h_result.H - dH, phase=phase)
        dD_dH = (up.D_km - dn.D_km) / (2 * dH) if up.D_km and dn.D_km else None
    except Exception:  # noqa: BLE001
        dD_dH = None
    a = compute_albedo(dres.diameter_km, dres.diameter_total_err_km, h_result.H, h_result.H_err,
                       H_source=f"{h_result.source} {h_result.reference}".strip(),
                       D_source=f"SPHEREx NEATM fit ({'eta fitted' if dres.eta_fitted else 'eta fixed'})",
                       dD_dH=dD_dH, H_err_provided=h_result.H_err_provided)
    return a, dres
