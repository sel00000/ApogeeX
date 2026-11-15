"""Unit tests of formulas (no network). Synthetic inputs only."""
import numpy as np
import pytest
from scipy import integrate

from src.common import status
from src.common.constants import AU_KM
from src.physical.albedo import compute_albedo
from src.physical.density import compute_density, parse_extent
from src.physical.mass import MassResult, mass_from_binary_orbit
from src.physical.phase_function import hg_phi, phase_integral_q
from src.physical.thermal_model import neatm_flux_jy, planck_nu_jy_sr, subsolar_temperature


def test_hg_phase_function_limits():
    assert hg_phi(0.0, 0.15) == pytest.approx(1.0)
    a = np.linspace(0, 100, 50)
    assert np.all(np.diff(hg_phi(a, 0.15)) < 0)
    assert phase_integral_q(0.15) == pytest.approx(0.3926)


def test_planck_wien_peak():
    # B_nu peaks at h nu / kT = 2.821 -> lambda_peak(nu) = 5.0996e-3 m K / T
    T = 300.0
    lam = np.linspace(5, 40, 20000)
    peak = lam[np.argmax(planck_nu_jy_sr(lam, T))]
    assert peak == pytest.approx(5.0996e-3 / T * 1e6, rel=2e-3)


def test_planck_rayleigh_jeans():
    lam_um, T = 1.0e5, 200.0          # 10 cm: h nu / kT ~ 7e-4, RJ correction ~0.04%
    nu = 2.99792458e8 / (lam_um * 1e-6)
    rj = 2 * nu ** 2 * 1.380649e-23 * T / 2.99792458e8 ** 2 / 1e-26
    assert planck_nu_jy_sr(lam_um, T) == pytest.approx(rj, rel=1e-3)


def test_neatm_matches_direct_double_integral():
    D, eta, r, dlt, alpha, A, eps, lam = 1.0, 1.1, 1.3, 0.4, 35.0, 0.05, 0.9, 4.5
    fast = neatm_flux_jy(lam, D, eta, r, dlt, alpha, A, eps, nodes=64)[0]
    tss = subsolar_temperature(r, eta, A, eps)
    a = np.radians(alpha)

    def f(theta, phi):
        T = tss * np.cos(theta) ** 0.25 * np.cos(phi) ** 0.25
        return planck_nu_jy_sr(lam, T) * np.cos(phi) ** 2 * np.cos(theta - a)

    val, _ = integrate.dblquad(f, -np.pi / 2, np.pi / 2, lambda p: a - np.pi / 2, lambda p: np.pi / 2,
                               epsabs=0, epsrel=1e-8)
    direct = eps * (D / (dlt * AU_KM)) ** 2 / 4 * val
    assert fast == pytest.approx(direct, rel=1e-4)


def test_neatm_scalings():
    base = neatm_flux_jy([4.0, 4.8], 1.0, 1.0, 1.2, 0.3, 40, 0.05)
    assert np.allclose(neatm_flux_jy([4.0, 4.8], 2.0, 1.0, 1.2, 0.3, 40, 0.05), 4 * base)
    assert np.allclose(neatm_flux_jy([4.0, 4.8], 1.0, 1.0, 1.2, 0.6, 40, 0.05), base / 4)
    # hotter (smaller eta) -> more flux on the Wien side
    assert np.all(neatm_flux_jy([4.0], 1.0, 0.8, 1.2, 0.3, 40, 0.05) > neatm_flux_jy([4.0], 1.0, 1.2, 1.2, 0.3, 40, 0.05))
    # per-point geometry arrays give the same answer as scalars
    arr = neatm_flux_jy([4.0, 4.8], 1.0, 1.0, [1.2, 1.2], [0.3, 0.3], [40, 40], 0.05)
    assert np.allclose(arr, base)


def test_albedo_formula_and_errors():
    H, D = 17.0, 1.0                     # pV ~ 0.28 (H=15, D=1 km would give an unphysical 1.77)
    r = compute_albedo(D, 0.05, H, 0.1, H_source="test", D_source="test")
    expected = (1329 * 10 ** (-H / 5) / D) ** 2
    assert r.geometric_albedo == pytest.approx(expected)
    rel = np.hypot(2 * 0.05 / 1.0, 0.4 * np.log(10) * 0.1)
    assert r.albedo_err == pytest.approx(expected * rel)
    assert r.status == "ESTIMATED"


def test_albedo_missing_D_uncertainty_is_lower_bound():
    # e.g. 16 Psyche in SBDB: diameter without sigma
    r = compute_albedo(222.0, None, 6.06, 0.05, H_source="t", D_source="t")
    assert r.status == "ESTIMATED"
    assert r.albedo_err is not None and np.isfinite(r.albedo_err)
    assert r.albedo_err_is_lower_bound


def test_albedo_not_estimable_and_no_clipping():
    assert compute_albedo(None, None, 15, 0.1, H_source="", D_source="").status == status.ALBEDO_NOT_ESTIMABLE
    assert compute_albedo(1.0, 0.1, None, None, H_source="", D_source="").status == status.ALBEDO_NOT_ESTIMABLE
    r = compute_albedo(0.1, 0.001, 15.0, 0.01, H_source="", D_source="")    # pV ~ 4.4: unphysical
    assert r.geometric_albedo > 1.0          # value preserved, not clipped
    assert r.status == "ON_HOLD_VALIDATION"


def test_density_vesta_like():
    # Vesta: GM = 17.2882844 km^3/s^2, D = 522.77 km -> ~3.46 g/cm^3 (Park et al. 2025)
    m = MassResult("MEASURED", mass_kg=17.2882844 / 6.67430e-20, mass_err_kg=0.000003 / 6.67430e-20)
    d = compute_density(m, 522.77, 0.1)
    assert d.density_kg_m3 == pytest.approx(3460, rel=0.01)
    assert d.shape_assumption == status.SPHERICAL_ASSUMPTION
    ax = parse_extent("569.24 x 554.48 x 452.66", "0.1 x 0.1 x 0.1")
    e = compute_density(m, extent_axes_km=ax[0], extent_err_km=ax[1])
    assert e.shape_assumption == "triaxial_ellipsoid"
    assert compute_density(MassResult(status.UNKNOWN)).status == status.UNKNOWN


def test_binary_mass_kepler():
    # 1 au, 1 yr -> one solar mass
    m = mass_from_binary_orbit(AU_KM, 0, 365.25636, 0)
    assert m.mass_kg == pytest.approx(1.989e30, rel=2e-3)
