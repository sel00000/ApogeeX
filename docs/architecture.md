# v5.0.0 통합 구조

## 원본과 기능 경계

| 원본 | 현재 소유 경로 |
|---|---|
| 추가/한결/통합V2 홈·메뉴 | apps/portal |
| 통합V2/analysis | apps/analysis + services/observations |
| 통합V2/planetarium-original | apps/planetarium |
| 추가/한결/소행성3D | apps/asteroids |
| 추가/지호/spherex-asteroid-analysis | services/asteroids |
| trueblink-live의 검색 핵심과 인덱스 | packages/search |
| 기존 tutorial | packages/tutorial |

기존 정밀 천구 엔진·좌표 선택·웹 분석 bridge와 회귀 보호는 필요한 기능 단위로 이관했습니다. 독립 trueblink/skylab-spherex 앱은 빌드나 실행 의존성에 포함하지 않습니다.

## 브라우저와 서버

포털의 해시 라우트는 `home`, `planetarium`, `analysis`, `asteroids`입니다. 소스 폴더와 공개 URL은 별개입니다. 빌드본은 포털이 루트, 하위 앱은 `/planetarium/`, `/analysis/`, `/asteroids/`에서 실행됩니다. 검색과 튜토리얼은 `/search/`, `/tutorial/`입니다.

포털은 화면 수명주기를 소유합니다. 천구 프레임은 선택 상태를 유지하면서 비활성 렌더링을 멈추고, 다른 화면은 해제합니다. 분석 프레임 메시지는 출처와 자식 창을 검증합니다.

`scripts/serve.mjs`가 정적 웹, 관측 Python 서비스, 소행성 작업 API를 시작·정리합니다. 관측 서비스 포트는 OS가 배정하고 포털 gateway가 중계합니다.

### 천구 관찰 경로와 메시지

상단 메뉴의 `천구 관찰`(영어 `Sky View`)은 `#analysis?view=sky`로 갑니다. 분석 앱의 탐색(Find) 화면이 열리고, 플라네타리움(`#planetarium`)은 같은 항목의 두 번째 보기입니다. 상단 항목 강조는 `routing.js`의 `headerCurrent`가 정합니다. 보기가 `planetarium`이거나 `analysis`이면서 `view=sky`가 있으면 `천구 관찰`, 그 밖의 `analysis`는 `SPHEREx 분석`입니다. 홈 카드 `플라네타리움`의 주소 `#planetarium`은 그대로입니다.

| 이름 | 방향 | 내용 |
|---|---|---|
| `#analysis?view=sky` | 주소 | 분석 앱을 탐색 화면으로 엽니다. 이 값이 없으면 작업대(workbench) 화면입니다. |
| `sky=<ra>,<dec>,<fov>` | 분석 앱 주소 | 탐색 화면의 천구 중심과 시야(도, ICRS). 잘못된 값은 무시하고, RA는 0~360으로 감으며 시야는 1.5~100도로 자릅니다. 천구가 움직인 뒤 약 0.4초 만에 주소에 적고 `spherex-analysis-url`로 포털에 알립니다. 탐색 화면을 떠나면 지웁니다. 좌표 검색용 `ra`·`dec`·`fov`와 별개입니다. |
| `spherex-analysis-stage` | 포털 → 분석 앱 | `{type:'spherex-analysis-stage', stage:'sky'\|'workbench'}`. 분석 앱이 이미 떠 있을 때 iframe을 새로 만들지 않고 화면만 바꿉니다. 분석 앱은 처리한 뒤 주소를 `spherex-analysis-url`로 알립니다. |
| `spherex-analysis-url` | 분석 앱 → 포털 | `{type:'spherex-analysis-url', query}`. 포털은 이 값으로 상단 강조를 다시 맞춥니다. |
| `spherex-navigate` | 분석 앱 → 포털 | 탐색 화면의 보기 스위치가 플라네타리움으로 갈 때 `{view:'planetarium', params:{ra, dec, fov, frame:'equatorial'}}`를 보냅니다. `fov`는 5~120도로 자릅니다. |
| 플라네타리움 `getState().center` | 포털이 읽음 | `{ra, dec, fov}`(도, ICRS). 포털의 `skyReturnHash`가 이 값으로 `#analysis?view=sky&sky=<ra>,<dec>,<fov>`를 만듭니다. 값이 없으면 옛 `query`·최상위 필드를 읽고, 그것도 없으면 `sky` 없이 `#analysis?view=sky`로 갑니다. |

