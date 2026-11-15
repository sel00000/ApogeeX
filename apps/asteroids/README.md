# SPHEREx Sky Lab · 소행성 분석

JPL Horizons 태양 중심 실제 궤도와 NASA/IPAC IRSA SPHEREx 개별 관측을 연결하는 통합 작업 공간입니다. 연구 탭은 Python 분석 결과·새 작업·보고서·CSV를, 궤도 탭은 실제 관측과 3D 시점을 제공합니다. 3D 화면은 들어갈 때만 로드합니다. 네 계열의 저폴리 암석은 설명용이며 실제 소행성 형상이나 분류가 아닙니다.

현재 번들: 소행성 24개와 행성 8개의 궤도, 관측 메타데이터 7,488행. 실제 사진을 볼 수 있는 소행성은 23개이며, 22개 대상의 고정 하늘 비교 96장과 Hygiea의 개별 사진 2장으로 총 98개 촬영 화면을 제공합니다. 913 Otila는 궤도만 제공하며 준비된 사진이 없습니다.

이번 추가 대상은 **64 Angelina, 216 Kleopatra, 596 Scheila, 2566 Kirghizia, 35107 (1991 VH)**입니다. 모두 SPHEREx 시점, 실제 사진 켜기·끄기, ePSF 모형 겹치기, 촬영별 이동 원과 고정 하늘 재생을 지원합니다.

| 추가 대상 | 고정 하늘 비교 촬영 |
| --- | ---: |
| 64 Angelina | 6장 |
| 216 Kleopatra | 5장 |
| 596 Scheila | 5장 |
| 2566 Kirghizia | 3장 |
| 35107 (1991 VH) | 2장 |

## 실행

Node.js **22.13 이상**을 준비하세요. 프로젝트 루트에서 `npm start` 또는 `Start-Web.cmd`를 사용하면 통합 화면과 분석 API를 함께 실행합니다. 새 Python 분석에 필요한 환경은 루트의 `npm run setup:python`으로 준비합니다. 준비된 결과와 3D만 확인할 때는 Python 분석 환경이 필요하지 않습니다. 이 화면만 정적으로 확인할 때는 이 폴더에서:

```sh
npm ci
npm run build
python3 scripts/serve.py
```

macOS에서는 `START.command`, Windows에서는 `START.cmd`도 사용할 수 있습니다. 두 파일은 프로젝트 루트의 실행 절차를 호출하며 필요한 npm 설치와 빌드를 수행합니다. 준비된 관측 번들은 포함되므로 JPL/IRSA 조회 없이 재생할 수 있습니다. HTML 파일을 직접 더블클릭하지 마세요. 위의 단독 정적 서버는 새 분석 API를 제공하지 않습니다.

개발: `npm run dev -- --port 5188`. 기존 팀 앱의 빌드/서버와 독립되어 있습니다.

## 조작

