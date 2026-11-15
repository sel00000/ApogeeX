"""Markdown report for one asteroid. All headings and labels come from the i18n catalogue."""
from __future__ import annotations

import json
from pathlib import Path

from ..common import status
from ..i18n import t


def _v(x, fmt="{:.4g}"):
    if x is None:
        return status.NA
    if isinstance(x, (int, float)):
        return fmt.format(x)
    return str(x)


def _prob(p):
    """Percentage with sensible resolution: tiny values shown as an upper bound, not as 0."""
    if p is None:
        return status.NA
    if p >= 0.001:
        return f"{100 * p:.1f}%"
    return "<0.1%"


def _pm(v, e, fmt="{:.4g}"):
    if v is None:
        return status.NA
    return f"{fmt.format(v)} ± {fmt.format(e)}" if e is not None else f"{fmt.format(v)} (uncertainty not provided)"


def build_report(target: str, rec: dict, *, taxonomy=None, minerals=None, thermal=None, h_result=None, temporal=None,
                 diameter=None, albedo=None, mass=None, density=None, n_exposures: int = 0,
                 calibration: dict | None = None, statistical_diameter=None, diameter_posterior=None) -> str:
    L = [f"# {t('report.title', target=target)}", "",
         t("report.generated", timestamp=rec.get("analysis_timestamp"), version=rec.get("model_version")), ""]
    if rec.get("origin") == status.ORIGIN_SIMULATED:
        L += [f"> **{t('common.simulated')}**", ""]
    L += [f"## {t('report.section_identification')}", "",
          f"- {t('report.field_designation')}: {_v(rec.get('official_name') or target)}",
          f"- {t('report.field_status')}: {_v(rec.get('discovery_status'))}", "",
          f"## {t('report.section_observations')}", "",
          f"- {t('report.field_n_exposures')}: {n_exposures}",
          f"- {t('report.field_n_points')}: {_v(rec.get('n_spectral_points'))}",
          f"- Quality flags: {_v(rec.get('quality_flag'))}", ""]
    L += [f"## {t('report.section_calibration')}", ""]
    if calibration is not None and calibration.get("applied"):
        sl = calibration.get("slope_sigma_per_um") or {}
        L += [f"- {t('report.field_status')}: {t('report.calibration_applied')}",
              f"- {t('report.field_calibration_stars')}: {calibration.get('n_stars')} "
              f"({', '.join(calibration.get('stars') or [])})",
              f"- {t('report.field_calibration_max')}: {100 * calibration.get('max_abs_correction', 0):.1f}%",
              f"- {t('report.field_calibration_slope')}: "
              + ", ".join(f"{k} {100 * v:.2f} %/um" for k, v in sl.items() if v is not None),
              f"- {t('report.field_calibration_fit')}: {_v(calibration.get('chi2_red'), '{:.2f}')}",
              f"- {t('report.field_calibration_file')}: {calibration.get('file')}"]
        L += [f"  - ⚠ {w}" for w in calibration.get("warnings", [])]
    else:
        L.append(f"- {t('report.calibration_not_applied')}: "
                 + str((calibration or {}).get('reason', status.NA)))
    L += ["", f"## {t('report.section_temporal')}", ""]
    if temporal is not None and temporal.n_points:
        v, lc = temporal.variability or {}, temporal.lightcurve or {}
        L += [f"- {t('report.field_visits')}: {temporal.n_visits} ({temporal.n_exposures} exposures, "
              f"{temporal.time_span_days:.2f} d)",
              f"- {t('report.field_families')}: {', '.join(sorted(set(temporal.families.values())))}",
              f"- {t('report.field_repeats')}: {temporal.n_repeat_bins} bins / {temporal.n_repeat_points} points",
              f"- {t('report.field_variability')}: " + (
                  (f"detected (p = {v['p_constant']:.1e}, visit-offset rms {v['visit_offset_rms_mag']:.2f} mag)"
                   if v.get("detected") else f"not detected (p = {v.get('p_constant', float('nan')):.2g})")
                  if v.get("tested") else f"not tested - {v.get('reason', '')}"),
              f"- {t('report.field_lightcurve')}: " + ("applied" if lc.get("supported") else "not applied")
              + f" - {lc.get('reason', status.NA)}",
              f"- {t('report.field_correction')}: {temporal.correction}; "
              f"{t('report.field_norm_groups')}: {temporal.n_norm_groups}",
              "", f"| {t('report.field_segments')} | {t('report.field_dt')} | {t('report.field_shared_visits')} |",
              "|---|---|---|"]
        L += [f"| {o['segments']} | {o['median_dt_days']:+.2f} | {o['shared_visits']} |"
              for o in temporal.segment_time_offsets]
        L += [""] + [f"  - ⚠ {w}" for w in temporal.warnings]
    else:
        L.append(status.NA)
    L += ["", f"## {t('report.section_thermal')}", ""]
    if thermal is not None:
        L += [f"- {t('report.field_status')}: {thermal.status}",
              f"- {t('report.field_eta')}: {_pm(thermal.eta, thermal.eta_err)} "
              f"({'fitted' if thermal.eta_fitted else 'fixed'})",
              f"- {t('report.field_tss')}: {_pm(thermal.T_ss_K, thermal.T_ss_err_K, '{:.1f}')}",
              f"- {t('report.field_chi2')}: {_v(thermal.chi2_red, '{:.2f}')}",
              f"- Thermal excess S/N: {_v(thermal.thermal_excess_snr, '{:.1f}')}",
              f"- Internal 2-um reflectance parameter (not pV): {_v(thermal.ir_reflectance_2um_internal)}"]
        L += [f"  - ⚠ {w}" for w in thermal.warnings]
    else:
        L.append(status.NA)
    L += ["", f"## {t('report.section_taxonomy')}", ""]
    if taxonomy is not None and taxonomy.candidates:
        rows = taxonomy.ranking or taxonomy.candidates
        L += [f"| {t('report.field_rank')} | {t('report.field_class')} | {t('report.field_complex')} | "
              f"{t('report.field_probability')} | chi²_red |", "|---|---|---|---|---|"]
        L += [f"| {c.get('rank', i + 1)} | {c['class']} | {c['complex']} | {_prob(c['probability'] if 'probability' in c else c['score'])} | "
              f"{c['chi2_red']:.2f} |" for i, c in enumerate(rows)]
        if taxonomy.complex_ranking:
            L += ["", f"**{t('report.section_complex_ranking')}**", "",
                  f"| {t('report.field_rank')} | {t('report.field_complex')} | {t('report.field_probability')} |",
                  "|---|---|---|"]
            L += [f"| {c['rank']} | {c['complex']} | {_prob(c['probability'])} |" for c in taxonomy.complex_ranking]
        L += ["", f"- {t('report.field_best')}: **{taxonomy.best_class}** — {t('common.confidence')}: {taxonomy.confidence}"]
        L += [f"  - {r}" for r in (taxonomy.confidence_reasons or [])]
        if taxonomy.s_vs_d:
            sd = taxonomy.s_vs_d
            L.append(f"- {t('report.field_s_vs_d')}: {'distinguished' if sd['distinguished'] else 'not distinguished'} "
                     f"(D minus S deviance {sd['delta_deviance_D_minus_S']:+.1f}; favours {sd['favoured']})")
        L.append(f"- {t('report.field_slope_used')}: {'yes' if taxonomy.slope_used else 'no'}"
                 + (f" (systematic {taxonomy.slope_sys_per_um:.3f} /um)" if taxonomy.slope_sys_per_um else ""))
        if taxonomy.prior:
            pr = taxonomy.prior
            alb = pr.get("albedo")
            L += ["", f"**{t('report.section_prior')}**", "",
                  f"- {t('report.field_prior_population')}: beta {pr['info'].get('population_exponent')}, "
                  f"{t('report.field_prior_orbit')}: " + (f"tau {pr['info'].get('orbit_exponent')} "
                  f"(a {pr['orbit']['a_au']:.3f} au, e {pr['orbit']['e']:.3f}, i {pr['orbit']['i_deg']:.1f} deg)"
                  if pr.get("orbit") else "not used"),
                  f"- {t('report.field_prior_albedo')}: " + (f"pV {alb['pV']:.3f} ± {alb['sigma_log10']:.2f} dex "
                                                             f"({alb['source']})" if alb else "not used"),
                  f"- {t('report.field_prior_training')}: {pr['info'].get('n_diameters')} catalogue diameters, "
                  f"{pr['info'].get('n_classified')} classified objects; the object's own catalogue rows "
                  + ("excluded from training" if pr['info'].get('target_excluded_from_training') else
                     "not in the training tables")]
            if taxonomy.complex_ranking_spectral:
                L += ["", f"| {t('report.field_complex')} | {t('report.field_probability')} | "
                          f"{t('report.field_probability_spectral')} |", "|---|---|---|"]
                spec = {c["complex"]: c["probability"] for c in taxonomy.complex_ranking_spectral}
                L += [f"| {c['complex']} | {_prob(c['probability'])} | {_prob(spec.get(c['complex']))} |"
                      for c in taxonomy.complex_ranking[:6]] + [""]
        L.append(f"- {t('report.note_probability')}")
        L += [f"- {x}" for x in taxonomy.limitations]
    else:
        L.append(taxonomy.status if taxonomy is not None else status.INSUFFICIENT_DATA)
    L += ["", f"## {t('report.section_minerals')}", ""]
    if minerals is not None:
        L += [f"| {t('report.field_band')} | {t('report.field_status')} | {t('report.field_center')} | "
              f"{t('report.field_depth')} | {t('report.field_mdd')} | {t('report.field_band_evidence')} |",
              "|---|---|---|---|---|---|"]
        for b in minerals.bands:
            st = getattr(b, "status", "DETECTED" if b.detected else "NOT_DETECTED")
            L.append(f"| {b.name} | {st} | {_pm(b.center_um, b.center_err_um, '{:.3f}')} | "
                     f"{_pm(b.depth, b.depth_err, '{:.3f}')} | {_v(getattr(b, 'min_detectable_depth', None), '{:.3f}')} | "
                     f"{(', '.join(b.evidence) if getattr(b, 'evidence', None) else (getattr(b, 'reason', '') or b.note))} |")
        L += ["", f"| {t('report.field_mineral')} | {t('report.field_evidence')} | {t('common.confidence')} |",
              "|---|---|---|"]
        L += [f"| {c['mineral']} | {c['evidence']} | {c['confidence']} |" for c in minerals.candidates]
    L += ["", f"## {t('report.section_h')}", ""]
    if h_result is not None:
        L += [f"- {t('report.field_status')}: {h_result.status}",
              f"- {t('report.field_H')}: {_pm(h_result.H, h_result.H_err, '{:.3f}')}",
              f"- {t('report.field_G')}: {_v(h_result.G)}",
              f"- {t('common.source')}: {h_result.source} {h_result.reference}",
              f"- {t('common.method')}: {h_result.phase_model}"]
        L += [f"  - ⚠ {w}" for w in h_result.warnings]
        if h_result.followup_requirements:
            L += ["- Follow-up requirements:"] + [f"  - {r}" for r in h_result.followup_requirements]
    L += ["", f"## {t('report.section_diameter')}", ""]
    if diameter is not None:
        L += [f"- {t('report.field_status')}: {diameter.status}",
              f"- {t('report.field_diameter')}: {_pm(diameter.diameter_km, diameter.diameter_total_err_km)}",
              f"- Conditional range (no H): {_v(diameter.conditional_range_km)}",
              f"- {t('report.field_catalog_diameter')}: {_pm(diameter.catalog_diameter_km, diameter.catalog_diameter_err_km)}"
              f" ({diameter.catalog_diameter_ref or status.NA})",
              f"- Difference: {_v(diameter.difference_km)} km ({_v(diameter.difference_sigma, '{:.1f}')} sigma)",
              f"- {t('common.confidence')}: {diameter.confidence}"]
        sr = rec.get("shape_reference")
        if isinstance(sr, dict) and rec.get("catalog_effective_diameter_km"):
            iv = rec.get("catalog_effective_diameter_interval_68_km")
            ax = sr.get("axes_km") or [float("nan")] * 3
            geo = (t("report.shape_reference_aspect", obs=sr["sub_observer_lat_deg"][1], sun=sr["sub_solar_lat_deg"][1],
                     pole=f"{sr['pole_ra_dec_deg'][0]:.5g}/{sr['pole_ra_dec_deg'][1]:.4g}")
                   if sr.get("sub_observer_lat_deg") else t("report.shape_reference_no_pole"))
            L.append(f"- {t('report.field_effective_reference')}: {rec['catalog_effective_diameter_km']:.4g}"
                     + (f" ({iv[0]:.4g}-{iv[1]:.4g})" if iv else "") + " - "
                     + t("report.shape_reference_detail", f=sr["factor"], a=ax[0], b=ax[1], c=ax[2],
                         phase=sr.get("phase_deg") or float("nan"), geometry=geo))
            L += [f"  - ⚠ {w}" for w in sr.get("warnings") or []]
        if rec.get("diameter_catalog_z") is not None:
            L.append(f"- {t('report.field_diameter_z')}: "
                     + t("report.diameter_z_values", cat=_v(rec.get("diameter_catalog_z"), "{:+.1f}"),
                         eff=_v(rec.get("diameter_effective_z"), "{:+.1f}")))
        if diameter.diameter_interval_68_km:
            (a, b), (c, d) = diameter.diameter_interval_68_km, diameter.diameter_interval_95_km
            L.append(f"- {t('report.field_diameter_interval')}: {a:.4g}-{b:.4g} / {c:.4g}-{d:.4g}")
    post = diameter_posterior
    if post is not None and getattr(post, "status", None) == "OK":
        ep = post.eta_prior or {}
        if ep.get("relation") == "neowise_population":
            pr = (f"NEOWISE {ep.get('population')} population at alpha {ep.get('alpha_deg', 0):.1f} deg, x"
                  f"{ep.get('wavelength_factor', 1):.2f} for 3.5-5 um: eta {ep.get('eta_at_100km', 0):.2f} at 100 km, "
                  f"{ep.get('eta_at_10km', 0):.2f} at 10 km (sigma ln eta {ep.get('sigma_ln_at_100km', 0):.2f}-"
                  f"{ep.get('sigma_ln_at_10km', 0):.2f})")
        else:
            pr = (f"{ep.get('relation')}: eta0 {ep.get('eta0', 0):.2f} (-{ep.get('sigma_minus')}/+{ep.get('sigma_plus')}) "
                  f"at alpha {ep.get('alpha_deg', 0):.1f} deg ({ep.get('population')})")
        L += [f"- {t('report.field_eta_prior')}: {pr}",
              f"- {t('report.field_posterior_data')}: {post.n_points} ({post.n_groups} normalisation group(s), "
              f"{post.n_visits_with_offset_error} of {post.n_visits} visits with a shared brightness error)",
              f"- {t('report.field_thermal_signal')}: {_v(post.detection_sigma, '{:.1f}')}"
              + (f" — {t('report.field_eta_posterior')}: {post.eta['median']:.2f} ({post.eta['lo68']:.2f}-"
                 f"{post.eta['hi68']:.2f})" if post.eta else "")]
        L += [f"  - ⚠ {w}" for w in post.warnings]
        if post.combined:
            q = post.combined
            L += ["", f"### {t('report.section_combined_diameter')}", "",
                  f"- {t('report.field_combined_diameter')}: {q['median']:.4g} km (68%: {q['lo68']:.4g}-{q['hi68']:.4g}; "
                  f"95%: {q['lo95']:.4g}-{q['hi95']:.4g}) — {t('report.note_combined')}"]
    if rec.get("diameter_best_km") is not None:
        bi = rec.get("diameter_best_interval_68_km")
        L.append(f"- {t('report.field_best_diameter')}: {rec['diameter_best_km']:.4g} km"
                 + (f" (68%: {bi[0]:.4g}-{bi[1]:.4g})" if bi else "") + f" — {rec.get('diameter_best_source')}")
    sd = statistical_diameter
    if sd is not None:
        L += ["", f"### {t('report.section_statistical_diameter')}", ""]
        if sd.diameter_km is not None:
            lo, hi = sd.interval_68_km
            lo2, hi2 = sd.interval_95_km
            L += [f"- {t('report.field_statistical_diameter')}: {sd.diameter_km:.4g} km "
                  f"(68%: {lo:.4g}-{hi:.4g} km; 95%: {lo2:.4g}-{hi2:.4g} km) — {t('common.confidence')}: {sd.confidence}",
                  f"- {t('report.field_prior_pv')}: {sd.pV_median:.3f} "
                  f"(68%: {sd.pV_interval_68[0]:.3f}-{sd.pV_interval_68[1]:.3f}) — {t('report.note_prior_pv')}",
                  f"- {t('report.field_thermal_upper_limit')}: {_v(sd.thermal_upper_limit_km)} km",
                  f"- {t('common.method')}: {sd.method}",
                  f"- {t('report.field_complex_weights')}: "
                  + (", ".join(f"{k} {100 * v:.0f}%" for k, v in sorted(sd.complex_weights.items(), key=lambda x: -x[1]))
                     or "none - no classification, orbit regression only")]
            if sd.consistency is not None:
                c = sd.consistency
                L.append(f"- {t('report.field_consistency')}: thermal {c['thermal_km']:.4g} km / statistical "
                         f"{c['statistical_km']:.4g} km = {c['ratio']:.2f}, z = {c['z']:+.1f} — "
                         + ("consistent" if c["consistent"] else f"INCONSISTENT at {c['threshold']:g} sigma"))
        L += [f"  - ⚠ {w}" for w in sd.warnings]
    L += ["", f"## {t('report.section_albedo')}", ""]
    if albedo is not None:
        L += [f"- {t('report.field_status')}: {albedo.status}",
              f"- {t('report.field_pv')}: {_pm(albedo.geometric_albedo, albedo.albedo_err, '{:.3f}')}",
              f"- {t('common.method')}: {albedo.method}",
              f"- H: {_pm(albedo.H, albedo.H_err, '{:.3f}')} — {albedo.H_source or status.NA}",
              f"- D: {_pm(albedo.D_km, albedo.D_err_km)} km — {albedo.D_source or status.NA}",
              f"- Correlation: {albedo.correlation_treatment or status.NA}"]
        if albedo.missing_inputs:
            L.append(f"- Missing inputs: {', '.join(albedo.missing_inputs)}")
        L += [f"  - ⚠ {w}" for w in albedo.warnings]
    L += ["", f"## {t('report.section_mass_density')}", ""]
    if mass is not None:
        L += [f"- {t('report.field_mass')}: {_pm(mass.mass_kg, mass.mass_err_kg)} — {mass.method} {mass.source}"]
    if density is not None:
        L += [f"- {t('report.field_status')}: {density.status}" + (f" ({density.notes})" if density.notes else ""),
              f"- {t('report.field_density')}: {_pm(density.density_kg_m3, density.density_err_kg_m3, '{:.0f}')}",
              f"- {t('report.field_shape')}: {density.shape_assumption or status.NA} — {density.volume_method}"]
    L += ["", f"## {t('report.section_missing')}", ""]
    L += [f"- {m}" for m in rec.get("missing_data", [])] or ["- none"]
    L += ["", f"## {t('report.section_provenance')}", "", "```json",
          json.dumps(rec.get("input_data_sources", [])[:20], indent=1, default=str), "```", ""]
    return "\n".join(L)


def save_report(text: str, path: str | Path) -> Path:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p
