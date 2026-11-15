"""Robustness of analyses started from the dashboard or the CLI (2026-11-15), offline."""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.common.config import resolve


def test_check_window_rejects_bad_dates_and_reversed_windows():
    from src.integration.pipeline import check_window
    assert check_window("2025-05-01", "2025-09-30") is None
    assert "Invalid date" in check_window("2025-13-01", "2025-09-30")
    assert "must be after" in check_window("2025-09-30", "2025-05-01")
    assert "must be after" in check_window("2025-05-01", "2025-05-01")


def test_unknown_object_stops_before_writing_anything(tmp_path, monkeypatch):
    """An unknown name must not leave a folder or a database record (it used to: 'Insufficient Data')."""
    from src.acquisition import jpl_client
    from src.integration.pipeline import run_analysis
    monkeypatch.setattr(jpl_client.SBDBClient, "lookup",
                        lambda self, q: jpl_client.SBDBRecord(found=False, query=q, message="specified object was not found"))
    db = tmp_path / "t.sqlite"
    po = run_analysis("zzzz12345", "2025-05-01", "2025-09-30", out_dir=str(tmp_path / "out"), db_path=str(db),
                      log=lambda m: None)
    assert po.error and "not found in JPL SBDB" in po.error
    assert not (tmp_path / "out").exists() and not db.exists()


def test_names_of_one_object_share_one_record(tmp_path, monkeypatch):
    """'Eros' and '433 Eros' resolve to the SBDB designation 433 before anything is stored."""
    from src.acquisition import jpl_client, spherex_search
    from src.integration import pipeline
    monkeypatch.setattr(jpl_client.SBDBClient, "lookup",
                        lambda self, q: jpl_client.SBDBRecord(found=True, query=q, designation="433",
                                                              fullname="433 Eros (A898 PA)"))
    seen = {}

    def no_exposures(target, start, end):
        seen["target"] = target
        return spherex_search.SearchResult(target, None, pd.DataFrame(), None, [])
    monkeypatch.setattr(pipeline, "search_known_asteroid", no_exposures)
    po = pipeline.run_analysis("Eros", "2025-07-01", "2025-07-10", out_dir=str(tmp_path / "out"),
                               db_path=str(tmp_path / "t.sqlite"), log=lambda m: None)
    assert seen["target"] == "433" and po.target == "433"
    assert po.error and "No SPHEREx exposures" in po.error           # an empty search is not stored either
    assert not (tmp_path / "out").exists()


@pytest.mark.parametrize("failure", ["empty_target", "invalid_date", "sbdb_failure", "archive_failure", "saved_missing"])
def test_preflight_failures_do_not_create_output_or_database(tmp_path, monkeypatch, failure):
    from src.acquisition import jpl_client
    from src.common.http import DataAccessError
    from src.integration import pipeline
    output, database = tmp_path / "out", tmp_path / "analysis.sqlite"

    def lookup(self, query):
        # The output must not even exist while identity/data validation runs.
        assert not output.exists()
        if failure == "sbdb_failure":
            raise DataAccessError("SBDB fixture unavailable")
        if failure in {"empty_target", "invalid_date"}:
            pytest.fail("Input validation must precede catalogue access")
        return jpl_client.SBDBRecord(found=True, query=query, designation="433", fullname="433 Eros")

    def search(*args):
        assert not output.exists()
        raise DataAccessError("IRSA fixture unavailable")

    monkeypatch.setattr(jpl_client.SBDBClient, "lookup", lookup)
    monkeypatch.setattr(pipeline, "search_known_asteroid", search)
    result = pipeline.run_analysis("" if failure == "empty_target" else "433",
                                   "invalid" if failure == "invalid_date" else "2026-01-01", "2026-01-02",
                                   from_saved=failure == "saved_missing", out_dir=str(output), db_path=str(database),
                                   log=lambda _: None)
    assert result.error and not result.files
    assert not output.exists() and not database.exists()


def test_no_data_keeps_an_existing_empty_output_root(tmp_path, monkeypatch):
    from src.acquisition import jpl_client, spherex_search
    from src.integration import pipeline
    output, database = tmp_path / "out", tmp_path / "analysis.sqlite"
    output.mkdir()
    monkeypatch.setattr(jpl_client.SBDBClient, "lookup",
                        lambda self, query: jpl_client.SBDBRecord(found=True, query=query, designation="433"))
    monkeypatch.setattr(pipeline, "search_known_asteroid",
                        lambda *args: spherex_search.SearchResult("433", None, pd.DataFrame(), None, []))
    result = pipeline.run_analysis("433", "2026-01-01", "2026-01-02", out_dir=str(output), db_path=str(database),
                                   log=lambda _: None)
    assert result.error and "No SPHEREx exposures" in result.error
    assert output.is_dir() and list(output.iterdir()) == []
    assert not database.exists()


def test_outlier_is_tested_where_the_sampling_is_sparse():
    """69 Hesperia: a point 3x too faint had only 3 neighbours within 0.08 um and was never tested."""
    from src.preprocessing.spectrum_cleaning import reject_outliers
    lam = np.array([1.70, 1.78, 1.85, 1.89, 1.934, 1.97, 2.06, 2.15, 2.24])
    flux = np.full(len(lam), 55000.0)
    flux[4] = 18000.0
    df = pd.DataFrame({"wavelength_um": lam, "flux_uJy": flux, "flux_err_uJy": 1000.0})
    out = reject_outliers(df, "flux_uJy", "flux_err_uJy")
    assert out.set_index("wavelength_um").loc[1.934, "outlier"] and out["outlier"].sum() == 1


