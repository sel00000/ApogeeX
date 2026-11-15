"""Run one isolated, observed asteroid analysis for the integrated local website.

The web adapter reports acquisition/processing status separately from scientific
confidence. It never turns a no-data/error return into a fabricated result.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")


def failure_state(message: str) -> dict:
    text = str(message)
    low = text.lower()
    if low.startswith("no spherex exposures"):
        status, code = "no_data", "no_observations"
    elif low.startswith("invalid date") or "must be after the start date" in low or "was not found in jpl sbdb" in low:
        status, code = "invalid_input", "invalid_input"
    else:
        status, code = "failed", "analysis_failed"
    return {"status": status, "code": code, "message": text}


def complete_result(result, *, output_dir: Path, db_path: Path, run_id: str, request: dict) -> dict:
    """Validate and describe the real pipeline output, without importing its models.

    Keeping this boundary independently testable ensures errors are handled even
    if scientific libraries or an upstream archive are unavailable.
    """
    if getattr(result, "error", None):
        return failure_state(result.error)
    files = getattr(result, "files", {}) or {}
    if not files.get("record"):
        return {"status": "failed", "code": "missing_result", "message": "The analysis did not produce an integrated record."}
    output = output_dir.resolve()
    record_path = Path(files["record"]).resolve()
    if not record_path.is_file() or not record_path.is_relative_to(output):
        return {"status": "failed", "code": "invalid_result_path", "message": "The result is outside its isolated job directory."}
    try:
        record = json.loads(record_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {"status": "failed", "code": "invalid_result", "message": f"The integrated record could not be read: {exc}"}
    if record.get("origin") != "OBSERVED":
        return {"status": "failed", "code": "invalid_origin", "message": "Only explicitly OBSERVED analysis results may be published."}
    source_root = Path(__file__).resolve().parent
    config_files = sorted((source_root / "config").glob("*.yaml"))
    code_files = sorted((source_root / "src").rglob("*.py"))

    def digest_files(paths):
        digest = hashlib.sha256()
        for path in paths:
            digest.update(path.relative_to(source_root).as_posix().encode("utf-8"))
            digest.update(b"\0")
            digest.update(path.read_bytes())
        return digest.hexdigest()

    inputs = {}
    for name in ("stage1_observations.csv", "stage2_spectrum.csv", "stage3_components_reflectance.csv"):
        path = record_path.parent / name
        if path.is_file():
            inputs[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    metadata = {
        "schemaVersion": 1, "runId": run_id,
        "objectId": str(record.get("asteroid_id", getattr(result, "target", request["target"]))),
        "request": request, "acquisitionMode": "fresh",
        "processingState": "completed", "origin": "OBSERVED",
        "modelVersion": record.get("model_version"),
        "configSha256": digest_files(config_files), "sourceSha256": digest_files(code_files),
        "inputSha256": inputs,
        "observationContract": {"key": ["objectId", "obs_id", "detector"], "timeScale": "UTC",
                                "timeFormat": "MJD", "angles": "deg", "flux": "uJy", "wavelength": "um",
                                "positionMeaning": "predicted direction at each recorded observation; not current position"},
    }
    metadata_path = record_path.parent / "web_run.json"
    temporary = metadata_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(metadata, ensure_ascii=False, allow_nan=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(metadata_path)
    return {"status": "succeeded", "sourceDir": str(record_path.parent), "objectId": metadata["objectId"], "runId": run_id}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--max-images", type=int, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    if not 1 <= args.max_images <= 360:
        parser.error("max-images must be between 1 and 360")
    request = {"target": args.target, "start": args.start, "end": args.end, "maxImages": args.max_images}
    try:
        from src.integration.pipeline import run_analysis
        result = run_analysis(args.target, args.start, args.end, max_images=args.max_images,
                              out_dir=str(args.output_dir.resolve()), db_path=str(args.db_path.resolve()),
                              log=lambda message: print(message, flush=True))
        state = complete_result(result, output_dir=args.output_dir, db_path=args.db_path,
                                run_id=args.run_id, request=request)
    except Exception as exc:
        state = {"status": "failed", "code": "analysis_failed", "message": f"{type(exc).__name__}: {exc}"}
    if state["status"] != "succeeded":
        print("SPHEREX_WEB_STATUS=" + json.dumps(state, ensure_ascii=False), flush=True)
        return 3 if state["status"] == "no_data" else 2
    print("SPHEREX_WEB_RESULT=" + json.dumps(state, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
