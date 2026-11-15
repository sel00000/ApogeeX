"""Regression inputs for review findings 12, 13 and 17 (no archive requests)."""
from copy import deepcopy
import json
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from test_extraction import make_fake
from src.acquisition.asteroid_identification import Detection, link_detections
from src.acquisition.jpl_client import SBDBRecord, SBDBClient
from src.acquisition.spherex_search import SearchResult
from src.common.config import settings
from src.common.provenance import Provenance
from src.extraction.fits_product import read_spherex_image
import src.extraction.background_subtraction as background
import src.extraction.spectral_extraction as extraction
from src.integration.asteroid_database import AsteroidDatabase
import src.integration.pipeline as pipeline


@pytest.mark.parametrize("spatial_model", [False, True])
def test_zodi_model_is_subtracted_from_actual_fit_pixels(tmp_path, monkeypatch, spatial_model):
    path = tmp_path / "synthetic.fits"
    ra, dec = make_fake(path, flux_amp=50, bkg=20, noise=.2)
    img = read_spherex_image(path)
    cfg = deepcopy(settings())
    cfg["extraction"]["background_method"] = "zodi_model_plus_annulus"
    monkeypatch.setattr(background, "settings", lambda: cfg)
    monkeypatch.setattr(extraction, "settings", lambda: cfg)
    try:
        if spatial_model:
            # A curved diffuse component cannot be removed by a single value at
            # the centre. Add it to both IMAGE and its independently known model.
            yy, xx = np.indices(img.image.shape)
            diffuse = .04 * ((xx - 20.3) ** 2 + (yy - 19.6) ** 2)
            img.image += diffuse
            img.zodi += diffuse
        result = extraction.forced_psf_photometry(img, ra, dec, recentre=False)
        true_flux = 50 * img.pixel_solid_angle_sr * extraction.MJY_TO_UJY
        assert result.flux_uJy == pytest.approx(true_flux, rel=.03)
        assert result.chi2_red < 2
    finally:
        img.hdul.close()


def test_zodi_mode_without_a_model_uses_total_local_background(tmp_path, monkeypatch):
    path = tmp_path / "no_model.fits"
    ra, dec = make_fake(path, flux_amp=50, bkg=20, noise=.2)
    img = read_spherex_image(path)
    cfg = deepcopy(settings())
    cfg["extraction"]["background_method"] = "zodi_model_plus_annulus"
    monkeypatch.setattr(background, "settings", lambda: cfg)
    monkeypatch.setattr(extraction, "settings", lambda: cfg)
    try:
        img.zodi = None
        result = extraction.forced_psf_photometry(img, ra, dec, recentre=False)
        assert result.flux_uJy == pytest.approx(50 * img.pixel_solid_angle_sr * extraction.MJY_TO_UJY, rel=.03)
    finally:
        img.hdul.close()


@pytest.mark.parametrize("start,speed,dec", [(359.999,.001,0), (.001,-.001,0),
                                            (10.,.001,0), (359.999,.01,70)])
def test_tracklet_crossing_ra_zero_matches_translated_track(start, speed, dec):
    times = [0, 1, 2.5]
    detections = [Detection(str(i), 60800 + t / 24, (start + speed * t) % 360, dec, 20)
                  for i, t in enumerate(times)]
    tracks = link_detections(detections)
    assert [[d.candidate_id for d in track] for track in tracks] == [["0", "1", "2"]]


def _seed_previous(output, db_path, target):
    target_dir = output / target
    target_dir.mkdir(parents=True)
    old_record = {"asteroid_id": target, "origin": "OBSERVED", "analysis_timestamp": "OLD"}
    (target_dir / "integrated_record.json").write_text(json.dumps(old_record))
    stale = "obs_id,wavelength_um,flux_uJy\nold,1.5,1000\n"
    for name in ("stage1_observations.csv", "stage2_spectrum.csv", "stage2_spectrum.fits",
                 "stage3_components_reflectance.csv", "stage3_temporal_analysis.json",
                 "spectrum.png", "separation.png", "residuals.png", "reference_comparison.png", "sky_track.png", "web_run.json"):
        (target_dir / name).write_text(stale)
    (target_dir / "my_notes.txt").write_text("keep my notes")
    (target_dir / "manual").mkdir()
    (target_dir / "manual" / "input.csv").write_text("my inputs")
    db = AsteroidDatabase(db_path)
    db.upsert_result(old_record)
    for ident in (target, "unrelated"):
        db.write_spectrum(ident, pd.DataFrame([{"obs_id": "old", "wavelength_um": 1.5, "flux_uJy": 1000}]))
        db.write_observations(ident, pd.DataFrame([{"obs_id": "old", "mjd_mid": 60800}]))
        db.write_provenance(ident, "old-step", {"old": True})
    db.close()
    return target_dir


