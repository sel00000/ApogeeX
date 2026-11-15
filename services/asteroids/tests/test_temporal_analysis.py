"""Observation-time analysis on SIMULATED SPHEREx-structured data (visits, detector families,
repeated observations, rotational lightcurves)."""
import numpy as np
import pandas as pd
import pytest

from src.preprocessing.temporal_analysis import analyse_temporal, apply_temporal_correction
from src.validation.simulation import synthetic_spherex_observations

KW = dict(rotation_period_h=5.27, G=0.15, eta0=1.47)


def test_visits_families_and_time_offsets_are_detected():
    df, _ = synthetic_spherex_observations("S", seed=2)
    r = analyse_temporal(df, **KW)
    assert r.n_visits == 24 and r.time_span_days > 10
    assert set(r.families.values()) == {"B1+B4", "B2+B5", "B3+B6"}
    unshared = [s["segments"] for s in r.segment_time_offsets if s["shared_visits"] == 0]
    assert "B1-B2" in unshared and "B2-B3" in unshared
    assert any("never observed together" in w for w in r.warnings)


def test_supported_lightcurve_is_applied_and_amplitude_recovered():
    df, truth = synthetic_spherex_observations("S", seed=3, lc_swir=(0.05, 0.0, 0.30, 0.25))
    r = analyse_temporal(df, **KW)
    assert r.variability["detected"]
    assert r.correction == "periodic_lightcurve" and r.lightcurve["supported"]
    grid = np.linspace(0, 2 * np.pi, 361)
    L = 0.05 * np.cos(grid) + 0.30 * np.cos(2 * grid) + 0.25 * np.sin(2 * grid)
    assert r.lightcurve["joint"]["amplitude_mag"] == pytest.approx(L.max() - L.min(), abs=0.1)
    corr = apply_temporal_correction(df, r)
    assert {"visit", "norm_group", "temporal_corr_err_ln", "flux_uJy_raw"} <= set(corr.columns)
    assert corr["norm_group"].nunique() == 1


def test_no_rotational_correction_without_repeated_observations():
    df, _ = synthetic_spherex_observations("S", seed=4)
    r = analyse_temporal(df, **KW)
    keep = ~r.points.duplicated(subset=["repeat_cluster"], keep="first")
    r2 = analyse_temporal(df.loc[keep.values].reset_index(drop=True), **KW)
    assert r2.n_repeat_bins == 0
    assert r2.correction == "none" and not r2.lightcurve["supported"]
    assert "no repeated observations" in r2.lightcurve["reason"]
    assert not r2.cross_visit_verified
    assert np.all(r2.points["corr_ln"] == 0)


def test_constant_brightness_needs_no_correction():
    df, _ = synthetic_spherex_observations("S", seed=5, lc_swir=(), lc_mwir=())
    r = analyse_temporal(df, **KW)
    assert r.variability["tested"] and not r.variability["detected"]
    assert r.correction == "none"
    assert r.cross_visit_verified


def test_unknown_period_gives_no_periodic_correction():
    df, _ = synthetic_spherex_observations("S", seed=6)
    r = analyse_temporal(df, rotation_period_h=None, G=0.15, eta0=1.47)
    assert r.variability["detected"]
    assert not r.correction.startswith("periodic")
    assert r.lightcurve["reason"] == "rotation period unknown"


def test_chromatic_lightcurve_is_corrected_per_arm():
    df, _ = synthetic_spherex_observations("S", seed=7, lc_swir=(0.0, 0.0, 0.30, 0.25), lc_mwir=(0.0, 0.0, 0.55, -0.1))
    r = analyse_temporal(df, **KW)
    assert r.lightcurve["achromatic_p"] < 1e-3
    assert r.lightcurve["mode"] == "per_arm"
    assert set(r.lightcurve["corrected_arms"]) == {"SWIR", "MWIR"}


def test_number_of_harmonics_is_chosen_by_bic():
    """A sharp-minimum (elongated-body) lightcurve needs more than two harmonics; a sinusoidal one does not."""
    import numpy as np
    import pandas as pd
    from src.preprocessing.temporal_analysis import select_harmonics
    rng = np.random.default_rng(0)
    cfg = {"lightcurve_harmonics": 2, "lightcurve_harmonics_max": 5, "lightcurve_min_repeat_bins": 6,
           "lightcurve_min_phase_coverage": 0.6, "lightcurve_min_delta_bic": 10.0,
           "lightcurve_min_variance_explained": 0.7}
    n_bins, per_bin = 25, 4
    phase = rng.uniform(0, 1, n_bins * per_bin)
    codes = np.repeat(np.arange(n_bins), per_bin)
    rep = pd.DataFrame({"repeat_cluster": codes, "visit": np.arange(len(codes)) % 20, "rot_phase": phase})
    sig = np.full(len(codes), 0.01)
    mu = rng.normal(0, 0.3, n_bins)[codes]
    smooth = 0.4 * np.cos(4 * np.pi * phase)                          # double-peaked, sinusoidal
    sharp = 0.5 * np.log(0.15 + np.abs(np.cos(2 * np.pi * phase)))  # elongated body: sharp minima, broad maxima
    nh_s, _ = select_harmonics(rep, mu + smooth + rng.normal(0, 0.01, len(codes)), sig, codes, cfg, n_bins)
    nh_x, bic = select_harmonics(rep, mu + sharp + rng.normal(0, 0.01, len(codes)), sig, codes, cfg, n_bins)
    assert nh_s == 2
    assert nh_x >= 4 and bic[nh_x] < bic[2]


