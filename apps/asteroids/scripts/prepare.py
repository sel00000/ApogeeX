"""Prepare reproducible, cached NASA data. All network calls are serial."""
from pathlib import Path
import json, csv, hashlib, time, re, argparse, os
import requests
import numpy as np
from astropy.time import Time
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1]
SOURCE=Path(os.environ.get('SPHEREX_SCENE_SOURCE',PROJECT/'data/prepared/asteroids'))
DATABASE=Path(os.environ.get('SPHEREX_SCENE_DB',SOURCE/'asteroids.sqlite'))
SOURCE_COMMIT=os.environ.get('SPHEREX_SCENE_SOURCE_COMMIT','local-working-tree')
OUT=Path(os.environ.get('SPHEREX_SCENE_OUT',ROOT/'public/data')); CACHE=Path(os.environ.get('SPHEREX_SCENE_CACHE',PROJECT/'var/cache/asteroid-scene')); OUT.mkdir(parents=True,exist_ok=True); CACHE.mkdir(parents=True,exist_ok=True)
SESSION=requests.Session(); SESSION.headers['User-Agent']='SPHERExSkyLab/5.0 (+https://github.com/sel00000/S)'
URL='https://ssd.jpl.nasa.gov/api/horizons.api'
def image_key(url,params):
    return hashlib.sha256(json.dumps([url,params],sort_keys=True).encode()).hexdigest()[:24]

def fetch(url,params=None):
    key=hashlib.sha256(json.dumps([url,params],sort_keys=True).encode()).hexdigest(); p=CACHE/key
    if p.exists(): return p.read_bytes()
    for attempt in range(3):
        try:
            r=SESSION.get(url,params=params,timeout=90); r.raise_for_status()
            p.write_bytes(r.content); p.with_suffix('.meta.json').write_text(json.dumps(dict(url=url,params=params,retrievedUTC=Time.now().isot,sha256=hashlib.sha256(r.content).hexdigest())), encoding="utf-8"); return r.content
        except requests.RequestException:
            if attempt==2: raise
            time.sleep(2**attempt)

def horizons(command,extra):
    params=dict(format='json',COMMAND=f"'{command}'",OBJ_DATA='NO',CSV_FORMAT='YES',**extra)
    raw=fetch(URL,params); d=json.loads(raw); result=d.get('result','')
    if '$$SOE' not in result: raise ValueError(d.get('error',result[:300]))
    rows=list(csv.reader(result.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()))
    return rows,dict(url=URL,params=params,signature=d.get('signature'),sha256=hashlib.sha256(raw).hexdigest())
def vectors(command,start,end,step='1 d',epochs=None):
    args=dict(EPHEM_TYPE='VECTORS',CENTER="'500@10'",REF_PLANE='ECLIPTIC',REF_SYSTEM='ICRF',OUT_UNITS='AU-D',VEC_CORR='NONE',VEC_TABLE='2',TIME_TYPE='TDB')
    if epochs is None: args.update(START_TIME=f"'JD{start}'",STOP_TIME=f"'JD{end}'",STEP_SIZE=f"'{step}'")
    else: args.update(TLIST="'"+'\n'.join(str(x) for x in epochs)+"'",TLIST_TYPE='JD')
    rows,source=horizons(command,args)
    return [[float(r[0])-2400000.5,*map(float,r[2:8])] for r in rows],source

def hermite(a,b,t):
    h=b[0]-a[0]; u=(t-a[0])/h
    return (2*u**3-3*u*u+1)*np.array(a[1:4])+(u**3-2*u*u+u)*h*np.array(a[4:7])+(-2*u**3+3*u*u)*np.array(b[1:4])+(u**3-u*u)*h*np.array(b[4:7])
def clean(v):
    try:
        x=float(v); return x if np.isfinite(x) else None
    except (ValueError,TypeError): return None

def canonical_id(record, fallback=''):
    name=record.get('official_name') or ''
    match=re.match(r'(\d+)\s',name)
    provisional_name=re.fullmatch(r'\d{4}\s+[A-Z]{1,2}\d*',name.split(' (')[0].strip())
    ident=match.group(1) if match and not provisional_name else str(record.get('asteroid_id') or record.get('provisional_designation') or fallback).strip()
    if not ident or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9 ()._+-]{0,79}',ident):
        raise ValueError('No supported canonical asteroid identifier')
    return ident