- 이름 검색 또는 암석 클릭으로 대상 선택. 태양계 / 따라가기 / SPHEREx 시점으로 전환합니다.
- 태양계 재생은 실제 JPL 위치·속도를 보간합니다. 옅은 완전한 선은 최초 기준일의 순간 궤도(2체 근사), 밝은 선은 준비된 기간의 실제 위치 경로입니다. 원형 좌표 격자는 제거했습니다.
- 소행성 암석은 지구 표시 반경의 1/13 이하로 줄였습니다. ‘따라가기’로 가까이 볼 수 있으며 전체 보기에서 선택했다고 크기를 키우지 않습니다. 실제 천체 크기의 축척은 아닙니다.
- **SPHEREx 시점 → 고정 하늘 재생**: 같은 하늘 영역의 실제 연속 촬영을 0.75초/장으로 재생합니다. 실제 촬영 간격은 균일하지 않습니다. 시각은 각 프레임의 실제 UTC이고, 아래 슬라이더는 촬영 프레임을 선택합니다.
- **SPHEREx 시점**: 자유롭게 움직이던 3D 카메라가 촬영 시각의 실제 우주선 위치로 이동하고, 선택 영상의 WCS 방향·회전·각도 범위를 바라봅니다. 중앙의 **관측 사진 켜기 / 사진 투명도**는 카메라를 움직이지 않고 3D 공간의 영상 평면만 조절합니다. **이전 자유 시점**으로 직접 조작했던 위치로 돌아갑니다.
- 오른쪽 **실제 사진 / 모형만 / 겹쳐보기**는 별도의 ePSF 비교 미리보기입니다. 중앙의 사진 켜기/끄기와 독립적입니다.
- 준비된 공통 영역이 없는 대상은 개별 촬영만 보이고, 고정 하늘 재생·모형 전환은 비활성화됩니다. 서로 다른 별 영역을 이어 붙이지 않습니다.
- 저전력 모드는 픽셀 배율을 1로 제한합니다.
- **키보드 비행**: 카메라는 보는 방향으로 나아갑니다. 장면 위에 포인터가 있거나 장면(캔버스)에 포커스가 있을 때 듣습니다. W는 가속이고 손을 떼도 속도가 유지됩니다. S는 감속해 멈춘 뒤 계속 누르면 후진합니다. A/D와 방향키, 왼쪽 버튼 드래그는 제자리에서 시선을 돌립니다(오른쪽으로 끌면 시선이 오른쪽). Shift는 위로, Space는 아래로(카메라 기준) 누르는 동안 움직이고, X는 멈춥니다. 오른쪽 버튼 드래그는 회전 중심을 두고 도는 예전 방식의 회전이고, 휠은 확대·축소입니다. 터치 조작은 전과 같습니다. 속도는 가장 가까운 천체(태양·행성·고른 소행성) 표면까지 거리의 약 0.9배/초(하한·상한 있음)를 최대로 하여 넓은 곳에서는 빠르고 행성 앞에서는 느려집니다. `prefers-reduced-motion`에서는 관성이 없어 키를 누르는 동안만 움직입니다. 비행이나 시선 돌리기를 시작하면 따라가기와 진행 중인 카메라 이동이 풀리고, 보기 버튼(태양계·따라가기·SPHEREx 시점)을 누르면 비행이 멈춥니다. SPHEREx 시점에서는 실제 촬영 시점을 지키기 위해 키가 듣지 않습니다. 입력칸·선택 상자·버튼에 포커스가 있거나 Ctrl/Alt/Meta를 누른 동안에도 받지 않습니다. 캔버스는 Tab으로 갈 수 있습니다. 조작 방식과 수치(회전 속도, 드래그 방향, 정지 시간)는 참고한 작품 Sojourner의 동작을 보고 맞췄고 코드는 새로 썼습니다.
- **은하수 배경**: 기본으로 켜져 있고 선택은 이 브라우저에 기억됩니다(`spherex-asteroids:sky`). 끄면 배경은 이전과 같은 단색입니다. 2k 지도를 먼저, 여유가 있으면(저전력 아님, 터치 기기 아님, 4096 텍스처 지원) 4k 지도를 받습니다. 받지 못하면 단색 배경 그대로입니다.

## 과학적 의미

태양계는 태양 중심 J2000 황도 좌표, AU 선형 축척입니다. 천체의 표시 크기는 설명용입니다. 위치는 JPL Horizons 위치·속도를 cubic Hermite 보간합니다. UI는 UTC, 벡터는 TDB이며 이 기간 UTC→TDB 변환의 주기항 생략 오차는 약 2ms 이내입니다. 순간 궤도는 기준일의 JPL 상태벡터로 구한 참고 타원으로, 장기 정밀 예측선이 아닙니다.

공통 하늘 영상은 같은 검출기의 가까운 시각 촬영들을 고정 ICRS TAN 격자(128×128, 6.15 arcsec/pixel)에 재투영합니다. 모든 프레임의 공통 유효 영역만 표시하며, 동일한 asinh 대비와 중앙 배경값 보정을 적용합니다. 별의 **위치**가 고정되는 것이고 잡음·파장 차이에 따른 밝기 변화는 남습니다. 실제 배경을 합성하거나 교체하지 않습니다.

