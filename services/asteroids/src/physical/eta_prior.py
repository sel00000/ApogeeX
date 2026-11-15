"""Prior on the NEATM beaming parameter eta for the SPHEREx thermal fit.

At 3.5-5 um the thermal flux is on the Wien side, F_th ~ D^2 exp(-hc / lambda k T_ss) with T_ss ~ eta^(-1/4), so D
scales about as eta^1.5 at fixed flux: the prior on eta decides most of the diameter uncertainty of a main-belt
asteroid (2026-11-15: data-only D errors 1-7%, total 22-44% with the near-Earth-object prior).

Relations:
  * near-Earth objects (q < 1.3 au) and objects beyond 5.4 au: the configured eta(alpha) relation of the NEATM fit
    (default Trilling et al. 2016, Warm Spitzer 3.6/4.5 um NEO fits, -0.30/+0.55 about eta0(alpha)).
  * main belt (incl. Mars-crossers), Hildas, Jupiter Trojans ("neowise_population"): the distribution of eta in
    NEOWISE fits with a free beaming parameter (Mainzer et al. 2019, PDS; about 70 000 main-belt fits from W3/W4
    data), as a function of size and phase angle:
        ln eta ~ N( mu_pop(log10 D) + b_pop (alpha - 20 deg) + ln f(alpha),  sigma_pop(log10 D)^2 + sigma_x^2 )
      - mu, sigma: median and 16-84% half-width of ln eta - b (alpha - 20) in bins of log10 D (WISE observed at
        solar elongation 88-97 deg, phase angles 16-30 deg for main-belt objects, like SPHEREx);
      - f(alpha) = eta_Trilling2016(alpha) / eta_Mainzer2011(alpha): eta from 3.6/4.5 um fits is ~12% higher than
        from 12/22 um fits of NEOs at the same phase angle (both relations configured; 1.12 at 20 deg);
      - sigma_x: additional scatter of eta between the NEOWISE wavelengths and SPHEREx 3.5-5 um fits, calibrated
        on the analysed targets so that thermal diameters scatter about catalogue diameters as their errors say
        (docs/METHODS.md section 3b). Metal-rich M-types (216 Kleopatra, NEOWISE eta 1.34) are why it is not 0.
    D enters through pV = (1329 10^(-H/5) / D)^2 in the posterior grid, so the prior is conditional on D.
The rows of the validation targets, of the classifier-injection set and of the analysed object are removed before
fitting, as for the population albedo prior.
"""
from __future__ import annotations

import hashlib
import json
import pickle
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ..common.config import settings

POPULATIONS = ("mainbelt", "hildas", "jupiter_trojans")
REFERENCE_PHASE_DEG = 20.0
DEFAULT_EDGES_KM = {"mainbelt": [0.5, 2, 3, 5, 7, 10, 14, 20, 30, 50, 100, 1000],
                    "hildas": [0.5, 5, 10, 20, 1000], "jupiter_trojans": [0.5, 10, 20, 50, 1000]}


def population_of(orbit: dict | None) -> str:
    """'neo' (q < 1.3 au), 'hildas' (3.7 <= a <= 4.2 au), 'jupiter_trojans' (5.0 <= a <= 5.4 au), 'outer' (a > 5.4 au),
    else 'mainbelt' (inner/outer main belt and Mars-crossers)."""
    if not orbit or orbit.get("a_au") is None:
        return "unknown"
    a, e = float(orbit["a_au"]), float(orbit.get("e") or 0.0)
    if a * (1 - e) < 1.3:
        return "neo"
    if 3.7 <= a <= 4.2:
        return "hildas"
    if 5.0 <= a <= 5.4:
        return "jupiter_trojans"
    if a > 5.4:
        return "outer"
    return "mainbelt"


def _relation(cfg: dict, name: str) -> dict:
    return cfg["eta_prior_relations"][name]


def wavelength_factor(alpha_deg: float, cfg: dict | None = None) -> float:
    """eta(3.5-5 um) / eta(12-22 um) from the two configured NEO relations at the same phase angle."""
    cfg = cfg or settings()["thermal_model"]
    p = _relation(cfg, "neowise_population")
    f = p.get("wavelength_factor", "relations")
    if isinstance(f, (int, float)):
        return float(f)
    num, den = (_relation(cfg, n) for n in p.get("wavelength_factor_relations", ["trilling2016", "mainzer2011"]))
    a = float(np.clip(alpha_deg, 0.0, 100.0))
    return float((num["intercept"] + num["slope_per_deg"] * a) / (den["intercept"] + den["slope_per_deg"] * a))