def _stub_search(monkeypatch, target, *, empty=False):
    sbdb = SBDBRecord(found=True, query=target, designation=target, fullname=target)
    monkeypatch.setattr(SBDBClient, "lookup", lambda *a, **k: sbdb)
    obs = pd.DataFrame() if empty else pd.DataFrame([{
        "obs_id": "new", "inside_footprint": True, "mjd_mid": 61000.,
        "pred_ra_deg": 1., "pred_dec_deg": 2., "detector": 1}])
    search = SearchResult(target, sbdb, obs, Provenance(step="test", model_version="test"))
    monkeypatch.setattr(pipeline, "search_known_asteroid", lambda *a, **k: search)
    monkeypatch.setattr(pipeline, "extract_spectrum", lambda *a, **k:
                        (pd.DataFrame(), Provenance(step="extraction", model_version="test")))
    return search


def test_completed_rerun_replaces_files_and_database_without_stale_stages(tmp_path, monkeypatch):
    output = tmp_path / "outputs"
    db_path = tmp_path / "results.sqlite"
    target = "test_target"
    target_dir = _seed_previous(output, db_path, target)
    _stub_search(monkeypatch, target)
    result = pipeline.run_analysis(target, "2026-01-01", "2026-01-02", use_mpc_photometry=False,
                                   out_dir=str(output), db_path=str(db_path), log=lambda m: None)
    assert result.record["analysis_timestamp"] != "OLD"
    assert "SPHEREx spectrum" in result.record["missing_data"]
    assert set(p.name for p in target_dir.iterdir()) == {"integrated_record.json", "report.md", "my_notes.txt", "manual", "stage1_observations.csv", "sky_track.png"}
    assert (target_dir / "my_notes.txt").read_text() == "keep my notes"
    assert (target_dir / "manual/input.csv").read_text() == "my inputs"
    assert all(str(target_dir) in path for path in result.files.values())
    assert sorted(p.name for p in output.iterdir()) == [target]
    db = AsteroidDatabase(db_path)
    try:
        assert db.spectrum(target).empty
        assert db.observations(target)["obs_id"].tolist() == ["new"]
        assert "old-step" not in db.provenance(target)["step"].tolist()
        assert len(db.spectrum("unrelated")) == 1
        assert len(db.observations("unrelated")) == 1
        assert db.provenance("unrelated")["step"].tolist() == ["old-step"]
    finally:
        db.close()


@pytest.mark.parametrize("failure", ["search", "database", "publish"])
def test_failed_rerun_preserves_last_completed_files_and_database(tmp_path, monkeypatch, failure):
    output = tmp_path / "outputs"
    db_path = tmp_path / "results.sqlite"
    target = "test_target"
    target_dir = _seed_previous(output, db_path, target)
    before = {p.relative_to(target_dir).as_posix(): p.read_bytes() for p in target_dir.rglob("*") if p.is_file()}
    _stub_search(monkeypatch, target)
    def fail(*args, **kwargs):
        raise RuntimeError("test interrupted run")
    if failure == "search":
        monkeypatch.setattr(pipeline, "search_known_asteroid", fail)
    elif failure == "database":
        monkeypatch.setattr(AsteroidDatabase, "write_provenance", fail)
    else:
        rename = Path.rename
        def fail_publication(path, destination):
            if path.parent.name.startswith(".analysis-run-") and path.name == target:
                raise RuntimeError("test interrupted run")
            return rename(path, destination)
        monkeypatch.setattr(Path, "rename", fail_publication)
    with pytest.raises(RuntimeError, match="interrupted run"):
        pipeline.run_analysis(target, "2026-01-01", "2026-01-02", use_mpc_photometry=False,
                              out_dir=str(output), db_path=str(db_path), log=lambda m: None)
    after = {p.relative_to(target_dir).as_posix(): p.read_bytes() for p in target_dir.rglob("*") if p.is_file()}
    assert after == before
    assert sorted(p.name for p in output.iterdir()) == [target]
    db = AsteroidDatabase(db_path)
    try:
        assert len(db.spectrum(target)) == 1
        assert len(db.observations(target)) == 1
        assert db.results().iloc[0]["analysis_timestamp"] == "OLD"
    finally:
        db.close()