def test_thermal_group_needs_enough_continuum_points():
    """92 Undina: a group with 3 continuum and 33 thermal points was chosen, the fit failed, and no
    reflectance was made at all."""
    from src.integration.spectrum_analysis import _reference_group
    from src.preprocessing.thermal_separation import ThermalSeparator
    from src.preprocessing.solar_spectrum import blackbody_sun
    sep = ThermalSeparator(solar=blackbody_sun())
    rows = [(0, lam) for lam in [1.7, 1.9, 2.1] + list(np.linspace(3.6, 4.9, 33))]
    rows += [(5, lam) for lam in np.linspace(1.65, 2.45, 10)]
    df = pd.DataFrame(rows, columns=["norm_group", "wavelength_um"])
    g, _ = _reference_group(df, sep)
    assert g == 5


def test_thermal_bound_is_negligible_for_main_belt_and_not_near_the_sun():
    from src.integration.spectrum_analysis import thermal_upper_bound_fraction
    mb = pd.DataFrame({"wavelength_um": [2.4], "r_au": [3.5], "delta_au": [3.3], "flux_uJy": [50000.0]})
    near = pd.DataFrame({"wavelength_um": [2.4], "r_au": [0.9], "delta_au": [0.2], "flux_uJy": [50000.0]})
    assert thermal_upper_bound_fraction(mb, 6.7)[0] < 1e-2
    assert thermal_upper_bound_fraction(near, 15.0)[0] > thermal_upper_bound_fraction(mb, 15.0)[0]


DB = resolve("outputs/asteroids.sqlite")


@pytest.mark.skipif(not Path(DB).exists(), reason="no stored results")
def test_dashboard_opens_every_stored_result_without_error():
    from streamlit.testing.v1 import AppTest
    from src.integration.asteroid_database import AsteroidDatabase
    ids = AsteroidDatabase(str(DB), origin="OBSERVED").results()["asteroid_id"].tolist()
    at = AppTest.from_file(str(resolve("src/visualization/result_dashboard.py")), default_timeout=300)
    at.run()
    assert not at.exception, [e.message for e in at.exception]
    for tid in ids:
        at.text_input(key="query").set_value(str(tid)).run()
        assert not at.exception, (tid, [e.message[:300] for e in at.exception])
        assert not at.error, (tid, [e.value for e in at.error])


@pytest.mark.skipif(not Path(DB).exists(), reason="no stored results")
def test_dashboard_run_with_unknown_name_warns_and_stores_nothing(monkeypatch):
    from streamlit.testing.v1 import AppTest
    from src.acquisition import jpl_client
    from src.integration.asteroid_database import AsteroidDatabase
    monkeypatch.setattr(jpl_client.SBDBClient, "lookup",
                        lambda self, q: jpl_client.SBDBRecord(found=False, query=q, message="specified object was not found"))
    before = set(AsteroidDatabase(str(DB), origin="OBSERVED").results()["asteroid_id"])
    at = AppTest.from_file(str(resolve("src/visualization/result_dashboard.py")), default_timeout=300)
    at.run()
    at.text_input(key="run_target").set_value("zzzz12345").run()
    at.sidebar.button[0].click().run()
    assert not at.exception, [e.message for e in at.exception]
    assert any("not found in JPL SBDB" in w.value for w in at.warning)
    assert set(AsteroidDatabase(str(DB), origin="OBSERVED").results()["asteroid_id"]) == before


def test_horizons_epochs_are_deduplicated(monkeypatch):
    """Every SPHEREx exposure is listed twice (SWIR and MWIR detector, same time). Horizons refuses a TLIST made only of
    identical times ("Bad dates -- start must be earlier than stop"), which once cost 773 Irmintraud all of its
    geometry. Unique epochs are queried and mapped back to every row."""
    from src.acquisition import jpl_client

    calls = []

    def fake_get_json(url, params=None, timeout=120, use_cache=False):
        times = [float(x.strip("'")) for x in params["TLIST"].split()]
        calls.append(times)
        if len(times) > 1 and len(set(times)) == 1:
            return {"result": " Bad dates -- start must be earlier than stop "}
        hdr = (" Date_________JDUT, , , R.A.___(ICRF), DEC____(ICRF), dRA*cosD, d(DEC)/dt, APmag, S-brt, r, rdot, "
               "delta, deldot, S-T-O,")
        body = "\n".join(f" {t:.8f}, , , 10.0, 5.0, 1.0, 1.0, 15.0, 7.0, {2.0 + (t % 1):.6f}, 0.1, 1.5, 0.1, 20.0,"
                         for t in times)
        return {"result": f"{hdr}\n$$SOE\n{body}\n$$EOE\n", "signature": {}}

    monkeypatch.setattr(jpl_client, "get_json", fake_get_json)
    mjd = [60987.1, 60987.1, 60987.2, 60987.2, 60987.3, 60987.3]
    e = jpl_client.HorizonsClient().observer_ephemeris("773", mjd, chunk=2)
    assert len(e.table) == 6 and list(e.table["mjd"]) == mjd
    assert all(len(set(c)) == len(c) for c in calls)                       # no duplicate epochs sent
    r = e.table["r_au"].to_numpy()
    assert r[0] == r[1] and r[2] == r[3] and r[0] != r[2]                    # mapped back to the right rows
