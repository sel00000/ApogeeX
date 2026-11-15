import json
from pathlib import Path
from types import SimpleNamespace

from web_bridge import complete_result, failure_state


def test_no_data_and_external_failure_are_not_equivalent():
    assert failure_state('No SPHEREx exposures of Eros between two dates.')["status"] == "no_data"
    assert failure_state('IRSA could not be reached; try again later.')["status"] == "failed"
    assert failure_state("'missing' was not found in JPL SBDB (no match).")["status"] == "invalid_input"


def test_returned_pipeline_error_never_reads_missing_record(tmp_path):
    state = complete_result(SimpleNamespace(error="No SPHEREx exposures of 433.", files={}),
                            output_dir=tmp_path, db_path=tmp_path / "db.sqlite", run_id="test",
                            request={"target": "433"})
    assert state["status"] == "no_data"
    assert not list(tmp_path.iterdir())


def test_observed_result_contract_preserves_real_identity_and_fingerprints(tmp_path):
    result_dir = tmp_path / "outputs" / "433"
    result_dir.mkdir(parents=True)
    record = result_dir / "integrated_record.json"
    record.write_text(json.dumps({"origin": "OBSERVED", "asteroid_id": "433", "model_version": "test", "quality_status": "Complete", "confidence_level": "Low"}))
    (result_dir / "stage1_observations.csv").write_text("obs_id,detector\na,1\n")
    state = complete_result(SimpleNamespace(error=None, files={"record": str(record)}, target="433"),
                            output_dir=tmp_path / "outputs", db_path=tmp_path / "db.sqlite", run_id="run-1",
                            request={"target": "Eros", "start": "2026-01-01", "end": "2026-02-01", "maxImages": 48})
    assert state["status"] == "succeeded"
    metadata = json.loads((result_dir / "web_run.json").read_text())
    assert metadata["objectId"] == "433"
    assert metadata["request"]["target"] == "Eros"
    assert len(metadata["configSha256"]) == 64
    assert len(metadata["sourceSha256"]) == 64
    assert metadata["observationContract"]["key"] == ["objectId", "obs_id", "detector"]


def test_simulated_or_escaped_results_cannot_be_published(tmp_path):
    output = tmp_path / "outputs"
    output.mkdir()
    record = tmp_path / "integrated_record.json"
    record.write_text('{"origin":"OBSERVED"}')
    args = dict(output_dir=output, db_path=tmp_path / "db.sqlite", run_id="test", request={"target": "433"})
    state = complete_result(SimpleNamespace(error=None, files={"record": str(record)}), **args)
    assert state["code"] == "invalid_result_path"
    record = output / "integrated_record.json"
    record.write_text('{"origin":"SIMULATED"}')
    state = complete_result(SimpleNamespace(error=None, files={"record": str(record)}), **args)
    assert state["code"] == "invalid_origin"
