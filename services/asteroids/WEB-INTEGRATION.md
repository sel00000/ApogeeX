# 소행성 분석의 웹 연결

과학 계산은 이 폴더의 Python 파이프라인이 수행합니다. 웹 API는
`services/gateway/asteroid-api.mjs`, 결과 변환은 `asteroid-export.mjs`가 담당합니다.
외부 천문 자료를 조회하는 새 분석에는 인터넷과 과학 Python 환경이 필요합니다.

## 데이터 위치

- `data/prepared/asteroids`: 팀원이 제공한 원본 저장 결과와 SQLite. 웹 빌드는 이 자료를 재분석하지 않습니다.
- `apps/asteroids/public/analysis-data`: 준비 결과의 웹용 JSON, CSV, 보고서, 그림.
- `var/jobs/asteroids/<runId>/outputs/<objectId>`: 새 분석의 독립 원본 결과.
- `var/jobs/asteroids/<runId>/asteroids.sqlite`: 해당 분석만 담은 데이터베이스.
- `var/jobs/asteroids/<runId>/web`: 검증한 웹용 결과.
- `var/jobs/asteroids/<runId>/scene`: 별도 3D 자료 생성이 완료된 경우에만 공개하는 장면 자료.
- CLI 기본 출력은 `var/outputs/asteroids`, HTTP 캐시는 `var/cache/asteroids/http`입니다.

가상환경 선택 순서는 `SPHEREX_PYTHON`, 루트 `.venv-science`, 기존 `.venv-asteroid`, 시스템 Python입니다.
환경 확인은 과학 모듈을 import하며 분석·외부 조회를 시작하지 않습니다.

## API 계약

기본 prefix는 `/api/asteroid-analysis`입니다. 현재 API는 로컬·동일 출처 요청만 허용합니다.
공개 서버로 바꾸려면 인증·작업 소유권·서비스 제한을 갖춘 배포 어댑터를 별도로 제공해야 하며,
현재 로컬 확인을 삭제해서 공개하지 않습니다.

| 요청 | 동작 |
| --- | --- |
| `GET /capabilities` | 사용 가능 여부, 영상 수 제한, 실행 중 분석 ID |
| `POST /jobs` | `{target,start,end,maxImages}`로 새 분석. 날짜는 YYYY-MM-DD, 종료일은 시작일 이후 |
| `GET /jobs/<id>` | 상태, 로그, 완료된 경우 resultUrl, 독립 scene 상태 |
| `DELETE /jobs/<id>` | 실행 중 분석과 3D 준비 취소 |
| `POST /jobs/<id>/scene` | 완료된 원본 분석에서 3D 자료 준비 |
| `DELETE /jobs/<id>/scene` | 3D 준비만 취소. 과학 결과는 유지 |

분석 상태는 `queued`, `running`, `completed`, `failed`, `no_data`, `cancelled`입니다.
`no_data`는 관측 없음이며 외부 서버 장애인 `failed`와 다릅니다. 빈 결과를 성공으로 발표하지 않습니다.
장면 상태는 `not_started`, `running`, `completed`, `failed`, `cancelled`이며,
완료된 장면에만 자료 디렉터리 URL이 생깁니다. 현재 작업 상태는 서버 수명 동안 유지됩니다.

## 결과 해석

호환 schema 이름 `spherex-asteroid-web-1`을 유지하며 `schemaVersion: 2`를 추가했습니다.
원본 `record`는 보존합니다. `id`는 웹 파일 식별자, `objectId`는 원본 천체 식별자,
`numberedId`는 공식 이름에서 확인되는 번호, `runId`는 실행/저장 결과 식별자입니다.
별칭은 `aliases`에 명시하며 원래 과학 기록의 ID를 덮어쓰지 않습니다.

새 분석의 `run` 메타데이터에는 요청 조건, 코드·설정·입력 파일 해시가 있습니다.
`Complete`는 필드 완전성, `confidence`는 결과 신뢰도입니다. 둘을 성공 판정 하나로 합치지 않습니다.
열모델·통계·결합·카탈로그 지름과 보류된 밀도를 각각 표시해야 합니다.
스펙트럼 단위는 μJy, 파장은 μm, 관측 시간은 MJD UTC입니다.
관측의 예측 RA/Dec는 그 노출 시각의 방향이며 현재 위치나 3D 궤도 자체가 아닙니다.

3D 생성은 `apps/asteroids/scripts/generate-scene.mjs`를 호출합니다. 입력 원본 디렉터리와 DB 경로를
각각 전달하며, 웹용으로 이름을 바꾼 CSV를 다시 과학 원본으로 사용하지 않습니다.
생성 실패·취소는 이미 완료된 스펙트럼 분석을 무효화하지 않습니다.
