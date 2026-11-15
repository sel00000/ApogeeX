// Text table of the search interface. English is the default; Korean is the original wording, unchanged.
// The word lists that let the engine understand Korean queries are functionality and live elsewhere.
export type Lang = 'en' | 'ko';
export const LANG_KEY = 'spherex-lang';

const KO = {
  label: '천체 이름 · 한글/영문 · 천구 좌표',
  placeholder: '예: 바너드별, M31, 433 Eros, 10.684, 41.269',
  submit: '검색',
  preparing: '검색 목록을 준비하고 있습니다.',
  resultsAria: '천체 검색 결과',
  choiceAria: '선택한 천체',
  helpCoords: '좌표는 ICRS/J2000 기준 도 단위 또는 시·분·초로 입력하세요. 예: 05:35:17.3 −05:23:28',
  helpMoving: '이동 천체는 날짜·관측자에 맞는 위치 확인이 필요합니다.',
  suggestHint: '후보를 고르거나 검색을 눌러 외부 목록까지 조회하세요.',
  typeHint: '천체 이름이나 좌표를 입력하세요.',
  loadFailed: '검색 목록을 불러오지 못했습니다. 검색을 눌러 다시 시도하세요. {detail}',
  searchTimeout: '검색 시간이 초과되었습니다. 다시 시도하세요.',
  lookupTimeout: '조회 시간이 초과되었습니다.',
  searching: '천체를 찾고 있습니다…',
  searchFailed: '검색을 완료하지 못했습니다. 다시 시도하세요.',
  closed: '검색을 닫았습니다. 다시 입력해 검색할 수 있습니다.',
  openAsteroid: '소행성 분석 열기',
  viewSky: '천구에서 보기',
  analyse: 'SPHEREx 자료 분석',
  cancelled: '취소됨',
  needHostAndHandler: '검색을 표시할 요소와 선택 처리기가 필요합니다.',
  indexHttp: '검색 목록 HTTP {status}',
  indexNotObject: '검색 목록이 올바른 JSON 객체가 아닙니다.',
  indexVersion: '지원하지 않는 검색 목록 버전입니다.',
  indexFormat: '검색 목록의 자료 형식이 올바르지 않습니다.',
  indexRow: '검색 목록 {n}번째 천체의 좌표 또는 별칭이 올바르지 않습니다.',
  noValidCoords: '조회 결과에 유효한 천구 좌표가 없습니다.',
  movingDetail: '이동 천체 · 날짜와 관측자에 따라 위치가 달라집니다',
  aiCandidate: ' · AI 해석 후보',
  asteroidDetail: '소행성 · 준비된 관측 및 분석 결과',
  bodyDetail: '태양계 천체 · 천구에서 이름으로 찾기',
  enterNameOrCoords: '천체 이름이나 적경·적위를 입력하세요.',
  coordsMistake: '좌표를 확인하세요. 적경은 0° 이상 360° 미만, 적위는 −90°~90°입니다. 시·분·초의 분과 초는 60 미만이어야 합니다. 도 단위 예: 10.684, 41.269',
  chooseMoving: '이동 천체를 선택하세요. 현재 위치를 임의의 고정 좌표로 바꾸지 않습니다.',
  chooseCount: '{n}개 결과에서 대상을 선택하세요.',
  partialSuffix: ' 일부 외부 조회가 완료되지 않았습니다.',
  noneExternal: '외부 검색에 연결하지 못했거나 결과가 없습니다. 이름을 확인하거나 다시 검색하세요.',
  noneFound: '일치하는 천체가 없습니다. 다른 이름이나 좌표로 검색하세요.',
};
const EN: Record<keyof typeof KO, string> = {
  label: 'Object name (English or Korean) · sky coordinates',
  placeholder: "e.g. Barnard's Star, M31, 433 Eros, 10.684, 41.269",
  submit: 'Search',
  preparing: 'Preparing the search list…',
  resultsAria: 'Object search results',
  choiceAria: 'Selected object',
  helpCoords: 'Enter coordinates in ICRS/J2000, as degrees or as hours, minutes and seconds. Example: 05:35:17.3 −05:23:28',
  helpMoving: 'A moving object needs its position checked for the date and the observer.',
  suggestHint: 'Pick a candidate, or press Search to query the external catalogues too.',
  typeHint: 'Enter an object name or coordinates.',
  loadFailed: 'Could not load the search list. Press Search to try again. {detail}',
  searchTimeout: 'The search timed out. Try again.',
  lookupTimeout: 'The lookup timed out.',
  searching: 'Looking for the object…',
  searchFailed: 'The search could not finish. Try again.',
  closed: 'Search closed. Type again to search.',
  openAsteroid: 'Open Asteroid Analysis',
  viewSky: 'View on the sky',
  analyse: 'Analyse SPHEREx data',
  cancelled: 'Cancelled',
  needHostAndHandler: 'Search needs a host element and a selection handler.',
  indexHttp: 'Search list HTTP {status}',
  indexNotObject: 'The search list is not a valid JSON object.',
  indexVersion: 'This version of the search list is not supported.',
  indexFormat: 'The data format of the search list is not valid.',
  indexRow: 'The coordinates or aliases of object {n} in the search list are not valid.',
  noValidCoords: 'The result has no valid sky coordinates.',
  movingDetail: 'Moving object · its position depends on the date and the observer',
  aiCandidate: ' · AI-interpreted candidate',
  asteroidDetail: 'Asteroid · prepared observations and analysis results',
  bodyDetail: 'Solar system object · find it by name on the sky',
  enterNameOrCoords: 'Enter an object name or right ascension and declination.',
  coordsMistake: 'Check the coordinates. Right ascension must be 0° or more and below 360°; declination must be between −90° and 90°. Minutes and seconds must be below 60. Example in degrees: 10.684, 41.269',
  chooseMoving: 'Choose a moving object. Its current position is never replaced by an arbitrary fixed coordinate.',
  chooseCount: 'Choose an object. Results: {n}.',
  partialSuffix: ' Some external lookups did not finish.',
  noneExternal: 'The external search could not be reached, or it found nothing. Check the name or search again.',
  noneFound: 'No matching object. Try another name or coordinates.',
};
export type TextKey = keyof typeof KO;
export const TEXT: Record<Lang, Record<TextKey, string>> = { en: EN, ko: KO };

export function t(lang: Lang, key: TextKey, params: Record<string, string | number> = {}): string {
  return TEXT[lang][key].replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
export const asLang = (value: unknown): Lang => (value === 'ko' ? 'ko' : 'en');
/** 'ko' means Korean; anything else, or any storage error, means English. */
export function readStoredLang(): Lang {
  try { return asLang(globalThis.localStorage?.getItem(LANG_KEY)); } catch { return 'en'; }
}

/** An error whose text can be produced in either language, so an open dialog can re-render it. */
export class SearchError extends Error {
  key: TextKey; params: Record<string, string | number>;
  constructor(key: TextKey, params: Record<string, string | number> = {}, lang: Lang = 'en') {
    super(t(lang, key, params)); this.name = 'SearchError'; this.key = key; this.params = params;
  }
  text(lang: Lang) { return t(lang, this.key, this.params); }
}
/** A DOMException (timeouts, aborts) tagged with the text key it can be shown with. */
export function tagged(error: DOMException, key: TextKey, lang: Lang = 'en') {
  return Object.assign(error, { i18nKey: key, i18nText: (l: Lang) => t(l, key) , lang });
}
