#!/usr/bin/env python3
"""Bake static data for the Planet X x SPHEREx demo.

For each target: catalog astrometry -> SPHEREx exposure search (IRSA TAP) ->
IBE cutouts -> reprojection onto one north-up TAN grid -> per-visit frames
(PNG) -> per-epoch geometry (astropy, float64) -> public/data/<id>/meta.json.

Usage:
    .venv/bin/python scripts/bake.py barnard
    .venv/bin/python scripts/bake.py --all
Nothing here substitutes sample data: any failure is recorded as a status.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import gzip
import hashlib
import io
import json
import shutil
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import astropy.units as u
import pyvo
import requests
from astropy.coordinates import (ICRS, CartesianRepresentation, SkyCoord,
                                 get_body_barycentric)
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS, FITSFixedWarning
from PIL import Image
from reproject import reproject_interp
from runtime import PROJECT_ROOT, DATA_DIR, CACHE_DIR
from photometry import native_photometry
import logging
import warnings

warnings.simplefilter("ignore", FITSFixedWarning)
logging.getLogger("astropy").setLevel(logging.WARNING)  # SIP INFO from the WCS-WAVE (key W) lookup, where sip is disabled

ROOT = PROJECT_ROOT
OUT = DATA_DIR
CACHE = CACHE_DIR

TAP_URL = "https://irsa.ipac.caltech.edu/TAP"
IBE_ROOT = "https://irsa.ipac.caltech.edu/"
# spherex_qr2* no longer exist on IRSA (superseded by dr1); cal collections excluded.
COLLECTIONS = ["spherex_dr1", "spherex_dr1_deep", "spherex_qr3", "spherex_qr3_deep"]
PIX_ARCSEC = 6.15
MAX_CONCURRENT = 3

# Real defects only. SOURCE (label) and artifact/quality-only planes are kept.
# Pixel-intrinsic defects are always masked. Signal-related flags are masked only
# off known sources: on a bright star (Barnard, R Dra) they fire on the PSF wings as
# a side effect of saturation while the values stay continuous with the PSF; truly
# saturated pixels are already NaN in the L2 image. OVERFLOW/NONLINEAR not masked.
MASK_ALWAYS = ["NONFUNC", "MISSING_DATA", "HOT", "COLD"]
MASK_OFF_SOURCE = ["TRANSIENT", "SUR_ERROR", "OUTLIER", "PERSIST"]
MASK_BITS = MASK_ALWAYS + MASK_OFF_SOURCE
CENTROID_FLOOR_PX = 0.1  # systematic floor: undersampled PSF + bilinear reprojection

LUHMAN_ESPLIN_2016 = "Luhman & Esplin 2016, AJ 152, 78"


@dataclass
class TargetCfg:
    id: str
    display_name: str
    simbad: str
    gaia: bool = True
    literature: dict | None = None
    notes: list[str] = field(default_factory=list)
    # Restrict frames + measurements to these detectors (None = all six)
    detectors: list[int] | None = None
    detectors_reason: str | None = None
    # Deep-field targets (thousands of exposures): visit length cap, spacing, exposures per visit
    visit_max_span_days: float | None = None
    min_visit_spacing_days: float | None = None
    max_exp_per_visit: int | None = None
    extra_warnings: list[str] = field(default_factory=list)


TARGETS = {
    "barnard": TargetCfg("barnard", "Barnard's Star", "Barnard's star"),
    "eps_indi_b": TargetCfg("eps_indi_b", "Epsilon Indi B", "eps Ind B"),
    "wise0855": TargetCfg(
        "wise0855", "WISE 0855-0714", "WISEA J085510.74-071442.5", gaia=False,
        literature=dict(parallax_mas=439.0, parallax_err_mas=2.4,
                        pmra=-8123.7, pmra_err=1.3, pmdec=673.2, pmdec_err=1.3),
        # Measured with all detectors, the D1-D4 centroids sit 1.2-1.8 px W/N of the
        # prediction (a neighbouring star dominates < 3.8 um); D5 agrees to ~0.5 px.
        detectors=[5, 6],
        detectors_reason="짧은 파장(D1–D4)은 근처 별 빛이 지배해 중심이 1.2–1.8 px 끌려감 → "
                         "WISE 0855가 밝은 D5–D6(3.8–5.0 µm)만 사용"),
    "rw_aur": TargetCfg("rw_aur", "RW Aurigae", "RW Aur"),
    # Near the north ecliptic pole (SPHEREx deep field): observed almost daily, ~2,500 exposures.
    # A 2-day gap alone chains up to 23 days into one "visit", so cap the span, keep one visit
    # per week (it is a control target that does not move) and at most 8 exposures per visit.
    "r_dra": TargetCfg("r_dra", "R Draconis", "R Dra",
                       visit_max_span_days=2.0, min_visit_spacing_days=7.0, max_exp_per_visit=8,
                       extra_warnings=["미라형 변광성: 크고 밝기가 변하는 표면 때문에 Gaia 시차가 불확실함"]),
}


def log(*a):
    print(*a, flush=True)


def code_version() -> str:
    return "bake.py sha256:" + hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]


TAP_HTTP_TIMEOUT = (10, 180)  # connect / network read seconds, not a total bake deadline


class TapSession(requests.Session):
    def request(self, method, url, **kwargs):
        if kwargs.get("timeout") is None:
            kwargs["timeout"] = TAP_HTTP_TIMEOUT
        return super().request(method, url, **kwargs)


def tap() -> pyvo.dal.TAPService:
    # Public PyVO session parameter: https://pyvo.readthedocs.io/en/latest/api/pyvo.dal.TAPService.html
    return pyvo.dal.TAPService(TAP_URL, session=TapSession())


# ---------------------------------------------------------------- astrometry

# Same SIMBAD database; the Harvard mirror is used only when CDS is unreachable.
SIMBAD_SERVERS = ["simbad.cds.unistra.fr", "simbad.harvard.edu"]


def simbad_lookup(name: str) -> dict:
    from astroquery.simbad import Simbad, conf
    errors = []
    for server in SIMBAD_SERVERS:
        conf.server = server
        try:
            s = Simbad()
            s.add_votable_fields("pmra", "pmdec", "plx_value", "rvz_radvel")
            r = s.query_object(name)
        except Exception as e:
            errors.append(f"{server}: {type(e).__name__}")
            continue
        if r is None or len(r) == 0:
            raise RuntimeError(f"SIMBAD ({server}): '{name}' not found")
        row = r[0]
        def f(k):
            v = row[k]
            return None if np.ma.is_masked(v) else float(v)
        return dict(main_id=str(row["main_id"]), ra=f("ra"), dec=f("dec"), pmra=f("pmra"),
                    pmdec=f("pmdec"), plx=f("plx_value"), rv=f("rvz_radvel"), server=server)
    raise RuntimeError(f"SIMBAD unreachable ({'; '.join(errors)})")


def gaia_astrometry(cfg: TargetCfg) -> dict:
    sb = simbad_lookup(cfg.simbad)
    # SIMBAD positions are ICRS at epoch J2000; move to Gaia DR3 epoch 2016.0
    dyr = 16.0
    ra16 = sb["ra"] + (sb["pmra"] or 0) / 3.6e6 * dyr / np.cos(np.radians(sb["dec"]))
    dec16 = sb["dec"] + (sb["pmdec"] or 0) / 3.6e6 * dyr
    radius = 5.0 / 3600
    q = f"""select source_id, ra, dec, parallax, parallax_error, pmra, pmdec,
                   radial_velocity, ruwe, ref_epoch, phot_g_mean_mag
            from gaia_dr3_source
            where CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra16}, {dec16}, {radius}))=1"""
    t = tap().search(q).to_table()
    if len(t) == 0:
        raise RuntimeError(f"Gaia DR3: no source within 5\" of SIMBAD position propagated to 2016.0")
    sep = np.hypot((np.asarray(t["ra"]) - ra16) * np.cos(np.radians(dec16)),
                   np.asarray(t["dec"]) - dec16) * 3600
    # Among candidates, prefer the one whose proper motion matches SIMBAD's
    pm_d = np.hypot(np.ma.filled(t["pmra"], np.nan) - (sb["pmra"] or 0),
                    np.ma.filled(t["pmdec"], np.nan) - (sb["pmdec"] or 0))
    score = sep + np.nan_to_num(pm_d, nan=1e6) / 100.0
    i = int(np.argmin(score))
    row = t[i]
    cands = [dict(source_id=int(t["source_id"][k]), sep_arcsec=round(float(sep[k]), 3),
                  g=None if np.ma.is_masked(t["phot_g_mean_mag"][k]) else round(float(t["phot_g_mean_mag"][k]), 3))
             for k in np.argsort(sep)]
    def f(k):
        v = row[k]
        return None if np.ma.is_masked(v) else float(v)
    warnings_ = []
    ruwe = f("ruwe")
    if ruwe is not None and ruwe > 1.4:
        warnings_.append(f"Gaia 측정 신뢰도 낮음 (RUWE {ruwe:.2f} > 1.4)")
    if f("radial_velocity") is None:
        warnings_.append("시선속도 미상 (Gaia RV 없음) — 3D 계산은 0 km/s로 가정")
    if f("parallax") is None or f("pmra") is None:
        raise RuntimeError(f"Gaia DR3 {int(row['source_id'])}: no 5-parameter astrometry")
    return dict(
        ra=f("ra"), dec=f("dec"), parallax_mas=f("parallax"), parallax_err_mas=f("parallax_error"),
        pmra=f("pmra"), pmdec=f("pmdec"), rv_kms=f("radial_velocity"), ruwe=ruwe,
        ref_epoch=f("ref_epoch"), source=f"Gaia DR3 {int(row['source_id'])}",
        selection_note=(f"SIMBAD [{sb['server']}] '{sb['main_id']}' J2000 → 2016.0 by SIMBAD pm; "
                        f"nearest Gaia DR3 source with consistent pm within 5\" "
                        f"(sep {sep[i]:.2f}\"); candidates: {cands}"),
        warnings=warnings_)


def literature_astrometry(cfg: TargetCfg) -> dict:
    sb = simbad_lookup(cfg.simbad)
    lit = cfg.literature
    # SIMBAD gives the ICRS position at epoch J2000 for this object; combined with the
    # literature parallax and proper motion it is propagated like a Gaia entry.
    return dict(
        ra=sb["ra"], dec=sb["dec"], parallax_mas=lit["parallax_mas"],
        parallax_err_mas=lit["parallax_err_mas"], pmra=lit["pmra"], pmdec=lit["pmdec"],
        rv_kms=None, ruwe=None, ref_epoch=2000.0, source=LUHMAN_ESPLIN_2016,
        selection_note=(f"Not in Gaia DR3 (extremely faint in the optical). Position: SIMBAD [{sb['server']}] "
                        f"'{sb['main_id']}' (ICRS, epoch J2000). Parallax/pm: {LUHMAN_ESPLIN_2016}."),
        warnings=["시선속도 미상 — 3D 계산은 0 km/s로 가정", "Gaia에 없음: 문헌값 사용"])


def astrometry_for(cfg: TargetCfg) -> dict:
    return gaia_astrometry(cfg) if cfg.gaia else literature_astrometry(cfg)


def ref_time(ast: dict) -> Time:
    # Gaia DR3 reference epoch is J2016.0 in TCB; literature epochs taken as TDB.
    return Time(ast["ref_epoch"], format="jyear", scale="tcb" if ast["source"].startswith("Gaia") else "tdb")


def star_coord(ast: dict) -> SkyCoord:
    return SkyCoord(ra=ast["ra"] * u.deg, dec=ast["dec"] * u.deg,
                    distance=(1000.0 / ast["parallax_mas"]) * u.pc,
                    pm_ra_cosdec=ast["pmra"] * u.mas / u.yr, pm_dec=ast["pmdec"] * u.mas / u.yr,
                    radial_velocity=(ast["rv_kms"] or 0.0) * u.km / u.s,
                    frame="icrs", obstime=ref_time(ast))


def target_bary_au(star: SkyCoord, t: Time) -> np.ndarray:
    """Barycentric ICRS position of the target at t (AU), shape (3,) or (3, n)."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # ERFA 'dubious year' etc.
        moved = star.apply_space_motion(new_obstime=t)
    return moved.cartesian.xyz.to_value(u.au)


