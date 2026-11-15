"""TargetPrior of one asteroid from its catalogue record: orbit (a, e, i), H and - for the albedo term of the
classifier - a catalogue albedo. Built outside the analysis code, which receives only the prior.

The population model is trained without the object's own catalogue rows (designation match), so the
object's catalogue class never enters its own prior. The catalogue albedo, when used, is the albedo that
reproduces the catalogue diameter with the current H (pV_eff = (1329 10^(-H/5) / D)^2), the same convention
as the population model. It is a measured input of the classifier and recorded as such; it is never an
input of the statistical diameter (classification.priors / physical.statistical_diameter).
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from ..acquisition.population_catalogue import catalogue_dir, designation_keys, fetch, load_training_tables
from ..classification.priors import TargetPrior
from ..common.config import settings
from ..physical.population_priors import get_model


@lru_cache(maxsize=1)
def _tables():
    return load_training_tables(log=lambda m: None)


def population_model(extra_excluded: set | None = None, log=print):
    d, tx = _tables()
    return get_model(d, tx, catalogue_dir(), extra_excluded=extra_excluded, log=log)


def _orbit(a, e, i):
    vals = [a, e, i]
    if any(v is None or not np.isfinite(v) for v in vals):
        return None
    return {"a_au": float(a), "e": float(e), "i_deg": float(i)}


def catalogue_albedo(D_km, D_sigma_km, pV, pV_sigma, H, offset_dex: float | None = None) -> tuple[float, float, str] | None:
    """(log10 pV_eff, sigma_log10, description) from a catalogue diameter (preferred) or albedo.

    offset_dex: population median of log10(pV_eff / catalogue pV) (PopulationPriorModel.info). When the object has
    both a catalogue diameter and a catalogue albedo, their disagreement beyond that offset is added in quadrature
    to the uncertainty: it means the H used for the catalogue and the current H differ (H revision, activity).
    596 Scheila (2026-11-15): catalogue pV 0.040, but 0.019 from its catalogue diameter and the current H; with
    the default 0.1 dex the albedo term ruled out its T class (C7 FAIL by 9.0)."""
    floor = float(settings()["classification"].get("prior", {}).get("albedo_sigma_log10_floor", 0.1))
    off = float(offset_dex) if offset_dex is not None and np.isfinite(offset_dex) else 0.0
    have_pv = pV is not None and np.isfinite(pV) and pV > 0
    if D_km and H is not None and np.isfinite(D_km) and D_km > 0:
        lp = 2 * np.log10(1329.0 * 10 ** (-H / 5) / D_km)
        s = max(2 * (D_sigma_km or 0.0) / D_km / np.log(10), floor)
        why = "catalogue diameter with current H"
        if have_pv:
            extra = (lp - np.log10(pV)) - off
            s = float(np.hypot(s, extra))
            if abs(extra) > 0.1:
                why += (f"; catalogue albedo {pV:.3f} disagrees by {extra:+.2f} dex beyond the population offset "
                        "(H revision?): uncertainty increased")
        return float(lp), float(s), why
    if have_pv:
        s = (pV_sigma or 0.0) / pV / np.log(10)
        return float(np.log10(pV) + off), float(max(s, floor)), "catalogue albedo, shifted by the population offset"
    return None


def build_prior(model, orbit: dict | None, H, albedo: tuple | None, source_note: str = "") -> TargetPrior:
    cfg = settings()["classification"].get("prior", {})
    beta = float(cfg.get("population_exponent", 0.25))
    tau = float(cfg.get("orbit_exponent", 0.5))
    use_orbit = orbit is not None and H is not None
    args = (orbit["a_au"], orbit["e"], orbit["i_deg"], H) if use_orbit else (None, None, None, None)
    clp = model.complex_log_prior(*args, population_exponent=beta, orbit_exponent=tau if use_orbit else 0.0)
    info = {"population_exponent": beta, "orbit_exponent": tau if use_orbit else 0.0, "orbit_used": use_orbit,
            "n_diameters": model.info.get("n_diameters"), "n_classified": model.info.get("n_taxonomy"),
            "target_rows_removed": model.info.get("target_rows_removed", 0),
            "catalogue_retrieved": model.info.get("catalogue"), "note": source_note}
    prior = TargetPrior(complex_log_prior=clp, orbit=orbit, H=H, model=model, info=info)
    if albedo is not None and cfg.get("albedo", True):
        prior = prior.with_albedo(*albedo)
    return prior


def target_prior(sbdb, h_result=None, log=print) -> TargetPrior | None:
    """Prior for an analysed object (None if disabled or the catalogue is unavailable)."""
    cfg = settings()["classification"].get("prior", {})
    if not cfg.get("enabled", False) or sbdb is None or not getattr(sbdb, "found", False):
        return None
    keys = designation_keys(sbdb)
    try:
        model = population_model(extra_excluded=keys, log=log)
        standard = set(_tables()[0].attrs.get("excluded", []))
    except Exception as err:  # noqa: BLE001 - the analysis continues without the prior
        log(f"  [prior] population prior unavailable ({err}); classification uses a flat prior over classes.")
        return None
    el = sbdb.elements or {}
    orbit = _orbit(*(el.get(k, {}).get("value") for k in ("a", "e", "i")))
    H = h_result.H if h_result is not None and h_result.reliable else sbdb.value("H")
    alb = None
    if "catalogue" in cfg.get("albedo_sources", ["catalogue"]):
        d, a = sbdb.param("diameter"), sbdb.param("albedo")
        alb = catalogue_albedo(d.value if d else None, d.sigma if d else None, a.value if a else None,
                               a.sigma if a else None, H, model.info.get("pv_eff_minus_catalogue_median_dex"))
        if alb is not None:
            ref = (d.reference if d and d.value else a.reference if a else "") or ""
            alb = (alb[0], alb[1], f"{alb[2]} ({ref})" if ref else alb[2])
    prior = build_prior(model, orbit, H, alb)
    prior.info["target_excluded_from_training"] = bool(keys & standard) or bool(model.info.get("target_rows_removed"))
    return prior


def injection_priors(numbers, log=print) -> dict:
    """Priors of the injection-set objects (classifier calibration): orbit, H and catalogue albedo from the
    catalogue tables, population model with the standard exclusions (which contain these objects)."""
    model = population_model(log=log)
    rows = {}
    for kind in ("taxonomy", "diameters"):
        t = fetch(kind, log=log)
        for r in t[t["pdes"].isin({str(n) for n in numbers})].itertuples():
            rows.setdefault(r.pdes, r)
    out = {}
    for n in numbers:
        r = rows.get(str(n))
        if r is None:
            out[str(n)] = build_prior(model, None, None, None, "not in the catalogue tables")
            continue
        orbit = _orbit(r.a, r.e, r.i)
        alb = catalogue_albedo(getattr(r, "diameter", None), getattr(r, "diameter_sigma", None),
                               getattr(r, "albedo", None), None, r.H, model.info.get("pv_eff_minus_catalogue_median_dex"))
        out[str(n)] = build_prior(model, orbit, r.H if np.isfinite(r.H) else None, alb)
    return out
