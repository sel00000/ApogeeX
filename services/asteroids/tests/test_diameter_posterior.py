"""Diameter posterior (src/physical/diameter_posterior.py), eta prior (src/physical/eta_prior.py) and the exposure
selection over observing seasons, on SIMULATED main-belt photometry with SPHEREx structure: one SWIR and one MWIR
point per exposure, visits of one detector family, visit- and group-level brightness offsets."""
import numpy as np
import pandas as pd
import pytest

from src.physical.diameter_posterior import combine, components, thermal_posterior
from src.physical.eta_prior import EtaPrior, fit_table, population_of, wavelength_factor
from src.physical.phase_function import phase_integral_q
from src.physical.thermal_model import neatm_flux_jy
from src.preprocessing.thermal_separation import ThermalSeparator
from src.validation.simulation import blackbody_sun

AU_KM = 1.495978707e8
FAMILIES = [((0.75, 1.11), (2.42, 3.82)), ((1.11, 1.64), (3.82, 4.42)), ((1.64, 2.42), (4.42, 5.00))]
FAST = dict(n_D=140, n_eta=25)


def _sep():
    return ThermalSeparator(solar=blackbody_sun())


def mba(D=80.0, pV=0.08, eta=1.0, r=2.7, delta=2.3, alpha=21.0, snr=30.0, n_visits=27, sig_v=0.0,
        group_offsets=(0.0,), seed=0, slope=0.05):
    """SIMULATED main-belt asteroid: linear reflectance continuum K0 [1 + s (lambda - 2)] + NEATM, with true visit
    offsets ~ N(0, sig_v) (recorded as temporal_corr_err_ln, 0 for the first visit of each group) and group offsets."""
    rng = np.random.default_rng(seed)
    H = 5 * np.log10(1329.0 / (D * np.sqrt(pV)))
    rows = []
    for v in range(n_visits):
        (s0, s1), (m0, m1) = FAMILIES[v % 3]
        g = v % len(group_offsets)
        start = rng.uniform(0, 0.8)
        for e in range(5):
            f = min(start + 0.04 * e, 0.999)
            for lam in (s0 + f * (s1 - s0), m0 + f * (m1 - m0)):
                rows.append({"visit": v, "norm_group": g, "wavelength_um": lam, "bandwidth_um": lam / 40.0})
    df = pd.DataFrame(rows)
    df["r_au"], df["delta_au"], df["phase_deg"] = r, delta, alpha
    sep = _sep()
    sep.G = 0.15
    S = sep.reflected_scale(df)
    lam = df["wavelength_um"].to_numpy()
    K = 1.3 * pV * (D / 2) ** 2 * (1 + slope * (lam - 2.0))
    A = phase_integral_q(0.15) * pV
    th = neatm_flux_jy(lam, D, eta, df["r_au"].to_numpy(), df["delta_au"].to_numpy(), df["phase_deg"].to_numpy(), A, 0.9)
    first = df.groupby("norm_group")["visit"].transform("min").to_numpy()
    dv = rng.normal(0, sig_v, n_visits) if sig_v > 0 else np.zeros(n_visits)
    dv[np.unique(first)] = 0.0                                   # gauge visit of each group
    off = np.asarray(group_offsets)[df["norm_group"].to_numpy()] + dv[df["visit"].to_numpy()]
    F = np.exp(off) * (S * K + th) * 1e6
    err = F / snr
    df["flux_uJy_raw"] = F + rng.normal(0, 1, len(F)) * err
    df["flux_err_uJy_raw"] = err
    df["temporal_corr_err_ln"] = np.where(df["visit"].to_numpy() == first, 0.0, sig_v)
    df["flux_uJy"] = df["flux_uJy_raw"]
    df["flux_err_uJy"] = df["flux_uJy"].abs() * np.hypot(err / F, df["temporal_corr_err_ln"])
    df["mjd"] = 61000.0 + df["visit"] * 0.3
    return df, {"D": D, "pV": pV, "eta": eta, "H": H}


def _prior_at(eta0, sig_ln=0.15, alpha=21.0):
    """EtaPrior with a flat-in-size NEOWISE-style table centred on eta0 (factor 1)."""
    tab = {"phase_slope_per_deg": 0.0,
           "bins": [{"log10D": 0.0, "median_ln_eta": float(np.log(eta0)), "sigma_ln": sig_ln},
                    {"log10D": 3.0, "median_ln_eta": float(np.log(eta0)), "sigma_ln": sig_ln}]}
    return EtaPrior(relation="neowise_population", population="mainbelt", alpha_deg=alpha, reference="test",
                    factor=1.0, sigma_extra_ln=0.0, table=tab)


def _z(q, truth):
    return np.log(truth / q["median"]) / (0.5 * np.log(q["hi68"] / q["lo68"]))