def fit_table(rows: pd.DataFrame, edges_km: dict | None = None) -> dict:
    """Binned eta distribution of NEOWISE fits (columns type, diameter, phase_deg, ln_eta) by population."""
    edges_km = edges_km or DEFAULT_EDGES_KM
    out = {}
    for pop in POPULATIONS:
        s = rows[rows["type"] == pop]
        if len(s) < 50:
            continue
        edges = np.asarray(edges_km[pop], float)
        b = np.digitize(s["diameter"].to_numpy(float), edges) - 1
        y = s["ln_eta"].to_numpy(float)
        al = s["phase_deg"].to_numpy(float)
        yc = y - pd.Series(y).groupby(b).transform("median").to_numpy()
        ac = al - pd.Series(al).groupby(b).transform("median").to_numpy()
        slope = float(np.sum(ac * yc) / np.sum(ac ** 2)) if np.sum(ac ** 2) > 0 else 0.0
        bins = []
        for k in range(len(edges) - 1):
            m = b == k
            if m.sum() < 30:
                continue
            yy = y[m] - slope * (al[m] - REFERENCE_PHASE_DEG)
            q16, q50, q84 = np.quantile(yy, [0.16, 0.5, 0.84])
            bins.append({"log10D": float(np.median(np.log10(s["diameter"].to_numpy(float)[m]))),
                         "D_range_km": [float(edges[k]), float(edges[k + 1])],
                         "median_ln_eta": float(q50), "sigma_ln": float((q84 - q16) / 2),
                         "median_fit_err_ln": float(np.median(s["ln_eta_err"].to_numpy(float)[m])), "n": int(m.sum())})
        out[pop] = {"phase_slope_per_deg": slope, "bins": bins, "n": int(len(s)),
                    "phase_deg_range": [float(np.quantile(al, 0.05)), float(np.quantile(al, 0.95))]}
    return out


_TABLE_CACHE: dict = {}


def eta_table(exclude: set | None = None, log=print) -> dict | None:
    """Prior table fitted without the excluded designations (standard exclusions are always removed). Cached in
    memory and on disk (data/raw/neowise/models/) by the exclusion set and the catalogue retrieval time."""
    from ..acquisition.neowise_catalogue import catalogue_dir, fitted_eta_table
    from ..acquisition.population_catalogue import standard_exclusions
    excl = sorted(standard_exclusions() | set(exclude or ()))
    try:
        cdir = catalogue_dir()
        geo_cache = cdir / "fitted_eta_geometry.pkl"
        prov_file = cdir / "fits.provenance.json"
        stamp = json.loads(prov_file.read_text()).get("retrieved_utc", "") if prov_file.exists() else ""
        key = hashlib.sha256(json.dumps([excl, stamp]).encode()).hexdigest()[:16]
        if key in _TABLE_CACHE:
            return _TABLE_CACHE[key]
        tab_cache = cdir / "models" / f"eta_prior_{key}.json"
        if tab_cache.exists():
            tab = json.loads(tab_cache.read_text())
            _TABLE_CACHE[key] = tab
            return tab
        if geo_cache.exists() and json.loads(geo_cache.with_suffix(".stamp").read_text()) == stamp:
            rows = pickle.loads(geo_cache.read_bytes())
        else:
            rows = fitted_eta_table(log=log)
            geo_cache.write_bytes(pickle.dumps(rows))
            geo_cache.with_suffix(".stamp").write_text(json.dumps(stamp))
        n0 = len(rows)
        rows = rows[~rows["pdes"].astype(str).isin(set(excl))]
        tab = {"populations": fit_table(rows), "n_fits": int(len(rows)), "n_removed": int(n0 - len(rows)),
               "excluded": excl, "catalogue_retrieved_utc": stamp, "reference_phase_deg": REFERENCE_PHASE_DEG,
               "source": "NEOWISE Diameters and Albedos V2.0 (Mainzer et al. 2019, PDS, doi:10.26033/18S3-2Z54), "
                         "fits with a free beaming parameter; phase angles from JPL SBDB elements"}
        tab_cache.parent.mkdir(parents=True, exist_ok=True)
        tab_cache.write_text(json.dumps(tab, indent=1))
        _TABLE_CACHE[key] = tab
        return tab
    except Exception as err:  # noqa: BLE001 - the fit falls back to the configured NEO relation
        log(f"  [eta prior] NEOWISE eta catalogue unavailable ({err}); the configured eta(alpha) relation is used.")
        return None