def earth_bary_au(t: Time) -> np.ndarray:
    return get_body_barycentric("earth", t).xyz.to_value(u.au)


def apparent_radec(target_au: np.ndarray, earth_au: np.ndarray) -> tuple[float, float]:
    """Direction from Earth to target (astrometric: no aberration, as SPHEREx WCS is tied to Gaia)."""
    v = np.asarray(target_au, float) - np.asarray(earth_au, float)
    c = SkyCoord(CartesianRepresentation(*v, unit=u.au), frame=ICRS())
    return float(c.ra.deg), float(c.dec.deg)


# ------------------------------------------------------------ SPHEREx search

def search_exposures(ra: float, dec: float, collections: list[str]) -> list[dict]:
    s = tap()
    coll = ",".join(f"'{c}'" for c in collections)
    q = f"""select obs_id, obs_collection, obs_publisher_did, t_min, t_max, energy_bandpassname,
                   em_min, em_max
            from spherex.obscore
            where CONTAINS(POINT('ICRS', {ra}, {dec}), s_region)=1
              and obs_collection in ({coll})"""
    t = s.search(q).to_table()
    rows = [{k: (v.item() if hasattr(v, "item") else v) for k, v in zip(t.colnames, r)} for r in t]
    if not rows:
        return []
    # Separate queries: joining inside a CONTAINS query fails on IRSA.
    dids = [r["obs_publisher_did"] for r in rows]
    plane_of: dict[str, str] = {}
    for i in range(0, len(dids), 200):
        chunk = ",".join(f"'{d}'" for d in dids[i:i + 200])
        p = s.search(f"select planeid, obs_publisher_did from spherex.plane "
                     f"where obs_publisher_did in ({chunk})").to_table()
        plane_of.update({str(a): str(b) for b, a in zip(p["planeid"], p["obs_publisher_did"])})
    pids = list(set(plane_of.values()))
    uri_of: dict[str, str] = {}
    for i in range(0, len(pids), 200):
        chunk = ",".join(f"'{d}'" for d in pids[i:i + 200])
        a = s.search(f"select planeid, uri from spherex.artifact "
                     f"where planeid in ({chunk}) and producttype='science'").to_table()
        uri_of.update({str(p): str(x) for p, x in zip(a["planeid"], a["uri"])})
    out = []
    for r in rows:
        uri = uri_of.get(plane_of.get(r["obs_publisher_did"], ""), None)
        if uri is None:
            log(f"   ! no science artifact for {r['obs_publisher_did']}")
            continue
        r["url"] = uri if uri.startswith("http") else IBE_ROOT + uri.lstrip("/")
        r["detector"] = int(str(r["energy_bandpassname"]).split("-D")[-1])
        out.append(r)
    out.sort(key=lambda r: r["t_min"])
    return out


