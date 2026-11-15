"""SYNTHETIC test data generator - for unit tests and method checks only.

Every table produced here carries origin = SIMULATED, and file names written by
`write_simulated` contain 'SIMULATED'. Synthetic data must never be used for
scientific conclusions or written to the observed-data database.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..common import status
from ..common.config import resolve
from ..physical.phase_function import hg_phi
from ..physical.thermal_model import neatm_flux_jy
from ..preprocessing.solar_spectrum import SolarSpectrum, blackbody_sun

AU_KM = 1.495978707e8


def synthetic_spectrum(D_km=1.0, pV=0.25, H=None, G=0.15, eta=1.2, r_au=1.2, delta_au=0.3, alpha_deg=50.0,
                       reflectance_fn=None, snr=50.0, n=300, emissivity=0.9, seed=0,
                       solar: SolarSpectrum | None = None, span_days: float = 20.0,
                       lightcurve: dict | None = None) -> tuple[pd.DataFrame, dict]:
    """lightcurve: {"P_h": period, "coeffs": [a1, b1, a2, b2]} in magnitudes (zero mean); multiplies
    both reflected and thermal flux at each point's (random) epoch."""
    rng = np.random.default_rng(seed)
    solar = solar or blackbody_sun()
    lam = np.sort(rng.uniform(0.75, 5.0, n))
    if H is None:
        H = 5 * np.log10(1329.0 / (D_km * np.sqrt(pV)))
    refl_shape = reflectance_fn(lam) if reflectance_fn else 1.0 + 0.1 * (lam - 2.0)
    p_lam = pV * refl_shape / (reflectance_fn(np.array([0.55]))[0] if reflectance_fn else 1.0 + 0.1 * (0.55 - 2.0))
    K = p_lam * (D_km / 2) ** 2
    S = solar.at(lam, bandwidth_um=lam / 40) / r_au ** 2 * hg_phi(alpha_deg, G) / (delta_au * AU_KM) ** 2
    F_ref = S * K
    A = (0.290 + 0.684 * G) * pV
    F_th = neatm_flux_jy(lam, D_km, eta, r_au, delta_au, alpha_deg, A, emissivity)
    mjd = 61000.0 + rng.uniform(0, span_days, n)
    lc = np.ones(n)
    if lightcurve:
        from ..preprocessing.thermal_separation import ThermalSeparator
        lc = ThermalSeparator.lightcurve_factor(np.asarray(lightcurve["coeffs"], float),
                                                2 * np.pi * mjd * 24.0 / lightcurve["P_h"])
    F = (F_ref + F_th) * lc * 1e6
    err = F / snr
    F_obs = F + rng.normal(0, 1, n) * err
    df = pd.DataFrame({"mjd": mjd, "wavelength_um": lam, "bandwidth_um": lam / 40, "flux_uJy": F_obs, "flux_err_uJy": err,
                       "snr": F_obs / err, "quality_flag": status.Q_GOOD, "r_au": r_au, "delta_au": delta_au,
                       "phase_deg": alpha_deg, "origin": status.ORIGIN_SIMULATED,
                       "true_reflected_uJy": F_ref * 1e6, "true_thermal_uJy": F_th * 1e6})
    truth = {"D_km": D_km, "pV": pV, "H": H, "G": G, "eta": eta, "origin": status.ORIGIN_SIMULATED}
    return df, truth


def write_simulated(df: pd.DataFrame, name: str) -> Path:
    if (df.get("origin") != status.ORIGIN_SIMULATED).any():
        raise ValueError("Only SIMULATED tables can be written by this function.")
    d = resolve("data/simulation")
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"SIMULATED_{name}.csv"
    df.to_csv(p, index=False)
    return p