@dataclass
class EtaPrior:
    relation: str                   # neowise_population | <configured relation name>
    population: str
    alpha_deg: float
    reference: str
    factor: float = 1.0             # wavelength factor applied to the NEOWISE medians
    sigma_extra_ln: float = 0.0
    table: dict | None = None       # population entry of the NEOWISE table
    eta0: float | None = None       # configured relation: centre and asymmetric sigmas (linear eta)
    sigma_minus: float | None = None
    sigma_plus: float | None = None
    info: dict = field(default_factory=dict)

    def median_sigma(self, lgD) -> tuple[np.ndarray, np.ndarray]:
        """(median eta, sigma of ln eta) at log10 D (NEOWISE relation) - for description and tests."""
        lgD = np.atleast_1d(np.asarray(lgD, float))
        if self.table is None:
            s = 0.5 * (self.sigma_minus + self.sigma_plus) / self.eta0
            return np.full(lgD.shape, self.eta0), np.full(lgD.shape, s)
        x = np.array([b["log10D"] for b in self.table["bins"]])
        mu = np.array([b["median_ln_eta"] for b in self.table["bins"]])
        sg = np.array([b["sigma_ln"] for b in self.table["bins"]])
        m = np.interp(lgD, x, mu) + self.table["phase_slope_per_deg"] * (self.alpha_deg - REFERENCE_PHASE_DEG) \
            + np.log(self.factor)
        return np.exp(m), np.sqrt(np.interp(lgD, x, sg) ** 2 + self.sigma_extra_ln ** 2)

    def weights(self, etas, lgD) -> np.ndarray:
        """Prior weights on a log-spaced eta grid (rows) for each log10 D (columns); each column sums to 1."""
        etas = np.asarray(etas, float)
        lgD = np.atleast_1d(np.asarray(lgD, float))
        if self.table is None:
            s = np.where(etas < self.eta0, self.sigma_minus, self.sigma_plus)
            p = np.exp(-0.5 * ((etas - self.eta0) / s) ** 2) * etas     # density in eta on a ln-eta grid
            p = p / p.sum()
            return np.repeat(p[:, None], len(lgD), axis=1)
        med, sig = self.median_sigma(lgD)
        le = np.log(etas)[:, None]
        p = np.exp(-0.5 * ((le - np.log(med)[None, :]) / sig[None, :]) ** 2)
        return p / p.sum(axis=0, keepdims=True)

    def summary(self) -> dict:
        d = {"relation": self.relation, "population": self.population, "alpha_deg": self.alpha_deg,
             "reference": self.reference}
        if self.table is None:
            d.update({"eta0": self.eta0, "sigma_minus": self.sigma_minus, "sigma_plus": self.sigma_plus})
        else:
            lg = np.log10([10.0, 100.0])
            med, sig = self.median_sigma(lg)
            d.update({"wavelength_factor": self.factor, "sigma_extra_ln": self.sigma_extra_ln,
                      "phase_slope_per_deg": self.table["phase_slope_per_deg"],
                      "eta_at_10km": float(med[0]), "sigma_ln_at_10km": float(sig[0]),
                      "eta_at_100km": float(med[1]), "sigma_ln_at_100km": float(sig[1])})
        d.update(self.info)
        return d


def target_eta_prior(orbit: dict | None, alpha_deg: float, exclude: set | None = None, cfg: dict | None = None,
                     log=print) -> EtaPrior:
    """The eta prior for an analysed object (orbit from SBDB, median phase angle of its thermal points)."""
    cfg = cfg or settings()["thermal_model"]
    pop = population_of(orbit)
    name = cfg.get("eta_posterior_relation", "neowise_population")
    fallback = cfg.get("eta_prior_relation", "trilling2016")

    def configured(why: str) -> EtaPrior:
        r = _relation(cfg, fallback)
        e0 = float(r["intercept"] + r["slope_per_deg"] * alpha_deg)
        return EtaPrior(relation=fallback, population=pop, alpha_deg=float(alpha_deg), reference=r["reference"],
                        eta0=e0, sigma_minus=float(r["sigma_minus"]), sigma_plus=float(r["sigma_plus"]),
                        info={"why": why})

    if name != "neowise_population":
        return configured(f"eta_posterior_relation = {name}")
    if pop not in POPULATIONS:
        return configured(f"population '{pop}': no NEOWISE beaming distribution is used")
    tab = eta_table(exclude, log=log)
    if tab is None or pop not in tab["populations"]:
        return configured("NEOWISE eta catalogue unavailable")
    p = _relation(cfg, "neowise_population")
    return EtaPrior(relation="neowise_population", population=pop, alpha_deg=float(alpha_deg),
                    reference=p["reference"], factor=wavelength_factor(alpha_deg, cfg),
                    sigma_extra_ln=float(p.get("sigma_extra_ln", 0.0)), table=tab["populations"][pop],
                    info={"n_fits_population": tab["populations"][pop]["n"], "n_fits_removed": tab["n_removed"],
                          "catalogue_retrieved_utc": tab["catalogue_retrieved_utc"]})