사진 속 모형은 SPHEREx 관측자(`500@-163182`) 기준 노출 중간 시각의 JPL astrometric ICRF 방향을 FITS WCS에 투영하고, 원본 FITS의 **ePSF**를 해당 검출기 위치에서 선택해 만듭니다. 관측값과 예측값을 섞어 위치를 맞추지 않으며, 분산 가중 최소제곱으로 밝기와 상수 배경만 맞춥니다. 원본 영상과 같은 WCS로 모형을 재투영합니다. 모형만 보기의 밝기는 배경을 제거한 방출량 기준이므로 실제 사진의 배경 밝기와 일치하지 않습니다. 적합 χ²/자유도를 표시하며, 혼잡·포화·노출 중 이동(현재 trail convolution 미적용) 때문에 차이가 남을 수 있습니다.

관측 모드의 3D 암석은 원본 JPL astrometric ICRF 방향(광행시간 보정 포함)을 사용합니다. 태양계 모드의 동시각 기하학적 위치를 그대로 투영하지 않습니다. 선택 영상의 FITS WCS(SIP 포함)를 16×16 삼각형 격자로 변환해 같은 광선 위의 3D 영상 평면에 배치합니다. 영상 평면까지의 거리는 표시용이며, 관측 모드 암석도 약 1픽셀 반경의 설명용 크기로 표시합니다. 고정 하늘 영상은 북쪽 위로 재투영한 잘라낸 영역의 시야이며, 위성 전체 검출기 자세를 재현한다는 의미는 아닙니다.

배경은 Gaia 전천 지도(은하 좌표 정거 원통 투영)를 은하 → ICRS(Gaia EDR3 문서의 회전 행렬) → J2000 황도(경사 23.4392911°)로 돌려 실제 하늘 방향에 맞춘 것입니다. 은하 중심은 RA 266.405°, Dec −28.936°(황경 약 266.8°, 황위 약 −5.5°)에 놓이며 단위 테스트로 확인합니다. 무한히 먼 배경으로 그리며 궤도 선과 이름표가 먼저 읽히도록 표시용 밝기 조정(검은 기준 0.25, 배율 0.45)을 했습니다. 장면 가장자리 글자 뒤에는 배경이 켜져 있을 때만 장면 바탕색의 그라데이션을 깔았습니다.

행성은 실제 관측 지도를 입힌 구입니다. 지도는 NASA/USGS/JPL/STScI의 가공 산물(모자이크·합성·재투영)이며 한 장의 사진이 아닙니다. 금성은 레이더 후방산란 지도로 눈에 보이는 색이 아닙니다. 위치는 JPL 위치 그대로이고 표시 반지름은 이전과 같은 설명용 크기입니다. 자전축은 IAU 극 방향(α0, δ0, J2000)을 황도 좌표로 옮겨 썼고, 자전 위상(본초 자오선)은 재현하지 않습니다. 밝기는 행성 자체 계산으로 태양(원점) 쪽 반구가 밝고 밤쪽은 0.12배이며 반짝임은 없습니다. 금성·토성·천왕성·해왕성 지도에서 관측이 없는 영역(`*-coverage.png`)은 그 지도의 관측 영역 평균색으로 채웠습니다. **채운 색은 자료가 아닙니다.** 토성 고리는 NASA NSSDCA 고리 반지름(D·C·B·카시니 간극·A)으로 그린 **도식이며 사진이 아닙니다.** 행성 지도는 행성이 화면에서 반지름 약 6px 이상이 될 때 받으며 그 전과 실패 시에는 단색 구로 보입니다.

