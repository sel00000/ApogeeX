"""End-to-end pipeline for one known asteroid. Every stage can also be run on its own
(see main.py). A stage whose inputs are missing is skipped and recorded; no value is
substituted."""
from __future__ import annotations

import json
import hashlib
import shutil
from contextlib import ExitStack, contextmanager
from tempfile import TemporaryDirectory
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..acquisition.optical_data_client import CSVPhotometryProvider, MPCObservationsProvider, collect_photometry
from ..acquisition.spherex_search import save_search_result, search_known_asteroid
from ..classification.mineral_identification import analyse_minerals
from ..classification.taxonomy import classify
from ..common import status
from ..common.config import resolve, settings
from ..extraction.spectral_extraction import extract_spectrum, save_spectrum
from ..i18n import t
from ..orbital.ephemeris import geometry_for_epochs
from ..physical.absolute_magnitude import estimate_h, h_from_sbdb
from ..physical.albedo import albedo_from_thermal_fit
from ..physical.density import compute_density, parse_extent
from ..physical.mass import mass_from_sbdb
from ..physical.phase_function import PhaseLaw
from ..preprocessing.spectrum_cleaning import reject_outliers, select_usable
from ..preprocessing.thermal_separation import ThermalSeparator, reflectance_spectrum
from .asteroid_database import AsteroidDatabase
from .spectrum_analysis import analyse_spectrum
from .report_generator import build_report, save_report
from .result_merger import merge


@dataclass
class PipelineOutput:
    target: str
    record: dict
    files: dict = field(default_factory=dict)
    log: list = field(default_factory=list)
    error: str | None = None          # set when the run stopped before writing anything (bad input, no data)


def check_window(start, end) -> str | None:
    """None if start/end are valid dates with start < end, else the reason (shown to the user)."""
    try:
        t0, t1 = pd.Timestamp(str(start)), pd.Timestamp(str(end))
    except (ValueError, TypeError):
        return f"Invalid date: '{start}' or '{end}' (use YYYY-MM-DD)."
    if pd.isna(t0) or pd.isna(t1):
        return f"Invalid date: '{start}' or '{end}' (use YYYY-MM-DD)."
    if t1 <= t0:
        return f"The end date ({end}) must be after the start date ({start})."
    return None


def _safe(name):
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name)


# These names belong to one complete analysis. A skipped stage must not inherit
# one of them from the previous run. Everything else in the target directory is
# user-owned and is carried forward unchanged.
_GENERATED_FILES = {
    "stage1_observations.csv", "stage2_spectrum.csv", "stage2_spectrum.fits",
    "stage3_components_reflectance.csv", "stage3_temporal_analysis.json",
    "report.md", "integrated_record.json", "web_run.json", "spectrum.png", "separation.png",
    "residuals.png", "sky_track.png", "reference_comparison.png",
}


@contextmanager
def _publish_run(staged: Path, destination: Path):
    """Swap complete output directories, restoring the last run if DB save fails."""
    destination = destination.absolute()
    parent = destination.parent.resolve()
    if destination.is_symlink() or destination.resolve().parent != parent:
        raise ValueError("The analysis output must be a direct directory, not a link.")
    backup = staged.parent / "previous"
    if destination.exists():
        for item in destination.iterdir():
            if item.name in _GENERATED_FILES:
                continue
            target = staged / item.name
            if item.is_dir() and not item.is_symlink():
                shutil.copytree(item, target, symlinks=True)
            else:
                shutil.copy2(item, target, follow_symlinks=False)
        destination.rename(backup)
    try:
        staged.rename(destination)
    except BaseException:
        if backup.exists():
            backup.rename(destination)
        raise
    try:
        yield
    except BaseException:
        destination.rename(staged)
        if backup.exists():
            backup.rename(destination)
        raise


