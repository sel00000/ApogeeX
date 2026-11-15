"""Regressions for v2.4.2: rank-deficient spectra and complete phase-model propagation."""
from dataclasses import asdict

import numpy as np
import pandas as pd
import pytest

from src.common import status
from src.integration.result_merger import merge
from src.integration.spectrum_analysis import analyse_spectrum
from src.physical.absolute_magnitude import HResult, estimate_h
from src.physical.phase_function import PhaseLaw, hg1g2_available, hg_phi
from src.preprocessing.solar_spectrum import blackbody_sun
from src.preprocessing.temporal_analysis import geometric_log_scale
from src.preprocessing.thermal_separation import AU_KM, ThermalSeparator, reflectance_spectrum


@pytest.mark.parametrize("spread", [0.0, 1e-12])
def test_repeated_or_unresolved_continuum_returns_insufficient_data(spread):
    df = pd.DataFrame({
        "wavelength_um": list(2 + spread * np.arange(4)) + [4., 4.2, 4.4, 4.6],
        "flux_uJy": [1000., 1010., 990., 1000., 300., 350., 400., 450.],
        "flux_err_uJy": [10.] * 8, "r_au": [2.] * 8,
        "delta_au": [1.] * 8, "phase_deg": [20.] * 8,
    })
    result = ThermalSeparator(solar=blackbody_sun()).fit(df, H=12)
    assert result.status == status.INSUFFICIENT_DATA
    assert result.D_km is None and result.K0_km2 is None
    assert any("continuum" in w and "wavelength" in w for w in result.warnings)
    assert result.provenance


def optical_data():
    sbpy = pytest.importorskip("sbpy.photometry")
    alpha = np.linspace(5, 50, 20)
    mag = sbpy.HG1G2.evaluate(np.radians(alpha), 12., .2, .3) + 5 * np.log10(2.)
    phot = pd.DataFrame({"mjd": 60000. + np.arange(len(alpha)), "mag": mag,
                         "mag_err": .01, "band": "V", "provider": "SIMULATED"})
    geom = pd.DataFrame({"r_au": 2., "delta_au": 1., "phase_deg": alpha})
    return phot, geom


@pytest.mark.skipif(not hg1g2_available(), reason="HG1G2 oracle requires sbpy")
def test_hg1g2_fit_retains_both_coefficients_and_model_in_records():
    from sbpy.photometry import HG1G2
    phot, geom = optical_data()
    h = estimate_h(phot, geom, model="HG1G2")
    assert h.status == "ESTIMATED"
    assert (h.H, h.G1, h.G2) == pytest.approx((12., .2, .3), abs=1e-6)
    assert h.G is None and h.G_err is None
    assert h.G1_err > 0 and h.G2_err > 0
    # Serialization/reconstruction must retain the full fitted phase law.
    law = PhaseLaw.from_h_result(HResult(**asdict(h)))
    expected = 10 ** (-.4 * HG1G2.evaluate(np.radians([0., 30., 60.]), 0., .2, .3))
    np.testing.assert_allclose(law.phi([0., 30., 60.]), expected, rtol=1e-7)
    assert law.phase_integral() == pytest.approx(float(HG1G2(H=0, G1=.2, G2=.3).phaseint), rel=1e-7)
    rec = merge("synthetic", h_result=h, origin=status.ORIGIN_SIMULATED)
    assert rec["phase_function_model"] == "H-G1-G2"
    assert rec["phase_function_parameters"]["G"] is None
    assert rec["phase_function_parameters"]["G1"] == pytest.approx(.2)
    assert rec["phase_function_parameters"]["G2"] == pytest.approx(.3)


def test_missing_hg1g2_dependency_does_not_substitute_hg(monkeypatch):
    import src.physical.absolute_magnitude as hm
    alpha = np.linspace(5., 50., 20)
    phot = pd.DataFrame({"mjd": 60000. + np.arange(20), "mag": 15., "mag_err": .1,
                         "band": "V", "provider": "SIMULATED"})
    geom = pd.DataFrame({"r_au": 2., "delta_au": 1., "phase_deg": alpha})
    monkeypatch.setattr(hm, "hg1g2_available", lambda: False)
    h = estimate_h(phot, geom, model="HG1G2")
    assert h.status == status.H_UNAVAILABLE and h.H is None
    assert h.phase_model == "H-G1-G2" and any("no other phase model" in w for w in h.warnings)


def test_legacy_hg1g2_record_missing_second_coefficient_is_rejected():
    with pytest.raises(ValueError, match="both finite G1 and G2"):
        PhaseLaw.from_h_result(HResult(status="ESTIMATED", H=12., G=.2, phase_model="H-G1-G2"))