def main():
    objects=[]; observations=[]; warnings=[]; sources=[]
    for folder in sorted(SOURCE.iterdir()):
        if not (folder/'stage1_observations.csv').exists() or not (folder/'integrated_record.json').exists(): continue
        rec=json.loads((folder/'integrated_record.json').read_text(encoding="utf-8")); name=rec.get('official_name','')
        # Catalogue name yields numbered-asteroid designation even for historical aliases.
        ident=canonical_id(rec,folder.name)
        if any(o['id']==ident for o in objects): continue
        rows=list(csv.DictReader((folder/'stage1_observations.csv').open()))
        spectra={}
        sf=folder/'stage2_spectrum.csv'
        if sf.exists(): spectra={(r['obs_id'],r['detector']):r for r in csv.DictReader(sf.open())}
        label=name.split(' (')[0]
        if label==ident: label=name # Unnamed numbered targets retain their provisional designation.
        objects.append(dict(id=ident,name=label,kind='asteroid',command=ident+';'))
        for r in rows:
            s=spectra.get((r['obs_id'],r['detector']),{})
            observations.append(dict(objectId=ident,id=r['obs_id']+'-D'+r['detector'],mjd=float(r['mjd_mid']),ra=float(r['pred_ra_deg']),dec=float(r['pred_dec_deg']),detector=int(r['detector']),url=r['image_url'],quality=s.get('quality_flag','UNMEASURED'),snr=clean(s.get('snr')),wavelength=clean(s.get('wavelength_um')),measuredRa=clean(s.get('measured_ra_deg')),measuredDec=clean(s.get('measured_dec_deg')),offset=clean(s.get('position_offset_arcsec')),ephemeris=r.get('ephemeris_source','unknown'),image=None))
    # Some legacy records exist only in SQLite; retain their real observation metadata.
    import sqlite3
    db=sqlite3.connect(DATABASE.resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    for rec in db.execute('select asteroid_id,official_name from results'):
        ident=canonical_id(dict(rec))
        if any(o['id']==ident for o in objects):continue
        objects.append(dict(id=ident,name=rec['official_name'].split(' (')[0],kind='asteroid',command=ident+';'))
        for r in db.execute('select * from observations where asteroid_id=?',(rec['asteroid_id'],)):
            observations.append(dict(objectId=ident,id=r['obs_id']+'-D'+str(r['detector']),mjd=r['mjd_mid'],ra=r['pred_ra_deg'],dec=r['pred_dec_deg'],detector=r['detector'],url=r['image_url'],quality='UNMEASURED',snr=None,wavelength=None,measuredRa=None,measuredDec=None,offset=None,ephemeris=r['ephemeris_source'],image=None))
    db.close()
    if not observations: raise ValueError('No actual observation rows are available for a 3D scene.')
    start=min(o['mjd'] for o in observations); end=max(o['mjd'] for o in observations)
    if start < Time('2025-01-01',scale='utc').mjd or end >= Time('2027-01-01',scale='utc').mjd:
        raise ValueError('The 3D replay UTC/TDB conversion is validated for 2025–2026 only. The scientific result remains available.')
    # Padding supplies interpolation brackets; the UI still uses observation-only bounds.
    jd0=np.floor(Time(start,format='mjd',scale='utc').tdb.jd)-1; jd1=np.ceil(Time(end,format='mjd',scale='utc').tdb.jd)+1
    planets=[('199','수성','#ad9b89'),('299','금성','#d9bd8c'),('399','지구','#63b9dd'),('499','화성','#dc8864'),('599','목성','#c6b19e'),('699','토성','#d9c18b'),('799','천왕성','#8acdcc'),('899','해왕성','#6f8cde')]
    bodies=[dict(id=i,name=n,color=c,kind='planet',command=i) for i,n,c in planets]+objects
    validation=[]
    for body in bodies:
        print('Horizons',body['name'],flush=True)
        data,src=vectors(body.pop('command'),jd0,jd1)
        body['samples']=data; sources.append(src)
        cmd=body['id']+(';' if body['kind']=='asteroid' else '')
        mids=[(data[i][0]+data[i+1][0])/2+2400000.5 for i in np.linspace(0,len(data)-2,5,dtype=int)]
        exact,checksrc=vectors(cmd,jd0,jd1,epochs=mids); sources.append(checksrc)
        error=[]
        for row in exact:
            ix=int(np.searchsorted([x[0] for x in data],row[0])-1)
            error.append(float(np.linalg.norm(hermite(data[ix],data[ix+1],row[0])-row[1:4])))
        validation.append(dict(id=body['id'],maxInterpolationErrorAU=max(error),checkedEpochs=5))
        (OUT/'bodies.json').write_text(json.dumps(bodies[:bodies.index(body)+1],separators=(',',':')), encoding="utf-8")
    # Prepare a bounded representative image set, no invented detections.
    images=OUT/'images'; images.mkdir(exist_ok=True)
    for obj in objects:
        candidates=[o for o in observations if o['objectId']==obj['id'] and o['quality']=='GOOD' and o['snr'] and o['snr']>=5 and '500@-163182' in o['ephemeris']]
        unique={}
        for o in sorted(candidates,key=lambda o:-(o['snr'] or 0)): unique.setdefault(o['mjd'],o)
        choices=sorted(unique.values(),key=lambda o:o['mjd'])
        selected=[choices[i] for i in sorted(set(np.linspace(0,len(choices)-1,min(len(choices),8 if obj['id']=='433' else 3),dtype=int)))] if choices else []
        for obs in selected:
            print('Image',obj['name'],obs['mjd'],flush=True)
            try:
                params=dict(center=f"{obs['ra']},{obs['dec']}d",size='0.12')
                raw=fetch(obs['url'],params)
                import io
                with fits.open(io.BytesIO(raw)) as hd:
                    h=hd['IMAGE']; a=np.array(h.data,dtype=float); w=WCS(h.header).celestial
                    assert h.header.get('RADESYS') == 'ICRS', 'Unverified image reference frame'
                    assert h.header.get('TIMESYS') == 'UTC', 'Unverified image time scale'
                    assert abs(float(h.header['MJD-AVG'])-obs['mjd'])*86400 < .01, 'Exposure midpoint mismatch'
                    px,py=w.world_to_pixel_values(obs['ra'],obs['dec']); px=float(px);py=float(py)
                    if not (0<=px<a.shape[1] and 0<=py<a.shape[0]): raise ValueError('Prediction outside image')
                    lo,hi=np.nanpercentile(a,[10,99.5]); norm=np.arcsinh(np.clip((a-lo)/max(hi-lo,1e-12),0,3)*8)/np.arcsinh(8)
                    pixels=np.uint8(np.nan_to_num(np.clip(norm,0,1))*255)
                    filename=image_key(obs['url'],params)+'.png'
                    Image.fromarray(np.flipud(pixels)).save(images/filename)
                    rr,dd=w.pixel_to_world_values(px,py)
                    mx,my=w.world_to_pixel_values(obs['measuredRa'],obs['measuredDec']) if obs['measuredRa'] is not None else (None,None)
                    header=dict(w.to_header(relax=True)); header.update({k:h.header[k] for k in ('TIMESYS','MJD-AVG','MJD-BEG','MJD-END')})
                    obs['image']=dict(path='images/'+filename,width=a.shape[1],height=a.shape[0],predicted=[px,a.shape[0]-1-py],measured=[float(mx),a.shape[0]-1-float(my)] if mx is not None else None,wcs=header,roundtripArcsec=float(np.hypot((rr-obs['ra'])*np.cos(np.deg2rad(dd)),dd-obs['dec'])*3600),stretch=dict(method='per-image asinh',low=float(lo),high=float(hi)),fitsSHA256=hashlib.sha256(raw).hexdigest(),query=params)
                    # Retain quality as measured candidate, never automatic identity confirmation.
                    obs['positionStatus']='측광 후보 · 독립 검출 확정 아님'
            except Exception as e: obs['availabilityReason']=str(e); warnings.append(dict(id=obs['id'],error=str(e))); print('WARN',e,flush=True)
    for o in observations:
        if not o['image'] and 'availabilityReason' not in o:
            o['availabilityReason']='대표 영상 선별 범위 밖' if o['quality']=='GOOD' else '측광 품질 '+o['quality']+' · 영상 미준비'
    observations.sort(key=lambda o:o['mjd'])
    (OUT/'observations.json').write_text(json.dumps(observations,separators=(',',':'),ensure_ascii=False), encoding="utf-8")
    (OUT/'manifest.json').write_text(json.dumps(dict(version=1,start=start,end=end,frame='Heliocentric J2000 ecliptic / AU',time='vectors: MJD TDB; observations/UI: MJD UTC',tdbMinusUtcSeconds=69.184,sourceRepository='https://github.com/sel00000/S',sourceCommit=SOURCE_COMMIT,generatedUTC=Time.now().isot,sources=sources,validation=validation,warnings=warnings),ensure_ascii=False,separators=(',',':')), encoding="utf-8")
    print('DONE',len(bodies),len(observations),sum(o['image'] is not None for o in observations),flush=True)
if __name__=='__main__': main()
