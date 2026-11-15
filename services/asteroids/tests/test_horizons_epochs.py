"""Offline regressions for Horizons' chronological TLIST response contract.

The mocked service returns its own numeric Julian dates, as CAL_FORMAT=JD does;
it deliberately does not echo the caller's input order.
"""
import re
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from src.acquisition.jpl_client import HorizonsClient
from src.common.constants import MJD_TO_JD
from src.common.http import DataAccessError
from src.orbital.ephemeris import geometry_for_epochs


def response(rows, *, elong=False):
    header = "Date_________JDUT, R.A._(ICRF), DEC_(ICRF), dRA*cosD, d(DEC)/dt, APmag, r, delta, S-T-O"
    if elong:
        header += ", S-O-T"
    lines = []
    for jd, distance in rows:
        row = f"{jd}, 100, 1, 2, 3, 15, {distance}, {distance / 2}, {distance * 10}"
        lines.append(row + (", 80" if elong else "") + ",")
    return {"result": header + ",\n$$SOE\n" + "\n".join(lines) + "\n$$EOE\n"}


def install_chronological_service(monkeypatch):
    calls = []

    def fetch(_url, *, params, timeout):
        assert params["CAL_FORMAT"] == "JD"
        assert params["TIME_TYPE"] == "UT"
        assert params["TIME_DIGITS"] == "FRACSEC"
        dates = re.findall(r"'([^']+)'", params["TLIST"])
        calls.append(dates)
        return response([(jd, float(jd) - MJD_TO_JD - 60800 + 2) for jd in sorted(dates, key=float)])

    monkeypatch.setattr("src.acquisition.jpl_client.get_json", fetch)
    return calls


def test_unsorted_input_uses_returned_epoch_instead_of_response_row(monkeypatch):
    install_chronological_service(monkeypatch)
    epochs = [60801, 60800]
    result = HorizonsClient().observer_ephemeris("4", epochs)
    assert result.table.mjd.tolist() == epochs
    assert result.table.r_au.tolist() == [3, 2]
    assert result.table.phase_deg.tolist() == [30, 20]


def test_real_horizons_jd_csv_preserves_reverse_order_and_duplicate_observations(monkeypatch):
    raw = (Path(__file__).parent / "fixtures/horizons_vesta_jd_excerpt.txt").read_text(encoding="utf-8")
    monkeypatch.setattr("src.acquisition.jpl_client.get_json", lambda *a, **k: {"result": raw})
    table = HorizonsClient().observer_ephemeris("4", [60801.25, 60800.5, 60801.25], center="500@399").table
    assert table.mjd.tolist() == [60801.25, 60800.5, 60801.25]
    assert table.r_au.tolist() == [2.176709763008, 2.177118657887, 2.176709763008]
    assert table.phase_deg.tolist() == [5.7585, 5.6241, 5.7585]


def test_duplicates_and_chunk_boundaries_preserve_every_original_row(monkeypatch):
    calls = install_chronological_service(monkeypatch)
    epochs = [60803, 60801, 60803, 60802, 60800, 60801]
    table = HorizonsClient().observer_ephemeris("4", epochs, chunk=2).table
    assert table.mjd.tolist() == epochs
    assert table.r_au.tolist() == [5, 3, 5, 4, 2, 3]
    assert len(calls) == 2
    assert all(len(c) == 2 for c in calls)
    assert len(set(jd for c in calls for jd in c)) == 4


def test_nearby_distinct_epochs_are_not_merged_by_a_nearest_time_tolerance(monkeypatch):
    def fetch(_url, *, params, timeout):
        dates = sorted(re.findall(r"'([^']+)'", params["TLIST"]), key=float)
        assert len(dates) == 2 and dates[0] != dates[1]
        return response([(dates[0], 2), (dates[1], 3)])

    monkeypatch.setattr("src.acquisition.jpl_client.get_json", fetch)
    epochs = [60800.00000004, 60800.00000001]
    table = HorizonsClient().observer_ephemeris("4", epochs).table
    assert table.mjd.tolist() == epochs
    assert table.r_au.tolist() == [3, 2]


