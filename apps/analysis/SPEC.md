# 목표
NASA Space Apps 2026 "Planet X and SPHEREx" 데모 웹앱을 만든다.
화면 왼쪽: SPHEREx가 실제로 관측한 5개 대상의 Blink 뷰어.
화면 오른쪽: 같은 대상의 3D 공간 위치를 보여 주는 인터랙티브 좌표계.
두 화면은 하나의 시간 상태를 공유해 함께 움직인다.
"시선 보기" 버튼을 누르면 3D 카메라가 관측 시점의 지구 위치로 날아가 SPHEREx 영상과 같은 방향·시야·북쪽 위로 맞춰지고,
그 상태에서 시간을 움직이면 3D 속 별의 움직임이 왼쪽 Blink 영상 속 움직임과 똑같이 보여야 한다.

대상 5개 (챌린지 공식 테스트 대상):
Barnard's Star, Epsilon Indi B, WISE 0855-0714 (RA 08h55m10.831s, Dec -07d14m42.53s), RW Aurigae, R Draconis

# 절대 원칙 (no fake science)
- 영상·좌표·시각은 실제 NASA/IPAC IRSA 데이터와 실제 카탈로그 값만 쓴다. 가짜 영상·가짜 별을 실데이터처럼 표시하지 않는다.
- 데이터 받기에 실패하면 화면에 실패를 그대로 표시한다. 조용히 샘플로 대체하지 않는다.
- UI 개발용 모의 데이터가 필요하면 `?mock=1`일 때만 쓰고 화면 전체에 "모의 데이터" 띠를 띄운다.
- 모든 수치/그래픽 요소에 출처 배지: [SPHEREx 측정] [외부 카탈로그: Gaia/문헌] [계산·모델].
- 사용한 모든 외부 코드·데이터는 README의 References에 출처를 적는다. 다른 팀 저장소 코드는 복사하지 않는다.

# 기술 스택
- 프론트: Vite + React + TypeScript, three.js(@react-three/fiber, @react-three/drei), zustand, 정적 빌드(GitHub Pages 배포 가능)
- 데이터 준비(bake): Python 3.11+, astropy, astroquery, pyvo, reproject, numpy, pillow
- 런타임 서버 없음. bake 스크립트가 만든 정적 파일만 프론트가 읽는다.

# 1단계: 데이터 bake 스크립트 (scripts/bake.py)
대상별로 아래를 실행해 `public/data/<target_id>/`에 저장한다.

1) 대상 천체측정값 (외부 카탈로그)
   - Barnard's Star, Epsilon Indi B(Ba/Bb 쌍), RW Aurigae, R Draconis:
     IRSA TAP 테이블 `gaia_dr3_source`에서 조회 (ra, dec, parallax, pmra, pmdec, radial_velocity, ruwe, ref_epoch=2016.0).
     식별은 SIMBAD 좌표를 고유운동으로 2016.0에 옮긴 뒤 근처 소스를 찾고, 선택 근거를 meta에 기록.
   - WISE 0855-0714: 가시광에서 극히 어두워 Gaia에 없을 수 있다. 없으면 문헌값 사용
     (parallax 439.0±2.4 mas, pmra -8123.7±1.3, pmdec 673.2±1.3 mas/yr; Luhman & Esplin 2016),
     기준 위치와 epoch는 SIMBAD에서 확인해 meta에 출처와 함께 기록. radial_velocity는 null.
   - radial_velocity가 없으면 null로 두고 3D에서는 0으로 계산하되 "시선속도 미상" 배지를 단다.
   - RUWE > 1.4이면 "Gaia 측정 신뢰도 낮음" 경고를 meta에 넣는다 (RW Aur가 해당될 가능성 큼).

2) SPHEREx 관측 검색
   - IRSA TAP `https://irsa.ipac.caltech.edu/TAP`
   - 컬렉션: (HANDOFF.md 참고 — qr2는 사라지고 dr1로 대체됨) cal 컬렉션 제외.
   - 커버리지: `spherex.obscore`의 `s_region`에 CONTAINS. 기준 좌표는 고유운동을 반영해 관측 시점 위치로 먼저 옮긴다.
   - 파일 경로: `spherex.plane` + `spherex.artifact` join, producttype='science'. (CONTAINS 안에서 join하면 실패하므로 질의를 나눈다)
   - 관측 시각은 헤더 `MJD-AVG`를 쓴다. `DATE`는 처리일이므로 쓰지 않는다.
   - 요청은 동시 3개 이하, HTTP 503이면 지수 백오프, 404는 "그 영상에 위치 없음"으로 건너뛴다.

