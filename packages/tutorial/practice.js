import { getLang, normalizeLang } from './i18n.js';

/** Practice status messages. Both languages keep identical keys (tested). */
export const PRACTICE_TEXT = {
  ko: {
    loading: '화면을 준비하고 있어요. 준비되면 도구가 표시됩니다. 안내는 계속 볼 수 있어요.',
    analysisOpen: '분석창이 열렸어요. 선택한 위치를 살펴본 뒤 ‘안내 계속’으로 학습을 이어가세요.',
    panelLabel: '탐색 도구 열기',
    panel: '접힌 탐색 패널을 먼저 열어 주세요. 관측 설정은 바뀌지 않아요.',
    researchLabel: '연구 모드 열기',
    research: '이 도구는 연구(Research) 모드에 있어요. 먼저 모드를 바꿔 주세요.',
    observeLabel: '관측 보기 열기',
    observe: '지금은 분석 화면 안의 하늘 탐색 보기예요. 관측 보기로 전환하면 영상과 타임라인을 사용할 수 있어요.',
    patch: '현재는 임의 좌표의 영역 자료예요. 이 연구 도구는 준비된 추천 대상에서 제공합니다. 위의 추천 대상을 직접 고르거나 안내를 계속 보세요.',
    fieldLoading: '선택한 대상의 자료를 준비하고 있어요. 실패·자료 없음 안내가 나오면 먼저 그 상태를 확인하세요. 준비되지 않아도 안내는 계속 볼 수 있어요.',
    noTab: '선택한 대상에는 이 분석 탭이 없어요. 지원되는 추천 대상을 고르거나 안내를 계속 볼 수 있어요.',
    tabLabel: '분석 탭 열기',
    tab: '해당 분석 탭을 열면 그래프와 자료 출처를 확인할 수 있어요.',
    ready: '민트색 테두리의 도구를 사용해 보세요. 실습 뒤 ‘안내 계속’으로 돌아올 수 있어요.',
    waiting: '도구가 준비되면 자동으로 표시해요. 준비되지 않아도 안내는 계속 볼 수 있어요.',
  },
  en: {
    loading: 'Preparing the screen. The tool will appear when it is ready. You can keep reading the guide.',
    analysisOpen: 'The analysis window is open. Look at the selected position, then choose ‘Continue guide’ to carry on learning.',
    panelLabel: 'Open exploration tools',
    panel: 'Open the collapsed exploration panel first. Your observing settings will not change.',
    researchLabel: 'Open the Analyse view',
    research: 'This tool is in the Analyse view. Switch to that view first.',
    observeLabel: 'Open the Observe view',
    observe: 'This is the Find view of the analysis screen. Switch to the Observe view to use the images and timeline.',
    patch: 'This is region data for an arbitrary position. This research tool is offered for the prepared featured targets. Pick a featured target above, or continue the guide.',
    fieldLoading: 'Preparing data for the selected target. If a failure or no-data notice appears, check that status first. You can continue the guide even if it is not ready.',
    noTab: 'The selected target does not have this analysis tab. Pick a supported featured target, or continue the guide.',
    tabLabel: 'Open the analysis tab',
    tab: 'Open this analysis tab to see the graph and its data provenance.',
    ready: 'Try the tool with the mint outline. When you have finished, choose ‘Continue guide’ to come back.',
    waiting: 'The tool will be marked as soon as it is ready. You can continue the guide even if it is not ready.',
  },
};

/** Small DOM adapter for real-screen practice. It never reads or mutates scientific stores. */
export function rendered(element, doc = element?.ownerDocument) {
  if (!element || element.isConnected === false) return false;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  for (let parent = element; parent; parent = parent.parentElement) {
    if (parent.hidden || parent.inert || parent.getAttribute?.('aria-hidden') === 'true') return false;
    const style = doc?.defaultView?.getComputedStyle(parent);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0')) return false;
  }
  return true;
}

export function inViewport(element, win = element?.ownerDocument?.defaultView) {
  const box = element.getBoundingClientRect();
  return box.bottom > 0 && box.right > 0 && box.top < win.innerHeight && box.left < win.innerWidth;
}

function find(doc, selector) { try { return doc.querySelector(selector); } catch { return null; } }

/** Return an actionable prerequisite instead of claiming an absent/disabled tool is ready. */
export function practiceStatus(doc, practice, page, lang = getLang()) {
  const m = PRACTICE_TEXT[normalizeLang(lang)];
  if (!doc) return { target: null, state: 'loading', message: m.loading };
  const requires = new Set(practice.requires ?? []);
  const action = (selector, label, message, type = 'click') => ({ target: null, state: 'setup', message, action: { selector, label, type } });
  if (page === 'planetarium') {
    if (find(doc, '#analysis-dialog')?.open) return { target: null, state: 'analysis-open', message: m.analysisOpen };
    const toggle = find(doc, '#toggle-panel');
    if (requires.has('panel') && toggle?.getAttribute('aria-expanded') === 'false') {
      return action('#toggle-panel', m.panelLabel, m.panel);
    }
  }
  if (page === 'analysis') {
    const viewer = find(doc, '[data-analysis-kind]');
    const mode = find(doc, '[data-testid="mode-research"]');
    if (requires.has('research') && mode?.getAttribute('aria-pressed') !== 'true' && rendered(mode, doc)) {
      return action('[data-testid="mode-research"]', m.researchLabel, m.research);
    }
    const skyMode = find(doc, '[data-testid="stage-sky"]');
    const exploreMode = find(doc, '[data-testid="mode-explore"]');
    if (requires.has('field') && skyMode?.getAttribute('aria-pressed') === 'true' && rendered(exploreMode, doc)) {
      return action('[data-testid="mode-explore"]', m.observeLabel, m.observe);
    }
    if (requires.has('prepared') && viewer?.dataset.analysisKind === 'patch') return {
      target: null, state: 'unsupported', message: m.patch
    };
    if (requires.has('field') && viewer?.dataset.analysisReady !== 'true') return {
      target: null, state: 'loading', message: m.fieldLoading
    };
    if (practice.tab) {
      const tab = find(doc, `[data-testid="atab-${practice.tab}"]`);
      if (!tab && requires.has('prepared')) return { target: null, state: 'unsupported', message: practice.hint || m.noTab };
      if (tab && tab.getAttribute('aria-selected') !== 'true' && rendered(tab, doc)) return action(`[data-testid="atab-${practice.tab}"]`, m.tabLabel, m.tab);
    }
  }
  const target = find(doc, practice.selector);
  if (rendered(target, doc) && !target.disabled) {
    return { target, state: 'ready', message: m.ready };
  }
  return { target: null, state: 'waiting', message: practice.hint || m.waiting };
}

/** Keep watching beyond a slow archive fetch; updates must never move focus or scroll. */
export function monitorPractice(read, onChange, timers = globalThis) {
  let previous = null;
  let stopped = false;
  const refresh = () => {
    if (stopped) return;
    const current = read();
    const signature = JSON.stringify([current.state, current.message, current.action, current.languageAvailable]);
    if (!previous || current.target !== previous.target || signature !== previous.signature) {
      const first = previous === null;
      previous = { target: current.target, signature };
      onChange(current, { first });
    }
  };
  refresh();
  const timer = timers.setInterval(refresh, 500);
  return { refresh, stop() { stopped = true; timers.clearInterval(timer); } };
}
