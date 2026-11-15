"""Command-line interface. Each stage can be run independently.

  python main.py search    --target 4 --start 2025-05-01 --end 2025-09-30
  python main.py extract   --observations ../../var/outputs/asteroids/4/stage1_observations.csv --max-images 40
  python main.py separate  --spectrum ../../var/outputs/asteroids/4/stage2_spectrum.csv [--H 3.25 --H-err 0.1 --G 0.32]
  python main.py classify  --reflectance ../../var/outputs/asteroids/4/stage3_components_reflectance.csv
  python main.py h-estimate --target 2000PG3 [--photometry my_phot.csv] [--no-mpc]
  python main.py albedo    --D 520 --D-err 10 --H 3.25 --H-err 0.05
  python main.py mass-density --target 4
  python main.py analyze   --target 4 --start 2025-05-01 --end 2025-09-30 --max-images 60
  python main.py validate
  python main.py solar-analog-calibration --start 2025-04-01 --end 2026-11-01 [--max-images-per-star 220]
  python main.py classifier-calibration --targets 433 246 624 10 16 221 387 308 2045 69
  python main.py eta-prior [--refresh]
  python main.py followup  --target 2000PG3 --days 120
  python main.py dashboard
"""
from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

from src.common.config import resolve, settings
from src.i18n import t


def _out(target):
    from src.integration.pipeline import _safe
    p = resolve(settings()["project"]["output_dir"]) / _safe(target)
    p.mkdir(parents=True, exist_ok=True)
    return p


def cmd_search(a):
    from src.acquisition.spherex_search import save_search_result, search_known_asteroid
    print(t("cli.searching", target=a.target, start=a.start, end=a.end))
    res = search_known_asteroid(a.target, a.start, a.end)
    for m in res.messages:
        print(m)
    if res.observations.empty:
        print(t("cli.no_exposures", target=a.target))
        return
    print(t("cli.found_exposures", n=len(res.observations), n_inside=int(res.observations["inside_footprint"].sum())))
    p = _out(a.target) / "stage1_observations.csv"
    save_search_result(res, p)
    print(t("cli.saved", path=p))
    if a.db:
        from src.integration.asteroid_database import AsteroidDatabase
        db = AsteroidDatabase(settings()["project"]["database_path"])
        db.write_observations(a.target, res.observations)
        db.write_provenance(a.target, "search", res.provenance.to_dict())


def cmd_extract(a):
    from src.extraction.spectral_extraction import extract_spectrum, save_spectrum
    obs = pd.read_csv(a.observations)
    if "inside_footprint" in obs:
        obs = obs[obs["inside_footprint"].astype(str).str.lower() == "true"]
    print(t("cli.extracting", n=len(obs) if a.max_images is None else min(a.max_images, len(obs))))
    df, prov = extract_spectrum(obs, max_images=a.max_images,
                                progress=lambda k, n: print(f"  {k + 1}/{n}", end="\r"))
    for w in prov.warnings[:20]:
        print("  " + w)
    if df.empty:
        print(t("common.no_results"))
        return
    qc = df["quality_flag"].value_counts()
    print(t("cli.extracted", n=len(df), n_good=int(qc.get("GOOD", 0)), n_warn=int(qc.get("WARN", 0)),
            n_bad=int(qc.get("BAD", 0))))
    out = Path(a.observations).with_name("stage2_spectrum.csv")
    save_spectrum(df, out)
    save_spectrum(df, out.with_suffix(".fits"), fmt="fits")
    print(t("cli.saved", path=out))


def cmd_separate(a):
    from src.preprocessing.spectrum_cleaning import reject_outliers, select_usable
    from src.preprocessing.thermal_separation import ThermalSeparator, reflectance_spectrum
    from src.visualization import spectrum_plot
    spec = pd.read_csv(a.spectrum)
    spec = select_usable(spec)
    spec = reject_outliers(spec, "flux_uJy", "flux_err_uJy")
    spec = spec[~spec["outlier"]]
    if not a.no_calibration:
        from src.integration.spectrum_analysis import resolve_calibration
        from src.preprocessing.solar_analog_calibration import apply_correction
        corr = resolve_calibration("auto", spec)
        if corr is not None:
            spec, info = apply_correction(spec, corr)
            print(f"Solar-analog relative correction applied ({info['n_stars']} stars).")
        else:
            print("Solar-analog relative correction not applied (none stored, disabled, or non-OBSERVED data).")
    sep = ThermalSeparator(rotation_period_h=a.rot_period)
    print(t("cli.thermal_fit"))
    res = sep.fit(spec, H=a.H, H_err=a.H_err, G=a.G)
    summary = res.summary()
    print(json.dumps({k: v for k, v in summary.items() if k != "covariance"}, indent=1, default=str))
    if res.points is not None:
        refl = reflectance_spectrum(res.points, sep.solar, sep.G)
        out = Path(a.spectrum).with_name("stage3_components_reflectance.csv")
        refl.to_csv(out, index=False)
        print(t("cli.saved", path=out))
        spectrum_plot.save(spectrum_plot.plot_separation(res.points, a.label), out.with_name("separation.png"))
        spectrum_plot.save(spectrum_plot.plot_residuals(res.points, a.label), out.with_name("residuals.png"))


