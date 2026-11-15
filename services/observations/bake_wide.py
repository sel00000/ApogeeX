#!/usr/bin/env python3
"""Wide context frames for the test targets (SPHEREx only).

The analysis frames are 0.1° (59 px) around the target. For comparing the target with the
stars around it, this adds a 0.3° (177 px) frame per visit on the SAME grid centre and pixel
scale, so frame pixel coordinates differ only by a constant offset ((N_wide − n)/2).
To keep downloads modest a visit uses at most 8 exposures (spread over its detectors);
the target analysis (photometry, centroids) still uses every exposure of the 0.1° frames.

Output: frames/wNN.f32, frames/wNN_dK.f32 and meta["wide"].
Usage:  .venv/bin/python scripts/bake_wide.py barnard   (or --all)
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake as B  # noqa: E402

WIDE_DEG = 0.3
MAX_PER_VISIT = 8


def pick(exposures: list[str], uris: list[str], k: int) -> list[tuple[str, str]]:
    """Up to k exposures, round-robin over detectors so every band stays represented."""
    by_det: dict[str, list[tuple[str, str]]] = {}
    for ex, uri in zip(exposures, uris):
        by_det.setdefault(ex.split("/D")[1], []).append((ex, uri))
    out: list[tuple[str, str]] = []
    while len(out) < k and any(by_det.values()):
        for d in sorted(by_det):
            if by_det[d] and len(out) < k:
                lst = by_det[d]
                out.append(lst.pop(len(lst) // 2))  # middle first, then outward
    return out


def bake_wide(tid: str) -> str:
    out = B.OUT / tid
    meta = json.loads((out / "meta.json").read_text())
    n = meta["wcs"]["size_px"][0]
    N = int(round(WIDE_DEG * 3600 / B.PIX_ARCSEC))
    N += (N + 1) % 2
    cw = B.common_wcs(tuple(meta["wcs"]["crval"]), N)
    cut = round(WIDE_DEG * 1.5, 4)
    ra, dec = meta["wcs"]["crval"]
    cache = B.CACHE / tid
    jobs = []
    for vi, v in enumerate(meta["visits"]):
        for ex, uri in pick(v["exposures"], v["irsa_uris"], MAX_PER_VISIT):
            oid, det = ex.split("/D")
            jobs.append((vi, dict(obs_id=oid, detector=int(det), url=uri)))
    B.log(f"== {tid}: {len(jobs)} wide cutouts ({cut}°) for {len(meta['visits'])} visits")

    got: dict[int, list[dict]] = {}
    fails = 0
    with cf.ThreadPoolExecutor(max_workers=B.MAX_CONCURRENT) as pool:
        fut = {pool.submit(B.fetch_cutout, e, ra, dec, cut, cache): (vi, e) for vi, e in jobs}
        for i, f in enumerate(cf.as_completed(fut), 1):
            vi, e = fut[f]
            try:
                e["path"] = f.result()
                got.setdefault(vi, []).append(e)
            except Exception as ex:  # noqa: BLE001
                fails += 1
                B.log(f"   ! {e['obs_id']} D{e['detector']}: {ex}")
            if i % 25 == 0 or i == len(jobs):
                B.log(f"   {i}/{len(jobs)}")

    wide_visits = []
    for vi in range(len(meta["visits"])):
        by_det: dict[int, list[np.ndarray]] = {}
        for e in got.get(vi, []):
            arr, _ = B.load_exposure(e["path"], cw, N)
            by_det.setdefault(e["detector"], []).append(arr)
        if not by_det:
            wide_visits.append(None)
            continue
        frame = B.combine_visit(by_det)
        B.write_f32(frame, out / f"frames/w{vi:02d}.f32")
        det = B.write_det_frames(by_det, out, vi, prefix="w")
        actual = got.get(vi, [])
        requested = pick(meta["visits"][vi]["exposures"], meta["visits"][vi]["irsa_uris"], MAX_PER_VISIT)
        wide_visits.append(dict(f32=f"frames/w{vi:02d}.f32", f32_det=det, n_exp=sum(len(a) for a in by_det.values()),
                                failed_exp=len(requested)-len(actual),
                                exposures=[f"{e['obs_id']}/D{e['detector']}" for e in actual],
                                irsa_uris=[e["url"] for e in actual]))

    meta["wide"] = dict(frame_deg=WIDE_DEG, size_px=[N, N], offset_px=(N - n) / 2, cutout_deg=cut,
                        max_exp_per_visit=MAX_PER_VISIT, visits=wide_visits,
                        note="같은 격자 중심·픽셀 크기의 넓은 영상(주변 별 비교용). 관측당 노출 최대 8장")
    tmp = out / "meta.wide.tmp"
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    tmp.replace(out / "meta.json")
    return f"{sum(v is not None for v in wide_visits)}/{len(wide_visits)} visits, {fails} failed"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("targets", nargs="*")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    idx = json.loads((B.OUT / "targets.json").read_text())
    ids = [t["id"] for t in idx["targets"] if t["status"] == "ok"] if a.all else a.targets
    for tid in ids:
        B.log(f"{tid:12s} {bake_wide(tid)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