def test_database_replacement_rolls_back_on_mixed_origin(tmp_path):
    db = AsteroidDatabase(tmp_path / "result.sqlite")
    try:
        old = {"asteroid_id": "1", "origin": "OBSERVED", "analysis_timestamp": "OLD"}
        db.replace_analysis(old, pd.DataFrame(), pd.DataFrame([{"obs_id": "old"}]), {"old": {}})
        with pytest.raises(ValueError, match="mix origins"):
            db.replace_analysis({**old, "analysis_timestamp": "NEW"}, pd.DataFrame(),
                                pd.DataFrame([{"obs_id": "bad", "origin": "SIMULATED"}]), {"new": {}})
        assert db.results().iloc[0]["analysis_timestamp"] == "OLD"
        assert db.spectrum("1")["obs_id"].tolist() == ["old"]
        assert db.provenance("1")["step"].tolist() == ["old"]
    finally:
        db.close()


def test_no_data_preserves_previous_completed_result(tmp_path, monkeypatch):
    output, db_path = tmp_path / "outputs", tmp_path / "results.sqlite"
    target = "test_target"
    directory = _seed_previous(output, db_path, target)
    before = {p.relative_to(directory).as_posix(): p.read_bytes() for p in directory.rglob("*") if p.is_file()}
    _stub_search(monkeypatch, target, empty=True)
    result = pipeline.run_analysis(target, "2026-01-01", "2026-01-02", out_dir=str(output),
                                   db_path=str(db_path), log=lambda _: None)
    assert result.error and "No SPHEREx exposures" in result.error
    assert result.files == {} and result.record == {}
    after = {p.relative_to(directory).as_posix(): p.read_bytes() for p in directory.rglob("*") if p.is_file()}
    assert after == before
    assert sorted(p.name for p in output.iterdir()) == [target]


@pytest.mark.parametrize("line_ending", ["\n", "\r\n"], ids=["LF", "CRLF"])
def test_saved_reanalysis_preserves_raw_inputs_and_acquisition_sources(tmp_path, monkeypatch, line_ending):
    output, db_path = tmp_path / "outputs", tmp_path / "results.sqlite"
    target = "test_target"
    directory = output / target
    directory.mkdir(parents=True)
    search = _stub_search(monkeypatch, target)
    # Write explicit bytes: Windows text-mode newline translation must neither
    # corrupt the fixture nor hide a pipeline rewrite of the original CSV.
    raw = search.observations.to_csv(index=False, lineterminator=line_ending).encode("utf-8")
    raw_spectrum = f"obs_id,flux_uJy,flux_err_uJy{line_ending}".encode("utf-8")
    (directory / "stage1_observations.csv").write_bytes(raw)
    (directory / "stage2_spectrum.csv").write_bytes(raw_spectrum)
    source = {"name": "IRSA original acquisition", "retrieved_utc": "2025-05-01", "origin": "OBSERVED"}
    (directory / "integrated_record.json").write_text(json.dumps({"analysis_timestamp": "OLD",
                                                       "input_data_sources": [source]}), encoding="utf-8")
    monkeypatch.setattr(pipeline, "extract_spectrum", lambda *a, **k: pytest.fail("Reanalysis must use saved pixels"))
    result = pipeline.run_analysis(target, None, None, from_saved=True, use_mpc_photometry=False,
                                   out_dir=str(output), db_path=str(db_path), log=lambda _: None)
    assert result.error is None
    assert Path(result.files["observations"]).read_bytes() == raw
    assert Path(result.files["spectrum"]).read_bytes() == raw_spectrum
    assert source in result.record["input_data_sources"]
    db = AsteroidDatabase(db_path)
    try:
        entries = db.provenance(target)
        row = entries[entries["step"] == "search"].iloc[0]
        record = json.loads(row["record"])
        assert record["inputs"]["prior_analysis_timestamp"] == "OLD"
        assert record["inputs"]["saved_files_sha256"] == {
            "stage1_observations.csv": hashlib.sha256(raw).hexdigest(),
            "stage2_spectrum.csv": hashlib.sha256(raw_spectrum).hexdigest(),
        }
    finally:
        db.close()
