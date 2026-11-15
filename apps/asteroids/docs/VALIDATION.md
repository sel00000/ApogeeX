# 검증 기록 — 2026-11-15

## 실제 번들

- 태양 + 8행성 + 19개 소행성. 27개 이동 천체의 Horizons VECTORS.
- 기존 팀 자료 기준: `4788045740f66dfd69f1b19e158f898f563df82f`.
- 관측 5,550행, 실제 IRSA FITS에서 준비한 53개 cutout 이미지. 17개 대상에 준비 영상이 있음. Eos 및 Otila는 영상 미준비 상태를 표시.
- UI 범위: 2025-04-25~2026-09-05 UTC, 정확한 중간 시각 경계는 manifest.
- 배포 데이터 약 5MB. 브라우저는 원본 FITS를 읽지 않음.
- 첫 준비 도중 IRSA 503이 한 번 발생했으며 재생성에서 회복. 최종 manifest warnings는 빈 배열.

## 수치 검사

- 27개 천체에서 각각 5개 추가 중간 시각을 JPL에서 독립 조회. 하루 간격 위치/속도의 Hermite 보간과 비교한 최대 위치 오차 `1.3383961715713973e-7 AU` (약 20km). 이 값은 시각화 보간 오차이며 JPL 궤도 해 자체의 절대 오차 추정이 아님.
- 53개 영상 모두 FITS `RADESYS=ICRS`, `TIMESYS=UTC`, `MJD-AVG`와 목록 노출 중간 시각 차이 <0.01초 검사.
- 영상마다 SPHEREx 관측자 `500@-163182`, UTC 중간 시각, Horizons quantity 1 (astrometric ICRF RA/Dec)을 다시 조회. 가져온 예측과 독립 좌표 투영의 최대 차이 `1.1119813283909933e-6 pixel`.
- 이 수치는 예측 두 개의 일관성 검사이며 사진에서 측정한 신호와의 잔차가 0이라는 뜻이 아님. 실제 잔차는 각 영상 카드에 별도 표시.
- 영상 WCS에는 SIP 계수를 포함한 전체 celestial header 보존. 화면은 FITS y축을 뒤집고 픽셀 중심 0.5 보정을 적용.
- 실제 SPHEREx 우주선 벡터 53개 촬영 시각에서 조회. 저궤도 우주선의 하루 간격 위치를 보간하지 않음.

## 테스트

- `npm test`: 10개 통과 (보간/범위/시간/좌표/seed/일시 오류 재시도/선택 취소).
- Python unittest: 3개 통과 (전체 실제 번들, 요청별 이미지 이름 독립성).
- 타입 검사 및 프로덕션 빌드 통과.
- Playwright CLI `tests/browser-check.js`: 실제 배포 빌드(8710)에서 선택·재생·시점 전환·자료 없는 대상·품질 사유·19개 대상 순회·100회 급속 전환·축소 모션·390px 모바일 검사 통과. JavaScript pageerror 0.
- 모바일 가로 넘침을 실제로 발견하여 `minmax(0,1fr)` 및 grid child min-width 수정 후 통과.
- 급속 전환에서 발생한 일시 연결 초기화는 현재 선택만 최대 3회 재시도하도록 수정. 취소한 선택은 재시도하지 않는 회귀 테스트 통과.
- 독립 코드 리뷰의 중요 4항목(독립 관측자 검증, 자료 없는 시점, 품질 사유 표시, cutout 파일 충돌)을 반영.

## 성능 — 이 컴퓨터의 Headless Chrome 157

화면 1440×960, 240 프레임 검사. 다른 장비나 실제 1,000개 서로 다른 궤도 데이터 다운로드 비용에 대한 보장이 아님.

| 검사 | 프레임 중앙값 | 프레임 p95 | CPU draw p95 |
|---|---:|---:|---:|
| 실제 대상 재생 | 16.7ms | 16.7ms | 1.1ms |
| 1,000개 암석 fixture | 16.7ms | 16.7ms | 2.0ms |

1,000개 fixture는 실제 궤도를 복제한 렌더링 부하 검사 전용이며 제품 목록에 포함하지 않음. 실제 화면에서 100회 전환 후 이미지 캐시는 8장 / 156,800바이트, geometry 17개로 안정적. 정지 후 예약 프레임 없음. 최초 초기화 프레임 CPU draw는 약 40.9ms로, 정상 재생과 구분.

숨김 탭 검사는 Headless Chrome에서 실제 `document.hidden`이 false로 유지되어, 숨김 이벤트 핸들러를 명시적으로 호출해 렌더 예약 중단을 검증했습니다. 실제 탭 숨김 상태에서의 자동 중단을 이 환경에서 검증한 것은 아닙니다.

원본 검사 결과: `browser-result.txt`, `stress-result.txt`, `visibility-result.txt`. 스크린샷: `preview-desktop.png`, `preview-observer.png`, `preview-mobile.png`.

## 범위와 남은 제한