# ------------------------------------------------------------------ cutouts

class Skip(Exception):
    pass


def http_cutout(url: str, ra: float, dec: float, size_deg: float) -> bytes:
    params = {"center": f"{ra:.7f},{dec:.7f}", "size": f"{size_deg}deg", "gzip": "true"}
    delay = 2.0
    for attempt in range(8):
        try:
            r = requests.get(url, params=params, timeout=180, stream=True)
        except requests.RequestException as e:
            err = f"network: {e}"
        else:
            if r.status_code == 200:
                raw = r.raw.read(decode_content=False)
                return gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw
            if r.status_code == 404:
                raise Skip("404: target position not in this image")
            err = f"HTTP {r.status_code}"
            if r.status_code not in (429, 500, 502, 503, 504):
                raise RuntimeError(err)
        time.sleep(delay)
        delay = min(delay * 2, 120)
    raise RuntimeError(f"gave up after retries ({err})")


def fetch_cutout(exp: dict, ra: float, dec: float, size_deg: float, cache_dir: Path) -> Path:
    """Cutout trimmed to IMAGE/FLAGS/VARIANCE/WCS-WAVE (EPSF dropped) and cached."""
    key = f"{exp['obs_id']}_D{exp['detector']}_{size_deg:g}.fits"
    p = cache_dir / key
    if p.exists():
        return p
    data = http_cutout(exp["url"], ra, dec, size_deg)
    with fits.open(io.BytesIO(data)) as h:
        keep = fits.HDUList([fits.PrimaryHDU(header=h[0].header)] +
                            [h[n].copy() for n in ("IMAGE", "FLAGS", "VARIANCE", "WCS-WAVE")])
        tmp = p.with_suffix(".tmp")
        keep.writeto(tmp, overwrite=True)
        tmp.rename(p)
    return p


