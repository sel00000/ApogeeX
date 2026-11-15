# Data sources (checked 2026-11-14)

| Service | Endpoint | Used for | Verified |
|---|---|---|---|
| IRSA TAP | `https://irsa.ipac.caltech.edu/TAP/sync`, table `spherex.obscore` | SPHEREx image metadata (collection `spherex_dr1`) | yes. Queries take ~80 s each, so they are not used for track searches |
| IRSA MOST | `https://irsa.ipac.caltech.edu/cgi-bin/MOST/nph-most`, `catalog=spherex` | Exposures intersecting an asteroid path | yes. POST with `input_type=naifid_input&obj_naifid=<SPK-ID>`. Name input is ambiguous for some names |
| IRSA IBE | `https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/...fits?center=ra,dec&size=Npix` | L2 cutouts with IMAGE, FLAGS, VARIANCE, ZODI, PSF, WCS-WAVE | yes |
| JPL SBDB | `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=..&phys-par=1` | Orbit solution, H, G, diameter, albedo, GM, density, extent | yes |
| JPL Horizons | `https://ssd.jpl.nasa.gov/api/horizons.api`, `CENTER='500@-163182'` | Ephemeris seen from SPHEREx (spacecraft ID -163182): RA/Dec, rates, r, Δ, α | yes |
| JPL SBDB Query API | `https://ssd-api.jpl.nasa.gov/sbdb_query.api` (`sb-cdata={"AND":["diameter\|DF"]}` and `{"OR":["spec_B\|DF","spec_T\|DF"]}`) | Population catalogue for the priors: ~140 000 catalogue diameters and ~2 200 classified asteroids (orbit, H, D, pV, SMASSII/Tholen class) | yes. About 8 s per table on 2026-11-15; cached with provenance in `data/raw/sbdb_physical/` (not committed) |
| JPL SB-Ident | `https://ssd-api.jpl.nasa.gov/sb_ident.api` | Known objects near an unmatched detection | implemented, geocentric only |
| MPC | `https://data.minorplanetcenter.net/api/get-obs` (JSON, OBS80) | Archival photometry for H estimation | yes |
| IRSA TAP | `https://irsa.ipac.caltech.edu/TAP/sync`, `CONTAINS(POINT(ra, dec), s_region)` on `spherex.obscore` | SPHEREx images containing a fixed position (solar-analog stars) | yes. 50–130 s per query on 2026-11-14 |
| IRSA DataLink | ObsCore `access_url` (`https://irsa.ipac.caltech.edu/datalink/links/spherex?ID=...`), row with semantics `#this` | Science-file URL of each SPHEREx image found by position | yes. About 0.5 s per request, run 5 at a time. A `spherex.plane`/`spherex.artifact` join gives the same paths but took over a minute per query |
| Gaia DR3 | IRSA TAP table `gaia_dr3_source` | Solar-analog astrometry (J2016.0 position, proper motion), photometry and neighbours | yes. Used instead of SIMBAD, whose TAP and identifier services answered "currently unavailable" (HTTP 404) on 2026-11-14 |
| Bus-DeMeo means | `http://smass.mit.edu/_documents/busdemeo-meanspectra.xlsx` | Taxonomy reference (DeMeo et al. 2009) | downloaded to `data/reference/busdemeo/` with a SHA-256 checksum and a provenance record |

## SPHEREx L2 product structure (DR1, processing `l2b-v27`)
- `IMAGE`: surface brightness in MJy/sr, with a TAN-SIP WCS
- `FLAGS`: bitmask. Plane names come from the `MSKNnnnn`/`MSKMnnnn` header keywords and are read at
  run time, not hard-coded
- `VARIANCE`: in (MJy/sr)²
- `ZODI`: zodiacal-light model. It is **not** assumed to be subtracted from `IMAGE`
- `PSF`: oversampled (5×5) effective PSFs per detector zone, with CWAVE/CBAND per zone
- `WCS-WAVE`: -TAB lookup table for the per-pixel wavelength and bandwidth. The header calls these
  "Approximated" values
- Header items used: `MJD-BEG/AVG/END`, `DETECTOR` (1–6 = bands B1–B6), `OMEGA_MEDIAN` (pixel solid
  angle) and the spacecraft position.

## Moving-object search strategy
1. SBDB resolves the object and gives its SPK-ID.
2. MOST returns the exposures intersecting the path, with its own geometry.
3. Horizons recomputes the position at each exposure mid-time with SPHEREx as the observer. This
   removes the Earth-orbit parallax, which reaches about 10″ at Δ = 1 au.
4. A point-in-footprint test checks each refined position against the detector polygon.

## Fixed-source (calibration star) search
1. Gaia DR3 gives the position at J2016.0 and the proper motion (by `source_id`, from
   `config/solar_analogs.yaml`).
2. An ObsCore position query lists the L2 images whose footprint contains the star.
3. DataLink gives each image's science-file URL. The IBE cutout service is then used exactly as for
   asteroids, with cutouts cached in `data/raw/spherex_cutouts_solar_analogs/` (about 4 MB each,
   mostly the PSF table; the folder can be deleted once `data/calibration/` has been built).
4. The position is propagated to each exposure with the proper motion and checked against the
   footprint polygon.
