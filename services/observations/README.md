# Observation service

Run through the project gateway. For an isolated local check:

```powershell
python services/observations/server.py --host 127.0.0.1 --port 8000
```

Install `requirements.txt` into the project's Python environment. The health endpoint starts without scientific dependencies and reports `available: false` and the missing modules. Prepared frontend targets remain usable without this worker.

- `POST /api/observations/patch` takes `{ra, dec, fov, retry?}`. Coordinates are degrees, ICRS; field width is 0.025–0.5 degrees. `GET` with the same parameters polls, and retains initial-request compatibility.
- `GET /api/observations/resolve?name=...` returns catalogue ICRS/J2000 coordinates with proper-motion metadata. It never silently advances them to today's date.
- `DELETE /api/observations/jobs/<id>` cancels a queued job, or requests cooperative cancellation at the next pipeline progress boundary.
- Job results distinguish `done`, `no_data`, `fetch_failed`, `failed`, and `cancelled`. A failed job requires an explicit retry in the current process.
- Generated artifacts are under `var/observations/patches`. Successful refreshes publish metadata atomically after all new-generation frames exist. Existing frame URLs are immutable.
- Success caches expire after 24 hours, empty searches after 15 minutes, and disk-only failed records after one minute. Inactive result/cache directories older than seven days are pruned during requests; active jobs are retained. A single worker and eight waiting slots bound upstream concurrency; at most 128 in-memory job records are retained.

Environment variables: `SPHEREX_PROJECT_ROOT`, `SPHEREX_DATA_DIR`, `SPHEREX_RUNTIME_DIR`, `SPHEREX_OBSERVATIONS_PORT`, and optional comma-separated `SPHEREX_ALLOWED_ORIGINS`. The worker is a loopback-only backend, not a public authenticated service. The gateway must send a loopback Host header.

The native-pixel photometry rejects defective source pixels, masks defective background pixels, validates input variances, and distinguishes relative ring brightness from absolute flux. Broad-band visit differences remain exploratory images: they do not establish motion or detection significance without matching wavelength, PSF and uncertainty treatment.

Offline checks: `python -m unittest discover -s services/observations -p "test_*.py"`. The TAP timeout check additionally needs the scientific requirements; it uses a local HTTP fixture, not a NASA endpoint.
