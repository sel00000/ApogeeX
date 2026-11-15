# 통합판 인수인계 (2026-11-14, Claude Code)

## 무엇인가
`한결/SPHEREx_TIME_3D`(Blink + 3D 시공간 + 변광·분광 실험실)를 바탕으로, 경보 TrueBlink 분석작업실의 아이디어(일부는 천구 엔진 코드)를 합친 앱입니다. 자세한 비교표는 `README.md`.

## 반드시 지킬 것
- 관측 영상은 SPHEREx만. 가짜 자료 금지, 실패는 그대로 표시, 모의 자료는 `?mock=1`만.
- 출처 배지 [SPHEREx 측정] [외부 카탈로그] [계산·모델]. 과장은 표시만, "과장됨 ×N" 배지.
- 소행성·AI 기능 없음. 경보·중선·지호 폴더는 수정하지 않음. TrueBlink 코드를 가져올 때는 원래 고지를 두고 `THIRD_PARTY_NOTICES.md`에 적음.
- 3D 좌표계와 SPHEREx 영상 연동(`src/lib/imageBridge.ts`, `Scene3D` 시선 모드)은 유지.

## 2026-11-15 추가: 실시간 천구·Gaia·영어
- `src/gl/SkyGlobe.ts`, `src/gl/globe/*`: TrueBlink 천구 엔진(그대로). `src/components/SkyPanel.tsx`가 감쌈(찾기·파장·고르기·대상 열기·영역 요청).
- `src/lib/sky.ts`: Gaia(VizieR 미러), Sesame, TAN 투영, 고유운동 이동, 102채널 파장표. `src/lib/catalogNet.ts`: TrueBlink 미러·타임아웃 도우미.
- `src/lib/i18n.ts`: `useL()('한국어', 'English')` 방식. 언어는 store `lang`, 주소 `?lang=en`. 데이터(meta.json)에 적힌 한국어 메모는 `dataText`, 경고는 TargetCard `WARN_EN`.
- store에 `lang`, `stage`('workbench'|'sky', 주소 `?view=sky`), `gaia` 추가.
- 테스트: `e2e/live-sky.spec.ts`(VizieR·Sesame는 저장한 실제 응답으로 대체), `src/lib/sky.test.ts`, `src/gl/globe/healpix.test.ts`.

## 구조 (새로 만든 파일)
| 파일 | 역할 |
|---|---|
| `src/App.tsx` | 상단 바(대상·검색·탐험/연구·링크 복사), 무대(영상+3D+시간 막대), 오른쪽 레일, 연구 모드 분석 탭 |
| `src/store.ts` | 공통 상태. 임무 단계가 움직이도록 `ui, view, det, zoom, coldK, showImage3d, tab`을 여기로 올림 |
| `src/components/BlinkViewer.tsx` | 두 줄 도구 막대 + 파장 눈금 + 영상/A−B/차가운 천체 필터, 설정·상세는 접기 |
| `src/components/SpectralRuler.tsx` | D1–D6를 실제 파장 폭으로 그린 검출기 선택기 |
| `src/components/Rail.tsx` | 전천 위치도, 임무 카드, 발견 목록, 안내 카드(LVF 그림, 인공물) |
| `src/components/AnalysisTabs.tsx` | 변광 분석실·분광 실험실(기존), 위치 측정(잔차 그래프+대상 카드), 자료 출처(관측 표·CSV) |
| `src/lib/cold.ts` | 차가운 천체 필터: 배경 중앙값 제거 후 D6 − k·D5, NaN 유지, 대상 잔존율(5σ 미만이면 표시 안 함) |
| `src/lib/findings.ts` | 발견 목록 계산(고유운동 맞춤, 같은 파장 밝기 변화, 흡수 띠) |
| `src/lib/missions.ts`, `applyStep.ts` | 대상별 임무와 단계 → 상태 적용 |
| `src/lib/urlState.ts` | `mode`, `tab`, `visit` 주소 저장·복원 |
| `src/theme.css` | 디자인 토큰과 새 레이아웃(기존 `index.css` 위에 덮어씀) |

## 검증 방법
```sh
npx tsc -b && npx vitest run && npx playwright test && npm run build
```
Playwright는 :5191에서 자체 개발 서버를 띄웁니다(기존 앱의 :5190과 겹치지 않게).

## 다음에 할 만한 것
- 차가운 천체 필터를 0.1° 분석 프레임(노출이 더 많음)으로도 볼 수 있게 선택지 추가.
- 발견 목록에 차가운 천체 필터 결과(관측별 잔존율) 추가.
- 통합 사이트(`/analysis/`)에서 이 앱을 여는 연결은 팀 합의 후에.
