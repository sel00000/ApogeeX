"""Shape-model validation reference (src/validation/shape_reference.py).

The facet model must reproduce the pipeline's spherical NEATM; an elongated body seen and lit along its spin axis must
read larger than its volume-equivalent sphere. For 433 Eros in 2025-07 the reference must reproduce the aspect found
independently on 2026-11-15 from JPL Horizons vectors and the IAU pole: sub-observer latitude -82 to -87 deg,
sub-solar -50 to -60 deg, f = 1.31 (effective diameter 22.1 km for the volume-equivalent 16.84 km).
tests/fixtures/eros_2025-07_thermal_geometry.csv holds the geometry of 12 of the 70 thermal points of the saved
2025-07 SPHEREx exposures (JPL Horizons ephemeris: predicted RA/Dec, distances, phase angle; no photometry).
"""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.physical.thermal_model import ellipsoid_facets, facet_neatm_flux_jy, neatm_flux_jy
from src.validation.shape_reference import (STATUS_NOT_APPLICABLE, STATUS_OK, STATUS_POLE_UNKNOWN, ShapeReference,
                                            log_z, parse_pole, rotation_averaged_ratio, shape_reference,
                                            sun_vector_au, viewing_geometry)

FIX = Path(__file__).parent / "fixtures" / "eros_2025-07_thermal_geometry.csv"
LAM = np.array([3.6, 4.0, 4.5, 4.9])


class _P:
    def __init__(self, value=None, raw="", sigma=None, reference="test"):
        self.value, self.sigma, self.reference = value, sigma, reference
        self.raw_value = raw or ("" if value is None else str(value))


class FakeSBDB:
    found = True

    def __init__(self, **params):
        self._p = params

    def param(self, k):
        return self._p.get(k)


def eros_sbdb(pole="11.37/17.22", extent="34.4x11.2x11.2"):
    """SBDB values of 433 Eros (2026-11-15): Yeomans et al. 2000 diameter and pole, Veverka et al. 2000 extent."""
    p = {"diameter": _P(16.84, sigma=0.06), "albedo": _P(0.25)}
    if extent:
        p["extent"] = _P(raw=extent)
    if pole:
        p["pole"] = _P(raw=pole)
    return FakeSBDB(**p)


@pytest.fixture(scope="module")
def eros_points():
    return pd.read_csv(FIX)


@pytest.mark.parametrize("alpha", [0.0, 37.0, 60.0])
def test_facet_model_of_a_sphere_equals_neatm(alpha):
    n, A = ellipsoid_facets(8.42, 8.42, 8.42)
    a = np.radians(alpha)
    facets = facet_neatm_flux_jy(LAM, n, A, [0, 0, 1.0], [np.sin(a), 0, np.cos(a)], 1.7, 1.3, 1.1, 0.15)
    assert np.allclose(facets / neatm_flux_jy(LAM, 16.84, 1.1, 1.7, 1.3, alpha, 0.15), 1.0, atol=3e-3)


def test_ellipsoid_facets_close_the_surface():
    n, A = ellipsoid_facets(17.8, 5.8, 5.8)
    assert np.allclose(n.T @ A, 0.0, atol=1e-6 * A.sum())                  # closed surface: sum n dA = 0
    assert np.allclose(np.linalg.norm(n, axis=1), 1.0)


def test_elongated_body_seen_along_its_spin_axis_reads_larger_than_its_volume():
    """Eros proportions (3.07 : 1 : 1). Seen and lit along the spin axis: the largest cross-section (area factor
    (a/b)^(1/6) = 1.21) and a sunlit side flatter than a sphere's, so f > 1.21. Lit and seen in the equatorial plane
    and averaged over the rotation, it reads slightly smaller than its volume."""
    b = (1 / 3.07) ** (1 / 3) * 8.42
    n, A = ellipsoid_facets(3.07 * b, b, b)
    z, al = np.array([0, 0, 1.0]), np.radians(10)
    pole_on = np.sqrt(rotation_averaged_ratio(n, A, 16.84, z, z, np.array([np.sin(al), 0, np.cos(al)]),
                                              1.7, 1.3, 10.0, LAM, 1.1, 0.15))
    equator = np.sqrt(rotation_averaged_ratio(n, A, 16.84, z, np.array([1.0, 0, 0]), np.array([np.cos(al), np.sin(al), 0]),
                                              1.7, 1.3, 10.0, LAM, 1.1, 0.15))
    assert (pole_on > 1.3).all() and (pole_on < 1.5).all()
    assert (equator > 0.85).all() and (equator < 1.0).all()


@pytest.mark.parametrize("raw,expected", [("11.37/17.22", (11.37, 17.22)), ("69, 42", (69.0, 42.0)),
                                          ("309.06110/42.232386", (309.0611, 42.232386)), ("291.421/66.758", (291.421, 66.758)),
                                          ("", None), (None, None), ("north", None), ("10/95", None)])
def test_sbdb_pole_formats(raw, expected):
    got = parse_pole(raw)
    assert got == expected if expected is None else np.allclose(got, expected)


