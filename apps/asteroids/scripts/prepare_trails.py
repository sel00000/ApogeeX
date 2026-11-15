"""Project each prepared exposure's astrometric position into every comparison image.
Every point is tied to a real exposure; out-of-frame points remain flagged, never clamped.
"""
from prepare import OUT, WCS, np, json

def main():
 obs=json.loads((OUT/'observations.json').read_text(encoding="utf-8"));sequences=json.loads((OUT/'comparisons.json').read_text(encoding="utf-8"));groups=[s['frames'] for s in sequences]
 for ident in sorted({o['objectId'] for o in obs}):
  g=[o for o in obs if o['objectId']==ident and o['image']]
  if g:groups.append(g)
 result={}
 for group in groups:
  group=sorted(group,key=lambda o:(o['mjd'],o['id']))
  for current in group:
   im=current['image'];w=WCS(im['wcs']);points=[]
   for i,o in enumerate(group):
    try:
     # A point behind the TAN plane has no pixel solution; do not feed NaNs to the SIP solver.
     if not np.isfinite(w.wcs_world2pix([[o['ra'],o['dec']]],0)).all():
      raise ValueError('Position outside tangent projection')
     x,y=w.all_world2pix([[o['ra'],o['dec']]],0,tolerance=1e-8,maxiter=50)[0];x,y=float(x),im['height']-1-float(y)
    except Exception:
     x,y=float('nan'),float('nan')
    valid=bool(np.isfinite(x) and np.isfinite(y));inside=bool(valid and -.5<=x<im['width']-.5 and -.5<=y<im['height']-.5)
    points.append(dict(id=o['id'],objectId=o['objectId'],mjd=o['mjd'],order=i+1,x=x if valid else None,y=y if valid else None,inside=inside))
   result[im['path']]=dict(points=points,currentId=current['id'],objectId=current['objectId'],source='JPL astrometric positions at actual prepared exposure times, reprojected into this FITS WCS')
 (OUT/'trails.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False), encoding="utf-8")
 print(len(result),'image trails',len({x['objectId'] for x in result.values()}),'objects')
if __name__=='__main__':main()
