"""Recovery tests on SYNTHETIC spectra (origin = SIMULATED)."""
import numpy as np
import pytest

from src.common import status
from src.preprocessing.solar_spectrum import blackbody_sun
from src.preprocessing.thermal_separation import ThermalSeparator, reflectance_spectrum
from src.validation.simulation import synthetic_spectrum


@pytest.fixture(scope="module")
def sep():
    return ThermalSeparator(solar=blackbody_sun())


def test_recovers_diameter_with_H(sep):
    df, truth = synthetic_spectrum(D_km=1.5, pV=0.2, eta=1.3, r_au=1.1, delta_au=0.25, alpha_deg=55, snr=80,
                                   solar=sep.solar)
    assert (df["origin"] == status.ORIGIN_SIMULATED).all()
    res = sep.fit(df, H=truth["H"], H_err=0.05, G=0.15)
    assert res.status == "OK"
    assert res.D_km == pytest.approx(1.5, rel=0.05)
    assert res.eta == pytest.approx(1.3, rel=0.1)
    assert res.chi2_red < 2.0
    # thermal component recovered at 4.8 um
    pts = res.points
    sel = pts["wavelength_um"] > 4.5
    ratio = (pts.loc[sel, "model_thermal_uJy"] / pts.loc[sel, "true_thermal_uJy"]).median()
    assert ratio == pytest.approx(1.0, rel=0.1)


def test_without_H_gives_conditional_range_only(sep):
    df, truth = synthetic_spectrum(D_km=1.0, pV=0.15, eta=1.2, r_au=1.1, delta_au=0.2, alpha_deg=50, snr=60,
                                   solar=sep.solar)
    res = sep.fit(df, H=None)
    assert res.status == "CONDITIONAL"
    assert res.D_km is None
    lo, hi = res.conditional_D_range_km
    assert lo <= 1.0 * 1.1 and hi >= 1.0 * 0.9


def test_insufficient_thermal_for_bright_distant_object(sep):
    # pV=0.5 at 8 au: thermal/reflected ~2e-4 at 5 um -> no diameter may be derived
    df, truth = synthetic_spectrum(D_km=20.0, pV=0.5, eta=1.0, r_au=8.0, delta_au=7.1, alpha_deg=8, snr=5, n=40,
                                   solar=sep.solar, seed=3)
    res = sep.fit(df, H=truth["H"])
    assert res.status == "INSUFFICIENT_THERMAL"
    assert res.D_km is None


def test_excess_significance_is_calibrated_on_noise(sep):
    """Unit-variance statistic on pure noise. The true continuum slopes are drawn like those of real asteroids
    (thermal_model.continuum_slope_prior): the statistic uses the posterior slope uncertainty, which is the right
    one for an asteroid whose slope is unknown. With one fixed slope for every draw it is conservative (std 0.38
    on 2026-11-15, no false alarm); with slopes drawn from the prior range std 0.85."""
    sp = sep.cfg["continuum_slope_prior"]
    vals = []
    for s in range(30):
        k = np.random.default_rng(500 + s).normal(sp["mean_per_um"], sp["sigma_per_um"])
        df, truth = synthetic_spectrum(D_km=20.0, pV=0.5, eta=1.0, r_au=8.0, delta_au=7.1, alpha_deg=8, snr=5,
                                       n=40, solar=sep.solar, seed=s,
                                       reflectance_fn=lambda lam, k=k: 1.0 + k * (np.asarray(lam) - 2.0))
        vals.append(sep.fit(df, H=truth["H"]).thermal_excess_snr)
    assert 0.6 < np.std(vals) < 1.5
    assert max(vals) < 3.0                # no false thermal detection on noise


def test_weak_thermal_eta_stays_near_literature_prior(sep):
    # Main-belt geometry: only the Wien tail is sampled, thermal S/N ~6. eta is fitted with the
    # Trilling et al. (2016) eta(alpha) prior, which carries the D-eta degeneracy into D's error.
    df, truth = synthetic_spectrum(D_km=5.0, pV=0.3, eta=1.0, r_au=3.3, delta_au=2.5, alpha_deg=15, snr=50,
                                   solar=sep.solar)
    res = sep.fit(df, H=truth["H"])
    assert res.status == "OK" and res.eta_fitted
    assert res.eta_prior["relation"] == "trilling2016"
    assert res.eta_prior["eta0"] == pytest.approx(0.87 + 0.01 * 15)
    assert abs(res.eta - res.eta_prior["eta0"]) < 0.3            # weak data: posterior near the prior
    assert abs(res.D_km - 5.0) < 3 * res.D_err_km
    assert any("literature prior" in w for w in res.warnings)


