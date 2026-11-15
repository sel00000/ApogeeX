"""Merge stage outputs into one integrated record per asteroid (schema: RESULT_COLUMNS)."""
from __future__ import annotations

import json

import numpy as np

from ..common import status
from ..common.config import model_version
from ..common.provenance import utc_now


def _fmt(v):
    if v is None:
        return None
    if isinstance(v, float) and not np.isfinite(v):
        return None
    return v


def merge(asteroid_id: str, *, sbdb=None, search=None, spectrum=None, taxonomy=None, minerals=None,
          thermal=None, h_result=None, diameter=None, albedo=None, mass=None, density=None,
          calibration: dict | None = None, origin: str = status.ORIGIN_OBSERVED,
          statistical_diameter=None, diameter_posterior=None, shape_reference=None) -> dict:
    rec = {"asteroid_id": asteroid_id, "origin": origin, "analysis_timestamp": utc_now(),
           "model_version": model_version()}
    missing, limitations, sources = [], [], []
    if sbdb is not None and sbdb.found:
        rec["official_name"] = sbdb.fullname
        rec["provisional_designation"] = sbdb.designation
        rec["discovery_status"] = "Catalogued (JPL SBDB)"
        if sbdb.source:
            sources.append(sbdb.source.to_dict())
    else:
        rec["discovery_status"] = status.UNKNOWN
    if search is not None and not search.observations.empty:
        o = search.observations
        rec["observation_date"] = f"MJD {o['mjd_mid'].min():.4f}-{o['mjd_mid'].max():.4f}"
        rec["right_ascension"] = float(o["pred_ra_deg"].iloc[0])
        rec["declination"] = float(o["pred_dec_deg"].iloc[0])
        rec["spherex_observation_id"] = sorted(o["obs_id"].unique().tolist())[:200]
        sources.extend(search.provenance.sources)
    if spectrum is not None and len(spectrum):
        rec["n_spectral_points"] = int(len(spectrum))
        rec["signal_to_noise_median"] = float(np.nanmedian(spectrum["snr"]))
        rec["quality_flag"] = spectrum["quality_flag"].value_counts().to_dict()
    else:
        missing.append("SPHEREx spectrum")
    if taxonomy is not None and taxonomy.candidates:
        top = taxonomy.candidates[0]
        rec["spectral_class"] = f"{taxonomy.best_class} candidate"
        # ranked list, highest probability first (all reference classes)
        rec["spectral_class_probability"] = [
            {"rank": int(c["rank"]), "class": c["class"], "complex": c["complex"],
             "probability": round(float(c["probability"]), 6)} for c in (taxonomy.ranking or taxonomy.candidates)]
        rec["spectral_complex_probability"] = taxonomy.complex_ranking
        rec["spectral_complex"] = taxonomy.best_complex
        rec["classification_confidence"] = taxonomy.confidence
        # the same spectrum without the prior, and the prior used (population, orbit, albedo)
        rec["spectral_complex_probability_spectral_only"] = taxonomy.complex_ranking_spectral
        pr = taxonomy.prior or {}
        rec["classification_prior"] = ({"albedo": pr.get("albedo"), "orbit": pr.get("orbit"),
                                        "complex_log_prior": pr.get("complex_log_prior"), "info": pr.get("info")}
                                       if pr else None)
        limitations.extend(taxonomy.limitations)
    else:
        rec["spectral_class"] = status.INSUFFICIENT_DATA
        missing.append("spectral classification")
    if calibration is not None:
        rec["spectral_calibration"] = {k: calibration.get(k) for k in (
            "applied", "reason", "n_stars", "stars", "chi2_red", "slope_sigma_per_um", "max_abs_correction",
            "n_uncorrected", "file", "data_releases_calibration", "warnings") if k in calibration}
        if not calibration.get("applied"):
            limitations.append("Solar-analog relative spectral calibration not applied: "
                               + str(calibration.get("reason", status.UNKNOWN)) + ".")
    if minerals is not None:
        rec["mineral_candidates"] = minerals.candidates or status.UNKNOWN
        rec["absorption_features"] = [b.__dict__ for b in minerals.bands]
        limitations.extend(minerals.limitations)
    if thermal is not None:
        rec["estimated_temperature"] = _fmt(thermal.T_ss_K)
        rec["estimated_temperature_err"] = _fmt(thermal.T_ss_err_K)
    if h_result is not None:
        rec["absolute_magnitude_H"] = _fmt(h_result.H) if h_result.reliable else h_result.status
        rec["H_uncertainty"] = _fmt(h_result.H_err)
        rec["absolute_magnitude_source"] = f"{h_result.source} {h_result.reference}".strip() or h_result.status
        rec["photometry_source_ids"] = h_result.photometry_sources
        rec["filter_system"] = h_result.filters or h_result.band
        rec["phase_function_model"] = h_result.phase_model
        rec["phase_function_parameters"] = {"G": h_result.G, "G_err": h_result.G_err, "G_fitted": h_result.G_fitted,
                                            "G1": h_result.G1, "G2": h_result.G2,
                                            "G1_err": h_result.G1_err, "G2_err": h_result.G2_err}
        rec["photometry_epochs"] = h_result.n_points
        rec["photometry_quality"] = {"rms_mag": h_result.rms_mag, "n_nights": h_result.n_nights,
                                     "excluded": h_result.excluded, "warnings": h_result.warnings}
        if not h_result.reliable:
            missing.append("absolute magnitude H")
    if diameter is not None:
        if diameter.diameter_km is not None:
            rec["diameter_km"] = diameter.diameter_km
            rec["diameter_uncertainty"] = diameter.diameter_total_err_km
            rec["diameter_interval_68_km"] = list(diameter.diameter_interval_68_km) if diameter.diameter_interval_68_km else None
            rec["diameter_interval_95_km"] = list(diameter.diameter_interval_95_km) if diameter.diameter_interval_95_km else None
            rec["diameter_source"] = (f"SPHEREx {diameter.model} (eta marginalised over its prior)" if diameter.posterior
                                      else f"SPHEREx {diameter.model} fit (eta={'fitted' if diameter.eta_fitted else 'fixed'})")
        else:
            rec["diameter_km"] = None
            rec["diameter_source"] = diameter.status
            missing.append("diameter")
        rec["diameter_conditional_range_km"] = diameter.conditional_range_km
        rec["diameter_consistency"] = (statistical_diameter.consistency if statistical_diameter is not None
                                       else None)
        rec["catalog_diameter_km"] = diameter.catalog_diameter_km
        rec["catalog_diameter_uncertainty"] = diameter.catalog_diameter_err_km
        rec["catalog_diameter_source"] = diameter.catalog_diameter_ref
    sd = statistical_diameter
    if sd is not None and sd.diameter_km is not None:
        rec["diameter_statistical_km"] = sd.diameter_km
        rec["diameter_statistical_interval_68_km"] = list(sd.interval_68_km)
        rec["diameter_statistical_interval_95_km"] = list(sd.interval_95_km)
        rec["diameter_statistical_method"] = sd.method
        rec["diameter_statistical_confidence"] = sd.confidence
        rec["diameter_statistical_pV_prior"] = sd.pV_median
        rec["diameter_thermal_upper_limit_km"] = sd.thermal_upper_limit_km
        limitations.append("The statistical diameter is an estimate from H and a population albedo prior "
                           "(SPHEREx complex probabilities, orbit), not a measurement; no albedo is derived from it.")
    post = diameter_posterior
    comb = post.combined if post is not None and getattr(post, "status", None) == "OK" else None
    if post is not None and getattr(post, "status", None) == "OK":
        rec["diameter_posterior"] = {k: v for k, v in post.summary().items()
                                     if k in ("thermal", "eta", "detection_sigma", "eta_prior", "kappa", "n_points",
                                              "n_groups", "n_visits", "n_visits_with_offset_error", "method", "warnings")}
    if comb is not None:
        rec["diameter_combined_km"] = comb["median"]
        rec["diameter_combined_interval_68_km"] = [comb["lo68"], comb["hi68"]]
        rec["diameter_combined_interval_95_km"] = [comb["lo95"], comb["hi95"]]
        rec["diameter_combined_method"] = ("SPHEREx thermal likelihood (all points, eta marginalised over its prior) x "
                                           "population albedo prior (H, orbit, complex probabilities without albedo)")
        limitations.append("The combined diameter uses the population albedo prior: it is the best estimate of D, but "
                           "no albedo is derived from it.")
        if comb.get("conflict"):
            limitations.append(next((w for w in post.warnings if "disagree" in w), "SPHEREx thermal data and the "
                                    "population albedo prior disagree: the combined interval spans both."))
    consistent = sd is None or sd.consistency is None or sd.consistency["consistent"]
    # best available diameter: the combined estimate (thermal likelihood x priors) when the thermal diameter, if any,
    # agrees with the H + albedo prior; else the thermal diameter; else the statistical estimate
    if comb is not None and consistent:
        rec["diameter_best_km"], rec["diameter_best_source"] = comb["median"], "combined (SPHEREx thermal + albedo prior)"
        rec["diameter_best_uncertainty"] = 0.5 * (comb["hi68"] - comb["lo68"])
        rec["diameter_best_interval_68_km"] = [comb["lo68"], comb["hi68"]]
    elif diameter is not None and diameter.diameter_km is not None:
        rec["diameter_best_km"], rec["diameter_best_source"] = diameter.diameter_km, "SPHEREx thermal (NEATM)"
        rec["diameter_best_uncertainty"] = diameter.diameter_total_err_km
        rec["diameter_best_interval_68_km"] = (list(diameter.diameter_interval_68_km)
                                               if diameter.diameter_interval_68_km else None)
    elif sd is not None and sd.diameter_km is not None:
        rec["diameter_best_km"], rec["diameter_best_source"] = sd.diameter_km, "statistical (H + albedo prior)"
        rec["diameter_best_uncertainty"] = 0.5 * (sd.interval_68_km[1] - sd.interval_68_km[0])
        rec["diameter_best_interval_68_km"] = list(sd.interval_68_km)
    if diameter is not None and diameter.diameter_km is not None and not consistent:
        limitations.append(f"Thermal diameter differs from the H + albedo-prior estimate by "
                           f"{sd.consistency['z']:+.1f} sigma (ratio {sd.consistency['ratio']:.2f}): the thermal diameter "
                           "is reported as the best value; check the D-eta degeneracy of the 3.5-5 um fit.")
    # Comparison with the catalogue (log space, as in docs/STAGE_STATUS.md). When SBDB gives a shape, a thermal
    # diameter is compared with the effective diameter of that shape at the SPHEREx geometry
    # (src/validation/shape_reference.py): a NEATM diameter is effective, a shape-model diameter volume-equivalent.
    from ..validation.shape_reference import log_z
    best, best_iv = rec.get("diameter_best_km"), rec.get("diameter_best_interval_68_km")
    cat, cat_err = rec.get("catalog_diameter_km"), rec.get("catalog_diameter_uncertainty")
    rec["diameter_catalog_z"] = log_z(cat, (cat_err or 0.0) / cat if cat else 0.0, best, best_iv)
    rec["shape_reference"] = rec["catalog_effective_diameter_km"] = None
    rec["catalog_effective_diameter_interval_68_km"] = rec["diameter_effective_z"] = None
    if shape_reference is not None and shape_reference.applicable:
        rec["shape_reference"] = shape_reference.summary()
        rec["catalog_effective_diameter_km"] = shape_reference.D_eff_km
        rec["catalog_effective_diameter_interval_68_km"] = shape_reference.D_eff_interval_68_km
        if str(rec.get("diameter_best_source", "")).startswith(("combined", "SPHEREx")):
            rec["diameter_effective_z"] = log_z(shape_reference.D_eff_km, shape_reference.relative_sigma(), best,
                                                best_iv)
    if albedo is not None:
        ok = albedo.status in ("ESTIMATED", "ON_HOLD_VALIDATION") and albedo.geometric_albedo is not None
        rec["geometric_albedo_pV"] = albedo.geometric_albedo if ok else None
        rec["albedo_uncertainty"] = albedo.albedo_err if ok else None
        rec["albedo_band"] = albedo.band if ok else None
        rec["albedo_method"] = albedo.method if ok else None
        rec["albedo_status"] = albedo.status if ok else f"{albedo.status}: missing {', '.join(albedo.missing_inputs)}"
        if not ok:
            missing.append("geometric albedo")
    if mass is not None:
        rec["mass_kg"] = mass.mass_kg if mass.mass_kg is not None else status.UNKNOWN
        rec["mass_uncertainty"] = mass.mass_err_kg
        rec["mass_method"] = f"{mass.method} {mass.source}".strip() or mass.notes
        if mass.mass_kg is None:
            missing.append("mass")
    if density is not None:
        rec["density"] = density.density_kg_m3 if density.density_kg_m3 is not None else status.UNKNOWN
        rec["density_uncertainty"] = density.density_err_kg_m3
        rec["density_unit"] = "kg/m^3"
        rec["density_status"] = density.status
        rec["shape_assumption"] = density.shape_assumption or None
        if density.status == "ON_HOLD_VALIDATION":
            limitations.append(f"Density on hold: {density.notes}")
    rec["missing_data"] = missing
    rec["limitations"] = sorted(set(limitations))
    rec["input_data_sources"] = sources[:100]
    rec["quality_status"] = "Complete" if not missing else "Partial"
    if comb is not None and str(rec.get("diameter_best_source", "")).startswith("combined"):
        # combined estimate: High only with a thermal detection (a population prior alone never gives High)
        rel = rec["diameter_best_uncertainty"] / rec["diameter_best_km"]
        detected = diameter is not None and diameter.diameter_km is not None
        conf = (status.CONF_HIGH if detected and rel < 0.1 else status.CONF_MEDIUM if rel < 0.25 else status.CONF_LOW)
        rec["diameter_best_confidence"] = conf
        diameter = type("BestDiameter", (), {"confidence": conf})()
    elif diameter is not None and diameter.diameter_km is None and sd is not None and sd.diameter_km is not None:
        diameter = sd                       # the statistical estimate's confidence stands for the diameter
    confs = [x for x in (getattr(taxonomy, "confidence", None), getattr(diameter, "confidence", None),
                         getattr(albedo, "confidence", None)) if x and x != status.CONF_NONE]
    order = [status.CONF_LOW, status.CONF_MEDIUM, status.CONF_HIGH]
    rec["confidence_level"] = min(confs, key=order.index) if confs else status.CONF_NONE
    return rec
