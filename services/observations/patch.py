#!/usr/bin/env python3
"""Bake an arbitrary sky patch (RA, Dec, field of view) from SPHEREx data only.

Same pipeline as bake.py, minus everything that needs a known object: no catalog
astrometry, no predicted positions, no 3D geometry. The patch is centred on the
requested coordinates and every visit is reprojected onto one north-up 6.15"/px grid,
so anything that moves or changes brightness shows up when the frames are blinked.

Output: public/data/patches/<id>/meta.json + frames/vNN.{png,f32} + frames/dNN.png
Usage:  .venv/bin/python scripts/patch.py 133.795 -7.245 --fov 0.1
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import re
import uuid
import sys
from pathlib import Path
from typing import Callable

import numpy as np
from astropy.io import fits
from astropy.time import Time

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake as B  # noqa: E402
from runtime import PATCH_DIR, atomic_json
from server import patch_id, validate_input

PATCH_OUT = PATCH_DIR
PATCH_CACHE = B.CACHE / "patches"
FOVS = (0.1, 0.2, 0.3)
MAX_EXPOSURES = 300  # keeps a request to a few minutes; deep fields are thinned


def bake_patch(ra: float, dec: float, fov: float,
               progress: Callable[[str, int, int], None] = lambda *_: None) -> dict:
    ra, dec, fov = validate_input(dict(ra=ra, dec=dec, fov=fov))
    pid = patch_id(ra, dec, fov)
    out = PATCH_OUT / pid
    cache = PATCH_CACHE / pid
    cache.mkdir(parents=True, exist_ok=True)
    t_start = dt.datetime.now(dt.timezone.utc)

    progress("IRSA에서 이 좌표를 덮는 SPHEREx 영상 검색 중", 0, 0)
    exps = B.search_exposures(ra, dec, B.COLLECTIONS)
    n_found = len(exps)
    if not exps:
        return _write_empty(out, pid, ra, dec, fov, "이 좌표를 덮는 SPHEREx 영상이 아직 없음", t_start)

    thinned = None
    if len(exps) > MAX_EXPOSURES:
        # deep fields: short visits, one per week, a few exposures each
        exps = B.thin_per_visit(exps, 6, 2.0, cache, max_span=2.0, min_spacing=7.0)
        exps = exps[:MAX_EXPOSURES]
        thinned = f"노출 {n_found}장 중 {len(exps)}장 사용 (1주에 한 관측, 관측당 최대 6장)"

    cut_deg = round(min(fov * 1.5, 0.5), 4)
    fails, skips, got = [], [], []
    with cf.ThreadPoolExecutor(max_workers=B.MAX_CONCURRENT) as pool:
        jobs = {pool.submit(B.fetch_cutout, e, ra, dec, cut_deg, cache): e for e in exps}
        for i, fut in enumerate(cf.as_completed(jobs), 1):
            e = jobs[fut]
            try:
                e["path"] = fut.result()
                got.append(e)
            except B.Skip as s:
                skips.append((e["obs_id"], str(s)))
            except Exception as ex:  # noqa: BLE001
                fails.append((e["obs_id"], f"D{e['detector']}", str(ex)))
            progress("SPHEREx 컷아웃 받는 중", i, len(exps))
    if not got:
        return _write_empty(out, pid, ra, dec, fov, f"컷아웃 실패 {len(fails)}건, 위치 없음 {len(skips)}건", t_start, failed=True)

    progress("북쪽-위 격자로 맞추고 관측별로 합성 중", 0, 0)
    for e in got:
        with fits.open(e["path"]) as h:
            e["mjd"] = float(h["IMAGE"].header["MJD-AVG"])
    groups = B.group_visits(got, 2.0, 2.0)
    n = int(round(fov * 3600 / B.PIX_ARCSEC))
    n += (n + 1) % 2
    cw = B.common_wcs((ra, dec), n)

    # Build into an immutable generation, then atomically publish its metadata.
    # Existing readers keep their previous frame URLs throughout a refresh.
    generation = f'generations/{uuid.uuid4().hex}'
    frame_out = out / generation
    (frame_out / "frames").mkdir(parents=True, exist_ok=False)
    frames, visits = [], []
    for vi, g in enumerate(groups):
        by_det: dict[int, list[np.ndarray]] = {}
        waves = []
        for e in g:
            arr, _ = B.load_exposure(e["path"], cw, n)
            by_det.setdefault(e["detector"], []).append(arr)
            with fits.open(e["path"]) as h:
                wl = B.pixel_wavelength(h, ra, dec)
            if wl:
                waves.append((wl[0] - wl[1] / 2, wl[0] + wl[1] / 2))
        frame = B.combine_visit(by_det)
        frames.append(frame)
        B.write_f32(frame, frame_out / f"frames/v{vi:02d}.f32")
        mjd = float(np.mean([e["mjd"] for e in g]))
        visits.append(dict(
            mjd=mjd, utc=Time(mjd, format="mjd", scale="utc").isot + "Z",
            png=f"frames/v{vi:02d}.png", diff_png=f"frames/d{vi:02d}.png", f32=f"frames/v{vi:02d}.f32",
            f32_det=B.write_det_frames(by_det, frame_out, vi),
            n_exp=len(g), detectors=sorted(by_det),
            wave_um=[round(min(w[0] for w in waves), 4), round(max(w[1] for w in waves), 4)] if waves else None,
            masked_frac=round(float(np.mean(~np.isfinite(frame))), 4),
            exposures=[f"{e['obs_id']}/D{e['detector']}" for e in g],
            irsa_uris=[e["url"] for e in g]))
        progress("관측별 합성 중", vi + 1, len(groups))

    sp = B.asinh_params(frames)
    f = lambda a: np.arcsinh((a - sp["vmin"]) / sp["soft"]) / np.arcsinh((sp["vmax"] - sp["vmin"]) / sp["soft"])
    dlim = 5.0 * sp["sigma"] if sp["sigma"] > 0 else 1.0
    for vi, fr in enumerate(frames):
        B.write_png(fr, frame_out / visits[vi]["png"], f)
        B.write_png(fr - frames[0], frame_out / visits[vi]["diff_png"], lambda a: 0.5 + a / (2 * dlim))
    for visit in visits:
        for key in ('png', 'diff_png', 'f32'):
            visit[key] = f'{generation}/{visit[key]}'
        visit['f32_det'] = {key: f'{generation}/{value}' for key, value in visit['f32_det'].items()}

    meta = dict(
        id=pid, kind="patch", status="done", display_name=f"RA {ra:.4f}°, Dec {dec:+.4f}°",
        center=dict(ra=ra, dec=dec), fov_deg=fov, astrometry=None, dense=None, longterm=None,
        wcs=dict(crval=[ra, dec], cdelt_arcsec=B.PIX_ARCSEC, size_px=[n, n], north_up=True, east_left=True,
                 pixel_convention="PNG pixels: origin at top-left image corner, x right, y down, pixel centre at i+0.5"),
        frame=dict(cutout_deg=cut_deg, frame_deg=fov, reproject="reproject_interp (bilinear)",
                   combine="per detector: nanmean of background-subtracted exposures; visit = nanmean over detectors",
                   mask_always=B.MASK_ALWAYS, mask_off_source=B.MASK_OFF_SOURCE, f32=B.F32_NOTE,
                   visit_gap_days=2.0, visit_max_span_days=2.0, thinned=thinned),
        stretch=sp, visits=visits,
        notes=["임의 좌표 영역: 알려진 대상이 없어 예측 위치·3D 계산은 하지 않습니다.",
               "검출 판정용 차영상이 아닙니다. 파장 구성과 PSF 차이도 영상 차이에 포함될 수 있습니다."],
        provenance=dict(collections=B.COLLECTIONS, query_time_utc=t_start.isoformat(), code_version=B.code_version(),
                        exposures_found=n_found,
                        cutouts=dict(downloaded=len(got), skipped_404=len(skips), failed=len(fails), failures=fails[:50])),
    )
    progress("완성된 관측 자료 게시 중", len(groups), len(groups))
    atomic_json(out / "meta.json", meta)
    return dict(status="ok", id=pid, n_visits=len(visits))


def _write_empty(out: Path, pid: str, ra: float, dec: float, fov: float, why: str, t0, failed=False) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    meta = dict(id=pid, kind="patch", status="fetch_failed" if failed else "no_data", status_detail=why,
                display_name=f"RA {ra:.4f}°, Dec {dec:+.4f}°", center=dict(ra=ra, dec=dec), fov_deg=fov, visits=[],
                provenance=dict(collections=B.COLLECTIONS, query_time_utc=t0.isoformat(), code_version=B.code_version()))
    atomic_json(out / "meta.json", meta)
    return dict(status=meta["status"], id=pid, n_visits=0, detail=why)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ra", type=float)
    ap.add_argument("dec", type=float)
    ap.add_argument("--fov", type=float, default=0.1, help='Field width in degrees, 0.025–0.5')
    a = ap.parse_args()
    r = bake_patch(a.ra, a.dec, a.fov, lambda msg, i, n: B.log(f"   {msg} {i}/{n}" if n else f"   {msg}"))
    B.log(r)
    return 0 if r["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
