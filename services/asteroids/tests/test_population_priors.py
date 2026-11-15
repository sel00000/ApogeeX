"""Population priors, the classifier prior and the statistical diameter (offline; SIMULATED catalogues)."""
import numpy as np
import pandas as pd
import pytest

from src.classification.priors import TargetPrior
from src.classification.taxonomy import classify
from src.physical.population_priors import build_model
from src.physical.statistical_diameter import (consistency_with_thermal, estimate_statistical_diameter,
                                               thermal_likelihood)
from tests.test_classification import fake_obs


def synthetic_tables(n=4000, seed=1):
    """Inner belt (a < 2.5 au): S-complex, pV 0.25; outer belt: C-complex, pV 0.06 (0.1 dex scatter)."""
    rng = np.random.default_rng(seed)
    a = rng.uniform(2.1, 3.3, n)
    e, i, H = rng.uniform(0.0, 0.25, n), rng.uniform(0, 20, n), rng.uniform(9, 16, n)
    inner = a < 2.5
    lpv = np.where(inner, np.log10(0.25), np.log10(0.06)) + rng.normal(0, 0.1, n)
    D = 1329.0 / np.sqrt(10 ** lpv) * 10 ** (-H / 5)
    d = pd.DataFrame({"pdes": [f"S{k}" for k in range(n)], "a": a, "e": e, "i": i, "H": H, "diameter": D,
                      "sin_i": np.sin(np.radians(i)), "log10_pv_eff": lpv})
    tx = d.iloc[:600].copy()
    tx["complex"] = np.where(tx["a"] < 2.5, "S-complex", "C-complex")
    return d, tx


@pytest.fixture(scope="module")
def model():
    d, tx = synthetic_tables()
    return build_model(d, tx, cross_validate=True, log=lambda m: None)


def test_albedo_regression_learns_orbit_trend(model):
    mu_in, s_in = model.orbit_albedo(2.2, 0.1, 5.0, 12.0)
    mu_out, _ = model.orbit_albedo(3.1, 0.1, 5.0, 12.0)
    # point predictions of a boosted model on 4000 noisy rows: within 0.1 dex (the injected scatter)
    assert abs(mu_in - np.log10(0.25)) < 0.1 and abs(mu_out - np.log10(0.06)) < 0.1
    assert abs((mu_in - mu_out) - np.log10(0.25 / 0.06)) < 0.15
    assert 0.05 < s_in < 0.2                      # cross-validated scatter, close to the injected 0.1 dex
    assert model.complex_stats["S-complex"]["n"] > 100


def test_complex_prior_and_albedo_likelihood(model):
    lp_in = model.complex_log_prior(2.2, 0.1, 5.0, 12.0, population_exponent=0.25, orbit_exponent=0.5)
    lp_out = model.complex_log_prior(3.1, 0.1, 5.0, 12.0, population_exponent=0.25, orbit_exponent=0.5)
    assert lp_in["S-complex"] > lp_in["C-complex"] and lp_out["C-complex"] > lp_out["S-complex"]
    assert np.isclose(sum(np.exp(v) for v in lp_in.values()), 1.0)
    flat = model.complex_log_prior(population_exponent=0.0, orbit_exponent=0.0)
    assert np.allclose(list(flat.values()), list(flat.values())[0])      # beta = tau = 0: flat over complexes
    al = model.albedo_loglike(np.log10(0.25), 0.1)
    assert al["S-complex"] > al["C-complex"] + 3


def test_classify_prior_shifts_complex_but_keeps_spectral_ranking():
    obs = fake_obs("C", snr=25, seed=3)
    base = classify(obs)
    # prior strongly against the C-complex: the reported complex changes, the spectral-only ranking does not
    lp = {c: np.log(0.2) for c in ("S-complex", "X-complex", "D-type", "K-type", "L-type", "T-type")}
    lp["C-complex"] = np.log(1e-6)
    pr = TargetPrior(complex_log_prior=lp, info={"orbit_used": True})
    res = classify(obs, prior=pr)
    assert base.best_complex == "C-complex"
    assert res.complex_ranking[0]["complex"] != "C-complex"
    assert res.best_complex == res.complex_ranking[0]["complex"]           # record and ranking agree
    assert res.complex_ranking_spectral[0]["complex"] == "C-complex"
    assert any("prior" in x for x in res.limitations)
    # without a prior the complex order equals the complex probability order
    assert base.best_complex == base.complex_ranking[0]["complex"]


