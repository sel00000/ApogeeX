"""Solar-analog relative calibration (src/preprocessing/solar_analog_calibration.py).

Offline tests use SIMULATED star photometry with a known injected response pattern. They check
that the joint fit recovers the pattern in the 1.2-um gauge, that star colours do not leak into it
beyond the reported slope uncertainty, that applying it removes the pattern from a SIMULATED
asteroid, and that a stored correction is never applied to SIMULATED data by default.
"""
import numpy as np
import pandas as pd
import pytest

from src.common import status
from src.common.constants import SPHEREX_BANDS
from src.preprocessing.solar_analog_calibration import (apply_correction, bin_edges_for_detector,
                                                        derive_correction, load_star_list)


def true_response(lam):
    """Injected ln-response: a 4% dip at 0.90 um and a 4.5% bump at 1.03 um (B1), a smooth 3% tilt in
    B3 and a 2% step in B5; zero around the 1.2-um normalisation."""
    lam = np.asarray(lam, float)
    c = -0.04 * np.exp(-0.5 * ((lam - 0.90) / 0.02) ** 2) + 0.045 * np.exp(-0.5 * ((lam - 1.03) / 0.015) ** 2)
    c += np.where((lam > 1.63) & (lam < 2.42), 0.03 * (lam - 2.0), 0.0)
    c += np.where((lam > 3.83) & (lam < 4.42), -0.02, 0.0)
    return c