3D의 네 종류 암석은 설명용 형상입니다. SPHEREx 영상의 점광원 모형은 암석 표면 모양 재현이나 독립적 검출 확정을 뜻하지 않습니다. 물성·분류·크기 추정값은 별도 연구 결과 탭에서 출처·불확실성·보류 상태와 함께 제공합니다. 공식 ePSF 설명: [IRSA 튜토리얼](https://caltech-ipac.github.io/irsa-tutorials/spherex-psf/).

## 데이터 재생성

기본 입력은 프로젝트 루트의 `data/prepared/asteroids`입니다. SQLite는 `SPHEREX_SCENE_DB`, 원본 자료는 `SPHEREX_SCENE_SOURCE`, 출력은 `SPHEREX_SCENE_OUT`, 캐시는 `SPHEREX_SCENE_CACHE`, 출처 식별자는 `SPHEREX_SCENE_SOURCE_COMMIT`으로 지정합니다. 경로는 절대 경로를 권장합니다. 기본 SQLite는 입력 폴더의 `asteroids.sqlite`, 기본 출력은 이 앱의 `public/data`, 기본 캐시는 프로젝트 루트의 `var/cache/asteroid-scene`입니다. 재생성 Python 환경에는 `requests numpy scipy astropy pillow`가 필요하며 루트의 `npm run setup:python`으로 설치할 수 있습니다.

현재 번들의 역사적 입력은 GitHub 커밋 `324e485b579c78e776c088a7ba5fc0a2f3455ae3`의 `지호/spherex-asteroid-analysis/outputs/`였습니다. 이 경로는 당시 커밋을 재현할 때만 사용합니다. `snapshot_source.py`의 현재 기본 경로는 `data/prepared/asteroids/`이며, 과거 커밋에는 `--prefix`를 명시해야 합니다. 저장소에 해당 커밋을 가져온 뒤 이 앱 폴더에서 아래 PowerShell 예시를 실행하면 공유 체크아웃을 변경하지 않고 입력을 `.cache/source-<commit>/outputs`에 복사합니다. 별도 Git 체크아웃을 읽으려면 `--repo <checkout>`을 추가하세요.

```powershell
$scenePython = (Resolve-Path '..\..\.venv-asteroid\Scripts\python.exe').Path
& $scenePython -X utf8 -B scripts/snapshot_source.py 324e485b579c78e776c088a7ba5fc0a2f3455ae3 --prefix '지호/spherex-asteroid-analysis/outputs/'
$env:SPHEREX_SCENE_SOURCE = (Resolve-Path '.cache/source-324e485b579c78e776c088a7ba5fc0a2f3455ae3/outputs').Path
$env:SPHEREX_SCENE_DB = Join-Path $env:SPHEREX_SCENE_SOURCE 'asteroids.sqlite'
$env:SPHEREX_SCENE_SOURCE_COMMIT = '324e485b579c78e776c088a7ba5fc0a2f3455ae3'
```

아래 명령은 전체 준비 번들을 재생성합니다. PowerShell 예시는 앞서 지정한 과학 Python을 사용합니다. 현재 `data/prepared/asteroids`를 사용할 경우 스냅샷 단계와 입력 환경변수 설정을 생략하세요. 기존 번들을 유지하려면 `SPHEREX_SCENE_OUT`을 별도 폴더로 지정하세요. 지정하지 않으면 `public/data`를 갱신합니다. 웹에서 실행하는 개별 작업은 아래의 통합 생성기를 통해 별도 폴더에서 완성된 후에만 공개됩니다.

```powershell
$scenePython = (Resolve-Path '..\..\.venv-asteroid\Scripts\python.exe').Path
& $scenePython -X utf8 -B scripts/prepare.py
& $scenePython -X utf8 -B scripts/enrich.py
& $scenePython -X utf8 -B scripts/fixed_sky.py
& $scenePython -X utf8 -B scripts/model_sky.py
& $scenePython -X utf8 -B scripts/prepare_sightlines.py
& $scenePython -X utf8 -B scripts/prepare_trails.py
& $scenePython -X utf8 -B -m unittest discover -s tests -p 'test_*.py'
npm test
npm run build
```

처음 준비할 때 외부 조회로 시간이 걸립니다. 지정한 캐시 폴더의 원본 응답을 재사용하며 JPL 요청은 순차 실행됩니다. 초기 번들 실패는 manifest에, 연속 영상 준비 실패는 콘솔에 남고 가짜 영상으로 대체하지 않습니다. 기본 결과는 `public/data`입니다. 개별 촬영 번들은 소행성마다 최대 3장, Eros 최대 8장입니다. 고정 하늘 묶음은 동일 검출기의 0.12일 이내 촬영 중 공통 영역 75% 이상·3~6장을 우선 사용합니다. 검출기 가장자리 프레임은 제외해 공통 영역과 대상 위치가 유효한 가장 큰 부분 묶음을 사용하고, 부족하면 다른 촬영 조합을 시도합니다. 이동량이 사실상 같은 후보끼리는 별 배경을 더 잘 볼 수 있는 짧은 파장 검출기를 우선합니다. 긴 묶음이 없는 경우 같은 품질 기준(GOOD, SNR ≥ 5)을 통과한 실제 2장으로 비교합니다. 준비된 모든 관측을 보여주는 앱은 아닙니다. SQLite에만 남은 대상은 관측 목록과 궤도를 제공하며 준비된 사진이 없을 수 있습니다.

## 자료 출처 — 3D 배경과 행성 지도

파일과 해시, 투영, 라이선스 전문은 `public/sky/SOURCES.json`에 있습니다.

- 배경: **Gaia EDR3 전천 지도, ESA/Gaia/DPAC** (Acknowledgement: A. Moitinho). 라이선스 **CC BY-SA 3.0 IGO** (https://creativecommons.org/licenses/by-sa/3.0/igo/). PNG를 JPEG로 바꾸고 2k 판은 축소한 수정본이며 같은 라이선스를 따릅니다. 원본: https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_32 . 18억 개 넘는 관측 천체의 밝기와 색을 모은 지도이며 카메라 한 장의 사진이 아닙니다.
- 수성: NASA / MESSENGER / ASU / USGS Astrogeology, MDIS 전구 색 모자이크(다중 파장 색, 자연색 아님). 공개 자료.
- 금성: NASA/JPL Magellan, USGS Astrogeology, C3-MDIR 레이더 모자이크. 공개 자료.
- 지구: NASA Earth Observatory, Blue Marble Next Generation(2004년 7월).
- 화성: NASA Ames / USGS Astrogeology, Viking MDIM 2.1 채색 모자이크(색은 가공).
- 목성: NASA/JPL/Space Science Institute, Cassini 원통 지도 PIA07782.
- 토성·천왕성·해왕성: NASA/ESA Hubble, Amy Simon과 OPAL 팀, STScI/MAST (https://doi.org/10.17909/T9G593).
- 토성 고리 반지름: NASA Goddard / NSSDCA, David R. Williams (https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html).

모두 가공된 공개 산물이며, 이 앱은 표시 크기·밝기·채운 색·고리 도식을 더했습니다. 크기는 설명용이고 자전은 표현하지 않습니다.

원본 출처: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [NASA/IPAC IRSA MOST](https://irsa.ipac.caltech.edu/applications/MOST/), [SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html). 기존 팀 데이터 기준 커밋은 manifest에 기록합니다. 영상은 재투영·배경 레벨 보정·asinh 대비를 적용한 적외선 흑백 영상이며 자연색이 아닙니다. FITS 링크·해시·관측 파라미터·WCS는 번들에 보존합니다.

## 성능 설계

네 개의 instanced rock mesh, 공유 재질, 그림자/후처리 없음. 참고 궤도는 두 개의 LineSegments로 묶고 선택 경로만 강조. 정지와 숨김 탭에서는 렌더링 중단. 재생 중 API 요청 없음. 128×128 사진과 모형을 하나의 atlas에 담아 이미지 캐시는 최대 8장(연속 영상 기준 1 MiB), 새 선택 시 기존 요청 취소, 늦게 도착한 응답 무시. 검사 결과와 알려진 제한은 `docs/VALIDATION.md`에 기록합니다.

## 촬영별 이동 흔적

모든 준비된 대상에 공통으로 작은 원을 표시합니다. 금색은 이전 촬영, 민트색은 현재 촬영, 옅은 회색은 다음 촬영입니다. 숫자는 촬영 순서입니다. 사진에 기록된 천체를 새로 검출한 결과가 아니라 해당 촬영 시각의 JPL 예측 위치이며, 각 위치를 현재 사진의 WCS로 다시 투영합니다. 원 중앙의 실제 신호는 가리지 않습니다.

`촬영별 이동 흔적 표시`로 중앙 3D 영상 평면과 오른쪽 미리보기의 원을 함께 켜고 끌 수 있습니다. 사진 투명도와 독립적입니다. 사진 밖에 있는 위치는 가장자리에 억지로 붙이지 않고 개수만 안내합니다. 촬영 한 장인 대상은 현재 위치만 표시하며, 사진이 없는 대상은 기능을 비활성화합니다.

데이터를 재생성할 때 `python3 scripts/prepare_trails.py`도 실행하세요. 런타임에는 좌표 재계산이나 외부 API 요청 없이 준비된 좌표와 하나의 투명 텍스처를 재사용합니다.

## 통합 분석과 3D 생성

`public/analysis-data/index.json`은 준비된 결과 목록입니다. 대상의 영구 식별자, 파일 ID와 숫자 번호는 구분합니다. 같은 대상의 새 분석은 별도 run ID를 가집니다. `Complete`는 처리 상태이며 높은 신뢰도를 뜻하지 않습니다. 열모델/통계/결합/카탈로그 지름은 따로 표시합니다.

새 분석은 `/api/asteroid-analysis`의 capabilities/jobs/status/cancel을 사용합니다. 완료 후 사용자가 3D 생성 버튼을 누르면 원본 분석 폴더와 SQLite를 별도 입력으로 받아 6단계 자료 생성을 실행합니다. 결과가 완성되기 전에 웹 경로에 공개하지 않습니다. 취소와 실패는 과학 분석 결과를 지우지 않습니다. 실시간 신규 자료 생성에는 JPL/IRSA 연결이 필요하며 외부 장애가 발생하면 오류로 표시합니다.

GitHub Pages 같은 정적 웹에서는 한 단계 위 `config.json`의 `apiBase`로 별도 분석 서버를 지정합니다. 예: `{"apiBase":"https://science.example/backend","localServices":false}`. 이 값은 **서버 origin 또는 배포 prefix**이며 `/api`를 붙이지 않습니다. `/backend` 같은 값은 현재 웹 origin 기준으로 해석합니다. 외부 서버는 HTTPS를 사용하고, localhost 개발 서버만 HTTP를 허용합니다. 비어 있지 않은 빌드 환경변수 `VITE_API_BASE`가 런타임 설정보다 우선합니다. 로컬 통합 서버는 빈 `apiBase`를 유지합니다. 같은 origin에서 공개 모드 API를 운영한다면 `publicMode:true`도 설정합니다.

설정은 5초간 캐시하며 **서버 다시 연결** 버튼은 즉시 재조회합니다. 설정이나 서버에 문제가 있어도 준비된 정적 결과는 계속 표시합니다. 결과 JSON·CSV·그림·3D 경로는 설정된 API origin과 배포 prefix 안에서만 허용합니다. 서버가 반환한 `/api/...` 경로에도 배포 prefix를 적용합니다.

공개 API는 `GET /api/session`으로 발급받은 세션을 `X-Spherex-Session` 헤더에 담아 작업 생성·상태 확인·취소에 사용합니다. 세션은 API 주소별로 `sessionStorage`에 보관하며 두 분석 앱이 공유합니다. 쿠키나 브라우저에 저장한 배포 비밀키는 사용하지 않습니다. 공개 과학 결과와 그림·CSV·3D 파일은 세션 헤더 없이 읽을 수 있어야 합니다. 서버는 웹 origin에 대한 CORS와 `Content-Type`, `X-Spherex-Session` preflight를 허용해야 합니다. 테스트: `node tests/remote-api.browser.mjs`는 서로 다른 localhost origin에서 실제 브라우저 CORS를 검증하며 새 NASA 분석은 실행하지 않습니다.

```text
node scripts/generate-scene.mjs --source-dir <raw-target-folder> --source-root <raw-outputs> --db-path <sqlite> --output-dir <new-scene-directory> --python <python-executable>
```

현재 3D 재생의 UTC/TDB 근사는 2025–2026 범위에서 검증되어 있습니다. 이 범위를 벗어난 신규 3D 생성은 명시적으로 거절하며 분석 결과는 계속 볼 수 있습니다.

검증: `npm test`, `npm run test:scene`, 과학 Python 환경에서 `python -X utf8 -B -m unittest discover -s tests -p "test_*.py"`.