class _StubModel:
    info = {}

    def __init__(self, mu=np.log10(0.06), sig=0.05):
        self.mu, self.sig = mu, sig

    def albedo_given_complex(self, a, e, i, H, cx):
        return (self.mu, self.sig) if cx == "C-complex" else (np.log10(0.25), self.sig)

    def orbit_albedo(self, a, e, i, H):
        return self.mu, 0.2


def _prior(model):
    return TargetPrior(orbit={"a_au": 3.0, "e": 0.1, "i_deg": 5.0}, H=10.0, model=model)


def test_statistical_diameter_follows_h_and_albedo():
    sd = estimate_statistical_diameter(10.0, _prior(_StubModel()), [{"complex": "C-complex", "probability": 1.0}],
                                       n_samples=5000)
    expect = 1329.0 / np.sqrt(0.06) * 10 ** (-10.0 / 5)
    assert sd.status == "ESTIMATED" and abs(sd.diameter_km / expect - 1) < 0.02
    lo, hi = sd.interval_68_km
    assert lo < sd.diameter_km < hi and hi / lo < 1.35 and sd.confidence == "Medium"
    # a two-complex mixture widens the interval and lowers the confidence
    mix = estimate_statistical_diameter(10.0, _prior(_StubModel()), [{"complex": "C-complex", "probability": 0.5},
                                                                    {"complex": "S-complex", "probability": 0.5}],
                                        n_samples=5000)
    assert mix.interval_68_km[1] / mix.interval_68_km[0] > hi / lo and mix.confidence == "Low"
    assert estimate_statistical_diameter(None, _prior(_StubModel()), None).diameter_km is None


def _thermal_test(D_true, H=10.0, eta=1.0, snr_scale=1.0):
    """Thermal points of a body at r = 1.3 au (strong thermal flux at 3.5-5 um)."""
    from src.physical.thermal_model import neatm_flux_jy
    lam = np.linspace(3.6, 5.0, 20)
    r, dl, al = np.full(20, 1.3), np.full(20, 0.5), np.full(20, 40.0)
    pV = (1329.0 * 10 ** (-H / 5) / D_true) ** 2
    th = neatm_flux_jy(lam, D_true, eta, r, dl, al, 0.39 * pV, 0.9, nodes=24)
    E = np.full(20, 0.05 * th.mean() * snr_scale)
    w = 1 / E ** 2
    return {"wavelength_um": lam, "r_au": r, "delta_au": dl, "phase_deg": al, "weights": w,
            "excess_stat": 0.0, "excess_stat_sigma": float(np.sqrt(np.sum(w))),
            "eta_prior": {"eta0": 1.0, "sigma_minus": 0.3, "sigma_plus": 0.55}}


def test_thermal_non_detection_gives_upper_limit_and_downweights_large_dark_bodies():
    H = 10.0
    D_dark = 1329.0 / np.sqrt(0.06) * 10 ** (-H / 5)              # 54 km
    test = _thermal_test(D_dark, H=H)                              # zero excess where a 54-km body is bright
    lgD, L, ul = thermal_likelihood(test, H, 0.15, test["eta_prior"])
    assert ul is not None and ul < D_dark
    assert L[0] > 0.5 and L[-1] < 1e-3                              # small bodies allowed, large excluded
    prior = _prior(_StubModel())
    cp = [{"complex": "C-complex", "probability": 0.5}, {"complex": "S-complex", "probability": 0.5}]
    no_w = estimate_statistical_diameter(H, prior, cp, n_samples=5000)
    w = estimate_statistical_diameter(H, prior, cp, n_samples=5000, thermal_test=test, eta_prior=test["eta_prior"])
    assert w.thermal_weighting and w.diameter_km < no_w.diameter_km
    assert w.inputs["complex_weights_after_thermal"].get("S-complex", 0) > 0.5


def test_consistency_with_thermal():
    sd = estimate_statistical_diameter(10.0, _prior(_StubModel()), [{"complex": "C-complex", "probability": 1.0}],
                                       n_samples=5000)
    ok = consistency_with_thermal(sd, sd.diameter_km * 1.1, sd.diameter_km * 0.1)
    bad = consistency_with_thermal(sd, sd.diameter_km * 2.0, sd.diameter_km * 0.1)
    assert ok["consistent"] and not bad["consistent"] and bad["z"] > 2
    assert consistency_with_thermal(sd, None, None) is None
