// Original educational copy for SPHEREx Sky Lab. Character artwork is supplied by the project owner.
export const TUTORIAL_NOTE = '캐릭터 대사는 교육을 위해 새로 쓴 해설이며 실제 발언의 인용이 아닙니다. 연습 그림은 설명용 가상 자료입니다.';

export const CHARACTERS = {
  spherex: { id: 'spherex', name: '스피어엑스', role: '적외선 하늘 길잡이', image: 'assets/spherex.png' },
  feynman: { id: 'feynman', name: '리처드 파인만', role: '차근차근 실험해 보기', image: 'assets/feynman.png' },
  doppler: { id: 'doppler', name: '크리스티안 요한 도플러', role: '파장과 빛 읽기', image: 'assets/doppler.png' },
  einstein: { id: 'einstein', name: '알베르트 아인슈타인', role: '좌표와 측정 생각하기', image: 'assets/einstein.png' },
  kepler: { id: 'kepler', name: '요하네스 케플러', role: '시간과 움직임 살피기', image: 'assets/kepler.png' },
  sagan: { id: 'sagan', name: '칼 세이건', role: '발견을 신중하게 해석하기', image: 'assets/sagan.png' },
};

export const TRACKS = {
  beginner: { id: 'beginner', label: '일반인용', description: '처음 만나는 하늘 지도부터, 빛의 그래프를 읽는 법까지. 어려운 수식 없이 시작해요.' },
  research: { id: 'research', label: '연구자용', description: '좌표·원본 픽셀·파장 응답·오차와 재현 가능한 분석 절차를 확인합니다.' },
};

export const REFERENCES = {
  mission: { title: 'SPHEREx 공식 안내 · 관측 범위와 102개 채널', url: 'https://spherex.caltech.edu/page/possible-use' },
  products: { title: 'IRSA · SPHEREx 데이터와 보정 자료', url: 'https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/' },
  intro: { title: 'IRSA · 영상·FLAGS·VARIANCE 읽기', url: 'https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/' },
  psf: { title: 'IRSA · 위치별 ePSF 사용법', url: 'https://caltech-ipac.github.io/irsa-tutorials/spherex-psf/' },
  mosaic: { title: 'IRSA · 파장별 모자이크와 측광', url: 'https://caltech-ipac.github.io/irsa-tutorials/spherex-mosaic/' },
  source: { title: 'IRSA · 천체 위치에서 스펙트럼 추출', url: 'https://caltech-ipac.github.io/irsa-tutorials/spherex-source-discovery-tool-demo/' },
  release: { title: 'IRSA · 데이터 릴리스 확인', url: 'https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-releases/' },
};


