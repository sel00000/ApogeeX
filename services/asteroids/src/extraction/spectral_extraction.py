"""Stage 2: forced PSF photometry of a moving object in SPHEREx L2 images.

For every exposure found in Stage 1:
  * download an IBE cutout centred on the predicted (SPHEREx-centred) position,
  * convert the predicted RA/Dec to pixels with the image WCS (TAN-SIP),
  * optionally re-centre within a small radius (PSF-weighted centroid),
  * fit  data = A * PSF(x - x0, y - y0) + 0  to background-subtracted pixels by weighted
    linear least squares (weights = 1 / VARIANCE), rejecting flagged pixels,
  * flux density F = A * Omega_pix  (MJy/sr * sr -> MJy -> uJy),
  * wavelength / bandwidth at the source position from the spectral WCS.
Each point keeps the source file, release, method choices and quality reasons.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..common import status
from ..common.config import cache_directory, settings
from ..common.constants import band_for_detector
from ..common.provenance import Provenance
from .background_subtraction import background_subtracted_image, estimate_background
from .fits_product import SpherexImage, read_spherex_image
from .psf import native_psf_stamp, select_psf
from .quality_filter import bad_pixel_mask, decode_flags, measurement_quality, warn_pixel_mask
from .wavelength_calibration import wavelength_at

MJY_TO_UJY = 1.0e12


@dataclass
class SpectralPoint:
    obs_id: str
    detector: int
    band: str
    mjd: float
    wavelength_um: float
    bandwidth_um: float
    flux_uJy: float
    flux_err_uJy: float
    snr: float
    quality_flag: str
    quality_reasons: str
    x_pix: float
    y_pix: float
    centroid_shift_pix: float
    measured_ra_deg: float
    measured_dec_deg: float
    background_MJy_sr: float
    zodi_model_MJy_sr: float | None
    psf_zone: int
    psf_fraction_in_stamp: float
    trail_length_pix: float
    wavelength_method: str
    source_file: str
    data_release: str
    chi2_red: float
    origin: str = status.ORIGIN_OBSERVED
    core_flags: str = ""          # FLAGS plane names set on any PSF-core pixel (model > 2% of peak)


def _weighted_amp_fit(data, var, model, use):
    w = 1.0 / var[use]
    m = model[use]
    d = data[use]
    denom = np.sum(w * m * m)
    if denom <= 0 or use.sum() < 3:
        return np.nan, np.nan, np.nan
    amp = np.sum(w * m * d) / denom
    amp_err = 1.0 / np.sqrt(denom)
    resid = d - amp * m
    chi2 = np.sum(w * resid ** 2) / max(use.sum() - 1, 1)
    return float(amp), float(amp_err), float(chi2)


def trail_vector_pix(img: SpherexImage, ra, dec, rate_ra_cosdec_arcsec_h, rate_dec_arcsec_h):
    """Pixel displacement (dx, dy) of the object over the exposure (MJD-BEG..MJD-END)."""
    if rate_ra_cosdec_arcsec_h is None or rate_dec_arcsec_h is None or \
            not np.isfinite(rate_ra_cosdec_arcsec_h) or not np.isfinite(rate_dec_arcsec_h):
        return 0.0, 0.0
    dt_h = (img.mjd_end - img.mjd_beg) * 24.0
    dra = rate_ra_cosdec_arcsec_h * dt_h / 3600.0 / np.cos(np.radians(dec))
    ddec = rate_dec_arcsec_h * dt_h / 3600.0
    p = img.wcs.all_world2pix([[ra - dra / 2, dec - ddec / 2], [ra + dra / 2, dec + ddec / 2]], 0)
    return float(p[1, 0] - p[0, 0]), float(p[1, 1] - p[0, 1])


def forced_psf_photometry(img: SpherexImage, ra: float, dec: float, recentre: bool = True,
                          rate_arcsec_h: float | None = None, data_release: str = "",
                          rate_ra_arcsec_h: float | None = None,
                          rate_dec_arcsec_h: float | None = None) -> SpectralPoint:
    cfg = settings()["extraction"]
    size = int(cfg["psf_stamp_pix"])
    half = size // 2
    x0, y0 = (float(v) for v in img.wcs.all_world2pix([[ra, dec]], 0)[0])
    bad_bkg = bad_pixel_mask(img)                                  # full reject list (background)
    bad = bad_pixel_mask(img, for_moving_target_core=True)         # PSF stamp: ignore self-raised flags
    warn = warn_pixel_mask(img)
    bkg = estimate_background(img, x0, y0, bad_bkg)
    tvx, tvy = trail_vector_pix(img, ra, dec, rate_ra_arcsec_h, rate_dec_arcsec_h)
    if rate_arcsec_h is None and rate_ra_arcsec_h is not None:
        rate_arcsec_h = float(np.hypot(rate_ra_arcsec_h, rate_dec_arcsec_h))
    trail_len = float(np.hypot(tvx, tvy))
    # Uniform motion during the exposure: midpoint samples every <= 0.1 px. (Endpoint-inclusive
    # sampling over-weights the trail ends and biases bright-source fits.)
    n_tr = int(np.ceil(trail_len / 0.1))
    trail_steps = (np.arange(n_tr) + 0.5) / n_tr - 0.5 if trail_len > 0.05 else np.array([0.0])
    data = background_subtracted_image(img, bkg)
    var = img.variance.copy()
    if np.isfinite(bkg.error):
        var = var + bkg.error ** 2

    ox, oy = img.active_pixel_offset()
    psf_os, ovs, zone = select_psf(img, x0 + ox, y0 + oy)

    def fit_at(xc, yc):
        ix, iy = int(round(xc)), int(round(yc))
        dx, dy = xc - ix, yc - iy
        y_lo, x_lo = iy - half, ix - half
        if y_lo < 0 or x_lo < 0 or iy + half >= data.shape[0] or ix + half >= data.shape[1]:
            return None
        sl = (slice(y_lo, y_lo + size), slice(x_lo, x_lo + size))
        # PSF averaged along the trail during the exposure (moving-object PSF)
        model = np.mean([native_psf_stamp(psf_os, ovs, dx + s * tvx, dy + s * tvy, size)
                         for s in trail_steps], axis=0)
        use = ~bad[sl] & np.isfinite(data[sl]) & np.isfinite(var[sl]) & (var[sl] > 0)
        amp, err, chi2 = _weighted_amp_fit(data[sl], var[sl], model, use)
        core = model > 0.02 * model.max()
        bits = int(np.bitwise_or.reduce(img.flags[sl][core].ravel())) if core.any() else 0
        return dict(amp=amp, err=err, chi2=chi2, sl=sl, model=model, core_bits=bits,
                    n_bad=int((bad[sl] & core).sum()), n_warn=int((warn[sl] & core & ~bad[sl]).sum()))

    xc, yc = x0, y0
    best = fit_at(xc, yc)
    if recentre and best is not None and np.isfinite(best["amp"]) and best["amp"] > 0:
        # local grid search (0.25-pixel steps) maximising the fitted amplitude S/N
        r = cfg["centroid_search_radius_pix"]
        grid = np.arange(-r, r + 1e-9, 0.25)
        best_snr = best["amp"] / best["err"]
        for gy in grid:
            for gx in grid:
                if gx * gx + gy * gy > r * r:
                    continue
                f = fit_at(x0 + gx, y0 + gy)
                if f is None or not np.isfinite(f["amp"]):
                    continue
                s = f["amp"] / f["err"]
                if s > best_snr:
                    best, best_snr, xc, yc = f, s, x0 + gx, y0 + gy
        if best_snr < settings()["search"]["min_detection_snr"]:
            # no significant detection: keep forced photometry at the predicted position
            xc, yc = x0, y0
            best = fit_at(x0, y0)

    omega = img.pixel_solid_angle_sr
    exp_h = (img.mjd_end - img.mjd_beg) * 24.0
    pix_scale = float(img.header.get("PXSCAL1", 6.15)) if "PXSCAL1" in img.header else \
        float(np.sqrt(img.pixel_solid_angle_sr) * 180 / np.pi * 3600)
    trail = (rate_arcsec_h or 0.0) * exp_h / pix_scale
    core_flags = ""
    if best is None:
        amp = err = chi2 = np.nan
        n_bad = n_warn = 0
        frac = np.nan
        fit_ok = False
    else:
        amp, err, chi2 = best["amp"], best["err"], best["chi2"]
        n_bad, n_warn = best["n_bad"], best["n_warn"]
        core_flags = "|".join(sorted(decode_flags(best["core_bits"], img.flag_planes)))
        frac = float(best["model"].sum())
        fit_ok = bool(np.isfinite(amp))
        # Inflate the error by sqrt(chi2_red) when the PSF model under-fits (e.g. trailing).
        if np.isfinite(chi2) and chi2 > 1:
            err *= np.sqrt(chi2)
    flux = amp * omega * MJY_TO_UJY
    flux_err = err * omega * MJY_TO_UJY
    snr = flux / flux_err if flux_err and np.isfinite(flux_err) and flux_err > 0 else np.nan
    # Trailing is modelled in the PSF, so it only counts against quality if the fit is still poor.
    trailed_unmodelled = trail > cfg["trail_warning_pix"] and (len(trail_steps) == 1 or
                                                               (np.isfinite(chi2) and chi2 > 10))
    q, reasons = measurement_quality(n_bad, n_warn, snr, fit_ok, trailed_unmodelled)
    sat = sorted(set(core_flags.split("|")) & set(cfg.get("saturation_flags", [])))
    if sat:
        reasons.append(f"saturated PSF core ({'/'.join(sat)}): flux from the unsaturated PSF wings")
        if cfg.get("saturated_core_policy", "warn") == "bad":
            q = status.Q_BAD
    if len(trail_steps) > 1:
        reasons.append(f"trailed PSF model used ({np.hypot(tvx, tvy):.2f} px)")
    wl = wavelength_at(img, xc, yc)
    if wl.method != "OFFICIAL":
        reasons.append("wavelength from approximate WCS-WAVE lookup")
    mra, mdec = (float(v) for v in img.wcs.all_pix2world([[xc, yc]], 0)[0])
    return SpectralPoint(
        obs_id=img.obs_id, detector=img.detector, band=band_for_detector(img.detector),
        mjd=img.mjd_avg, wavelength_um=wl.wavelength_um, bandwidth_um=wl.bandwidth_um,
        flux_uJy=flux, flux_err_uJy=flux_err, snr=snr, quality_flag=q,
        quality_reasons="; ".join(reasons), x_pix=xc, y_pix=yc,
        centroid_shift_pix=float(np.hypot(xc - x0, yc - y0)), measured_ra_deg=mra,
        measured_dec_deg=mdec, background_MJy_sr=bkg.level, zodi_model_MJy_sr=bkg.zodi_at_target,
        psf_zone=zone["zone_index"], psf_fraction_in_stamp=frac, trail_length_pix=trail,
        wavelength_method=wl.method, source_file=img.path.name, data_release=data_release,
        chi2_red=chi2, core_flags=core_flags)


def select_exposures(observations: pd.DataFrame, max_images: int | None, season_gap_days: float | None = None) -> pd.DataFrame:
    """The rows to process. All of them when max_images is None or not smaller than the table. Otherwise the cap is
    shared among the observing seasons (runs of exposures separated by less than season_gap_days) in proportion to
    their size, and each season contributes its earliest exposures, so that visits stay complete for the brightness
    analysis. Until 2026-11-15 the first max_images rows were taken: almost always one season only, while the others,
    often closer to the Sun and brighter in the thermal range, were never used (236 Honoria: 203 exposures at
    r = 2.36 au left out, r = 2.95 au used)."""
    if max_images is None or len(observations) <= int(max_images):
        return observations
    n = int(max_images)
    tcol = next((c for c in ("mjd_mid", "mjd_start", "mjd") if c in observations), None)
    if tcol is None:
        return observations.head(n)
    gap = float(season_gap_days if season_gap_days is not None else settings()["temporal"].get("season_gap_days", 30.0))
    t = observations[tcol].to_numpy(float)
    order = np.argsort(t, kind="stable")
    season = np.empty(len(t), int)
    season[order] = np.concatenate([[0], np.cumsum(np.diff(t[order]) > gap)])
    sizes = np.bincount(season)
    raw = n * sizes / sizes.sum()
    quota = np.floor(raw).astype(int)
    for k in np.argsort(-(raw - quota))[: n - quota.sum()]:
        quota[k] += 1
    keep = np.zeros(len(t), bool)
    for s_id in range(len(sizes)):
        idx = order[season[order] == s_id][: quota[s_id]]
        keep[idx] = True
    return observations[keep]


def extract_spectrum(observations: pd.DataFrame, cache_dir: str | None = None,
                     max_images: int | None = None, progress=None) -> tuple[pd.DataFrame, Provenance]:
    """Run forced photometry on every observation row from Stage 1. Rows need image_url,
    pred_ra_deg, pred_dec_deg, and optionally rate_ra/dec, r_au, delta_au, phase_deg."""
    from ..acquisition.irsa_client import IrsaClient

    cache_dir = cache_dir or str(cache_directory("spherex_cutouts"))
    cfg = settings()["extraction"]
    prov = Provenance(step="spectral_extraction", model_version=settings()["project"]["model_version"],
                      assumptions={k: cfg[k] for k in ("cutout_size_pix", "psf_stamp_pix", "background_method",
                                                       "reject_flags", "warn_flags")},
                      formula="F[uJy] = A[MJy/sr] * Omega_pix[sr] * 1e12, A from weighted LSQ PSF fit")
    irsa = IrsaClient()
    rows = []
    obs = select_exposures(observations.assign(image_rank=np.arange(len(observations))), max_images)
    # Prefetch cutouts concurrently (bounded, polite to the archive); photometry below then reads the
    # cached files. Failures here are retried by the per-row download and recorded there.
    workers = int(cfg.get("download_workers", 1))
    if workers > 1 and len(obs) > 1:
        from concurrent.futures import ThreadPoolExecutor

        def _fetch(r):
            try:
                irsa.download_cutout(r.image_url, r.pred_ra_deg, r.pred_dec_deg, cfg["cutout_size_pix"], cache_dir)
            except Exception:  # noqa: BLE001
                pass

        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(_fetch, list(obs.itertuples())))
    for k, r in enumerate(obs.itertuples()):
        if progress:
            progress(k, len(obs))
        try:
            path, src = irsa.download_cutout(r.image_url, r.pred_ra_deg, r.pred_dec_deg,
                                             cfg["cutout_size_pix"], cache_dir)
            prov.add_source(src)
            img = read_spherex_image(path)
            rra = getattr(r, "rate_ra_arcsec_h", None)
            rdec = getattr(r, "rate_dec_arcsec_h", None)
            pt = forced_psf_photometry(img, r.pred_ra_deg, r.pred_dec_deg, data_release=src.version,
                                       rate_ra_arcsec_h=rra, rate_dec_arcsec_h=rdec)
            row = asdict(pt)
            for c in ("r_au", "delta_au", "phase_deg", "pred_ra_deg", "pred_dec_deg"):
                row[c] = getattr(r, c, np.nan)
            row["position_offset_arcsec"] = float(np.hypot(
                (pt.measured_ra_deg - r.pred_ra_deg) * np.cos(np.radians(r.pred_dec_deg)),
                pt.measured_dec_deg - r.pred_dec_deg) * 3600)
            # position of the image in the stage-1 table (time order; the classification takes the first ones)
            row["image_rank"] = int(getattr(r, "image_rank", k))
            rows.append(row)
            img.hdul.close()
        except Exception as err:  # keep going; record the failure
            prov.warn(f"{getattr(r, 'obs_id', '?')} D{getattr(r, 'detector', '?')}: extraction failed: {err}")
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values("wavelength_um").reset_index(drop=True)
    return df, prov


def save_spectrum(df: pd.DataFrame, path: str | Path, fmt: str = "csv") -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "fits":
        from astropy.table import Table
        t = Table.from_pandas(df)
        t.meta["ORIGIN"] = str(df["origin"].iloc[0]) if "origin" in df and len(df) else ""
        t.write(path, overwrite=True)
    else:
        df.to_csv(path, index=False)
    return path
