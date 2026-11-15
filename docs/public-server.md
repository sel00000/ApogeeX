# 공개 Python 분석 서버 무료 테스트

이 저장소의 `Dockerfile`은 포털 정적 파일, Node 게이트웨이, 관측 Python 서비스, 소행성 분석과 3D 생성 코드를 하나의 Linux 이미지에 넣습니다. GitHub Pages는 계속 정적 화면을 제공할 수 있고, 사용자가 요청한 새 분석은 연결한 서버에서 실행합니다. 아직 클라우드 계정에 서비스를 생성하거나 실제 서버 주소를 확정한 상태는 아닙니다.

## Render에서 테스트

1. 소유자가 Render 계정에서 이 저장소를 연결하고 루트의 `render.yaml`을 Blueprint로 선택합니다. 정의된 서비스는 **Free 웹 서비스 1개**뿐입니다. 유료 플랜·디스크·데이터베이스를 추가하지 않습니다.
2. `SPHEREX_ALLOWED_ORIGINS`는 현재 GitHub 웹의 `https://jp-feynman.github.io`로 설정되어 있습니다. 다른 웹에서도 연결하려면 **정확한 HTTPS origin**을 쉼표로 구분하여 추가합니다. `/repository/` 같은 경로, `*`, HTTP 주소는 넣지 않습니다. Render 주소에서 포털 자체를 사용할 때에는 배정된 실제 도메인도 허용 목록에 추가합니다.
3. 최초 배포를 실행하고 `/api/health`를 확인합니다. `autoDeployTrigger: off`이므로 이후 배포도 직접 실행합니다. Node/Python 설치와 웹 빌드는 이미지 빌드 때 한 번 수행하고 서버 시작 시 다시 빌드하지 않습니다.
4. 실제 HTTPS 서버가 정상 동작한 뒤 `deployment/public.json`의 `apiBase`에 서버 origin을 설정하거나 Pages 빌드 환경의 `SPHEREX_API_BASE`로 지정하고 다시 빌드·배포합니다. API 주소에는 비밀키를 넣지 않습니다. 서버 주소가 없는 동안 기존 Pages의 API 주소는 비워 둡니다.
5. 브라우저에서 세션 발급, 작은 영역의 관측 분석, 소행성 분석, 취소, 결과 열기를 차례로 확인합니다. 실패한 작업을 성공 결과로 표시하지 않는지 함께 확인합니다.

