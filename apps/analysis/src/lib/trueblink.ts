// Hand-off link to TrueBlink (teammate's site), which fetches real SPHEREx exposures of any place live.
// Address format and FOV limits mirror trueblink/src/app/urlState.ts and config.ts (MIN/MAX_FOV_ARCSEC).
export const TRUEBLINK_BASE = 'https://trueblink.pages.dev/'
export const TB_MIN_FOV_ARCSEC = 60
export const TB_MAX_FOV_ARCSEC = 780

const fix4 = (v: number) => String(Number(v.toFixed(4)))

export function trueBlinkUrl({ ra, dec, fovDeg, lang }: { ra: number; dec: number; fovDeg?: number; lang: 'ko' | 'en' | string }): string {
  const r = ((ra % 360) + 360) % 360
  const d = Math.min(90, Math.max(-90, dec))
  let url = `${TRUEBLINK_BASE}#ra=${fix4(r === 360 ? 0 : r)}&dec=${fix4(d)}`
  if (fovDeg != null && Number.isFinite(fovDeg)) {
    const arcsec = Math.min(TB_MAX_FOV_ARCSEC, Math.max(TB_MIN_FOV_ARCSEC, Math.round(fovDeg * 3600)))
    url += `&fov=${arcsec}`
  }
  return url + `&lang=${lang === 'ko' ? 'ko' : 'en'}`
}