- 모든 5,550개 관측 영상을 내려받지 않음. 각 대상의 대표 GOOD/SNR≥5 영상 최대 3장(Eros 8장)만 준비.
- 모든 측광 위치를 후보로 표시하며 자동으로 검출 확정하지 않음. 실제 형상/크기/성분 분석 없음.
- 3D 관측 카메라와 사진을 연결하지만 실제 이미지 위의 정밀 중첩은 WCS 예측 십자/후보 원으로 표현. 확대 암석 실루엣과 PSF를 일치시키는 기능이 아님.
- 기간 밖 재생·새 천체 추가는 데이터 재생성 필요. 원격 실시간 조회 앱이 아님.
- 최초 다운로드/셰이더 준비 및 기기별 성능 차이는 존재. 저사양 실제 휴대폰 GPU와 Safari는 이번에 직접 성능 측정하지 않음.
- Three.js를 포함한 JS 번들은 압축 전 약 589KB / gzip 약 149KB. Vite 기본 500KB 경고는 남지만 타입/빌드 오류는 없음.
- 기존 통합 사이트를 변경하지 않은 독립 앱. 로컬 브랜치로 보관하며 기본 브랜치 병합/공개 배포는 하지 않음.

## Correction verification — 2026-11-15

Supersedes original crosshair-only comparison and initial reference-path description above.

- Data: 14 common-sky sequences, 58 native ePSF comparison atlases. Eros: 6 frames over ~102 minutes, predicted displacement 19.7 pixels. Source FITS and independent Horizons responses preserved through hashes and parameters in sequences/comparisons JSON.
- Registration: fixed ICRS TAN WCS 128×128 at 6.15 arcsec/pixel; common valid footprint >=75%. Eros background correlation over integer shifts [-2,2] peaks at (0,0) in all five comparisons, excluding a 12-pixel radius around the asteroid's path. This checks pixel-scale registration, not a claim of zero sub-pixel residual. Background brightness/noise varies.
- Real/model atlas uses native detector-zone ePSF, subpixel sampling, fixed JPL coordinates, variance-weighted amplitude/background fit. No recentering or trail convolution. Reduced chi-square is shown; high values can indicate inadequate model, contamination or variance mismatch.
- Three IRSA 503 failures omitted individual frames; Undina common footprint 72.56% rejected. Final sequences still require >=3 successful model frames. No fabricated background or interpolation between observed photos.
- 13 JavaScript math/image/orbit tests and 5 Python data/registration tests pass. TypeScript and production build pass; Three bundle-size warning remains (~594 kB uncompressed, ~150 kB gzip).
- Browser correction check covers distinct photo/model/blend pixels, actual movement within the fixed canvas, observation playback, ordinary playback, bounded cache, rapid target switches, and mobile layout. Three review race regressions reproduced failing before fixes, passing after. Stop-during-image-load retains the committed frame.
- Per-frame decoded atlas cache bounded at 8, max 1 MiB for these sequences. Large central view mirrors the existing canvas; no second WebGL renderer. Reference paths batched into two LineSegments.
- Current measurements and screenshots: `correction-browser-result.txt`, `correction-races-result.txt`, `correction-stress-result.txt`, `correction-system.png`, `correction-overlay.png`, `correction-mobile.png`. Cold initialization is separate from steady-state animation and is not claimed hitch-free on every device.

Final production browser pass: all 14 sequences / 58 atlases loaded and committed with matching observation IDs, cache <=8. Real 19-object steady playback frame p95 16.7 ms, CPU draw p95 1.6 ms; 1,000-object synthetic fixture frame p95 16.8 ms, CPU draw p95 1.9 ms. Headless Chromium on this host, 1440×960 viewport. First initialization draw ~67 ms; these measurements do not guarantee zero stalls on every device.

## 3D observer camera and switchable photograph — 2026-11-15

This supersedes the preceding central-canvas mirroring design. There is one Three renderer and a calibrated textured image plane, with a separate right-side ePSF comparison canvas.

- 111 FITS WCS footprints (including original SIP distortion) baked to 16×16 triangle grids; Astropy check at441 interior positions each: maximum mesh interpolation error 0.00006876 image pixels. No network call or WCS solve during playback.
- Existing main 3D camera flies for1.1 seconds from the user's arbitrary pose to actual exposure spacecraft position. Quaternion and logarithmic FOV interpolation; shader preparation before enabling observer entry. Motion-reduction preference is honored.
- Camera direction/up and angular image dimensions derive from the selected image WCS. Fixed-star sequences use their reprojected north-up cutout field, not an assertion of full-detector hardware attitude. Plane depth is illustrative (0.97 times geometric target range); angular ray mapping is calibrated.
- Selected observer rock direction uses independent Horizons astrometric ICRF coordinates, converted to J2000 ecliptic scene axes; light-time correction is not discarded. Rock angular size/shape remain explanatory, with ePSF retained in the separate comparison panel.
- All17 prepared objects /64 UI frames tested at their actual spacecraft positions. Max actual instance-matrix center versus calibrated photo-plane point:0.00634 CSS screen pixels at1440×960. Max WCS triangle/predicted direction difference:0.0000145 source pixels. Neither number is a claim of independently measured asteroid centroid accuracy.
- Photo off/on changes neither camera position nor FOV. Next exposure preserves registration. Return-to-free restores the previous camera position. Observer→catalog selection returns to45° FOV and permits drag; no stranded disabled controls.
- Follow-view flight at30 days/second ends with moving target at center. Desktop and390px mobile tested; reduced motion tested in the all-frame loop. Image geometry count stays bounded at20 in the all-frame test; texture count2 (photo + default Three texture).
- Regression evidence: `observer-flight-result.txt`, `observer-alignment-result.txt`, `follow-flight-result.txt`; screenshots `observer-photo-on.png`, `observer-photo-off.png`, `observer-mobile.png`. JS15 / Python5 tests and production build pass. Bundle~602kB uncompressed /152kB gzip; existing bundle-size advisory remains.
- Local server sends no-store headers so a rebuilt page is not mistaken for a cached prior implementation.

