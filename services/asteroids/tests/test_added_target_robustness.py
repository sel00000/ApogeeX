"""Regression tests for the failures found when three targets were added on 2026-11-15
(64 Angelina, 596 Scheila, 35107 (1991 VH)). All inputs are SIMULATED."""
import copy

import numpy as np
import pandas as pd
import pytest

from src.common.config import settings
from src.integration.population_context import catalogue_albedo
from src.integration.spectrum_analysis import _implausible_saturation
from src.preprocessing.solar_spectrum import blackbody_sun
from src.preprocessing.spectrum_cleaning import reject_outliers
from src.preprocessing.temporal_analysis import geometric_log_scale
from src.preprocessing.thermal_separation import ThermalSeparator
from src.validation.simulation import synthetic_spectrum


def _two_distance_points(seed=0, n=60):
    """Reflected-light points of one object seen alternately at Delta 0.1 and 0.3 au (flux ~ 1/Delta^2), as a
    near-Earth asteroid during a close approach."""
    rng = np.random.default_rng(seed)
    lam = np.sort(rng.uniform(1.6, 2.4, n))
    delta = np.where(np.arange(n) % 2 == 0, 0.1, 0.3)
    flux = 1000.0 * (0.3 / delta) ** 2 * (1 + 0.05 * rng.normal(size=n))
    return pd.DataFrame({"wavelength_um": lam, "flux_uJy": flux, "flux_err_uJy": 0.05 * flux,
                         "r_au": 1.05, "delta_au": delta, "phase_deg": 60.0})


def test_outliers_are_compared_at_one_geometry():
    df = _two_distance_points()
    blends = df.index[df["delta_au"] == 0.3][[3, 17]]
    df.loc[blends, "flux_uJy"] *= 15         # star blends on distant visits: only 1.7x the near-visit fluxes
    df["_g"] = geometric_log_scale(df, 0.15, 1.0, 0.9, thermal_min_um=np.inf)
    new = reject_outliers(df, "flux_uJy", "flux_err_uJy", scale_col="_g")
    assert set(new.index[new["outlier"]]) == set(blends)
    old = reject_outliers(df, "flux_uJy", "flux_err_uJy")           # raw fluxes: the geometry spread hides them
    assert not set(blends) <= set(old.index[old["outlier"]])


def test_saturation_flag_on_an_object_too_faint_to_saturate_is_removed():
    df = _two_distance_points()
    df["core_flags"] = ""
    df.loc[[4, 9], "core_flags"] = "OVERFLOW|SOURCE"
    kept, n = _implausible_saturation(df, H=16.9, G=0.15)          # V ~ 14-16.5: cannot saturate
    assert n == 2 and len(kept) == len(df) - 2
    kept, n = _implausible_saturation(df, H=5.0, G=0.15)           # V ~ 2-5: saturation possible, points kept
    assert n == 0 and len(kept) == len(df)
    assert _implausible_saturation(df, H=None, G=0.15)[1] == 0      # no H, no test


@pytest.fixture(scope="module")
def sep_pair():
    cfg = copy.deepcopy(settings()["thermal_model"])
    assert cfg.get("continuum_slope_prior")
    free = copy.deepcopy(cfg)
    free.pop("continuum_slope_prior")
    sun = blackbody_sun()
    return ThermalSeparator(solar=sun, cfg=cfg), ThermalSeparator(solar=sun, cfg=free)


def test_continuum_slope_prior_keeps_a_noisy_continuum_from_hiding_the_thermal_excess(sep_pair):
    """A near-Earth asteroid (D 1 km, r 1.05 au) whose continuum has few points (~14), S/N 6 and 0.6 (ln) scatter
    between visits, as 35107: the free slope wanders and swallows the thermal excess in most draws; with the prior
    the excess is detected more often and the diameter stays unbiased."""
    with_prior, free = sep_pair
    det_a = det_b = 0
    slopes_a, slopes_b, diameters = [], [], []
    for seed in range(20):
        df, truth = synthetic_spectrum(D_km=1.0, pV=0.3, eta=1.5, r_au=1.05, delta_au=0.2, alpha_deg=60, snr=6, n=70,
                                       solar=with_prior.solar, seed=seed)
        cont = (df["wavelength_um"] >= 1.6) & (df["wavelength_um"] <= 2.5)
        df.loc[cont, "flux_uJy"] *= np.exp(0.6 * np.random.default_rng(100 + seed).normal(size=int(cont.sum())))
        a = with_prior.fit(df, H=truth["H"], G=0.15)
        b = free.fit(df, H=truth["H"], G=0.15)
        det_a += a.status == "OK"
        det_b += b.status == "OK"
        slopes_a.append(abs(a.slope_per_um or 0.0))
        slopes_b.append(abs(b.slope_per_um or 0.0))
        if a.status == "OK":
            diameters.append(a.D_km)
    assert det_a >= det_b + 3                                   # 13 vs 7 of 20 on 2026-11-15
    assert np.median(slopes_a) < 0.15 < 0.2 < np.median(slopes_b)
    assert np.median(diameters) == pytest.approx(1.0, rel=0.15)


def test_albedo_uncertainty_includes_the_catalogue_disagreement():
    H, D = 8.92, 159.726                         # catalogue diameter whose albedo (0.040) used an older H
    lp, s, why = catalogue_albedo(D, 1.1, 0.040, None, H, offset_dex=-0.108)
    assert lp == pytest.approx(np.log10(0.0187), abs=0.01)
    assert s > 0.2 and "disagrees" in why
    consistent = 10 ** (lp + 0.108)              # the albedo the catalogue would give with the usual offset
    _, s2, why2 = catalogue_albedo(D, 1.1, consistent, None, H, offset_dex=-0.108)
    assert s2 == pytest.approx(0.1, abs=0.005) and "disagrees" not in why2
    lp3, s3, why3 = catalogue_albedo(None, None, 0.05, None, H, offset_dex=-0.108)   # albedo only
    assert lp3 == pytest.approx(np.log10(0.05) - 0.108) and "shifted" in why3
