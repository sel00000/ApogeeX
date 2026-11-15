"""Provenance records: every computed quantity carries its inputs, formula, model
version and data sources so the calculation can be reproduced."""
from __future__ import annotations

import datetime as _dt
import json
from dataclasses import asdict, dataclass, field
from typing import Any


def utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


@dataclass
class DataSource:
    name: str                      # e.g. "JPL SBDB"
    url: str = ""
    query: str = ""
    retrieved_utc: str = field(default_factory=utc_now)
    version: str = ""              # data release / API version / orbit solution
    identifier: str = ""           # file name, obs_id, record id
    origin: str = "OBSERVED"       # OBSERVED | SIMULATED | REFERENCE | LITERATURE

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Provenance:
    step: str
    model_version: str
    formula: str = ""
    inputs: dict = field(default_factory=dict)
    assumptions: dict = field(default_factory=dict)
    sources: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    created_utc: str = field(default_factory=utc_now)

    def add_source(self, src: DataSource | dict) -> None:
        self.sources.append(src.to_dict() if isinstance(src, DataSource) else dict(src))

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "model_version": self.model_version,
            "formula": self.formula,
            "inputs": _jsonable(self.inputs),
            "assumptions": _jsonable(self.assumptions),
            "sources": _jsonable(self.sources),
            "warnings": list(self.warnings),
            "created_utc": self.created_utc,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


def _jsonable(obj: Any) -> Any:
    try:
        import numpy as np
    except ImportError:  # pragma: no cover
        np = None
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    if np is not None:
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.generic):
            return obj.item()
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    return obj
