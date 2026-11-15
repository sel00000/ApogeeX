"""Bake FITS WCS (including SIP) into calibrated 3D image-plane geometry. Offline."""
from prepare import OUT, WCS, np, json

def direction(ra,dec):
 ra,dec=np.deg2rad(ra),np.deg2rad(dec);e=np.deg2rad(23.439291111)
 x=np.cos(dec)*np.cos(ra);y=np.cos(dec)*np.sin(ra);z=np.sin(dec)
 return np.stack([x,y*np.cos(e)+z*np.sin(e),-y*np.sin(e)+z*np.cos(e)],axis=-1)

def bake(o):
 im=o['image'];w=WCS(im['wcs']);width,height=im['width'],im['height'];cx,cy=(width-1)/2,(height-1)/2
 f=direction(*w.pixel_to_world_values(cx,cy));up=direction(*w.pixel_to_world_values(cx,cy+1))-f;up-=np.dot(up,f)*f;up/=np.linalg.norm(up);right=np.cross(f,up)
 def project(x,y):
  d=direction(*w.pixel_to_world_values(x,y));den=d@f
  return np.stack([d@right/den,d@up/den],axis=-1)
 n=16;yy,xx=np.meshgrid(np.linspace(-.5,height-.5,n+1),np.linspace(-.5,width-.5,n+1),indexing='ij');xy=project(xx,yy)
 # Validate the same triangulation used by Three, independently against Astropy.
 vy,vx=np.meshgrid(np.linspace(0,height-1,21),np.linspace(0,width-1,21),indexing='ij');gx=(vx+.5)/width*n;gy=(vy+.5)/height*n;ix=np.floor(gx).astype(int);iy=np.floor(gy).astype(int);a=gx-ix;b=gy-iy
 p00=xy[iy,ix];p10=xy[iy,ix+1];p01=xy[iy+1,ix];p11=xy[iy+1,ix+1]
 interp=np.where((a+b<=1)[...,None],p00+(p10-p00)*a[...,None]+(p01-p00)*b[...,None],p11+(p01-p11)*(1-a)[...,None]+(p10-p11)*(1-b)[...,None])
 scale=np.linalg.norm(project(cx+1,cy)-project(cx,cy));err=float(np.max(np.linalg.norm(interp-project(vx,vy),axis=-1))/scale)
 assert err<.01,err
 return dict(forward=f.tolist(),up=up.tolist(),right=right.tolist(),grid=xy.reshape(-1,2).tolist(),segments=n,bounds=[float(xy[...,0].min()),float(xy[...,0].max()),float(xy[...,1].min()),float(xy[...,1].max())],radiansPerPixel=float(scale),maxMeshErrorPixels=err,frame='J2000 ecliptic; observer-centered ICRS directions; original image WCS including SIP')

def main():
 obs=json.loads((OUT/'observations.json').read_text(encoding="utf-8"));seqs=json.loads((OUT/'comparisons.json').read_text(encoding="utf-8"));allobs=[o for o in obs if o['image']]+[o for s in seqs for o in s['frames']]
 result={o['image']['path']:bake(o) for o in allobs};(OUT/'sightlines.json').write_text(json.dumps(result,separators=(',',':')), encoding="utf-8")
 print(len(result),'calibrated image planes; max error pixels',max((v['maxMeshErrorPixels'] for v in result.values()),default=0))
if __name__=='__main__':main()
