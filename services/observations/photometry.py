"""Native-grid aperture photometry with conservative source and background QA.

SOURCE is a catalogue label, not a quality defect. Defective aperture pixels are
never silently dropped from a sum: the absolute flux is unavailable instead.
"""
import numpy as np

FATAL_FLAGS = ('OVERFLOW', 'SUR_ERROR', 'NONLINEAR', 'TRANSIENT', 'PERSIST',
               'HOT', 'COLD', 'NONFUNC', 'MISSING_DATA', 'OUTLIER')


def native_photometry(img, variance, flags, names, x, y, wavelength, pixel_sr):
    img = np.array(img, dtype=np.float64, copy=True)
    flags = np.asarray(flags)
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    distance = np.hypot(xx - float(x), yy - float(y))
    aperture = distance <= 2.5
    bits = 0
    for name in FATAL_FLAGS:
        bits |= names.get(name, 0)
    invalid = ((flags & bits) != 0) | ~np.isfinite(img)
    img[invalid] = np.nan
    annulus = (distance > 4.5) & (distance <= 8.0) & ~invalid
    hit = int(np.bitwise_or.reduce(flags[aperture])) if aperture.any() else 0
    result = dict(wave_um=round(wavelength[0], 4) if wavelength else None,
                  bandwidth_um=round(wavelength[1], 4) if wavelength else None,
                  flux_mjy=None, err_mjy=None, ring_mjy_sr=None, ring_err=None,
                  flags=[name for name in FATAL_FLAGS if hit & names.get(name, 0)], note=None)
    if not aperture.any() or not np.isfinite([x, y]).all() or min(x, y) < 8 or x > img.shape[1] - 8 or y > img.shape[0] - 8:
        result['note'] = '가장자리 또는 유효하지 않은 위치'
        return result
    if annulus.sum() < 20:
        result['note'] = '품질 마스크 적용 후 배경 픽셀 부족'
        return result
    background = np.median(img[annulus])
    background_sigma = 1.4826 * np.median(np.abs(img[annulus] - background))
    if invalid[aperture].any():
        ring = (distance > 2.5) & (distance <= 4.5) & ~invalid
        if ring.sum() >= 8:
            result['ring_mjy_sr'] = round(float(np.mean(img[ring]) - background), 4)
            result['ring_err'] = round(float(background_sigma / np.sqrt(ring.sum())), 4)
        result['note'] = '소스 영역 결측 또는 품질 불량 — 절대 측광 제외, 유효 고리의 상대 밝기만'
        return result
    if variance is not None:
        variance = np.asarray(variance)
        if not np.all(np.isfinite(variance[aperture]) & (variance[aperture] >= 0)):
            result['note'] = '분산 자료 결측 또는 음수 — 측광 불확실성을 검증할 수 없어 제외'
            return result
        source_variance = np.sum(variance[aperture])
    else:
        source_variance = aperture.sum() * background_sigma ** 2
        result['note'] = '원본 분산 없음 — 배경 산포로 추정한 불확실성'
    flux = np.sum(img[aperture] - background) * pixel_sr * 1e9
    noise2 = source_variance + aperture.sum() ** 2 * background_sigma ** 2 / annulus.sum()
    result.update(flux_mjy=round(float(flux), 4), err_mjy=round(float(np.sqrt(noise2)) * pixel_sr * 1e9, 4))
    return result
