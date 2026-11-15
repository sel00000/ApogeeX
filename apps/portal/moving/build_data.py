"""Create a fixed-sky SPHEREx blink from actual IRSA FITS and saved MOST results.
Not a detection pipeline. MOST marks are predictions, not measured centroids.
"""
from pathlib import Path
import json, hashlib, re
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import requests
from astropy.io import fits
from astropy.wcs import WCS
from astropy.time import Time
from reproject import reproject_interp
from PIL import Image
HERE=Path(__file__).parent
DATA=HERE/'data';DATA.mkdir(exist_ok=True)
CACHE=DATA
SOURCES=[('vesta','4 Vesta','베스타','most_vesta',3,512),('atlas','3I/ATLAS','3I/ATLAS','most_atlas',4,160)]

def prepare(spec):
 key,name,ko,cache,count,size=spec
 most=json.loads((CACHE/(cache+'.json')).read_text())
 rows=[r for r in most['observations'] if r['image_id'].endswith('D6')][:count]
 center=rows[len(rows)//2]
 ra,dec=center['predicted_ra'],center['predicted_dec']
 # Same WCS/field for every epoch: motion stays in the actual image.
 n=384 if key=='vesta' else 128
 w=WCS(naxis=2);w.wcs.crpix=[(n+1)/2,(n+1)/2];w.wcs.cdelt=[-6.15/3600,6.15/3600];w.wcs.crval=[ra,dec];w.wcs.ctype=['RA---TAN','DEC--TAN']
 def one(pair):
  i,r=pair;url=r['source_url']+f'?center={ra:.7f},{dec:.7f}&size={size}pix'
  p=DATA/f'{key}_{i:02}.fits'
  if not p.exists():
   response=requests.get(url,timeout=(20,180));response.raise_for_status();p.write_bytes(response.content)
  with fits.open(p) as h:
   iw=WCS(h['IMAGE'].header,fobj=h).celestial
   image=h['IMAGE'].data.astype(float)
   flags=h['FLAGS'].data.astype(np.int64)
   # Mask only unusable/saturation flags, not SOURCE.
   bits=sum(1<<b for b in [1,2,6,9,10,11,15])
   image[(flags&bits)!=0]=np.nan
   repro,foot=reproject_interp((image,iw),w,shape_out=(n,n))
   hdr=h[0].header
   mjd=float(hdr.get('MJD-AVG',h['IMAGE'].header.get('MJD-AVG',r['prediction_mjd'])))
   x,y=w.world_to_pixel_values(r['predicted_ra'],r['predicted_dec'])
   raw_x,raw_y=iw.world_to_pixel_values(r['predicted_ra'],r['predicted_dec'])
   # The wavelength table indexes raw detector coordinates, not the celestial SIP transform.
   wave_header=h['IMAGE'].header.copy()
   for k in list(wave_header):
    if re.fullmatch(r'(A|B|AP|BP)_(ORDER|\d+_\d+)',k):del wave_header[k]
   wave=WCS(wave_header,fobj=h,key='W');cw,bw=wave.wcs_pix2world(raw_x,raw_y,0)
   meta={'index':i,'file':f'{key}_{i:02}.png','raw_file':p.name,'image_id':r['image_id'],'source_url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mjd_mid':mjd,'date_utc':Time(mjd,format='mjd').isot,'prediction_mjd':r['prediction_mjd'],'predicted_ra':r['predicted_ra'],'predicted_dec':r['predicted_dec'],'marker_x':float(x),'marker_y':float(n-1-y),'detector':'D6','predicted_wavelength_um':float(cw),'predicted_bandwidth_um':float(bw),'wavelength_source':'FITS WCS-WAVE approximate central wavelength and bandwidth at the MOST-predicted position, not a measured centroid','wavelength_note':'4.42–5.00 µm detector; wavelength varies over each exposure (LVF)','unit':h['IMAGE'].header.get('BUNIT','MJy/sr'),'valid_fraction':float(np.isfinite(repro).mean())}
  return meta,repro
 with ThreadPoolExecutor(max_workers=3) as ex:frames=list(ex.map(one,enumerate(rows)))
 valid=np.concatenate([a[np.isfinite(a)] for _,a in frames])
 med=float(np.median(valid));mad=float(np.median(np.abs(valid-med)))*1.4826
 hi=float(np.percentile(valid,99.8));den=max(hi-med,5*mad,1e-6)
 for meta,a in frames:
  z=np.arcsinh(np.clip((a-med)/den,0,None)*12)/np.arcsinh(12)
  rgba=np.zeros((n,n,4),np.uint8);gray=np.round(np.nan_to_num(z).clip(0,1)*255).astype(np.uint8)
  rgba[:,:,:3]=gray[:,:,None];rgba[:,:,3]=np.isfinite(a)*255
  Image.fromarray(rgba[::-1]).save(DATA/meta['file'])
 out={'id':key,'name':name,'ko':ko,'kind':'소행성' if key=='vesta' else '성간 혜성','release':'DR1','instrument':'NASA SPHEREx','grid':{'center_ra':ra,'center_dec':dec,'size':n,'scale_arcsec':6.15,'width_arcmin':n*6.15/60,'north':'up','east':'left','projection':'TAN'},'frames':[m for m,_ in frames],'display_stretch':{'method':'One common median-subtracted asinh stretch across epochs, display only','background_median':med,'mad_sigma':mad,'scale':den},'prediction_source':'NASA/IPAC IRSA MOST saved official result. Predicted markers are not detections or measured positions.','most_query':most['query'],'most_documentation':'https://irsa.ipac.caltech.edu/applications/MOST/','warning':'Same D6 detector does not mean identical narrow passband. Changes in appearance cannot alone establish brightness variability. Masks and coverage gaps are retained.'}
 (DATA/f'{key}.json').write_text(json.dumps(out,indent=2,ensure_ascii=False))
 print(key,n,[(m['mjd_mid'],m['valid_fraction']) for m,_ in frames],flush=True)
for spec in SOURCES:prepare(spec)
