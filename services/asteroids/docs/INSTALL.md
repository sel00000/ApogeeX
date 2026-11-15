# Installation and running

## Requirements
- Python 3.11 or later (tested with the interpreter available in the development environment)
- Internet access to `irsa.ipac.caltech.edu`, `ssd.jpl.nasa.gov`, `ssd-api.jpl.nasa.gov` and
  `data.minorplanetcenter.net`
- About 4 MB of disk per SPHEREx cutout, since cutouts are cached in `data/raw/spherex_cutouts/`

## Setup (Linux / WSL)
```bash
sudo apt install python3-venv python3-pip      # if venv/pip are missing
cd spherex-asteroid-analysis
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Tests
```bash
pytest                    # offline: physics, extraction on synthetic FITS, taxonomy, H fit, DB, i18n
pytest --run-network      # also: SBDB, Horizons (SPHEREx-centred), MOST, real cutout extraction
```

## Authentication
The services used (IRSA TAP/MOST/IBE, JPL SBDB/Horizons/SB-Ident, MPC observations API) need no
authentication for public data. If proprietary SPHEREx data becomes relevant, IRSA login
cookies would be needed. This is not implemented.

## Configuration
- `config/settings.yaml`: every analysis assumption (emissivity, eta prior, flag masks, thresholds).
- `config/data_sources.yaml`: service endpoints and the SPHEREx collections to search.
- `config/band_corrections.yaml`: band-to-V offsets. They are disabled by default. Enable them only
  after checking the cited source, by setting both `verified_by_user: true` and
  `photometry.allow_band_corrections: true`.
- Official SPHEREx spectral calibration (CWAVE/CBAND): download the calibration files for the data
  release you use and set `extraction.official_spectral_calibration_dir`. Without them, wavelengths
  come from the per-image WCS-WAVE lookup and are labelled `APPROX_LOOKUP`.
