"""Stage 3: separation of reflected sunlight and thermal emission.

Model for every spectral point i (own geometry r_i, Delta_i, alpha_i):

    F_obs,i = F_ref,i + F_th,i
    F_ref,i = F_sun(lambda_i; 1 au) / r_i^2 * Phi_HG(alpha_i; G) * K(lambda_i) / Delta_i^2
    K(lambda) = p_lambda * R^2 = K0 * [1 + s (lambda - 2.0 um)]           [km^2]
    F_th,i  = NEATM(lambda_i; D, eta, r_i, Delta_i, alpha_i, A, eps)

  * K(lambda) is a linear reflectance continuum fitted on the 1.6-2.5 um window and
    extrapolated into the thermal region; the 2.5-3.5 um window (OH/H2O features) is
    excluded from the fit so absorption features do not bias the thermal solution.
  * A = q * pV (Bond albedo). If H is given, pV follows from H and D
    (pV = (1329 10^(-H/5) / D)^2), i.e. thermal and optical constraints are combined.
    If H is not given, no single (D, pV) solution is reported: the fit is repeated for a
    grid of assumed pV values and the resulting diameter range is returned as a
    CONDITIONAL result.
  * p_lambda at 2 um (from K0 / R^2) is an internal model parameter. It is NOT the
    geometric albedo pV and is stored under a separate name.
  * eta is fitted only when the thermal data constrain it (enough points, span and S/N);
    otherwise it is fixed and its prior uncertainty is propagated by re-fitting.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy.optimize import least_squares

from ..common import status
from ..common.config import model_version, settings
from ..common.provenance import Provenance
from ..physical.phase_function import PhaseLaw
from ..physical.thermal_model import neatm_flux_jy, subsolar_temperature
from .solar_spectrum import SolarSpectrum, load_solar_spectrum

LAMBDA_C = 2.0
AU_KM = 1.495978707e8


def pv_from_h_d(H, D_km, const=1329.0):
    return (const * 10 ** (-np.asarray(H) / 5.0) / np.asarray(D_km)) ** 2


@dataclass
class ThermalFitResult:
    status: str                                 # OK | INSUFFICIENT_THERMAL | INSUFFICIENT_DATA | FIT_FAILED
    D_km: float | None = None
    D_err_km: float | None = None
    D_err_eta_sys_km: float | None = None
    eta: float | None = None
    eta_err: float | None = None
    eta_fitted: bool = False
    T_ss_K: float | None = None
    T_ss_err_K: float | None = None
    bond_albedo_used: float | None = None
    H_used: float | None = None
    pV_assumed: float | None = None
    K0_km2: float | None = None
    slope_per_um: float | None = None
    ir_reflectance_2um_internal: float | None = None
    chi2_red: float | None = None
    n_fit_points: int = 0
    n_thermal_points: int = 0
    thermal_excess_snr: float | None = None
    covariance: list | None = None
    param_names: list = field(default_factory=list)
    conditional: list = field(default_factory=list)       # [{pV_assumed, D_km, D_err_km, chi2_red}]
    conditional_D_range_km: tuple | None = None
    rotation_period_h: float | None = None
    lightcurve_coeffs_mag: list = field(default_factory=list)
    lightcurve_amplitude_mag: float | None = None
    eta_prior: dict | None = None
    # thermal-excess test (non-detections): thermal-point geometry, weights w = 1/E^2 [Jy^-2], the statistic
    # X = sum w (F - F_ref) and its sigma (full covariance incl. the continuum extrapolation) - used for the
    # thermal likelihood of the statistical diameter (src/physical/statistical_diameter.py)
    thermal_test: dict | None = None
    points: pd.DataFrame | None = None                    # per-point components & residuals
    usable_range_um: tuple | None = None
    warnings: list = field(default_factory=list)
    provenance: dict | None = None

    def summary(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if k not in ("points", "provenance", "thermal_test")}
        return d


class ThermalSeparator:
    """rotation_period_h: if given (e.g. SBDB rot_per), a rotational lightcurve
    L(t) = sum_k a_k cos(2 pi k t/P) + b_k sin(2 pi k t/P)  [mag, zero mean]
    multiplies the whole model (reflected and thermal both scale with projected area).
    Points from different exposures sample different rotational phases; without this term an
    elongated body's lightcurve (up to ~1 mag) is aliased into spectral shape."""

    def __init__(self, solar: SolarSpectrum | None = None, cfg: dict | None = None,
                 rotation_period_h: float | None = None, lc_harmonics: int = 2):
        self.cfg = cfg or settings()["thermal_model"]
        self.solar = solar or load_solar_spectrum(self.cfg["solar_spectrum"])
        self.rotation_period_h = rotation_period_h
        self.lc_harmonics = lc_harmonics
        self.phase = PhaseLaw(G=self.cfg["default_G"])
        self.G = self.phase.G

    def eta_prior(self, alpha_deg: float) -> dict:
        """Literature eta(alpha) relation (config thermal_model.eta_prior_relations)."""
        name = self.cfg.get("eta_prior_relation", "trilling2016")
        r = self.cfg["eta_prior_relations"][name]
        eta0 = r["intercept"] + r["slope_per_deg"] * alpha_deg
        lo, hi = r.get("valid_phase_deg", [0, 180])
        return {"relation": name, "reference": r["reference"], "alpha_deg": float(alpha_deg),
                "eta0": float(eta0), "sigma_minus": float(r["sigma_minus"]), "sigma_plus": float(r["sigma_plus"]),
                "formula": f"eta = {r['intercept']} + {r['slope_per_deg']} * alpha[deg]",
                "in_valid_range": bool(lo <= alpha_deg <= hi), "population": r.get("population", "")}

    @staticmethod
    def lightcurve_factor(coeffs, rot_phase_rad):
        """10^(-0.4 L) for Fourier coefficients [a1, b1, a2, b2, ...]."""
        L = np.zeros_like(rot_phase_rad, dtype=float)
        for k in range(len(coeffs) // 2):
            L += coeffs[2 * k] * np.cos((k + 1) * rot_phase_rad) + coeffs[2 * k + 1] * np.sin((k + 1) * rot_phase_rad)
        return 10 ** (-0.4 * L)

    # -------------------------------------------------------------- model parts
    def reflected_scale(self, df):
        """S_i such that F_ref,i = S_i * K(lambda_i) [Jy, with K in km^2]."""
        fsun = self.solar.at(df["wavelength_um"].values,
                             bandwidth_um=df["bandwidth_um"].values if "bandwidth_um" in df else None)
        return fsun / df["r_au"].values ** 2 * self.phase.phi(df["phase_deg"].values) / \
            (df["delta_au"].values * AU_KM) ** 2

    def model(self, theta, df, S, H, pV_fixed, eta_fixed):
        K0, s, logD = theta[0], theta[1], theta[2]
        eta = theta[3] if eta_fixed is None else eta_fixed
        D = 10 ** logD
        lam = df["wavelength_um"].values
        refl = S * K0 * (1 + s * (lam - LAMBDA_C))
        pV = pv_from_h_d(H, D) if H is not None else pV_fixed
        A = min(self.phase.phase_integral() * pV, 0.99)
        th = neatm_flux_jy(lam, D, eta, df["r_au"].values, df["delta_au"].values,
                           df["phase_deg"].values, A, self.cfg["emissivity"],
                           self.cfg["integration_nodes"])
        return refl, th, A

    # ---------------------------------------------------------------- fitting
    def _fit_mask(self, lam):
        lo, hi = self.cfg["reflected_continuum_region_um"]
        m = ((lam >= lo) & (lam <= hi)) | (lam >= self.cfg["thermal_region_min_um"])
        for a, b in self.cfg["excluded_feature_regions_um"]:
            m &= ~((lam > a) & (lam < b))
        return m

    def fit(self, spectrum: pd.DataFrame, H: float | None = None, H_err: float | None = None,
            G: float | None = None, pV_assumed: float | None = None,
            _skip_conditional: bool = False, *, phase: PhaseLaw | None = None) -> ThermalFitResult:
        cfg = self.cfg
        self.phase = phase or PhaseLaw(G=cfg["default_G"] if G is None else G)
        self.G = self.phase.G
        prov = Provenance(step="thermal_separation", model_version=model_version("thermal_model"),
                          formula="F_obs = S(lambda) K0[1+s(lambda-2um)] + NEATM(D, eta, A=q pV)",
                          inputs={"H": H, "H_err": H_err, "G": self.G, "phase_function": self.phase.to_dict(), "n_points": len(spectrum)},
                          assumptions={"emissivity": cfg["emissivity"], "solar_spectrum": self.solar.name,
                                       "eta_mode": cfg.get("eta_mode", "fixed"),
                                       "continuum_window_um": cfg["reflected_continuum_region_um"],
                                       "thermal_min_um": cfg["thermal_region_min_um"],
                                       "excluded_regions_um": cfg["excluded_feature_regions_um"]})
        warnings = []
        if self.solar.is_approximation:
            warnings.append("Solar spectrum is a blackbody APPROXIMATION (sbpy/synphot E490 unavailable): "
                            "reflectance shape and thermal fit are biased by up to ~10-20%.")
        need = {"wavelength_um", "flux_uJy", "flux_err_uJy", "r_au", "delta_au", "phase_deg"}
        if not need.issubset(spectrum.columns) or spectrum[list(need)].isna().any().any():
            res = ThermalFitResult(status=status.INSUFFICIENT_DATA,
                                   warnings=["Spectrum lacks flux, error or per-point geometry (r, Delta, alpha)."])
            res.provenance = prov.to_dict()
            return res

        df = spectrum.sort_values("wavelength_um").reset_index(drop=True)
        lam = df["wavelength_um"].values
        F = df["flux_uJy"].values * 1e-6
        E = df["flux_err_uJy"].values * 1e-6
        S = self.reflected_scale(df)
        fit_mask = self._fit_mask(lam)
        cont = (lam >= cfg["reflected_continuum_region_um"][0]) & (lam <= cfg["reflected_continuum_region_um"][1])
        thermal = lam >= cfg["thermal_region_min_um"]
        use_prior = cfg.get("eta_mode", "fixed") == "phase_prior"
        prior = None
        if use_prior:
            alpha_ref = float(np.median(df["phase_deg"].values[thermal] if thermal.any() else df["phase_deg"].values))
            prior = self.eta_prior(alpha_ref)
            eta_ref = prior["eta0"]
            prov.assumptions["eta_prior"] = prior
            if not prior["in_valid_range"]:
                warnings.append(f"Phase angle {alpha_ref:.1f} deg outside the validity range of the eta(alpha) "
                                f"relation ({prior['relation']}).")
        else:
            eta_ref = cfg["eta_default"]
        if cont.sum() < 4:
            res = ThermalFitResult(status=status.INSUFFICIENT_DATA,
                                   warnings=["Fewer than 4 points in the reflected continuum window."])
            res.provenance = prov.to_dict()
            return res

        continuum_design = np.column_stack((np.ones(cont.sum()), lam[cont] - LAMBDA_C))
        if np.linalg.cond(continuum_design) >= 1 / np.sqrt(np.finfo(float).eps):
            res = ThermalFitResult(status=status.INSUFFICIENT_DATA,
                                   warnings=["Reflected continuum wavelengths do not span enough independent values to fit a slope."])
            res.provenance = prov.to_dict()
            return res

        # rotational lightcurve term (optional)
        P = self.rotation_period_h
        use_lc = bool(P) and "mjd" in df and df["mjd"].notna().all() and len(df) >= 20 and \
            (df["mjd"].max() - df["mjd"].min()) * 24 > P
        rot_phase = 2 * np.pi * (df["mjd"].values * 24.0 / P) if use_lc else None
        n_lc = 2 * self.lc_harmonics if use_lc else 0
        if P and not use_lc:
            warnings.append("Rotation period known but too few points / too short a time span to fit a "
                            "lightcurve; rotational variability is not modelled.")

        # 0) preliminary rotational lightcurve (eta fixed): the detection test below must run on
        #    rotation-corrected fluxes, otherwise lightcurve scatter swamps a real thermal excess.
        F_raw, E_raw = F, E
        lc0 = [0.0] * n_lc
        lcf = np.ones_like(F)
        if n_lc:
            eta_d = eta_ref
            pv_pre = pV_assumed if H is None else None

            def r_pre(th):
                refl_, th_, _ = self.model(th[:3], df, S, H, pv_pre if pv_pre is not None else 0.15, eta_d)
                return ((self.lightcurve_factor(th[3:], rot_phase) * (refl_ + th_) - F_raw) / E_raw)[fit_mask]

            yk = F_raw[cont] / S[cont]
            k0 = float(np.median(yk))
            starts = [[k0, 0.0, lg] + [0.0] * n_lc for lg in np.linspace(-1.5, 3.2, 24)]
            x_pre = min(starts, key=lambda x: np.sum(r_pre(np.array(x)) ** 2))
            try:
                sp = least_squares(r_pre, x_pre, bounds=([0, -5, -2] + [-2] * n_lc, [np.inf, 5, 3.7] + [2] * n_lc),
                                   x_scale="jac")
                lc0 = list(sp.x[3:])
                lcf = self.lightcurve_factor(sp.x[3:], rot_phase)
                F, E = F_raw / lcf, E_raw / lcf
            except Exception:  # noqa: BLE001
                warnings.append("Preliminary lightcurve fit failed; detection test uses uncorrected fluxes.")

        # 1) reflected continuum only (weighted linear fit of F/S = K0 + K0 s (lam-2))
        y, ey = F[cont] / S[cont], E[cont] / S[cont]
        Amat = np.vstack([np.ones(cont.sum()), lam[cont] - LAMBDA_C]).T / ey[:, None]
        if not np.isfinite(Amat).all() or np.linalg.cond(Amat) >= 1 / np.sqrt(np.finfo(float).eps):
            res = ThermalFitResult(status=status.INSUFFICIENT_DATA,
                                   warnings=["Weighted reflected continuum is rank deficient or too ill-conditioned to constrain its slope."])
            res.provenance = prov.to_dict()
            return res
        coef, *_ = np.linalg.lstsq(Amat, y / ey, rcond=None)
        # Unmodelled scatter (rotation, calibration) inflates the errors used for the thermal
        # detection test, so that scatter is never mistaken for a thermal excess.
        chi2_c = float(np.sum((y / ey - Amat @ coef) ** 2) / max(int(cont.sum()) - 2, 1))
        scatter_k = np.sqrt(max(chi2_c, 1.0))
        # Slope prior (thermal_model.continuum_slope_prior): the continuum is extrapolated from 1.6-2.5 um to
        # 3.5-5 um, so a slope that no asteroid has (35107, 2026-11-15: +1.32 /um from a scattered continuum,
        # against -0.10..+0.27 /um for all Bus-DeMeo class means) turned a thermal excess of ~90% of the flux
        # into "not detected". The prior acts on s = K1/K0, linearised at the weighted mean level.
        sp = cfg.get("continuum_slope_prior") or {}
        Ad, bd = Amat / scatter_k, (y / ey) / scatter_k
        if sp:
            k0r = float(np.sum(y / ey ** 2) / np.sum(1 / ey ** 2))
            row = np.array([[0.0, 1.0 / (abs(k0r) * float(sp["sigma_per_um"]))]])
            Ad = np.vstack([Ad, row])
            bd = np.append(bd, float(sp["mean_per_um"]) / float(sp["sigma_per_um"]) * np.sign(k0r))
        coef, *_ = np.linalg.lstsq(Ad, bd, rcond=None)
        cov_c = np.linalg.inv(Ad.T @ Ad)
        K0_0, K1_0 = coef
        if scatter_k > 1.5:
            warnings.append(f"Continuum scatter {scatter_k:.1f}x the measurement errors (rotation or "
                            "calibration); thermal detection test uses inflated errors.")
        # 2) thermal excess significance in the thermal window
        if thermal.sum() == 0:
            res = ThermalFitResult(status=status.INSUFFICIENT_DATA, n_thermal_points=0,
                                   warnings=[f"No data at lambda >= {cfg['thermal_region_min_um']} um; "
                                             "thermal emission cannot be constrained."])
            res.provenance = prov.to_dict()
            res.points = self._points_table(df, S * (K0_0 + K1_0 * (lam - LAMBDA_C)), np.zeros_like(F), F_raw, E_raw, lc=lcf)
            return res
        X = np.vstack([np.ones(thermal.sum()), lam[thermal] - LAMBDA_C]).T
        ref_ext = S[thermal] * (X @ coef)
        excess = F[thermal] - ref_ext
        # The extrapolated continuum error is common to all thermal points (shared coefficients),
        # so the significance uses the full covariance: Cov = diag(E^2) + (S X) C (S X)^T.
        SX = S[thermal][:, None] * X
        E_th = E[thermal] * scatter_k
        cov_e = np.diag(E_th ** 2) + SX @ cov_c @ SX.T
        w = 1 / E_th ** 2
        excess_snr = float(np.dot(w, excess) / np.sqrt(w @ cov_e @ w))
        n_th = int(thermal.sum())
        thermal_test = {"wavelength_um": lam[thermal].tolist(), "r_au": df["r_au"].values[thermal].tolist(),
                        "delta_au": df["delta_au"].values[thermal].tolist(),
                        "phase_deg": df["phase_deg"].values[thermal].tolist(), "weights": w.tolist(),
                        "excess_stat": float(np.dot(w, excess)), "excess_stat_sigma": float(np.sqrt(w @ cov_e @ w)),
                        "eta_prior": prior if prior is not None else {"eta0": eta_ref, "sigma_minus": cfg["eta_prior_sigma"],
                                                                      "sigma_plus": cfg["eta_prior_sigma"]}}
        if excess_snr < cfg["min_thermal_snr"]:
            res = ThermalFitResult(status="INSUFFICIENT_THERMAL", n_thermal_points=n_th,
                                   thermal_excess_snr=excess_snr, K0_km2=float(K0_0), thermal_test=thermal_test,
                                   slope_per_um=float(K1_0 / K0_0) if K0_0 else None,
                                   warnings=[f"Thermal excess S/N = {excess_snr:.1f} < {cfg['min_thermal_snr']}: "
                                             "no diameter is derived. Reflectance beyond ~3 um may include "
                                             "unmodelled thermal emission."])
            res.points = self._points_table(df, S * (K0_0 + K1_0 * (lam - LAMBDA_C)), np.zeros_like(F), F_raw, E_raw, lc=lcf)
            res.provenance = prov.to_dict()
            return res

        # 3) decide whether eta can be fitted
        span = float(lam[thermal].max() - lam[thermal].min())
        if use_prior:
            # eta is always a free parameter, constrained by the literature eta(alpha) prior: weak
            # thermal data leave eta near the prior, strong data can move it.
            fit_eta = True
            warnings.append(f"eta fitted with literature prior {prior['formula']} at alpha={prior['alpha_deg']:.1f} deg "
                            f"-> eta0={prior['eta0']:.2f} (-{prior['sigma_minus']}/+{prior['sigma_plus']}); "
                            f"{prior['reference'].split(',')[0]}.")
        else:
            fit_eta = (n_th >= cfg["fit_eta_min_thermal_points"] and span >= cfg["fit_eta_min_wavelength_span_um"]
                       and excess_snr >= 10)
        eta_fixed = None if fit_eta else eta_ref
        sig_lo = prior["sigma_minus"] if use_prior else cfg["eta_prior_sigma"]
        sig_hi = prior["sigma_plus"] if use_prior else cfg["eta_prior_sigma"]
        if not fit_eta:
            warnings.append(f"eta fixed at {eta_ref:.2f} (thermal data insufficient to fit eta: "
                            f"{n_th} points, span {span:.2f} um, S/N {excess_snr:.1f}); "
                            f"eta uncertainty -{sig_lo}/+{sig_hi} propagated to D.")
        if H is None and pV_assumed is None:
            # Unknown H: conditional results over the pV grid, no single solution.
            cond = []
            for pv in cfg["conditional_pV_grid"]:
                r = self.fit(spectrum, H=None, G=self.G, phase=self.phase, pV_assumed=pv, _skip_conditional=True)
                cond.append({"pV_assumed": pv, "D_km": r.D_km, "D_err_km": r.D_err_km,
                             "D_err_eta_sys_km": r.D_err_eta_sys_km, "chi2_red": r.chi2_red, "status": r.status})
            ok = [c for c in cond if c["D_km"]]
            res = ThermalFitResult(status="CONDITIONAL", n_thermal_points=n_th, thermal_excess_snr=excess_snr,
                                   conditional=cond, eta_fitted=fit_eta,
                                   warnings=warnings + ["H not available: diameter is reported only as a range "
                                                        "conditional on assumed pV; no albedo is derived."])
            if ok:
                Ds = [c["D_km"] for c in ok]
                res.usable_range_um = (float(lam.min()), float(lam.max()))
                res.D_km = None
                res.conditional_D_range_km = (float(min(Ds)), float(max(Ds)))
            # keep the mid-grid fit's components for plotting
            mid = self.fit(spectrum, H=None, G=self.G, phase=self.phase, pV_assumed=float(np.median(cfg["conditional_pV_grid"])),
                           _skip_conditional=True)
            res.points = mid.points
            res.provenance = prov.to_dict()
            return res

        # 4) initial diameter by 1-D grid search (raw fluxes; lightcurve refitted jointly)
        F, E = F_raw, E_raw
        pV_for_A = pV_assumed

        def n_phys(eta_fix):
            return 3 + (0 if eta_fix is not None else 1)

        def lc_of(theta, eta_fix):
            return self.lightcurve_factor(theta[n_phys(eta_fix):], rot_phase) if n_lc else 1.0

        n_data = int(fit_mask.sum())
        # Data-error scale: if the model leaves unexplained scatter (chi2_red > 1), the data errors are
        # rescaled so chi2_red = 1 before weighing them against the eta prior. The covariance already
        # does this; using the same weighting for the point estimate keeps prior and data consistent.
        err_scale = [1.0]

        slope_prior = cfg.get("continuum_slope_prior") or {}

        def resid(theta, eta_fix):
            refl, th, _ = self.model(theta, df, S, H, pV_for_A, eta_fix)
            r = ((lc_of(theta, eta_fix) * (refl + th) - F) / E)[fit_mask] / err_scale[0]
            if use_prior and eta_fix is None:
                d = theta[3] - eta_ref           # asymmetric Gaussian prior (quoted -/+ 1-sigma interval)
                r = np.append(r, d / (sig_hi if d > 0 else sig_lo))
            if slope_prior:                      # continuum slope prior, as in the detection test
                r = np.append(r, (theta[1] - float(slope_prior["mean_per_um"])) / float(slope_prior["sigma_per_um"]))
            return r

        best = (np.inf, None)
        for logD in np.linspace(-1.5, 3.2, 48):
            th0 = [K0_0, K1_0 / K0_0 if K0_0 else 0.0, logD] + ([eta_ref] if fit_eta else []) + list(lc0)
            c2 = np.sum(resid(th0, eta_fixed) ** 2)
            if c2 < best[0]:
                best = (c2, th0)
        x0 = np.array(best[1], float)
        lb = [0.0, -5.0, -2.0] + ([cfg["eta_bounds"][0]] if fit_eta else []) + [-2.0] * n_lc
        ub = [np.inf, 5.0, 3.7] + ([cfg["eta_bounds"][1]] if fit_eta else []) + [2.0] * n_lc
        x0 = np.clip(x0, np.array(lb) + 1e-9, np.array(ub) - 1e-9)
        try:
            sol = least_squares(resid, x0, args=(eta_fixed,), bounds=(lb, ub), x_scale="jac")
        except Exception as err:  # noqa: BLE001
            res = ThermalFitResult(status="FIT_FAILED", warnings=[f"Optimizer error: {err}"])
            res.provenance = prov.to_dict()
            return res
        if fit_eta and (abs(sol.x[3] - lb[3]) < 1e-4 or abs(sol.x[3] - ub[3]) < 1e-4):
            # D-eta degeneracy on the Wien side: a free eta ran to its bound. Fall back to a fixed
            # eta with the prior propagated, rather than reporting a bound-limited solution.
            warnings.append(f"Free eta reached its bound ({sol.x[3]:.2f}); D-eta degenerate for these data. "
                            f"Refitted with eta fixed at {eta_ref:.2f} and uncertainty -{sig_lo}/+{sig_hi} propagated.")
            fit_eta = False
            eta_fixed = eta_ref
            keep = [0, 1, 2] + list(range(4, len(sol.x)))
            lb, ub = [lb[i] for i in keep], [ub[i] for i in keep]
            x0 = np.clip(sol.x[keep], np.array(lb) + 1e-9, np.array(ub) - 1e-9)
            sol = least_squares(resid, x0, args=(eta_fixed,), bounds=(lb, ub), x_scale="jac")
        nfree = len(sol.x)
        n_prior_rows = (1 if (use_prior and fit_eta) else 0) + (1 if slope_prior else 0)
        dof = max(n_data + n_prior_rows - nfree, 1)
        chi2_red = float(np.sum(sol.fun[:n_data] ** 2) / dof)
        if use_prior and fit_eta and chi2_red > 1.5:
            for _ in range(3):                     # iterate scale <-> fit (converges in 2-3 steps)
                err_scale[0] = float(np.sqrt(chi2_red)) * err_scale[0]
                sol = least_squares(resid, sol.x, args=(eta_fixed,), bounds=(lb, ub), x_scale="jac")
                chi2_red = float(np.sum(sol.fun[:n_data] ** 2) / dof)
                if abs(chi2_red - 1.0) < 0.1:
                    break
            warnings.append(f"Data errors rescaled by {err_scale[0]:.1f}x (unexplained scatter) before "
                            "weighing against the eta prior.")
            chi2_red = chi2_red * err_scale[0] ** 2  # report chi2_red relative to the nominal errors
        try:
            # sol.jac already includes err_scale; inflate further only for any remaining misfit
            Jd = sol.jac[:n_data] / np.sqrt(max(chi2_red / err_scale[0] ** 2, 1.0))
            Jp = sol.jac[n_data:]
            cov = np.linalg.inv(Jd.T @ Jd + Jp.T @ Jp)
        except np.linalg.LinAlgError:
            cov = np.full((nfree, nfree), np.nan)
            warnings.append("Singular Jacobian: parameter uncertainties undefined (degenerate fit).")
        K0, s, logD = sol.x[:3]
        eta = sol.x[3] if fit_eta else eta_ref
        D = 10 ** logD
        D_err = float(D * np.log(10) * np.sqrt(cov[2, 2])) if np.isfinite(cov[2, 2]) else None
        eta_err = float(np.sqrt(cov[3, 3])) if fit_eta else None
        names = ["K0", "s", "log10D"] + (["eta"] if fit_eta else []) + \
            [f"{c}{k + 1}" for k in range(n_lc // 2) for c in ("a", "b")]
        for i, (v, a, b) in enumerate(zip(sol.x, lb, ub)):
            if np.isfinite(a) and abs(v - a) < 1e-6 or np.isfinite(b) and abs(v - b) < 1e-6:
                warnings.append(f"Parameter {names[i]} at its bound: result unreliable.")
        if chi2_red > cfg["chi2_red_warning"]:
            warnings.append(f"Poor fit: reduced chi^2 = {chi2_red:.2f} > {cfg['chi2_red_warning']}. "
                            "Model may not describe the data (rotation, calibration, contamination).")

        # systematic from the eta prior when eta is fixed
        D_sys = None
        if not fit_eta:
            Ds = []
            for e in (eta_ref - sig_lo, eta_ref + sig_hi):
                try:
                    s2 = least_squares(resid, sol.x, args=(max(e, 0.3),), bounds=(lb, ub), x_scale="jac")
                    Ds.append(10 ** s2.x[2])
                except Exception:  # noqa: BLE001
                    pass
            if len(Ds) == 2:
                D_sys = float(abs(Ds[1] - Ds[0]) / 2)

        refl, th, A = self.model(sol.x, df, S, H, pV_for_A, eta_fixed)
        lc = lc_of(sol.x, eta_fixed) * np.ones_like(F)
        lc_coeffs = sol.x[n_phys(eta_fixed):].tolist() if n_lc else []
        lc_amp = None
        if n_lc:
            grid = np.linspace(0, 2 * np.pi, 361)
            Lg = -2.5 * np.log10(self.lightcurve_factor(np.array(lc_coeffs), grid))
            lc_amp = float(Lg.max() - Lg.min())
        Tss = float(subsolar_temperature(np.median(df["r_au"]), eta, A, cfg["emissivity"]))
        rel_eta = (eta_err if eta_err else 0.5 * (sig_lo + sig_hi)) / eta
        Tss_err = float(Tss / 4 * rel_eta)
        # per-point thermal-model uncertainty from the covariance (numerical Jacobian)
        th_err = self._component_errors(sol.x, df, S, H, pV_for_A, eta_fixed, cov)
        pts = self._points_table(df, refl, th, F, E, th_err=th_err, fit_mask=fit_mask, lc=lc)
        res = ThermalFitResult(
            status="OK", D_km=float(D), D_err_km=D_err, D_err_eta_sys_km=D_sys, eta=float(eta), eta_err=eta_err,
            eta_fitted=fit_eta, T_ss_K=Tss, T_ss_err_K=Tss_err, bond_albedo_used=float(A), H_used=H,
            pV_assumed=pV_assumed, K0_km2=float(K0), slope_per_um=float(s),
            ir_reflectance_2um_internal=float(K0 / (D / 2) ** 2), chi2_red=chi2_red,
            n_fit_points=int(fit_mask.sum()), n_thermal_points=n_th, thermal_excess_snr=excess_snr,
            covariance=cov.tolist(), param_names=names,
            rotation_period_h=P if n_lc else None, lightcurve_coeffs_mag=lc_coeffs,
            lightcurve_amplitude_mag=lc_amp, eta_prior=prior,
            points=pts, usable_range_um=(float(lam.min()), float(lam.max())), warnings=warnings)
        if n_lc:
            res.warnings.append(f"Rotational lightcurve fitted (P = {P} h, {self.lc_harmonics} harmonics, "
                                f"peak-to-peak {lc_amp:.2f} mag); D refers to the rotation-averaged cross-section.")
        if H is not None:
            res.warnings.append("A = q pV with pV from H and D: thermal and optical constraints fitted jointly.")
        for wmsg in res.warnings:
            prov.warn(wmsg)
        res.provenance = prov.to_dict()
        return res

    def components(self, df: pd.DataFrame, fit: "ThermalFitResult") -> pd.DataFrame | None:
        """Evaluate a fitted model (reflected + thermal) at arbitrary points (e.g. points of other
        normalisation groups), returning the same per-point table as ThermalFitResult.points."""
        d = df.reset_index(drop=True)
        lam = d["wavelength_um"].values
        F = d["flux_uJy"].values * 1e-6
        E = d["flux_err_uJy"].values * 1e-6
        S = self.reflected_scale(d)
        if fit.K0_km2 is None:
            return None
        refl = S * fit.K0_km2 * (1 + (fit.slope_per_um or 0.0) * (lam - LAMBDA_C))
        th = np.zeros_like(F)
        th_err = np.zeros_like(F)
        if fit.status == "OK" and fit.D_km:
            th = neatm_flux_jy(lam, fit.D_km, fit.eta, d["r_au"].values, d["delta_au"].values, d["phase_deg"].values,
                               fit.bond_albedo_used, self.cfg["emissivity"], self.cfg["integration_nodes"])
            if fit.D_err_km:
                th_err = th * 2 * fit.D_err_km / fit.D_km     # D-dominated thermal uncertainty
        return self._points_table(d, refl, th, F, E, th_err=th_err, fit_mask=self._fit_mask(lam))

    def _component_errors(self, x, df, S, H, pv, eta_fixed, cov):
        if not np.all(np.isfinite(cov)):
            return np.full(len(df), np.nan)
        base = self.model(x, df, S, H, pv, eta_fixed)[1]
        J = np.zeros((len(df), len(x)))
        for j in range(len(x)):
            dx = np.zeros_like(x)
            dx[j] = 1e-4 * max(abs(x[j]), 1e-3)
            J[:, j] = (self.model(x + dx, df, S, H, pv, eta_fixed)[1] - base) / dx[j]
        return np.sqrt(np.einsum("ij,jk,ik->i", J, cov, J))

    def _points_table(self, df, refl, th, F, E, th_err=None, fit_mask=None, lc=None):
        out = df.copy()
        lc = np.ones_like(F) if lc is None else np.asarray(lc, float)
        te = th_err if th_err is not None else np.zeros_like(F)
        out["lightcurve_factor"] = lc
        out["model_reflected_uJy"] = lc * refl * 1e6
        out["model_thermal_uJy"] = lc * th * 1e6
        out["model_total_uJy"] = lc * (refl + th) * 1e6
        out["thermal_err_uJy"] = lc * te * 1e6
        out["residual_uJy"] = (F - lc * (refl + th)) * 1e6
        out["residual_sigma"] = (F - lc * (refl + th)) / E
        out["used_in_fit"] = fit_mask if fit_mask is not None else False
        # reflected-light flux, thermal removed and normalised to the rotation-averaged cross-section
        out["reflected_flux_uJy"] = (F / lc - th) * 1e6
        out["reflected_flux_err_uJy"] = np.hypot(E / lc, te) * 1e6
        return out


def reflectance_spectrum(points: pd.DataFrame, solar: SolarSpectrum, G: float | None = 0.15,
                         normalization_um: float | None = None, *, phase: PhaseLaw | None = None) -> pd.DataFrame:
    """Normalised reflectance R(lambda) = [F_obs - F_th] / S(lambda), divided by its value at
    the normalisation wavelength (interpolated from neighbours). Geometry is per point."""
    lam0 = normalization_um or settings()["reflectance"]["normalization_wavelength_um"]
    p = points.sort_values("wavelength_um").copy()
    sep = ThermalSeparator.__new__(ThermalSeparator)
    sep.solar = solar
    sep.phase = phase or PhaseLaw(G=0.15 if G is None else G)
    sep.G = sep.phase.G
    S = sep.reflected_scale(p)
    k = p["reflected_flux_uJy"].values * 1e-6 / S
    ke = p["reflected_flux_err_uJy"].values * 1e-6 / S
    lam = p["wavelength_um"].values
    near = np.abs(lam - lam0) < 0.05
    ok = np.isfinite(k) & np.isfinite(ke) & (ke > 0)
    if (near & ok).sum() >= 1:
        m = near & ok
        w = 1 / ke[m] ** 2
        norm = np.sum(w * k[m]) / np.sum(w)
        norm_err = 1 / np.sqrt(np.sum(w))
        how = f"Normalised at {lam0} um using {int(m.sum())} points"
    else:
        # No point close to lam0 (a subset of exposures can miss it): interpolate with a weighted linear
        # fit to the nearest points on both sides; never extrapolate.
        norm = None
        for half in (0.10, 0.15, 0.25):
            m = ok & (np.abs(lam - lam0) < half)
            if (lam[m] < lam0).any() and (lam[m] > lam0).any():
                A = np.vstack([np.ones(m.sum()), lam[m] - lam0]).T
                W = 1 / ke[m] ** 2
                cov = np.linalg.inv(A.T @ (A * W[:, None]))
                coef = cov @ (A.T @ (W * k[m]))
                norm, norm_err = float(coef[0]), float(np.sqrt(cov[0, 0]))
                how = (f"Normalised at {lam0} um by interpolation (weighted linear fit to {int(m.sum())} points "
                       f"within {half:.2f} um; none within 0.05 um)")
                break
        if norm is None or not np.isfinite(norm) or norm <= 0:
            p["reflectance"] = np.nan
            p["reflectance_err"] = np.nan
            p.attrs["normalization"] = f"No points on both sides of {lam0} um within 0.25 um: not normalised"
            return p
    p["reflectance"] = k / norm
    p["reflectance_err"] = np.abs(k / norm) * np.hypot(ke / np.abs(k), norm_err / norm)
    p.attrs["normalization"] = how
    return p
