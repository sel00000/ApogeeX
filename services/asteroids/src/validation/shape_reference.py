"""Validation reference for a SPHEREx thermal diameter when the catalogue gives a shape (SBDB extent) and a spin pole.

A NEATM diameter is the diameter of the sphere that emits the observed 3.5-5 um flux at the observing geometry: an
effective diameter. A spacecraft, radar or adaptive-optics diameter is volume-equivalent. For an elongated body the two
differ, and by how much depends on the viewing and illumination geometry. In 2025-07 SPHEREx saw 433 Eros
(34.4 x 11.2 x 11.2 km) within 3-8 deg of its south pole with the Sun 30-40 deg from it, so it saw the largest
cross-section, and the sunlit side is flatter than a sphere's (more of it is hot). Comparing that SPHEREx diameter with
the volume-equivalent 16.84 km mixes two different quantities.

The reference for the comparison is the diameter that the same spherical NEATM would give for the catalogue shape at the
same geometry, D_eff = f x D_vol:
  shape     triaxial ellipsoid with the proportions of the SBDB extent, scaled to the catalogue diameter, which is taken
            as volume-equivalent (a warning is raised when it differs from the extent's by more than 15%);
  geometry  Sun and SPHEREx directions at the epochs of the thermal points (>= thermal_region_min_um), from the target's
            predicted RA/Dec and distance and a low-precision solar ephemeris; spin pole from SBDB (RA/Dec, J2000); the
            flux is averaged over the rotation (the exposures sample random rotation phases);
  model     the NEATM temperature rule on every facet (thermal_model.facet_neatm_flux_jy, equal to neatm_flux_jy for a
            sphere), eta at the centre of the target's eta prior, Bond albedo from the catalogue albedo. The ellipsoid
            and the volume-equivalent sphere use the same eta and albedo, so f measures the shape alone:
            f = exp(mean over the thermal points of 0.5 ln(F_ellipsoid / F_sphere)).
Without a pole, f is the median over isotropic poles, and its 68% range enters the comparison as an uncertainty.

The reference uses no SPHEREx flux and never enters the SPHEREx diameter: it is only what the measurement is compared
with. Limits: an ellipsoid approximates an irregular shape (Eros's saddle, Kleopatra's two lobes) and casts no shadows;
thermal inertia and roughness are absorbed in eta, as in NEATM.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..physical.density import parse_extent
from ..physical.phase_function import PhaseLaw
from ..physical.thermal_model import ellipsoid_facets, facet_neatm_flux_jy, neatm_flux_jy

STATUS_OK = "OK"
STATUS_POLE_UNKNOWN = "POLE_UNKNOWN"
STATUS_NOT_APPLICABLE = "NOT_APPLICABLE"
METHOD = ("D_eff = f x D_vol: f from the NEATM temperature rule on an ellipsoid with the SBDB extent's proportions, "
          "scaled to the catalogue (volume-equivalent) diameter, at the SPHEREx geometry of the thermal points, "
          "rotation-averaged, against the volume-equivalent sphere with the same eta and albedo")
EPOCH_BIN_DAYS = 0.02           # thermal points closer in time than this share one geometry
_POLE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*(?:/|,|\s)\s*(-?\d+(?:\.\d+)?)\s*$")


@dataclass
class ShapeReference:
    status: str
    reason: str = ""
    D_vol_km: float | None = None              # catalogue diameter (volume-equivalent)
    D_vol_err_km: float | None = None
    D_eff_km: float | None = None              # spherical-NEATM diameter of the catalogue shape at the SPHEREx geometry
    D_eff_interval_68_km: list | None = None   # without a pole: 16th-84th percentile over isotropic poles
    factor: float | None = None                # f = D_eff / D_vol
    factor_interval_68: list | None = None
    extent_km: list | None = None              # SBDB extent, longest first
    extent_volume_diameter_km: float | None = None
    axes_km: list | None = None                # full axes of the ellipsoid used (extent scaled to D_vol)
    pole_ra_dec_deg: list | None = None
    sub_observer_lat_deg: list | None = None   # min, median, max over the thermal points (planetocentric)
    sub_solar_lat_deg: list | None = None
    phase_deg: float | None = None
    eta: float | None = None
    bond_albedo: float | None = None
    n_points: int = 0
    n_epochs: int = 0
    sources: dict = field(default_factory=dict)
    method: str = METHOD
    warnings: list = field(default_factory=list)

    @property
    def applicable(self) -> bool:
        return self.status in (STATUS_OK, STATUS_POLE_UNKNOWN) and self.D_eff_km is not None

    def relative_sigma(self) -> float:
        """1-sigma of ln D_eff: the catalogue diameter error and, without a pole, half the 68% range of ln f."""
        s_cat = (self.D_vol_err_km or 0.0) / self.D_vol_km if self.D_vol_km else 0.0
        s_f = 0.5 * np.log(self.factor_interval_68[1] / self.factor_interval_68[0]) if self.factor_interval_68 else 0.0
        return float(np.hypot(s_cat, s_f))

    def summary(self) -> dict:
        def clean(v):
            if isinstance(v, (float, np.floating)):
                return float(round(float(v), 5))
            if isinstance(v, (list, tuple)):
                return [clean(x) for x in v]
            if isinstance(v, dict):
                return {k: clean(x) for k, x in v.items()}
            return v
        return {k: clean(v) for k, v in self.__dict__.items()}


def parse_pole(raw) -> tuple[float, float] | None:
    """SBDB 'pole' (spin-axis RA/Dec in degrees, J2000): '11.37/17.22', '69, 42', '309.06110/42.232386'."""
    if raw is None:
        return None
    m = _POLE.match(str(raw))
    if not m:
        return None
    ra, dec = float(m.group(1)), float(m.group(2))
    return (ra % 360.0, dec) if -90.0 <= dec <= 90.0 else None


def radec_unit(ra_deg, dec_deg) -> np.ndarray:
    ra, dec = np.radians(np.asarray(ra_deg, float)), np.radians(np.asarray(dec_deg, float))
    return np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=-1)


def sun_vector_au(mjd) -> np.ndarray:
    """Geocentric position of the Sun (au) on J2000 equatorial axes: the low-precision solar coordinates of the
    Astronomical Almanac (about 0.01 deg in 1950-2050), referred to the J2000 equinox with the general precession in
    longitude (1.397 deg per century). SPHEREx counts as geocentric (its 700-km orbit is < 1e-4 au)."""
    n = np.asarray(mjd, float) + 2400000.5 - 2451545.0
    g = np.radians(357.528 + 0.9856003 * n)
    lam = (np.radians(280.460 + 0.9856474 * n - 1.397 * n / 36525.0)
           + np.radians(1.915) * np.sin(g) + np.radians(0.020) * np.sin(2 * g))
    R = 1.00014 - 0.01671 * np.cos(g) - 0.00014 * np.cos(2 * g)
    eps = np.radians(23.4393)
    return np.stack([R * np.cos(lam), R * np.cos(eps) * np.sin(lam), R * np.sin(eps) * np.sin(lam)], axis=-1)


def viewing_geometry(points: pd.DataFrame) -> dict:
    """Unit vectors from the target to the Sun and to SPHEREx (J2000 equatorial), heliocentric and observer distances
    (au) and phase angle (deg) for each row (columns mjd, pred_ra_deg, pred_dec_deg, delta_au)."""
    P = points["delta_au"].to_numpy(float)[:, None] * radec_unit(points["pred_ra_deg"], points["pred_dec_deg"])
    helio = P - sun_vector_au(points["mjd"].to_numpy(float))          # Sun -> target
    r = np.linalg.norm(helio, axis=1)
    dl = np.linalg.norm(P, axis=1)
    to_sun, to_obs = -helio / r[:, None], -P / dl[:, None]
    phase = np.degrees(np.arccos(np.clip(np.sum(to_sun * to_obs, axis=1), -1.0, 1.0)))
    return {"to_sun": to_sun, "to_obs": to_obs, "r_au": r, "delta_au": dl, "phase_deg": phase}


def _unit(v):
    return v / np.linalg.norm(v)


def _body_axes(pole: np.ndarray):
    ref = np.array([0.0, 0.0, 1.0]) if abs(pole[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    x0 = _unit(np.cross(ref, pole))
    return x0, np.cross(pole, x0)


def rotation_averaged_ratio(normals, areas, D_vol_km, pole, to_sun, to_obs, r_au, delta_au, phase_deg, wavelength_um,
                            eta, bond_albedo, emissivity=0.9, n_rot=36) -> np.ndarray:
    """F_shape / F_sphere(D_vol) at each wavelength for one epoch; the shape's flux is averaged over n_rot rotation
    phases about `pole` (unit vector, same frame as to_sun and to_obs; the body z axis is the pole)."""
    lam = np.atleast_1d(np.asarray(wavelength_um, float))
    x0, y0 = _body_axes(np.asarray(pole, float))
    F = np.zeros(len(lam))
    for psi in 2.0 * np.pi * np.arange(n_rot) / n_rot:
        xb = np.cos(psi) * x0 + np.sin(psi) * y0
        M = np.vstack([xb, np.cross(pole, xb), pole])                 # rows: body axes
        F += facet_neatm_flux_jy(lam, normals, areas, M @ to_sun, M @ to_obs, r_au, delta_au, eta, bond_albedo,
                                 emissivity)
    S = neatm_flux_jy(lam, D_vol_km, eta, r_au, delta_au, phase_deg, bond_albedo, emissivity)
    return F / n_rot / S


def log_z(reference_km, reference_rel_sigma, best_km, interval_68) -> float | None:
    """(ln reference - ln best) / sigma, with sigma from half the 68% interval of ln best and the reference's own
    relative error: the convention of the diameter tables in docs/STAGE_STATUS.md (negative when SPHEREx is larger)."""
    try:
        lo, hi = float(interval_68[0]), float(interval_68[1])
        ref, best = float(reference_km), float(best_km)
    except (TypeError, ValueError, IndexError):
        return None
    if not (ref > 0 and best > 0 and lo > 0 and hi > lo):
        return None
    return float(np.log(ref / best) / np.hypot(0.5 * np.log(hi / lo), reference_rel_sigma or 0.0))


def shape_reference(sbdb, spectrum: pd.DataFrame | None, *, eta: float | None = None, G: float | None = None, phase: PhaseLaw | None = None,
                    H: float | None = None, thermal_min_um: float = 3.5, emissivity: float = 0.9,
                    cfg: dict | None = None) -> ShapeReference:
    """Effective-diameter reference of the catalogue shape at the SPHEREx geometry of `spectrum` (see module doc)."""
    cfg = cfg or {}
    if sbdb is None or not getattr(sbdb, "found", False):
        return ShapeReference(STATUS_NOT_APPLICABLE, "no SBDB record")
    ext, dia = sbdb.param("extent"), sbdb.param("diameter")
    if ext is None or not str(ext.raw_value or "").strip():
        return ShapeReference(STATUS_NOT_APPLICABLE, "no SBDB extent (shape)")
    if dia is None or not dia.value:
        return ShapeReference(STATUS_NOT_APPLICABLE, "no catalogue diameter")
    parsed = parse_extent(str(ext.raw_value))
    if not parsed or min(parsed[0]) <= 0:
        return ShapeReference(STATUS_NOT_APPLICABLE, f"extent '{ext.raw_value}' is not a triaxial size")
    extent = sorted((float(x) for x in parsed[0]), reverse=True)
    D_ext = float(np.prod(extent) ** (1.0 / 3.0))
    D_vol = float(dia.value)
    ref = ShapeReference(STATUS_OK, D_vol_km=D_vol, D_vol_err_km=float(dia.sigma) if dia.sigma else None,
                         extent_km=extent, extent_volume_diameter_km=D_ext, axes_km=[x * D_vol / D_ext for x in extent],
                         sources={"diameter": dia.reference, "extent": ext.reference})
    if abs(D_vol / D_ext - 1.0) > 0.15:
        ref.warnings.append(f"The catalogue diameter ({D_vol:.4g} km) differs from the volume-equivalent diameter of the "
                            f"extent ({D_ext:.4g} km) by {100 * (D_vol / D_ext - 1):+.0f}%: it may not be volume-equivalent.")

    need = ["mjd", "wavelength_um", "pred_ra_deg", "pred_dec_deg", "delta_au"]
    if spectrum is None or spectrum.empty or not set(need) <= set(spectrum.columns):
        return ShapeReference(STATUS_NOT_APPLICABLE, "no thermal points with geometry")
    d = spectrum.copy()
    d = d[(d["wavelength_um"].to_numpy(float) >= thermal_min_um)
          & np.isfinite(d[need].to_numpy(float)).all(axis=1)]
    if "quality_flag" in d:
        d = d[d["quality_flag"].astype(str) != "BAD"]
    if d.empty:
        return ShapeReference(STATUS_NOT_APPLICABLE, f"no points at >= {thermal_min_um} um")
    d = d.reset_index(drop=True)
    geo = viewing_geometry(d)
    lam_all = d["wavelength_um"].to_numpy(float)
    keys = np.round(d["mjd"].to_numpy(float) / EPOCH_BIN_DAYS).astype(np.int64)
    epochs = np.unique(keys)
    max_epochs = int(cfg.get("max_epochs", 40))
    if len(epochs) > max_epochs:
        epochs = epochs[np.linspace(0, len(epochs) - 1, max_epochs).round().astype(int)]

    alb = sbdb.param("albedo")
    if alb is not None and alb.value:
        pV, pv_src = float(alb.value), "catalogue albedo"
    elif H is not None:
        pV, pv_src = (1329.0 * 10 ** (-float(H) / 5) / D_vol) ** 2, "H and catalogue diameter"
    else:
        pV, pv_src = 0.1, "assumed 0.1"
    A = float(min((phase or PhaseLaw(G=0.15 if G is None else float(G))).phase_integral() * pV, 0.9))
    eta = float(eta) if eta else 1.0
    n_rot = int(cfg.get("rotation_phases", 36))
    nu, nv = (int(x) for x in cfg.get("mesh", [90, 180]))
    normals, areas = ellipsoid_facets(*(x / 2.0 for x in ref.axes_km), n_u=nu, n_v=nv)

    def ln_ratios(pole_vec, use_epochs, n_r):
        out = []
        for k in use_epochs:
            i = np.flatnonzero(keys == k)
            ts, to = _unit(geo["to_sun"][i].mean(axis=0)), _unit(geo["to_obs"][i].mean(axis=0))
            al = float(np.degrees(np.arccos(np.clip(ts @ to, -1.0, 1.0))))
            out.append(np.log(rotation_averaged_ratio(normals, areas, D_vol, pole_vec, ts, to,
                                                      float(geo["r_au"][i].mean()), float(geo["delta_au"][i].mean()),
                                                      al, lam_all[i], eta, A, emissivity, n_r)))
        return np.concatenate(out)

    used = np.isin(keys, epochs)
    pole_p = sbdb.param("pole")
    pole = parse_pole(pole_p.raw_value) if pole_p is not None else None
    if pole is not None:
        pu = radec_unit(*pole)
        ref.factor = float(np.exp(0.5 * ln_ratios(pu, epochs, n_rot).mean()))
        ref.pole_ra_dec_deg = [float(pole[0]), float(pole[1])]
        ref.sources["pole"] = pole_p.reference
        lat_o = np.degrees(np.arcsin(np.clip(geo["to_obs"][used] @ pu, -1, 1)))
        lat_s = np.degrees(np.arcsin(np.clip(geo["to_sun"][used] @ pu, -1, 1)))
        ref.sub_observer_lat_deg = [float(lat_o.min()), float(np.median(lat_o)), float(lat_o.max())]
        ref.sub_solar_lat_deg = [float(lat_s.min()), float(np.median(lat_s)), float(lat_s.max())]
    else:
        rng = np.random.default_rng(int(cfg.get("seed", 0)))
        poles = rng.normal(size=(int(cfg.get("random_poles", 48)), 3))
        poles /= np.linalg.norm(poles, axis=1, keepdims=True)
        few = epochs[np.linspace(0, len(epochs) - 1, min(4, len(epochs))).round().astype(int)]
        fs = np.array([np.exp(0.5 * ln_ratios(p, few, max(12, n_rot // 2)).mean()) for p in poles])
        lo, med, hi = (float(x) for x in np.percentile(fs, [16, 50, 84]))
        ref.status, ref.factor, ref.factor_interval_68 = STATUS_POLE_UNKNOWN, med, [lo, hi]
        ref.D_eff_interval_68_km = [lo * D_vol, hi * D_vol]
        ref.warnings.append("No spin pole in SBDB: f is the median over isotropic poles, and its 68% range is part of "
                            "the comparison uncertainty.")
    ref.D_eff_km = ref.factor * D_vol
    ref.phase_deg = float(np.median(geo["phase_deg"][used]))
    ref.eta, ref.bond_albedo = eta, A
    ref.sources["bond_albedo"] = f"phase integral x pV, pV {pV:.3g} from the {pv_src}"
    ref.n_points, ref.n_epochs = int(used.sum()), int(len(epochs))
    # the geometry is recomputed here; it must agree with the ephemeris stored with the photometry
    for col, key, tol, unit in (("phase_deg", "phase_deg", 1.0, "deg"), ("r_au", "r_au", 0.01, "au")):
        if col in d:
            dev = np.nanmax(np.abs(d[col].to_numpy(float)[used] - geo[key][used]))
            if np.isfinite(dev) and dev > tol:
                ref.warnings.append(f"Recomputed {col} differs from the stored ephemeris by up to {dev:.3g} {unit}.")
    return ref
