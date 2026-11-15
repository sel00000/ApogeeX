"""Physical constants (SI unless noted). Values follow CODATA 2018 / IAU 2015."""

H_PLANCK = 6.62607015e-34      # J s
C_LIGHT = 2.99792458e8         # m / s
K_BOLTZMANN = 1.380649e-23     # J / K
SIGMA_SB = 5.670374419e-8      # W m^-2 K^-4
AU_KM = 1.495978707e8          # km
AU_M = 1.495978707e11          # m
R_SUN_M = 6.957e8              # m (IAU 2015 nominal)
T_SUN_EFF = 5772.0             # K (IAU 2015 nominal)
SOLAR_CONSTANT = 1361.0        # W m^-2 (IAU 2015 nominal total solar irradiance)
G_KM3_KG_S2 = 6.67430e-20      # km^3 kg^-1 s^-2
JY = 1.0e-26                   # W m^-2 Hz^-1
ARCSEC2_TO_SR = (3.141592653589793 / 180.0 / 3600.0) ** 2
MJD_TO_JD = 2400000.5

SPHEREX_BANDS = {
    # Nominal ranges from the mission documentation; always confirm against the
    # data release in use. Resolving power is approximate.
    "B1": {"detector": 1, "min_um": 0.75, "max_um": 1.09, "R": 39},
    "B2": {"detector": 2, "min_um": 1.10, "max_um": 1.62, "R": 41},
    "B3": {"detector": 3, "min_um": 1.63, "max_um": 2.41, "R": 41},
    "B4": {"detector": 4, "min_um": 2.42, "max_um": 3.82, "R": 35},
    "B5": {"detector": 5, "min_um": 3.83, "max_um": 4.41, "R": 112},
    "B6": {"detector": 6, "min_um": 4.42, "max_um": 5.00, "R": 128},
}


def band_for_detector(detector: int) -> str:
    for name, info in SPHEREX_BANDS.items():
        if info["detector"] == int(detector):
            return name
    return "Unknown"