def cmd_classify(a):
    from src.classification.mineral_identification import analyse_minerals
    from src.classification.taxonomy import classify
    from src.classification.uncertainty import monte_carlo_stability
    refl = pd.read_csv(a.reflectance)
    tx = classify(refl)
    print(json.dumps({k: v for k, v in tx.__dict__.items() if k != "pca"}, indent=1, default=str))
    if a.mc and tx.candidates:
        print(json.dumps(monte_carlo_stability(refl, classify, n=a.mc), indent=1))
    mn = analyse_minerals(refl, albedo_pV=a.pV)
    print(json.dumps({"bands": [b.__dict__ for b in mn.bands], "candidates": mn.candidates,
                      "slope": mn.spectral_slope_per_um, "limitations": mn.limitations}, indent=1, default=str))


def cmd_h(a):
    from src.acquisition.jpl_client import SBDBClient
    from src.integration.pipeline import resolve_absolute_magnitude
    sbdb = SBDBClient().lookup(a.target)
    if not sbdb.found:
        print(t("cli.sbdb_not_found", target=a.target))
    if a.ignore_sbdb_h and sbdb.found:
        sbdb.phys.pop("H", None)
    h = resolve_absolute_magnitude(sbdb if sbdb.found else None, a.target, a.photometry, not a.no_mpc)
    print(json.dumps({k: v for k, v in h.__dict__.items() if k not in ("residuals", "provenance")}, indent=1,
                     default=str))


def cmd_albedo(a):
    from src.physical.albedo import compute_albedo
    r = compute_albedo(a.D, a.D_err, a.H, a.H_err, H_source=a.H_source, D_source=a.D_source,
                       H_err_provided=a.H_err is not None)
    print(json.dumps({k: v for k, v in r.__dict__.items() if k != "provenance"}, indent=1, default=str))


def cmd_mass_density(a):
    from src.acquisition.jpl_client import SBDBClient
    from src.physical.density import compute_density, parse_extent
    from src.physical.mass import mass_from_sbdb
    rec = SBDBClient().lookup(a.target)
    m = mass_from_sbdb(rec)
    print(json.dumps(m.__dict__, indent=1, default=str))
    D = a.D if a.D else (rec.value("diameter") if rec.found else None)
    De = a.D_err if a.D else (rec.param("diameter").sigma if rec.found and rec.param("diameter") else None)
    print(json.dumps(compute_density(m, D, De).__dict__, indent=1, default=str))
    ext = rec.param("extent") if rec.found else None
    if ext:
        ax = parse_extent(ext.raw_value, str(ext.sigma) if ext.sigma is not None else None)
        if ax:
            print(json.dumps(compute_density(m, extent_axes_km=ax[0], extent_err_km=ax[1]).__dict__, indent=1,
                             default=str))


def cmd_analyze(a):
    from src.integration.pipeline import run_analysis
    if not a.from_saved and not (a.start and a.end):
        raise SystemExit("--start and --end are required unless --from-saved is given")
    po = run_analysis(a.target, a.start, a.end, max_images=a.max_images, photometry_csv=a.photometry,
                      use_mpc_photometry=not a.no_mpc, out_dir=a.out_dir, db_path=a.db,
                      from_saved=a.from_saved)
    if po.error:
        raise SystemExit(po.error)
    for k, v in po.files.items():
        print(t("cli.saved", path=v))


def cmd_validate(a):
    from src.validation.validation import run_validation
    df = run_validation(a.objects)
    pd.set_option("display.width", 200)
    print(df[["object", "quantity", "reference_value", "system_value", "system_uncertainty", "relative_error",
              "n_sigma"]].to_string(index=False))
    out = resolve(settings()["project"]["output_dir"]) / "validation.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(t("cli.saved", path=out))


