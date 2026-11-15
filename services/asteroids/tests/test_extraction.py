"""Extraction on a SYNTHETIC SPHEREx-like FITS file (same extension layout as L2 products)."""
import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

from src.extraction.fits_product import read_spherex_image
from src.extraction.psf import native_psf_stamp
from src.extraction.spectral_extraction import MJY_TO_UJY, forced_psf_photometry
from src.extraction.wavelength_calibration import lookup_table_wavelength


SIGMA_PIX = 1.2 / 2.3548     # Gaussian PSF, FWHM = 1.2 native pixels (SPHEREx-like, undersampled)


def _pix_integrated_1d(u, sigma=SIGMA_PIX):
    """Fraction of a 1-D Gaussian falling in a unit pixel whose centre is at offset u."""
    from scipy.special import ndtr
    return ndtr((u + 0.5) / sigma) - ndtr((u - 0.5) / sigma)


def gaussian_epsf(n=33, ovs=5):
    """Analytic effective PSF (pixel-integrated Gaussian) on a 5x oversampled grid, in the
    Anderson & King convention used by the SPHEREx EPSF extension (sums to ~ovs^2)."""
    u = (np.arange(n) - (n - 1) / 2) / ovs
    e = _pix_integrated_1d(u)
    return np.outer(e, e)


def render_source(n, x0, y0, flux, trail_px=0.0):
    """Analytic image of a (possibly trailed along +x) Gaussian source - independent of the
    code under test."""
    yy, xx = np.indices((n, n))
    steps = ((np.arange(400) + 0.5) / 400 - 0.5) * trail_px if trail_px else [0.0]
    img = np.zeros((n, n))
    for s in steps:
        img += _pix_integrated_1d(xx - (x0 + s)) * _pix_integrated_1d(yy - y0)
    return flux * img / len(steps)


def make_fake(path, flux_amp=500.0, x0=20.3, y0=19.6, bkg=2.0, noise=0.2, seed=0, trail_px=0.0,
              outlier_core=False):
    rng = np.random.default_rng(seed)
    n = 41
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [150.0, 2.0]
    w.wcs.crpix = [21, 21]
    w.wcs.cdelt = [-6.15 / 3600, 6.15 / 3600]
    hdr = w.to_header()
    hdr["DETECTOR"] = 2
    hdr["OBSID"] = "SIMULATED_0001"
    hdr["MJD-AVG"], hdr["MJD-BEG"], hdr["MJD-END"] = 60800.0, 60799.9993, 60800.0007
    hdr["OMEGA_MEDIAN"] = 37.8
    # spectral lookup header (cutout at detector offset 500, 600)
    hdr["CRPIX1W"], hdr["CRPIX2W"], hdr["CRVAL1W"], hdr["CRVAL2W"] = -499.0, -599.0, 1, 1
    hdr["CDELT1W"], hdr["CDELT2W"], hdr["PV1_3W"], hdr["PV2_3W"] = 1, 1, 1, 2
    psf = gaussian_epsf()
    img = np.full((n, n), bkg) + rng.normal(0, noise, (n, n)) + render_source(n, x0, y0, flux_amp, trail_px)
    iy, ix = int(round(y0)), int(round(x0))
    flags = np.zeros((n, n), np.int32)
    if outlier_core:   # SPHEREx Detect Outliers flags the moving object itself
        flags[iy - 1:iy + 2, ix - 1:ix + 2] |= 524288
        flags[5, 5] |= 524288   # a genuine outlier in the background
    fh = fits.Header(hdr)
    fh["CRPIX1A"], fh["CRPIX2A"], fh["CRVAL1A"], fh["CRVAL2A"] = -499.0, -599.0, 0.0, 0.0
    fh["MSKN0006"], fh["MSKM0006"] = "NONFUNC", 64
    fh["MSKN0019"], fh["MSKM0019"] = "OUTLIER", 524288
    fh["MSKN0021"], fh["MSKM0021"] = "SOURCE", 2097152
    xs = np.linspace(1, 2041, 9).astype(np.int32)
    vals = np.zeros((9, 9, 2), np.float32)
    for j in range(9):
        for i in range(9):
            vals[j, i] = [1.1 + 0.5 * (xs[i] - 1) / 2040, 0.03]   # wavelength linear in x
    wave = fits.BinTableHDU.from_columns([
        fits.Column("X", "9J", array=[xs]), fits.Column("Y", "9J", array=[xs]),
        fits.Column("VALUES", "162E", dim="(2,9,9)", array=[vals])], name="WCS-WAVE")
    psft = fits.BinTableHDU.from_columns([
        fits.Column("XCENTER", "E", array=[520.0]), fits.Column("YCENTER", "E", array=[620.0]),
        fits.Column("EPSF", "1089D", dim="(33,33)", array=[psf])], name="PSF")
    psft.header["OVSMPX"], psft.header["OVSMPY"] = 5, 5
    hl = fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(img.astype(np.float32), hdr, name="IMAGE"),
                       fits.ImageHDU(flags, fh, name="FLAGS"),
                       fits.ImageHDU(np.full((n, n), noise ** 2, np.float32), hdr, name="VARIANCE"),
                       fits.ImageHDU(np.full((n, n), bkg * 0.9, np.float32), hdr, name="ZODI"), psft, wave])
    hl.writeto(path, overwrite=True)
    return w.all_pix2world([[x0, y0]], 0)[0]


def test_psf_stamp_normalisation():
    psf = gaussian_epsf()
    st = native_psf_stamp(psf, 5, 0.0, 0.0, 7)
    assert st.sum() == pytest.approx(1.0, abs=0.01)
    assert np.unravel_index(st.argmax(), st.shape) == (3, 3)