def synthetic_spherex_observations(taxon: str = "S", extra_slope_per_um: float = 0.0, D_km: float = 16.8,
                                   pV: float = 0.25, G: float = 0.15, eta: float = 1.4, r_au=(1.14, 1.13),
                                   delta_au=(0.45, 0.49), alpha_deg=(59.0, 60.5), span_days: float = 14.0,
                                   visits_per_family: int = 8, snr: float = 40.0, rotation_period_h: float = 5.27,
                                   lc_swir=(0.05, 0.0, 0.30, 0.25), lc_mwir=None, repeat_starts: int = 3,
                                   seed: int = 0, solar: SolarSpectrum | None = None) -> tuple[pd.DataFrame, dict]:
    """SIMULATED SPHEREx-like asteroid photometry with the real observing structure:
    detector families (B1+B4, B2+B5, B3+B6) observed in separate visits of 4 exposures (2 min apart,
    stepping ~lambda/44 in wavelength), spread over `span_days`. Visits of a family start at one of
    `repeat_starts` wavelengths, which creates repeated observations of the same wavelength
    (repeat_starts=None draws continuous random starts). Reflectance follows a Bus-DeMeo class mean
    (constant beyond 2.45 um - a synthetic assumption) times (1 + extra_slope (lambda - 1.2 um));
    thermal emission is NEATM; a rotational lightcurve (Fourier coefficients in mag, per arm)
    multiplies the flux. origin = SIMULATED."""
    from ..classification.reference_library import load_busdemeo, resample_reference
    from ..common.constants import SPHEREX_BANDS

    rng = np.random.default_rng(seed)
    solar = solar or blackbody_sun()
    ref = load_busdemeo()[taxon]
    lc_mwir = lc_swir if lc_mwir is None else lc_mwir
    t0 = 61070.0
    rows = []
    fams = [("B1", "B4"), ("B2", "B5"), ("B3", "B6")]
    k_obs = 0
    for fs, fm in fams:
        bs, bm = SPHEREX_BANDS[fs], SPHEREX_BANDS[fm]
        span_s = bs["max_um"] - bs["min_um"]
        starts = (bs["min_um"] + span_s * (np.arange(repeat_starts) + 0.5) / repeat_starts * 0.75
                  if repeat_starts else None)
        for v in range(visits_per_family):
            tv = t0 + rng.uniform(0, span_days)
            l0 = rng.choice(starts) if repeat_starts else rng.uniform(bs["min_um"], bs["max_um"] - 0.1 * span_s)
            for e in range(4):
                mjd = tv + e * 2.0 / 1440.0
                lam_s = l0 * (1 + 1 / 44.0) ** e
                if lam_s > bs["max_um"]:
                    continue
                frac = (lam_s - bs["min_um"]) / span_s
                lam_m = bm["min_um"] + frac * (bm["max_um"] - bm["min_um"])
                k_obs += 1
                for det, band, lam in ((bs["detector"], fs, lam_s), (bm["detector"], fm, lam_m)):
                    rows.append({"obs_id": f"SIM{k_obs:05d}", "detector": det, "band": band, "mjd": mjd,
                                 "wavelength_um": lam, "bandwidth_um": lam / 40.0})
    df = pd.DataFrame(rows)
    u = (df["mjd"] - t0) / max(span_days, 1e-9)
    df["r_au"] = r_au[0] + (r_au[1] - r_au[0]) * u
    df["delta_au"] = delta_au[0] + (delta_au[1] - delta_au[0]) * u
    df["phase_deg"] = alpha_deg[0] + (alpha_deg[1] - alpha_deg[0]) * u
    lam = df["wavelength_um"].values
    rr, _, inside = resample_reference(ref, np.clip(lam, 0.45, 2.45), 40, 0.55)
    shape = rr * (1 + extra_slope_per_um * (lam - 1.2))
    p_lam = pV * shape
    S = solar.at(lam, bandwidth_um=lam / 40) / df["r_au"].values ** 2 * hg_phi(df["phase_deg"].values, G) / \
        (df["delta_au"].values * AU_KM) ** 2
    F_ref = S * p_lam * (D_km / 2) ** 2
    A = (0.290 + 0.684 * G) * pV
    F_th = neatm_flux_jy(lam, D_km, eta, df["r_au"].values, df["delta_au"].values, df["phase_deg"].values, A, 0.9)
    phase = 2 * np.pi * ((df["mjd"].values * 24.0 / rotation_period_h) % 1.0)

    def lc(coeffs):
        L = np.zeros_like(phase)
        for k in range(len(coeffs) // 2):
            L += coeffs[2 * k] * np.cos((k + 1) * phase) + coeffs[2 * k + 1] * np.sin((k + 1) * phase)
        return 10 ** (-0.4 * L)

    swir = lam < 2.42
    fac = np.where(swir, lc(lc_swir) if lc_swir else 1.0, lc(lc_mwir) if lc_mwir else 1.0)
    F = (F_ref + F_th) * fac * 1e6
    err = F / snr
    df["flux_uJy"] = F + rng.normal(0, 1, len(F)) * err
    df["flux_err_uJy"] = err
    df["snr"] = df["flux_uJy"] / err
    df["quality_flag"] = status.Q_GOOD
    df["origin"] = status.ORIGIN_SIMULATED
    truth = {"taxon": taxon, "D_km": D_km, "pV": pV, "G": G, "eta": eta, "H": 5 * np.log10(1329.0 / (D_km * np.sqrt(pV))),
             "rotation_period_h": rotation_period_h, "lc_swir": lc_swir, "lc_mwir": lc_mwir,
             "extra_slope_per_um": extra_slope_per_um, "origin": status.ORIGIN_SIMULATED}
    return df.sort_values("mjd").reset_index(drop=True), truth
