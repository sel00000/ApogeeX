#!/usr/bin/env python3
"""Home page: one patch of sky in all 102 SPHEREx colours (real exposures only).

SPHEREx has six detectors behind linear variable filters (LVF). Each detector's band is split into
17 channels of constant resolving power, 6 x 17 = 102. A point on the sky is seen at a different
channel in each exposure as the telescope steps, so a full spectrum needs many exposures.

This script takes SPHEREx L2 cutouts that the analysis app already downloaded from NASA/IPAC IRSA
(cache/<target>/*.fits, with the SPHEREx ZODI model in cache/<target>/zodi/), and for each of the
102 channels picks one exposure from a single survey pass. Every frame is masked, zodi-subtracted
and reprojected exactly as the analysis app does (analysis/scripts/bake.py), onto one north-up
grid, and shown with ONE common asinh stretch, so brightness changes between channels are real.
The target's flux in each channel is measured with the analysis app's aperture photometry.

Output (assets/spectrum/<target>/):
  combined.png all channels averaged into one picture (per-pixel mean, own asinh stretch)
  frames.png   sprite, 17 columns (channels) x 6 rows (detectors), each tile N x N, grey + alpha
  meta.json    per channel: detector, channel, wavelength, bandwidth, exposure, UTC, flux; stretch

Usage: python build_home_spectrum.py <cache_root> <target_id> [N]
"""
from __future__ import annotations
import json, sys, warnings
from pathlib import Path
import numpy as np
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "analysis" / "scripts"))
warnings.filterwarnings("ignore")
import logging; logging.getLogger("astropy").setLevel(logging.ERROR)
import bake  # noqa: E402  (same masking / zodi / reprojection / photometry as the analysis app)

# SPHEREx detector bands (µm), from the SPHEREx Explanatory Supplement / mission overview
BANDS = [(0.75, 1.09), (1.10, 1.62), (1.63, 2.42), (2.42, 3.82), (3.83, 4.42), (4.42, 5.00)]
PASS_DAYS = 30.0  # one survey pass sweeps a point through all channels within a few weeks


def channel_of(det: int, lam: float) -> int | None:
    lo, hi = BANDS[det - 1]
    if not (lo <= lam <= hi):
        return None
    edges = np.geomspace(lo, hi, 18)  # constant resolving power: 17 log-spaced channels
    return int(min(16, max(0, np.searchsorted(edges, lam) - 1)))


