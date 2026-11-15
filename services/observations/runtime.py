"""Service paths; generated observations never overwrite application source."""
import json
import os
import uuid
from pathlib import Path

PROJECT_ROOT = Path(os.environ.get('SPHEREX_PROJECT_ROOT', Path(__file__).resolve().parents[2])).resolve()
DATA_DIR = Path(os.environ.get('SPHEREX_DATA_DIR', PROJECT_ROOT / 'apps' / 'analysis' / 'public' / 'data')).resolve()
RUNTIME_DIR = Path(os.environ.get('SPHEREX_RUNTIME_DIR', PROJECT_ROOT / 'var' / 'observations')).resolve()
PATCH_DIR = RUNTIME_DIR / 'patches'
CACHE_DIR = RUNTIME_DIR / 'cache'


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    try:
        temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=1), encoding='utf-8')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
