"""Configuration loading. Paths in the config are resolved against the project root."""
from __future__ import annotations

import copy
import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def resolve(path: str | Path) -> Path:
    p = Path(path)
    return p if p.is_absolute() else PROJECT_ROOT / p


@lru_cache(maxsize=4)
def _load(name: str) -> dict:
    with open(PROJECT_ROOT / "config" / name, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def settings() -> dict:
    return copy.deepcopy(_load("settings.yaml"))


def data_sources() -> dict:
    return copy.deepcopy(_load("data_sources.yaml"))


def band_corrections() -> dict:
    return copy.deepcopy(_load("band_corrections.yaml"))


def config_hash(section: Any) -> str:
    """Stable short hash of a config section, stored with results for reproducibility."""
    blob = json.dumps(section, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()[:12]


def model_version(section_name: str | None = None) -> str:
    s = settings()
    base = s["project"]["model_version"]
    if section_name:
        return f"{base}+{section_name}.{config_hash(s.get(section_name, {}))}"
    return base


def cache_directory(name: str) -> Path:
    """Writable runtime cache, separate from versioned reference/calibration data."""
    if not name or Path(name).name != name or name in (".", ".."):
        raise ValueError("Cache name must be a single directory name.")
    runtime = os.environ.get("SPHEREX_ASTEROID_CACHE_DIR")
    return (Path(runtime).resolve() if runtime else resolve(settings()["project"].get("cache_dir", "../../var/cache/asteroids"))) / name
