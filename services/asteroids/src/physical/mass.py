"""Stage 6a: mass from dynamical measurements only.

Mass is never inferred from spectra, diameter or taxonomy.
  A. Binary/satellite orbit:  M_total = 4 pi^2 a^3 / (G P^2)  (Kepler III; secondary mass
     included unless the mass ratio is supplied).
  B. Gravitational perturbations on other bodies - published results ingested as records.
  C. Spacecraft flyby / tracking (radio science) - published results ingested as records.
  D. Existing database values (JPL SBDB GM -> M = GM / G).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..common import status
from ..common.config import settings


@dataclass
class MassResult:
    status: str                    # MEASURED | Unknown
    mass_kg: float | None = None
    mass_err_kg: float | None = None
    method: str = ""
    source: str = ""
    reference_epoch: str = ""
    notes: str = ""


def mass_from_sbdb(sbdb) -> MassResult:
    if sbdb is None or not sbdb.found:
        return MassResult(status=status.UNKNOWN, notes="Object not in SBDB")
    p = sbdb.param("GM")
    if p is None or p.value is None:
        return MassResult(status=status.UNKNOWN, notes="No GM in JPL SBDB; no dynamical mass available.")
    G = settings()["physical"]["gravitational_constant_km3_kg_s2"]
    m = p.value / G
    me = p.sigma / G if p.sigma is not None else None
    return MassResult(status="MEASURED", mass_kg=m, mass_err_kg=me, method="D: database GM (JPL SBDB)",
                      source=p.reference, notes=f"GM = {p.raw_value} km^3/s^2; M = GM/G")


def mass_from_binary_orbit(a_km, a_err_km, period_days, period_err_days, mass_ratio=None,
                           reference: str = "") -> MassResult:
    G = settings()["physical"]["gravitational_constant_km3_kg_s2"]
    P = period_days * 86400.0
    M_tot = 4 * np.pi ** 2 * a_km ** 3 / (G * P ** 2)
    rel = np.hypot(3 * (a_err_km or 0) / a_km, 2 * (period_err_days or 0) / period_days)
    M = M_tot / (1 + mass_ratio) if mass_ratio else M_tot
    note = "Primary mass (mass ratio applied)" if mass_ratio else "System mass (primary + secondary)"
    return MassResult(status="MEASURED", mass_kg=float(M), mass_err_kg=float(M * rel),
                      method="A: binary orbit (Kepler III)", source=reference, notes=note)


def mass_from_published(value_kg, err_kg, method: str, reference: str, epoch: str = "") -> MassResult:
    if method not in ("B: orbital perturbation", "C: spacecraft tracking"):
        raise ValueError("method must be 'B: orbital perturbation' or 'C: spacecraft tracking'")
    if not reference:
        raise ValueError("A published mass requires a reference")
    return MassResult(status="MEASURED", mass_kg=value_kg, mass_err_kg=err_kg, method=method,
                      source=reference, reference_epoch=epoch)
