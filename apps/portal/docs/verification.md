# 통합 V1 검증 기록

> 보존된 **통합 전 V1 기록**입니다. 아래 테스트 수·브라우저 결과·사람 이름 경로·별도 서버 명령은 원본 작업 당시의 설명이며 v5의 실행 지침이나 재검증 결과가 아닙니다. 현재 실행은 저장소 루트 `Start-Web.cmd` 또는 `npm start`, 검증은 루트 README와 `npm test`를 따릅니다. 당시의 자체 서버와 별도 천구 구현은 v5 포털에서 제거했습니다.

검증일: 2026-11-15 KST. 실제 로컬 Chrome, 통합 서버8781, 원래 분석 API8000을 사용했습니다. 자동 검사 통과가 모든 천체의 과학적 검증이나 모든 기기의 FPS 보장을 뜻하지 않습니다.

## 실행 가능한 검사

- `npm test`: Node12개(천구 좌표/카탈로그7개, 실제 PN/EOB를 사용하는 홈 생명주기5개), Python HTTP 라우팅5개 통과.
- `npm --prefix analysis test -- --run`: 15파일,122테스트 통과.
- `npm run build:analysis`: TypeScript + Vite 프로덕션 빌드 성공. 진입 JS326.45kB(raw)/109.23kB(gzip). 3D/천구/연구 도구는 별도 chunk.
- Python `moving/validate_data.py`: Vesta3장·3I/ATLAS4장의 원본 SHA256, FITS MJD-AVG, 동일 TAN 격자, 북쪽 위/동쪽 왼쪽, 예측점 격자 변환, 원본 WCS-WAVE 파장, PNG 크기 검사 통과. 원래 소행성 분광자료4종의 출처와 점 개수 일치.
- 분석 `public`853개 파일을 원래 `한결/통합/public`과 재비교: SHA256 불일치0개.
- 첨부 TIFF와 원본 PNG: RGB 전체 픽셀 정확히 일치, 최대 차이0. 기록: `sky-integrity.json`.
- `launch_preview.py --no-open`: 기존 서버 재사용, `/health` 정상. 다른 프로세스를 종료하거나 중복 API를 띄우지 않음.

## 실제 브라우저 흐름

일반 desktop viewport와390×844px 모바일에서 확인했습니다.

- 홈: 세 탐색 링크, 일시정지/다시 켜기 레이블, 준비 중 튜토리얼 모달, 반응형 한 열 카드, 원본 지도 배경 표시.
- 천구: Hubble 말머리성운 상세·좌표·근사 거리, Webb 카리나 검색·사진·크레딧, 상세 닫기, 확대, 천체 목록·검색 포커스, 원래 분석 대상으로의 이동.
- 천구에서 바너드별 → SPHEREx 관측: 원래17회 관측, 영상, A/B/Blink 도구, 3D 모형 표시. 연구 탭의 실제 위치 그래프와 분광 실험실 표시 확인.
- 분석: embedded 중복 제목 제거, 모바일 너비390px/내용 너비390px. 준비된 대상 자료를 실제로 표시함.
- 이동 천체: Vesta 다음 관측 클릭 시 실제 PNG와 UTC가 2025-08-04 11:05:01 → 2025-08-05 00:07:59로 변경. 실제 협대역 파장도4.647 →4.677µm로 변경.
- 이동 천체→분석: RA/Dec, 이름, moving=1, 예측 MJD와 노출 중간 MJD가 URL에 함께 전달됨. 이 연결은 고정 좌표 보관 자료 조회이며 궤도 추적 기능이 아님.
- 모바일 홈·천구·분석·이동 천체 문서 수평 넘침 없음.
- 확인 범위에서 console error0개. 기존 Three.js의 Clock deprecation 경고2건은 원래3D 라이브러리 코드에서 발생했으며 동작 오류는 아님.
- 모바일에서 천체 목록 버튼에 pointer-events:none이 상속되어 하늘을 선택하던 문제를 실제 클릭으로 재현하고 수정함. 수정 후 목록 열기→검색→카리나 선택→상세 닫기→확대까지 재확인함.

홈 숨김/복귀 때0×0 크기와 시뮬레이션 좌표가 섞이는 회귀를 고쳤고 실제 PN/EOB 기반 테스트로 위치 보존을 확인했습니다. 끌기와 화면 이탈은 타이머·포인터 capture를 정리합니다.

## 성능 측정 범위

`home-perf.json`은 이 컴퓨터의 Chrome DevTools Performance metrics로 홈을 약67.37초 동안 관찰한 기록입니다.

| 항목 | 측정 |
|---|---:|
| JavaScript 실행 시간 |0.300초, 경과 시간의0.445%|
| 메인 스레드 TaskDuration |1.777초, 경과 시간의2.638%|
| LayoutDuration 증가 |0초|

다른 페이지를 열지 않은 유휴 홈의 한 표본입니다. GPU 작업, 실제 화면 FPS, 배터리 소모, 다양한 기기에서의 성능을 측정한 값은 아닙니다. 고밀도 원본 PNG의 최초 디코딩 시간도 이 유휴 구간의 별도 측정이 아닙니다.

