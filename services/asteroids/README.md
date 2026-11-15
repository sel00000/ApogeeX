# SPHEREx Asteroid Spectral and Physical Analysis System

Research software that finds asteroids in NASA SPHEREx spectral images, extracts their
0.75–5.0 µm spectra, separates reflected sunlight from thermal emission (NEATM), proposes
spectral-type and mineral candidates, estimates diameter, absolute magnitude H and
geometric albedo, and links mass and density from dynamical measurements.

Principles enforced in code:
- Observed SPHEREx data first. Synthetic data is labelled `SIMULATED` and kept in separate files and databases.
- No invented values. Missing results are `N/A`, `Unknown`, `Insufficient Data`, `H unavailable`, or
  `Not estimable from available data`.
- Every result records its inputs, formula, model version (with a hash of the config) and data sources.
- Albedo is computed only from a thermal-model diameter plus a reliable V-band H.
- The thermal diameter is a posterior from all SPHEREx points (every normalisation group, visit-correlated brightness
  errors as nuisance parameters), marginalised over a beaming-parameter prior from ~70 000 NEOWISE fits (main belt,
  Hildas, Trojans; Trilling et al. 2016 for NEOs). The best diameter combines it with the population albedo prior and
  is never used for an albedo (`docs/METHODS.md` §3b).
- A thermal (NEATM) diameter is an effective diameter. When SBDB gives a shape (extent, spin pole), it is also compared
  with the effective diameter of that shape at the SPHEREx geometry, not only with the volume-equivalent catalogue
  value (433 Eros, seen pole-on in 2025-07: 22.1 km for 16.84 km; `docs/METHODS.md` §8b).
- Population priors (JPL SBDB catalogue: albedo by orbit and taxonomic complex, complex frequency by orbit)
  are labelled as priors. The classifier shows the spectral-only ranking next to the final one. A
  statistical diameter (H + albedo prior, constrained by the SPHEREx thermal non-detection) is stored apart
  from the thermal diameter and never used for an albedo. No object's own catalogue class or diameter
  trains its own prior.
- No telescope or observatory is a default source of optical photometry.
- The UI is in English, with every string in `src/i18n/locales/en.yaml`.

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                         # offline unit tests
pytest --run-network           # adds live IRSA / JPL tests

# full pipeline for (4) Vesta over its first SPHEREx season (limit to 60 exposures)
python main.py analyze --target 4 --start 2025-05-01 --end 2025-09-30 --max-images 60
python main.py dashboard       # Streamlit UI at http://localhost:8501

