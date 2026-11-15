#!/usr/bin/env python3
"""Fetch the SPHEREx ZODI (zodiacal-light model) plane for every exposure already used by a target
(analysis and wide frames). One 0.5° cutout per exposure around the frame centre covers both.
At most B.MAX_CONCURRENT (3) requests to IRSA at once; files already present are skipped.

Usage: .venv/bin/python scripts/fetch_zodi.py barnard wise0855 ...   (or --all)
"""
from __future__ import annotations
import concurrent.futures as cf, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake as B  # noqa: E402

TARGETS = ["barnard", "eps_indi_b", "wise0855", "rw_aur", "r_dra"]
SIZE = 0.5


def run(tid: str) -> str:
    meta = json.loads((B.OUT / tid / "meta.json").read_text())
    ra, dec = meta["wcs"]["crval"]
    jobs: dict[str, dict] = {}
    # exposures in the 0.3° context frames need a cutout covering them; the rest only the 0.1° frame
    wide = {ex for w in (meta.get("wide") or {}).get("visits", []) if w for ex in w.get("exposures", [])}
    small = meta["frame"]["cutout_deg"] + 0.07
    for v in meta["visits"]:
        for ex, u in zip(v["exposures"], v["irsa_uris"]):
            oid, det = ex.split("/D")
            jobs[ex] = dict(obs_id=oid, detector=int(det), url=u, size=SIZE if ex in wide else small)
    B.log(f"== {tid}: ZODI for {len(jobs)} exposures")
    ok = fail = 0
    with cf.ThreadPoolExecutor(max_workers=B.MAX_CONCURRENT) as pool:
        fut = {pool.submit(B.fetch_zodi, e, ra, dec, e["size"], B.CACHE / tid): e for e in jobs.values()}
        for i, f in enumerate(cf.as_completed(fut), 1):
            try:
                f.result(); ok += 1
            except Exception as ex:  # noqa: BLE001
                fail += 1; B.log(f"   ! {fut[f]['obs_id']} D{fut[f]['detector']}: {ex}")
            if i % 50 == 0 or i == len(jobs):
                B.log(f"   {i}/{len(jobs)}")
    return f"{tid}: ZODI {ok} ok, {fail} failed"


if __name__ == "__main__":
    ids = TARGETS if "--all" in sys.argv else [a for a in sys.argv[1:] if not a.startswith("-")]
    for t in ids:
        print(run(t), flush=True)