@pytest.mark.skipif(not hg1g2_available(), reason="HG1G2 oracle requires sbpy")
def test_phase_geometry_reflection_and_complete_analysis_use_hg1g2():
    from sbpy.photometry import HG1G2
    solar = blackbody_sun()
    law = PhaseLaw("HG1G2", G1=.2, G2=.3)
    lam = np.array([1.24, 1.25, 1.26, 1.7, 1.8, 2., 2.2, 2.3, 2.4, 4., 4.5, 4.7])
    alpha = np.linspace(5., 50., len(lam))
    phi = 10 ** (-.4 * HG1G2.evaluate(np.radians(alpha), 0., .2, .3))
    scale = solar.at(lam) / 2.**2 * phi / AU_KM**2
    flux = scale * 1000. * 1e6  # Constant, reflection-only cross-section.
    df = pd.DataFrame({"wavelength_um": lam, "phase_deg": alpha, "r_au": 2., "delta_au": 1.,
                       "flux_uJy": flux, "flux_err_uJy": flux / 100., "snr": 100.,
                       "quality_flag": status.Q_GOOD, "mjd": 60000. + np.arange(len(lam)) / 86400.,
                       "band": "D1", "origin": status.ORIGIN_SIMULATED})
    expected_log = np.log(phi[:9] / 10 ** (-.4 * HG1G2.evaluate(np.radians(np.median(alpha[:9])), 0., .2, .3)))
    np.testing.assert_allclose(geometric_log_scale(df.iloc[:9], .15, 1., .9, phase=law), expected_log)
    pts = df.assign(reflected_flux_uJy=flux, reflected_flux_err_uJy=flux / 100.)
    refl = reflectance_spectrum(pts, solar, phase=law)
    np.testing.assert_allclose(refl["reflectance"], 1., atol=1e-12)
    h = HResult(status="ESTIMATED", H=12., G=None, G1=.2, G2=.3, phase_model="H-G1-G2")
    ana = analyse_spectrum(df, h_result=h, separator=ThermalSeparator(solar=solar), calibration=None, log=lambda _: None)
    assert ana.separator.phase == law
    assert ana.thermal.status == "INSUFFICIENT_THERMAL"
    np.testing.assert_allclose(ana.reflectance["reflectance"], 1., atol=1e-9)
    assert ana.thermal.provenance["inputs"]["phase_function"]["G2"] == .3
    assert ana.diameter.assumptions["phase_function"]["model"] == "HG1G2"
    _, _, bond_albedo = ana.separator.model([1000., 0., 0.], df.iloc[-1:],
                                            ana.separator.reflected_scale(df.iloc[-1:]), None, .2, 1.)
    assert bond_albedo == pytest.approx(.2 * float(HG1G2(H=0, G1=.2, G2=.3).phaseint))


def test_hg_default_phase_law_keeps_existing_curve():
    law = PhaseLaw()
    np.testing.assert_array_equal(law.phi([0., 10., 30., 60.]), hg_phi([0., 10., 30., 60.], .15))
    assert law.phase_integral() == pytest.approx(.3926)


@pytest.mark.skipif(not hg1g2_available(), reason="HG1G2 oracle requires sbpy")
def test_new_all_point_posterior_retains_hg1g2_geometry():
    from src.physical.diameter_posterior import prepare
    law = PhaseLaw("HG1G2", G1=.2, G2=.3)
    sep = ThermalSeparator(solar=blackbody_sun())
    df = pd.DataFrame({"wavelength_um": [1.7, 1.8, 2.0, 2.2, 4.0, 4.5],
                       "phase_deg": [5., 10., 20., 30., 40., 50.], "r_au": 2., "delta_au": 1.,
                       "flux_uJy": 1000., "flux_err_uJy": 10.})
    result = prepare(df, sep, 12., .15, phase=law)
    assert result["G"] is None
    assert result["phase_function"] == law.to_dict()
    assert result["q"] == pytest.approx(law.phase_integral())
    expected = sep.solar.at(result["lam"]) / 4 * law.phi(result["d"]["phase_deg"]) / AU_KM**2
    np.testing.assert_allclose(result["S"], expected)


def test_density_validation_state_survives_result_export(tmp_path):
    from src.physical.density import DensityResult
    result = merge("synthetic", density=DensityResult(status="ON_HOLD_VALIDATION",
                   density_kg_m3=2100., density_err_kg_m3=400., notes="Independent validation needed"),
                   origin=status.ORIGIN_SIMULATED)
    assert result["density"] == 2100.
    assert result["density_status"] == "ON_HOLD_VALIDATION"
    assert any("Independent validation needed" in reason for reason in result["limitations"])
    from src.integration.asteroid_database import AsteroidDatabase
    db = AsteroidDatabase(tmp_path / "SIMULATED.sqlite", origin=status.ORIGIN_SIMULATED)
    try:
        db.upsert_result(result)
        assert db.results().iloc[0]["density_status"] == "ON_HOLD_VALIDATION"
    finally:
        db.close()
