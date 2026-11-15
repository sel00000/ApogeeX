"""Same-sky registration of real consecutive images; never shift to follow asteroid."""
from prepare import *
from scipy.ndimage import map_coordinates
import io
from itertools import combinations

def common_subset(masks, positions):
 """Drop detector-edge exposures, preserving the largest genuine common-sky set."""
 for count in range(len(masks),1,-1):
  best=None;best_score=None
  for ids in combinations(range(len(masks)),count):
   common=np.logical_and.reduce([masks[i] for i in ids]);coverage=float(common.mean())
   if coverage<.75:continue
   if any(not(0<=positions[i][0]<common.shape[1] and 0<=positions[i][1]<common.shape[0]) or not common[positions[i][1],positions[i][0]] for i in ids):continue
   motion=float(np.linalg.norm(np.array(positions[ids[-1]])-positions[ids[0]]))
   score=(motion,coverage)
   if best_score is None or score>best_score:best,best_score=(ids,common,coverage),score
  if best is not None:return best
 return None

def prepare_group(ident,g):
 angles=np.deg2rad([o['ra'] for o in g]);center_ra=float(np.rad2deg(np.arctan2(np.mean(np.sin(angles)),np.mean(np.cos(angles))))%360)
 cr=[center_ra,float(np.mean([o['dec'] for o in g]))];w=WCS(naxis=2);w.wcs.ctype=['RA---TAN','DEC--TAN'];w.wcs.crval=cr;w.wcs.crpix=[65,65];w.wcs.cdelt=[-6.15/3600,6.15/3600];w.wcs.radesys='ICRS'
 yy,xx=np.indices((128,128));ra,dec=w.pixel_to_world_values(xx,yy);frames=[];arrays=[];masks=[];srcs=[]
 print('Fixed sky',ident,len(g),flush=True)
 for o in g:
  try:
   params=dict(center=f'{cr[0]},{cr[1]}d',size='.25');raw=fetch(o['url'],params)
   with fits.open(io.BytesIO(raw)) as hd:
    h=hd['IMAGE'];iw=WCS(h.header).celestial;assert h.header['RADESYS']=='ICRS';assert abs(h.header['MJD-AVG']-o['mjd'])*86400<.01
    x,y=iw.world_to_pixel_values(ra,dec);data=np.asarray(h.data,float);arr=map_coordinates(data,[y,x],order=1,mode='constant',cval=np.nan,prefilter=False)
    valid=np.isfinite(arr);arrays.append(arr);masks.append(valid);frames.append(dict(o));srcs.append(dict(url=o['url'],params=params,sha256=hashlib.sha256(raw).hexdigest()))
  except Exception as e:print('skip',str(e)[:130],flush=True)
 if len(frames)<2:return None
 positions=[tuple(int(round(float(v))) for v in w.world_to_pixel_values(o['ra'],o['dec'])) for o in frames]
 selected=common_subset(masks,positions)
 if selected is None:print('insufficient common footprint',ident,flush=True);return None
 keep,common,coverage=selected
 if len(keep)!=len(frames):print('Detector-edge exposures omitted',ident,len(frames)-len(keep),'kept',len(keep),flush=True)
 frames=[frames[i] for i in keep];arrays=[arrays[i] for i in keep];srcs=[srcs[i] for i in keep]
 # One common stretch, robust background level matching; no spatial fake/background replacement.
 normalized=[]
 for arr in arrays:normalized.append(arr-np.nanmedian(arr[common]))
 vals=np.concatenate([a[common] for a in normalized]);lo,hi=np.nanpercentile(vals,[5,99.5]);seqid=f'fixed-{ident}'
 rows,source=horizons(ident+';',dict(EPHEM_TYPE='OBSERVER',CENTER="'500@-163182'",TLIST="'"+'\n'.join(str(o['mjd']+2400000.5) for o in frames)+"'",TLIST_TYPE='JD',TIME_TYPE='UT',QUANTITIES="'1'",REF_SYSTEM='ICRF',ANG_FORMAT='DEG',EXTRA_PREC='YES',CAL_FORMAT='JD'))
 ship,shipsource=vectors('-163182',0,0,epochs=[float(Time(o['mjd'],format='mjd',scale='utc').tdb.jd) for o in frames])
 assert len(rows)==len(ship)==len(frames), 'Observer epoch count mismatch'
 for i,(o,a,r) in enumerate(zip(frames,normalized,rows)):
  assert abs(float(r[0])-2400000.5-o['mjd'])<1e-6
  assert abs(ship[i][0]-Time(o['mjd'],format='mjd',scale='utc').tdb.mjd)<1e-7
  o['ra'],o['dec']=float(r[3]),float(r[4]);px,py=w.world_to_pixel_values(o['ra'],o['dec']);o['spacecraft']=ship[i][1:4]
  assert 4<float(px)<124 and 4<float(py)<124
  if not common[int(round(float(py))),int(round(float(px)))]:
   print('target outside common footprint',ident,flush=True);return None
  norm=np.arcsinh(np.clip((a-lo)/max(hi-lo,1e-12),0,3)*8)/np.arcsinh(8);norm[~common]=0
  name=f'images/{seqid}-{i}.png';Image.fromarray(np.flipud(np.uint8(np.nan_to_num(np.clip(norm,0,1))*255))).save(OUT/name)
  ar,ad=w.pixel_to_world_values(px,py);roundtrip=float(np.hypot((ar-o['ra'])*np.cos(np.deg2rad(o['dec'])),ad-o['dec'])*3600)
  o['image']=dict(path=name,width=128,height=128,predicted=[float(px),127-float(py)],measured=None,wcs=dict(w.to_header()),fitsSHA256=srcs[i]['sha256'],roundtripArcsec=roundtrip)
  o['sequenceId']=seqid
 # Verify fixed world coordinates roundtrip through every native WCS independently.
 return dict(id=seqid,objectId=ident,frames=frames,wcs=dict(w.to_header()),width=128,height=128,coverage=coverage,commonStretch=[float(lo),float(hi)],sources=srcs,horizons=source,spacecraftSource=shipsource,method='ICRS TAN 6.15 arcsec/pixel; bilinear resampling; common valid footprint; median background offset; one shared asinh stretch')

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--objects',nargs='+',help='Retry only these IDs, preserving other prepared sequences')
 args=parser.parse_args()
 obs=json.loads((OUT/'observations.json').read_text(encoding="utf-8"))
 path=OUT/'sequences.json'
 result=[s for s in json.loads(path.read_text(encoding="utf-8")) if s['objectId'] not in args.objects] if args.objects and path.exists() else []
 ids=args.objects or sorted(set(o['objectId'] for o in obs),key=lambda x:(x!='433',x))
 for ident in ids:
  groups={};pairs={}
  for detector in range(1,7):
   good=sorted([o for o in obs if o['objectId']==ident and o['detector']==detector and o['quality']=='GOOD' and (o['snr'] or 0)>=5],key=lambda o:o['mjd'])
   for first in good:
    g=[o for o in good if 0<=o['mjd']-first['mjd']<=.12 and abs((o['ra']-first['ra']+180)%360-180)<.12 and abs(o['dec']-first['dec'])<.12][:6]
    if len(g)>=3:groups[tuple(o['id'] for o in g)]=g
    elif len(g)==2:pairs[tuple(o['id'] for o in g)]=g
  def score(g):
   motion=np.hypot(((g[-1]['ra']-g[0]['ra']+180)%360-180)*np.cos(np.deg2rad(g[0]['dec'])),g[-1]['dec']-g[0]['dec'])*3600/6.15
   # Equivalent motion (<0.01 weighted pixel) should not be decided by sub-ms timestamps.
   # Prefer the shorter-wavelength detector in a tie to retain a clearer stellar background.
   return (round(float(motion*min(len(g),5)),2),-g[0]['detector'])
  # Try another real visit when the best-moving set has insufficient overlap.
  # A two-exposure blink is a final fallback, without weakening photometric quality.
  candidates=sorted(groups.values(),key=score,reverse=True)+sorted(pairs.values(),key=score,reverse=True)
  for g in candidates:
   try: seq=prepare_group(ident,g)
   except (requests.RequestException, ValueError, AssertionError, OSError) as e:
    print('group unavailable',ident,str(e)[:160],flush=True);continue
   if seq is not None:
    result.append(seq);break
  else:
   print('No usable common-sky sequence',ident,flush=True)
  path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 print('DONE sequences',len(result),flush=True)
if __name__=='__main__':main()
