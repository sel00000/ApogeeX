# 이동 천체 · 통합 V1

> 아래 자료 출처와 처리 기록은 원본 통합 V1에서 보존했습니다. 사람 이름 폴더는 과거 출처를 식별하기 위한 표기이며 현재 실행 경로가 아닙니다. v5에서는 `apps/portal/moving`에 있고 `#asteroids?tab=observations`에서 열립니다. 실행·빌드는 저장소 루트에서 수행합니다.

`mountMoving(container, { onAnalyze })`를 내보내는 독립 ES 모듈입니다. 부모 앱은 `moving/index.js`를 필요한 순간에만 import합니다. 반환 객체의 `ready`로 준비를 기다리고 `setActive`로 재생을 중지·복귀하며, 화면을 떠날 때 `dispose`를 호출합니다. CSS는 `.moving-page` 아래로 한정되어 있습니다.

## 현재 자료

중선의 현재 `v1.2.0`에는 Stellarium 궤도 카탈로그와 분석창 연계가 있지만 SPHEREx 소행성 영상 시계열 자체는 없었습니다. 기존 프로젝트의 공식 IRSA MOST 검색 결과를 사용해 실제 FITS 컷아웃을 내려받아 다음 화면을 구성했습니다. 원래 중선·경보·지호 파일은 수정하지 않았습니다.

| 대상 | 관측 | 기간 | 고정 시야 | 파장 |
|---|---:|---|---:|---|
| 4 Vesta | 3회 | 2025-08-04 ~ 08-05 UTC | 39.36′ | D6 (노출마다 실제 협대역은 다름) |
| 3I/ATLAS | 4회 | 2025-08-01 약 6분 | 13.12′ | D6 (노출마다 실제 협대역은 다름) |

실제 관측 이미지입니다. Vesta는 예측점 기준 약207픽셀 움직입니다. 3I/ATLAS는 약1.8픽셀만 움직이며 신호가 희미하므로 보이는 중앙점을 혜성으로 검출했다고 주장하지 않습니다. 더 긴 혜성 시계열은 추가 관측 선택·등록 검증이 필요합니다.

- 모든 프레임은 동일한 ICRS/J2000 TAN 격자(6.15″/픽셀), 북쪽 위·동쪽 왼쪽입니다.
- 가장 가까운 시간의 MOST 좌표를 격자 중심으로 삼습니다. 개별 이미지를 천체 중심으로 이동시키거나 천체를 인위적으로 옮기지 않았습니다.
- `IMAGE`의 MJy/sr 표면밝기를 사용하고 심한 결함·포화 플래그를 마스크했습니다. SOURCE 비트는 제거하지 않습니다.
- 같은 대상의 모든 프레임에 하나의 중앙값 배경·asinh 명암 범위를 적용했습니다. PNG는 표시용이며 정밀 측광은 원본 FITS를 사용해야 합니다.
- 투명한 픽셀은 결측 또는 품질 마스크이며 생성형 보간을 하지 않았습니다.
- 링과 궤적은 MOST 궤도 **예측**이며 측정한 중심·검출 판정이 아닙니다. MOST 반환 시각은 노출 시작에 해당하고, 표시 시각은 FITS의 `MJD-AVG`입니다. 약58초 차이를 별도 필드로 보존했고 임의 보정하지 않았습니다.
- 프레임별 λ와 Δλ는 원본 FITS `WCS-WAVE`의 근사 협대역 중심·폭을 MOST 예측 위치에서 읽은 값입니다. 천구 SIP 왜곡은 파장표에 적용하지 않습니다. 헤더 재계산 검사를 통과했습니다.
- D6의 광대역 범위는 4.42–5.00μm이나 각 픽셀은 LVF 협대역입니다. 날짜에 따라 협대역과 관측 기하가 달라져 모습 변화만으로 변광을 결론 내릴 수 없습니다.
- 재생은 원래 관측 간격을 보간하지 않고 **관측 장면 순서**를 일정 표시 간격으로 넘깁니다. UI 속도는 물리적 이동 속도가 아닙니다.
- `onAnalyze({ra, dec, label, moving:true, epoch, observationMjd})`로 넘기는 분석 좌표는 해당 시각의 예측 위치입니다. `epoch`는 예측 시각 MJD, `observationMjd`는 실제 노출 중간 MJD입니다. 일반 분석 작업실은 그 **고정 하늘 좌표**의 보관 자료를 검색하며 이동 천체를 과거로 추적하지 않습니다.