def test_posterior_recovers_the_diameter():
    df, tr = mba(seed=1)
    p = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.0), **FAST)
    assert p.status == "OK" and p.thermal is not None
    q = p.thermal
    assert abs(_z(q, tr["D"])) < 2.0
    assert p.detection_sigma > 5
    # a model without systematics constrains eta from the 3.5-5 um colour; real spectra are eta-limited (kappa,
    # visit errors), see test_diameter_follows_the_eta_prior_on_the_wien_side
    assert p.eta["lo68"] < tr["eta"] * 1.1 and p.eta["hi68"] > tr["eta"] / 1.1


def test_diameter_follows_the_eta_prior_on_the_wien_side():
    """With little eta information in 3.5-5 um data, D moves with the eta prior about as eta^1.5."""
    df, tr = mba(seed=2, snr=6.0)
    lo = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(0.85, 0.05), **FAST).thermal["median"]
    hi = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.15, 0.05), **FAST).thermal["median"]
    k = np.log(hi / lo) / np.log(1.15 / 0.85)
    assert 0.8 < k < 2.5


def test_visit_offsets_are_nuisance_parameters():
    """Visit-correlated brightness errors (sigma_v 0.08) enter once per visit: the posterior stays unbiased and is
    wider than without offsets."""
    zs, w_off, w_none = [], [], []
    for seed in range(4):
        df, tr = mba(seed=10 + seed, sig_v=0.08)
        q = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.0), **FAST).thermal
        zs.append(_z(q, tr["D"]))
        w_off.append(np.log(q["hi68"] / q["lo68"]))
        df0, _ = mba(seed=10 + seed, sig_v=0.0)
        q0 = thermal_posterior(df0, tr["H"], 0.15, _sep(), _prior_at(1.0), **FAST).thermal
        w_none.append(np.log(q0["hi68"] / q0["lo68"]))
    assert np.max(np.abs(zs)) < 2.5
    assert np.mean(w_off) >= np.mean(w_none)


def test_every_normalisation_group_is_used():
    """Three groups with unknown relative brightness (0, +0.3, -0.25 in ln): all points enter, D unbiased."""
    df, tr = mba(seed=3, group_offsets=(0.0, 0.3, -0.25))
    p = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.0), **FAST)
    assert p.n_groups == 3
    assert p.n_points == int(_sep()._fit_mask(df["wavelength_um"].to_numpy()).sum())
    assert abs(_z(p.thermal, tr["D"])) < 2.0


def test_marginal_has_no_comb_from_the_eta_grid():
    df, tr = mba(seed=4, snr=60.0)
    p = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.0, 0.2), **FAST)
    from src.physical.diameter_posterior import _marginal
    _, p2 = _marginal(p)
    d = p2.sum(axis=0)
    d = d / d.max()
    peaks = [k for k in range(1, len(d) - 1) if d[k] > d[k - 1] and d[k] >= d[k + 1] and d[k] > 0.05]
    assert len(peaks) <= 2


class _StubModel:
    def __init__(self, mu, sig):
        self.mu, self.sig = mu, sig

    def albedo_given_complex(self, a, e, i, H, c):
        return self.mu, self.sig

    def orbit_albedo(self, a, e, i, H):
        return self.mu, self.sig


class _StubPrior:
    def __init__(self, mu, sig):
        self.model, self.orbit = _StubModel(mu, sig), {"a_au": 2.7, "e": 0.1, "i_deg": 8.0}


def test_combined_estimate_is_tighter_and_keeps_the_truth():
    df, tr = mba(seed=5)
    p = thermal_posterior(df, tr["H"], 0.15, _sep(), _prior_at(1.0), **FAST)
    q = combine(p, _StubPrior(np.log10(tr["pV"]), 0.10), [{"complex": "C-complex", "probability": 1.0}], tr["H"])
    th = p.thermal
    assert np.log(q["hi68"] / q["lo68"]) < np.log(th["hi68"] / th["lo68"])
    assert abs(_z(q, tr["D"])) < 2.0


def test_components_cover_every_point():
    df, tr = mba(seed=6)
    sep = _sep()
    p = thermal_posterior(df, tr["H"], 0.15, sep, _prior_at(1.0), **FAST)
    q = p.thermal
    pts = components(p, df, sep, q["median"], q["lo68"], q["hi68"])
    assert len(pts) == len(df)
    long = pts["wavelength_um"] > 4.4
    assert (pts.loc[long, "model_thermal_uJy"] > 0).all()
    assert np.allclose(pts["reflected_flux_uJy"], pts["flux_uJy"] - pts["model_thermal_uJy"])


