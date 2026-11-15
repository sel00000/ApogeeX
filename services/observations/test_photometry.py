"""Synthetic native pixels test physical units and exclusion of defective data."""
import unittest
import numpy as np
from photometry import native_photometry


class PhotometryQuality(unittest.TestCase):
    def setUp(self):
        self.img = np.ones((31, 31))
        yy, xx = np.mgrid[0:31, 0:31]
        self.distance = np.hypot(xx - 15, yy - 15)
        self.aperture = self.distance <= 2.5
        self.img[self.aperture] = 11
        self.flags = np.zeros(self.img.shape, dtype=np.uint32)
        self.variance = np.full(self.img.shape, 4.)
        self.names = dict(SOURCE=1, NONFUNC=2, PERSIST=4)

    def measure(self):
        return native_photometry(self.img, self.variance, self.flags, self.names, 15, 15, (2., .1), 1e-9)

    def test_flux_and_native_variance_units(self):
        result = self.measure()
        self.assertEqual(result['flux_mjy'], 10 * self.aperture.sum())
        self.assertAlmostEqual(result['err_mjy'], np.sqrt(4 * self.aperture.sum()), places=4)

    def test_source_label_does_not_mask_good_pixels(self):
        self.flags[self.aperture] = self.names['SOURCE']
        self.assertIsNotNone(self.measure()['flux_mjy'])

    def test_defective_source_is_never_summed_as_valid_flux(self):
        self.flags[15, 15] = self.names['SOURCE'] | self.names['NONFUNC']
        result = self.measure()
        self.assertIsNone(result['flux_mjy'])
        self.assertIn('NONFUNC', result['flags'])

    def test_bad_background_pixels_are_excluded(self):
        bad = (self.distance > 4.5) & (self.distance <= 8) & (np.indices(self.img.shape)[0] < 18)
        self.img[bad] = 10000
        self.flags[bad] = self.names['PERSIST']
        self.assertEqual(self.measure()['flux_mjy'], 10 * self.aperture.sum())

    def test_invalid_variance_does_not_create_significance(self):
        self.variance[15, 15] = np.nan
        self.assertIsNone(self.measure()['flux_mjy'])
        self.variance[15, 15] = -1
        self.assertIsNone(self.measure()['err_mjy'])


if __name__ == '__main__':
    unittest.main()
