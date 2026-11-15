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

// Messages thrown by lib/api.ts are Korean. On an English screen they get an English rendering
// when they are shown, so that switching the language also switches a message already on screen.
const ERROR_EN: [RegExp, string][] = [
  [/^현재 웹사이트에는 새 관측 자료를 처리하는 Python 분석 서버가 연결되어 있지 않습니다\.[\s\S]*$/, 'This website has no Python analysis server connected, so it cannot process a new place in the sky. The observations and analyses of the prepared targets can still be viewed. To analyse a new place, run the site on your own computer with the Python services.'],
  [/^관측 분석 서버의 세션에 연결할 수 없습니다\. 다시 시도하세요\. \(([\s\S]*)\)$/, 'Could not open a session with the observation analysis server. Try again. ($1)'],
  [/^분석 서버 세션 응답 HTTP (\d+)$/, 'Analysis server session response: HTTP $1'],
  [/^분석 서버 세션 응답 형식이 올바르지 않습니다\.$/, 'The analysis server sent a session response in an unexpected format.'],
  [/^관측 자료를 받거나 처리하지 못했습니다\. 다시 시도할 수 있습니다\.$/, 'The observations could not be fetched or processed. You can try again.'],
  [/^관측 분석 서버에 연결할 수 없습니다\. 잠시 후 다시 시도하세요\. \(([\s\S]*)\)$/, 'Could not reach the observation analysis server. Try again shortly. ($1)'],
  [/^서버 응답 HTTP (\d+)$/, 'Server response: HTTP $1'],
  [/^분석 작업 식별자가 올바르지 않습니다\.$/, 'The analysis job identifier is not valid.'],
  [/^관측 자료 다운로드에 실패했습니다\.$/, 'Downloading the observations failed.'],
  [/^관측 결과 형식이 올바르지 않습니다\.$/, 'The observation result has an unexpected format.'],
]
export function errorText(s: string, L: L): string {
  if (L('', 'en') !== 'en') return s
  for (const [re, t] of ERROR_EN) if (re.test(s)) return s.replace(re, t)
  return s
}
