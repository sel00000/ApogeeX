"""Meaningful read-back checks on the shipped actual moving-object observations."""
from pathlib import Path
import hashlib,json,re
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from astropy.time import Time
from PIL import Image
HERE=Path(__file__).parent;DATA=HERE/'data'
results=[]
for name in ['vesta','atlas']:
 d=json.loads((DATA/(name+'.json')).read_text());g=d['grid'];n=g['size']
 w=WCS(naxis=2);w.wcs.crpix=[(n+1)/2]*2;w.wcs.cdelt=[-6.15/3600,6.15/3600];w.wcs.crval=[g['center_ra'],g['center_dec']];w.wcs.ctype=['RA---TAN','DEC--TAN']
 last=-np.inf
 for f in d['frames']:
  p=DATA/f['raw_file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
  assert f['source_url'].startswith('https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/')
  with fits.open(p) as h:
   assert h['IMAGE'].data.shape==h['FLAGS'].data.shape
   assert h['IMAGE'].header['OBSID'] in f['image_id']
   midpoint=h[0].header.get('MJD-AVG',h['IMAGE'].header.get('MJD-AVG'))
   assert abs(midpoint-f['mjd_mid'])<1e-8
   assert midpoint>last;last=midpoint
   wh=h['IMAGE'].header.copy()
   for k in list(wh):
    if re.fullmatch(r'(A|B|AP|BP)_(ORDER|\d+_\d+)',k):del wh[k]
   celestial=WCS(h['IMAGE'].header,fobj=h).celestial
   px,py=celestial.world_to_pixel_values(f['predicted_ra'],f['predicted_dec'])
   cw,bw=WCS(wh,fobj=h,key='W').wcs_pix2world(px,py,0)
   assert abs(float(cw)-f['predicted_wavelength_um'])<1e-9
   assert abs(float(bw)-f['predicted_bandwidth_um'])<1e-9
   assert 4.4<float(cw)<5.1 and .01<float(bw)<.1
  assert f['valid_fraction']>.95
  with Image.open(DATA/f['file']) as im:assert im.size==(n,n);im.verify()
  x,y=w.world_to_pixel_values(f['predicted_ra'],f['predicted_dec'])
  assert abs(x-f['marker_x'])<1e-6 and abs((n-1-y)-f['marker_y'])<1e-6
  # Fixed-sky grid, north up and east left; no target tracking/artificial shifts.
  xx,yy=w.world_to_pixel_values(g['center_ra']+.001,g['center_dec']+.001)
  assert xx<(n-1)/2 and yy>(n-1)/2
 distance=float(np.hypot(d['frames'][-1]['marker_x']-d['frames'][0]['marker_x'],d['frames'][-1]['marker_y']-d['frames'][0]['marker_y']))
 results.append({'target':name,'frames':len(d['frames']),'actual_FITS_sha256_verified':True,'midpoint_order_and_header_match':True,'fixed_TAN_grid_marker_exact':True,'PNG_dimensions_verified':True,'north_up_east_left':True,'target_position_wavelength_header_match':True,'predicted_motion_pixels':distance,'detection_claim':False})
for name in ['hygiea','dembowska','eros','kollaa']:
 d=json.loads((DATA/(name+'.json')).read_text());assert d['provenance']['nKept']==len([p for p in d['points'] if p['kept']]);assert all(p['wavelength_um']>0 for p in d['points'])
 results.append({'spectrum':name,'provenance_and_point_count_match':True,'measurements':len(d['points'])})
(HERE/'data_validation.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
