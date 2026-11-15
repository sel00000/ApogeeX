"""Independent raster-coordinate audit against the actual vendored C geometry."""
from pathlib import Path
import ctypes, hashlib, importlib.util, json, unittest, tempfile, subprocess, sys, shutil
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('generator',ROOT/'scripts/make-spherex-hips.py')
generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)

class Geometry(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  if not shutil.which('cc'):raise unittest.SkipTest('C compiler required for independent native geometry audit')
  cls.temp=tempfile.TemporaryDirectory();cls.native=Path(cls.temp.name)/'healpix.so'
  subprocess.run(['cc','-dynamiclib' if sys.platform=='darwin' else '-shared','-fPIC','-I',str(ROOT/'vendor/stellarium-web-engine/src'),str(ROOT/'vendor/stellarium-web-engine/src/algos/healpix.c'),'-o',str(cls.native)],check=True,capture_output=True)
 @classmethod
 def tearDownClass(cls):cls.temp.cleanup()
 def test_native_healpix_face_geometry_and_texture_uv_transpose(self):
  lib=ctypes.CDLL(str(self.native))
  arr=ctypes.c_double*3;matrix=(ctypes.c_double*3)*3
  lib.healpix_get_mat3.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.POINTER(ctypes.c_double*3)]
  lib.healpix_xy2vec.argtypes=[ctypes.POINTER(ctypes.c_double),ctypes.POINTER(ctypes.c_double)]
  for order in range(2):
   for pixel in range(12*4**order):
    mat=matrix();lib.healpix_get_mat3(2**order,pixel,mat)
    for row,col in [(.5,.5),(.01,.75),(.91,.13)]:
     # Native render_visitor applies uv_swap before sampling: image (col,row)
     # corresponds to geometric uv=(row,col). Matrix storage is column-major.
     xy=arr(*(mat[0][i]*row+mat[1][i]*col+mat[2][i] for i in range(3)))
     vector=arr();lib.healpix_xy2vec(xy,vector)
     got=generator.healpix_directions(order,pixel,np.array(row),np.array(col))
     np.testing.assert_allclose(got,list(vector),rtol=0,atol=2e-14)
 def test_galactic_axes_land_at_measured_original_raster_center_and_poles(self):
  # Independent standard J2000 coordinates: Galactic center and north pole.
  points=[(266.404994801,-28.936173960,2079.5,1169.5),(192.85948,27.12825,2079.5,165.04668414)]
  for ra,dec,wantx,wanty in points:
   a,b=np.deg2rad([ra,dec]);direction=np.array([np.cos(b)*np.cos(a),np.cos(b)*np.sin(a),np.sin(b)])
   x,y=generator.source_pixels(direction)
   self.assertAlmostEqual(float(x),wantx,delta=.04);self.assertAlmostEqual(float(y),wanty,delta=.04)
 def test_every_lossless_tile_and_original_source_matches_processing_manifest(self):
  survey=ROOT/'assets/spherex-hips';manifest=json.loads((survey/'provenance.json').read_text())
  self.assertEqual(len(manifest['tiles']),60)
  self.assertEqual(hashlib.sha256((ROOT/'assets/spherex-original.png').read_bytes()).hexdigest(),manifest['sourceSHA256'])
  for entry in manifest['tiles']:
   path=survey/entry['file'];self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),entry['sha256'])
   with Image.open(path) as image:self.assertEqual(image.size,(512,512))

if __name__=='__main__':unittest.main()
