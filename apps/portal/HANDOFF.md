# v5 포털 인수인계

이 문서는 통합 후 `apps/portal`의 현재 연결 구조를 설명합니다. 통합V2의 과거 단독 실행 지침을 대체합니다. 원래 팀원 이름과 경로는 자료 출처 기록에만 남깁니다.

## 실행과 검증

저장소 루트에서 `Start-Web.cmd` 또는 `npm start`를 실행합니다. 공통 빌드는 루트 `npm run build`, 통합 검증은 루트 `npm test`입니다. 포털 자체 검사만 실행하려면 루트에서 `npm --prefix apps/portal test`를 사용합니다.

예전 `server.py`, `launch_preview.py`, macOS 전용 실행기, 포털 안의 별도 천구 구현은 제거했습니다. 포털 폴더에서 Python 서버를 따로 띄우지 않습니다. 서버 구성과 Python 설치는 루트 README를 따릅니다.

## 소스와 배포 URL

| 화면 | 현재 소스 | 화면 주소 |
|---|---|---|
| 홈·공통 메뉴 | `apps/portal` | `#home` |
| 천구 | `apps/planetarium`, 포털 `adapters/planetarium.js` | `#planetarium` |
| 관측 분석 | `apps/analysis` | `#analysis` |
| 소행성 3D·결과 | `apps/asteroids` | `#asteroids?tab=orbit` / `tab=research` |
| 기존 이동 천체 자료 | `apps/portal/moving` | `#asteroids?tab=observations` |
| 공통 검색 | `packages/search` | 상단 검색 |
| 튜토리얼 | `packages/tutorial` | 첫 진입·상단 재보기 |

포털은 배포 루트에, 독립 화면은 `analysis/`, `planetarium/`, `asteroids/`에 생성됩니다. 소스 폴더 상대 경로를 배포 URL로 사용하지 않습니다.

## 유지해야 할 동작

- 실제 자료 조회 실패를 대체 데이터로 감추지 않습니다.
- 좌표계·시점·관측자·시야 크기를 화면 간 전달에서 유지합니다.
- 별·별자리 일반 선택과 SPHEREx 분석 영역 선택을 구분합니다.
- 천구는 숨긴 동안 정지하지만 선택·카메라 상태를 보존합니다.
- 분석·소행성 iframe은 이탈 시 정리합니다. 탐험은 기록 저장 응답을 받은 뒤 이탈하고 영상 생성 중에는 기다립니다.
- 검색·튜토리얼을 열면 활성 화면의 렌더링·재생을 일시정지합니다.
- iframe 메시지는 실제 자식 창과 허용된 origin을 모두 검증합니다.
- 기존 `#moving` 링크는 이동 천체 관측 화면으로 연결합니다.

## 언어 파일

사이트의 기본 언어는 영어이고, 상단 바의 `EN | 한`이 전체를 한국어로 바꿉니다. 포털 쪽 파일은 셋입니다.

- `i18n.js`: 언어 엔진. `readStoredLang`, `t(key, vars)`(없는 키는 영어, 그다음 키 이름으로 대신), `applyI18n(root)`, `onLangChange(cb)`, `setLang`, `startI18n`을 내보냅니다. `setLang`은 `localStorage['spherex-lang']`에 쓰고, `<html lang>`을 바꾸고, `spherex-lang-change` 이벤트를 내보내고, 같은 출처의 하위 iframe 모두에 `{type:'spherex-lang', lang}`을 보냅니다. iframe이 불러와질 때마다 한 번 더 보냅니다. 탐험 화면(다른 출처)에는 보내지 않습니다.
- `i18n/en.js`, `i18n/ko.js`: 문구표. 두 파일의 키는 같아야 하고, 한국어 값은 통합 전의 한국어 문구 그대로입니다. 영어는 영국식 철자와 문장형 대소문자를 씁니다(`docs/spec-i18n.md`의 D3·D4는 이 저장소 밖 설계 문서이므로, 같은 규칙을 이 파일의 기존 문구에서 따라 하십시오).

문구를 더하는 법:

