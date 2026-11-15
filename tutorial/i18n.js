/** Site language contract (spec-i18n D1). English is the default; 'ko' is the only other value. */
export const LANG_KEY = 'spherex-lang';
export const LANG_EVENT = 'spherex-lang-change';
export const LANGS = ['en', 'ko'];

export function normalizeLang(value) { return value === 'ko' ? 'ko' : 'en'; }

/** Any storage error, missing value or unknown value means English. */
export function readLang(win = globalThis) {
  try { return normalizeLang(win.localStorage?.getItem(LANG_KEY)); } catch { return 'en'; }
}

let current = null;
/** The language this document's tutorial modules currently show. */
export function getLang() { if (current === null) current = readLang(); return current; }
export function setCurrentLang(lang) { current = normalizeLang(lang); return current; }

/** Store the choice and tell the other modules in this document (storage events do not fire here). */
export function publishLang(win, lang) {
  const value = normalizeLang(lang);
  try { win.localStorage?.setItem(LANG_KEY, value); } catch { /* The DOM event still carries the choice. */ }
  const EventType = win.CustomEvent ?? globalThis.CustomEvent;
  win.dispatchEvent(new EventType(LANG_EVENT, { detail: { lang: value } }));
  return value;
}

/** Follow the three D1 channels. onChange receives a normalised language; returns an unsubscribe. */
export function watchLang(win, onChange) {
  const fromEvent = (event) => onChange(normalizeLang(event.detail?.lang));
  const fromStorage = (event) => { if (event.key === LANG_KEY) onChange(normalizeLang(event.newValue)); };
  const fromParent = (event) => {
    if (event.origin !== win.location?.origin || event.source !== win.parent) return;
    if (event.data?.type === 'spherex-lang') onChange(normalizeLang(event.data.lang));
  };
  win.addEventListener(LANG_EVENT, fromEvent);
  win.addEventListener('storage', fromStorage);
  win.addEventListener('message', fromParent);
  return () => {
    win.removeEventListener(LANG_EVENT, fromEvent);
    win.removeEventListener('storage', fromStorage);
    win.removeEventListener('message', fromParent);
  };
}

