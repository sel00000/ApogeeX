"""Public jobs isolate generated caches without changing science settings or inputs."""
from pathlib import Path

from src.common.config import cache_directory, data_sources, resolve, settings
from src.common.http import _cache_path
from src.acquisition.neowise_catalogue import catalogue_dir as neowise_directory
from src.acquisition.population_catalogue import catalogue_dir as population_directory


def test_public_job_caches_share_only_the_assigned_runtime_directory(tmp_path, monkeypatch):
    before = settings()
    monkeypatch.setenv('SPHEREX_ASTEROID_CACHE_DIR', str(tmp_path / 'job-cache'))
    root = (tmp_path / 'job-cache').resolve()
    assert cache_directory('spherex_cutouts') == root / 'spherex_cutouts'
    assert _cache_path('fixed test URL').parent == root / 'http'
    assert neowise_directory() == root / 'neowise'
    assert population_directory() == root / 'sbdb_physical'
    assert settings() == before  # Counts, calibration and model choices are untouched.


def test_local_cache_locations_remain_configuration_driven(monkeypatch):
    monkeypatch.delenv('SPHEREX_ASTEROID_CACHE_DIR', raising=False)
    assert cache_directory('spherex_cutouts') == resolve(settings()['project']['cache_dir']) / 'spherex_cutouts'
    assert neowise_directory() == resolve(settings()['thermal_model']['eta_prior_relations']['neowise_population']['catalogue_dir'])
    assert population_directory() == resolve(settings()['population_prior']['catalogue_dir'])
