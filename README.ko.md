[English](README.md)

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/readme/logo-light.png">
  <img alt="ApogeeX" src="docs/readme/logo-light.png" width="320">
</picture>

<h1>모두를 위한 SPHEREx</h1>

<p>NASA SPHEREx의 실제 관측을 하늘의 한 자리마다 시간 순서로 보여 주어, 움직이거나 변하는 천체가 드러나게 하는 공개 웹 도구입니다.</p>

<p>
<a href="https://sel00000.github.io/ApogeeX/">공개 사이트</a> ·
<a href="README.md">English</a> ·
<a href="#무엇인가">하는 일</a> ·
<a href="#자료와-출처">자료와 출처</a> ·
<a href="#ai-사용">AI 사용</a>
</p>

</div>

<img alt="모두를 위한 SPHEREx 홈 화면" src="docs/readme/home.jpg" width="100%">

## 무엇인가

모두를 위한 SPHEREx는 Team ApogeeX가 NASA Space Apps Challenge 2026의 챌린지 "Planet X and SPHEREx"에 낸 웹사이트입니다. NASA/IPAC 적외선 과학 아카이브(IRSA)의 SPHEREx 전천 지도에서 한 자리를 고르면, 그 자리를 찍은 실제 SPHEREx 영상을 시간 순서로 보여 줍니다. 공개 사이트에서는 준비된 다섯 대상에 대해 이 일을 하고, 그 밖의 자리는 IRSA에서 영상을 받아 오는 로컬 Python 서비스가 필요합니다. 여기에 플라네타리움, 실제 SPHEREx 영상과 연결한 소행성 궤도 3D, 영어와 한국어 이름을 알아듣는 검색, 튜토리얼이 함께 있습니다.

