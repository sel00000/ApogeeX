# 국가·지역별 수도와 사용자 관측 위치

관측 위치 목록의 수도 좌표는 국가의 중심점이 아닌 **도시의 WGS84 위도·경도**입니다. 데이터는 애플리케이션의 `src/capitals.js`에 포함되어 있으며 사용 중 외부 API를 호출하지 않습니다.

## 포함 범위

- 2026-11-14에 생성한 스냅샷: **243개 국가·지역 코드, 253개 관측 위치**.
- UN 회원국 193개와 바티칸·팔레스타인을 합친 195개 코드에 적어도 한 위치가 있는지 생성 스크립트가 검사합니다. 그 밖의 속령·지역도 포함하므로 UI에서 ‘국가·지역’이라고 표기합니다.
- GeoNames의 `PPLC`(국가 또는 정치 단위의 수도) 도시 241개를 기본으로 삼고, 아래의 여러 수도·정부 소재지를 추가했습니다.
- 252개 도시에는 한국어 이름이 있으며, 새 수도 Ciudad de la Paz는 원문을 사용합니다. 한국어 국가명은 Node.js의 `Intl.DisplayNames('ko')`를 이용해 빌드 때 확정했습니다. 대한민국·북한·팔레스타인·콩고 두 나라의 표기는 별도로 정리했습니다.
- 도시 좌표는 대표 지점입니다. 특정 관측소나 사용자의 실제 위치가 필요하면 ‘사용자 위치’에서 직접 입력하세요. 고도 정보는 이 UI에서 제공하지 않으므로 목록의 `elevation`은 0 m입니다.

수도 지위가 없거나 자료에서 대표 지점을 찾지 못한 일부 무인 지역, 서사하라 등은 포함하지 않습니다. 수도·행정기관 소재지가 분리되거나 이전 중인 곳은 하나의 ‘유일한 수도’라고 해석하지 않도록 이름 뒤에 역할을 표시했습니다. 국가·지역 코드와 지명은 관측 위치 선택을 위한 것으로 주권이나 경계에 관한 판단을 뜻하지 않습니다.

## 자료와 라이선스

1. **GeoNames geographical database**, [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
   - [cities15000.zip](https://download.geonames.org/export/dump/cities15000.zip): 도시 좌표, 영문 이름, GeoNames ID와 국가 코드.
   - [countryInfo.txt](https://download.geonames.org/export/dump/countryInfo.txt): 국가 코드·수도 명칭 확인.
   - [덤프 형식과 라이선스](https://download.geonames.org/export/dump/readme.txt), [지형 분류 코드](https://www.geonames.org/export/codes.html).
   - 이 배포본은 원자료에서 수도를 추출하고 추가 행정 중심지를 선별했으며, 한국어 이름과 UI 필드로 재구성한 **수정 데이터**입니다. GeoNames가 이 애플리케이션을 보증하거나 승인한다는 뜻은 아닙니다.
2. **Natural Earth 10m populated places**, public domain.
   - [공식 자료 설명](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/), [이용 조건](https://www.naturalearthdata.com/about/terms-of-use/).
   - [고정 원본 GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_populated_places.geojson).
   - `GEONAMESID`가 일치하는 `NAME_KO`를 한국어 도시명에 사용했습니다. 없는 경우 GeoNames의 한글 대체 이름 또는 원문을 사용합니다. 일부 널리 쓰이는 한국어 표기를 정리했습니다.
   - 원본 commit: `ca96624a56bd078437bca8184e78163e5039ad19`.

원본 파일 SHA256과 레코드 수는 `src/capitals.js`의 `capitalSource`에 기록했습니다. 웹 배포 시 이 문서와 GeoNames 출처·라이선스 링크를 유지하세요. 애플리케이션 코드의 AGPL 라이선스와 별도로 원자료의 CC BY 4.0 조건이 적용됩니다.

## 추가한 수도·행정 중심지

원자료의 `PPLC`에 없는 다음 도시를 동일 GeoNames 도시 레코드의 좌표로 추가했습니다.

| 국가·지역 | 추가 위치와 역할 |
| --- | --- |
| 남아프리카공화국 | 케이프타운(입법 수도), 블룸폰테인(사법 수도). 프리토리아는 행정 수도로 표기 |
| 볼리비아 | 라파스(정부 소재지). 수크레는 헌법상 수도로 표기 |
| 네덜란드 | 헤이그(정부 소재지); 암스테르담과 별개 선택 |
| 말레이시아 | 푸트라자야(행정중심지); 쿠알라룸푸르와 별개 선택 |
| 에스와티니 | 로밤바(왕실·입법 중심지); 음바바네와 별개 선택 |
| 스리랑카 | 스리자야와르데네푸라코테(입법 수도). 콜롬보는 행정·상업 중심지로 표기 |
| 베냉 | 코토누(정부 소재지); 포르토노보와 별개 선택 |
| 몬트세랫 | 브레이즈(정부 소재지); GeoNames가 보존한 플리머스 수도 지점과 별개 선택 |
| 이스라엘 | 예루살렘(정부 소재지) |
| 팔레스타인 | 동예루살렘(수도 주장), 라말라(행정중심지) |

GeoNames의 모든 `PPLG` 또는 Natural Earth의 모든 `CAPALT`를 기계적으로 추가하지 않습니다. 후자에는 교토·라고스 등 과거 수도도 포함되어 있기 때문입니다. 남아공의 세 수도는 [남아공 정부 안내](https://www.gov.za/about-sa/south-africa-glance)로 확인했습니다.

적도기니는 과거 말라보 대신 GeoNames의 **Ciudad de la Paz**를 사용합니다. [적도기니 정부의 2026-01-02 발표](https://www.guineaecuatorialpress.com/index.php/noticias/el_presidente_de_la_republica_proclama_la_ciudad_de_la_paz_como_capital_de_la_republica_de_guinea_ecuatorial_con_la_firma_de_un_decreto_ley)와 일치합니다. 인도네시아는 스냅샷의 `PPLC`인 자카르타를 유지했습니다. [IKN 공식 설명](https://ikn.go.id/id/posts/perpres-nomor-79-tahun-2025-pertegas-kepastian-kelanjutan-dan-penyelesaian-ibu-kota-nusantara)은 누산타라의 정치 수도 기능 목표 시점을 2028년으로 안내합니다. 이전·분쟁·임시 소재지 상황을 실시간으로 갱신하는 서비스는 아닙니다.

## 데이터 다시 생성

Python 3.9 이상과 Node.js가 필요합니다. 프로젝트 루트에서 다음을 실행합니다.

```powershell
python scripts/build-capitals.py --refresh
npm run build
```

`--refresh` 없이 실행하면 `research/`의 내려받은 원본을 재사용하며, 원본이 없으면 내려받습니다. `--snapshot-date YYYY-MM-DD`로 기록 날짜를 명시할 수 있습니다. 원본 캐시는 개발·재생성용이며 웹 배포에는 필요 없습니다. 생성 과정에서 모든 위도·경도의 범위, ID 중복, 195개 국가 코드의 포함 여부를 검사합니다. 새 스냅샷을 배포하기 전에는 변경된 수도 지위와 한국어 표기를 검토하세요.
