#!/usr/bin/env python3
"""Sanity checks on baked geometry.

  - every visit's pred_px lies inside the frame
  - Barnard's Star moves ~1.7 px per year (10.4"/yr / 6.15"/px)
  - pred_px is re-derived independently from earth_au/target_au + the common WCS
  - measured centroids (if any) agree with predictions (reported, in sigma)
Exit code 1 if any hard check fails.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "public" / "data"


def tan_project(ra, dec, ra0, dec0):
    """Gnomonic projection, returns (xi, eta) in degrees (xi toward east)."""
    ra, dec, ra0, dec0 = map(np.radians, (ra, dec, ra0, dec0))
    cosc = np.sin(dec0) * np.sin(dec) + np.cos(dec0) * np.cos(dec) * np.cos(ra - ra0)
    xi = np.cos(dec) * np.sin(ra - ra0) / cosc
    eta = (np.cos(dec0) * np.sin(dec) - np.sin(dec0) * np.cos(dec) * np.cos(ra - ra0)) / cosc
    return np.degrees(xi), np.degrees(eta)


def radec_of(v):
    v = np.asarray(v, float)
    r = np.linalg.norm(v)
    return np.degrees(np.arctan2(v[1], v[0])) % 360, np.degrees(np.arcsin(v[2] / r))


def check(meta: dict) -> list[str]:
    errs = []
    n = meta["wcs"]["size_px"][0]
    s = meta["wcs"]["cdelt_arcsec"] / 3600
    ra0, dec0 = meta["wcs"]["crval"]
    print(f"\n== {meta['id']}  ({len(meta['visits'])} visits, frame {n}x{n})")

    # 1. inside frame + independent re-derivation of pred_px
    worst = 0.0
    for i, v in enumerate(meta["visits"]):
        x, y = v["pred_px"]
        if not (0 <= x <= n and 0 <= y <= n):
            errs.append(f"visit {i}: pred_px {v['pred_px']} outside frame")
        ra, dec = radec_of(np.subtract(v["target_au"], v["earth_au"]))
        xi, eta = tan_project(ra, dec, ra0, dec0)
        xp, yp = n / 2 - xi / s, n / 2 - eta / s  # east left, north up; PNG corner origin
        worst = max(worst, float(np.hypot(xp - x, yp - y)))
    print(f"   pred_px inside frame: {'OK' if not errs else 'FAIL'}")
    print(f"   pred_px vs independent TAN re-derivation: max diff {worst:.4f} px")
    if worst > 0.01:
        errs.append(f"pred_px re-derivation differs by {worst:.4f} px")

    # 2. yearly proper-motion displacement in pixels
    a = meta["astrometry"]
    pm_px = np.hypot(a["pmra"], a["pmdec"]) / 1000 / meta["wcs"]["cdelt_arcsec"]
    plx_px = a["parallax_mas"] / 1000 / meta["wcs"]["cdelt_arcsec"]
    print(f"   proper motion: {pm_px:.3f} px/yr   parallax amplitude: {plx_px:.3f} px  [catalog]")
    vs = meta["visits"]
    span = (vs[-1]["mjd"] - vs[0]["mjd"]) / 365.25
    d = np.hypot(*np.subtract(vs[-1]["pred_px"], vs[0]["pred_px"]))
    print(f"   predicted first→last visit: {d:.3f} px over {span:.3f} yr (includes parallax)")
    if meta["id"] == "barnard" and not (1.6 < pm_px < 1.8):
        errs.append(f"Barnard pm {pm_px:.3f} px/yr not ~1.7")

    # 3. measured vs predicted
    res = [(np.subtract(v["meas_px"], v["pred_px"]), v["meas_err_px"])
           for v in vs if v.get("meas_px") is not None]
    if res:
        dd = np.array([r[0] for r in res])
        sig = np.array([np.hypot(*r[0]) / r[1] for r in res])
        print(f"   measured {len(res)}/{len(vs)} visits: mean offset ({dd[:, 0].mean():+.3f}, {dd[:, 1].mean():+.3f}) px, "
              f"rms {np.sqrt((dd ** 2).sum(1).mean()):.3f} px, median |Δ|/σ {np.median(sig):.2f}")
    else:
        print("   no measured centroids")
    return errs


def main() -> int:
    idx = json.loads((DATA / "targets.json").read_text())
    bad = []
    for t in idx["targets"]:
        if t["status"] != "ok":
            print(f"\n== {t['id']}: status {t['status']} — skipped ({t.get('status_detail')})")
            continue
        errs = check(json.loads((DATA / t["id"] / "meta.json").read_text()))
        for e in errs:
            print(f"   FAIL: {e}")
        bad += errs
    print("\nALL OK" if not bad else f"\n{len(bad)} failure(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