플라네타리움 보기에서만 보이는 보조 줄 `#sky-navigation`에 `SPHEREx 천구`와 `플라네타리움` 두 항목이 있습니다.

### 언어 계약

사이트의 언어는 기본이 영어이고, 모든 화면이 같은 약속을 지킵니다. 설계는 `docs/spec-i18n.md`의 D1입니다.

| 항목 | 내용 |
|---|---|
| 키 | `localStorage['spherex-lang']`, 값은 `en` 또는 `ko`. 읽을 때 `ko`만 한국어이고 없음·다른 값·저장소 오류는 영어입니다. |
| 쓰는 곳 | 포털의 `EN \| 한` 스위치와 튜토리얼 대화상자 머리줄의 같은 스위치. 단독 실행한 분석 앱(포털 밖)은 자기 스위치로 같은 키를 씁니다. |
| `storage` 이벤트 | 하위 앱이 `key === 'spherex-lang'`일 때 새 값으로 바꿉니다. |
| 부모 메시지 | 포털이 하위 iframe에 `{type:'spherex-lang', lang}`을 `location.origin`으로 보냅니다. 받는 쪽은 같은 출처이고 `event.source === window.parent`일 때만 따릅니다. 저장소를 쓰지 못하는 브라우저에서도 이 길로 바뀝니다. 하위 iframe이 불러와질 때도 한 번 보냅니다. 다른 출처인 탐험 화면에는 가지 않습니다. |
| DOM 이벤트 | 포털 문서 안에서 도는 튜토리얼과 검색은 `window`의 `spherex-lang-change`(`detail.lang`)로 주고받습니다. `storage` 이벤트가 같은 문서에서는 나지 않기 때문입니다. |
| 시작과 주소 | 하위 앱은 시작할 때 키를 읽습니다. 포털 안(`embed=1`)에서는 주소의 `lang`을 보지 않습니다. 포털은 처음 불러올 때 경로의 `lang=ko\|en`을 한 번 적용·저장하고 경로에서 지웁니다. 단독 분석 앱은 `lang=ko`를 주소에 쓰고 읽으며 영어는 주소에 쓰지 않습니다. |
| 바뀔 때 | `<html lang>`과 `document.title`이 바뀌고 새로고침이 없으며 고른 대상·시각·탭이 남습니다. |

문구 파일은 포털이 `apps/portal/i18n.js`와 `i18n/en.js`·`i18n/ko.js`, 분석 앱이 `src/lib/i18n.ts`의 `L(ko, en)`, 소행성 앱이 `src/i18n.ts`, 플라네타리움이 `src/i18n.js`, 튜토리얼이 `packages/tutorial/i18n.js`, 검색이 `packages/search/src/i18n.ts`입니다.

## API