def resolve_absolute_magnitude(sbdb, designation, photometry_csv=None, use_mpc=True, log=print):
    """SBDB H first; if absent, collect photometry from any available providers and estimate H."""
    h = h_from_sbdb(sbdb)
    if h.reliable:
        return h
    providers = []
    if use_mpc:
        providers.append(MPCObservationsProvider())
    if photometry_csv:
        providers.append(CSVPhotometryProvider(photometry_csv))
    if not providers:
        return h
    phot, sources, errors = collect_photometry(designation, providers)
    for e in errors:
        log(t("cli.step_failed", step="photometry", reason=e))
    if phot.empty:
        h.followup_requirements = h.followup_requirements or [
            "No optical photometry found in the queried sources."]
        return h
    geom, gsrc = geometry_for_epochs(designation, phot["mjd"].values, spkid=getattr(sbdb, "spkid", None),
                                     observatory_codes=phot["observatory_code"].values)
    G0 = sbdb.value("G") if sbdb is not None and sbdb.found else None
    est = estimate_h(phot, geom, G_default=G0)
    est.photometry_sources = [s.name for s in sources]
    return est


def _saved_search(target: str, out: Path, log=print):
    """Stage-1 result rebuilt from the saved table (no IRSA query): SBDB is looked up again for the
    object's parameters; the observation list is the one saved by the original search."""
    from ..acquisition.jpl_client import SBDBClient
    from ..acquisition.spherex_search import SearchResult
    from ..common.provenance import Provenance
    obs_p = out / "stage1_observations.csv"
    obs = pd.read_csv(obs_p) if obs_p.exists() else pd.DataFrame()
    if "inside_footprint" in obs:
        obs["inside_footprint"] = obs["inside_footprint"].astype(str).str.lower().isin(["true", "1"])
    sbdb = SBDBClient().lookup(target)
    prov = Provenance(step="spherex_search", model_version=settings()["project"]["model_version"],
                      inputs={"designation": target, "from_saved": str(obs_p)})
    previous = out / "integrated_record.json"
    if previous.is_file():
        try:
            prior = json.loads(previous.read_text(encoding="utf-8"))
            prov.inputs["prior_analysis_timestamp"] = prior.get("analysis_timestamp")
            for source in prior.get("input_data_sources", []):
                if isinstance(source, dict):
                    prov.add_source(source)
        except (OSError, ValueError):
            prov.warn("Previous provenance record could not be read; saved CSV hashes identify the reused inputs.")
    prov.inputs["saved_files_sha256"] = {
        filename: hashlib.sha256((out / filename).read_bytes()).hexdigest()
        for filename in ("stage1_observations.csv", "stage2_spectrum.csv") if (out / filename).is_file()
    }
    if sbdb.source:
        prov.add_source(sbdb.source)
    msg = f"Search not repeated: saved stage-1 table {obs_p.name} used ({len(obs)} exposures)."
    return SearchResult(target, sbdb, obs, prov, [msg])


def run_analysis(target: str, start: str | None, end: str | None, max_images: int | None = None,
                 photometry_csv: str | None = None, use_mpc_photometry: bool = True,
                 out_dir: str | None = None, db_path: str | None = None, log=print,
                 from_saved: bool = False) -> PipelineOutput:
    """Publish a complete run only after all required products and DB rows succeed.

    A failed/no-data run leaves an earlier successful result intact. Reanalysis
    reads its saved inputs from the previous result, never from an incomplete run.
    """
    base = resolve(out_dir or settings()["project"]["output_dir"])
    if not _safe(target):
        return PipelineOutput(target=target, record={}, error="The analysis target is empty.")
    with ExitStack() as workspaces:
        def prepare_output(canonical_target):
            # Do not create an output root until input/identity/search validation
            # has found observations. Keep staging on the publication volume so
            # a complete result can still be swapped atomically.
            base.mkdir(parents=True, exist_ok=True)
            work = workspaces.enter_context(TemporaryDirectory(prefix=".analysis-run-", dir=base))
            return Path(work) / _safe(canonical_target)

        return _run_analysis(target, start, end, max_images, photometry_csv,
                             use_mpc_photometry, db_path, log, from_saved,
                             publish_root=base, prepare_output=prepare_output)


