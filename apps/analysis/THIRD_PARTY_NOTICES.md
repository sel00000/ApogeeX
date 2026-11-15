# 제3자 코드 고지 / Third-party notices

## TrueBlink (팀원 경보, `경보/trueblink`, Apache License 2.0)

아래 파일은 TrueBlink에서 가져왔습니다. 2026-11-15 저녁(KST)에 지면 보기와 최신 `SkyGlobe.ts`를 다시 가져왔습니다. 첫 줄의 "AI-assisted code (Claude)" 고지와 원래 주석을 그대로 두었고, 바꾼 곳은 아래에 적었습니다. 전체 라이선스는 `경보/trueblink/LICENSE`에 있습니다.

| 이 폴더 | 원본 | 바꾼 점 |
|---|---|---|
| `src/gl/SkyGlobe.ts` | `src/gl/SkyGlobe.ts` | TrueBlink의 최신 파일입니다. 이 앱에서 더한 것: 별자리 선·이름 층(`setConstellations` 등), 타입 경로(`./skyTypes`), 사용하지 않던 필드를 읽는 `element` 접근자, `outline:none` |
| `src/gl/globe/ground.ts`, `horizon.ts`, `view.ts` | `src/gl/globe/ground.ts`, `horizon.ts`, `view.ts` | 최신 파일, 바꾼 곳 없음 (지면 보기와 지평선 계산) |
| `src/gl/globe/healpix.ts`, `tiles.ts` | `src/gl/globe/*` | 없음 |
| `src/gl/globe/ground.test.ts` | `tests/ground.test.ts` | import 경로. 지면 메쉬 부분만 가져왔고, TrueBlink 앱 쪽의 기억 스위치·첫 방문 시점 시험은 쓰지 않았습니다 |
| `src/gl/globe/horizon.test.ts`, `fixtures/horizon_golden.json` | `tests/horizon.test.ts`, `tests/fixtures/horizon_golden.json` | 시험은 import 경로만 다릅니다. 고정 자료는 같습니다 |
| `src/gl/globe/healpix.test.ts`, `fixtures/golden_cube.json` | `tests/healpix.test.ts`, `tests/fixtures/golden_cube.json` | import 경로 |
| `src/lib/catalogNet.ts` | `src/core/catalogs/net.ts` | 없음 |

다시 구현한 아이디어(코드 복사 아님): 같은 파장끼리 비교하는 블링크, 탐험/연구 모드, 임무 카드, 발견 목록, 안내 카드, 차가운 천체 필터, 링크 공유, VizieR·Sesame 미러 목록과 Gaia 고유운동 이동(`src/lib/sky.ts`), SPHEREx 102채널 파장표(`hips-rewrite.mjs`의 값).

## 자료

- 영상: NASA/IPAC Infrared Science Archive, SPHEREx DR1·QR3 (L2 영상, 전천 HiPS 큐브 `spherex_allsky_cube`).
- Gaia DR3 (ESA/DPAC) via VizieR I/355/gaiadr3, CDS Sesame/SIMBAD: 위치·운동 값과 이름 찾기에만 사용.

## 별자리 선 (`public/data/sky/constellations.json`)

88개 별자리의 선 그림(RA/Dec 꺾은선)과 이름, 라벨 위치를 담은 파일입니다. `scripts/build-constellations.mjs`가 만들었습니다. SPHEREx 자료가 아니라 안내용 그림입니다.

- 선 그림: Stellarium Web Engine의 western sky culture (`apps/planetarium/vendor/stellarium-web-engine/apps/test-skydata/skycultures/western/index.json`). 저자 "Stellarium's team". 같은 폴더 `description.md`의 라이선스 항목: "Text and data: CC BY-SA" (삽화는 "Free Art License"이며 쓰지 않았습니다). 엔진 자체는 AGPL-3.0 (`LICENSE-AGPL-3.0.txt`).
- 별 위치: Hipparcos, the New Reduction (F. van Leeuwen 2007, A&A 474, 653, VizieR I/311/hip2). ICRS, 에포크 J1991.25, `apps/planetarium/catalogs/hipparcos2-astrometry.tsv.gz`. 이용 조건은 provenance 파일의 `licenseUrl`: https://cds.unistra.fr/vizier-org/licences_vizier.html
- 이름: 라틴어 이름은 위 sky culture, 한국어 이름은 표 `scripts/constellation-names-ko.json`. 이 표는 표준 한국어 별자리 이름을 보고 AI 설계 세션이 입력했으며, 인용한 출처 파일은 없고 팀은 아직 확인하지 않았습니다.
