# Stellarium Web Engine integration

확인일: 2026-11-14. 이 문서는 웹 앱에서 사용하는 API와 좌표·데이터 범위를 설명합니다.

## 출처와 배포 경로

- Upstream: [Stellarium/stellarium-web-engine](https://github.com/Stellarium/stellarium-web-engine), 확인한 commit `2103935134e09ba1715171241769fce03cebebe4`.
- 근거 파일: `src/js/pre.js`, `src/js/obj.js`, `src/js/canvas.js`, `src/frames.h`, `src/observer.c`, `src/modules/dss.c`, `src/hips.c`, `apps/simple-html/stellarium-web-engine.html`, `apps/simple-html/tests.js`.
- Upstream 공식 빌드 예제 `apps/web-frontend/Dockerfile.jsbuild`는 Emscripten `1.39.17`을 사용합니다. `make js`의 산출물은 `build/stellarium-web-engine.js`와 `.wasm`입니다. 앱의 실제 빌드 절차와 로컬 수정은 프로젝트 빌드 문서를 따르세요.
- 배포 페이지 기준 엔진은 `./engine/stellarium-web-engine.js`, `./engine/stellarium-web-engine.wasm`, 글꼴은 `./fonts/NotoSans-Regular.ttf`, `./fonts/NotoSans-Bold.ttf`, 하늘 데이터는 `./skydata/`에 있습니다.
- 하늘 데이터 원본은 `vendor/stellarium-web-engine/apps/test-skydata/`입니다. Upstream 예제의 Roboto 글꼴 경로는 `apps/simple-html/static/fonts/`이며, 이 앱의 Noto Sans 배포 경로와 다릅니다.
- 엔진 라이선스는 AGPL-3.0입니다. 배포물의 라이선스·출처 안내와 대응 소스 제공 경로를 유지하세요.

## 초기화와 서울 관측 설정

엔진 스크립트를 먼저 로드한 뒤 호출합니다. 데이터 요청에는 절대 URL을 사용하는 편이 안전합니다. `onReady`는 엔진 준비 완료이며 모든 카탈로그·영상 다운로드 완료를 의미하지 않습니다.

```js
const assetUrl = path => new URL(path, document.baseURI).href;
const DEG = Math.PI / 180;

StelWebEngine({
  canvas: document.querySelector('#stel-canvas'),
  wasmFile: assetUrl('./engine/stellarium-web-engine.wasm'),
  translateFn: (domain, text) => text,
  onReady(stel) {
    const c = stel.core;
    const obs = stel.observer; // c.observer와 동일한 관측자
    obs.latitude = 37.5665 * DEG;
    obs.longitude = 126.9780 * DEG;
    obs.elevation = 38; // 미터, 서울 중심의 예시값
    obs.utc = stel.date2MJD(Date.now());
    obs.yaw = 180 * DEG; // 방위각: 북 0°, 동 90°, 남 180°
    obs.pitch = 35 * DEG; // 고도: 지평선 0°, 천정 90°
    c.fov = 100 * DEG;
    c.time_speed = 1;
    stel.setFont('regular', assetUrl('./fonts/NotoSans-Regular.ttf'), 1.38);
    stel.setFont('bold', assetUrl('./fonts/NotoSans-Bold.ttf'), 1.38);
  }
});
```

위도·경도·yaw·pitch·FOV는 **라디안**, `observer.utc`는 **MJD**입니다. 현재 시각으로 설정하면 서울의 낮에는 밝은 하늘이 표시되는 것이 정상입니다. 밤 보기 버튼에서 당일 서울 21:00을 사용하려면 `+09:00`이 포함된 ISO 시각을 만들어 `stel.date2MJD(Date.parse(iso))`로 변환하세요. 브라우저의 현지 시간대를 서울로 가정하지 마세요. 이는 밤 관람용 시각 선택이며 일몰 계산은 아닙니다.

```js
stel.core.time_speed = 0; // 시뮬레이션 시간 일시정지
stel.core.time_speed = 1; // 실시간 속도
stel.observer.utc = stel.date2MJD(Date.now()); // 현재 시각 복귀
const displayedDate = stel.MJD2date(stel.observer.utc); // JavaScript Date
```

## 로컬 데이터와 표시 설정

```js
const c = stel.core;
const base = new URL('./skydata/', document.baseURI).href;
c.stars.addDataSource({ url: base + 'stars' });
c.skycultures.addDataSource({ url: base + 'skycultures/western', key: 'western' });
c.dsos.addDataSource({ url: base + 'dso' });
c.landscapes.addDataSource({ url: base + 'landscapes/guereins', key: 'guereins' });
c.milkyway.addDataSource({ url: base + 'surveys/milkyway' });
c.planets.addDataSource({ url: base + 'surveys/sso/moon', key: 'moon' });
c.planets.addDataSource({ url: base + 'surveys/sso/sun', key: 'sun' });
c.planets.addDataSource({ url: base + 'surveys/sso/moon', key: 'default' });

c.constellations.show_only_pointed = false;
c.constellations.lines_visible = true;
c.constellations.labels_visible = true;
c.atmosphere.visible = true;
c.landscapes.visible = true;
c.lines.equatorial.visible = false;
c.lines.azimuthal.visible = false;
c.dss.visible = false;
```

`addDataSource`는 완료 Promise를 반환하지 않습니다. 진행 상태는 `core.progressbars`에서 확인할 수 있습니다. 번들 별 카탈로그의 `stars/properties`는 `max_vmag = 7.0`으로, 데스크톱 Stellarium의 전체 카탈로그와 동일하지 않습니다.

## 선택·검색·이동·좌표 읽기

```js
const obj = stel.getObj('NAME Jupiter');
if (obj) {
  stel.core.selection = obj;
  stel.pointAndLock(obj, 1); // 이동 시간: 초
  stel.zoomTo(10 * DEG, 1);
}
stel.core.change('selection', () => updateSelection(stel.core.selection));
stel.core.selection = null;
stel.core.lock = null; // 선택 해제와 추적 잠금 해제는 별도
```

`getObj`는 로드된 엔진 데이터에서 찾으며 결과가 없으면 `null`입니다. 이름 자동완성 서버가 포함된 API가 아닙니다. `obj.designations()`는 명칭 배열, `obj.getInfo('vmag')`는 시등급을 반환하며 없는 정보는 `undefined`일 수 있습니다.

```js
function readCoordinates(stel, obj) {
  const vector = obj.getInfo('radec', stel.observer);
  if (!vector || vector.length < 3) return null;
  // vector는 [RA, Dec] 각도 배열이 아닙니다. 구면 좌표 변환을 사용합니다.
  const [ra, dec] = stel.c2s(vector);
  const observed = stel.convertFrame(stel.observer, 'ICRF', 'OBSERVED', vector);
  const [az, alt] = stel.c2s(observed);
  return {
    raHours: stel.anp(ra) * 12 / Math.PI,
    decDegrees: dec * 180 / Math.PI,
    azDegrees: stel.anp(az) * 180 / Math.PI,
    altDegrees: alt * 180 / Math.PI
  };
}
```

위 RA/Dec 표시는 엔진의 ICRF 축 기준 방향입니다. 벡터 길이를 거리로 해석하지 않습니다. `OBSERVED` 좌표는 대기 굴절을 포함합니다. 굴절을 제외한 고도·방위각이 필요하면 `OBSERVED_GEOM`으로 변환하세요. `stel.lookAt(vector, seconds)`의 실제 C 구현은 **MOUNT 방향 벡터**를 받습니다. 기본 지평 마운트에서는 OBSERVED와 같지만, 천구 모드에서는 반드시 MOUNT로 변환하세요.

## 천구 좌표계 보기 (v1.2.0)

`core.mount_frame`은 `stel.FRAME_OBSERVED`와 `stel.FRAME_ICRF`만 지원합니다. `FRAME_JNOW` 등을 지정하면 엔진의 assertion이 발생하므로 사용하지 않습니다. `navigation.c`의 ICRF 마운트는 내부적으로 관측자 CIRS 회전 행렬을 사용하므로 **카메라 yaw/pitch를 ICRF 적경·적위로 해석하지 않습니다.** 격자 `core.lines.equatorial`와 아래 변환 결과는 ICRF 축 기준입니다. 엄밀한 J2000 역기원 천체 카탈로그 좌표나 고유운동 보정을 제공하는 기능은 아닙니다.

```js
// 화면 중심: VIEW에서 전방은 -Z입니다.
const center = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', [0, 0, -1, 0]);
const [ra, dec] = stel.c2s(center);
const target = stel.s2c(raHours * Math.PI / 12, decDegrees * DEG);
stel.core.lock = null;
stel.lookAt(stel.convertFrame(stel.observer, 'ICRF', 'MOUNT', target), 0.5);
```

좌표계 전환은 현재 ICRF 중심을 저장하고 추적·이동 애니메이션을 해제한 뒤 mount를 변경합니다. 엔진의 프레임 업데이트 후 저장된 중심을 새 MOUNT로 변환해 시선을 복원합니다. 지표면 설정은 유지됩니다. 공유 URL의 `frame=equatorial`은 yaw/pitch를 적용하기 전에 복원하며, 숫자 입력은 유한값과 적경 0~24h/적위 ±90° 범위를 검사합니다.

## HiPS와 성능 범위

### 전천 투영

`core.projection = 5`는 이 버전에 컴파일된 `PROJ_MOLLWEIDE`이며 `zoomTo(2 * Math.PI, 0)`으로 전천을 표시합니다. 근거는 `src/projection.h`, `src/projections/proj_mollweide.c`, `src/assets/shaders.inl`입니다. 전천 지도는 2:1 캔버스를 사용하여 360° 상한에서도 극이 잘리지 않게 합니다. 이동·휠·핀치는 기존 엔진의 역투영을 사용합니다. 미완성인 Hammer/Mercator 투영은 선택하지 않습니다.

전환 시 기존 시야·마운트·레이어를 보관하고, 적도 마운트와 ICRF 격자로 바꾸며 지형·안개·대기를 숨깁니다. 나갈 때 저장한 상태를 복원합니다. 공유 URL은 `view=allsky`를 먼저 적용한 뒤 FOV(최대 360°)와 yaw/pitch를 복원합니다. 기본 하늘 보기에서는 기존 150° 버튼 상한을 유지합니다. `view=allsky`가 없는 접속은 지표면을 표시합니다.

지도 배경은 번들 은하수 데이터입니다. 이 기능은 IRSA Firefly나 SPHEREx HiPS cube 연결을 포함하지 않으며, DSS 모듈의 넓은 시야 숨김 규칙은 그대로 적용됩니다.

- 외부 DSS 영상: `core.dss.addDataSource({ url: 'https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color' })`. [원본 properties](https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color/properties)에서 JPEG, equatorial, HiPS 1.4를 확인했습니다. 브라우저의 외부 서버 접근·CORS·네트워크 상태에 의존합니다.
- `dss` 모듈은 데이터 소스 한 개를 교체하여 표시합니다. Upstream의 밝기 로직은 FOV 20° 이상에서 숨기고 10° 이하에서 표시하도록 되어 있으며 다른 밝기 설정의 영향도 받습니다.
- 확인한 HiPS parser는 JPEG/PNG/WebP 영상을 읽고 `hips_frame`에 따른 좌표계 변환을 하지 않습니다. Equatorial 영상만 사용하세요. FITS 과학 수치, SPHEREx 스펙트럼 추출·교정·카탈로그 연결은 이 초기 웹 버전의 기능이 아닙니다.
- WebAssembly와 WebGL이 필요합니다. `file://`로 열지 말고 HTTP 서버로 실행하세요.
- Upstream `canvas.js`에는 CSS 크기와 실제 픽셀 크기를 비교하는 DPR 리사이즈 문제가 있습니다. 로컬 빌드에서 적용한 수정과 픽셀 비율 제한은 빌드 문서를 확인하세요. 시간 일시정지는 렌더링 루프를 중단하지 않습니다.
- `observer.clone()`처럼 생성한 객체와 `listObjs()`가 반환한 유지 객체는 사용 후 `.destroy()`해야 합니다. 목록 조회를 매 프레임 반복하지 마세요.
