#!/usr/bin/env python3
"""Project the supplied SPHEREx Galactic Mollweide image into equatorial HiPS.

Only raster resampling is performed. Engine catalogs, photometry, object positions
and ephemerides are untouched. HEALPix face geometry and the row/column transpose
follow the vendored Stellarium algos/healpix.c, uv_map.c and hips.c render_visitor.
Requires numpy and Pillow; install into a separate venv, never the system Python.
SPDX-License-Identifier: AGPL-3.0-only
"""
from pathlib import Path
import argparse, hashlib, json
import numpy as np
from PIL import Image

MATRIX=np.array([[-.0548755604162154,-.8734370902348850,-.4838350155487132],
                [.4941094278755837,-.4448296299600112,.7469822444972189],
                [-.8676661490190047,-.1980763734312015,.4559837761750669]])
FACES=np.array([[1,0],[3,0],[5,0],[7,0],[0,-1],[2,-1],[4,-1],[6,-1],[1,-2],[3,-2],[5,-2],[7,-2]])
# Fitted outer raster ellipse, original 4160x2340 TIFF. Raster center is a pixel center.
RX=2004.03385674
RY=1004.45331586
RHO_MAX=0.993  # stay inside the drawn outline (measured at rho>=0.996)

def nested_xy(order,pixel):
    face=pixel//(4**order);local=pixel%(4**order)
    x=sum(((local>>(2*k))&1)<<k for k in range(order))
    y=sum(((local>>(2*k+1))&1)<<k for k in range(order))
    return x,y,face

def healpix_directions(order,pixel,row,col):
    """ICRS vector at image coordinates. Engine texture UV is swapped (v,u)."""
    ix,iy,face=nested_xy(order,pixel);side=2**order
    x=(FACES[face,0]+(ix+row-iy-col)/side)*np.pi/4
    y=(FACES[face,1]+(ix+row+iy+col)/side)*np.pi/4
    sigma=2-np.abs(y*4)/np.pi
    xc=-np.pi+(2*np.floor((x+np.pi)*4/(2*np.pi))+1)*np.pi/4
    polar=np.abs(y)>np.pi/4
    z=np.where(polar,np.sign(y)*(1-sigma*sigma/3),y*8/(np.pi*3))
    phi=np.where(polar,xc+np.divide(x-xc,sigma,out=np.zeros_like(x),where=np.abs(sigma)>1e-12),x)
    r=np.sqrt(np.maximum(0,(1-z)*(1+z)))
    return np.stack([r*np.cos(phi),r*np.sin(phi),z],axis=-1)

def source_pixels(direction,width=4160,height=2340):
    gal=direction@MATRIX.T
    longitude=np.arctan2(gal[...,1],gal[...,0]);latitude=np.arcsin(np.clip(gal[...,2],-1,1))
    lo=np.full(latitude.shape,-np.pi/2);hi=-lo;target=np.pi*np.sin(latitude)
    for _ in range(30):
        theta=(lo+hi)/2;lower=2*theta+np.sin(2*theta)<target
        lo=np.where(lower,theta,lo);hi=np.where(lower,hi,theta)
    theta=(lo+hi)/2
    x=(width-1)/2-longitude/np.pi*(RX*width/4160)*np.cos(theta);y=(height-1)/2-(RY*height/2340)*np.sin(theta)
    # The poster draws a grey outline (value ~122) on its Mollweide ellipse, measured along 720 rays at
    # normalized radius rho >= 0.996 (8 px at the equator, 4 px at the poles). Unhandled, it is resampled
    # onto the sky as a false double line along Galactic longitude ±180° where both map edges meet.
    # Samples with rho > RHO_MAX are pulled radially to RHO_MAX: positions move by at most 0.7% of the
    # radius (≤14 px, ~1.3° on the sky) and only inside that rim; everywhere else the mapping is exact.
    cx,cy,rx,ry=(width-1)/2,(height-1)/2,RX*width/4160,RY*height/2340
    rho=np.hypot((x-cx)/rx,(y-cy)/ry);k=np.where(rho>RHO_MAX,RHO_MAX/np.maximum(rho,1e-12),1.0)
    x=cx+(x-cx)*k;y=cy+(y-cy)*k
    return x,y

def sample(image,x,y):
    h,w,_=image.shape;x=np.clip(x,0,w-1);y=np.clip(y,0,h-1)
    ix=np.floor(x).astype(int);iy=np.floor(y).astype(int);jx=np.minimum(ix+1,w-1);jy=np.minimum(iy+1,h-1)
    fx=(x-ix)[...,None];fy=(y-iy)[...,None]
    value=image[iy,ix]*(1-fx)*(1-fy)+image[iy,jx]*fx*(1-fy)+image[jy,ix]*(1-fx)*fy+image[jy,jx]*fx*fy
    return np.clip(np.rint(value),0,255).astype(np.uint8)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def build(source,output,order=1,width=512):
    image=np.asarray(Image.open(source).convert('RGB'),dtype=np.float32)
    output.mkdir(parents=True,exist_ok=True)
    row,col=np.meshgrid((np.arange(width)+.5)/width,(np.arange(width)+.5)/width,indexing='ij')
    records=[]
    for level in range(order+1):
        directory=output/f'Norder{level}'/'Dir0';directory.mkdir(parents=True,exist_ok=True)
        for pixel in range(12*4**level):
            direction=healpix_directions(level,pixel,row,col)
            x,y=source_pixels(direction,image.shape[1],image.shape[0])
            path=directory/f'Npix{pixel}.webp'
            Image.fromarray(sample(image,x,y)).save(path,format='WEBP',lossless=True,method=4)
            records.append({'file':str(path.relative_to(output)),'bytes':path.stat().st_size,'sha256':sha(path)})
        print(f'Generated Norder{level}: {12*4**level} equatorial tiles',flush=True)
    (output/'properties').write_text(f'''hips_version = 1.4
hips_order = {order}
hips_order_min = 0
hips_tile_width = {width}
hips_tile_format = webp
hips_frame = equatorial
dataproduct_type = image
obs_title = SPHEREx StarsRGB original TIFF-derived map
obs_description = Galactic Mollweide original reprojected to equatorial HEALPix; unchanged Stellarium catalogs and ephemerides
obs_copyright = NASA/JPL-Caltech
obs_copyright_url = https://spherex.caltech.edu/image/spherex20251218b-spherex-all-sky-map-2025-stars-and-galaxies
''')
    manifest={'sourceImage':str(source.name),'sourceSHA256':sha(source),'sourceShape':[image.shape[1],image.shape[0]],'processing':'bilinear raster resampling into lossless WebP; samples kept at rho<=0.993 inside the drawn ellipse outline (measured rho>=0.996; seam fix); no synthesis or catalog substitution','coordinateFrame':'equatorial ICRS/ASTROM HiPS','projection':'input Galactic Mollweide, l=0 centered, north up, longitude increases to left','ellipsePixels':{'center':[(image.shape[1]-1)/2,(image.shape[0]-1)/2],'rx':RX,'ry':RY},'matrixICRSToGalactic':MATRIX.tolist(),'engineReference':['src/algos/healpix.c','src/uv_map.c','src/hips.c:render_visitor UV swap'],'tiles':records}
    (output/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=Path(__file__).resolve().parents[1]/'assets/spherex-original.png');parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'assets/spherex-hips');args=parser.parse_args();build(args.input,args.output)
