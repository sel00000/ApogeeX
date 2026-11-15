"""Stage 5: diameter from the thermal model, with H used jointly when available.

estimate_diameter runs the least-squares NEATM fit on one normalisation group (its thermal-excess test decides whether
a thermal diameter is reported). The shared analysis chain then replaces its diameter by the posterior from all points
(src/physical/diameter_posterior.py, src/integration/spectrum_analysis.py). The new estimate and any catalogue
diameter are stored in separate fields and compared.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..common import status
from .phase_function import PhaseLaw
from ..preprocessing.thermal_separation import ThermalFitResult, ThermalSeparator


@dataclass
class DiameterResult:
    status: str
    diameter_km: float | None = None
    diameter_err_km: float | None = None           # statistical (fit) uncertainty
    diameter_sys_err_km: float | None = None       # from eta prior when eta fixed
    diameter_total_err_km: float | None = None      # half the 68% interval for the posterior diameter
    diameter_interval_68_km: tuple | None = None    # posterior 16th-84th percentile (src/physical/diameter_posterior.py)
    diameter_interval_95_km: tuple | None = None
    posterior: dict | None = None                   # DiameterPosterior.summary() when the posterior replaced the fit
    conditional_range_km: tuple | None = None
    model: str = "NEATM"
    eta: float | None = None
    eta_fitted: bool = False
    chi2_red: float | None = None
    H_used: float | None = None
    catalog_diameter_km: float | None = None
    catalog_diameter_err_km: float | None = None
    catalog_diameter_ref: str = ""
    difference_km: float | None = None
    difference_sigma: float | None = None
    confidence: str = status.CONF_NONE
    assumptions: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    thermal_fit: ThermalFitResult | None = None


def estimate_diameter(spectrum, H=None, H_err=None, G=None, sbdb=None,
                      separator: ThermalSeparator | None = None, *, phase: PhaseLaw | None = None) -> DiameterResult:
    sep = separator or ThermalSeparator()
    fit = sep.fit(spectrum, H=H, H_err=H_err, G=G, phase=phase)
    res = DiameterResult(status=fit.status, thermal_fit=fit, warnings=list(fit.warnings), H_used=H,
                         assumptions={"emissivity": sep.cfg["emissivity"], "eta_default": sep.cfg["eta_default"],
                                      "G": sep.G, "phase_function": sep.phase.to_dict(), "solar_spectrum": sep.solar.name})
    if sbdb is not None and sbdb.found and sbdb.param("diameter") is not None:
        p = sbdb.param("diameter")
        res.catalog_diameter_km, res.catalog_diameter_err_km, res.catalog_diameter_ref = p.value, p.sigma, p.reference
    if fit.status == "CONDITIONAL":
        res.conditional_range_km = fit.conditional_D_range_km
        res.confidence = status.CONF_LOW
        return res
    if fit.status != "OK":
        return res
    res.diameter_km, res.diameter_err_km = fit.D_km, fit.D_err_km
    res.diameter_sys_err_km = fit.D_err_eta_sys_km
    res.diameter_total_err_km = float(np.hypot(fit.D_err_km or 0.0, fit.D_err_eta_sys_km or 0.0))
    res.eta, res.eta_fitted, res.chi2_red = fit.eta, fit.eta_fitted, fit.chi2_red
    rel = res.diameter_total_err_km / res.diameter_km if res.diameter_km else np.inf
    if rel < 0.1 and fit.chi2_red < 2:
        res.confidence = status.CONF_HIGH
    elif rel < 0.3 and fit.chi2_red < 5:
        res.confidence = status.CONF_MEDIUM
    else:
        res.confidence = status.CONF_LOW
    if res.catalog_diameter_km:
        res.difference_km = res.diameter_km - res.catalog_diameter_km
        sig = np.hypot(res.diameter_total_err_km, res.catalog_diameter_err_km or 0.0)
        res.difference_sigma = float(res.difference_km / sig) if sig > 0 else None
    return res