def cmd_validate_taxonomy(a):
    from src.validation.taxonomy_validation import run_taxonomy_validation
    rep = run_taxonomy_validation(a.target, a.start, a.end, a.max_images)
    for c in rep.criteria:
        print(f"{c.id:3s} {c.result:12s} {c.name}: {c.explanation}")
    print(rep.summary)


def cmd_validate_batch(a):
    """Analyse (pipeline + database + report) and validate several asteroids with identical settings."""
    import json as _json
    from src.integration.pipeline import run_analysis
    from src.validation.taxonomy_validation import run_taxonomy_validation, run_taxonomy_validation_saved
    if not a.from_saved and not (a.start and a.end):
        raise SystemExit("--start and --end are required unless --from-saved is given")
    summary = []
    for target in a.targets:
        print(f"===== {target} =====", flush=True)
        try:
            if a.from_saved:
                analysis = run_analysis(target, None, None, use_mpc_photometry=False, from_saved=True, log=lambda m: None)
                if analysis.error:
                    raise RuntimeError(analysis.error)
                rep = run_taxonomy_validation_saved(target, log=lambda m: None)
            else:
                analysis = run_analysis(target, a.start, a.end, max_images=a.max_images, use_mpc_photometry=False)
                if analysis.error:
                    raise RuntimeError(analysis.error)
                rep = run_taxonomy_validation(target, a.start, a.end, a.max_images)
            summary.append({"target": target, "reference": rep.reference, "results": {c.id: c.result for c in rep.criteria},
                            "explanations": {c.id: c.explanation for c in rep.criteria},
                            "analysis": rep.analysis_summary})
            for c in rep.criteria:
                print(f"  {c.id} {c.result:12s} {c.explanation}", flush=True)
        except Exception as err:  # keep going with the other targets
            summary.append({"target": target, "error": str(err)})
            print(f"  ERROR: {err}", flush=True)
    out = resolve(settings()["project"]["output_dir"]) / "validation"
    out.mkdir(parents=True, exist_ok=True)
    # Entries of targets not in this run are kept, so a subset can be re-run without losing the others.
    path = out / "batch_summary.json"
    old = []
    if path.exists():
        try:
            old = [e for e in _json.loads(path.read_text()) if e.get("target") not in set(a.targets)]
        except (ValueError, TypeError):
            old = []
    for e in summary:
        e["run"] = {"start": a.start, "end": a.end, "max_images": a.max_images, "from_saved": bool(a.from_saved)}
    path.write_text(_json.dumps(old + summary, indent=2, default=str))
    print(t("cli.saved", path=path))


def cmd_solar_analog_calibration(a):
    """Relative spectral calibration from SPHEREx photometry of the solar analogs in config/solar_analogs.yaml."""
    from src.preprocessing.solar_analog_calibration import build_correction, rebuild_correction_from_saved
    if a.from_saved:
        corr = rebuild_correction_from_saved(log=lambda m: print(m, flush=True))
    else:
        if not (a.start and a.end):
            raise SystemExit("--start and --end are required unless --from-saved is given")
        corr = build_correction(a.start, a.end, max_images_per_star=a.max_images_per_star, stars=a.stars,
                                log=lambda m: print(m, flush=True))
    for star, why in corr.summary.get("excluded_stars", {}).items():
        print(f"Excluded as a solar proxy: {star} - {why}")
    s = corr.summary
    print(f"{s['n_stars']} stars, {s['n_points_used']}/{s['n_points_total']} points used, "
          f"chi2_red {s['chi2_red']:.2f}, {s['n_bins_determined']}/{s['n_bins_total']} bins determined; "
          f"slope uncertainty (per um): {corr.slope_sigma_per_um}")
    print(t("cli.saved", path=corr.path))


