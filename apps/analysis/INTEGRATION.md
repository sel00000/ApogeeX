# 통합V1 분석 작업실

이 폴더는 기존 `한결/통합`의 실제 SPHEREx 분석 기능과 자료를 독립 복사한 작업실입니다. 원래 앱은 수정하지 않았습니다.

## 실행 및 경로

- 통합 서버는 `/analysis/`를 이 폴더의 `dist/`로 연결합니다.
- 상위 셸에서 `/analysis/?embed=1&target=barnard`처럼 iframe으로 로드합니다.
- 자료는 Vite의 상대 base(`./`) 아래 `data/`에서 읽습니다. 다섯 준비된 대상의 실제 관측은 오프라인 파일로 포함됩니다.
- 임의 좌표는 `/api/patch` API가 필요합니다. 로컬 통합 서버는 관측 Python 서비스와 결과 파일을 같은 원점에서 제공합니다. 공개 웹은 아래 설정으로 별도 HTTPS 서버에 연결할 수 있습니다.
- 개발: `npm ci`, `npm run dev`. 배포: `npm run build`.
- 로컬 검증에서는 기존 통합의 설치된 의존성을 `node_modules` 심볼릭 링크로 재사용했습니다. 링크는 Git에서 제외됩니다.

## 공개 웹의 분석 서버 연결

셸 루트의 `config.json`을 `../config.json`으로 읽습니다. `apiBase`는 `https://analysis.example` 또는 `https://analysis.example/service`처럼 **서버 origin과 선택적인 배포 경로**를 지정합니다. `/backend` 같은 경로는 현재 웹 origin에 붙인 절대 URL로 정규화합니다. `/api`를 붙이지 않습니다. 비어 있지 않은 빌드 설정 `VITE_API_BASE`가 런타임 설정보다 우선합니다. HTTPS가 필수이며 로컬 개발의 `localhost`, `127.0.0.1`, `[::1]`만 HTTP를 허용합니다.

```json
{"apiBase":"https://analysis.example/service","localServices":false}
```

외부 주소가 있으면 정적 호스팅의 `localServices:false`여도 API를 사용합니다. API와 전체 웹을 같은 공개 서버에 올린 경우 `apiBase:""`, `publicMode:true`를 사용합니다. 설정은 5초 동안 캐시하며, 사용자가 다시 시도하면 만료된 설정을 재확인합니다. 설정을 읽지 못해도 준비된 대상의 정적 자료는 계속 사용할 수 있습니다.

공개 API는 `GET /api/session`에서 `{publicMode:true,sessionToken,expiresAt}`를 반환합니다. `expiresAt`은 ISO 8601 시각입니다. 세션은 API 주소별로 메모리와 `sessionStorage`에 저장하고, API 요청에 `X-Spherex-Session` 헤더로 전달합니다. 동시 요청은 같은 발급 작업을 기다립니다. 세션 만료 응답 후 POST를 자동 반복하지 않으며 다음 사용자 재시도에서 세션을 갱신합니다. 기본 로컬 서버는 세션 없이 기존 방식으로 요청합니다. 명시적인 localhost 주소의 옛 서버에서만 세션 경로 404를 허용합니다.

서버는 허용된 웹 origin에 대해 CORS와 `GET`, `POST`, `DELETE`, `OPTIONS`, `Content-Type`, `X-Spherex-Session`을 지원해야 합니다. 호출에는 쿠키를 포함하지 않습니다. 관측 metadata와 PNG·f32 결과 파일은 세션 헤더가 없는 공개 GET으로 제공합니다. metadata의 절대 URL은 설정된 API origin·배포 경로와 정확한 patch 경로에 속해야 합니다. 반환된 상대 API 경로에는 배포 prefix를 붙입니다. 프레임은 해당 결과 폴더 안으로 제한하며 PNG는 anonymous CORS로 받아 canvas에서 읽습니다. 준비된 대상의 `data/` 파일과 브라우저에서 내보내는 CSV는 공개 API 설정의 영향을 받지 않습니다.

## 셸과의 메시지

모든 메시지는 `location.origin`으로만 전달합니다. 수신 시에는 원점과 `event.source === window.parent`를 검사합니다.

상위 → 분석:

```js
{ type: 'spherex-select-target', target: 'barnard', tab: 'motion' }
{ type: 'spherex-select-target', ra: 83.82208, dec: -5.39111, label: '오리온 성운', tab: 'spectrum' }
{ type: 'spherex-analysis-pause' }
```

대상 ID가 주어지면 준비된 실제 관측 대상에 우선 연결하고, 좌표만 주어지면 API로 실제 관측을 조회합니다. 임의 위치의 예상·측정값을 생성하지 않습니다. 좌표 영역에는 기존 앱의 범위대로 시계열 영상과 관측 표가 있으며, 알려진 대상용 3D 고유운동 모델은 임의로 만들지 않습니다.

분석 → 상위:

```js
{ type: 'spherex-analysis-ready' }
{ type: 'spherex-analysis-loaded', target, label, observations }
{ type: 'spherex-navigate', view: 'planetarium' }
```

쿼리 `ra`, `dec`, `fov`, `label`, `target`, `mode`, `tab`, `lang`, `visit`도 지원합니다. iframe을 숨길 때 상위 셸은 pause 메시지를 보내거나 제거해야 합니다. 기존 3D 캔버스는 `frameloop="demand"`를 유지합니다.

## 바뀐 표현

- 외부 폰트 요청 제거, SF Pro / Apple SD Gothic Neo 우선의 시스템 폰트 스택.
- 공통 차콜 표면과 낮은 채도의 앰버 탐색 강조. 검출기·측정·카탈로그·모델의 과학적 색 의미는 보존.
- 대상 선택, 영상·3D 비교, 시간축, 분석 도구를 순서대로 읽는 계층. 3D·분광·변광 등 기능 제거 없음.
- 임무/탐험과 연구 모드를 유지하고 상세 설정은 기존 접기 구조 유지.
- 3D, 실시간 천구, 연구 도구를 별도 지연 로딩 청크로 분리. 홈에서는 분석 번들을 로드하지 않도록 상위 셸에서 화면 진입 때 iframe을 생성해야 함.

## 검증

- 외부 API 연결 회귀 검사: `npm test`. 독립 Chrome에서 실제 두 localhost origin의 세션·CORS preflight·metadata·PNG canvas·f32를 확인하려면 `node e2e/remote-api.browser.mjs`를 실행합니다. 이 검사는 로컬 fixture만 사용하고 외부 DNS를 차단하며 임시 서버와 브라우저를 종료합니다. 다른 Chrome 경로는 `CHROME_PATH`로 지정합니다.
- TypeScript + Vite production build 성공.
- 단위 검사 113개 통과(기존 110개 + 메시지 payload 경계 3개).
- 기존 실제 관측 public 파일을 원본과 SHA256 비교해 동일성 확인(`data-integrity.json`).
- 라이브러리/기능의 기존 근거와 고지는 `THIRD_PARTY_NOTICES.md`, `README.md`, `HANDOFF.md`에 유지.
- 실제 Chrome 화면·통합 경로는 상위 통합 서버에서 검증해야 하며 빌드 성공만으로 브라우저 검증을 주장하지 않음.