챌린지는 SPHEREx 자료로 움직이거나 변하는 천체를 어떻게 찾을 수 있는지 묻습니다. SPHEREx는 같은 하늘을 여러 적외선 파장으로 거듭 찍습니다. 이 사이트는 그 방문들을 나란히 놓고 같은 파장끼리 비교하며, 준비된 다섯 대상(Barnard's Star, Epsilon Indi B, WISE 0855-0714, RW Aurigae, R Draconis)의 위치·밝기·스펙트럼을 잽니다. 그 밖의 자리에서는 영상과 자료 출처만 제공합니다. 소행성은 JPL Horizons의 궤도를 그 소행성이 찍혔어야 할 SPHEREx 영상 옆에 놓습니다. 이 사이트는 새로운 발견을 주장하지 않습니다.

천문학자가 아닌 사람에게는 튜토리얼의 일반인 과정과 쉬운 말로 쓴 화면이 적외선 탐사가 무엇을 보는지, 블링크가 왜 움직임을 보여 주는지 설명합니다. 연구자에게는 모든 값에 출처 표시가 붙고, 연구자 과정이 좌표·원본 픽셀·파장 응답·불확도를 다루며, 분석 화면은 값이 나온 아카이브 파일로 거슬러 갈 수 있게 합니다.

## 둘러보기

<table>
<tr>
<td width="50%" valign="top"><img alt="천구 관찰" src="docs/readme/sky-view.jpg" width="100%"><br><b>천구 관찰.</b> 별자리 그림과 지면 보기가 있는 SPHEREx 전천 지도에서 자리를 고릅니다. 플라네타리움은 이 화면의 두 번째 보기입니다.</td>
<td width="50%" valign="top"><img alt="관측" src="docs/readme/observe.jpg" width="100%"><br><b>관측.</b> 같은 자리의 실제 노출을 같은 파장끼리 번갈아 봅니다.</td>
</tr>
<tr>
<td width="50%" valign="top"><img alt="분석" src="docs/readme/analyse.jpg" width="100%"><br><b>분석.</b> 준비된 대상마다 위치, 변광, 스펙트럼, 자료 출처를 봅니다.</td>
<td width="50%" valign="top"><img alt="궤도 3D" src="docs/readme/orbit-3d.jpg" width="100%"><br><b>궤도 3D.</b> JPL의 소행성 궤도를 실제 SPHEREx 영상과 잇고, 은하수를 배경으로 W A S D로 날아다닙니다.</td>
</tr>
<tr>
<td width="50%" valign="top"><img alt="검색" src="docs/readme/search.jpg" width="100%"><br><b>검색.</b> 자체 검색 엔진이 먼저 답합니다. 엔진이 읽지 못한 문장만 작은 언어 모형이 읽으며, 그런 결과에는 표시가 붙습니다.</td>
<td width="50%" valign="top"><img alt="튜토리얼" src="docs/readme/tutorial.jpg" width="100%"><br><b>튜토리얼.</b> 일반인 과정과 연구자 과정이 있고, 건너뛰거나 다시 볼 수 있습니다.</td>
</tr>
</table>

## 실제 자료와 그렇지 않은 것

분석 화면은 값에 "SPHEREx 측정", "외부 카탈로그", "계산·모델" 표시를 붙입니다. 그림에는 그림이라는 안내가 붙습니다.

| 종류 | 사이트의 예 |
|---|---|
| SPHEREx 측정 | 천구 관찰, 관측, 궤도 3D의 노출 영상(NASA/IPAC IRSA, SPHEREx DR1·QR3). 분석 화면에서 그 영상으로 잰 위치와 고유운동. |
| 외부 카탈로그 | Gaia DR3, SIMBAD, Hipparcos-2의 카탈로그 위치와 운동. JPL Horizons의 소행성 위치와 궤도. |
| 계산 또는 모형 | 스펙트럼 도구의 흑체 맞춤과 흡수 깊이. SPHEREx 영상 위에 겹친 소행성 예측 위치(ePSF 모형)와 참고 궤도 타원. |
| 설명용 그림·안내 그림 | 천구 관찰의 별자리 선 그림과 지면. 궤도 3D의 행성 크기, 암석 모양, 도식인 토성 고리. 궤도 3D 뒤의 은하수는 실제 Gaia 전천 지도이지만 SPHEREx 자료가 아닙니다. |

## 언어

사이트는 처음에 영어로 열리며, 상단 바의 `EN | 한` 스위치로 모든 화면과 검색, 튜토리얼을 새로고침 없이 한국어로 바꿉니다. 선택은 브라우저의 키 `spherex-lang` 하나에 저장되며, 상세는 [구조 문서](docs/architecture.md)에 있습니다.

## 로컬 실행

Node.js 22.13 이상과 Python 3.11 이상을 사용합니다. Windows에서는 `Start-Web.cmd`를 실행해도 됩니다.

```sh
npm run setup          # 웹 의존성 (앱마다 npm ci)
npm run setup:python   # Python 환경, 최초 한 번
npm run build
npm run preview        # http://127.0.0.1:4173/
# 웹 단계를 한 번에: npm start
npm test               # Python 환경이 필요합니다
```

Python 서비스가 없어도 홈, 천구 관찰, 플라네타리움, 준비된 대상, 준비된 소행성 결과와 궤도 3D, 검색, 튜토리얼을 볼 수 있습니다. 새 관측 영역 처리와 새 소행성 분석은 Python 서비스가 준비되어 있어야 합니다. 공개 사이트에는 Python 서버가 없습니다([deployment/public.json](deployment/public.json)의 `apiBase`가 빈 값). [무료 서버 배포와 제한](docs/public-server.md)을 확인하십시오. 공개 사이트는 빌드한 `dist` 폴더를 이 저장소의 `gh-pages` 브랜치에 올려 게시합니다.

프로젝트의 이전 기록은 [github.com/sel00000/Apogee](https://github.com/sel00000/Apogee)에 있습니다.

## 구조

```mermaid
flowchart LR
  subgraph Browser["브라우저"]
    P[포털<br/>apps/portal]
    A[분석 앱<br/>apps/analysis]
    PL[플라네타리움<br/>apps/planetarium]
    AS[소행성·궤도 3D<br/>apps/asteroids]
    S[검색<br/>packages/search]
    T[튜토리얼<br/>packages/tutorial]
    P --> A
    P --> PL
    P --> AS
    P --> S
    P --> T
  end
  subgraph Local["로컬 서비스 (선택)"]
    G[Node 서버와 gateway<br/>scripts/serve.mjs, services/gateway]
    O[관측 처리, Python<br/>services/observations]
    AN[소행성 분석, Python<br/>services/asteroids]
    G --> O
    G --> AN
  end
  subgraph Outside["외부 자료 서비스"]
    IRSA[NASA/IPAC IRSA<br/>SPHEREx 영상]
    JPL[JPL Horizons]
    CDS[CDS SIMBAD, Sesame, VizieR]
    IM[IMCCE SsODNet]
    LLM[언어 모형 도우미<br/>trueblink.pages.dev/api/ask]
  end
  A -. /api .-> G
  AS -. /api .-> G
  A --> IRSA
  O --> IRSA
  AN --> JPL
  AN --> IRSA
  S --> CDS
  S --> IM
  S -. 엔진이 문장을 읽지 못할 때만 .-> LLM
```

| 폴더 | 내용 |
|---|---|
| `apps/portal` | 홈, 메뉴, 언어 스위치, 다른 앱을 담는 틀. |
| `apps/analysis` | 천구 관찰의 지도와 관측·분석 화면(React). |
| `apps/planetarium` | Stellarium Web Engine 기반 플라네타리움. |
| `apps/asteroids` | 소행성 결과, 관측, 궤도 3D(three.js). |
| `packages/search` | 검색 엔진과 이름 색인. |
| `packages/tutorial` | 두 튜토리얼 과정. |
| `packages/contracts` | 하늘 영역 선택의 공통 형식. |
| `services` | 로컬 Node gateway와 관측·소행성 Python 서비스. |
| `data/prepared` | 사이트와 함께 배포하는 준비 자료. |
| `scripts` | 설치, 빌드, 로컬 서버, 테스트. |
| `deployment` | 공개 설정(`public.json`). |
| `docs` | 구조, AI 사용, 출처, 이 README의 그림. |

## 자료와 출처

| 자료·자산 | 출처 표기 | 라이선스·이용 조건 | 전체 고지 |
|---|---|---|---|
| SPHEREx 영상과 전천 큐브(DR1, QR3, Level 2) | NASA/IPAC Infrared Science Archive (IRSA) | 이 저장소에 라이선스 문서 없음 | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| 소행성 위치·속도 | JPL Horizons (NASA/JPL) | 이 저장소에 라이선스 문서 없음 | [apps/asteroids/README.md](apps/asteroids/README.md) |
| 궤도 3D의 은하수 배경 | ESA/Gaia/DPAC, 감사 표기 A. Moitinho | CC BY-SA 3.0 IGO (크기·형식을 바꾼 변형본) | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| Gaia DR3 위치·운동(VizieR I/355) | ESA/Gaia/DPAC, CDS 경유 | 값과 이름 찾기에만 사용 | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Hipparcos-2 별 위치(VizieR I/311) | F. van Leeuwen 2007, A&A 474, 653 | CDS VizieR 이용 조건 | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| Stellarium Web Engine과 함께 든 하늘 자료 | Stellarium Labs SRL과 기여자 | AGPL-3.0 | [apps/planetarium/THIRD-PARTY-NOTICES.md](apps/planetarium/THIRD-PARTY-NOTICES.md) |
| 별자리 선 그림(western sky culture) | Stellarium's team | 글과 자료 CC BY-SA | [apps/analysis/THIRD_PARTY_NOTICES.md](apps/analysis/THIRD_PARTY_NOTICES.md) |
| 행성 지도: 수성, 금성, 지구, 화성, 목성 | NASA/MESSENGER/ASU/USGS; NASA/JPL Magellan, USGS; NASA Earth Observatory, R. Stöckli; NASA Ames/USGS Viking; NASA/JPL/Space Science Institute | 파일마다 공공 영역, NASA 이미지 지침, JPL 이미지 이용 정책 | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| 행성 지도: 토성, 천왕성, 해왕성 | NASA/ESA Hubble, Amy Simon과 OPAL 팀, STScI/MAST | STScI 콘텐츠 이용 정책 | [apps/asteroids/public/sky/SOURCES.json](apps/asteroids/public/sky/SOURCES.json) |
| 이름 찾기 | SIMBAD, Sesame (CDS, Strasbourg) | 고지에 감사 문구 기재 | [packages/search/NOTICE.md](packages/search/NOTICE.md) |
| 한국어 천체 이름 | Wikidata와 원본 프로젝트의 보충 자료 | CC0 (Wikidata) | [packages/search/NOTICE.md](packages/search/NOTICE.md) |
| 태양계 천체 찾기 | IMCCE SsODNet (quaero) | 이 저장소에 라이선스 문서 없음 | [packages/search/AI_USE.md](packages/search/AI_USE.md) |
| 플라네타리움의 수도 위치 | GeoNames; Natural Earth | CC BY 4.0; 공공 영역 | [apps/planetarium/THIRD-PARTY-NOTICES.md](apps/planetarium/THIRD-PARTY-NOTICES.md) |
| three.js | three.js authors | MIT | [apps/portal/vendor/three/LICENSE](apps/portal/vendor/three/LICENSE) |

"이 저장소에 라이선스 문서 없음"은 출처는 밝혔지만 이용 조건 문서를 저장소에 옮겨 두지 않았다는 뜻입니다.

## AI 사용

코드와 글의 상당 부분은 팀의 지시에 따라 Anthropic의 Claude(Claude Code 명령줄 도구)로 썼으며, 어느 부분인지는 아래 기록에 있습니다. 그 결과물은 다른 AI 에이전트가 검토했습니다. 화면의 영어 문구는 팀이 쓴 한국어 문구를 AI가 번역한 것입니다. 실행 중에는 검색이 자체 엔진으로 읽지 못한 문장을 작은 언어 모형(Cloudflare Workers AI의 Llama 3.1 8B)에 보낼 수 있습니다. 모형은 검색 계획만 돌려주고 천체·위치·숫자를 만들지 않으며, 그런 결과에는 "AI 해석 후보" 표시가 붙습니다. 사이트의 하늘 영상, 행성 지도, 관측은 AI가 만든 것이 아닙니다. 상세는 [docs/AI_USE.md](docs/AI_USE.md), [packages/search/AI_USE.md](packages/search/AI_USE.md), [apps/portal/moving/AI_USE-TrueBlink.md](apps/portal/moving/AI_USE-TrueBlink.md)에 있습니다.

## 라이선스

저장소 전체에 하나의 라이선스는 없습니다. 부분마다 따로 갖습니다.

| 부분 | 라이선스 |
|---|---|
| `apps/analysis` | MIT ([LICENSE](apps/analysis/LICENSE)). TrueBlink에서 가져온 파일은 Apache-2.0을 유지합니다([고지](apps/analysis/THIRD_PARTY_NOTICES.md)). |
| `apps/planetarium` | AGPL-3.0-only ([LICENSE-AGPL-3.0.txt](apps/planetarium/LICENSE-AGPL-3.0.txt)) |
| `packages/search` | Apache-2.0 ([LICENSE](packages/search/LICENSE)) |
| `apps/portal/moving` | Apache-2.0 ([LICENSE](apps/portal/moving/LICENSE)) |
| `apps/portal/vendor/three` | MIT ([LICENSE](apps/portal/vendor/three/LICENSE)) |
| `apps/portal`(나머지), `apps/asteroids`, `packages/tutorial`, `packages/contracts`, `services`, `scripts` | 아직 라이선스를 정하지 않았습니다 |

## 팀

Team ApogeeX, NASA Space Apps Challenge 2026.

팀원: ______________________________