구조적 제한: 홈 국소 렌즈 최대24회/초·DPR상한2, 정적 배경 이미지; 천구 정지 시 영구 RAF 없음·600만 픽셀 예산; 이동 천체 재생 시 PNG 교체만; 화면 이탈 시 각 모듈 disposer/분석 iframe 제거; 보이지 않는 홈 중지.

## Figma

파일: https://www.figma.com/design/0wZapKMPpfWVxMePbUIZPs?node-id=2-37

Desktop1440×1660과Mobile390×2280의 홈 화면, 카드 원본 컴포넌트, 색상 변수, 텍스트 스타일, 편집 안내를 만들었습니다. UI는 native TEXT·FRAME·INSTANCE·VECTOR이며 전천 배경만 raster입니다. 초기 API inventory: Desktop TEXT35/INSTANCE3/VECTOR3, Mobile TEXT32/INSTANCE3/VECTOR3; 이후 각 프레임에 과학 설명용 native 텍스트1개씩을 추가했습니다. SF Pro가 이 Figma 렌더러에서0폭으로 표시되는 문제를 실제 screenshot으로 확인해 Noto Sans KR로 대체했고 최종 desktop/mobile screenshot에서 글자가 표시되는 것을 확인했습니다. 웹은 Apple 시스템 서체를 사용합니다.

`figma-home-desktop.png`, `figma-home-mobile.png`는 Figma 도구에서 받은 실제 렌더이며, `home-*.jpg`, `planetarium-*.jpg`, `analysis-*.jpg`, `moving-*.jpg`는 실제 Chrome 화면입니다. Figma는 편집 가능한 시각 디자인이며 사이트의 모든 동작을 Figma 프로토타입에 구현한 것은 아닙니다.

## 최종 통합 회귀 보완

- API 작업 실패 상태가 반복 polling에 의해 다시 queued가 되던 오류를 수정했습니다. failed는 terminal이며 사용자의 retry=1만 재등록합니다. queued/running 작업은 중복하지 않습니다.
- PyVO 공식 TAPService(session=...)를 사용해 연결10초·read180초 제한을 적용했습니다. 전체 합성 시간 제한은 아닙니다. Python 작업3개·실제 지연 HTTP fixture의 TAP timeout1개 검사를 별도로 통과했습니다. 수정된 로컬 API를 재시작해 적용했습니다.
- 분석 대상 변경→부모 hash 갱신, 링크 복사→같은 통합 주소, 새로고침→RW Aurigae 복원을 실제 Chrome으로 확인했습니다.
- 공통 헤더 아래에 천구를 맞추었습니다. 실제 DOM 측정에서 desktop sky bottom1148/viewport1148, mobile sky bottom842.59/viewport844, 도구 bottom784.59로 조작 버튼이 화면 안에 있습니다.

사용자의 최종 범위 지시에 따라 데스크톱을 납품 대상으로 마무리했습니다. 이전 모바일 탐색·검증 기록은 보존하며 모바일을 별도 제품으로 개발하지 않습니다.

## Full-bleed / Liquid Glass 데스크톱 수정

- 홈을 비율을 유지한 cover×1.6로 채우고 국소 렌즈의 UV도 동일하게 중앙 정렬했습니다. 세 카드는 오른쪽 세로 열, 440×214px로 배치했습니다.
- Chrome에서 세 카드의 `data-glass-refraction=on`, 실제 `url(#...feDisplacementMap) blur(.55px)` computed filter를 확인했습니다. 유리 맵·할당 경계·이벤트 수명주기3개를 추가해 Node15개 + 서버 라우팅5개 검사가 통과했습니다.
- 기존 Figma 파일의 보기 권한/MCP 제한을 만나 사용자 소유 초안으로 복제하고, Chrome의 정상 편집 UI로 Figma native Glass 효과를 적용했습니다. 광원75%, 굴절70, 깊이24, 분산6, frost4. 데스크톱 카드3개에 각각 적용했고 배경을 중앙 확대 크롭했습니다. 모바일 프레임은 최신 초안에서 정리했습니다.
- 편집 가능한 최신 Figma: https://www.figma.com/design/qfMk705uYxT5V0fmrD3sN9?node-id=2-37
- `figma-liquid-glass-desktop.png`는 Figma의 실제 PNG export이며 전체 UI를 raster로 가져와 만든 파일이 아닙니다. 기존 67초 성능 기록은 이전 수평 카드 버전의 측정입니다. 최신 유리 화면의 별도 기록은 `liquid-glass-perf.json`에 있습니다.

수정본 최종 Chrome 확인: viewport2050×1148에서 hero1148px, 수평 넘침0px, 카드3개 모두 굴절 활성(on), 카드 높이214px. 브라우저 console error0개. `home-liquid-glass.jpg`가 최신 실제 웹 화면입니다. 66.29초 측정의 ScriptDuration1.95초(2.94%), TaskDuration7.68초(11.59%)는 이 컴퓨터의 단일 관찰 구간이며 초기 이미지 준비가 포함될 수 있습니다. 이 수치를 GPU/FPS나 이전 버전과의 공정한 속도 비교로 해석하지 않습니다.