## 기존 소행성 분광자료

`경보/trueblink/public/data/asteroids/`의 Hygiea·Dembowska·Eros·Kollaa 데이터를 그대로 보존했습니다. JSON의 원래 연구 프로토타입 방법·관측 ID·품질 판정·출처를 유지합니다. 공식 SPHEREx 카탈로그 분광측광으로 재표기하지 않습니다. 그래프는 실제 유효점만 표시하며, 여러 날짜의 점을 선으로 연결하지 않습니다.

출처: TrueBlink project (NASA Space Apps Challenge 2026), Apache-2.0. 원본 라이선스와 AI 사용 고지는 복사한 텍스트 파일에 있습니다. 기존 프로젝트 자료의 검증 한계도 그대로 적용됩니다.

## 재생성 및 검사

아래 명령은 통합 V1 폴더를 현재 디렉터리로 하거나 절대 경로로 실행합니다. Python에는 numpy, astropy, requests, reproject, Pillow가 필요합니다.

```sh
python moving/build_data.py
python moving/validate_data.py
```

`build_data.py`는 최대3개 동시 IRSA 요청만 사용하고, 다운로드한 FITS가 있으면 재사용합니다. `data/most_*.json`에 기록한 공식 결과에 의존합니다. `data_validation.json`은 실제 파일을 다시 읽고 SHA256, 노출 시각, 고정 격자 방향, 예측점 좌표, PNG 크기, 기존 스펙트럼 점 개수를 검사한 기록입니다. 실제 천체 검출·중심 위치·측광 정확도 검증은 아닙니다.

## 성능과 접근성

- 초기 화면에는 선택 대상의 PNG 3개와 작은 JSON만 읽습니다. 40MB의 FITS는 다운로드 링크를 누를 때만 브라우저가 받습니다.
- 재생은 interval 기반으로 관측 인덱스만 바꿉니다. 연속 WebGL 렌더링이나 네트워크 요청은 없습니다.
- 떠날 때 타이머·이벤트·fetch를 정리합니다. 숨김 탭에서는 재생을 중단합니다.
- 버튼/타임라인/방향키/스크린리더 레이블 지원, 작은 화면에는 한 열로 재배치됩니다.

## 브라우저 확인 (2026-11-15 KST)

통합 서버 `http://127.0.0.1:8781/#moving`를 실제 Chromium으로 확인했습니다.

- 베스타 다음 관측 버튼: 실제 PNG가 `vesta_01.png`로 바뀌고 UTC `00:07:59`로 갱신됩니다.
- 프레임별 파장: 첫 베스타 장면 `4.647 μm`, `Δλ 0.037 μm`로 표시됩니다.
- 모바일 390×844: 문서 너비 390px, 수평 넘침 없음. 3I/ATLAS 실제 자료와 낮은 신호·작은 이동 주의문 표시.
- 기존 Hygiea: 유효하며 양의 플럭스를 가진 169점 표시 (전체 원본 257점과 품질 제외 정보는 JSON 보존).
- 숨김 상태 이벤트를 제어 주입했을 때 재생 버튼 `true → false`로 중단됨.
- 별도 mount의 타이머 계측: 재생 1개, 분석 클릭 후 0개, disposer 후 0개, 자식 DOM 0개. 콜백에 실제 예측 좌표와 예측/관측 MJD가 전달됨.
- 네트워크 실패를 제어 주입한 경우 정직한 오류·다시 불러오기만 표시하고 대체 이미지 0개.
- 기본 로드와 위 상호작용에서 브라우저 console 오류 0개.

## 공식 자료

- [SPHEREx DR1](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html)
- [IRSA Moving Object Search Tool](https://irsa.ipac.caltech.edu/applications/MOST/)
- [3I/ATLAS SPHEREx 자료와 해석 주의](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html)

Data: NASA/SPHEREx, JPL-Caltech, Caltech/IPAC (IRSA). 프로그램의 크레딧에는 SPHEREx 공식 acknowledgement와 관련 데이터 DOI도 포함해야 합니다.
