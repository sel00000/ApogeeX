"""Reflectance calibration: thermal-corrected flux divided by the solar flux scaled to each
point's geometry, normalised at a reference wavelength (default 1.25 um because SPHEREx
does not cover the 0.55 um normalisation of the Bus-DeMeo system)."""
from .thermal_separation import reflectance_spectrum  # noqa: F401
from .solar_spectrum import load_solar_spectrum  # noqa: F401