# ------------------------------------------------------------- reprojection

def common_wcs(crval: tuple[float, float], n: int) -> WCS:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = list(crval)
    w.wcs.crpix = [(n + 1) / 2, (n + 1) / 2]
    w.wcs.cdelt = [-PIX_ARCSEC / 3600, PIX_ARCSEC / 3600]  # east left, north up
    w.wcs.radesys = "ICRS"
    return w


def bad_mask(flags: np.ndarray, hdr: fits.Header) -> tuple[np.ndarray, int]:
    names = {hdr[k]: int(hdr[k.replace("MSKN", "MSKM")]) for k in hdr if k.startswith("MSKN")}
    always = sum(names.get(n, 0) for n in MASK_ALWAYS)
    off_src = sum(names.get(n, 0) for n in MASK_OFF_SOURCE)
    source = names.get("SOURCE", 0)
    on_source = (flags & source) != 0
    bad = ((flags & always) != 0) | (((flags & off_src) != 0) & ~on_source)
    return bad, always | off_src


def pixel_wavelength(h: fits.HDUList, ra: float, dec: float) -> tuple[float, float] | None:
    """Central wavelength and bandwidth (um) at the target pixel from the WCS-WAVE lookup."""
    try:
        img_w = WCS(h["IMAGE"].header)
        x, y = img_w.world_to_pixel(SkyCoord(ra * u.deg, dec * u.deg))
        sw = WCS(h["IMAGE"].header, fobj=h, key="W")
        sw.sip = None
        lam, bw = sw.pixel_to_world_values(float(x), float(y))
        return float(lam), float(bw)
    except Exception:
        return None


def to_png_pixels(x0: float, y0: float, n: int) -> list[float]:
    """FITS 0-based pixel (y up) -> PNG pixel coords: origin at top-left corner, y down,
    pixel centres at i+0.5."""
    return [float(x0) + 0.5, float(n) - (float(y0) + 0.5)]


# ------------------------------------------------------------ measurements

def measure_centroid(img: np.ndarray, x0: float, y0: float, r: float = 3.0) -> tuple[list[float], float] | str:
    """Iterative background-subtracted first-moment centroid near (x0, y0) (FITS 0-based).
    Returns ((x, y), sigma_px) or a reason string when no reliable measurement exists."""
    ny, nx = img.shape
    yy, xx = np.mgrid[0:ny, 0:nx]
    if not np.all(np.isfinite(img[np.hypot(xx - x0, yy - y0) <= 1.5])):
        return "중심 픽셀 결측(포화) — 중심 측정 생략"
    x, y = x0, y0
    for _ in range(10):
        d = np.hypot(xx - x, yy - y)
        ap = (d <= r) & np.isfinite(img)
        ann = (d > r + 2) & (d <= r + 6) & np.isfinite(img)
        if ap.sum() < 9 or ann.sum() < 20:
            return "유효 픽셀 부족"
        bg = np.median(img[ann])
        sig = 1.4826 * np.median(np.abs(img[ann] - bg))
        w = np.clip(img[ap] - bg, 0, None)
        if w.sum() <= 0:
            return "신호 없음"
        nx_, ny_ = (w * xx[ap]).sum() / w.sum(), (w * yy[ap]).sum() / w.sum()
        if np.hypot(nx_ - x, ny_ - y) < 1e-3:
            x, y = nx_, ny_
            break
        x, y = nx_, ny_
    flux = (img[ap] - bg).sum()
    noise = sig * np.sqrt(ap.sum()) if sig > 0 else np.inf
    snr = flux / noise if noise > 0 else 0
    if snr < 5:
        return f"SNR {snr:.1f} < 5"
    if np.hypot(x - x0, y - y0) > r:
        return "중심이 예측 위치에서 너무 멂"
    # ~PSF FWHM 2 px for SPHEREx; sigma_pos ~ FWHM / (2.355 SNR), plus a systematic floor
    stat = 2.0 / (2.355 * snr) * np.sqrt(2)
    return [float(x), float(y)], float(np.hypot(stat, CENTROID_FLOOR_PX))


# --------------------------------------------------------------------- bake

def group_visits(exps: list[dict], gap_days: float, max_span: float | None = None) -> list[list[dict]]:
    groups: list[list[dict]] = []
    for e in sorted(exps, key=lambda e: e["mjd"]):
        if (groups and e["mjd"] - groups[-1][-1]["mjd"] <= gap_days
                and (max_span is None or e["mjd"] - groups[-1][0]["mjd"] <= max_span)):
            groups[-1].append(e)
        else:
            groups.append([e])
    return groups


def asinh_params(frames: list[np.ndarray]) -> dict:
    allpix = np.concatenate([f[np.isfinite(f)].ravel() for f in frames])
    sigma = float(1.4826 * np.median(np.abs(allpix - np.median(allpix))))
    vmax = float(np.percentile(allpix, 99.9))
    soft = 3.0 * sigma if sigma > 0 else max(vmax / 100, 1e-6)
    vmin = -2.0 * sigma
    return dict(kind="asinh", vmin=vmin, soft=soft, vmax=vmax, sigma=sigma,
                formula="v = asinh((x - vmin)/soft) / asinh((vmax - vmin)/soft), clipped to [0,1]",
                unit="MJy/sr (background-subtracted)")


