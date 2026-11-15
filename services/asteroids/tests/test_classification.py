"""Classification tests using the real Bus-DeMeo class means as inputs (resampled, with
added SIMULATED noise)."""
import numpy as np
import pandas as pd
import pytest

from src.classification.mineral_identification import analyse_minerals
from src.classification.reference_library import load_busdemeo, resample_reference
from src.classification.taxonomy import classify, train_classifier


def fake_obs(cls, snr=60, seed=0):
    rng = np.random.default_rng(seed)
    lib = load_busdemeo()
    lam = np.sort(rng.uniform(0.76, 2.44, 120))
    r, _, _ = resample_reference(lib[cls], lam, 40, 1.25)
    e = r / snr
    return pd.DataFrame({"wavelength_um": lam, "reflectance": r + rng.normal(0, 1, len(lam)) * e,
                         "reflectance_err": e, "origin": "SIMULATED"})


def test_library_has_provenance_and_classes():
    lib = load_busdemeo()
    assert {"S", "C", "X", "V", "A", "D"} <= set(lib)
    assert "DeMeo" in lib["S"].source


@pytest.mark.parametrize("cls,complex_", [("V", "V-type"), ("A", "A-type"), ("D", "D-type"), ("S", "S-complex")])
def test_classify_recovers_complex(cls, complex_):
    res = classify(fake_obs(cls))
    assert res.best_complex == complex_
    assert res.candidates[0]["score"] > 0.2
    assert any("probabilit" in x for x in res.limitations)


def test_insufficient_points():
    df = fake_obs("S").head(3)
    assert classify(df).status == "Insufficient Data"


def test_vtype_band_analysis_orthopyroxene():
    m = analyse_minerals(fake_obs("V", snr=100))
    b1 = m.bands[0]
    assert b1.detected and 0.88 < b1.center_um < 0.97
    assert any(c["mineral"] == "Orthopyroxene" for c in m.candidates)


def test_atype_olivine():
    m = analyse_minerals(fake_obs("A", snr=100))
    assert m.bands[0].detected and m.bands[0].center_um > 1.0
    assert any(c["mineral"] == "Olivine" for c in m.candidates)


def test_ml_requires_data_and_checks_leakage():
    with pytest.raises(ValueError):
        train_classifier(np.zeros((5, 3)), np.array(list("SSCCC")), np.arange(5))
    rng = np.random.default_rng(0)
    X = np.vstack([rng.normal(0, 1, (30, 4)), rng.normal(3, 1, (30, 4))])
    y = np.array(["S"] * 30 + ["C"] * 30)
    g = np.arange(60) // 2         # two spectra per object
    out = train_classifier(X, y, g)
    assert out["n_train"] + out["n_validation"] == 60


def test_ranking_is_sorted_probability_and_complete():
    res = classify(fake_obs("S"))
    probs = [c["probability"] for c in res.ranking]
    assert [c["rank"] for c in res.ranking] == list(range(1, len(res.ranking) + 1))
    assert probs == sorted(probs, reverse=True)
    assert sum(probs) == pytest.approx(1.0)
    assert len(res.ranking) == len(load_busdemeo())
    assert res.candidates == res.ranking[: len(res.candidates)]
    assert sum(c["probability"] for c in res.complex_ranking) == pytest.approx(1.0)
    assert res.complex_ranking[0]["complex"] == "S-complex"


def test_probabilities_are_tempered_for_poor_fits():
    """Unexplained scatter (chi2_red >> 1) must not give spuriously certain 100%/0% values."""
    # R has a single member (no class sigma), so extra scatter is not absorbed by intra-class variance
    good = fake_obs("R", snr=60)
    bad = good.copy()
    # systematic 25% ripple: a distortion no reference class can explain (survives binning)
    bad["reflectance"] = bad["reflectance"] * (1 + 0.25 * np.sin(2 * np.pi * bad["wavelength_um"] / 0.3))
    r_good, r_bad = classify(good), classify(bad)
    assert r_good.ranking[0]["class"] == "R" and r_good.probability_scale == pytest.approx(1.0)
    assert r_bad.probability_scale > 1.5
    assert any("inflated" in x for x in r_bad.limitations)
    # tempered probabilities are less extreme than the untempered exp(-ddeviance/2) ones
    chi2 = np.array([c["deviance"] for c in r_bad.ranking])
    raw = np.exp(-0.5 * (chi2 - chi2.min()))
    raw /= raw.sum()
    tempered = np.array([c["probability"] for c in r_bad.ranking])
    assert tempered[0] <= raw[0] + 1e-12
    assert tempered[1:].sum() >= raw[1:].sum()
