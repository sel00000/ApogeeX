import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.acquisition.irsa_client import IrsaClient
from src.acquisition.asteroid_identification import Detection, classify_unmatched
from src.common import status
from src.common.geometry import point_in_polygon
from src.i18n import t
from src.integration.asteroid_database import AsteroidDatabase
from src.physical.absolute_magnitude import estimate_h
from src.physical.phase_function import hg_reduced_mag

ROOT = Path(__file__).resolve().parents[1]


def synthetic_photometry(H=15.0, G=0.15, n=12, seed=0):
    rng = np.random.default_rng(seed)
    mjd = 60000 + np.sort(rng.uniform(0, 60, n))
    alpha = np.linspace(3, 25, n)
    r, d = np.full(n, 2.0), np.full(n, 1.1)
    m = hg_reduced_mag(alpha, H, G) + 5 * np.log10(r * d) + rng.normal(0, 0.03, n)
    phot = pd.DataFrame({"mjd": mjd, "mag": m, "mag_err": 0.03, "band": "V", "photometric_system": "Johnson",
                         "observatory_code": "500", "source_id": [f"SIM{i}" for i in range(n)],
                         "provider": "SIMULATED", "quality": "", "note": ""})
    geom = pd.DataFrame({"r_au": r, "delta_au": d, "phase_deg": alpha})
    return phot, geom


def test_h_estimation_recovers_H_and_G():
    phot, geom = synthetic_photometry()
    h = estimate_h(phot, geom)
    assert h.status == "ESTIMATED"
    assert h.H == pytest.approx(15.0, abs=0.08)
    assert h.G_fitted


def test_h_insufficient_and_non_V_excluded():
    phot, geom = synthetic_photometry(n=4)
    assert estimate_h(phot, geom).status == status.INSUFFICIENT_PHOTOMETRY
    phot, geom = synthetic_photometry()
    phot["band"] = "r"                     # no verified correction enabled by default
    h = estimate_h(phot, geom)
    assert h.status == status.INSUFFICIENT_PHOTOMETRY
    assert h.excluded["non_V_band_no_correction_enabled"] == 12
    assert h.followup_requirements


def test_most_parser_on_real_excerpt():
    text = (ROOT / "tests/fixtures/most_vesta_spherex_excerpt.txt").read_text()
    df = IrsaClient.parse_most_ipac_table(text)
    assert len(df) >= 3
    assert {"ra_obj", "dec_obj", "mjd_start", "uri", "observationid"} <= set(df.columns)
    assert df["uri"].str.contains("spherex").all()
    assert np.isfinite(df["ra_obj"]).all()


def test_point_in_polygon():
    poly_ra, poly_dec = [10, 12, 12, 10], [-1, -1, 1, 1]
    assert point_in_polygon(11, 0, poly_ra, poly_dec)
    assert not point_in_polygon(13, 0, poly_ra, poly_dec)
    assert point_in_polygon(0.2, 0, [359, 1, 1, 359], [-1, -1, 1, 1])  # RA wrap


def test_unmatched_linking():
    dets = [Detection(f"c{i}", 60000 + i * 0.1, 100 + i * 0.01, 5 + i * 0.002, 8.0) for i in range(4)]
    dets.append(Detection("star", 60000.05, 120.0, -3.0, 9.0))
    tab = classify_unmatched(dets)
    assert (tab.set_index("candidate_id").loc["c0", "status"]) == status.UNCATALOGUED_CANDIDATE
    assert (tab.set_index("candidate_id").loc["star", "status"]) == status.UNMATCHED_CANDIDATE
    assert tab["needs_followup"].all()


def test_database_separates_origins(tmp_path):
    with pytest.raises(ValueError):
        AsteroidDatabase(tmp_path / "test.sqlite", origin=status.ORIGIN_SIMULATED)
    db = AsteroidDatabase(tmp_path / "SIMULATED_test.sqlite", origin=status.ORIGIN_SIMULATED)
    db.upsert_result({"asteroid_id": "SIM-1", "origin": status.ORIGIN_SIMULATED})
    with pytest.raises(ValueError):
        db.upsert_result({"asteroid_id": "real", "origin": status.ORIGIN_OBSERVED})
    db.close()
    with pytest.raises(ValueError):
        AsteroidDatabase(tmp_path / "SIMULATED_test.sqlite", origin=status.ORIGIN_OBSERVED)


def test_i18n_keys_exist_and_ui_is_english():
    keys = set()
    for py in (ROOT / "src").rglob("*.py"):
        keys |= set(re.findall(r"""\bt\(\s*["']([a-z_]+\.[a-z_.]+)["']""", py.read_text(encoding="utf-8")))
    keys |= set(re.findall(r"""\bt\(\s*["']([a-z_]+\.[a-z_.]+)["']""", (ROOT / "main.py").read_text()))
    missing = [k for k in keys if t(k) == k]
    assert not missing, missing
    hangul = re.compile("[가-힣]")
    assert not hangul.search((ROOT / "src/i18n/locales/en.yaml").read_text(encoding="utf-8"))
    for py in list((ROOT / "src").rglob("*.py")) + [ROOT / "main.py"]:
        assert not hangul.search(py.read_text(encoding="utf-8")), py


def test_database_schema_migration_adds_new_columns(tmp_path):
    import sqlite3
    path = tmp_path / "old.sqlite"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
    con.execute("INSERT INTO meta VALUES ('origin', 'OBSERVED')")
    con.execute('CREATE TABLE results ("asteroid_id" TEXT PRIMARY KEY, "official_name" TEXT)')
    con.execute("INSERT INTO results VALUES ('old-1', 'kept')")
    con.commit(); con.close()
    db = AsteroidDatabase(path)
    db.upsert_result({"asteroid_id": "new-1", "spectral_complex_probability": [{"rank": 1}]})
    res = db.results().set_index("asteroid_id")
    assert res.loc["old-1", "official_name"] == "kept"
    assert "spectral_complex_probability" in res.columns
    db.close()
