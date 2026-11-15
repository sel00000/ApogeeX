"""HTTP helper with retries and an optional on-disk cache for idempotent GET requests."""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import requests

from .config import data_sources, resolve

USER_AGENT = "spherex-asteroid-analysis/0.1 (research software)"


class DataAccessError(RuntimeError):
    """Raised when a remote service cannot be reached or returns an error."""


import threading

_local = threading.local()


def session() -> requests.Session:
    """One requests.Session per thread (Session objects are not guaranteed to be thread-safe)."""
    s = getattr(_local, "session", None)
    if s is None:
        s = requests.Session()
        s.headers["User-Agent"] = USER_AGENT
        _local.session = s
    return s


def _cache_path(key: str) -> Path | None:
    cfg = data_sources().get("cache", {})
    if not cfg.get("enabled", False):
        return None
    runtime = os.environ.get("SPHEREX_ASTEROID_CACHE_DIR")
    d = Path(runtime).resolve() / "http" if runtime else resolve(cfg.get("directory", "data/raw/cache"))
    d.mkdir(parents=True, exist_ok=True)
    return d / (hashlib.sha256(key.encode()).hexdigest()[:24] + ".cache")


def request(method: str, url: str, *, params=None, data=None, json_body=None,
            timeout: float = 120, retries: int = 5, use_cache: bool = False,
            binary: bool = False):
    key = json.dumps([method, url, params, data, json_body], sort_keys=True, default=str)
    cpath = _cache_path(key) if use_cache else None
    if cpath is not None and cpath.exists():
        raw = cpath.read_bytes()
        return raw if binary else raw.decode("utf-8")

    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session().request(method, url, params=params, data=data, json=json_body,
                                     timeout=timeout)
            if resp.status_code >= 500:
                raise DataAccessError(f"{url} returned HTTP {resp.status_code}")
            if resp.status_code >= 400:
                # Client errors are not retried.
                raise DataAccessError(f"{url} returned HTTP {resp.status_code}: {resp.text[:300]}")
            content = resp.content
            if cpath is not None:
                cpath.write_bytes(content)
            return content if binary else resp.text
        except DataAccessError as err:
            last_err = err
            if "HTTP 4" in str(err):
                break
        except requests.RequestException as err:
            last_err = err
        time.sleep(min(3 * 2 ** attempt, 60))   # 3, 6, 12, 24 s: IRSA returns 503 under load
    raise DataAccessError(f"Request failed: {url}: {last_err}")


def get_json(url: str, params=None, timeout: float = 120, use_cache: bool = False) -> dict:
    text = request("GET", url, params=params, timeout=timeout, use_cache=use_cache)
    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        raise DataAccessError(f"Invalid JSON from {url}: {text[:200]}") from err
