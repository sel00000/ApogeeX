# AI use in the changes of 15 November 2026 (evening, KST)

Korean version: see the section "한국어" below. It has the same content.

## 1. What this file covers

This file covers only the changes made to this repository on the evening of 2026-11-15 (KST):

- Part A: the home page's SPHEREx 3D model gained the kit's Lite variant, used on narrow screens.
- Part B: the header item "Sky View" opens the Find stage of the analysis app. That stage draws constellation lines and names and has a ground view. The planetarium is its second view, and the view centre is handed over between the two.
- Part C: the asteroid Orbit 3D scene has a Milky Way background, textured planets and W A S D flight.
- Part D: English is the default language, and one header switch "EN | 한" turns the whole site Korean in place.
- The documents that describe these changes (README, `docs/architecture.md`, `apps/portal/HANDOFF.md`, `apps/analysis/THIRD_PARTY_NOTICES.md` and this file).

Other parts of the project keep their own notes. This file does not replace them:

- `packages/search/AI_USE.md` (the search package and the guide characters)
- `apps/portal/moving/AI_USE-TrueBlink.md` (the moving-object screens that came from TrueBlink)

## 2. Tool

The AI tool was Anthropic's Claude, used through the Claude Code command-line tool. Several AI agents worked in parallel, each on a separate module (portal, analysis app, asteroid app, planetarium, tutorial, search, constellation data, documents). Other AI agents then reviewed their work. The agents worked from designs written in Korean by a main AI session from the team's instructions (`spec.md` and `spec-i18n.md`, kept outside this repository).

## 3. What the AI did, under the team's direction

- Designed and implemented the merged sky view: the Find stage as the "Sky View" screen, the view switch to the planetarium, the hand-over of the view centre (`sky=ra,dec,fov` and the planetarium state field `center`), and the header highlight and in-place stage message.
- Built the constellation layer (lines and names) and ported the ground view and horizon code from the team's TrueBlink project into the analysis app.
- Built the Orbit 3D Milky Way background, the planet textures and the W A S D keyboard flight.
- Built the language layer: the shared key `spherex-lang`, the dictionaries, the switch, and the following of the choice by every app.
- Wrote the English texts as translations of the team's existing Korean texts. The Korean texts were not rewritten.
- Wrote the tests and ran the checks (unit tests, builds, a scan for Korean letters on English screens, and screenshots taken with a headless browser with software WebGL).
- Wrote the documents listed in section 1.

Limits of the checks, as the agents reported them: they used headless Chromium with software WebGL only. No real GPU, touch device or phone was used. The Playwright end-to-end suites of the analysis app were not run, because they need a development server and live archive services. The portal side of the stage message could not be tried against the analysis app until the trees were merged.

## 4. What is not AI-generated

- Every sky image and planet map is a real public data product, with its credit. The credits are recorded in `apps/asteroids/public/sky/SOURCES.json`:
  - Milky Way background: Gaia EDR3 all-sky map, ESA/Gaia/DPAC, acknowledgement A. Moitinho (CC BY-SA 3.0 IGO; resized and converted to JPEG, which is a modified version).
  - Earth: Blue Marble Next Generation, NASA Earth Observatory, Reto Stöckli.
  - Jupiter: Cassini global map PIA07782, NASA/JPL/Space Science Institute.
  - Mercury: NASA / MESSENGER Team / Arizona State University / USGS Astrogeology.
  - Venus: NASA/JPL Magellan, USGS Astrogeology Science Center.
  - Mars: NASA Ames / USGS Astrogeology Science Center, Viking Orbiter.
  - Saturn, Uranus, Neptune: NASA/ESA Hubble Space Telescope, Amy Simon and the OPAL team, STScI/MAST.
  - Unobserved areas of some maps are filled with the map's mean colour; this is not data. Saturn's ring is a schematic drawn from published radii, not a photograph. Planet sizes are illustrative.
