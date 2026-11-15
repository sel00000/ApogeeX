"""Attach exact spacecraft vectors at each prepared image epoch; no LEO interpolation."""
from prepare import *

def main():
 obs=json.loads((OUT/'observations.json').read_text(encoding="utf-8")); epochs=sorted(set(o['mjd'] for o in obs if o['image']))
 if not epochs:
  print('No prepared images; preserving orbit-only scene.',flush=True)
  return
 rows,source=vectors('-163182',0,0,epochs=[float(Time(t,format='mjd',scale='utc').tdb.jd) for t in epochs])
 if len(rows)!=len(epochs):raise ValueError('Spacecraft epoch count mismatch')
 for o in obs:
  if o['image']:
   i=epochs.index(o['mjd']); expected=Time(o['mjd'],format='mjd',scale='utc').tdb.mjd
   if abs(rows[i][0]-expected)>1e-7:raise ValueError('Spacecraft epoch mismatch')
   o['spacecraft']=rows[i][1:4]
 (OUT/'observations.json').write_text(json.dumps(obs,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 m=json.loads((OUT/'manifest.json').read_text(encoding="utf-8"));m['sources'].append(source);m['spacecraft']='Exact Horizons -163182 vectors at image midpoints, heliocentric J2000 ecliptic AU';(OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 print('Spacecraft epochs',len(rows))
 # Independent astrometric RA/Dec at exact UTC midpoint from spacecraft observer.
 # Quantity 1 = astrometric ICRF RA/Dec; geometric state alone is not a substitute.
 from astropy.coordinates import SkyCoord
 import astropy.units as u
 checks=[]
 for ident in sorted(set(o['objectId'] for o in obs if o['image'])):
  selected=[o for o in obs if o['objectId']==ident and o['image']]
  epochs=sorted(set(o['mjd'] for o in selected))
  rows,source=horizons(ident+';',dict(EPHEM_TYPE='OBSERVER',CENTER="'500@-163182'",TLIST="'"+'\n'.join(str(t+2400000.5) for t in epochs)+"'",TLIST_TYPE='JD',TIME_TYPE='UT',QUANTITIES="'1'",REF_SYSTEM='ICRF',ANG_FORMAT='DEG',EXTRA_PREC='YES',CAL_FORMAT='JD'))
  m['sources'].append(source)
  if len(rows)!=len(epochs):raise ValueError('Observer epoch count mismatch')
  for o in selected:
   row=rows[epochs.index(o['mjd'])]
   if abs(float(row[0])-2400000.5-o['mjd'])>1e-6:raise ValueError('Observer epoch mismatch')
   ra,dec=float(row[3]),float(row[4]);w=WCS(o['image']['wcs']).celestial
   x,y=w.world_to_pixel_values(ra,dec);new=[float(x),o['image']['height']-1-float(y)]
   delta=float(np.hypot(*(np.array(new)-o['image']['predicted'])))
   checks.append(dict(id=o['id'],pixelDelta=delta))
   o['importedRa']=o['ra'];o['importedDec']=o['dec'];o['ra']=ra;o['dec']=dec;o['image']['predicted']=new
   o['independentObserverPixelDelta']=delta
   o['directionDefinition']='Horizons quantity 1: astrometric ICRF RA/Dec, SPHEREx, UTC exposure midpoint'
   if o['measuredRa'] is not None:o['offset']=float(SkyCoord(ra*u.deg,dec*u.deg).separation(SkyCoord(o['measuredRa']*u.deg,o['measuredDec']*u.deg)).arcsec)
  print('Observer verified',ident,max(c['pixelDelta'] for c in checks if c['id'] in [o['id'] for o in selected]),flush=True)
 m['observerValidation']=checks
 (OUT/'observations.json').write_text(json.dumps(obs,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 (OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 print('Observer registration checks',len(checks))

if __name__=='__main__':main()