def _run_analysis(target: str, start: str | None, end: str | None, max_images: int | None = None,
                 photometry_csv: str | None = None, use_mpc_photometry: bool = True,
                 db_path: str | None = None, log=print,
                 from_saved: bool = False, *, publish_root: Path, prepare_output) -> PipelineOutput:
    """from_saved: re-analyse the photometry saved in the output folder (stage1/stage2 CSV) without
    searching or extracting again - e.g. after a change of the classifier or of the figure colours.
    The record, report, database entries and figures are rewritten."""
    cfg = settings()
    po = PipelineOutput(target=target, record={})

    def L(msg):
        po.log.append(msg)
        log(msg)

    def stop(reason):
        # nothing is written: a bad input or an empty search must not leave a record behind
        po.error = reason
        L(reason)
        return po

    # Stage 1
    if from_saved:
        saved = publish_root / _safe(target)
        search = _saved_search(target, saved, log=L)
        if search.observations.empty:
            return stop(f"No saved SPHEREx observations of {target} are available for reanalysis.")
    else:
        bad = check_window(start, end)
        if bad:
            return stop(bad)
        # Resolve the name first: an unknown name must not create a record, and the names of one object
        # ("Eros", "433 Eros", "433") share one record under its SBDB primary designation.
        from ..acquisition.jpl_client import SBDBClient
        from ..common.http import DataAccessError
        try:
            ident = SBDBClient().lookup(target)
        except DataAccessError as err:
            return stop(f"JPL SBDB could not be reached ({err}); nothing was analysed. Try again later.")
        if not ident.found:
            return stop(f"'{target}' was not found in JPL SBDB ({ident.message or 'no match'}). Check the "
                        "spelling, or use the number or provisional designation (e.g. 433, 2000 PG3).")
        if ident.designation and ident.designation != target:
            L(f"'{target}' is {ident.fullname}; results are stored under {ident.designation}.")
            target = ident.designation
            po.target = target
        L(t("cli.searching", target=target, start=start, end=end))
        try:
            search = search_known_asteroid(target, start, end)
        except DataAccessError as err:
            msg = str(err)
            if "no result table" in msg:
                return stop(f"No SPHEREx exposures of {ident.fullname or target} between {start} and {end} "
                            "(IRSA MOST returned none; SPHEREx DR1 starts on 2025-04-12).")
            return stop(f"IRSA could not be reached ({msg[:200]}); nothing was analysed. Try again later.")
        if search.observations.empty:
            return stop(f"No SPHEREx exposures of {ident.fullname or target} between {start} and {end}.")
    out = prepare_output(target)
    out.mkdir(parents=True, exist_ok=True)
    if from_saved:
        for filename in ("stage1_observations.csv", "stage2_spectrum.csv", "stage2_spectrum.fits"):
            original = saved / filename
            if original.is_file():
                shutil.copy2(original, out / filename)
        po.files["observations"] = str(out / "stage1_observations.csv")
        if (out / "stage2_spectrum.csv").is_file():
            po.files["spectrum"] = str(out / "stage2_spectrum.csv")
    for m in search.messages:
        L(m)
    sbdb = search.sbdb
    obs = search.observations
    if not obs.empty and not from_saved:
        L(t("cli.found_exposures", n=len(obs), n_inside=int(obs["inside_footprint"].sum())))
        save_search_result(search, out / "stage1_observations.csv")
        po.files["observations"] = str(out / "stage1_observations.csv")
    elif obs.empty:
        L(t("cli.no_exposures", target=target))

    # Stage 2
    spectrum = pd.DataFrame()
    if from_saved:
        sp_p = out / "stage2_spectrum.csv"
        spectrum = pd.read_csv(sp_p) if sp_p.exists() else pd.DataFrame()
        L(f"Extraction not repeated: saved {sp_p.name} used ({len(spectrum)} points).")
    elif not obs.empty:
        use = obs[obs["inside_footprint"]]
        L(t("cli.extracting", n=len(use) if max_images is None else min(len(use), max_images)))
        spectrum, prov2 = extract_spectrum(use, max_images=max_images)
        for w in prov2.warnings[:20]:
            L("  " + w)
        if not spectrum.empty:
            qc = spectrum["quality_flag"].value_counts()
            L(t("cli.extracted", n=len(spectrum), n_good=int(qc.get("GOOD", 0)), n_warn=int(qc.get("WARN", 0)),
                n_bad=int(qc.get("BAD", 0))))
            save_spectrum(spectrum, out / "stage2_spectrum.csv")
            po.files["spectrum"] = str(out / "stage2_spectrum.csv")

    # Stage 5 prerequisite: H
    h_res = resolve_absolute_magnitude(sbdb, target, photometry_csv, use_mpc_photometry, log=L)

    # Stages 3-5: observation-time analysis, data-supported brightness correction, thermal fit,
    # reflectance, bands, classification (shared chain, see spectrum_analysis.py)
    rot_p = sbdb.value("rot_per") if sbdb is not None and sbdb.found else None
    if rot_p is None:
        L("Rotation period unknown: no periodic lightcurve correction can be considered.")
    thermal = taxonomy = minerals = albedo = dres = temporal = calibration = stat_d = post_d = None
    refl = pd.DataFrame()
    if not spectrum.empty:
        L(t("cli.thermal_fit"))
        from .population_context import target_prior
        prior = target_prior(sbdb, h_res, log=L)
        ana = analyse_spectrum(spectrum, h_result=h_res, sbdb=sbdb, rotation_period_h=rot_p, log=L, prior=prior)
        temporal, thermal, dres, albedo = ana.temporal, ana.thermal, ana.diameter, ana.albedo
        stat_d = ana.statistical_diameter
        post_d = ana.diameter_posterior
        taxonomy, minerals = ana.taxonomy, ana.minerals
        calibration = ana.calibration
        sep = ana.separator
        if ana.reflectance is not None:
            refl = ana.reflectance
            refl.to_csv(out / "stage3_components_reflectance.csv", index=False)
            po.files["components"] = str(out / "stage3_components_reflectance.csv")
        if temporal is not None:
            (out / "stage3_temporal_analysis.json").write_text(json.dumps(temporal.summary(), indent=2, default=str))
            po.files["temporal"] = str(out / "stage3_temporal_analysis.json")

    # Stage 6
    mass = mass_from_sbdb(sbdb)
    density = None
    if mass.mass_kg is not None:
        ext = sbdb.param("extent") if sbdb is not None and sbdb.found else None
        ax = parse_extent(ext.raw_value, str(ext.sigma) if ext and ext.sigma is not None else None) if ext else None
        # Volume priority: SPHEREx thermal diameter > SBDB volume-equivalent diameter > extent ellipsoid.
        # Extents are maximum dimensions; for irregular bodies (Eros, Ryugu) their ellipsoid volume is
        # off by 10-20% (see validation), so they are used only as a last resort.
        if dres is not None and dres.diameter_km:
            density = compute_density(mass, dres.diameter_km, dres.diameter_total_err_km,
                                      diameter_source="SPHEREx NEATM diameter")
            if dres.confidence == "Low":
                density.status = "ON_HOLD_VALIDATION"
                density.notes = (density.notes + "; " if density.notes else "") + \
                    "based on a Low-confidence SPHEREx diameter"
            # rho ~ D^-3: a 15-20% diameter error is a 50-70% density error (433 Eros, 2026-11-15: 910 +- 600 kg/m^3
            # from a Medium-confidence thermal diameter of an elongated body; NEAR: 2670)
            max_rel = float(cfg.get("physical", {}).get("max_density_relative_uncertainty", 0.5))
            if density.density_kg_m3 and density.density_err_kg_m3 and \
                    density.density_err_kg_m3 / density.density_kg_m3 > max_rel:
                density.status = "ON_HOLD_VALIDATION"
                density.notes = (density.notes + "; " if density.notes else "") + \
                    f"relative uncertainty {density.density_err_kg_m3 / density.density_kg_m3:.2f} > {max_rel}"
        elif sbdb.param("diameter") is not None and sbdb.param("diameter").value:
            p = sbdb.param("diameter")
            density = compute_density(mass, p.value, p.sigma, diameter_source=f"SBDB diameter ({p.reference})")
        elif ax:
            density = compute_density(mass, extent_axes_km=ax[0], extent_err_km=ax[1],
                                      diameter_source=f"SBDB extent ({ext.reference})")
            density.notes = (density.notes + "; " if density.notes else "") + \
                "extent-based ellipsoid: biased for irregular shapes"
    else:
        density = compute_density(mass)

    # Validation reference for a thermal diameter when SBDB gives a shape (extent) and, ideally, a spin pole: the
    # effective diameter of that shape at the SPHEREx geometry (src/validation/shape_reference.py). It is stored next
    # to the catalogue diameter and never changes the SPHEREx diameter.
    sref = None
    scfg = (cfg.get("validation", {}) or {}).get("shape_reference", {}) or {}
    if scfg.get("enabled", True) and dres is not None and dres.diameter_km and not spectrum.empty:
        from ..validation.shape_reference import shape_reference
        cat = sbdb.param("diameter") if sbdb is not None and sbdb.found else None
        eta0 = post_d.eta_prior_centre(cat.value) if post_d is not None and cat is not None and cat.value else None
        tcfg = cfg["thermal_model"]
        sref = shape_reference(sbdb, spectrum, eta=eta0, G=getattr(h_res, "G", None), H=getattr(h_res, "H", None),
                               phase=PhaseLaw.from_h_result(h_res, tcfg["default_G"]),
                               thermal_min_um=tcfg["thermal_region_min_um"], emissivity=tcfg["emissivity"], cfg=scfg)
        if sref.applicable:
            L(f"  [validation] catalogue shape at the SPHEREx geometry: effective diameter {sref.D_eff_km:.4g} km "
              f"(f = {sref.factor:.2f} x volume-equivalent {sref.D_vol_km:.4g} km, {sref.status})")

    # Stage 7
    rec = merge(target, sbdb=sbdb, search=search, spectrum=spectrum, taxonomy=taxonomy, minerals=minerals,
                thermal=thermal, h_result=h_res, diameter=dres, albedo=albedo, mass=mass, density=density,
                calibration=calibration, statistical_diameter=stat_d, diameter_posterior=post_d,
                shape_reference=sref)
    provenance = {"search": search.provenance.to_dict()}
    if thermal is not None and thermal.provenance:
        provenance["thermal_separation"] = thermal.provenance
    if h_res is not None and h_res.provenance:
        provenance["absolute_magnitude"] = h_res.provenance
    if albedo is not None and albedo.provenance:
        provenance["albedo"] = albedo.provenance
    if calibration is not None:
        provenance["solar_analog_calibration"] = calibration
    if temporal is not None:
        provenance["temporal_analysis"] = temporal.summary()
    report = build_report(target, rec, taxonomy=taxonomy, minerals=minerals, thermal=thermal, h_result=h_res,
                          diameter=dres, albedo=albedo, mass=mass, density=density, n_exposures=len(obs),
                          temporal=temporal, calibration=calibration, statistical_diameter=stat_d,
                          diameter_posterior=post_d)
    po.files["report"] = str(save_report(report, out / "report.md"))
    (out / "integrated_record.json").write_text(json.dumps(rec, indent=2, default=str))
    po.files["record"] = str(out / "integrated_record.json")

    try:
        from ..visualization import orbit_plot, spectrum_plot
        if not spectrum.empty:
            po.files["plot_spectrum"] = spectrum_plot.save(spectrum_plot.plot_spectrum(spectrum, target),
                                                           out / "spectrum.png")
        if thermal is not None and thermal.points is not None:
            po.files["plot_separation"] = spectrum_plot.save(spectrum_plot.plot_separation(thermal.points, target),
                                                             out / "separation.png")
            po.files["plot_residuals"] = spectrum_plot.save(spectrum_plot.plot_residuals(thermal.points, target),
                                                            out / "residuals.png")
        if taxonomy is not None and taxonomy.candidates:
            po.files["plot_reference"] = spectrum_plot.save(
                spectrum_plot.plot_reference_comparison(refl, taxonomy, target), out / "reference_comparison.png")
        if not obs.empty:
            po.files["plot_sky"] = spectrum_plot.save(orbit_plot.plot_sky_track(obs, spectrum, target),
                                                      out / "sky_track.png")
    except Exception as err:  # plotting must never hide results
        L(t("cli.step_failed", step="plots", reason=err))

    publish_dir = publish_root / _safe(target)
    db = AsteroidDatabase(db_path or cfg["project"]["database_path"], origin=status.ORIGIN_OBSERVED)
    try:
        # Acquire the SQLite write transaction before swapping files, so two CLI
        # runs sharing the database cannot interleave their publication. Keep the
        # filesystem rollback context alive until the database commit succeeds.
        with ExitStack() as publication:
            with db.replacing_analysis(rec, obs, refl if not refl.empty else spectrum, provenance):
                publication.enter_context(_publish_run(out, publish_dir))
    finally:
        db.close()
    po.files = {key: str(publish_dir / Path(path).name) for key, path in po.files.items()}
    po.record = rec
    L(t("cli.done", target=target, status=rec["quality_status"]))
    return po
