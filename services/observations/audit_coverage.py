#!/usr/bin/env python3
"""Read-only coverage audit: current public IRSA rows vs baked exposures. No image downloads."""
import json,collections,datetime
from pathlib import Path
import numpy as np
from astropy.time import Time
import bake as B

out=[]
for tid in ['barnard','eps_indi_b','wise0855','rw_aur','r_dra']:
    m=json.loads((B.OUT/tid/'meta.json').read_text());star=B.star_coord(m['astrometry'])
    ra,dec=B.apparent_radec(B.target_bary_au(star,Time(2026.0,format='jyear',scale='tdb')),B.earth_bary_au(Time(2026.0,format='jyear',scale='tdb')))
    cols=','.join("'"+c+"'" for c in B.COLLECTIONS)
    q=f"SELECT obs_id,obs_collection,energy_bandpassname,t_min,t_max,obs_publisher_did FROM spherex.obscore WHERE CONTAINS(POINT('ICRS',{ra},{dec}),s_region)=1 AND obs_collection IN ({cols})"
    print('Querying',tid,flush=True)
    table=B.tap().search(q,maxrec=100000).to_table()
    archive=[]
    for r in table:
        archive.append(dict(key=str(r['obs_id'])+'/D'+str(r['energy_bandpassname']).split('-D')[-1],collection=str(r['obs_collection']),t_min=float(r['t_min']),did=str(r['obs_publisher_did'])))
    used={ex for v in m['visits'] for ex in v['exposures']};eligible={r['key'] for r in archive if not m['frame'].get('detectors') or int(r['key'].split('/D')[-1]) in m['frame']['detectors']}
    archkeys={r['key'] for r in archive};phot=m.get('photometry',[]);photkeys={r['exposure'] for r in phot};errors=[];finite=[]
    for vi,v in enumerate(m['visits']):
        for name in [v.get('f32'),*v.get('f32_det',{}).values()]:
            if not name:errors.append([vi,'no f32']);continue
            p=B.OUT/tid/name
            if not p.exists():errors.append([vi,'missing',name]);continue
            a=np.fromfile(p,dtype='<f4');N=m['wcs']['size_px'][0]
            if a.size!=N*N:errors.append([vi,'size',name])
            if np.isinf(a).any():errors.append([vi,'infinity',name])
            finite.append(float(np.isfinite(a).mean()))
    row=dict(id=tid,query=q,archive_rows=len(archive),archive_unique=len(archkeys),archive_collections=dict(collections.Counter(r['collection'] for r in archive)),used=len(used),used_collections=dict(collections.Counter(r['collection'] for r in archive if r['key'] in used)),eligible_unique=len(eligible),eligible_missing=len(eligible-used),missing_examples=sorted(eligible-used)[:20],used_not_in_archive=sorted(used-archkeys)[:20],phot_rows=len(phot),phot_missing=sorted(used-photkeys),phot_extra=sorted(photkeys-used),wide_visits=len(m.get('wide',{}).get('visits',[])),file_errors=errors,min_finite_fraction=min(finite),policy={k:m['frame'].get(k) for k in ['detectors','max_exp_per_visit','min_visit_spacing_days']})
    out.append(row)
    Path('docs/audits/coverage.json').write_text(json.dumps(dict(queried_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),targets=out),ensure_ascii=False,indent=2))
    print(tid,row['archive_rows'],row['used'],row['eligible_missing'],flush=True)
