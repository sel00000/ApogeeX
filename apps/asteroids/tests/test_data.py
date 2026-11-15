import json, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public/data'
class DataTests(unittest.TestCase):
 def test_real_bundle(self):
  bodies=json.loads((ROOT/'bodies.json').read_text(encoding="utf-8"));obs=json.loads((ROOT/'observations.json').read_text(encoding="utf-8"));m=json.loads((ROOT/'manifest.json').read_text(encoding="utf-8"))
  self.assertEqual(sum(b['kind']=='planet' for b in bodies),8)
  self.assertEqual(sum(b['kind']=='asteroid' for b in bodies),24)
  ids={b['id'] for b in bodies}
  for b in bodies:
   t=[s[0] for s in b['samples']];self.assertTrue(all(y>x for x,y in zip(t,t[1:])));self.assertLess(t[0],m['start']);self.assertGreater(t[-1],m['end'])
  for o in obs:self.assertIn(o['objectId'],ids)
  images=[o for o in obs if o['image']]
  self.assertGreaterEqual(len({o['mjd'] for o in images if o['objectId']=='433'}),2)
  for o in images:
   im=o['image'];self.assertTrue((ROOT/im['path']).exists());self.assertLess(im['roundtripArcsec'],.001)
   self.assertEqual(len(o['spacecraft']),3)
   self.assertLess(o['independentObserverPixelDelta'],.1)
   self.assertIn('astrometric ICRF',o['directionDefinition'])
   self.assertIn('500@-163182',o['ephemeris'])
  for v in m['validation']:self.assertLess(v['maxInterpolationErrorAU'],1e-5)
 def test_jiho_added_targets_have_orbits_and_registered_photos(self):
  added={'64','216','596','2566','35107'}
  bodies=json.loads((ROOT/'bodies.json').read_text(encoding="utf-8"));obs=json.loads((ROOT/'observations.json').read_text(encoding="utf-8"))
  sequences=json.loads((ROOT/'comparisons.json').read_text(encoding="utf-8"));sightlines=json.loads((ROOT/'sightlines.json').read_text(encoding="utf-8"));trails=json.loads((ROOT/'trails.json').read_text(encoding="utf-8"))
  previous_sequences={'433','16','2045','236','246','2851','308','387','579','624','653','69','764','96'}
  self.assertTrue(previous_sequences <= {s['objectId'] for s in sequences},'Existing fixed-sky targets must remain available')
  self.assertTrue(added <= {b['id'] for b in bodies})
  for ident in added:
   self.assertGreaterEqual(sum(o['objectId']==ident and bool(o['image']) for o in obs),3)
   sequence=next(s for s in sequences if s['objectId']==ident)
   self.assertGreaterEqual(len(sequence['frames']),2)
   for o in sequence['frames']:
    self.assertIn(o['image']['path'],sightlines);self.assertIn(o['image']['path'],trails)
    self.assertEqual(o['objectId'],trails[o['image']['path']]['objectId'])
  self.assertEqual(next(b['name'] for b in bodies if b['id']=='35107'),'35107 (1991 VH)')
if __name__=='__main__': unittest.main()
