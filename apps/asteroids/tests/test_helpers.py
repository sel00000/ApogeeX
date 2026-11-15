import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare
import fixed_sky
import json,tempfile
from unittest.mock import patch
import numpy as np
TEST_ROOT=Path(__file__).resolve().parents[1]/'.test-work'
TEST_ROOT.mkdir(exist_ok=True)
class RequestIdentityTests(unittest.TestCase):
 def test_detector_edge_exposure_does_not_discard_usable_visit(self):
  full=np.ones((20,20),dtype=bool);edge=full.copy();edge[:10]=False
  ids,common,coverage=fixed_sky.common_subset([full,full,edge,full],[(10,10)]*4)
  self.assertEqual(ids,(0,1,3));self.assertEqual(coverage,1)
  self.assertIsNone(fixed_sky.common_subset([edge,edge],[(10,10)]*2))
 def test_same_fits_different_cutouts_never_alias(self):
  self.assertNotEqual(prepare.image_key('https://irsa/a.fits',{'center':'1,2d','size':'.12'}),prepare.image_key('https://irsa/a.fits',{'center':'2,3d','size':'.12'}))
 def test_identical_query_is_stable(self):
  self.assertEqual(prepare.image_key('u',{'center':'1','size':'.12'}),prepare.image_key('u',{'size':'.12','center':'1'}))
 def test_retries_another_visit_when_first_common_footprint_fails(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as tmp:
   root=Path(tmp)
   obs=[dict(id=str(i),objectId='216',detector=1,quality='GOOD',snr=10,mjd=60800+i/1440,ra=10+i*.001,dec=1) for i in range(4)]
   (root/'observations.json').write_text(json.dumps(obs), encoding="utf-8")
   (root/'sequences.json').write_text(json.dumps([dict(objectId='433',frames=[])]), encoding="utf-8")
   attempts=[]
   def build(ident,g):
    attempts.append([o['id'] for o in g])
    return None if len(attempts)==1 else dict(objectId=ident,frames=g)
   with patch.object(fixed_sky,'OUT',root),patch.object(fixed_sky,'prepare_group',side_effect=build),patch.object(sys,'argv',['fixed_sky.py','--objects','216']):
    fixed_sky.main()
   result=json.loads((root/'sequences.json').read_text(encoding="utf-8"))
   self.assertEqual(len(attempts),2)
   self.assertNotEqual(attempts[0],attempts[1])
   self.assertEqual({s['objectId'] for s in result},{'433','216'})
 def test_provisional_id_and_numbered_alias(self):
  self.assertEqual(prepare.canonical_id({'official_name':'764 Gedania (A913 SF)','asteroid_id':'A913 SF'}),'764')
  self.assertEqual(prepare.canonical_id({'official_name':'2025 AB','asteroid_id':'2025 AB'}),'2025 AB')
  self.assertEqual(prepare.canonical_id({'official_name':'','asteroid_id':'A2025 XX'}),'A2025 XX')
  with self.assertRaises(ValueError):prepare.canonical_id({'asteroid_id':'../../outside'})
 def test_zero_degree_crossing_is_one_real_visit(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as tmp:
   root=Path(tmp)
   obs=[dict(id=str(i),objectId='246',detector=1,quality='GOOD',snr=10,mjd=60800+i/1440,ra=ra,dec=1) for i,ra in enumerate([359.99,0.0,0.01])]
   (root/'observations.json').write_text(json.dumps(obs),encoding='utf-8')
   with patch.object(fixed_sky,'OUT',root),patch.object(fixed_sky,'prepare_group',side_effect=lambda ident,g:dict(objectId=ident,frames=g)),patch.object(sys,'argv',['fixed_sky.py']):fixed_sky.main()
   result=json.loads((root/'sequences.json').read_text(encoding='utf-8'))
   self.assertEqual(len(result),1)
   self.assertEqual(len(result[0]['frames']),3)
if __name__=='__main__':unittest.main()