## Movement circles — 2026-11-15

- Prepared exposure positions reprojected independently into every current image WCS, including SIP. No copying another cutout's centered pixel coordinates, no edge clamping. 111 image trail definitions cover 17 objects; 64 frames exposed by the UI use the matching trails. The two catalogue objects without prepared images remain unavailable for photographic trails.
- Earlier/current/later prepared exposures use gold/mint/gray outline circles. Future here means a later recorded exposure, not a forecast. Overlapping positions are not displaced for readability. Number labels are suppressed for crowded noncurrent rings.
- Ring centers remain transparent to protect the source signal. Connecting segments stop outside circles. Central overlay shares the calibrated photo geometry and renders above the image independently of photo opacity. One 512×512 RGBA texture added, bounded at ~1 MiB; no per-circle Three meshes.
- JS 17 tests and Python 6 tests pass, including current-point alignment and independently inverted sky coordinates for all in-frame trail points. Browser check covers Hesperia at photo opacity 1, source-core preservation, shared visibility toggle, all 17 objects / 64 frames, missing-image handling, and mobile layout. Evidence: `movement-browser-result.txt`, `movement-hesperia.png`, `movement-eros.png`.

## Jiho catalogue refresh — 2026-11-15

- Read the immutable Jiho inputs at repository commit `324e485b579c78e776c088a7ba5fc0a2f3455ae3`, without modifying the shared Jiho checkout. Added 64 Angelina, 216 Kleopatra, 596 Scheila, 2566 Kirghizia, and 35107 (1991 VH). Kept the provisional designation for the unnamed numbered object.
- Bundle: 24 asteroids, 8 planets, 7,488 observation rows, 71 individual prepared FITS cutouts, 22 fixed-sky sequences / 96 frames. The UI prefers the sequences and also offers Hygiea's 2 individual images: 23 photo targets / 98 reachable frames. Otila remains orbit-only because no quality-verified images are prepared. The added targets have 6, 5, 5, 3, and 2 sequence frames respectively.
- All body tracks cover the expanded observation interval. Five independently queried midpoint checks per body give a maximum interpolation error of `1.3251383049760495e-7 AU`. Independent spacecraft-observer astrometry checks for all 71 cutouts differ from imported positions by at most `2.091622422076121e-6` source pixels.
- Registration now retains the largest valid common-footprint subset, requiring at least 75% common coverage and valid target locations. It retries other candidate visits when necessary; a real two-frame comparison is supported without lowering GOOD / SNR ≥ 5. Sub-ms timestamp differences no longer choose between otherwise equivalent motion: shorter-wavelength detectors win ties. This selected D2 for Kleopatra, whose D5 background was much less distinct. Added-target background cross-correlations peak at zero integer translation; each exceeds 0.3 after masking asteroid locations. No synthetic replacement background or centroid shifting is used.
- All 167 individual/atlas image planes and motion trails pass WCS and inverse-coordinate checks. The maximum independently sampled image-mesh error is `0.0000688` source pixels. Two transient individual-image IRSA failures remain accurately recorded in the manifest; neither is exposed as a prepared image, and every added target has verified photos and a working sequence.
- Fresh Python 10 / JavaScript 17 tests and production build pass. The existing ~606 kB JS bundle-size advisory remains; application JS is unchanged by this data update.
- Browser coverage: every one of the 98 reachable frames, all five new targets' photo toggles, photo/model/blend modes, motion playback, current-trail identity, exact spacecraft camera location, and 390px mobile layout. Maximum calibrated image/instance screen discrepancy: `0.00809 CSS px` at 1440×960; maximum direction/plane discrepancy: `0.0000145` source pixels. These are computational registration checks, not independent measured-centroid error claims.
- In this browser run, median animation interval was 16.7 ms and p95 was 16.8 ms; draw work p95 was 1 ms. Resource maxima stayed at 20 geometries, 3 textures, and 8 cached images across all targets. Paused rendering stopped. No JavaScript errors or runtime JPL/IRSA requests were observed. Evidence: `jiho-browser-result.txt`, `../output/playwright/jiho-216.png`, `../output/playwright/jiho-35107.png`.
