"""Centralized UI strings. All user-facing text comes from locales/<lang>.yaml.

Usage:  from src.i18n import t;  t("dashboard.title")
English is the default and only UI language in this release.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

_LOCALE_DIR = Path(__file__).parent / "locales"
DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = ("en",)
_current = DEFAULT_LANGUAGE


@lru_cache(maxsize=4)
def _catalog(lang: str) -> dict:
    with open(_LOCALE_DIR / f"{lang}.yaml", "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def set_language(lang: str) -> None:
    global _current
    if lang not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported UI language: {lang}")
    _current = lang


def t(key: str, **kwargs) -> str:
    node = _catalog(_current)
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            node = None
            break
        node = node[part]
    if node is None and _current != DEFAULT_LANGUAGE:
        return t(key, **kwargs)
    if node is None or isinstance(node, dict):
        return key  # missing key is visible to developers, never silently translated
    text = str(node)
    return text.format(**kwargs) if kwargs else text