def test_eta_prior_relations_and_weights():
    assert population_of({"a_au": 1.46, "e": 0.22}) == "neo"
    assert population_of({"a_au": 2.7, "e": 0.1}) == "mainbelt"
    assert population_of({"a_au": 3.97, "e": 0.15}) == "hildas"
    assert population_of({"a_au": 5.2, "e": 0.05}) == "jupiter_trojans"
    assert wavelength_factor(20.0) == pytest.approx((0.87 + 0.2) / (0.761 + 0.1926), rel=1e-6)
    pr = _prior_at(1.0, 0.15)
    etas = np.exp(np.linspace(np.log(0.5), np.log(3.5), 41))
    w = pr.weights(etas, np.linspace(0.5, 2.5, 7))
    assert np.allclose(w.sum(axis=0), 1.0)
    assert etas[np.argmax(w[:, 3])] == pytest.approx(1.0, rel=0.06)


def test_fit_table_recovers_size_and_phase_trends():
    rng = np.random.default_rng(7)
    n = 20000
    D = 10 ** rng.uniform(0.3, 2.3, n)
    al = rng.uniform(15, 30, n)
    ln_eta = 0.10 - 0.10 * np.clip(np.log10(D), None, 1.6) + 0.007 * (al - 20) + rng.normal(0, 0.12, n)
    rows = pd.DataFrame({"type": "mainbelt", "diameter": D, "phase_deg": al, "ln_eta": ln_eta, "ln_eta_err": 0.05})
    t = fit_table(rows)["mainbelt"]
    assert t["phase_slope_per_deg"] == pytest.approx(0.007, abs=0.0015)
    big = [b for b in t["bins"] if b["log10D"] > 1.8][0]
    small = [b for b in t["bins"] if b["log10D"] < 0.6][0]
    assert big["median_ln_eta"] == pytest.approx(0.10 - 0.16, abs=0.02)
    assert small["median_ln_eta"] > big["median_ln_eta"]
    assert big["sigma_ln"] == pytest.approx(0.12, abs=0.02)


def test_exposures_are_shared_among_seasons():
    from src.extraction.spectral_extraction import select_exposures
    t = np.concatenate([60900 + np.arange(100) * 0.05, 61080 + np.arange(50) * 0.05])
    obs = pd.DataFrame({"mjd_mid": t, "obs_id": np.arange(150)})
    sel = select_exposures(obs, 60)
    assert len(sel) == 60
    assert (sel["mjd_mid"] < 61000).sum() == 40 and (sel["mjd_mid"] > 61000).sum() == 20
    assert sel["obs_id"].iloc[0] == 0 and 100 in set(sel["obs_id"])        # each season from its start
    assert len(select_exposures(obs, None)) == 150 and len(select_exposures(obs, 500)) == 150


def test_thermal_share_separates_emission_from_continuum_curvature():
    """Detection rule of the analysis chain (thermal_model.diameter_posterior): a joint signal >= 5 sigma counts only
    with a thermal share >= 20% at 4.4-5 um. A cold body whose reflectance curves up by 25% at 5 um reaches several
    sigma but a share of a few per cent; a main-belt body at 2.7 au is mostly thermal there."""
    warm, tw = mba(seed=21)
    pw = thermal_posterior(warm, tw["H"], 0.15, _sep(), _prior_at(1.0, 0.2), **FAST)
    assert pw.detection_sigma > 5 and pw.thermal_fraction > 0.3
    cold, tc = mba(D=60.0, pV=0.15, r=6.0, delta=5.6, alpha=9.0, seed=22, sig_v=0.06)
    lam = cold["wavelength_um"].to_numpy()
    bump = 1 + 0.04 * np.clip(lam - 2.5, 0, None) ** 2
    for c in ("flux_uJy", "flux_uJy_raw", "flux_err_uJy", "flux_err_uJy_raw"):
        cold[c] = cold[c] * bump
    pc = thermal_posterior(cold, tc["H"], 0.15, _sep(), _prior_at(1.0, 0.2), **FAST)
    assert pc.thermal_fraction < 0.12


def test_classification_uses_the_earliest_images_and_keeps_their_table_order():
    """classification.max_images: with several observing seasons, the earliest images by their stage-1 position
    (image_rank) - simultaneous SWIR/MWIR images keep the table order, as the old extraction cap did; without
    image_rank, time order. Data from one season are used in full."""
    from src.integration.spectrum_analysis import classification_subset
    df = pd.DataFrame({"mjd": [1.0, 1.0, 2.0, 2.0, 200.0, 200.0], "wavelength_um": [1.0, 4.0, 1.5, 4.5, 2.0, 4.9],
                       "image_rank": [1, 0, 2, 3, 5, 4]})
    sub = classification_subset(df, 3)
    assert sorted(sub["image_rank"]) == [0, 1, 2]
    assert len(classification_subset(df.drop(columns="image_rank"), 3)) == 3
    assert len(classification_subset(df, 0)) == 6                      # no cap: every image
    one = df.assign(mjd=[1.0, 1.0, 2.0, 2.0, 3.0, 3.0])
    assert len(classification_subset(one, 3)) == 6                      # one season: every image