3) 컷아웃과 프레임 만들기
   - 컷아웃 크기 기본 0.1° (설정 가능). 원본 전체 파일(~70MB)은 받지 않는다.
   - 컷아웃 축은 검출기 방향이라 북쪽-위가 아니다 → 대상의 관측 시점 위치를 중심으로 한
     공통 TAN WCS(북쪽 위, 동쪽 왼쪽, 픽셀 6.15″, 크기 고정)로 reproject.
   - 관측 시각이 가까운 노출(같은 visit, 기본 간격 2일 이내)을 묶고, 같은 검출기 밴드끼리 합산해 visit 프레임을 만든다.
     visit마다 사용한 노출 수, 검출기, 파장 범위(WCS-WAVE, sip=None)를 기록.
   - FLAGS: SOURCE 비트는 라벨이므로 마스크하지 않는다. 실제 불량 비트만 마스크.
   - 표시용 PNG는 asinh 스트레치(R Draconis처럼 밝은 대상 대비), 스트레치 파라미터를 meta에 기록.
   - 주의: 고정 WCS 중심은 "첫 visit 시점의 대상 위치"로 고정한다(모든 프레임이 같은 하늘 격자여야 별이 움직여 보인다).

4) 시점별 기하 계산 (astropy, float64)
   - 각 visit MJD에서:
     a. 지구 barycentric 위치 (AU, ICRS) — get_body_barycentric('earth'). SPHEREx 고도 약 650 km는 무시하고 meta에 그 사실을 적는다.
     b. 대상 barycentric 위치 (AU) — SkyCoord(...).apply_space_motion(new_obstime)
     c. 지구에서 본 겉보기 방향 = b − a → (ra_app, dec_app) [계산·모델]
     d. 그 방향을 공통 WCS로 변환한 예측 픽셀 (x_pred, y_pred)
   - 3D 보간용으로 관측 기간 전체를 1일 간격 샘플(지구 위치, 대상 위치)로도 저장.
   - 장기 궤적(±20,000년, 100년 간격)도 저장: 직선 운동 근사임을 meta에 표기.

5) 측정값 (선택)
   - visit 프레임마다 예측 위치 주변에서 가중 중심을 측정해 (x_meas, y_meas, 오차)를 저장 [SPHEREx 측정].
   - 측정 위치로 고유운동을 맞추고 Gaia/문헌값과 차이(σ 단위)를 계산.

6) 출력 형식: src/types.ts 참고 (targets.json, <id>/meta.json, <id>/frames/vNN.png, dNN.png)
- bake 실행 로그에 대상별 visit 수, 실패 건수를 출력. 실패 대상은 targets.json에 상태로 남긴다.

# 2단계: 프론트엔드 화면
레이아웃: 상단 바(대상 탭 5개, 데이터 출처) / 좌우 2분할 / 하단 공통 타임라인.

## 왼쪽: Blink 뷰어
- visit PNG를 순서대로 재생 (재생/정지, 속도, 이전/다음, 두 시점 A/B 토글, 첫 visit 대비 차분 보기 = dNN.png)
- 오버레이(토글): 예측 위치 마커(노랑, 계산), 측정 위치(파랑, 오차 원), 예측 궤적 선, 나침반(N 위, E 왼쪽), 스케일바(1′)
- 프레임 정보: UTC, MJD, 검출기, 파장 범위, 노출 수, IRSA URI 링크
- 현재 visit 전환은 공통 시간 상태를 따른다.
- PNG의 투명 픽셀(alpha 0) = 마스크/포화로 데이터 없음 → 체커 패턴 등으로 "데이터 없음"이 보이게.