const question=(question,choices,answer,explanation)=>({question,choices,answer,explanation});
const practice=(page,selector,label,extra={})=>({page,selector,label,requires:page==='planetarium'?['panel']:[],hint:'사용할 수 없는 도구는 화면의 준비 상태를 확인하세요. 실습하지 않고 안내를 계속 볼 수도 있어요.',...extra});
const research=(tab,label)=>practice('analysis',`[data-testid="atab-${tab}"]`,`${label} · 준비 예제로 열기`,{requires:['research','prepared','field'],tab,params:{target:tab==='variable'?'rw_aur':'eps_indi_b',mode:'research',tab},hint:'이 실습은 품질이 확인된 준비 예제를 엽니다. 임의 좌표 영역에서는 연구 탭이 지원되지 않을 수 있어요.'});
const sky=(selector,label)=>practice('planetarium',selector,label);
const analysis=(name,label)=>practice('analysis',`[data-tutorial="analysis-${name}"]`,label,{requires:name==='status'?[]:['field']});
const asteroid=(name,label)=>practice('asteroids',`[data-tutorial="asteroid-${name}"]`,label);
const step=(title,character,body,visual,practice,check)=>({title,character,body,visual,...(practice?{practice}:{}),...(check?{check}:{})});
export const MODULES=[
{id:'sky',title:'하늘 탐색',description:'검색, 별 정보, 좌표·시간과 네모 영역 선택',minutes:{beginner:3,research:4},steps:{
beginner:[
step('하나의 메뉴에서 하늘로 출발해요','spherex',['상단 메뉴에서 천구 관찰, SPHEREx 분석, 소행성 분석으로 이동해요. 홈에서는 SPHEREx 임무와 적외선 이야기를 둘러볼 수 있어요.','상단 검색으로 별이나 천체를 찾으세요. 후보가 여러 개면 대상을 확인한 뒤 열어요. 튜토리얼은 언제든 건너뛰고 필요한 주제만 다시 볼 수 있습니다.'],'sky',practice('home','#search-open','상단 검색으로 천체 찾기')),
step('별 정보 보기와 자료 분석은 달라요','feynman',['천구에서 별이나 별자리를 단순 클릭하면 대상의 정보를 볼 수 있어요. 하늘을 드래그하면 바라보는 방향이 바뀝니다.','SPHEREx 자료를 보고 싶으면 분석 버튼으로 네모 영역 선택을 켜고 원하는 곳을 클릭해요. 네모는 분석할 하늘의 범위이며, 별이 없어 보이는 곳에도 관측 자료가 있을 수 있어요.'],'region',sky('#analysis-pick','스피어x 데이터 분석 버튼과 영역 선택 확인하기')),
step('하늘 주소와 지구의 위치를 구별해요','einstein',['위도·경도는 지구에서 관측하는 장소이고, 적경·적위는 하늘에서 대상을 찾는 주소예요.','지평 좌표와 적도 좌표 표시를 바꾸어도 별이 다른 곳으로 이동한 것은 아니에요. 같은 하늘을 다른 기준으로 읽는 것입니다.'],'sky',sky('#coordinate-system','좌표 표시 방식 비교하기'),question('적경·적위는 무엇을 나타내나요?',['하늘에서의 방향','지구의 관측 장소'],0,'지구의 장소는 위도·경도, 천구 방향은 적경·적위로 구별합니다.')),
step('천구의 시계와 관측 사진의 날짜는 달라요','kepler',['시간 조절은 그 시각의 하늘을 계산합니다. 현재 시각 버튼으로 돌아오고 시간 배속을 바꿀 수 있어요.','시계를 바꾼다고 SPHEREx가 그날 새 사진을 찍는 것은 아니에요. 분석 화면에서는 실제 저장된 관측 시각을 따로 확인합니다.'],'timeline',sky('#time-now','현재 시각으로 돌아가는 버튼 찾기'))],
research:[
step('좌표계·기준 시점·관측자를 함께 기록합니다','einstein',['적경·적위 숫자만으로 분석 방향을 완전히 정의할 수 없습니다. 좌표계, 기준 시점, 고유운동 적용 여부와 관측자를 확인합니다.','카탈로그 위치와 특정 시각의 겉보기 위치를 그대로 비교하지 마세요. 고유운동이 큰 별은 관측 epoch에 맞춘 위치 대조가 필요합니다.'],'sky',sky('#coordinate-system','천구 좌표와 대상 정보 확인하기')),
step('분석 중심과 영역 크기를 확인합니다','feynman',['네모 선택은 중심 좌표와 각크기를 전달합니다. 화면 픽셀 크기, 하늘의 각도와 FITS 픽셀 크기를 구분합니다.','경계와 극지방에서는 투영을 고려합니다. 관측 영상의 WCS와 실제 별의 위치를 대조하고 유효 범위 밖의 값은 측정에서 제외합니다.'],'region',sky('#analysis-pick','영역 선택과 전달할 좌표 확인하기')),
step('이동 천체에는 시각별 위치가 필요합니다','kepler',['이름만 확인된 이동 천체 검색 결과는 고정 좌표로 바로 분석할 수 없습니다. 천체 식별자, 촬영 시각과 SPHEREx 관측자 기준 예측 위치를 연결합니다.','일반 영역 조회는 고정 좌표의 아카이브 조회입니다. 시간별 이동 추적이나 소행성 검출 확정 결과와 구분하세요.'],'timeline',practice('home','#search-open','검색 결과의 대상 종류 확인하기')),
step('화면의 시간과 관측 출처를 분리해 보관합니다','sagan',['천구 시뮬레이션의 시각, 자료 촬영 시각과 위치 예측 시각은 역할이 다릅니다. 시간대와 UTC/TDB 등 시간척도도 확인합니다.','공유 링크는 화면 재현에 편리하지만 원본 자료 전체의 보관을 대신하지 않습니다. 자료 출처와 처리 조건을 별도로 남기세요.'],'provenance',sky('#time-now','천구 시간과 실제 관측 시각 구별하기'))]}},
{id:'analysis',title:'SPHEREx 분석 도구',description:'자료 준비, 날짜 비교, 차영상과 연구 탭',minutes:{beginner:4,research:5},steps:{
beginner:[
step('준비된 대상부터 살펴봐요','spherex',['추천 대상에는 미리 준비한 관측 영상과 연구 자료가 있어요. 먼저 하나를 골라 날짜와 자료 상태를 읽어 보세요.','임의 좌표는 서버에서 자료를 준비합니다. 준비 중, 자료 없음과 불러오기 실패는 달라요. 임의 영역에는 추천 대상의 모든 연구 도구가 제공되지 않을 수 있습니다.'],'provenance',analysis('status','대상과 자료 준비 상태 확인하기')),
step('날짜를 바꾸어 비교해요','kepler',['타임라인으로 관측 날짜를 바꾸고 재생하면 준비된 영상이 순서대로 바뀝니다. 실제 관측 간격은 일정하지 않을 수 있어요.','3D 시공간 화면의 높이는 시간을 표현합니다. 별까지의 실제 거리를 보여 주는 입체 지도로 읽으면 안 됩니다.'],'timeline',analysis('timeline','관측 날짜와 재생 도구 찾기')),
step('차이 영상은 단서를 찾는 도구예요','feynman',['A−B 차영상은 두 영상의 차이를 강조해요. 밝아지거나 어두워진 곳이 보여도 바로 천체의 변화가 확정되지는 않습니다.','파장 차이, 별상의 모양, 위치 맞춤 오차와 흠집도 잔차를 만듭니다. 표시 색이나 임계값은 연구용 검출 확률과 같은 뜻이 아닙니다.'],'timeline',analysis('viewer','영상·차영상의 비교 조건 읽기'),question('차영상에 밝은 점이 보이면 바로 발견인가요?',['아니요. 파장과 품질 등 추가 확인이 필요해요','네. 차영상에 보이면 확정이에요'],0,'차영상은 탐색용 단서입니다. 관측 조건과 반복 측정을 확인하세요.')),
step('그래프는 질문에 맞게 골라요','einstein',['연구 모드에서는 위치 측정, 분광 실험실과 자료 출처를 볼 수 있어요. 변광 분석은 지원되는 대상에서 열립니다.','축과 단위, 제외된 자료와 모델 가정을 함께 읽으세요. 도구가 없는 대상에서는 없는 값을 만들어 보여 주지 않습니다.'],'spectrum',research('spectrum','연구 모드의 분광 실험실 열기'))],
research:[
step('조회 범위와 준비된 표본을 확인합니다','spherex',['추천 대상과 임의 좌표의 영역 자료는 구성과 지원 기능이 다릅니다. 기간, 방문 구분, 파장·검출기 범위와 제외 조건을 기록합니다.','조회 성공이 자료 완전성을 뜻하지는 않습니다. 외부 오류를 관측 없음으로 해석하지 말고 실패 상태와 재시도 결과를 확인합니다.'],'provenance',analysis('status','자료 종류와 준비·실패 상태 확인하기')),
step('차영상의 비교 조건을 검증합니다','feynman',['표시용 재투영 영상의 차이는 원본 픽셀의 정량 측광과 다릅니다. 파장, 배경, PSF, 정합 잔차와 유효 영역을 검토합니다.','차영상과 색 필터는 탐색용입니다. 표시 임계값을 검출 유의성으로 변환하지 않고 후보는 적절한 측정과 반복 관측으로 확인합니다.'],'mask',analysis('viewer','차영상의 제한과 관측 조건 확인하기')),
step('위치 잔차와 실제 궤적을 구분합니다','einstein',['위치 측정은 측정 위치와 카탈로그 예측 위치의 차이를 살펴보는 도구입니다. 잔차에는 측정 오차와 모델 가정이 영향을 줍니다.','시간을 높이로 표현한 3D 도표는 관측을 정리하는 방식입니다. 물리적 깊이, 독립 검출이나 이동 천체의 궤도 결정으로 해석하지 않습니다.'],'sky',research('motion','위치 측정 탭 열기')),
step('변광 도구의 표본과 시험 주기를 확인합니다','kepler',['변광 분석에서는 파장 표본, 품질 제외, 오차와 관측 간격을 확인합니다. 서로 다른 파장을 섞으면 스펙트럼 차이가 변광처럼 보일 수 있습니다.','주기 접기의 시험 주기는 가설입니다. 사용자가 선택한 주기로 정렬되었다는 사실만으로 주기가 검출되었다고 말하지 않습니다.'],'timeline',research('variable','RW Aur 또는 R Dra에서 변광 분석 열기'))]}},
{id:'wavelength',title:'파장과 그래프 읽기',description:'µm, 102개 채널, 스펙트럼과 광도곡선',minutes:{beginner:4,research:5},steps:{
beginner:[
step('파장은 빛의 종류를 나타내는 길이예요','doppler',['파장은 빛의 물결에서 같은 모양이 반복되는 간격이에요. µm는 마이크로미터이며 1µm는 1미터의 백만 분의 1입니다.','SPHEREx는 약 0.75~5µm 범위를 102개 명목 채널로 살펴봅니다. 화면의 색은 적외선 값을 구별하기 위한 표시이며 눈으로 보는 실제 색은 아닙니다.'],'wavelength'),
step('스펙트럼의 가로축부터 읽어요','feynman',['가로축은 파장입니다. 오른쪽일수록 더 긴 파장을 읽고 세로축은 그 파장에서 측정한 빛의 양을 나타냅니다.','mJy 단위 플럭스 밀도와 영상 픽셀의 밝기는 같은 숫자가 아닙니다. 축의 단위를 먼저 읽으세요. 오른쪽의 점이 더 나중에 촬영되었다는 뜻도 아닙니다.'],'spectrum',research('spectrum','분광 그래프의 축과 단위 확인하기'),question('스펙트럼에서 오른쪽으로 가면 무엇이 커지나요?',['관측 날짜','파장','하늘의 적위'],1,'시간에 따른 밝기는 광도곡선에서 읽습니다. 스펙트럼의 가로축은 파장입니다.')),
step('다른 필터로 보면 밝기도 달라질 수 있어요','spherex',['SPHEREx 필터는 검출기 위치에 따라 통과시키는 파장이 달라요. 같은 별도 다른 위치에서 관측되면 다른 종류의 빛을 보게 됩니다.','파장 선택 후 밝기가 달라졌다고 시간에 따라 변한 별이라고 바로 말하지 않아요. D1~D6 검출기 구분과 실제 파장을 함께 읽어 주세요.'],'wavelength',analysis('wavelength','파장·검출기 선택 도구 확인하기')),
step('봉우리와 골짜기는 확인할 단서예요','einstein',['올라간 곳과 내려간 곳은 천체를 이해하는 단서입니다. 점 하나로 물질이나 온도를 확정할 수는 없어요.','오차, 품질 표시와 반복 관측을 함께 살펴보세요. 아래 곡선은 실제 천체 자료가 아니라 그래프 읽기를 위한 가상 자료입니다.'],'spectrum',null,question('연습 곡선으로 실제 천체의 성분을 알 수 있을까요?',['아니요. 읽는 법을 배우는 가상 예시예요','네. 실제 관측 결과예요'],0,'실제 결과는 대상과 자료 출처가 표시된 분석 화면에서 확인합니다.'))],
research:[
step('채널과 실제 파장 응답을 구분합니다','doppler',['측정값은 유한한 통과대역을 거친 값입니다. 중심 파장과 대역폭, 명목 채널 번호와 검출기 위치를 구분합니다.','채널 번호가 같아도 전체 응답함수가 동일하다고 보장되지 않습니다. 시점 비교에서는 실제 파장 표본과 응답 차이를 확인합니다.'],'wavelength'),
step('λ 축의 Fν와 영상 표면 밝기를 구분합니다','feynman',['가로축이 µm여도 세로축 mJy는 주파수당 플럭스 밀도 Fν입니다. Fλ와 혼동해 그래프 면적을 그대로 적분하지 마세요.','MJy/sr는 표면 밝기입니다. 조리개·배경·픽셀 입체각·보정 조건을 거친 mJy 측광과 의미가 다릅니다. 1 Jy = 10⁻²⁶ W m⁻² Hz⁻¹입니다.'],'spectrum',research('spectrum','분광 그래프의 λ·Fν 단위 읽기')),
step('흑체 곡선과 흡수 깊이는 모델 비교입니다','einstein',['흑체 곡선과 온도 적합은 정해진 모델과 선택 자료의 비교입니다. 적합 온도를 독립적인 물리적 확정값으로 취급하지 않습니다.','품질 제외, 불확실성, 연속광 가정과 기기 응답을 확인하세요. 흡수 깊이는 후보 특징을 요약하는 값이며 성분 식별의 충분조건은 아닙니다.'],'uncertainty',research('spectrum','모델 가정·품질 제외·오차 확인하기')),
step('파장 탐색은 속도 측정기가 아닙니다','doppler',['선의 이동을 해석하려면 기준 파장, 기기 응답, 연속광과 잡음 모델을 검토해야 합니다. 파장 선택은 관측 속도를 측정하는 동작이 아닙니다.','이 웹의 일반 파장 탐색은 정밀 시선속도나 적색편이 추정 절차를 대신하지 않습니다. 최종 해석에는 검증된 모델과 독립 관측이 필요합니다.'],'wavelength',null,question('파장 선택을 바꾸면 시선속도가 측정되나요?',['아니요. 표시할 관측 파장을 고른 것입니다','네. 선택한 파장이 곧 속도입니다'],0,'속도는 기준 특징과 응답·잡음 모델을 포함한 별도의 추정이 필요합니다.'))]}},
{id:'quality',title:'결과를 믿기 전에',description:'품질 표시, 불확실성, 자료 출처와 저장',minutes:{beginner:3,research:4},steps:{
beginner:[
step('빈 값은 밝기 0과 달라요','spherex',['가장자리, 포화나 검출기 흠집 때문에 쓸 수 없는 값이 생깁니다. 빠진 값을 0으로 바꾸면 밝기와 변화량을 잘못 계산할 수 있어요.','아래 빗금은 제외 영역의 가상 예시입니다. 실제 화면에서는 결측·품질 안내와 제외된 측정 수를 읽으세요. 모든 화면이 같은 빗금 표시를 쓰는 것은 아닙니다.'],'mask'),
step('오차 막대도 결과의 일부예요','feynman',['반복해서 측정해도 값은 조금씩 달라질 수 있어요. 오차 막대는 불확실성을 함께 읽는 데 도움을 줍니다.','작은 밝기 차이만으로 변화를 확정하지 마세요. 파장, 품질과 반복 관측을 확인합니다. 처리 완료와 높은 신뢰도는 다른 뜻입니다.'],'uncertainty',null,question('분석 처리가 완료되면 결과가 확실한가요?',['아니요. 품질과 불확실성을 따로 봐야 해요','네. 완료는 높은 신뢰도를 뜻해요'],0,'완료는 처리 상태입니다. 자료 품질과 모델 신뢰도는 따로 확인합니다.')),
step('발견 노트에는 출처를 함께 남겨요','sagan',['자료 출처 탭에서 무엇을 언제 관측하고 어떤 자료를 썼는지 확인하세요. 제공되는 CSV와 공유 링크로 다시 비교할 수 있어요.','대상, 날짜와 파장, 확인하지 못한 부분을 함께 적으세요. 그림만 저장하는 것보다 좋은 관측 기록이 됩니다.'],'provenance',research('provenance','자료 출처와 제공되는 내보내기 찾기'))],
research:[
step('품질 마스크와 측정 방법을 확인합니다','feynman',['FLAGS 제외 조건, 원본 분산, 배경 추정과 PSF 가정을 확인합니다. 영상 표시와 측광에 적용된 품질 조건이 일관적인지도 검토합니다.','포화·잔상·검출기 결함과 혼잡은 결과에 영향을 줍니다. 영상이 깨끗해 보인다는 이유로 모든 측정값이 유효하다고 가정하지 않습니다.'],'mask',research('spectrum','스펙트럼 품질 제외와 측정 상태 확인하기')),
step('독립 오차와 공유 오차를 구별합니다','einstein',['평균으로 모든 불확실성이 같은 비율로 줄지는 않습니다. 공통 보정, 배경과 정규화 기준은 값 사이에 상관을 만들 수 있습니다.','현재 도구가 실제 포함한 오차 성분과 포함하지 않은 가정을 구분하세요. 아래 예시는 공유 오차의 개념 설명이며 프로그램 전체의 오차 모형을 보증하지 않습니다.'],'uncertainty',null,question('공유 보정 오차도 N번 평균하면 항상 1/√N로 줄까요?',['아니요. 공유 성분은 남을 수 있습니다','네. 모든 오차가 같은 비율로 줄어듭니다'],0,'서로 상관된 오차는 공분산을 포함해 계산해야 합니다.')),
step('처리 버전과 해석의 근거를 남깁니다','sagan',['원본 URI, 릴리스·처리 버전, 대상·기간, 품질 제외, 단위와 모델 설정을 보관합니다. 재실행과 다른 도구의 비교에는 이런 조건이 필요합니다.','관측 자료 존재, 처리 완료, 검출 후보, 분류와 물리 해석은 다른 단계입니다. 자료 부족이나 모델에 민감한 결과는 보류 사유와 함께 제시합니다.'],'provenance',research('provenance','출처·처리 조건·내보내기 확인하기'))]}},
{id:'asteroids',title:'소행성 분석',description:'3D 궤도, 저장 결과와 새 Python 분석',minutes:{beginner:3,research:4},steps:{
beginner:[
step('소행성을 골라 궤도와 관측을 보세요','kepler',['소행성 메뉴에서 대상을 골라 준비된 궤도, 관측 영상과 분석 결과를 보세요. 천체 번호와 이름이 같은 대상을 가리키는지 확인합니다.','3D 암석은 탐색을 돕는 설명용 모형입니다. SPHEREx가 복원한 실제 표면 모양이나 실제 크기 비율이라고 생각하면 안 됩니다.'],'sky',asteroid('target','소행성 대상 선택하기')),
step('새 분석과 3D 준비는 다른 단계예요','spherex',['서버의 분석 기능이 준비되어 있으면 대상과 기간을 입력해 새 분석을 요청하고 진행 상태와 취소 기능을 이용할 수 있어요.','분석 결과가 나와도 3D 궤도·영상은 따로 준비될 수 있어요. 자료 없음과 실패를 구분하고 저장된 결과도 먼저 살펴보세요.'],'timeline',asteroid('run','새 분석의 조건과 서버 상태 확인하기')),
step('지름과 분류는 근거와 함께 읽어요','sagan',['지름은 열모형 추정, 통계적 추정, 카탈로그 값 등 종류가 달라요. 숫자 하나로 합쳐 읽지 말고 이름과 출처를 확인하세요.','처리가 끝나도 신뢰도가 낮거나 판정이 보류될 수 있어요. 질량·밀도도 어떤 외부 자료와 가정에서 나온 값인지 확인하세요.'],'uncertainty',asteroid('results','결과 종류·신뢰도·보류 사유 읽기'))],
research:[
step('식별자·시각·관측자를 대조합니다','kepler',['같은 소행성도 시각과 관측자에 따라 하늘 위치가 달라집니다. SPHEREx 관측자 기준의 예측 위치와 촬영 시각을 연결합니다.','3D의 태양 중심 황도 좌표와 영상 적경·적위는 다른 표현입니다. 좌표계·단위·UTC/TDB를 함께 확인하고 범위 밖으로 임의 외삽하지 않습니다.'],'sky',asteroid('3d','궤도·관측 시각·우주선 시점 확인하기')),
step('측정과 prior를 사용하는 추정을 구분합니다','feynman',['분류와 열모형 결과에는 품질 제외, 태양 유사별 보정, 반사광·열복사 분리와 사전분포가 영향을 줍니다.','열모형 지름, H와 알베도 prior를 사용한 통계적 지름, 결합 지름과 카탈로그 값을 구분합니다. 추정값을 직접 측정으로 표시하거나 독립 검증 자료로 다시 사용하지 않습니다.'],'spectrum',asteroid('results','방법별 결과와 출처·불확실성 확인하기')),
step('작업 완료와 과학적 검증은 별개입니다','sagan',['대상 식별자와 분석 실행 ID를 구별해 기간·설정이 다른 결과를 보관합니다. 분석 원본과 웹용 결과, 3D 자료의 버전도 확인합니다.','Complete는 처리 상태이며 높은 분류 신뢰도를 보장하지 않습니다. 외부 조회 실패, 관측 부족과 결과 보류를 구분하고 보고서로 근거를 검토하세요.'],'provenance',asteroid('run','작업 상태·기간·결과 실행 ID 확인하기'))]}},
];
for (const module of MODULES) for (const track of ['beginner','research']) module.steps[track].forEach((item,index)=>{
  item.id=`${track}-${module.id}-${index+1}`;
  if(module.id==='wavelength')item.sources=index===0?['mission','products']:['products','mosaic'];
  if(module.id==='quality')item.sources=index===0?['intro','psf']:['release'];
});
export function getSteps(track='beginner', moduleId='all') {
  const safe=track==='research'?'research':'beginner';
  return MODULES.filter(m=>moduleId==='all'||m.id===moduleId).flatMap(m=>m.steps[safe].map(item=>({...item,moduleId:m.id,moduleTitle:m.title})));
}