PIX_SR = (PIX_ARCSEC / 206264.806) ** 2
PHOT_R_AP, PHOT_R_IN, PHOT_R_OUT = 2.5, 4.5, 8.0  # pixels
PHOT_NOTE = ("aperture r=2.5 px (15.4″), background annulus 4.5–8 px, in the original detector pixels; "
             "mJy, not aperture-corrected — compare one detector over time, or one visit across wavelength. "
             "Saturated cores: ring 2.5–4.5 px mean surface brightness (MJy/sr), relative only")
SAT_BITS = ["OVERFLOW", "SUR_ERROR", "NONLINEAR", "TRANSIENT", "PERSIST", "HOT", "COLD", "NONFUNC", "MISSING_DATA", "OUTLIER"]


def exposure_photometry(path: Path, ra: float, dec: float) -> dict:
    """Aperture photometry of one cached cutout at (ra, dec), in the original detector pixels.

    Flux density in mJy = sum over the aperture of (MJy/sr − local background) × pixel solid
    angle. Not aperture-corrected (the PSF widens with wavelength), so compare like with like:
    the same detector over time (light curve) or one visit across wavelength (spectrum shape).
    """
    with fits.open(path) as h:
        img = h["IMAGE"].data.astype(np.float64)
        var = h["VARIANCE"].data.astype(np.float64) if "VARIANCE" in h else None
        flags = h["FLAGS"].data
        names = {h["FLAGS"].header[k]: int(h["FLAGS"].header[k.replace("MSKN", "MSKM")])
                 for k in h["FLAGS"].header if k.startswith("MSKN")}
        x, y = WCS(h["IMAGE"].header).world_to_pixel(SkyCoord(ra * u.deg, dec * u.deg))
        wl = pixel_wavelength(h, ra, dec)
    return native_photometry(img, var, flags, names, float(x), float(y), wl, PIX_SR)


def zodi_path(path: Path) -> Path:
    """ZODI plane of the same exposure (scripts/fetch_zodi.py), keyed by exposure, not cutout size."""
    oid_det = "_".join(path.stem.split("_")[:-1])  # <obs_id>_D<det>
    return path.parent / "zodi" / f"{oid_det}.fits"


def load_exposure(path: Path, cw: WCS, n: int, use_zodi: bool = True) -> tuple[np.ndarray, int]:
    """One cached cutout: mask real defects, subtract the SPHEREx zodiacal-light model (ZODI plane of
    the L2 file) when it has been fetched, then the remaining median offset, and reproject.
    The ZODI model is a smooth sky model from the SPHEREx pipeline: removing it takes out the
    gradient across the field that a single median cannot, without touching sources."""
    with fits.open(path) as h:
        img = h["IMAGE"].data.astype(np.float64)
        bad, bits = bad_mask(h["FLAGS"].data, h["FLAGS"].header)
        img[bad] = np.nan
        w = WCS(h["IMAGE"].header)
        zp = zodi_path(path)
        if use_zodi and zp.exists():
            with fits.open(zp) as z:
                zimg, _ = reproject_interp((z[0].data.astype(np.float64), WCS(z[0].header)), w, shape_out=img.shape)
            # the model is smooth: a pixel the ZODI cutout does not reach gets its median level,
            # so no image pixel is lost to the model's footprint
            zimg[~np.isfinite(zimg)] = np.nanmedian(zimg)
            img -= zimg
        img -= np.nanmedian(img)
        arr, _ = reproject_interp((img, w), cw, shape_out=(n, n))
    return arr, bits


def fetch_zodi(exp: dict, ra: float, dec: float, size_deg: float, cache_dir: Path) -> Path:
    """Download one cutout and keep only its ZODI plane (float32, with the IMAGE WCS)."""
    p = cache_dir / "zodi" / f"{exp['obs_id']}_D{exp['detector']}.fits"
    if p.exists():
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    data = http_cutout(exp["url"], ra, dec, size_deg)
    with fits.open(io.BytesIO(data)) as h:
        if "ZODI" not in h:
            raise Skip("no ZODI plane in this file")
        hdr = WCS(h["IMAGE"].header).to_header()
        hdu = fits.PrimaryHDU(h["ZODI"].data.astype(np.float32), header=hdr)
        hdu.header["BUNIT"] = h["ZODI"].header.get("BUNIT", "MJy/sr")
        hdu.header["COMMENT"] = "SPHEREx L2 ZODI plane (zodiacal light model), cutout"
        tmp = p.with_suffix(".tmp")
        hdu.writeto(tmp, overwrite=True)
        tmp.rename(p)
    return p


def combine_visit(by_det: dict[int, list[np.ndarray]]) -> np.ndarray:
    """nanmean per detector, then nanmean over detectors."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        per_det = [np.nanmean(np.stack(v), axis=0) for v in by_det.values()]
        return np.nanmean(np.stack(per_det), axis=0)


F32_NOTE = "float32 little-endian, n×n, row 0 = north (top), col 0 = east (left); MJy/sr, background-subtracted; NaN = no data"


def write_f32(arr: np.ndarray, path: Path) -> None:
    """Raw frame for the browser (contrast, season stacks, differences are computed there)."""
    np.flipud(arr).astype("<f4").tofile(path)


def write_det_frames(by_det: dict[int, list[np.ndarray]], out_dir: Path, vi: int, prefix: str = "v") -> dict[str, str]:
    """One frame per detector array (each covers one wavelength range), for per-band stacks."""
    out = {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for det, arrs in sorted(by_det.items()):
            rel = f"frames/{prefix}{vi:02d}_d{det}.f32"
            write_f32(np.nanmean(np.stack(arrs), axis=0), out_dir / rel)
            out[str(det)] = rel
    return out


def target_photometry(vi: int, exps: list[dict], star) -> list[dict]:
    """Per-exposure photometry at the target's apparent position at each exposure time."""
    rows = []
    for e in exps:
        t = Time(e["mjd"], format="mjd", scale="utc")
        ra, dec = apparent_radec(target_bary_au(star, t), earth_bary_au(t))
        rows.append(dict(visit=vi, exposure=f"{e['obs_id']}/D{e['detector']}", detector=e["detector"],
                         mjd=round(e["mjd"], 6), **exposure_photometry(e["path"], ra, dec)))
    return rows