def test_low_precision_sun_matches_j2000_and_the_stored_ephemeris(eros_points):
    v = sun_vector_au(51544.5)                                             # 2000-01-01 12:00
    R = np.linalg.norm(v)
    assert abs(np.degrees(np.arctan2(v[1], v[0])) % 360 - 281.286) < 0.05
    assert abs(np.degrees(np.arcsin(v[2] / R)) + 23.034) < 0.05 and abs(R - 0.98333) < 2e-4
    g = viewing_geometry(eros_points)                                      # against JPL Horizons r and phase angle
    assert np.abs(g["phase_deg"] - eros_points["phase_deg"]).max() < 0.05
    assert np.abs(g["r_au"] - eros_points["r_au"]).max() < 1e-3


def test_eros_2025_07_is_seen_pole_on_and_reads_31_percent_larger(eros_points):
    ref = shape_reference(eros_sbdb(), eros_points, eta=1.24, G=0.46)
    assert ref.status == STATUS_OK and ref.applicable and not ref.warnings
    lo, med, hi = ref.sub_observer_lat_deg
    assert -88 < lo and hi < -80                                           # within 2-10 deg of the south pole
    assert -62 < ref.sub_solar_lat_deg[0] and ref.sub_solar_lat_deg[2] < -48
    assert 1.27 < ref.factor < 1.36 and 21.4 < ref.D_eff_km < 22.9
    assert ref.D_vol_km == 16.84 and ref.extent_km == [34.4, 11.2, 11.2]
    assert abs(np.prod(ref.axes_km) ** (1 / 3) - 16.84) < 1e-9             # ellipsoid scaled to the catalogue volume
    assert ref.relative_sigma() == pytest.approx(0.06 / 16.84)


def test_reference_uses_no_spherex_flux(eros_points):
    """The reference is what the measurement is compared with: it must not depend on the photometry."""
    a, b = eros_points.copy(), eros_points.copy()
    a["flux_uJy"], b["flux_uJy"] = 1.0e4, np.random.default_rng(0).uniform(1, 1e6, len(b))
    assert shape_reference(eros_sbdb(), a, eta=1.24).factor == shape_reference(eros_sbdb(), b, eta=1.24).factor


def test_unknown_pole_gives_a_range_that_enters_the_comparison(eros_points):
    ref = shape_reference(eros_sbdb(pole=None), eros_points, eta=1.24, G=0.46)
    assert ref.status == STATUS_POLE_UNKNOWN and ref.applicable
    lo, hi = ref.factor_interval_68
    assert lo < ref.factor < hi and 0.85 < lo and hi < 1.5
    assert ref.D_eff_interval_68_km == pytest.approx([lo * 16.84, hi * 16.84])
    assert ref.relative_sigma() > 0.05 and ref.sub_observer_lat_deg is None


def test_not_applicable_without_shape_or_thermal_points(eros_points):
    assert shape_reference(eros_sbdb(extent=None), eros_points).status == STATUS_NOT_APPLICABLE
    assert shape_reference(None, eros_points).status == STATUS_NOT_APPLICABLE
    short = eros_points.assign(wavelength_um=2.0)
    r = shape_reference(eros_sbdb(), short)
    assert r.status == STATUS_NOT_APPLICABLE and not r.applicable and "3.5" in r.reason
    assert shape_reference(eros_sbdb(extent="34.4"), eros_points).status == STATUS_NOT_APPLICABLE


def test_log_z_follows_the_stage_status_convention():
    assert log_z(16.84, 0.0, 23.68, [20.87, 26.96]) == pytest.approx(-2.66, abs=0.01)     # Eros against 16.84 km
    assert log_z(22.13, 0.0, 23.68, [20.87, 26.96]) == pytest.approx(-0.53, abs=0.01)     # against the shape reference
    assert log_z(None, 0.0, 23.68, [20.87, 26.96]) is None and log_z(16.84, 0.0, 23.68, None) is None


def test_record_carries_both_comparisons():
    from src.integration.result_merger import merge
    from src.physical.diameter import DiameterResult
    d = DiameterResult(status="OK", diameter_km=24.12, diameter_total_err_km=5.3, diameter_interval_68_km=(19.48, 30.08),
                       diameter_interval_95_km=(16.06, 38.44), catalog_diameter_km=16.84, catalog_diameter_err_km=0.06)
    s = ShapeReference(STATUS_OK, D_vol_km=16.84, D_vol_err_km=0.06, D_eff_km=22.13, factor=1.314)
    rec = merge("433", diameter=d, shape_reference=s)
    assert rec["diameter_best_source"].startswith("SPHEREx")
    assert rec["diameter_catalog_z"] == pytest.approx(np.log(16.84 / 24.12) / np.hypot(0.5 * np.log(30.08 / 19.48), 0.06 / 16.84))
    assert rec["diameter_effective_z"] == pytest.approx(-0.40, abs=0.01)
    assert rec["catalog_effective_diameter_km"] == 22.13 and rec["shape_reference"]["factor"] == 1.314
    rec = merge("433", diameter=d, shape_reference=ShapeReference(STATUS_NOT_APPLICABLE, "no SBDB extent (shape)"))
    assert rec["shape_reference"] is None and rec["diameter_effective_z"] is None
    assert rec["diameter_catalog_z"] is not None
