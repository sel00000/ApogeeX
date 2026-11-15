"""Injection-recovery calibration of the classifier (src/validation/injection_recovery.py), offline."""
import numpy as np
import pandas as pd

from src.classification.reference_library import load_busdemeo
from src.validation.injection_recovery import calibrated_gaps, inject_and_classify, resample, threshold_table


def _sampling(n=90, seed=0, snr=60):
    rng = np.random.default_rng(seed)
    lam = np.sort(rng.uniform(0.76, 2.44, n))
    refl = pd.DataFrame({"wavelength_um": lam, "reflectance": np.ones(n), "reflectance_err": np.full(n, 1 / snr),
                         "norm_group": 0, "visit": np.arange(n) // 6, "temporal_corr_err_ln": 0.01,
                         "origin": "SIMULATED"})
    return {"refl": refl, "slope_sys": 0.01}


def _member(cls):
    ref = load_busdemeo()[cls]
    return {"number": 0, "class": cls, "complex": "V-type" if cls == "V" else "S-complex",
            "lam": ref.wavelength_um, "R": ref.reflectance}


def test_resample_is_nan_outside_coverage():
    spec = {"lam": np.linspace(0.8, 2.4, 200), "R": np.ones(200)}
    out = resample(spec, np.array([0.76, 1.2, 2.44]))
    assert np.isnan(out[0]) and np.isnan(out[2]) and abs(out[1] - 1) < 1e-9


def test_a_v_type_member_is_recovered_first_and_distinguished():
    res = inject_and_classify(_sampling(), _member("V"), seed=1)
    assert res["top_complex"] == "V-type" and res["complex_gap"] <= -6


def test_calibrated_gap_is_the_smallest_with_at_most_5_percent_wrong():
    df = pd.DataFrame({"complex_gap": [10, 7, 5, 3, -5, -8] + [-10] * 94, "class_gap": [0] * 100,
                       "top_complex": "S", "true_complex": "S", "top_class": "S", "true_class": "S"})
    tab = threshold_table(df)
    assert tab.loc[tab.gap == 4, "complex_wrong_distinguished"].item() == 0.03
    cal = calibrated_gaps(df)
    assert cal["distinguished_gap"] == 4 and cal["high_confidence_gap"] == 8      # 1 of 100 at >= 8
