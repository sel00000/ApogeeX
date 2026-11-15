"""Reader for SPHEREx Level-2 spectral image products (full images or IBE cutouts).

Extensions used: IMAGE [MJy/sr], FLAGS (bitmask; planes named in MSKNnnnn keywords),
VARIANCE [(MJy/sr)^2], ZODI [MJy/sr] (zodiacal model, NOT assumed subtracted from IMAGE),
PSF (EPSF table, oversampled, per detector zone), WCS-WAVE (spectral lookup table).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning
import warnings


@dataclass
class SpherexImage:
    path: Path
    image: np.ndarray
    flags: np.ndarray
    variance: np.ndarray
    zodi: np.ndarray | None
    header: fits.Header
    wcs: WCS
    flag_planes: dict = field(default_factory=dict)   # name -> bit value
    psf_table: fits.FITS_rec | None = None
    psf_header: fits.Header | None = None
    wave_table: fits.FITS_rec | None = None
    wave_header: fits.Header | None = None
    hdul: fits.HDUList | None = None

    @property
    def detector(self) -> int:
        return int(self.header.get("DETECTOR", -1))

    @property
    def obs_id(self) -> str:
        return str(self.header.get("OBSID", ""))

    @property
    def mjd_avg(self) -> float:
        return float(self.header["MJD-AVG"])

    @property
    def mjd_beg(self) -> float:
        return float(self.header["MJD-BEG"])

    @property
    def mjd_end(self) -> float:
        return float(self.header["MJD-END"])

    @property
    def pixel_solid_angle_sr(self) -> float:
        """Median pixel solid angle (OMEGA_MEDIAN, arcsec^2) converted to sr."""
        om = self.header.get("OMEGA_MEDIAN")
        if om is None:
            raise KeyError("OMEGA_MEDIAN missing; pixel solid angle unknown")
        return float(om) * (np.pi / 180 / 3600) ** 2

    def active_pixel_offset(self) -> tuple[float, float]:
        """Offset that maps 0-based cutout array indices to 0-based detector active-pixel
        coordinates, from the alternate 'A' WCS (WCSNAMEA '0-based active pixel coordinates')."""
        h = self.flags_header if hasattr(self, "flags_header") else self.header
        crpix1 = float(h.get("CRPIX1A", self.header.get("CRPIX1W", 1.0)))
        crpix2 = float(h.get("CRPIX2A", self.header.get("CRPIX2W", 1.0)))
        crval1 = float(h.get("CRVAL1A", 0.0))
        crval2 = float(h.get("CRVAL2A", 0.0))
        # active = crval + (p_fits - crpix) with p_fits = idx + 1
        return crval1 + 1.0 - crpix1, crval2 + 1.0 - crpix2


def read_spherex_image(path: str | Path) -> SpherexImage:
    path = Path(path)
    hdul = fits.open(path, memmap=False)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        hdr = hdul["IMAGE"].header
        wcs = WCS(hdr)
    flags_hdu = hdul["FLAGS"]
    planes = {}
    for key, val in flags_hdu.header.items():
        if key.startswith("MSKN"):
            n = key[4:]
            bit = flags_hdu.header.get(f"MSKM{n}")
            if bit is not None:
                planes[str(val).strip()] = int(bit)
    img = SpherexImage(
        path=path,
        image=np.asarray(hdul["IMAGE"].data, dtype=float),
        flags=np.asarray(flags_hdu.data, dtype=np.int64),
        variance=np.asarray(hdul["VARIANCE"].data, dtype=float),
        zodi=np.asarray(hdul["ZODI"].data, dtype=float) if "ZODI" in hdul else None,
        header=hdr, wcs=wcs, flag_planes=planes, hdul=hdul,
    )
    img.flags_header = flags_hdu.header
    psf_name = "PSF" if "PSF" in hdul else ("EPSF" if "EPSF" in hdul else None)
    if psf_name:
        img.psf_table = hdul[psf_name].data
        img.psf_header = hdul[psf_name].header
    if "WCS-WAVE" in hdul:
        img.wave_table = hdul["WCS-WAVE"].data
        img.wave_header = hdul["WCS-WAVE"].header
    return img
