# SPHEREx portal · v5.0.0

통합V2의 홈 화면과 시각 자산을 보존한 공통 포털입니다. 실행·설치·배포는 저장소 루트의 README와 명령을 사용합니다. 이 폴더만 따로 서버에 올리는 방식은 지원하지 않습니다.

## 화면

- `#home`: 홈, 미션 소개, 망원경 모형, 파장 이야기, 가시광·적외선 비교
- `#planetarium`: 플라네타리움(상단 `천구 관찰`의 두 번째 보기, 첫 보기는 `#analysis?view=sky`). 숨긴 동안 엔진을 중지하고 카메라·선택 상태는 보존
- `#analysis`: SPHEREx 관측 분석
- `#asteroids?tab=orbit`: 소행성 3D
- `#asteroids?tab=research`: 소행성 분석 결과와 새 분석
- `#asteroids?tab=observations`: 통합V2의 기존 이동 천체 관측·분광 자료

기존 `#moving` 링크는 소행성 관측 자료로 연결됩니다. 메뉴의 천체 검색은 `packages/search`, 튜토리얼은 `packages/tutorial`을 사용합니다.

## 배포 경계

루트 빌드가 이 폴더의 공통 화면과 필요한 자산만 배포합니다. 각 하위 앱의 배포 위치는 `analysis/`, `planetarium/`, `asteroids/`입니다. 소스의 상대 경로와 배포 URL을 혼동하지 않도록 `routing.js`와 `adapters/`에서 연결합니다.

## 튜토리얼·화면 연결

`window.__spherexApp`은 `navigate(view,params)`, `analyze(selection)`, `whenReady()`, `setTutorialActive(boolean)`, `getFeatureDocument()`, `getFeatureWindow()`, `getTutorialTarget(key)`를 제공합니다. 화면 준비 후 `spherex-route-ready` 이벤트가 발생합니다.

대상의 좌표계·시점·관측자·분석 영역 크기를 URL에 보존합니다. 이동 천체의 겉보기 좌표를 ICRS 고정 좌표로 바꿔 붙이지 않습니다. 천구의 영역 선택으로 생성한 ICRS 위치를 분석 화면에 전달합니다.

## 검증

`npm test`는 홈 배경 계산, 이벤트 정리, 화면 경로·메시지 출처·탐험 저장/종료 동작을 검증합니다. 실제 브라우저에서의 GPU·외부 아카이브 연결 검증은 루트 검증 절차를 따릅니다.

## 출처

홈 UI와 미션 자산은 취합한 통합V2에서 가져왔습니다. `assets/`, `moving/`의 출처·라이선스·과학 모형 설명을 유지합니다. `docs/`, `design/`에는 통합 전 설계·검증 기록이 남아 있으며 현재 실행 지침과 구분해 표시했습니다. `home-src/`는 배포된 망원경 모형의 대응 소스입니다. 사용하지 않는 통합 전 서버·실행기·별도 천구 구현은 이 폴더에서 제거했습니다. 원본은 통합 전 소스 보관본을 참조합니다.
