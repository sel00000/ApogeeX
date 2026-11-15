#!/usr/bin/env python3
"""Write raw float32 visit frames (frames/vNN.f32, per-detector vNN_dK.f32) and per-exposure
photometry for already-baked targets.

Uses only the cached SPHEREx cutouts listed in meta.json and the same reprojection /
combination code as bake.py, so no network access is needed. New bakes write these
files directly.

Usage: .venv/bin/python scripts/export_frames.py --all
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from astropy.io import fits

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake as B  # noqa: E402


def export(tid: str) -> str:
    out = B.OUT / tid
    meta = json.loads((out / "meta.json").read_text())
    n = meta["wcs"]["size_px"][0]
    cw = B.common_wcs(tuple(meta["wcs"]["crval"]), n)
    cut = meta["frame"]["cutout_deg"]
    worst = 0.0
    star = B.star_coord(meta["astrometry"])
    phot: list[dict] = []
    for vi, v in enumerate(meta["visits"]):
        by_det: dict[int, list[np.ndarray]] = {}
        for ex in v["exposures"]:
            oid, det = ex.split("/D")
            path = B.CACHE / tid / f"{oid}_D{det}_{cut:g}.fits"
            if not path.exists():
                return f"missing cache file {path.name}"
            arr, _ = B.load_exposure(path, cw, n)
            by_det.setdefault(int(det), []).append(arr)
        frame = B.combine_visit(by_det)
        B.write_f32(frame, out / f"frames/v{vi:02d}.f32")
        v["f32"] = f"frames/v{vi:02d}.f32"
        v["f32_det"] = B.write_det_frames(by_det, out, vi)
        exps = []
        for ex in v["exposures"]:
            oid, det = ex.split("/D")
            path = B.CACHE / tid / f"{oid}_D{det}_{cut:g}.fits"
            with fits.open(path) as h:
                exps.append(dict(obs_id=oid, detector=int(det), path=path, mjd=float(h["IMAGE"].header["MJD-AVG"])))
        phot += B.target_photometry(vi, exps, star)
        # sanity: re-render with the stored stretch and compare with the published PNG
        sp = meta["stretch"]
        f = np.arcsinh((np.nan_to_num(frame) - sp["vmin"]) / sp["soft"]) / np.arcsinh((sp["vmax"] - sp["vmin"]) / sp["soft"])
        grey = (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)
        from PIL import Image
        png = np.asarray(Image.open(out / v["png"]))[..., 0]
        ok = np.isfinite(frame)
        worst = max(worst, float(np.abs(np.flipud(grey).astype(int) - png.astype(int))[np.flipud(ok)].max()))
    meta["frame"]["f32"] = B.F32_NOTE
    meta["photometry"] = phot
    meta["photometry_note"] = B.PHOT_NOTE
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    good = sum(r["flux_mjy"] is not None for r in phot)
    return f"ok · {len(meta['visits'])} frames · max |PNG − re-render| = {worst:.0f}/255 · photometry {good}/{len(phot)}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("targets", nargs="*")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    idx = json.loads((B.OUT / "targets.json").read_text())
    ids = [t["id"] for t in idx["targets"] if t["status"] == "ok"] if a.all else a.targets
    for tid in ids:
        B.log(f"{tid:12s} {export(tid)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