# relative spectral calibration from SPHEREx photometry of solar analogs (once per data release;
# about 4 MB per cached cutout in data/raw/spherex_cutouts_solar_analogs/)
python main.py solar-analog-calibration --start 2025-03-01 --end 2026-11-14 --max-images-per-star 150
```

The stored correction (`data/calibration/solar_analog_correction.csv`) is applied to every OBSERVED
spectrum in the shared analysis chain; without it nothing is corrected and the report says so.

Figures and the dashboard share one dark colour scheme (`src/visualization/style.py`; dashboard theme
pinned in `.streamlit/config.toml`). Plots therefore sit in the page without a white box. To change
colours, edit those two files together.

Outputs go to `outputs/<target>/`: the stage CSVs, `report.md`, `integrated_record.json` and PNG
plots. Integrated results are stored in `outputs/asteroids.sqlite`.

### Adding an asteroid
- Analysis only: `python main.py analyze --target 221 --start 2025-04-12 --end 2026-10-15` (all exposures of the
  window), or the dashboard's "Run new analysis" panel (default cap 400). A cap (`--max-images`) is shared among the
  observing seasons: every season adds thermal signal, so the diameter needs all of them (about 3 s per new exposure
  to download). The classification uses the earliest 120 images, the sampling it was validated on
  (`classification.max_images`). The result appears in `outputs/221/`, the database and the
  dashboard. A name ("Eros") is resolved in JPL SBDB and stored under the designation (433). An unknown
  name, an invalid window, a window without SPHEREx data (DR1 starts on 2025-04-12) or an unreachable
  service stops the run with a message and stores nothing.
- As a validation target: add an entry to `config/validation_targets.yaml` with the reference class and
  its source, then run `python main.py validate-batch --targets 221 --start ... --end ...`. Without an
  entry, the SBDB taxonomy fields are used.
- Re-analysis without searching or extracting again (e.g. after a change of the classifier or the figure
  colours): `python main.py analyze --target 221 --from-saved`. This rewrites the record, report, database
  entries and figures from the saved stage-1/2 tables.
- Brightness: in a 0.75–2.45 µm window, V brighter than about 12 means saturated SPHEREx points
  (Psyche, V 11.4–11.8: 93% saturated), and V fainter than about 17.5 means a per-point S/N of a few.
  `search` lists the predicted V of every exposure (`most_vmag`).

## Stages and commands

| # | Stage | Command | Module |
|---|-------|---------|--------|
| 1 | Find SPHEREx exposures of an asteroid | `search` | `src/acquisition/spherex_search.py` |
| 2 | 0.75–5.0 µm forced PSF photometry | `extract` | `src/extraction/spectral_extraction.py` |
| 3 | Reflected / thermal separation (NEATM) | `separate` | `src/preprocessing/thermal_separation.py` |
| 4 | Type and mineral candidates (spectral likelihood + population, orbit and albedo prior) | `classify` | `src/classification/`, `src/integration/population_context.py` |
| 5 | Diameter (posterior from all points, η prior), H, albedo; combined and statistical diameters, thermal upper limit | `separate`, `h-estimate`, `albedo` | `src/physical/` (`diameter_posterior.py`, `eta_prior.py`, `statistical_diameter.py`) |
| 6 | Mass and density | `mass-density` | `src/physical/mass.py`, `density.py` |
| 7 | Integration, report, dashboard | `analyze`, `dashboard` | `src/integration/`, `src/visualization/` |
| – | Relative spectral calibration from solar-analog stars | `solar-analog-calibration` | `src/preprocessing/solar_analog_calibration.py`, `src/acquisition/fixed_source_search.py` |
| – | Validation against known bodies | `validate` | `src/validation/validation.py` |
| – | Taxonomy validation (C1–C9, e.g. 433 Eros) | `validate-taxonomy --target 433` | `src/validation/taxonomy_validation.py` |
| – | Classifier calibration: real asteroid spectra (MIT SMASS SpeX) sampled like SPHEREx observations | `classifier-calibration --targets 433 246 …` | `src/validation/injection_recovery.py` |
| – | Analyse and validate several asteroids with identical settings | `validate-batch --targets 221 387 308 --start 2025-04-12 --end 2026-10-15` (or `--from-saved`: saved spectra, no new search) | `main.py`, `config/validation_targets.yaml` |
| – | Population priors: fetch the SBDB catalogue, train, compare models by cross-validation | `population-priors [--refresh] [--compare]` | `src/acquisition/population_catalogue.py`, `src/physical/population_priors.py`, `src/validation/population_prior_validation.py` |
| – | Beaming-parameter prior: fetch the NEOWISE fits (IRSA TAP) and show the η prior by population, size and phase | `eta-prior [--refresh]` | `src/acquisition/neowise_catalogue.py`, `src/physical/eta_prior.py` |
| – | Follow-up requirements (any facility) | `followup` | `src/orbital/followup_planning.py` |

Documentation: [docs/INSTALL.md](docs/INSTALL.md), [docs/DATA_ACCESS.md](docs/DATA_ACCESS.md),
[docs/METHODS.md](docs/METHODS.md) (science, assumptions, limitations), and
[docs/STAGE_STATUS.md](docs/STAGE_STATUS.md) (what is verified against real data).
