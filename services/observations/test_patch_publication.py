"""Publication checks use synthetic local FITS; no catalogue or NASA requests."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch as mock
import numpy as np
from astropy.io import fits
import patch as pipeline


class AtomicPublication(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.cutout = self.root / 'cutout.fits'
        image = fits.ImageHDU(np.ones((9, 9)), name='IMAGE')
        image.header['MJD-AVG'] = 60000
        fits.HDUList([fits.PrimaryHDU(), image]).writeto(self.cutout)
        self.patches = [
            mock.object(pipeline, 'PATCH_OUT', self.root / 'patches'),
            mock.object(pipeline, 'PATCH_CACHE', self.root / 'cache'),
            mock.object(pipeline.B, 'search_exposures', return_value=[dict(obs_id='fixture', detector=1, url='fixture://local')]),
            mock.object(pipeline.B, 'fetch_cutout', return_value=self.cutout),
            mock.object(pipeline.B, 'pixel_wavelength', return_value=(2., .1)),
            mock.object(pipeline.B, 'load_exposure', side_effect=lambda path, wcs, n: (np.arange(n * n).reshape(n, n).astype(float), 0)),
        ]
        for helper in self.patches:
            helper.start()
            self.addCleanup(helper.stop)

    def test_complete_generation_before_metadata_and_failed_refresh_preserves_it(self):
        result = pipeline.bake_patch(12, -20, .125)
        folder = pipeline.PATCH_OUT / result['id']
        meta_path = folder / 'meta.json'
        original = meta_path.read_bytes()
        meta = json.loads(original)
        self.assertEqual(meta['status'], 'done')
        self.assertEqual(meta['fov_deg'], .125)
        visit = meta['visits'][0]
        for value in [visit['png'], visit['diff_png'], visit['f32'], *visit['f32_det'].values()]:
            self.assertTrue(value.startswith('generations/'))
            self.assertTrue((folder / value).is_file())
        with mock.object(pipeline.B, 'load_exposure', side_effect=RuntimeError('interrupted refresh')):
            with self.assertRaisesRegex(RuntimeError, 'interrupted refresh'):
                pipeline.bake_patch(12, -20, .125)
        self.assertEqual(meta_path.read_bytes(), original)

    def test_fetch_failure_is_not_empty_sky(self):
        with mock.object(pipeline.B, 'fetch_cutout', side_effect=OSError('fixture unavailable')):
            result = pipeline.bake_patch(12, -20, .1)
        self.assertEqual(result['status'], 'fetch_failed')
        meta = json.loads((pipeline.PATCH_OUT / result['id'] / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual(meta['status'], 'fetch_failed')


if __name__ == '__main__':
    unittest.main()
