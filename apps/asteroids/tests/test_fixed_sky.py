import unittest,json
from pathlib import Path
import numpy as np
from PIL import Image
from astropy.wcs import WCS
ROOT=Path(__file__).resolve().parents[1]/'public/data'
class FixedSkyTests(unittest.TestCase):
 def test_added_targets_background_stars_stay_registered(self):
  for seq in json.loads((ROOT/'comparisons.json').read_text(encoding="utf-8")):
   if seq['objectId'] not in {'64','216','596','2566','35107'}:continue
   images=[np.asarray(Image.open(ROOT/o['image']['path']),dtype=float)[:,:128] for o in seq['frames']]
   yy,xx=np.indices((128,128));mask=(xx>5)&(xx<122)&(yy>5)&(yy<122)&(images[0]>0)
   for o in seq['frames']:
    x,y=o['image']['predicted'];mask&=((xx-x)**2+(yy-y)**2>144)
   for image in images[1:]:
    scores=[]
    for dy in range(-2,3):
     for dx in range(-2,3):
      shifted=np.roll(image,(dy,dx),(0,1));use=mask&(shifted>0);scores.append((float(np.corrcoef(images[0][use],shifted[use])[0,1]),dx,dy))
    score,dx,dy=max(scores)
    self.assertEqual((dx,dy),(0,0),seq['objectId']);self.assertGreater(score,.3,seq['objectId'])
 def test_all_frames_use_one_sky_grid_and_real_epsf(self):
  seqs=json.loads((ROOT/'comparisons.json').read_text(encoding="utf-8"));self.assertGreaterEqual(len(seqs),1)
  for seq in seqs:
   self.assertGreaterEqual(seq['coverage'],.75);w=WCS(seq['wcs']);self.assertGreaterEqual(len(seq['frames']),2)
   for o in seq['frames']:
    im=o['image'];x,y=w.world_to_pixel_values(o['ra'],o['dec']);np.testing.assert_allclose(im['predicted'],[x,127-y],atol=1e-5)
    self.assertLess(im['roundtripArcsec'],1e-5);self.assertEqual(im['wcs'],seq['wcs']);self.assertTrue(im['atlas']);self.assertGreater(im['model']['amplitude'],0)
    self.assertEqual(len(o['spacecraft']),3)
    a=np.asarray(Image.open(ROOT/im['path']));self.assertEqual(a.shape,(128,256));self.assertGreater(a[:,128:].max(),0);self.assertLess(np.count_nonzero(a[:,128:]),300)
 def test_eros_moves_but_background_has_zero_integer_translation(self):
  seq=next(s for s in json.loads((ROOT/'comparisons.json').read_text(encoding="utf-8")) if s['objectId']=='433')
  xy=np.array([o['image']['predicted'] for o in seq['frames']]);self.assertGreater(np.linalg.norm(xy[-1]-xy[0]),10)
  images=[np.asarray(Image.open(ROOT/o['image']['path']),dtype=float)[:,:128] for o in seq['frames']]
  yy,xx=np.indices((128,128));mask=(xx>5)&(xx<122)&(yy>5)&(yy<122)&(images[0]>0)
  for x,y in xy:mask&=((xx-x)**2+(yy-y)**2>144)
  for image in images[1:]:
   scores=[]
   for dy in range(-2,3):
    for dx in range(-2,3):
     shifted=np.roll(image,(dy,dx),(0,1));use=mask&(shifted>0);scores.append((float(np.corrcoef(images[0][use],shifted[use])[0,1]),dx,dy))
   score,dx,dy=max(scores);self.assertEqual((dx,dy),(0,0));self.assertGreater(score,.4)