1. `en.js`와 `ko.js`에 같은 키를 넣습니다. 키가 하나라도 빠지면 `tests/i18n.test.js`가 실패합니다.
2. 고정된 HTML은 요소에 `data-i18n="키"`(글자), `data-i18n-html="키"`(태그가 든 문구), `data-i18n-attr="aria-label:키"`(속성)를 답니다. `index.html`의 첫 화면 글자는 영어 값과 같아야 하고, 이것도 시험이 확인합니다.
3. 스크립트가 만드는 글은 `t('키')`를 쓰고, 화면에 남는 글은 `onLangChange`로 다시 그립니다. 오류에는 `error.i18nKey`를 달아 화면에서 번역합니다.
4. 영어 화면에 한글이 남으면 안 됩니다. 한국어 고유 이름만 그 요소에 `lang="ko"`를 붙여 둡니다.

하위 앱과 패키지는 각자 문구 파일을 갖고 같은 키 `spherex-lang`를 따릅니다(분석 앱 `src/lib/i18n.ts`의 `L(ko, en)`, 소행성 앱 `src/i18n.ts`, 플라네타리움 `src/i18n.js`, 튜토리얼 `packages/tutorial/i18n.js`, 검색 `packages/search/src/i18n.ts`). 계약의 전체는 `docs/architecture.md`의 "언어 계약"에 있습니다.

## 천구 관찰과 보조 줄

상단 메뉴의 `Sky View`(`천구 관찰`)는 `#analysis?view=sky`로 가서 분석 앱의 탐색(Find) 화면을 엽니다. 플라네타리움(`#planetarium`)은 같은 항목의 두 번째 보기라서 두 화면 모두에서 이 항목이 강조됩니다(`routing.js`의 `headerCurrent`). 홈의 `플라네타리움` 카드와 그 주소는 그대로입니다.

- 분석 앱이 이미 떠 있으면 상단 항목을 눌러도 iframe을 새로 만들지 않습니다. 포털이 `{type:'spherex-analysis-stage', stage:'sky'|'workbench'}`를 보내고(`headerStage`), 분석 앱이 화면을 바꾼 뒤 `spherex-analysis-url`로 주소를 알려 오면 강조를 맞춥니다.
- 플라네타리움 보기에서만 보조 줄 `#sky-navigation`(`SPHEREx 천구` · `플라네타리움`)이 보입니다. `SPHEREx 천구`는 플라네타리움의 `getState().center`(`{ra, dec, fov}`, 도)를 읽어 `#analysis?view=sky&sky=<ra>,<dec>,<fov>`로 갑니다(`skyReturnHash`). 값을 못 읽으면 `sky` 없이 갑니다. 이 줄이 보이는 동안 플라네타리움 영역의 높이를 `calc(100svh - 118px)`로 줄입니다.
- 분석 앱 쪽에서 플라네타리움으로 가는 길은 `spherex-navigate`(`view:'planetarium'`, `params`)입니다.

## 홈 자산

홈의 블랙홀 배경, 글라스 카드, 미션 이야기, 전천 비교와 출처 설명을 보존했습니다. 망원경 모형 소스는 `home-src/mission-model.js`, 배포 번들은 `assets/model/mission-model.js`입니다. 루트 설치 후 이 폴더에서 `node scripts/build-home-model.mjs`로 재생성할 수 있습니다. 스크립트는 이웃 `apps/analysis`의 Vite와 포털의 vendored Three.js를 사용합니다.

상단 바, 파비콘, 홈 푸터는 `apps/portal/assets/brand/`의 팀 로고를 씁니다(파일 설명은 그 폴더의 `README.md`).

3D 모형 자산: `assets/model/`에는 Hero(`spherex-hero.glb`)와 Lite(`spherex-lite.glb`), 키트의 `manifest.json`(revision `panel-clearance-2`)이 키트 원본 그대로 들어 있습니다. 화면 폭 700px 이하(`matchMedia('(max-width:700px)')`)에서는 Lite, 그 밖에는 Hero를 불러오며, `mountMissionModel`의 `quality` 옵션이 픽셀 비율 상한(Hero 1.75, Lite 1.25)을 정합니다. 모형을 바꾸면 `node scripts/build-home-model.mjs`로 번들을 다시 만들고, `tests/model-assets.test.js`가 두 GLB의 sha256을 `manifest.json`과 대조합니다. 포스터 `spherex-hero-poster.webp`는 키트의 `preview/spherex-hero.png`와 같은 형상(태양전지판 위치 동일)이라 그대로 둡니다.

`docs/verification.md`는 통합 전 V1의 역사적 검증 기록입니다. 그곳의 테스트 수·옛 경로·서버 명령을 현재 상태로 인용하지 않습니다. 원본 자료의 라이선스·측정 방법·기여자 표시는 삭제하지 않습니다.