def cmd_classifier_calibration(a):
    """Injection-recovery of real asteroid spectra sampled like the given SPHEREx observations
    (src/validation/injection_recovery.py). Needs outputs/<target>/stage2_spectrum.csv for each target."""
    from src.acquisition.jpl_client import SBDBClient
    from src.integration.pipeline import resolve_absolute_magnitude
    from src.integration.spectrum_analysis import analyse_spectrum
    from src.validation.injection_recovery import (calibrated_gaps, download_injection_set, run_injection,
                                                   sampling_from_analysis, save_calibration)
    download_injection_set(log=print)
    samplings = {}
    for target in a.targets:
        spec = pd.read_csv(_out(target) / "stage2_spectrum.csv")
        sb = SBDBClient().lookup(target)
        h = resolve_absolute_magnitude(sb, target, use_mpc=False, log=lambda m: None)
        ana = analyse_spectrum(spec, h_result=h, rotation_period_h=sb.value("rot_per"), log=lambda m: None)
        samplings[target] = sampling_from_analysis(ana)
        print(f"sampling {target}: {len(samplings[target]['refl'])} points", flush=True)
    results = {}
    for model in a.models:
        key = f"{model}_no_prior" if a.no_prior else model
        results[key] = run_injection(samplings, model, log=lambda m: print(m, flush=True),
                                     use_prior=False if a.no_prior else None)
        print(key, json.dumps(calibrated_gaps(results[key])), flush=True)
    print(t("cli.saved", path=save_calibration(results)))


def cmd_population_priors(a):
    """Population priors for the classifier and the statistical diameter (src/physical/population_priors.py)."""
    from src.acquisition.population_catalogue import fetch
    from src.integration.population_context import population_model
    if a.refresh:
        fetch("diameters", refresh=True)
        fetch("taxonomy", refresh=True)
    m = population_model()
    print(json.dumps({k: v for k, v in m.info.items()}, indent=1, default=str))
    if a.compare:
        from src.validation.population_prior_validation import compare_models
        print(t("cli.saved", path=compare_models(log=lambda x: print(x, flush=True))))


def cmd_eta_prior(a):
    """Beaming-parameter prior of the diameter posterior from NEOWISE fits (src/physical/eta_prior.py)."""
    import numpy as np
    from src.acquisition.neowise_catalogue import fetch
    from src.physical.eta_prior import eta_table, wavelength_factor
    if a.refresh:
        fetch("fits", refresh=True, log=lambda m: print(m, flush=True))
        fetch("orbits", refresh=True, log=lambda m: print(m, flush=True))
    tab = eta_table(log=lambda m: print(m, flush=True))
    if tab is None:
        raise SystemExit("NEOWISE eta catalogue unavailable (IRSA TAP table neowisesbpropv2).")
    print(f"{tab['n_fits']} NEOWISE fits with a free beaming parameter ({tab['n_removed']} rows of validation/injection "
          f"targets removed); catalogue retrieved {tab['catalogue_retrieved_utc']}")
    print(f"wavelength factor (3.5-5 um vs 12-22 um) at 20 deg: {wavelength_factor(20.0):.3f}")
    for pop, v in tab["populations"].items():
        print(f"{pop}: {v['n']} fits, phase slope {v['phase_slope_per_deg']:+.4f} ln(eta)/deg")
        for b in v["bins"]:
            print(f"   D {b['D_range_km'][0]:>6g}-{b['D_range_km'][1]:<6g} km: eta(20 deg) {np.exp(b['median_ln_eta']):.3f}, "
                  f"sigma ln eta {b['sigma_ln']:.3f} (n {b['n']})")


def cmd_followup(a):
    from src.orbital.followup_planning import plan_photometric_followup
    plan = plan_photometric_followup(a.target, days=a.days)
    plan.pop("table", None)
    print(json.dumps(plan, indent=1, default=str))


def cmd_dashboard(a):
    # run from the project root so Streamlit reads .streamlit/config.toml (theme matching the figure colours)
    subprocess.call([sys.executable, "-m", "streamlit", "run", str(resolve("src/visualization/result_dashboard.py"))],
                    cwd=str(resolve(".")))


