import json,unittest
from pathlib import Path
import numpy as np
from astropy.wcs import WCS
ROOT=Path(__file__).resolve().parents[1]/'public/data'
class TrailTests(unittest.TestCase):
 def test_exposure_positions_use_current_image_wcs(self):
  obs=json.loads((ROOT/'observations.json').read_text(encoding="utf-8"));seq=json.loads((ROOT/'comparisons.json').read_text(encoding="utf-8"));allobs=[o for o in obs if o['image']]+[o for s in seq for o in s['frames']];trails=json.loads((ROOT/'trails.json').read_text(encoding="utf-8"))
  self.assertEqual(len(trails),len(allobs))
  for current in allobs:
   im=current['image'];t=trails[im['path']];w=WCS(im['wcs']);self.assertEqual(t['objectId'],current['objectId'])
   self.assertEqual([p['mjd'] for p in t['points']],sorted(p['mjd'] for p in t['points']))
   now=next(p for p in t['points'] if p['id']==t['currentId']);np.testing.assert_allclose([now['x'],now['y']],im['predicted'],atol=.001)
   # A prior position must be projected into this frame, not copied from its own cutout center.
   source={o['id']:o for o in allobs if o['objectId']==current['objectId'] and bool(o.get('sequenceId'))==bool(current.get('sequenceId'))}
   for p in t['points']:
    if not p['inside']:continue
    o=source[p['id']];ra,dec=w.pixel_to_world_values(p['x'],im['height']-1-p['y']);err=np.hypot(((ra-o['ra']+180)%360-180)*np.cos(np.deg2rad(o['dec'])),dec-o['dec'])*3600;self.assertLess(err,.001)
