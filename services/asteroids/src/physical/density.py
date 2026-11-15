"""Stage 6b: bulk density rho = M / V.

Volume: shape-model / tri-axial ellipsoid volume when available (V = 4/3 pi a b c with
semi-axes), otherwise a sphere V = 4/3 pi (D/2)^3 flagged `spherical_assumption`.
Uncertainties of M and D (or axes) are propagated (independent errors assumed).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..common import status


@dataclass
class DensityResult:
    status: str
    density_kg_m3: float | None = None
    density_err_kg_m3: float | None = None
    shape_assumption: str = ""
    volume_km3: float | None = None
    volume_method: str = ""
    mass_source: str = ""
    diameter_source: str = ""
    notes: str = ""

    @property
    def density_g_cm3(self):
        return None if self.density_kg_m3 is None else self.density_kg_m3 / 1000.0


def parse_extent(raw: str, raw_sigma: str | None = None):
    try:
        axes = [float(x) for x in raw.lower().replace("x", " ").split()]
        sig = [float(x) for x in raw_sigma.lower().replace("x", " ").split()] if raw_sigma else [0.0] * len(axes)
    except (ValueError, AttributeError):
        return None
    if len(axes) == 2:  # bi-axial: a = b
        axes = [axes[0], axes[0], axes[1]]
        sig = [sig[0], sig[0], sig[1]]
    return (axes, sig) if len(axes) == 3 else None


def compute_density(mass, diameter_km=None, diameter_err_km=None, extent_axes_km=None,
                    extent_err_km=None, diameter_source: str = "") -> DensityResult:
    if mass is None or mass.mass_kg is None:
        return DensityResult(status=status.UNKNOWN, notes="Mass unknown")
    if extent_axes_km is not None:
        a, b, c = (x / 2 for x in extent_axes_km)
        V = 4 / 3 * np.pi * a * b * c
        sa = [s / 2 for s in (extent_err_km or [0, 0, 0])]
        relV = np.sqrt(sum((s / x) ** 2 for s, x in zip(sa, (a, b, c))))
        shape, vmethod = "triaxial_ellipsoid", "V = 4/3 pi a b c (semi-axes from extent)"
    elif diameter_km:
        V = 4 / 3 * np.pi * (diameter_km / 2) ** 3
        relV = 3 * (diameter_err_km or 0) / diameter_km
        shape, vmethod = status.SPHERICAL_ASSUMPTION, "V = 4/3 pi (D/2)^3"
    else:
        return DensityResult(status=status.UNKNOWN, notes="Diameter / shape unknown")
    rho = mass.mass_kg / (V * 1e9)
    relM = (mass.mass_err_kg or 0) / mass.mass_kg
    err = rho * np.hypot(relM, relV)
    notes = []
    if mass.mass_err_kg is None:
        notes.append("mass uncertainty not provided")
    if diameter_err_km is None and extent_axes_km is None:
        notes.append("diameter uncertainty not provided")
    return DensityResult(status="ESTIMATED", density_kg_m3=float(rho), density_err_kg_m3=float(err),
                         shape_assumption=shape, volume_km3=float(V), volume_method=vmethod,
                         mass_source=f"{mass.method}; {mass.source}", diameter_source=diameter_source,
                         notes="; ".join(notes))