def simulated_star_points(n_stars=8, per_band=60, noise=0.01, colour_sigma=0.01, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    betas = rng.normal(0, colour_sigma, n_stars)
    for s in range(n_stars):
        a = rng.normal(-30.0, 0.5)
        for info in SPHEREX_BANDS.values():
            lam = rng.uniform(info["min_um"], info["max_um"], per_band)
            y = a + betas[s] * (lam - 1.2) + true_response(lam) + rng.normal(0, noise, per_band)
            rows.append(pd.DataFrame({"star": f"SIM-star-{s}", "detector": info["detector"], "wavelength_um": lam,
                                      "ln_q": y, "ln_q_err": noise, "origin": status.ORIGIN_SIMULATED}))
    return pd.concat(rows, ignore_index=True), betas


def test_joint_fit_recovers_injected_pattern_in_normalisation_gauge():
    pts, betas = simulated_star_points()
    corr = derive_correction(pts, floor_frac=0.0)
    tab = corr.table[corr.table["determined"]]
    assert len(tab) > 100
    # Gauge: mean response ~0 within 0.05 um of 1.2 um; the injected response is 0 there, so the
    # recovered curve must equal the injected one up to the star-colour terms (slope ~ mean beta).
    resid = tab["ln_corr"].values - true_response(tab["wavelength_um"].values)
    expected_tilt = np.mean(betas) * (tab["wavelength_um"].values - 1.2)
    pull = (resid - expected_tilt) / np.hypot(tab["ln_corr_err"].values, 1e-4)
    assert np.mean(np.abs(pull) < 3.5) > 0.97, np.sort(np.abs(pull))[-5:]
    near = tab[(tab["wavelength_um"] - 1.2).abs() < 0.05]
    assert np.abs(np.average(near["ln_corr"], weights=near["n_points"])) < 0.003
    # the narrow B1 features are recovered at their injected amplitude
    b1 = tab[tab["detector"] == 1]
    assert b1.loc[(b1["wavelength_um"] - 0.90).abs().idxmin(), "ln_corr"] < -0.025
    assert b1.loc[(b1["wavelength_um"] - 1.03).abs().idxmin(), "ln_corr"] > 0.03
    assert corr.summary["origin"] == status.ORIGIN_SIMULATED


def test_star_colour_scatter_sets_slope_uncertainty():
    pts, betas = simulated_star_points(n_stars=10, colour_sigma=0.02, seed=4)
    corr = derive_correction(pts, floor_frac=0.0)
    expected = np.std(betas, ddof=1) / np.sqrt(len(betas))
    got = corr.slope_sigma_per_um["SWIR"]
    assert got is not None and 0.5 * expected < got < 2.0 * expected


def test_clipping_rejects_a_contaminated_star_point():
    pts, _ = simulated_star_points(seed=7)
    i = pts.index[(pts["detector"] == 2) & ((pts["wavelength_um"] - 1.4).abs() < 0.01)][0]
    pts.loc[i, "ln_q"] += 0.5                      # e.g. a cosmic ray or a neighbour in the PSF
    corr = derive_correction(pts, floor_frac=0.0)
    assert not corr.points.loc[corr.points["wavelength_um"] == pts.loc[i, "wavelength_um"], "used"].iloc[0]


def test_apply_correction_removes_pattern_from_simulated_asteroid():
    pts, _ = simulated_star_points(colour_sigma=0.0, seed=2)
    corr = derive_correction(pts, floor_frac=0.0)
    rng = np.random.default_rng(3)
    rows = []
    for info in SPHEREX_BANDS.values():
        lam = rng.uniform(info["min_um"], info["max_um"], 40)
        rows.append(pd.DataFrame({"detector": info["detector"], "wavelength_um": lam}))
    ast = pd.concat(rows, ignore_index=True)
    flat = 1000.0
    ast["flux_uJy"] = flat * np.exp(true_response(ast["wavelength_um"]))     # flat spectrum x instrument
    ast["flux_err_uJy"] = 1.0
    ast["origin"] = status.ORIGIN_SIMULATED
    out, info = apply_correction(ast, corr)
    assert info["applied"] and info["n_uncorrected"] == 0
    dev_before = np.abs(ast["flux_uJy"] / flat - 1)
    dev_after = np.abs(out["flux_uJy"] / flat - 1)
    assert dev_before.max() > 0.03 and dev_after.max() < 0.012
    assert (out["flux_err_uJy"] >= out["flux_err_uJy_uncalibrated"] / out["solar_analog_corr"] - 1e-12).all()
    assert {"solar_analog_corr", "solar_analog_corr_err", "solar_analog_corr_method"} <= set(out.columns)


def test_points_outside_calibrated_range_are_left_uncorrected():
    pts, _ = simulated_star_points(seed=5)
    pts = pts[pts["detector"] != 6]                 # no star data in B6
    corr = derive_correction(pts, floor_frac=0.0)
    ast = pd.DataFrame({"detector": [6, 2], "wavelength_um": [4.7, 1.3], "flux_uJy": [100.0, 100.0],
                        "flux_err_uJy": [1.0, 1.0]})
    out, info = apply_correction(ast, corr)
    assert out.loc[0, "solar_analog_corr"] == 1.0 and out.loc[0, "solar_analog_corr_method"] == "none"
    assert info["n_uncorrected"] == 1 and info["warnings"]


def test_bins_cover_each_band_at_half_resolution():
    for info in SPHEREX_BANDS.values():
        e = bin_edges_for_detector(info["detector"], 2.0)
        assert e[0] < info["min_um"] and e[-1] > info["max_um"]
        width = np.diff(e) / e[:-1]
        assert np.allclose(width, 1 / (2 * info["R"]))


def test_stored_correction_is_not_applied_to_simulated_data(monkeypatch):
    """The shared analysis chain applies the stored (observed-star) correction to OBSERVED data only."""
    from src.integration import spectrum_analysis as sa
    pts, _ = simulated_star_points(seed=6)
    corr = derive_correction(pts, floor_frac=0.0)
    monkeypatch.setattr(sa, "load_correction", lambda *a, **k: corr)
    sim = pd.DataFrame({"origin": [status.ORIGIN_SIMULATED] * 3})
    obs = pd.DataFrame({"origin": [status.ORIGIN_OBSERVED] * 3})
    assert sa.resolve_calibration("auto", sim) is None
    assert sa.resolve_calibration("auto", obs) is corr
    assert sa.resolve_calibration(None, obs) is None
    assert sa.resolve_calibration(corr, sim) is corr          # explicit use (tests, studies) is allowed


def test_star_list_records_its_literature_sources():
    cfg = load_star_list()
    assert "ApJS 247, 73" in cfg["reference"] and "A&A 674, A39" in cfg["reference"]
    stars = cfg["stars"]
    marsset = [s for s in stars if s["group"] == "marsset2020"]
    gold = [s for s in stars if s["group"] == "gaia_gold_sample"]
    assert len(marsset) == 11 and len(gold) == 12
    assert all(isinstance(s["gaia_dr3_source_id"], int) and s["gaia_dr3_source_id"] > 0 for s in stars)
    assert len({s["gaia_dr3_source_id"] for s in stars}) == len(stars)
    # every star left out of the build says why; the bright Marsset stars saturate SPHEREx B1/B2
    assert all(s.get("not_used_reason") for s in stars if not s["use"])
    assert all(s["V"] < 10.5 for s in marsset if not s["use"])


def test_saturated_star_points_are_not_used_for_calibration():
    from src.preprocessing.solar_analog_calibration import clean_star_points
    spec = pd.DataFrame({"quality_flag": ["WARN", "WARN", "WARN", "BAD", "GOOD"],
                         "quality_reasons": ["", "1 rejected pixel(s) in PSF core", "", "", ""],
                         "core_flags": ["SOURCE", "SOURCE", "BLOOM|SOURCE", "OVERFLOW", ""],
                         "flux_uJy": [100.0] * 5, "flux_err_uJy": [1.0] * 5, "wavelength_um": [1.0] * 5})
    d, info = clean_star_points(spec)
    assert len(d) == 2 and info["n_rejected_core_pixel"] == 1 and info["n_other_core_flags"] == 1


@pytest.mark.network
def test_fixed_source_search_finds_spherex_images_of_a_solar_analog():
    from src.acquisition.fixed_source_search import gaia_dr3_astrometry, search_fixed_source
    star = next(s for s in load_star_list()["stars"] if s["name"] == "Landolt 115-271")
    g, _ = gaia_dr3_astrometry([star["gaia_dr3_source_id"]])
    r = g.iloc[0]
    res = search_fixed_source(star["name"], r["ra"], r["dec"], 60830.0, 60845.0, r["pmra"], r["pmdec"])
    obs = res.observations
    assert len(obs) > 0 and obs["inside_footprint"].any()
    assert obs["image_url"].str.contains("/ibe/data/spherex/").all()


def test_release_check_ignores_weekly_processing_stamp():
    pts, _ = simulated_star_points(seed=8)
    corr = derive_correction(pts, floor_frac=0.0)
    corr.summary["data_releases"] = ["dr1 l2b-v27-2026-239"]
    ast = pd.DataFrame({"detector": [2, 2], "wavelength_um": [1.3, 1.4], "flux_uJy": [100.0, 100.0],
                        "flux_err_uJy": [1.0, 1.0], "data_release": ["dr1 l2b-v27-2026-196", "dr1 l2b-v27-2026-201"]})
    _, info = apply_correction(ast, corr)
    assert not info["warnings"]
    ast["data_release"] = "dr2 l2b-v30-2027-010"
    _, info = apply_correction(ast, corr)
    assert any("not among the releases" in w for w in info["warnings"])


def test_identity_check_rejects_a_neighbouring_source_id():
    """A source_id that went through float64 points to a different star nearby: G and position catch it."""
    from src.preprocessing.solar_analog_calibration import verify_star_identity
    star = next(s for s in load_star_list()["stars"] if s["group"] == "gaia_gold_sample")
    ra, dec = star["gaia_ra_dec_j2016"]
    good = pd.Series({"phot_g_mean_mag": star["G"] + 0.002, "ra": ra, "dec": dec + 0.1 / 3600})
    other = pd.Series({"phot_g_mean_mag": star["G"] + 3.1, "ra": ra + 20 / 3600, "dec": dec})
    assert verify_star_identity(star, good)[0]
    assert not verify_star_identity(star, other)[0]
    marsset = next(s for s in load_star_list()["stars"] if s["name"] == "Landolt 110-361")
    from src.preprocessing.solar_analog_calibration import _sexagesimal_deg
    r0, d0 = _sexagesimal_deg(*marsset["j2000"])
    assert verify_star_identity(marsset, pd.Series({"phot_g_mean_mag": 12.27, "ra": r0, "dec": d0}))[0]


def test_configured_source_ids_survive_yaml_as_exact_integers():
    for s in load_star_list()["stars"]:
        assert isinstance(s["gaia_dr3_source_id"], int)
        assert str(s["gaia_dr3_source_id"]) == f"{s['gaia_dr3_source_id']:d}" and len(str(s["gaia_dr3_source_id"])) >= 15


def test_star_with_deviant_colour_is_excluded_as_solar_proxy():
    """e.g. a reddened hotter star: 6% fainter in MWIR relative to SWIR than the other analogs."""
    from src.preprocessing.solar_analog_calibration import derive_correction_robust
    pts, _ = simulated_star_points(n_stars=10, colour_sigma=0.002, seed=11)
    bad = pts["star"] == "SIM-star-3"
    pts.loc[bad & (pts["wavelength_um"] >= 2.42), "ln_q"] -= 0.06
    corr = derive_correction_robust(pts, floor_frac=0.0)
    assert list(corr.summary["excluded_stars"]) == ["SIM-star-3"]
    t = corr.table[corr.table["determined"] & (corr.table["detector"] == 5)]
    assert np.allclose(t["ln_corr"], true_response(t["wavelength_um"]), atol=0.012)