def test_visits_linked_only_among_themselves_keep_the_untested_prior():
    """No variability detected: a small group of visits linked only to each other is not tested against the
    rest, so its visits get the untested prior, not the small tested spread (10 Hygiea: visits 0 and 5)."""
    import numpy as np
    import pandas as pd
    from src.preprocessing.temporal_analysis import analyse_temporal
    rows = []
    # main group: visits 0-3 share repeat wavelengths; side group: visits 4-5 share another wavelength
    for v, lams in {0: [1.20, 1.30], 1: [1.20, 1.40], 2: [1.30, 1.40], 3: [1.20, 1.30], 4: [0.90], 5: [0.90]}.items():
        for k, lam in enumerate(lams):
            rows.append({"mjd": 61000 + v * 0.5 + k * 0.001, "wavelength_um": lam, "flux_uJy": 1000.0, "flux_err_uJy": 5.0,
                         "band": "B1" if lam < 1.1 else "B2", "obs_id": f"o{v}{k}", "r_au": 2.0, "delta_au": 1.5,
                         "phase_deg": 20.0})
    rows.append({"mjd": 61004.0, "wavelength_um": 2.0, "flux_uJy": 1000.0, "flux_err_uJy": 5.0, "band": "B3",
                 "obs_id": "single", "r_au": 2.0, "delta_au": 1.5, "phase_deg": 20.0})
    df = pd.DataFrame(rows)
    t = analyse_temporal(df, rotation_period_h=None)
    assert t.variability["tested"] and not t.variability["detected"]
    p = t.points.groupby("visit")["corr_ln_err"].first()
    prior = 0.1 / 1.0857
    assert all(p[v] < prior for v in (0, 1, 2, 3))        # the largest group: tested spread
    assert p[4] == prior and p[5] == prior                  # linked only to each other: untested prior
    assert p[6] == prior                                    # a visit without any repeat: untested prior


def _two_seasons(df, offset_ln, period_h=5.27):
    """Every other visit moved to a second observing season ~180 d later (an integer number of rotations, so
    the rotational phases stay), 'offset_ln' brighter there: what a changed phase angle or aspect does that
    the geometric scaling misses."""
    from src.preprocessing.temporal_analysis import assign_visits
    df = df.copy()
    v = assign_visits(df["mjd"].values, 30.0)
    late = (v % 2) == 1
    df.loc[late, "mjd"] += round(180 * 24 / period_h) * period_h / 24
    df.loc[late, ["flux_uJy", "flux_err_uJy"]] *= np.exp(offset_ln)
    return df


def test_brightness_offset_between_seasons_is_not_visit_variability():
    """92 Undina (2026-11-15): 24 of 120 points from a season 250 d later made the brightness 'variable', the visit
    offsets split the spectrum into 11 unlinked groups and the class went X -> S. One offset per season is a
    nuisance parameter of the variability test; the visits stay linked."""
    df, _ = synthetic_spherex_observations("S", seed=5, lc_swir=(), lc_mwir=())
    two = _two_seasons(df, 0.3)
    from src.common.config import settings
    one_season = dict(settings()["temporal"], season_gap_days=1e9)
    old = analyse_temporal(two, rotation_period_h=None, cfg=one_season)
    assert old.variability["detected"] and old.n_norm_groups > 1          # the failure without season offsets
    r = analyse_temporal(two, rotation_period_h=None)
    assert r.n_seasons == 2 and not r.variability["detected"]
    assert r.correction == "season_offsets" and r.n_norm_groups == 1
    (s, off), = r.season_offsets.items()
    assert abs(off["offset_mag"]) == pytest.approx(1.0857 * 0.3, abs=0.03) and off["err_mag"] < 0.03
    corr = apply_temporal_correction(two, r)
    ratio = corr["flux_uJy"].values / df["flux_uJy"].values             # corrected / true, per point
    by_season = pd.Series(ratio).groupby(corr["season"].values).median()
    assert by_season.max() / by_season.min() == pytest.approx(1.0, abs=0.03)   # the offset is divided out


def test_lightcurve_is_fitted_with_a_season_offset():
    df, truth = synthetic_spherex_observations("S", seed=3, lc_swir=(0.05, 0.0, 0.30, 0.25))
    r = analyse_temporal(_two_seasons(df, -0.25), **KW)
    assert r.correction == "periodic_lightcurve" and r.n_norm_groups == 1
    grid = np.linspace(0, 2 * np.pi, 361)
    L = 0.05 * np.cos(grid) + 0.30 * np.cos(2 * grid) + 0.25 * np.sin(2 * grid)
    assert r.lightcurve["joint"]["amplitude_mag"] == pytest.approx(L.max() - L.min(), abs=0.1)
    (off,) = r.lightcurve["joint"]["season_offsets_ln"].values()
    assert abs(off) == pytest.approx(0.25, abs=0.05)
