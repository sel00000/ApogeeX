"""Thermal emission models.

NEATM (Harris 1998, Icarus 131, 291):
    T_ss = [ (1 - A) S0 / (eta * eps * sigma * r^2) ]^(1/4)          (r in au, S0 at 1 au)
    T(theta, phi) = T_ss cos^(1/4)(theta) cos^(1/4)(phi)   on the day side, 0 at night
    F_nu(lambda) = eps D^2 / (4 Delta^2) *
                   Int_{-pi/2}^{pi/2} dphi Int_{alpha-pi/2}^{pi/2} dtheta
                   B_nu(lambda, T(theta,phi)) cos^2(phi) cos(theta - alpha)
  theta: longitude from the sub-solar meridian, phi: latitude, alpha: phase angle.
  The integration domain is the illuminated part of the visible hemisphere.
  A = q * pV is the bolometric Bond albedo (q from the H-G phase integral).

TPM: requires thermal inertia, spin state, shape and roughness. It is not implemented;
`thermophysical_model` raises with the list of missing inputs instead of approximating.
"""
from __future__ import annotations

import numpy as np

from ..common.constants import AU_KM, C_LIGHT, H_PLANCK, JY, K_BOLTZMANN, SIGMA_SB, SOLAR_CONSTANT


def planck_nu_jy_sr(wavelength_um, T):
    """Planck B_nu in Jy/sr. wavelength_um and T broadcast."""
    lam = np.asarray(wavelength_um, float) * 1e-6
    T = np.asarray(T, float)
    nu = C_LIGHT / lam
    with np.errstate(over="ignore", divide="ignore", invalid="ignore"):
        x = H_PLANCK * nu / (K_BOLTZMANN * T)
        b = 2 * H_PLANCK * nu ** 3 / C_LIGHT ** 2 / np.expm1(x)
    b = np.where((T > 0) & np.isfinite(b), b, 0.0)
    return b / JY


def subsolar_temperature(r_au, eta, bond_albedo, emissivity):
    return ((1.0 - bond_albedo) * SOLAR_CONSTANT / (eta * emissivity * SIGMA_SB * np.asarray(r_au) ** 2)) ** 0.25


_GL_CACHE: dict = {}


def _gauss_legendre(n):
    if n not in _GL_CACHE:
        _GL_CACHE[n] = np.polynomial.legendre.leggauss(n)
    return _GL_CACHE[n]


def neatm_flux_jy(wavelength_um, D_km, eta, r_au, delta_au, alpha_deg, bond_albedo,
                  emissivity=0.9, nodes=48):
    """NEATM thermal flux density (Jy) at each wavelength. r, delta, alpha may be arrays
    of the same length as wavelength (per-point geometry), or scalars."""
    lam = np.atleast_1d(np.asarray(wavelength_um, float))
    r = np.broadcast_to(np.asarray(r_au, float), lam.shape)
    dl = np.broadcast_to(np.asarray(delta_au, float), lam.shape)
    al = np.radians(np.broadcast_to(np.asarray(alpha_deg, float), lam.shape))
    tss = subsolar_temperature(r, eta, bond_albedo, emissivity)

    x, w = _gauss_legendre(nodes)
    # latitude phi in [-pi/2, pi/2]                                     shape (nphi,)
    phi = 0.5 * np.pi * x
    wphi = 0.5 * np.pi * w
    # longitude theta in [alpha - pi/2, pi/2], per point                shape (N, nth)
    lo = al - 0.5 * np.pi
    hi = np.full_like(al, 0.5 * np.pi)
    theta = 0.5 * (hi - lo)[:, None] * x[None, :] + 0.5 * (hi + lo)[:, None]
    wth = 0.5 * (hi - lo)[:, None] * w[None, :]
    cos_th = np.clip(np.cos(theta), 0, None) ** 0.25                    # (N, nth)
    cos_ph = np.clip(np.cos(phi), 0, None) ** 0.25                      # (nphi,)
    T = tss[:, None, None] * cos_ph[None, :, None] * cos_th[:, None, :]  # (N, nphi, nth)
    B = planck_nu_jy_sr(lam[:, None, None], T)
    geom = (np.cos(phi) ** 2)[None, :, None] * np.cos(theta - al[:, None])[:, None, :]
    wts = wphi[None, :, None] * wth[:, None, :]
    integral = np.sum(B * geom * wts, axis=(1, 2))
    return emissivity * (np.asarray(D_km, float) / (dl * AU_KM)) ** 2 / 4.0 * integral


def ellipsoid_facets(a_km: float, b_km: float, c_km: float, n_u: int = 90, n_v: int = 180):
    """Outward unit normals (N, 3) and areas (N,) in km^2 of a triaxial ellipsoid with semi-axes a, b, c along the
    body x, y, z axes (z: spin axis). Midpoint grid on r(u, v) = (a sin u cos v, b sin u sin v, c cos u)."""
    u = (np.arange(n_u) + 0.5) * np.pi / n_u
    v = (np.arange(n_v) + 0.5) * 2.0 * np.pi / n_v
    U, V = np.meshgrid(u, v, indexing="ij")
    su = np.sin(U)
    N = np.stack([b_km * c_km * su ** 2 * np.cos(V), a_km * c_km * su ** 2 * np.sin(V),
                  a_km * b_km * su * np.cos(U)], axis=-1)            # r_u x r_v, outward
    norm = np.linalg.norm(N, axis=-1)
    area = norm * (np.pi / n_u) * (2.0 * np.pi / n_v)
    return (N / norm[..., None]).reshape(-1, 3), area.ravel()


def facet_neatm_flux_jy(wavelength_um, normals, areas_km2, sun_dir, obs_dir, r_au, delta_au, eta, bond_albedo,
                        emissivity=0.9):
    """Thermal flux density (Jy) of a convex faceted body under the NEATM temperature rule applied facet by facet:
    T = T_ss cos(i)^(1/4) on the day side (i: angle between the facet normal and the Sun), no night-side emission,
    summed over the facets that face the observer. sun_dir and obs_dir are unit vectors from the body to the Sun and
    to the observer, in the frame of `normals`. For a sphere this equals neatm_flux_jy; there is no shadowing, so
    the shape must be convex."""
    lam = np.atleast_1d(np.asarray(wavelength_um, float))
    ci = normals @ np.asarray(sun_dir, float)
    ce = normals @ np.asarray(obs_dir, float)
    m = (ci > 0) & (ce > 0)
    T = subsolar_temperature(r_au, eta, bond_albedo, emissivity) * ci[m] ** 0.25
    B = planck_nu_jy_sr(lam[:, None], T[None, :])
    return emissivity * (B * (ce[m] * areas_km2[m])[None, :]).sum(axis=1) / (float(delta_au) * AU_KM) ** 2


def thermophysical_model(*args, **kwargs):
    raise NotImplementedError(
        "TPM is not implemented. It requires: thermal inertia, spin axis and period, a shape "
        "model, surface roughness, and multi-epoch thermal data. Use NEATM, or provide these "
        "inputs and an external TPM implementation.")
