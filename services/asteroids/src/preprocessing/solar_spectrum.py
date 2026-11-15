"""Solar spectral flux density at 1 au.

Preferred: sbpy's built-in E490_2014 spectrum (ASTM E-490 standard extraterrestrial
spectrum). Alternative: a user CSV (wavelength_um, flux_W_m2_um). If neither is
available, a 5772 K blackbody scaled to the solar constant is used and labelled
APPROXIMATION so downstream reflectance results carry a reduced confidence.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..common.config import resolve, settings
from ..common.constants import AU_M, C_LIGHT, JY, R_SUN_M, T_SUN_EFF
from ..physical.thermal_model import planck_nu_jy_sr


@dataclass
class SolarSpectrum:
    wavelength_um: np.ndarray
    flux_jy: np.ndarray          # F_nu at 1 au, Jy
    name: str
    is_approximation: bool

    def at(self, wavelength_um, bandwidth_um=None, resolving_power: float | None = None):
        """Solar flux averaged over a Gaussian bandpass (FWHM = bandwidth or lambda/R)."""
        lam = np.atleast_1d(np.asarray(wavelength_um, float))
        if bandwidth_um is None and resolving_power is None:
            return np.interp(lam, self.wavelength_um, self.flux_jy)
        fwhm = (np.atleast_1d(bandwidth_um) * np.ones_like(lam) if bandwidth_um is not None
                else lam / resolving_power)
        out = np.empty_like(lam)
        for i, (l0, fw) in enumerate(zip(lam, fwhm)):
            s = fw / 2.3548
            m = (self.wavelength_um > l0 - 4 * s) & (self.wavelength_um < l0 + 4 * s)
            if m.sum() < 3:
                out[i] = np.interp(l0, self.wavelength_um, self.flux_jy)
                continue
            wts = np.exp(-0.5 * ((self.wavelength_um[m] - l0) / s) ** 2)
            out[i] = np.sum(wts * self.flux_jy[m]) / np.sum(wts)
        return out


def _flam_to_fnu_jy(lam_um, flam_W_m2_um):
    lam_m = lam_um * 1e-6
    return flam_W_m2_um * 1e6 * lam_m ** 2 / C_LIGHT / JY


def blackbody_sun() -> SolarSpectrum:
    lam = np.linspace(0.3, 6.0, 5000)
    fnu = np.pi * planck_nu_jy_sr(lam, T_SUN_EFF) * (R_SUN_M / AU_M) ** 2
    return SolarSpectrum(lam, fnu, f"Blackbody T={T_SUN_EFF} K (APPROXIMATION)", True)


def load_solar_spectrum(spec: str | None = None) -> SolarSpectrum:
    spec = spec or settings()["thermal_model"]["solar_spectrum"]
    if spec.startswith("sbpy:"):
        try:
            import astropy.units as u
            from sbpy.calib import Sun
            sun = Sun.from_builtin(spec.split(":", 1)[1])
            lam = sun.wave.to(u.um).value
            fnu = sun.fluxd.to(u.Jy, u.spectral_density(sun.wave)).value
            m = (lam > 0.3) & (lam < 6.0)
            return SolarSpectrum(lam[m], fnu[m], f"sbpy {spec.split(':', 1)[1]}", False)
        except Exception:
            return blackbody_sun()
    path = resolve(spec)
    if path.exists():
        data = np.genfromtxt(path, delimiter=",", names=True)
        lam = np.asarray(data["wavelength_um"], float)
        return SolarSpectrum(lam, _flam_to_fnu_jy(lam, np.asarray(data["flux_W_m2_um"], float)),
                             path.name, False)
    return blackbody_sun()
