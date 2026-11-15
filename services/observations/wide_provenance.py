#!/usr/bin/env python3
"""Attach selected exposure provenance to existing wide frames using cache only.
Run after bake_wide has exited; never downloads or modifies observed pixels.
"""
import argparse
import json
import bake as B
from bake_wide import pick, MAX_PER_VISIT
parser=argparse.ArgumentParser();parser.add_argument('targets',nargs='*');args=parser.parse_args()
for tid in (args.targets or ['barnard','eps_indi_b','wise0855','rw_aur','r_dra']):
    folder=B.OUT/tid;m=json.loads((folder/'meta.json').read_text());wide=m['wide']
    for v,w in zip(m['visits'],wide['visits']):
        if w is None:continue
        chosen=pick(v['exposures'],v['irsa_uris'],MAX_PER_VISIT)
        cached=[(ex,uri) for ex,uri in chosen if (B.CACHE/tid/(ex.replace('/D','_D')+f"_{wide['cutout_deg']:g}.fits")).exists()]
        assert len(cached)==w['n_exp'],(tid,'cache changed after bake; do not infer provenance')
        w.update(failed_exp=len(chosen)-len(cached),exposures=[x for x,_ in cached],irsa_uris=[u for _,u in cached])
    tmp=folder/'meta.provenance.tmp';tmp.write_text(json.dumps(m,ensure_ascii=False,indent=1));tmp.replace(folder/'meta.json')
    print(tid,'provenance recorded; failed exposures',sum((v or {}).get('failed_exp',0) for v in wide['visits']))
