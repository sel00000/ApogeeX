# BLACKHOLE_BG 원형 보존과 TIFF 연결

이 디렉터리는 같은 저장소 `한결/BLACKHOLE_BG`의 권위 있는 파일을 **바이트 그대로** 보존합니다. `source-audit.json`에 6개 원본의 SHA256·줄 수·실행 여부가 있습니다. 원래 프로그램은 수정하지 않았습니다.

## 그대로 실행되는 부분

- `bbh-physics.js` (225줄): 원래 Newton/1PN/2PN/2.5PN 방정식, 원반 마찰, Schwarzschild 정확 휨각 적분과 LUT, 질량·스핀·QNM 피팅.
- `bbh-eob.js` (101줄): 원래 2PN EOB Hamiltonian, 선도 준원 복사 토크, RK4, 위치·속도 맞춤.
- `bbh-sim.js` (476줄): 원래 수치 적분·EOB 전환(208줄)·불가역 병합(157줄)·성분의 연속 융합과 회전(255–310줄)·고정 1/240초 GW 기록·링다운·이력 관리.
- `gravity-hero.js` (775줄): 원래 유입/퇴장·외력(324줄)·수치 시간/슬로모션/드래그 전개(353줄)·파형 소스 선택(403줄)·전체 광학 uniform 업로드(426줄)·프레임 제어(502줄)·원래 전체 GLSL 광학(628줄).

`home-background.js`의 adapter는 `GravityHero`를 상속합니다. `_step`, `_external`, `_advanceArrivals`, `_retireMerged`, `_stageInfo`, `_frame`와 수치 모듈을 대체하지 않습니다. 국소 가짜 원·단순 1/r 화면 변위·추가 발광 링 셰이더는 제거했습니다.

## 제한적으로 연결한 부분

1. `_program`: **최종 배경 UV 계산 한 문장**을 TIFF 조회로 연결하고 이미지 크기 uniform 하나를 추가합니다. 그 앞의 Schwarzschild LUT, 원래 구면 `skyDir`, 공유 capture/lensing field, 두 융합 성분·총질량 단극 연결, 지연시간 GW 변위를 원문 그대로 사용합니다. 원래 포획 경계와 렌즈 경계를 독립 마스크로 갈라놓지 않았습니다.
2. TIFF 조회는 원래 굴절 방향 `ns`를 화면 좌표로 역변환한 뒤 `cover × 1.6`, 가운데 정렬을 적용합니다. 변형되지 않은 광선은 정적 CSS TIFF와 정확히 정렬됩니다. 이 연결은 홍보용 TIFF의 화면 샘플링이며 TIFF를 천문측량 WCS로 바꾼 것이 아닙니다. TIFF는 평면 이미지이므로 텍스처 경계는 clamp이며 원래 CAR 파노라마의 반복 감기는 사용하지 않습니다.
3. 배경은 지정한 TIFF 변환 PNG **하나만** `Image`로 읽습니다. CSS 이미지 자원·캐시를 재사용하며 별도 fetch/blob/ImageBitmap을 만들지 않습니다. 실패 시 정적 TIFF를 남기고 원래 생성형 은하 fallback은 호출하지 않습니다.
4. `_bind`, `_kick`, `setActive`, `dispose`는 통합 앱의 숨김·화면 전환·동작 감소·웹GL 손실·자원 해제에 맞춥니다. 원래 드래그의 시간 보간과 EOB 성분 복원, `releasePlaced` 배치, 빈 곳 클릭 파동을 보존합니다. 유일한 자동 입력은 원래 모델의 외력입니다.
5. 숨겨진 홈은 첫 실제 크기까지 seed를 미룹니다. 이후 resize는 원래처럼 계와 파형 좌표를 평행이동하며 질량·c·시계·상대거리를 바꾸지 않습니다.

## 성능 선택

원래 모델의 렌즈와 중력파는 원거리 하늘에도 작용합니다. 유한 반지름의 scissor로 잘라 계산하면 원형과 달라지므로 **원래 전체장 1 draw call**을 복원했습니다. 원래 300만 렌더 픽셀 상한, 평상시30fps/상호작용 중 최대60fps, 고정 물리 샘플 간격과 해상도, 4096개 GW 기록을 유지합니다. 숨김·다른 화면·화면 밖·수동 멈춤에서는 계속 계산하지 않습니다. 시각적 충실도를 줄여 속도를 얻었다고 보고하지 않습니다.

## 실험 NR 파일

`bbh-nr.js` (871줄), `bbh-nr-id.js` (232줄)도 원본 그대로 포함했습니다. 그러나 원본 `CLAUDE.md`와 `HANDOFF_CODEX.md`의 현재 결정은 GPU BSSN 자격 검증 실패 때문에 메인에 연결하지 않는 것입니다. 원래 `canStart()`도 false(564줄)입니다. 통합 앱도 이를 강제로 켜지 않습니다. 현재 실시간 경로는 **PN → EOB → NR 피팅 잔해/링다운**이며 완전한 수치상대론·공통 지평선 계산·Kerr 렌즈라고 주장하지 않습니다.

## 검증

```sh
node --test tests/blackhole-original.test.js
node --test tests/home-background.test.js
```

- 원본 그대로 복사한52개 검사 통과: PN/Schwarzschild/EOB/초기자료, 16·32방향 포획, 불가역 병합, 지평선 성분 연속성, 렌즈 질량 전환, 시각 독립성, 파형·ringdown·retirement·새 유입 연속성.
- adapter8개 검사 통과: 원본 SHA256, 원문 광학 블록 완전 보존, TIFF/CSS 좌표 일치, 실제 원형 메서드 상속, 4096×1/240초 기록, 숨김 초기화/resize, 원형 드래그·EOB 복원, 파형 API와 수명주기 해제, 이미지 실패/로드 전 정리.
- CPU 검사는 실제 GPU 영상 검증과 구분합니다. 통합 화면의 실제 Chrome 검증은 루트 `docs/verification.md`에 기록합니다.

## 호출

원본 physics/eob/sim 다음에 `gravity-hero.js`를 classic defer script로 읽습니다. 실험 NR 파일은 메인 script에 추가하지 않습니다.

```js
const home = mountHomeBackground(canvas, TIFF_PNG_URL, {onStage});
// home.stage is original loudest-source info; home.sim and home.renderer expose original state.
home.setActive(true);
home.dispose();
```