## 오른쪽: 3D 좌표계 (three.js)
- 좌표: ICRS barycentric. 단위 AU. 축 표시 X(→RA 0h), Y(→RA 6h), Z(→북극). 적도면 격자, 황도면(토글), 먼 천구 RA/Dec 격자.
- 태양(원점), 지구 궤도(dense 데이터), 각 visit 시점의 지구 위치 점.
- 대상 별: 각 visit 시점 위치 점 + 연결 궤적 + 속도 화살표. 시선속도 미상이면 화살표 대신 반투명 원뿔.
- 각 visit에서 지구→대상 시선(선분).
- 두 가지 보기 모드
  1) 개요 모드: 로그 거리 스케일 + 운동 과장 배율 슬라이더(×1~×10⁶), 화면에 "과장됨 ×N" 배지
  2) 시선 보기 모드: 실제 스케일, 과장 ×1 강제
- WebGL float32 정밀도 문제: 모든 좌표는 JS float64로 계산하고, 렌더 직전에 카메라 위치를 빼서(floating origin) 카메라 기준 상대 좌표로 넘긴다.

## 공통 시간 상태 (zustand, src/store.ts에 이미 있음)
- state: { targetId, tMjd, playing, speed, mode: 'overview'|'los', exaggeration, selectedVisit }
- 타임라인: 관측 기간 범위, visit 마커(클릭 시 이동), 재생 시 연속 진행.
- 왼쪽은 tMjd 직전 visit 프레임을 보여 준다. visit 사이 구간에서는 "다음 관측까지 n일" 표시.
- 오른쪽은 tMjd로 dense 샘플을 선형 보간해 지구·대상 위치를 연속으로 움직인다.
- 왼쪽 프레임 클릭/키보드 이동 → tMjd가 그 visit으로 이동 → 오른쪽도 이동 (양방향).

## "시선 보기" 버튼
- 누르면 카메라가 1.5초 동안 부드럽게 이동:
  위치 = 현재 tMjd의 지구 위치
  바라보는 방향 = 공통 WCS 중심(crval) 방향  ← 대상 자체가 아니라 영상 중심
  up 벡터 = 천구 북극(0,0,1)을 시선에 수직으로 투영한 벡터 (북쪽 위, 동쪽 왼쪽)
  수직 시야각 = frame 크기(size_px × 6.15″), 화면 비율 = 1:1
- 이 모드에서는 시간 재생 시 카메라도 지구와 함께 이동(시차 반영).
- 대상 별은 화면에서 일정 픽셀 크기의 점으로 그린다.
- 결과: 3D 화면 속 별의 위치가 왼쪽 Blink 영상의 예측 마커와 픽셀 단위로 겹쳐야 한다.
- 오른쪽 위에 "SPHEREx 시선과 일치 (오차 x.xx px)": 3D 투영 좌표를 영상 픽셀로 환산해 pred_px와 비교.
  주의: 원근 투영은 TAN(gnomonic) 투영과 수학적으로 같다 → 이론상 오차 ≈ 0.
- "개요로 돌아가기" 버튼.

## 설명 패널 (각 대상 하단 카드)
- 거리, 고유운동, 시선속도, 접선속도 v_t = 4.74·μ[″/yr]·d[pc], 1년 이동 픽셀 수, 시차 진폭(픽셀) — 각 값에 출처 배지.
- 고정 문구: "SPHEREx 픽셀(6.15″)보다 시차가 훨씬 작아 거리는 Gaia/문헌 값을 사용합니다."
- RW Aurigae, R Draconis: "멀리 있어 거의 움직이지 않음 — 대조군". R Draconis는 미라형이라 Gaia 시차 불확실 경고.
- WISE 0855: "근처 별 때문에 짧은 파장 측광이 오염될 수 있음", "Gaia에 없는 이유: 가시광에서 극히 어두움".

# 3단계: 검증
- scripts/check_geometry.py (이미 있음)
- 프론트 단위 테스트(vitest): 시선 보기 카메라로 target_au를 투영한 화면 좌표 ↔ pred_px 차이 < 0.5px (모든 visit).
- 수용 테스트(Playwright): 5개 대상 각각 (a) 탭 전환 (b) Blink 재생 (c) 타임라인 이동 시 양쪽 동기 (d) 시선 보기 일치 오차 표시 — 스크린샷.
- 데이터 실패 상태 화면 테스트(네트워크 차단 시 fetch_failed 표시).

# 하지 말 것
- 영상에 보이지 않는 움직임을 과장 표시 없이 그리기
- 계산값을 측정값처럼 표기하기
- 원본 전체 FITS 반복 다운로드, 동시 요청 3개 초과
- 다른 팀 저장소 코드 복사
