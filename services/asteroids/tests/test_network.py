"""Live-service tests (run with:  pytest --run-network). They use real archives."""
import pytest

pytestmark = pytest.mark.network


def test_sbdb_vesta():
    from src.acquisition.jpl_client import SBDBClient
    r = SBDBClient().lookup("4")
    assert r.found and r.spkid == "20000004"
    assert r.value("H") is not None and r.value("GM") is not None


def test_sbdb_not_found_is_not_a_discovery():
    from src.acquisition.jpl_client import SBDBClient
    r = SBDBClient().lookup("2099 XX999")
    assert not r.found


def test_horizons_from_spherex():
    from src.acquisition.jpl_client import HorizonsClient
    e = HorizonsClient().observer_ephemeris("4", [60847.5725], center="500@-163182", spkid="20000004")
    row = e.table.iloc[0]
    assert 0 < row["phase_deg"] < 40 and 1.5 < row["r_au"] < 3


def test_most_finds_vesta_in_spherex():
    from src.acquisition.irsa_client import IrsaClient
    df, _ = IrsaClient().most_query(naifid="20000004", obs_begin="2025-06-20", obs_end="2025-06-23")
    assert len(df) > 0


def test_search_and_extract_two_images(tmp_path):
    from src.acquisition.spherex_search import search_known_asteroid
    from src.extraction.spectral_extraction import extract_spectrum
    res = search_known_asteroid("4", "2025-06-20", "2025-06-23")
    assert not res.observations.empty
    assert res.observations["inside_footprint"].any()
    spec, prov = extract_spectrum(res.observations[res.observations["inside_footprint"]], cache_dir=str(tmp_path),
                                  max_images=2)
    assert len(spec) >= 1
    assert (spec["origin"] == "OBSERVED").all()