@pytest.mark.parametrize("kind", ["missing", "unexpected", "invalid", "conflicting"])
def test_incomplete_or_ambiguous_answer_fails_instead_of_misassigning_geometry(monkeypatch, kind):
    rows = [("2460800.50000000", 2), ("2460801.50000000", 3)]
    if kind == "missing":
        rows.pop()
    elif kind == "unexpected":
        rows[1] = ("2460802.50000000", 3)
    elif kind == "invalid":
        rows[1] = ("2025-May-06", 3)
    else:
        rows.append((rows[0][0], 99))
    monkeypatch.setattr("src.acquisition.jpl_client.get_json", lambda *a, **k: response(rows))
    with pytest.raises(DataAccessError, match="epoch|Julian|conflicting"):
        HorizonsClient().observer_ephemeris("4", [60801, 60800])


def test_empty_epochs_do_not_query_and_return_a_typed_empty_table(monkeypatch):
    monkeypatch.setattr("src.acquisition.jpl_client.get_json", lambda *a, **k: pytest.fail("No request expected"))
    table = HorizonsClient().observer_ephemeris("4", []).table
    assert table.empty
    assert {"mjd", "r_au", "delta_au", "phase_deg"}.issubset(table.columns)


@pytest.mark.parametrize("epochs", [[np.nan], [np.inf], [[60800, 60801]]])
def test_invalid_epochs_fail_before_the_request(monkeypatch, epochs):
    monkeypatch.setattr("src.acquisition.jpl_client.get_json", lambda *a, **k: pytest.fail("No request expected"))
    with pytest.raises(ValueError, match="finite one-dimensional"):
        HorizonsClient().observer_ephemeris("4", epochs)


def test_range_ephemeris_retains_actual_jd_and_elongation(monkeypatch):
    monkeypatch.setattr("src.acquisition.jpl_client.get_json", lambda *a, **k: response(
        [("2460800.50000000", 2), ("2460801.50000000", 3)], elong=True))
    table = HorizonsClient().range_ephemeris("4", "2025-05-05", "2025-05-06").table
    assert table.mjd.tolist() == [60800, 60801]
    assert table.elongation_deg.tolist() == [80, 80]


def test_geometry_matches_epochs_with_duplicates_and_interleaved_observatories(monkeypatch):
    calls = []

    def observer(self, designation, epochs, *, center, spkid):
        calls.append((center, epochs.tolist()))
        # Return chronological, unique epochs to verify the consuming boundary
        # also matches epochs instead of trusting an alternate client's order.
        ordered = np.unique(epochs)
        delta = 10 if center == "568@399" else 0
        return SimpleNamespace(table=pd.DataFrame({"mjd": ordered, "r_au": ordered - 60800 + 2 + delta,
                                                   "delta_au": ordered - 60800 + 1,
                                                   "phase_deg": ordered - 60800 + 20}), source=center)

    monkeypatch.setattr(HorizonsClient, "observer_ephemeris", observer)
    epochs = [60802, 60801, 60800, 60801, 60802]
    table, sources = geometry_for_epochs("4", epochs, observatory_codes=["500", "568", "500", "568", "500"])
    assert table.mjd.tolist() == epochs
    assert table.r_au.tolist() == [4, 13, 2, 13, 4]
    assert len(calls) == len(sources) == 2


def test_geometry_rejects_missing_or_unmatched_epochs(monkeypatch):
    def observer(self, designation, epochs, **kwargs):
        return SimpleNamespace(table=pd.DataFrame({"mjd": [60800], "r_au": [2], "delta_au": [1], "phase_deg": [20]}), source="test")

    monkeypatch.setattr(HorizonsClient, "observer_ephemeris", observer)
    with pytest.raises(DataAccessError, match="epoch mismatch"):
        geometry_for_epochs("4", [60800, 60801])


def test_geometry_rejects_mismatched_observatory_codes():
    with pytest.raises(ValueError, match="observatory code"):
        geometry_for_epochs("4", [60800, 60801], observatory_codes=["500"])