Render는 [Dockerfile 배포](https://render.com/docs/docker)와 [Blueprint 설정](https://render.com/docs/blueprint-spec)을 지원합니다. 이 설정은 자동 유료 전환을 요청하지 않습니다. **무료 범위만 테스트하려면 사용량과 결제 설정을 확인하고, 초과 사용을 유료로 결제하는 선택을 하지 마세요.** 결제 수단이 연결된 계정의 대역폭·빌드 사용량은 별도 과금될 수 있습니다. [Render 무료 사용 정책](https://render.com/docs/free)

## 실행 범위와 제한

| 설정 | 의미 |
| --- | --- |
| `SPHEREX_PUBLIC_MODE=1` | 공개 API 모드를 명시적으로 켭니다. 생략하면 기존 로컬 요청 제한을 유지합니다. |
| `SPHEREX_ALLOWED_ORIGINS` | 공개 API를 연결할 HTTPS origin 허용 목록입니다. 쿠키나 영구 비밀키를 프런트에 넣지 않습니다. |
| `SPHEREX_MAX_FOV=0.1` | 무료 테스트에서는 관측 영역 너비를 최대 0.1도로 제한합니다. 초과 요청은 422 오류로 거절하며 영역을 임의로 자르지 않습니다. |
| `SPHEREX_JOB_TIMEOUT_SECONDS=1800` | 작업의 전체 실행 시간을 최대 30분으로 제한합니다. 시간 초과·취소 작업은 종료합니다. |
| `SPHEREX_MAX_RUNTIME_BYTES=536870912` | 임시 결과·캐시 파일 예산을 512 MiB로 설정합니다. 신규 작업과 실행 중 주기적으로 검사하여 초과 작업을 거절하거나 종료합니다. 이는 메모리 제한이나 파일시스템의 강제 quota가 아닙니다. |
| `SPHEREX_TRUST_PROXY=1` | Render의 프록시 뒤에서 세션 발급 제한에 전달된 클라이언트 주소를 사용합니다. 직접 인터넷에 노출하는 다른 환경에서는 프록시 구성을 검토하고 설정합니다. |
| `SPHEREX_PYTHON=/opt/venv/bin/python` | 이미지에 설치한 Python과 과학 의존성을 사용합니다. |

Python 작업은 관측·소행성·3D 생성 전체에서 한 번에 하나만 허용합니다. 영역 제한과 동시 실행 제한은 계산식을 단순화하거나 원래 노출 표본 수를 자동으로 줄이지 않습니다. 공개 데이터로 만든 결과 파일은 볼 수 있지만, 작업 상태·생성·취소에는 발급받은 세션이 필요합니다. 다른 세션이 만든 실행 중 작업을 취소할 수 없고 원본 캐시·SQLite 경로는 HTTP로 제공하지 않습니다. 세션은 익명 작업 소유권을 위한 토큰이며 로그인 계정이나 사용자별 영구 저장소가 아닙니다.

세션은 6시간 동안 유효합니다. 동일 접속 주소는 시간당 최대 12개 세션, 서버 전체는 시간당 최대 120개 세션을 발급하며 동시에 최대 256개를 보관합니다. 세션별 새 분석·3D 생성은 시간당 8회, 이름 조회는 120회로 제한됩니다. 공개 소행성 실행은 원본 컷아웃·HTTP 캐시·인구집단 모델 캐시도 작업별 디렉터리에 보관하고 완료 작업은 최대 8개·6시간 보관 후 정리합니다. 관측은 기존 게시 결과를 보존하면서 오래된 미사용 다운로드 캐시를 우선 정리합니다. 운영체제 임시 파일과 외부 서비스 사용량까지 이 파일 예산이 강제하는 것은 아닙니다.

**512 MB 메모리에서 모든 분석이 성공한다고 검증한 상태는 아닙니다.** Windows에서 데이터 처리 없이 import만 했을 때 관측 파이프라인은 약 111 MiB, 소행성은 약 197 MiB의 working set을 사용했습니다. Linux 컨테이너의 메모리 사용량은 다르며 FITS 배열·재투영·수치 계산에는 추가 메모리가 듭니다. 무료 인스턴스에서 실제 최대 사용량과 시간 초과를 먼저 측정해야 합니다. 용량 부족은 결과를 축소하거나 가짜 데이터로 대체해 숨기지 않습니다.

Render 무료 서비스는 15분간 들어오는 요청이 없으면 잠들 수 있고 다음 요청 때 다시 시작합니다. 재시작·재배포·sleep 시 새 결과, 실행 중 작업, 세션, 캐시는 사라질 수 있습니다. 중요한 결과는 받은 즉시 내려받으세요. 외부 아카이브로 보내는 대량 요청도 무료 서비스 중단 사유가 될 수 있으므로 짧은 시험을 순차적으로 진행합니다. [Render 무료 서비스 제한](https://render.com/docs/free)

## Docker 검증

Docker 엔진이 있는 환경에서 저장소 루트 기준으로 실행합니다.

```sh
docker build --pull -t spherex-sky-lab:test .
docker run --rm --name spherex-test --memory=512m --memory-swap=512m \
  -p 127.0.0.1:10000:10000 \
  -e SPHEREX_PUBLIC_MODE=1 \
  -e SPHEREX_ALLOWED_ORIGINS=https://example.org \
  -e SPHEREX_MAX_FOV=0.1 \
  -e SPHEREX_JOB_TIMEOUT_SECONDS=1800 \
  spherex-sky-lab:test
```

이 명령의 `example.org`는 검사 요청의 허용 origin 예시이며 실제 배포 주소가 아닙니다. localhost UI를 공개 모드로 여는 검증은 HTTPS 프록시와 실제 허용 origin을 사용합니다. 별도 터미널에서 `docker stats spherex-test`와 서버 로그를 관찰하고, 먼저 `curl http://127.0.0.1:10000/api/health` 및 `curl -H 'Origin: https://example.org' http://127.0.0.1:10000/api/session`을 확인합니다. 전체 이미지 빌드·실행·512 MB 실측은 로컬 Docker 엔진 또는 CI에서 수행해야 하며, 구성 파일 정적 검토만으로 이를 통과했다고 보지 않습니다.

런타임은 일반 사용자 UID 10001로 실행하고 `/app/var`에 생성물을 저장합니다. 이미지에는 원래 과학 requirements를 함께 설치하며 설치된 정확한 버전 목록은 `/opt/runtime-requirements.freeze`에 남습니다. 장기 운영 전에는 실제 통과한 Linux 의존성 버전을 고정한 별도 릴리스 검증이 필요합니다.
