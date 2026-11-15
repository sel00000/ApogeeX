"""Project native SPHEREx ePSF into the identical fixed-sky grid as the real image.
Position is locked to independent Horizons astrometry; only amplitude/background fit.
Reference: https://caltech-ipac.github.io/irsa-tutorials/spherex-psf/
"""
from prepare import *
from scipy.ndimage import map_coordinates
import io

def native_model(hd,o):
 h=hd['IMAGE'];w=WCS(h.header).celestial;x,y=map(float,w.world_to_pixel_values(o['ra'],o['dec']))
 ah=hd['FLAGS'].header
 ox=float(ah['CRVAL1A'])+1-float(ah['CRPIX1A']);oy=float(ah['CRVAL2A'])+1-float(ah['CRPIX2A'])
 ps=hd['EPSF'];tab=ps.data;k=int(np.argmin((tab['XCENTER']-x-ox)**2+(tab['YCENTER']-y-oy)**2));ovs=int(ps.header['OVSMPX'])
 eps=np.asarray(tab['EPSF'][k],float).reshape(33,33);eps/=np.nansum(eps)/ovs**2
 ix,iy=int(round(x)),int(round(y));yy,xx=np.indices((9,9));coords=[16+(yy-4-(y-iy))*ovs,16+(xx-4-(x-ix))*ovs]
 stamp=np.clip(map_coordinates(eps,coords,order=3,mode='constant',cval=0),0,None)
 sl=np.s_[iy-4:iy+5,ix-4:ix+5];a=np.asarray(h.data[sl],float);var=np.asarray(hd['VARIANCE'].data[sl],float)
 good=np.isfinite(a)&np.isfinite(var)&(var>0)
 # Exclude severe flags, but not the moving source's self-raised transient flags.
 flags=hd['FLAGS'];reject=0
 for key,value in flags.header.items():
  if key.startswith('MSKN') and any(s in str(value).upper() for s in ['SATUR','NONFUNC','MISSING','NONLINEAR']):reject|=int(flags.header.get('MSKM'+key[4:],0))
 good&=(np.asarray(flags.data[sl],np.int64)&reject)==0
 assert good.sum()>20
 design=np.column_stack((stamp[good],np.ones(good.sum())));weights=1/np.sqrt(var[good]);amp,bg=np.linalg.lstsq(design*weights[:,None],a[good]*weights,rcond=None)[0]
 assert np.isfinite(amp) and amp>0
 model=np.zeros(h.data.shape);model[sl]=stamp*amp
 residual=(a[good]-(amp*stamp[good]+bg))/np.sqrt(var[good]);chi=float(np.sum(residual**2)/max(good.sum()-2,1))
 return model,w,dict(method='SPHEREx native ePSF; fixed Horizons position; variance-weighted amplitude + constant background fit; no centroid adjustment or trail convolution',amplitude=float(amp),background=float(bg),chi2Reduced=chi,zone=k,oversampling=ovs)

def main():
 seqs=json.loads((OUT/'sequences.json').read_text(encoding="utf-8"));out=[]
 for seq in seqs:
  w=WCS(seq['wcs']);yy,xx=np.indices((128,128));ra,dec=w.pixel_to_world_values(xx,yy);lo,hi=seq['commonStretch'];frames=[];sources=[]
  for o,source in zip(seq['frames'],seq['sources']):
   try:
    with fits.open(io.BytesIO(fetch(source['url'],source['params']))) as hd:
     model,iw,info=native_model(hd,o);x,y=iw.world_to_pixel_values(ra,dec);m=map_coordinates(model,[y,x],order=1,mode='constant',cval=0,prefilter=False)
    # ePSF emission above zero-background shared display stretch. Pack alongside the real image.
    norm=np.arcsinh(np.clip(m/max(hi-lo,1e-12),0,3)*8)/np.arcsinh(8);modelpixels=np.flipud(np.uint8(np.clip(norm,0,1)*255));photo=np.array(Image.open(OUT/o['image']['path']))
    atlas=np.concatenate((photo,modelpixels),axis=1);path=o['image']['path'].replace('.png','-atlas.png');Image.fromarray(atlas).save(OUT/path)
    o['image']['path']=path;o['image']['atlas']=True;o['image']['model']=info
    px,py=o['image']['predicted'];ar,ad=w.pixel_to_world_values(px,127-py);o['image']['roundtripArcsec']=float(np.hypot((ar-o['ra'])*np.cos(np.deg2rad(o['dec'])),ad-o['dec'])*3600)
    frames.append(o);sources.append(source)
   except Exception as e:print('model unavailable',seq['id'],o['id'],str(e),flush=True)
  if len(frames)>=2:seq['frames']=frames;seq['sources']=sources;out.append(seq)
 (OUT/'comparisons.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
 print('Models',len(out),'sequences',sum(len(s['frames']) for s in out),'frames',flush=True)
if __name__=='__main__':main()
