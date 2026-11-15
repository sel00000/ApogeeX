#!/usr/bin/env python3
"""Independent WCS + raw-file audit of all five SPHEREx wide-context datasets."""
import argparse
import json
from pathlib import Path
import numpy as np
import bake as B
from check_geometry import radec_of

parser=argparse.ArgumentParser();parser.add_argument('targets',nargs='*');args=parser.parse_args()
rows=[]
for tid in (args.targets or ['barnard','eps_indi_b','wise0855','rw_aur','r_dra']):
    folder=B.OUT/tid
    m=json.loads((folder/'meta.json').read_text());w=m['wide'];N=w['size_px'][0];n=m['wcs']['size_px'][0]
    assert w['offset_px']==(N-n)/2,(tid,'offset')
    assert len(w['visits'])==len(m['visits']),(tid,'visits')
    cw=B.common_wcs(tuple(m['wcs']['crval']),N)
    worst=0;finite=[];files=0;missing=0
    for v,f in zip(m['visits'],w['visits']):
        ra,dec=radec_of(np.subtract(v['target_au'],v['earth_au']))
        x,y=cw.world_to_pixel_values(ra,dec)
        # Astropy zero-based pixel centre -> image top-left corner convention.
        expected=np.asarray([float(x)+.5,N-float(y)-.5])
        worst=max(worst,float(np.linalg.norm(expected-(np.asarray(v['pred_px'])+w['offset_px']))))
        if f is None: missing+=1;continue
        assert f['n_exp']<=8
        for name in [f['f32'],*f['f32_det'].values()]:
            a=np.fromfile(folder/name,dtype='<f4');assert a.size==N*N,(tid,name,a.size);assert not np.isinf(a).any();files+=1
        a=np.fromfile(folder/f['f32'],dtype='<f4');finite.append(float(np.isfinite(a).mean()))
    assert worst<.01,(tid,worst)
    assert all(v>0 for v in finite),(tid,'all missing pixels')
    # Coarse image-registration diagnostic: compare the most widely separated
    # available pair in one detector; remove target and clip bright outliers.
    choices=[]
    for d in '123456':
        ids=[i for i,v in enumerate(w['visits']) if v and d in v['f32_det']]
        if len(ids)>1: choices.append((m['visits'][ids[-1]]['mjd']-m['visits'][ids[0]]['mjd'],d,ids[0],ids[-1]))
    background=None
    if choices:
        days,d,i,j=max(choices)
        a=np.fromfile(folder/w['visits'][i]['f32_det'][d],dtype='<f4').reshape(N,N)
        b=np.fromfile(folder/w['visits'][j]['f32_det'][d],dtype='<f4').reshape(N,N)
        yy,xx=np.indices((N,N));valid=np.isfinite(a)&np.isfinite(b)&((xx-N/2)**2+(yy-N/2)**2>12**2)
        if valid.sum()>100:
            for arr in [a,b]:
                values=arr[valid];arr[:]=np.where(valid,np.clip(np.nan_to_num(arr),*np.percentile(values,[5,99.5]))-np.median(values),0)
            corr=np.fft.ifft2(np.fft.fft2(a)*np.conj(np.fft.fft2(b))).real
            peak=np.unravel_index(np.argmax(corr),corr.shape)
            background=dict(detector=d,visits=[i,j],days=days,integer_shift_yx=[int(v if v<=N//2 else v-N) for v in peak])
    rows.append(dict(background_registration=background,id=tid,size=N,offset=w['offset_px'],visits=len(w['visits']),missing_visits=missing,files=files,max_wcs_error_px=worst,min_finite_fraction=min(finite),field_arcmin=N*m['wcs']['cdelt_arcsec']/60))
print(json.dumps(dict(pass_=True,targets=rows),indent=2))
