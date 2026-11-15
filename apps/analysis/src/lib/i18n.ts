// Korean / English switch (TrueBlink offers both; ours keeps the two texts side by side at each call
// site, so no string can be missing a translation). The language lives in the URL (?lang=en).
import { useTime } from '../store'
import type { Lang } from '../store'

export type L = (ko: string, en: string) => string
export const pick = (lang: Lang): L => (ko, en) => (lang === 'en' ? en : ko)
/** Hook: L('한국어', 'English') */
export function useL(): L {
  return pick(useTime((s) => s.lang))
}
/** Outside React (missions, findings): current language. */
export const currentL = (): L => pick(useTime.getState().lang)

// Notes written into meta.json by the bake scripts are Korean; known ones get an English rendering.
const DATA_EN: [RegExp, string][] = [
  [/^중심 픽셀 결측\(포화\) — 중심 측정 생략$/, 'core pixels missing (saturated): no centroid'],
  [/^중심 포화 — 바깥 고리 밝기\(상대값\)만$/, 'saturated core: ring brightness (relative) only'],
  [/^중심 픽셀 결측\(포화\)$/, 'core pixels missing (saturated)'],
  [/^가장자리$/, 'frame edge'],
  [/^짧은 파장\(D1–D4\)은 근처 별 빛이 지배해 중심이 1\.2–1\.8 px 끌려감 → WISE 0855가 밝은 D5–D6\(3\.8–5\.0 µm\)만 사용$/, 'At short wavelengths (D1–D4) light from a nearby star dominates and pulls the centroid by 1.2–1.8 px, so only D5–D6 (3.8–5.0 µm), where WISE 0855 is bright, are used'],
]
export function dataText(s: string, L: L): string {
  const en = L('', 'en') === 'en'
  if (!en) return s
  for (const [re, t] of DATA_EN) if (re.test(s)) return t
  return s
}