def main() -> int:
    cache, target = Path(sys.argv[1]), sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    meta_in = json.loads((HERE.parent / "analysis/public/data" / target / "meta.json").read_text())
    ra, dec = meta_in["wcs"]["crval"]
    rows = []
    for p in sorted((cache / target).glob("*.fits")):
        with fits.open(p) as h:
            hd = h["IMAGE"].header
            ny, nx = h["IMAGE"].data.shape
            if min(nx, ny) < 80:  # target near an image edge: skip
                continue
            wl = bake.pixel_wavelength(h, ra, dec)
        if not wl:
            continue
        det = int(hd["DETECTOR"])
        ch = channel_of(det, wl[0])
        if ch is None:
            continue
        rows.append(dict(path=p, det=det, ch=ch, lam=wl[0], bw=wl[1], mjd=float(hd["MJD-AVG"]), obs=hd["OBSID"]))
    if not rows:
        print("no usable cutouts"); return 1
    # the 30-day window with the most channels covered = one survey pass
    mjds = np.array(sorted(r["mjd"] for r in rows))
    best, t0 = -1, mjds[0]
    for m in mjds:
        k = len({(r["det"], r["ch"]) for r in rows if m <= r["mjd"] < m + PASS_DAYS})
        if k > best:
            best, t0 = k, m
    mid = t0 + PASS_DAYS / 2
    pick: dict[tuple[int, int], dict] = {}
    for r in rows:
        if not (t0 <= r["mjd"] < t0 + PASS_DAYS):
            continue
        key = (r["det"], r["ch"])
        if key not in pick or abs(r["mjd"] - mid) < abs(pick[key]["mjd"] - mid):
            pick[key] = r
    print(f"{target}: {len(rows)} cutouts, pass from MJD {t0:.1f}: {len(pick)}/102 channels")
    cw = bake.common_wcs((ra, dec), n)
    frames, chans = {}, []
    for key in sorted(pick):
        r = pick[key]
        arr, _ = bake.load_exposure(r["path"], cw, n)
        frames[key] = arr.astype(np.float32)
        ph = bake.exposure_photometry(r["path"], ra, dec)
        chans.append(dict(det=key[0], ch=key[1] + 1, um=round(r["lam"], 4), bw_um=round(r["bw"], 4),
                          exposure=f"{r['obs']}/D{key[0]}", utc=Time(r["mjd"], format="mjd").isot[:19],
                          flux_mjy=ph["flux_mjy"], err_mjy=ph["err_mjy"], flux_note=ph["note"],
                          valid=float(np.isfinite(arr).mean().round(3))))
    st = bake.asinh_params(list(frames.values()))
    sprite = np.zeros((6 * n, 17 * n, 2), np.uint8)
    for (det, ch), arr in frames.items():
        v = np.arcsinh((arr - st["vmin"]) / st["soft"]) / np.arcsinh((st["vmax"] - st["vmin"]) / st["soft"])
        v = np.clip(np.nan_to_num(v, nan=0), 0, 1)
        tile = np.stack([np.round(v * 255), np.where(np.isfinite(arr), 255, 0)], -1).astype(np.uint8)
        sprite[(det - 1) * n:det * n, ch * n:(ch + 1) * n] = tile[::-1]  # FITS y-up -> PNG y-down
    out = HERE.parent / "assets" / "spectrum" / target
    out.mkdir(parents=True, exist_ok=True)
    # all channels stacked into one picture: per-pixel mean of the background-subtracted frames (MJy/sr),
    # shown with its own asinh stretch. A real average of the 101 exposures, greyscale, no colour.
    stack = np.nanmean(np.stack(list(frames.values())), axis=0)
    cs = bake.asinh_params([stack])
    v = np.arcsinh((stack - cs["vmin"]) / cs["soft"]) / np.arcsinh((cs["vmax"] - cs["vmin"]) / cs["soft"])
    v = np.clip(np.nan_to_num(v, nan=0), 0, 1)
    Image.fromarray(np.stack([np.round(v * 255), np.where(np.isfinite(stack), 255, 0)], -1).astype(np.uint8)[::-1], "LA").save(out / "combined.png", optimize=True)
    Image.fromarray(sprite, "LA").save(out / "frames.png", optimize=True)
    (out / "meta.json").write_text(json.dumps(dict(
        target=meta_in["display_name"], ra=ra, dec=dec, tile_px=n, pixel_arcsec=bake.PIX_ARCSEC,
        layout="sprite rows = detectors D1..D6, columns = channels 1..17 (short to long wavelength)",
        north_up=True, east_left=True, stretch=st, combined=dict(file="combined.png", method="per-pixel nanmean of all channel frames (MJy/sr), own asinh stretch", stretch=cs), channels=chans, missing=102 - len(chans),
        pass_utc=[Time(t0, format="mjd").isot[:10], Time(t0 + PASS_DAYS, format="mjd").isot[:10]],
        source="NASA/IPAC IRSA SPHEREx L2 (DR1/QR3) cutouts cached by analysis/scripts/bake.py",
        method="bake.load_exposure (flag mask, SPHEREx ZODI model, median, reproject_interp) + one common asinh stretch; "
               "photometry bake.exposure_photometry (r=2.5 px, not aperture-corrected)",
        channels_rule="17 log-spaced channels per detector band (constant R); one exposure per channel, nearest the middle of the pass",
    ), ensure_ascii=False, indent=1))
    print("wrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