@pytest.mark.parametrize("dx,dy", [(0.0, 0.0), (0.3, -0.2), (-0.45, 0.4)])
def test_psf_stamp_matches_analytic_pixel_integrated_psf(dx, dy):
    """The ePSF must be sampled, not re-integrated: compare with the exact pixel-integrated
    Gaussian (this would fail by ~10% in the peak with sub-sample summation)."""
    st = native_psf_stamp(gaussian_epsf(), 5, dx, dy, 7)
    off = np.arange(7) - 3
    exact = np.outer(_pix_integrated_1d(off - dy), _pix_integrated_1d(off - dx))
    assert np.max(np.abs(st - exact)) < 0.01 * exact.max()


def test_wavelength_lookup_bilinear(tmp_path):
    p = tmp_path / "SIMULATED_img.fits"
    make_fake(p)
    img = read_spherex_image(p)
    wl, bw = lookup_table_wavelength(img, 20.0, 20.0)
    # psi1 = 1 + (21 - (-499)) = 521 -> lambda = 1.1 + 0.5 * 520 / 2040
    assert wl == pytest.approx(1.1 + 0.5 * 520 / 2040, rel=1e-5)
    assert bw == pytest.approx(0.03, rel=1e-5)


def test_forced_photometry_recovers_flux(tmp_path):
    p = tmp_path / "SIMULATED_img.fits"
    amp = 500.0
    ra, dec = make_fake(p, flux_amp=amp)
    img = read_spherex_image(p)
    pt = forced_psf_photometry(img, ra, dec, recentre=True)
    expected = amp * 37.8 * (np.pi / 180 / 3600) ** 2 * MJY_TO_UJY
    assert pt.flux_uJy == pytest.approx(expected, rel=0.03)
    assert pt.snr > 50
    assert pt.quality_flag in ("GOOD", "WARN")
    assert pt.centroid_shift_pix < 0.5


def test_trailed_moving_object_with_outlier_flags(tmp_path):
    """Moving object: 1.5-px trail along +x and its own OUTLIER flags in the core (as seen in real
    SPHEREx DR1 data of 433 Eros). Flux must be recovered with the trailed PSF model."""
    p = tmp_path / "SIMULATED_trail.fits"
    amp, trail_px = 500.0, 1.5
    ra, dec = make_fake(p, flux_amp=amp, trail_px=trail_px, outlier_core=True)
    img = read_spherex_image(p)
    dt_h = (img.mjd_end - img.mjd_beg) * 24
    # +x is -RA (CDELT1 < 0): rate in RA*cos(dec) that moves the source by trail_px pixels
    rate_ra = -trail_px * 6.15 / dt_h
    pt = forced_psf_photometry(img, ra, dec, recentre=False, rate_ra_arcsec_h=rate_ra, rate_dec_arcsec_h=0.0)
    expected = amp * 37.8 * (np.pi / 180 / 3600) ** 2 * MJY_TO_UJY
    assert pt.flux_uJy == pytest.approx(expected, rel=0.03)
    assert pt.trail_length_pix == pytest.approx(trail_px, rel=0.05)
    assert "rejected pixel" not in pt.quality_reasons          # self-raised OUTLIER flags not rejected
    # an unmodelled (point-source) PSF gives chi2 ~35 for this trail at this S/N
    assert pt.chi2_red < 1.5


def _saturate_peak(path, x0, y0, bit=16):
    """Mark the brightest pixel OVERFLOW and clip its value, as SPHEREx L2 does for a saturated ramp."""
    with fits.open(path, mode="update") as hl:
        hl["FLAGS"].header["MSKN0004"], hl["FLAGS"].header["MSKM0004"] = "OVERFLOW", bit
        iy, ix = int(round(y0)), int(round(x0))
        hl["FLAGS"].data[iy, ix] |= bit
        hl["IMAGE"].data[iy, ix] = 0.3 * hl["IMAGE"].data[iy, ix]


def test_saturated_core_is_flagged_and_fitted_on_the_wings(tmp_path, monkeypatch):
    """A saturated PSF peak is rejected; the point says so (reason + core_flags). With an exact PSF the
    wing fit recovers the flux; saturated_core_policy 'bad' removes such points instead."""
    import src.extraction.spectral_extraction as se
    p = tmp_path / "SIMULATED_sat.fits"
    amp, x0, y0 = 500.0, 20.3, 19.6
    ra, dec = make_fake(p, flux_amp=amp, x0=x0, y0=y0)
    _saturate_peak(p, x0, y0)
    cfg = se.settings()
    monkeypatch.setattr(se, "settings", lambda: cfg)
    cfg["extraction"]["saturated_core_policy"] = "warn"
    pt = forced_psf_photometry(read_spherex_image(p), ra, dec, recentre=False)
    expected = amp * 37.8 * (np.pi / 180 / 3600) ** 2 * MJY_TO_UJY
    assert "OVERFLOW" in pt.core_flags.split("|")
    assert "saturated PSF core (OVERFLOW)" in pt.quality_reasons and pt.quality_flag == "WARN"
    assert pt.flux_uJy == pytest.approx(expected, rel=0.05)
    cfg["extraction"]["saturated_core_policy"] = "bad"
    assert forced_psf_photometry(read_spherex_image(p), ra, dec, recentre=False).quality_flag == "BAD"


def test_default_use_of_saturated_points_is_inflated_errors():
    """Wing-only photometry scatters 7-8% in B1/B2 on the calibration stars (2-3% clean): used with that
    error floor, and the classification is checked without them."""
    from src.common.config import settings
    s = settings()
    assert s["extraction"]["saturated_core_policy"] == "warn"
    assert s["temporal"]["saturated_points"] == "inflated"
    assert s["temporal"]["saturated_flux_error_frac"] == pytest.approx(0.08)