def main(argv=None):
    p = argparse.ArgumentParser(description=t("app.name"))
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("--target", required=True)
    s.add_argument("--start", required=True)
    s.add_argument("--end", required=True)
    s.add_argument("--db", action="store_true")
    s.set_defaults(fn=cmd_search)
    s = sub.add_parser("extract")
    s.add_argument("--observations", required=True)
    s.add_argument("--max-images", type=int)
    s.set_defaults(fn=cmd_extract)
    s = sub.add_parser("separate")
    s.add_argument("--spectrum", required=True)
    s.add_argument("--H", type=float)
    s.add_argument("--H-err", type=float)
    s.add_argument("--G", type=float)
    s.add_argument("--label", default="target")
    s.add_argument("--rot-period", type=float, help="rotation period in hours (enables lightcurve term)")
    s.add_argument("--no-calibration", action="store_true", help="do not apply the solar-analog correction")
    s.set_defaults(fn=cmd_separate)
    s = sub.add_parser("classify")
    s.add_argument("--reflectance", required=True)
    s.add_argument("--pV", type=float)
    s.add_argument("--mc", type=int, default=0)
    s.set_defaults(fn=cmd_classify)
    s = sub.add_parser("h-estimate")
    s.add_argument("--target", required=True)
    s.add_argument("--photometry")
    s.add_argument("--no-mpc", action="store_true")
    s.add_argument("--ignore-sbdb-h", action="store_true", help="test the photometric path even if SBDB has H")
    s.set_defaults(fn=cmd_h)
    s = sub.add_parser("albedo")
    s.add_argument("--D", type=float, required=True)
    s.add_argument("--D-err", type=float)
    s.add_argument("--H", type=float, required=True)
    s.add_argument("--H-err", type=float)
    s.add_argument("--H-source", default="user input")
    s.add_argument("--D-source", default="user input")
    s.set_defaults(fn=cmd_albedo)
    s = sub.add_parser("mass-density")
    s.add_argument("--target", required=True)
    s.add_argument("--D", type=float)
    s.add_argument("--D-err", type=float)
    s.set_defaults(fn=cmd_mass_density)
    s = sub.add_parser("analyze")
    s.add_argument("--target", required=True)
    s.add_argument("--start")
    s.add_argument("--end")
    s.add_argument("--from-saved", action="store_true",
                   help="re-analyse the saved stage-1/2 tables in the output folder (no search, no extraction)")
    s.add_argument("--out-dir", help="output root (default: project.output_dir in config/settings.yaml)")
    s.add_argument("--db", help="database path (default: project.database_path in config/settings.yaml)")
    s.add_argument("--max-images", type=int)
    s.add_argument("--photometry")
    s.add_argument("--no-mpc", action="store_true")
    s.set_defaults(fn=cmd_analyze)
    s = sub.add_parser("validate")
    s.add_argument("--objects", nargs="*")
    s.set_defaults(fn=cmd_validate)
    s = sub.add_parser("validate-taxonomy")
    s.add_argument("--target", required=True)
    s.add_argument("--start")
    s.add_argument("--end")
    s.add_argument("--max-images", type=int)
    s.set_defaults(fn=cmd_validate_taxonomy)
    s = sub.add_parser("validate-batch")
    s.add_argument("--targets", nargs="+", required=True)
    s.add_argument("--start")
    s.add_argument("--end")
    s.add_argument("--max-images", type=int, help="cap on exposures per target, shared among observing seasons (default: all)")
    s.add_argument("--from-saved", action="store_true",
                   help="re-analyse and validate the saved spectra (outputs/<target>/) without searching again")
    s.set_defaults(fn=cmd_validate_batch)
    s = sub.add_parser("solar-analog-calibration")
    s.add_argument("--start")
    s.add_argument("--end")
    s.add_argument("--from-saved", action="store_true",
                   help="re-derive from the saved star spectra in data/calibration/ (no network)")
    s.add_argument("--max-images-per-star", type=int)
    s.add_argument("--stars", nargs="*", help="subset of the names in config/solar_analogs.yaml")
    s.set_defaults(fn=cmd_solar_analog_calibration)
    s = sub.add_parser("classifier-calibration")
    s.add_argument("--targets", nargs="+", required=True, help="observations whose sampling is used")
    s.add_argument("--models", nargs="+", default=["settings"],
                   help="settings | chi2 | gaussian | gaussian_corr<L> (L in um)")
    s.add_argument("--no-prior", action="store_true", help="spectral classifier only (no population/orbit/albedo prior)")
    s.set_defaults(fn=cmd_classifier_calibration)

    s = sub.add_parser("population-priors", help="fetch the SBDB population catalogue, train the priors and "
                                                 "compare models (notebook-style cross-validation)")
    s.add_argument("--refresh", action="store_true", help="download the catalogue tables again")
    s.add_argument("--compare", action="store_true", help="also cross-validate alternative models (a few minutes)")
    s.set_defaults(fn=cmd_population_priors)

    s = sub.add_parser("eta-prior", help="fetch the NEOWISE beaming-parameter fits and show the eta prior of the "
                                         "diameter posterior")
    s.add_argument("--refresh", action="store_true", help="download the NEOWISE and SBDB tables again")
    s.set_defaults(fn=cmd_eta_prior)

    s = sub.add_parser("followup")
    s.add_argument("--target", required=True)
    s.add_argument("--days", type=int, default=120)
    s.set_defaults(fn=cmd_followup)
    s = sub.add_parser("dashboard")
    s.set_defaults(fn=cmd_dashboard)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