import { TUTORIAL_NOTE_EN, CHARACTERS_EN, TRACKS_EN, REFERENCES_EN, HINTS_EN, PREPARED_SUFFIX_EN, MODULES_EN, STEPS_EN } from './content.en.js';

function englishStep(item) {
  const text = STEPS_EN[item.id];
  if (!text) throw new Error(`Missing English tutorial step ${item.id}`);
  const out = { ...item, title: text.title, body: [...text.body] };
  if (item.practice) out.practice = { ...item.practice, label: text.practice + (item.practice.requires.includes('prepared') ? PREPARED_SUFFIX_EN : ''), hint: HINTS_EN[item.practice.hint] ?? item.practice.hint };
  if (item.check) out.check = { ...item.check, question: text.check.question, choices: [...text.check.choices], explanation: text.check.explanation };
  return out;
}
const ENGLISH = {
  TUTORIAL_NOTE: TUTORIAL_NOTE_EN,
  CHARACTERS: Object.fromEntries(Object.entries(CHARACTERS).map(([id, item]) => [id, { ...item, ...CHARACTERS_EN[id] }])),
  TRACKS: Object.fromEntries(Object.entries(TRACKS).map(([id, item]) => [id, { ...item, ...TRACKS_EN[id] }])),
  REFERENCES: Object.fromEntries(Object.entries(REFERENCES).map(([id, item]) => [id, { ...item, title: REFERENCES_EN[id] }])),
  MODULES: MODULES.map((module) => ({ ...module, ...MODULES_EN[module.id],
    steps: Object.fromEntries(Object.entries(module.steps).map(([track, list]) => [track, list.map(englishStep)])) })),
};
const KOREAN = { TUTORIAL_NOTE, CHARACTERS, TRACKS, REFERENCES, MODULES };

/** Course content for one language: English unless 'ko'. The Korean exports above are the Korean course. */
export function contentFor(lang) { return lang === 'ko' ? KOREAN : ENGLISH; }