| 경로 | 역할 |
|---|---|
| /config.json | 실행 환경과 탐험 URL |
| /api/health | 통합 서버 상태 |
| /api/resolve | 천체 이름·카탈로그 좌표 조회 |
| /api/patch | 관측 영역 작업 생성/조회 |
| /api/observations/data/patches/... | 생성된 관측 자료 |
| /api/asteroid-analysis/capabilities | Python 분석 가능 여부 |
| /api/asteroid-analysis/jobs | 소행성 작업 생성 |
| /api/asteroid-analysis/jobs/:id | 진행/취소/완성 결과 |
| 탐험 origin의 /api/live/* | 원사이트 허용 endpoint 중계 |

관측 요청과 소행성 작업 요청은 로컬 동일 출처에 한정합니다. 서버 코드·원본 Python 결과 디렉터리는 정적 웹 루트가 아닙니다. API에서 허용된 결과만 제공합니다.

## 설정

| 항목 | 위치 | 설명 |
|---|---|---|
| `apiBase` | `deployment/public.json`, 환경 변수 `SPHEREX_API_BASE` | 공개 Python 서버의 HTTPS 주소. 기본은 빈 값입니다. |
| `askUrl` | `deployment/public.json`, 환경 변수 `SPHEREX_ASK_URL` | 검색이 언어 모형 도우미에게 검색 계획을 물을 `/api/ask` 주소. 이 저장소의 `deployment/public.json`에는 TrueBlink의 함수 `https://trueblink.pages.dev/api/ask`가 설정되어 있어 도우미가 켜져 있고, 값이 비어 있으면 도우미를 쓰지 않으며 요청도 보내지 않습니다. 이 함수는 `https://jp-feynman.github.io`, `https://sel00000.github.io`와 로컬 `http://127.0.0.1`·`http://localhost` origin의 요청을 2026-11-15부터 받습니다. 모형을 거친 결과에는 "AI 해석 후보" 표시가 붙고, 도우미 호출이 실패해도 방문자에게는 보통의 "찾지 못함" 답만 보입니다. 포털은 검색을 처음 열 때 `config.json`을 한 번 읽어 값이 있으면 `mountSearch(…, {askUrl})`로 넘깁니다. 도우미 서버 함수는 이 저장소에 없습니다. |

`public.json`의 값은 `scripts/public-config.mjs`가 읽고(환경 변수가 우선) `/config.json`으로 제공합니다. 로컬 서버(`scripts/serve.mjs`)의 `/config.json`도 같은 `askUrl`을 줍니다.

## 자료 계약

카탈로그 식별자, 표시 이름, 분석 실행 ID를 구분합니다. 좌표에는 단위·frame·epoch를, 시간에는 UTC/TDB와 관측자를 명시합니다. 고정 ICRS 영역과 이동 천체의 겉보기 방향을 혼동하지 않습니다. 각도는 기본 도 단위이며 영역 선택기의 arcsec는 전달 경계에서 한 번 변환합니다.

소행성 원본 결과는 `data/prepared/asteroids`, 새 작업은 `var/jobs/asteroids/<UUID>`입니다. 원본 분석 결과에서 웹 결과와 3D 자료를 각각 생성합니다. 3D 자료가 실패하더라도 완성된 분석 결과를 실패로 바꾸지 않습니다. 완료 manifest를 마지막에 공개합니다.

물성값은 값·단위·불확실성·방법·출처·보류 사유를 보존합니다. thermal/statistical/combined/catalogue 지름은 서로 다른 결과입니다. 처리 완료와 과학적 신뢰도는 독립 상태이며, 절차적 3D 암석은 실제 표면 복원이 아닙니다.

## 과학 품질과 오류 처리

스펙트럼에는 품질 불량 측광과 유효한 오차가 없는 판정을 구분합니다. 차영상은 탐색용이며 파장·PSF 등의 차이를 검출 확정으로 표시하지 않습니다. 다운로드 실패는 자료 없음과 분리하고 실패 캐시를 정상 결과로 영구 재사용하지 않습니다.

천구 엔진 JS/WASM와 대응 소스·카탈로그를 같은 보정 버전으로 관리합니다. 실제 별 좌표 및 투영·터치 회귀 검증을 유지합니다. Python에서는 Horizons 반환 시각 대조, RA 경계 처리, 결과 원자적 공개와 DB 일관성 보호를 유지합니다.

## 배포와 출처

웹 빌드는 완성된 staging 출력으로 교체하며, 빌드 실패 시 직전 dist를 유지합니다. 자료 생성은 일반 프런트 빌드와 구분합니다. 네트워크 API를 사용하는 기능은 오프라인 동작을 보장하지 않습니다.

원본과 변경 출처는 sources.json과 모듈별 NOTICE에 기록합니다.