/** Interface text of the tutorial shell. Both languages must keep identical keys (tested). */
export const UI = {
  ko: {
    langGroup: 'Language', langLive: '언어: 한국어',
    topics: '주제 선택', topicsLabel: '튜토리얼 주제 다시 선택',
    skip: '건너뛰기 ✕', close: '닫기 ✕', skipLabel: '튜토리얼 건너뛰기 및 닫기',
    fullAlt: '우주 탐사를 안내하는 스피어 캐릭터', portraitAlt: (name) => `${name} 안내 캐릭터`,
    greeting: '반가워요, 저는 스피어예요.', greetingLine: '별을 찾고, 빛을 읽고, 발견의 근거를 함께 살펴봐요.',
    crew: '파인만 · 도플러 · 아인슈타인\n케플러 · 칼 세이건과 함께',
    chooserEyebrow: '나에게 맞는 관측 안내서', welcomeTitle: '별빛을 읽는 첫 여행', againTitle: '어떤 안내를 다시 볼까요?',
    chooserLead: '눈높이를 고르고, 처음부터 배우거나 필요한 주제만 골라보세요. 언제든 건너뛸 수 있어요.',
    trackGroup: '튜토리얼 대상 선택', topicHeading: '다시 보고 싶은 주제',
    startTopic: (title) => `${title} 튜토리얼 시작`, minutes: (n) => `${n}분 ↗`,
    startAll: '처음부터 함께 시작하기 →', allSummary: (count, total) => `전체 ${count}개 주제 · 약 ${total}분`,
    visualLabel: '설명을 돕는 학습용 예시', checkEyebrow: '잠깐, 이해했는지 확인해요',
    correct: '맞아요.', retry: '다시 살펴볼까요?',
    tryHere: '이 화면에서 직접 해보기 ↗', tryOn: (label) => `${label}에서 직접 해보기 ↗`,
    sources: '공식 자료로 더 알아보기', back: '← 이전', next: '다음 →', finish: '안내 마치기 ✓', progress: '튜토리얼 진행',
    visualError: '예시 그림을 표시하지 못했습니다. 위 설명과 다음 단계는 계속 이용할 수 있습니다.',
    completeTitle: '이제, 직접 별빛을 읽어보세요.',
    completeAll: '하늘 탐색부터 분석 결과의 근거까지 살펴봤어요. 궁금할 때마다 상단의 튜토리얼로 돌아오세요.',
    completeModule: (title) => `${title} 안내를 마쳤어요. 다른 주제를 골라 이어서 배울 수도 있어요.`,
    backToObserving: '관측 화면으로 돌아가기', otherTopic: '다른 주제 골라보기', replay: '이 안내 다시 보기',
    completeNote: '관측값과 해석 구분하기 · 결측은 0이 아님 · 변화는 확인이 필요한 후보',
    dockLabel: '튜토리얼 실습 안내', practiceTitle: '직접 해보기', practiceSearching: '화면에서 안내할 도구를 찾고 있어요.',
    continueGuide: '안내 계속 →', closeTutorial: '튜토리얼 닫기',
    navIncomplete: '화면 이동이 완료되지 않았어요. 상단 메뉴에서 실습 화면을 열거나 안내를 계속 볼 수 있어요.',
    navFailed: '화면을 열지 못했어요. 상단 메뉴에서 다시 열거나 안내를 계속 볼 수 있어요.',
    navLoading: '실습 화면을 준비하고 있어요. 준비되지 않아도 안내는 계속 볼 수 있습니다.',
    otherScreen: (label) => `${label} 화면에서 실습할 수 있어요. 상단 메뉴로 이동하거나 안내를 계속 볼 수 있습니다.`,
    goToTool: '도구 위치로 이동', viewKorean: '한국어로 보기',
  },
  en: {
    langGroup: 'Language', langLive: 'Language: English',
    topics: 'Topics', topicsLabel: 'Choose a tutorial topic again',
    skip: 'Skip ✕', close: 'Close ✕', skipLabel: 'Skip and close the tutorial',
    fullAlt: 'Sphere, the character who guides you through space', portraitAlt: (name) => `${name} guide drawing`,
    greeting: 'Hello, I’m Sphere.', greetingLine: 'Let’s find stars, read their light and look at the evidence behind each discovery.',
    crew: 'With Feynman · Doppler · Einstein\nKepler · Carl Sagan',
    chooserEyebrow: 'An observing guide that fits you', welcomeTitle: 'Your first journey into reading starlight', againTitle: 'Which guide would you like to see again?',
    chooserLead: 'Choose your level, then start from the beginning or pick only the topics you need. You can skip at any time.',
    trackGroup: 'Choose who the tutorial is for', topicHeading: 'Topics to revisit',
    startTopic: (title) => `Start the ${title} tutorial`, minutes: (n) => `${n} min ↗`,
    startAll: 'Start from the beginning →', allSummary: (count, total) => `All ${count} topics · about ${total} min`,
    visualLabel: 'Teaching example for this explanation', checkEyebrow: 'Quick check',
    correct: 'Correct.', retry: 'Let’s look again.',
    tryHere: 'Try it on this screen ↗', tryOn: (label) => `Open ${label} to try it ↗`,
    sources: 'Learn more from official sources', back: '← Back', next: 'Next →', finish: 'Finish ✓', progress: 'Tutorial progress',
    visualError: 'The example diagram could not be shown. The explanation above and the next steps are still available.',
    completeTitle: 'Now read the starlight yourself.',
    completeAll: 'You have gone from exploring the sky to the evidence behind analysis results. Open Tutorial in the top bar whenever you have a question.',
    completeModule: (title) => `You have finished “${title}”. You can pick another topic and keep learning.`,
    backToObserving: 'Back to observing', otherTopic: 'Choose another topic', replay: 'Replay this guide',
    completeNote: 'Keep measurements and interpretation apart · Missing is not zero · A change is a candidate to check',
    dockLabel: 'Tutorial practice guide', practiceTitle: 'Try it yourself', practiceSearching: 'Looking for the tool on the screen.',
    continueGuide: 'Continue guide →', closeTutorial: 'Close tutorial',
    navIncomplete: 'The screen did not finish opening. Open the practice screen from the top menu, or continue the guide.',
    navFailed: 'The screen could not be opened. Open it again from the top menu, or continue the guide.',
    navLoading: 'Preparing the practice screen. You can continue the guide even if it is not ready.',
    otherScreen: (label) => `Open ${label} to practise this. Use the top menu, or continue the guide.`,
    goToTool: 'Go to the tool', viewKorean: 'View in Korean',
  },
};
export function ui(lang = getLang()) { return UI[normalizeLang(lang)]; }