def write_png(arr: np.ndarray, path: Path, f) -> None:
    """Grey + alpha PNG; NaN (masked / no data) pixels are fully transparent."""
    finite = np.isfinite(arr)
    v = np.nan_to_num(f(np.where(finite, arr, 0.0)), nan=0.0)
    grey = (np.clip(v, 0, 1) * 255 + 0.5).astype(np.uint8)
    alpha = np.where(finite, 255, 0).astype(np.uint8)
    la = np.flipud(np.stack([grey, alpha], axis=-1))  # flip: row 0 = north (top)
    Image.fromarray(la, mode="LA").save(path)


def thin_per_visit(exps: list[dict], k: int, gap_days: float, cache_dir: Path,
                   max_span: float | None = None, min_spacing: float | None = None) -> list[dict]:
    """Keep at most k exposures per visit (grouped on t_min), spread evenly in time and
    preferring ones already in the cache. For deep-field targets with thousands of exposures."""
    for e in exps:
        e["mjd"] = e["t_min"]
    cached = {p.name.split("_D")[0] + "/" + p.name.split("_D")[1].split("_")[0]
              for p in cache_dir.glob("*.fits")}
    out = []
    last = -1e9
    for g in group_visits(exps, gap_days, max_span):
        if min_spacing and g[0]["mjd"] - last < min_spacing:
            continue
        last = g[0]["mjd"]
        have = [e for e in g if f"{e['obs_id']}/{e['detector']}" in cached]
        rest = [e for e in g if f"{e['obs_id']}/{e['detector']}" not in cached]
        pick = have[:: max(1, len(have) // k)][:k] if len(have) >= k else have
        if len(pick) < k and rest:
            need = k - len(pick)
            pick += [rest[int(i)] for i in np.linspace(0, len(rest) - 1, min(need, len(rest)))]
        out += pick
    for e in exps:
        del e["mjd"]
    return sorted(out, key=lambda e: e["t_min"])


def bake_target(cfg: TargetCfg, args) -> dict:
    t_start = dt.datetime.now(dt.timezone.utc)
    out_dir = OUT / cfg.id
    cache_dir = CACHE / cfg.id
    cache_dir.mkdir(parents=True, exist_ok=True)
    log(f"== {cfg.display_name} ({cfg.id})")

    ast = astrometry_for(cfg)
    log(f"   astrometry: {ast['source']}  plx={ast['parallax_mas']:.3f} mas  "
        f"pm=({ast['pmra']:.1f}, {ast['pmdec']:.1f}) mas/yr  rv={ast['rv_kms']}")
    ast["warnings"] += cfg.extra_warnings
    for w in ast["warnings"]:
        log(f"   ⚠ {w}")
    star = star_coord(ast)

    # Coverage search at the mid-survey epoch, after proper motion.
    t_mid = Time(2026.0, format="jyear", scale="tdb")
    ra_mid, dec_mid = apparent_radec(target_bary_au(star, t_mid), earth_bary_au(t_mid))
    exps = search_exposures(ra_mid, dec_mid, args.collections)
    log(f"   exposures found: {len(exps)}")
    if not exps:
        return dict(status="no_data", status_detail="SPHEREx 관측 영상에 대상 위치가 없음", n_visits=0)
    n_found = len(exps)
    if cfg.detectors:
        exps = [e for e in exps if e["detector"] in cfg.detectors]
        log(f"   detectors {cfg.detectors} only: {len(exps)} exposures ({cfg.detectors_reason})")
        if not exps:
            return dict(status="no_data", n_visits=0,
                        status_detail=f"검출기 {cfg.detectors} 관측 없음")
    if args.max_exposures:
        exps = exps[: args.max_exposures]
    max_per_visit = args.max_exp_per_visit or cfg.max_exp_per_visit
    if max_per_visit:
        exps = thin_per_visit(exps, max_per_visit, args.visit_gap_days, CACHE / cfg.id,
                              cfg.visit_max_span_days, cfg.min_visit_spacing_days)
        log(f"   capped at {max_per_visit}/visit (span ≤ {cfg.visit_max_span_days} d, "
            f"spacing ≥ {cfg.min_visit_spacing_days} d): {len(exps)} exposures")

    # Cutouts centred on the target's apparent position at each exposure's start time
    # (the header MJD-AVG is read afterwards and used for all geometry).
    frame_deg = args.frame_deg
    cut_deg = round(frame_deg * 1.5, 4)  # rotated footprint must cover the whole frame
    jobs = {}
    fails, skips = [], []
    with cf.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
        for e in exps:
            t = Time(e["t_min"], format="mjd", scale="utc")
            ra_e, dec_e = apparent_radec(target_bary_au(star, t), earth_bary_au(t))
            jobs[pool.submit(fetch_cutout, e, ra_e, dec_e, cut_deg, cache_dir)] = e
        for i, fut in enumerate(cf.as_completed(jobs), 1):
            e = jobs[fut]
            try:
                e["path"] = fut.result()
            except Skip as s:
                skips.append((e["obs_id"], str(s)))
            except Exception as ex:
                fails.append((e["obs_id"], f"D{e['detector']}", str(ex)))
            if i % 25 == 0 or i == len(jobs):
                log(f"   cutouts {i}/{len(jobs)}  (skipped {len(skips)}, failed {len(fails)})")
    got = [e for e in exps if "path" in e]
    if not got:
        return dict(status="fetch_failed", n_visits=0,
                    status_detail=f"컷아웃 {len(fails)}건 실패, {len(skips)}건 위치 없음")

    # Observation times from MJD-AVG (DATE is the processing date).
    for e in got:
        with fits.open(e["path"]) as h:
            H = h["IMAGE"].header
            e["mjd"] = float(H["MJD-AVG"])
            e["timesys"] = str(H.get("TIMESYS", "UTC")).strip()
    visits_exp = group_visits(got, args.visit_gap_days, cfg.visit_max_span_days)

    # Common grid: fixed at the target's apparent position at the first visit.
    def epoch(mjd: float, timesys: str) -> Time:
        return Time(mjd, format="mjd", scale=timesys.lower() if timesys.lower() in ("utc", "tai", "tt", "tdb") else "utc")

    t0 = epoch(np.mean([e["mjd"] for e in visits_exp[0]]), visits_exp[0][0]["timesys"])
    crval = apparent_radec(target_bary_au(star, t0), earth_bary_au(t0))
    n = int(round(frame_deg * 3600 / PIX_ARCSEC))
    n += (n + 1) % 2  # odd: grid centre is a pixel centre
    cw = common_wcs(crval, n)

    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "frames").mkdir(parents=True)

    visits, frames, masks_used = [], [], set()
    photometry: list[dict] = []
    for vi, group in enumerate(visits_exp):
        by_det: dict[int, list[np.ndarray]] = {}
        waves = []
        for e in group:
            arr, bits = load_exposure(e["path"], cw, n)
            masks_used.add(bits)
            by_det.setdefault(e["detector"], []).append(arr)
            with fits.open(e["path"]) as h:
                tt = epoch(e["mjd"], e["timesys"])
                ra_e, dec_e = apparent_radec(target_bary_au(star, tt), earth_bary_au(tt))
                wl = pixel_wavelength(h, ra_e, dec_e)
                if wl:
                    waves.append((wl[0] - wl[1] / 2, wl[0] + wl[1] / 2))
        frame = combine_visit(by_det)
        frames.append(frame)
        write_f32(frame, out_dir / f"frames/v{vi:02d}.f32")
        det_frames = write_det_frames(by_det, out_dir, vi)
        photometry += target_photometry(vi, group, star)

        mjd = float(np.mean([e["mjd"] for e in group]))
        tv = epoch(mjd, group[0]["timesys"])
        earth = earth_bary_au(tv)
        targ = target_bary_au(star, tv)
        ra_a, dec_a = apparent_radec(targ, earth)
        x0, y0 = cw.world_to_pixel(SkyCoord(ra_a * u.deg, dec_a * u.deg))
        meas = measure_centroid(frame, float(x0), float(y0)) if args.measure else "측정 비활성(--no-measure)"
        meas_note = meas if isinstance(meas, str) else None
        meas = None if isinstance(meas, str) else meas
        visits.append(dict(
            mjd=mjd, utc=tv.utc.isot + "Z", png=f"frames/v{vi:02d}.png", diff_png=f"frames/d{vi:02d}.png", f32=f"frames/v{vi:02d}.f32", f32_det=det_frames,
            n_exp=len(group), detectors=sorted(by_det),
            wave_um=[round(min(w[0] for w in waves), 4), round(max(w[1] for w in waves), 4)] if waves else None,
            earth_au=earth.tolist(), target_au=targ.tolist(), ra_app=ra_a, dec_app=dec_a,
            pred_px=to_png_pixels(x0, y0, n),
            meas_px=to_png_pixels(*meas[0], n) if meas else None,
            meas_err_px=meas[1] if meas else None, meas_note=meas_note,
            exposures=[f"{e['obs_id']}/D{e['detector']}" for e in group],
            irsa_uris=[e["url"] for e in group]))

    sp = asinh_params(frames)
    f = lambda a: np.arcsinh((a - sp["vmin"]) / sp["soft"]) / np.arcsinh((sp["vmax"] - sp["vmin"]) / sp["soft"])
    dlim = 5.0 * sp["sigma"] if sp["sigma"] > 0 else 1.0
    fd = lambda a: 0.5 + a / (2 * dlim)
    for vi, fr in enumerate(frames):
        write_png(fr, out_dir / visits[vi]["png"], f)
        write_png(fr - frames[0], out_dir / visits[vi]["diff_png"], fd)

    # Dense daily samples across the observing span, for 3D interpolation.
    m0, m1 = visits[0]["mjd"] - 5, visits[-1]["mjd"] + 5
    dm = np.arange(np.floor(m0), np.ceil(m1) + 1, 1.0)
    td = Time(dm, format="mjd", scale="utc")
    dense = dict(mjd=dm.tolist(), earth_au=earth_bary_au(td).T.tolist(),
                 target_au=target_bary_au(star, td).T.tolist())

    # Long-term straight-line track, +/-20,000 yr about the reference epoch.
    p0 = star.cartesian.xyz.to_value(u.au)
    v0 = star.velocity.d_xyz.to_value(u.au / u.yr)
    years = np.arange(-20000, 20000 + 1, 100.0) + ast["ref_epoch"]
    lt = (p0[:, None] + v0[:, None] * (years - ast["ref_epoch"])[None, :]).T

    meta = dict(
        id=cfg.id, display_name=cfg.display_name, astrometry=ast,
        wcs=dict(crval=list(crval), cdelt_arcsec=PIX_ARCSEC, size_px=[n, n], north_up=True, east_left=True,
                 ctype=["RA---TAN", "DEC--TAN"], crpix_fits=[(n + 1) / 2, (n + 1) / 2],
                 crval_note="target astrometric position seen from Earth at the first visit",
                 pixel_convention="PNG pixels: origin at top-left image corner, x right, y down, pixel centre at i+0.5"),
        frame=dict(cutout_deg=cut_deg, frame_deg=frame_deg, reproject="reproject_interp (bilinear)",
                   combine="per detector: nanmean of background-subtracted exposures; visit = nanmean over detectors",
                   mask_always=MASK_ALWAYS, mask_off_source=MASK_OFF_SOURCE, mask_value=sorted(masks_used),
                   nan_pixels="transparent (alpha 0) in PNG",
                   f32=F32_NOTE,
                   not_masked="SOURCE (label), DICHROIC, GHOST*, CROSSTALK, STREAK, BLOOM, SNOWBALL, HALO, "
                              "OVERFLOW/NONLINEAR (would remove bright-star cores)",
                   visit_gap_days=args.visit_gap_days,
                   detectors=cfg.detectors, detectors_reason=cfg.detectors_reason,
                   max_exp_per_visit=max_per_visit or None,
                   visit_max_span_days=cfg.visit_max_span_days,
                   min_visit_spacing_days=cfg.min_visit_spacing_days),
        stretch=sp,
        photometry=photometry,
        photometry_note=PHOT_NOTE,
        diff_stretch=dict(kind="linear", center=0.0, limit=dlim, formula="v = 0.5 + (x - x_v00)/(2*limit)"),
        visits=visits, dense=dense,
        longterm=dict(year=years.tolist(), target_au=lt.tolist(),
                      note="Straight-line space motion (no Galactic potential / no orbit); ±20,000 yr, 100 yr step"),
        notes=[
            "Earth barycentric position is used for the observer; SPHEREx orbits ~650 km above Earth "
            "(parallax effect < 1e-4 arcsec, ignored).",
            "Directions are astrometric (no annual aberration), matching Gaia-tied SPHEREx WCS.",
            "rv_kms=null is computed as 0 km/s in 3D." if ast["rv_kms"] is None else "",
            *cfg.notes,
            cfg.detectors_reason or "",
        ],
        provenance=dict(collections=args.collections, query_time_utc=t_start.isoformat(),
                        code_version=code_version(), tap=TAP_URL,
                        exposures_found=n_found,
                        cutouts=dict(downloaded=len(got), skipped_404=len(skips), failed=len(fails),
                                     failures=fails[:50])),
    )
    meta["notes"] = [x for x in meta["notes"] if x]
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    log(f"   visits: {len(visits)}  exposures used: {len(got)}  skipped(404): {len(skips)}  failed: {len(fails)}")
    detail = f"컷아웃 실패 {len(fails)}건" if fails else None
    return dict(status="ok", n_visits=len(visits), status_detail=detail)


def update_index(results: dict[str, dict]) -> None:
    idx_path = OUT / "targets.json"
    old = {}
    if idx_path.exists():
        old = {t["id"]: t for t in json.loads(idx_path.read_text())["targets"]}
    for tid, r in results.items():
        old[tid] = dict(id=tid, display_name=TARGETS[tid].display_name, **r)
    for tid, t in old.items():  # centre of each baked frame, so the app can link nearby searches
        mp = OUT / tid / "meta.json"
        if t.get("status") == "ok" and mp.exists():
            t["ra"], t["dec"] = json.loads(mp.read_text())["wcs"]["crval"]
    order = [k for k in TARGETS if k in old]
    idx = dict(generated_utc=dt.datetime.now(dt.timezone.utc).isoformat(), code_version=code_version(),
               targets=[old[k] for k in order])
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("targets", nargs="*", help=f"ids: {', '.join(TARGETS)}")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--frame-deg", type=float, default=0.1, help="side of the common north-up frame")
    ap.add_argument("--visit-gap-days", type=float, default=2.0)
    ap.add_argument("--collections", nargs="+", default=COLLECTIONS)
    ap.add_argument("--max-exposures", type=int, default=0, help="debug: limit exposures per target")
    ap.add_argument("--max-exp-per-visit", type=int, default=0,
                    help="cap exposures per visit (deep fields such as R Dra); recorded in meta")
    ap.add_argument("--no-measure", dest="measure", action="store_false")
    args = ap.parse_args()
    ids = list(TARGETS) if args.all else args.targets
    if not ids or any(i not in TARGETS for i in ids):
        ap.error(f"choose from {list(TARGETS)} or --all")
    OUT.mkdir(parents=True, exist_ok=True)
    results = {}
    for tid in ids:
        try:
            results[tid] = bake_target(TARGETS[tid], args)
        except Exception as e:
            traceback.print_exc()
            results[tid] = dict(status="fetch_failed", n_visits=0, status_detail=f"{type(e).__name__}: {e}")
        update_index({tid: results[tid]})
    log("\n== summary")
    for tid, r in results.items():
        log(f"   {tid:12s} {r['status']:12s} visits={r['n_visits']:3d}  {r.get('status_detail') or ''}")
    return 0 if all(r["status"] == "ok" for r in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