- The constellation figures come from the Stellarium western sky culture (Stellarium's team; text and data CC BY-SA). The star positions come from Hipparcos-2 (van Leeuwen 2007, VizieR I/311). The Korean constellation names are a table (`apps/analysis/scripts/constellation-names-ko.json`) typed in by the AI design session from the standard Korean constellation names, without a cited source file; the team has not yet checked it. The file was built by a script from these sources; the AI did not draw or invent figures. Details and licences are in `apps/analysis/THIRD_PARTY_NOTICES.md`.
- The ground and the skyline under the sky map are drawn by code. They are not data.
- The ApogeeX logo in the portal (`apps/portal/assets/brand/`) was provided by the team as a picture. The files in that folder are derived from it by a script (`make-brand.py`: cropping, white made transparent, a favicon). This document does not say how the logo itself was made.
- No picture was generated by AI in this work. Pictures that were already in the project (for example the guide characters and the tutorial pictures) are outside this file. For the guide characters see `packages/search/AI_USE.md`, section 7. The origin of the tutorial pictures is recorded in `packages/tutorial/assets/provenance.json` as "user-provided attachment"; this file does not say how they were made.

## 5. AI at run time

- The search can ask Llama 3.1 8B on Cloudflare Workers AI for a search plan, only when `askUrl` is set in `deployment/public.json` (or in the environment variable `SPHEREX_ASK_URL`). In this repository the value is set to the TrueBlink function `https://trueblink.pages.dev/api/ask`, so the helper is on; with an empty value the helper is off and no request is made. Since 2026-11-15 (20:39 KST for the first, 21:33 KST for the second) the function accepts requests from this site's public origins (`https://jp-feynman.github.io` and `https://sel00000.github.io`) and from local `http://127.0.0.1` and `http://localhost` origins. The portal reads the value from `config.json` (built from `deployment/public.json` by `scripts/public-config.mjs`) and passes it to the search package.
- Results that came through the model are labelled "AI-interpreted candidate" ("AI 해석 후보" in the Korean interface), as described in `packages/search/AI_USE.md`, section 6.
- The model never supplies objects, positions or numbers. It returns a plan, and the search code checks the plan against its own closed lists before use. Names, coordinates and values come from the name index, the CDS and IMCCE services and the team's data.
- If the helper call fails, the visitor sees the ordinary "nothing found" answer and no warning.
- The hosted function that calls the model (`functions/api/ask.ts`) is part of the TrueBlink project, not of this repository.

## 6. Team to confirm

The team fills in these lines. The AI has not filled them in.

- Who directed and reviewed the work: ______________________________
- Who tested it in a browser, and on which devices: ______________________________
- Who deployed it: ______________________________
- The Korean constellation names (`apps/analysis/scripts/constellation-names-ko.json`) need a check by a team member: ______________________________

---

# 한국어

영어 부분과 같은 내용입니다.

## 1. 이 파일이 다루는 범위

이 파일은 2026-11-15 저녁(KST)에 이 저장소에 한 변경만 다룹니다.

- A: 홈의 SPHEREx 3D 모형에 키트의 Lite 변형을 더했습니다(좁은 화면용).
- B: 상단 메뉴 `천구 관찰`(Sky View)이 분석 앱의 탐색(Find) 화면을 엽니다. 이 화면은 별자리 선과 이름을 그리고 지면 보기를 갖습니다. 플라네타리움은 그 두 번째 보기이며, 둘 사이에 보던 하늘의 중심을 넘깁니다.
- C: 소행성 궤도 3D 장면에 은하수 배경, 행성 질감, W A S D 비행을 더했습니다.
- D: 기본 언어는 영어이고, 상단의 `EN | 한` 스위치 하나가 사이트 전체를 그 자리에서 한국어로 바꿉니다.
- 위 변경을 설명하는 문서(README, `docs/architecture.md`, `apps/portal/HANDOFF.md`, `apps/analysis/THIRD_PARTY_NOTICES.md`, 이 파일).

다른 부분은 각자의 기록을 따로 갖고 있으며, 이 파일이 그것을 대신하지 않습니다.

- `packages/search/AI_USE.md` (검색 패키지와 안내 캐릭터)
- `apps/portal/moving/AI_USE-TrueBlink.md` (TrueBlink에서 온 이동 천체 화면)

## 2. 도구

사용한 AI는 Anthropic의 Claude이며 Claude Code 명령줄 도구로 썼습니다. 여러 AI 에이전트가 모듈별로 나뉘어 동시에 일했습니다(포털, 분석 앱, 소행성 앱, 플라네타리움, 튜토리얼, 검색, 별자리 자료, 문서). 그 결과물은 다른 AI 에이전트가 검토했습니다. 에이전트는 팀의 지시를 받은 메인 AI 세션이 한국어로 쓴 설계(`spec.md`, `spec-i18n.md`, 이 저장소 밖에 둠)를 따라 작업했습니다.

## 3. 팀의 지시에 따라 AI가 한 일

- 합친 천구 보기를 설계하고 구현했습니다. 탐색 화면을 `천구 관찰`로 만든 것, 플라네타리움으로 가는 보기 스위치, 보던 하늘의 중심을 넘기는 방식(`sky=ra,dec,fov`와 플라네타리움 상태의 `center` 필드), 상단 강조와 화면 전환 메시지입니다.
- 별자리 층(선과 이름)을 만들고, 팀의 TrueBlink 프로젝트에 있던 지면 보기와 지평선 코드를 분석 앱에 옮겼습니다.
- 궤도 3D의 은하수 배경, 행성 질감, W A S D 키보드 비행을 만들었습니다.
- 언어 층을 만들었습니다. 공유 키 `spherex-lang`, 문구표, 스위치, 모든 앱이 선택을 따라가는 방식입니다.
- 영어 문구를 팀이 이미 쓴 한국어 문구의 번역으로 썼습니다. 한국어 문구는 고치지 않았습니다.
- 테스트를 쓰고 검사를 돌렸습니다(단위 시험, 빌드, 영어 화면의 한글 검사, 소프트웨어 WebGL 헤드리스 브라우저로 찍은 화면 캡처).
- 1절의 문서를 썼습니다.

검사의 한계는 에이전트가 보고한 대로입니다. 소프트웨어 WebGL의 헤드리스 Chromium만 썼고, 실제 GPU·터치 기기·휴대전화는 쓰지 않았습니다. 분석 앱의 Playwright 종단 시험은 개발 서버와 실제 아카이브 서비스가 필요해 돌리지 않았습니다. 화면 전환 메시지의 포털 쪽은 작업 폴더를 합치기 전에는 분석 앱과 맞춰 볼 수 없었습니다.

## 4. AI가 만들지 않은 것

- 하늘 영상과 행성 지도는 모두 공개된 실제 자료이며 출처가 있습니다. 출처는 `apps/asteroids/public/sky/SOURCES.json`에 기록돼 있습니다.
  - 은하수 배경: Gaia EDR3 전천 지도, ESA/Gaia/DPAC, 감사 표기 A. Moitinho (CC BY-SA 3.0 IGO. 크기를 줄이고 JPEG로 바꾼 변형본입니다).
  - 지구: Blue Marble Next Generation, NASA Earth Observatory, Reto Stöckli.
  - 목성: Cassini 전역 지도 PIA07782, NASA/JPL/Space Science Institute.
  - 수성: NASA / MESSENGER Team / Arizona State University / USGS Astrogeology.
  - 금성: NASA/JPL Magellan, USGS Astrogeology Science Center.
  - 화성: NASA Ames / USGS Astrogeology Science Center, Viking Orbiter.
  - 토성·천왕성·해왕성: NASA/ESA Hubble Space Telescope, Amy Simon과 OPAL 팀, STScI/MAST.
  - 일부 지도의 관측되지 않은 영역은 그 지도의 평균 색으로 채웠으며 이는 자료가 아닙니다. 토성 고리는 공개된 반지름으로 그린 개략도이고 사진이 아닙니다. 행성 크기는 설명용입니다.
- 별자리 선 그림은 Stellarium western sky culture(Stellarium's team, 글과 자료 CC BY-SA)에서, 별 위치는 Hipparcos-2(van Leeuwen 2007, VizieR I/311)에서 왔습니다. 한국어 별자리 이름은 표준 한국어 별자리 이름을 보고 AI 설계 세션이 입력한 표(`apps/analysis/scripts/constellation-names-ko.json`)이며, 인용한 출처 파일은 없고 팀은 아직 확인하지 않았습니다. 파일은 이 자료로 스크립트가 만들었고, AI가 선을 그리거나 지어내지 않았습니다. 상세와 라이선스는 `apps/analysis/THIRD_PARTY_NOTICES.md`에 있습니다.
- 천구 아래의 지면과 스카이라인은 코드로 그린 그림이며 자료가 아닙니다.
- 포털의 ApogeeX 로고(`apps/portal/assets/brand/`)는 팀이 그림 파일로 제공했습니다. 그 폴더의 파일들은 스크립트(`make-brand.py`: 잘라내기, 흰색을 투명하게, 파비콘)로 그 그림에서 만든 것입니다. 이 문서는 로고 자체를 어떻게 만들었는지는 말하지 않습니다.
- 이번 작업에서 AI가 만든 그림은 없습니다. 이전부터 프로젝트에 있던 그림(안내 캐릭터, 튜토리얼 그림 등)은 이 파일의 범위 밖입니다. 안내 캐릭터는 `packages/search/AI_USE.md` 7절을 보십시오. 튜토리얼 그림의 출처는 `packages/tutorial/assets/provenance.json`에 "user-provided attachment"로 적혀 있으며, 이 파일은 그 그림을 어떻게 만들었는지는 말하지 않습니다.

## 5. 실행 중의 AI

- 검색은 `deployment/public.json`(또는 환경 변수 `SPHEREX_ASK_URL`)에 `askUrl`이 설정된 경우에만 Cloudflare Workers AI의 Llama 3.1 8B에게 검색 계획을 물을 수 있습니다. 이 저장소에서는 값이 TrueBlink의 함수 `https://trueblink.pages.dev/api/ask`로 설정되어 있어 도우미가 켜져 있고, 값이 비어 있으면 도우미는 꺼지며 요청도 보내지 않습니다. 이 함수는 2026-11-15부터(첫째 주소는 20:39 KST, 둘째 주소는 21:33 KST) 이 사이트의 공개 origin(`https://jp-feynman.github.io`, `https://sel00000.github.io`)과 로컬 `http://127.0.0.1`·`http://localhost` origin의 요청을 받습니다. 포털이 `config.json`(`scripts/public-config.mjs`가 `deployment/public.json`에서 만듦)에서 값을 읽어 검색 패키지에 넘깁니다.
- 모형을 거쳐 나온 결과에는 "AI 해석 후보"(영어 화면은 "AI-interpreted candidate") 표시가 붙습니다(`packages/search/AI_USE.md` 6절).
- 도우미 호출이 실패하면 방문자에게는 경고 없이 보통의 "찾지 못함" 답이 나옵니다.
- 모형은 천체, 위치, 숫자를 주지 않습니다. 모형이 돌려주는 것은 검색 계획이며, 검색 코드가 자기의 닫힌 목록으로 계획을 확인한 뒤에 씁니다. 이름·좌표·값은 이름 색인, CDS·IMCCE 서비스, 팀의 자료에서 옵니다.
- 모형을 부르는 서버 함수(`functions/api/ask.ts`)는 이 저장소가 아니라 TrueBlink 프로젝트에 있습니다.

## 6. 팀이 확인할 것

아래 줄은 팀이 채웁니다. AI는 채우지 않았습니다.

- 작업을 지시하고 검토한 사람: ______________________________
- 브라우저에서 시험한 사람과 기기: ______________________________
- 배포한 사람: ______________________________
- 한국어 별자리 이름(`apps/analysis/scripts/constellation-names-ko.json`)은 팀원의 확인이 필요합니다: ______________________________