def test_eta_prior_relations_from_config():
    s = ThermalSeparator(solar=blackbody_sun())
    t = s.eta_prior(60.0)
    assert t["eta0"] == pytest.approx(1.47) and t["sigma_minus"] == 0.30 and t["sigma_plus"] == 0.55
    assert "Trilling" in t["reference"]
    s.cfg = dict(s.cfg, eta_prior_relation="mainzer2011")
    assert s.eta_prior(60.0)["eta0"] == pytest.approx(0.761 + 0.00963 * 60)


def test_legacy_fixed_eta_mode_falls_back(sep):
    from src.common.config import settings
    cfg = dict(settings()["thermal_model"], eta_mode="fixed")
    s = ThermalSeparator(solar=sep.solar, cfg=cfg)
    df, truth = synthetic_spectrum(D_km=5.0, pV=0.3, eta=1.0, r_au=3.3, delta_au=2.5, alpha_deg=15, snr=50,
                                   solar=sep.solar)
    res = s.fit(df, H=truth["H"])
    assert res.status == "OK" and not res.eta_fitted
    assert res.D_err_eta_sys_km > 0
    assert any("eta fixed" in w or "bound" in w for w in res.warnings)


def test_missing_geometry_is_insufficient(sep):
    df, _ = synthetic_spectrum(solar=sep.solar)
    df = df.drop(columns=["r_au"])
    assert sep.fit(df, H=15).status == status.INSUFFICIENT_DATA


def test_reflectance_normalised(sep):
    df, truth = synthetic_spectrum(D_km=1.5, pV=0.2, eta=1.3, r_au=1.1, delta_au=0.25, alpha_deg=55, snr=80,
                                   solar=sep.solar)
    res = sep.fit(df, H=truth["H"], G=0.15)
    refl = reflectance_spectrum(res.points, sep.solar, 0.15)
    near = refl[(refl["wavelength_um"] - 1.25).abs() < 0.05]
    assert near["reflectance"].mean() == pytest.approx(1.0, abs=0.03)


def test_reflectance_normalised_by_interpolation_without_a_point_at_lam0(sep):
    """A subset of exposures can miss the normalisation wavelength (308 Polyxo, 2026-11-14: no point
    within 0.05 um of 1.2 um, so no reflectance and no classification). The value at lam0 is then
    interpolated from both sides, never extrapolated."""
    from src.common.config import settings
    lam0 = settings()["reflectance"]["normalization_wavelength_um"]
    df, truth = synthetic_spectrum(D_km=1.5, pV=0.2, eta=1.3, r_au=1.1, delta_au=0.25, alpha_deg=55, snr=80,
                                   solar=sep.solar)
    res = sep.fit(df, H=truth["H"], G=0.15)
    gap = res.points[(res.points["wavelength_um"] - lam0).abs() >= 0.05]
    refl = reflectance_spectrum(gap, sep.solar, 0.15)
    assert "interpolation" in refl.attrs["normalization"]
    near = refl[(refl["wavelength_um"] - lam0).abs() < 0.12]
    assert near["reflectance"].mean() == pytest.approx(1.0, abs=0.03)
    one_side = res.points[res.points["wavelength_um"] > lam0 + 0.05]
    assert refl is not None and reflectance_spectrum(one_side, sep.solar, 0.15)["reflectance"].isna().all()


def test_rotational_lightcurve_is_fitted_not_aliased_into_spectrum():
    """Elongated rotator (0.8 mag peak-to-peak, P = 5.27 h) sampled at random rotational phases,
    as SPHEREx does across exposures (cf. 433 Eros in DR1)."""
    sol = blackbody_sun()
    lcurve = {"P_h": 5.270258, "coeffs": [0.05, 0.0, 0.30, 0.25]}
    df, truth = synthetic_spectrum(D_km=16.8, pV=0.25, eta=1.4, r_au=1.13, delta_au=0.47, alpha_deg=60, snr=50,
                                   solar=sol, lightcurve=lcurve)
    plain = ThermalSeparator(solar=sol).fit(df, H=truth["H"])
    withlc = ThermalSeparator(solar=sol, rotation_period_h=5.270258).fit(df, H=truth["H"])
    assert withlc.status == "OK"
    assert withlc.chi2_red < 1.5 < plain.chi2_red
    assert withlc.lightcurve_amplitude_mag == pytest.approx(0.8, abs=0.1)
    tot = np.hypot(withlc.D_err_km or 0, withlc.D_err_eta_sys_km or 0)
    assert abs(withlc.D_km - 16.8) < 3 * tot
    # reflectance (thermal removed, lightcurve normalised) is smooth again
    refl = reflectance_spectrum(withlc.points, sol, 0.15)
    sw = refl[(refl["wavelength_um"] > 0.8) & (refl["wavelength_um"] < 2.4)]
    resid = sw["reflectance"] - np.polyval(np.polyfit(sw["wavelength_um"], sw["reflectance"], 2), sw["wavelength_um"])
    assert np.std(resid) < 0.05
