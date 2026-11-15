export interface Exploration {
 id:string
 kind:'motion'|'spectrum'
 target:'barnard'|'eps_indi_b'|'wise0855'|'rw_aur'
 name:string
 label:string
 title:string
 question:string
 guide:string
 action:string
 visits?:[number,number]
}
export const EXPLORATIONS:Exploration[]=[
 {id:'motion-barnard',kind:'motion',target:'barnard',name:'바너드별',label:'Barnard’s Star',title:'움직이는 별 찾기',question:'두 시점에서 별의 위치는 어떻게 달라졌을까요?',guide:'비교 손잡이를 움직이며 주변 별과 위치를 비교해 보세요.',action:'아래 재생 버튼으로 두 관측을 번갈아 볼 수 있어요.'},
 {id:'motion-eps-indi',kind:'motion',target:'eps_indi_b',name:'엡실론 인디 B',label:'Epsilon Indi B',title:'작은 이동 살펴보기',question:'작은 위치 변화도 눈으로 찾을 수 있을까요?',guide:'영상을 확대하고 두 관측을 비교해 보세요. 위치 안내는 카탈로그의 예상 위치를 보여줘요.',action:'3D를 돌리거나 관측 면을 눌러 같은 하늘을 살펴보세요.'},
 {id:'motion-wise0855',kind:'motion',target:'wise0855',name:'WISE 0855',label:'WISE 0855−0714',title:'희미한 천체 찾아보기',question:'희미한 빛은 두 시점에서 어디에 있을까요?',guide:'위치 안내를 켜고 주변의 희미한 점을 비교해 보세요. 잡음도 있어 이동이 뚜렷하지 않을 수 있어요.',action:'한 장으로 살펴본 뒤 비교 손잡이를 움직여 보세요.'},
 {id:'spectrum-eps-indi',kind:'spectrum',target:'eps_indi_b',name:'엡실론 인디 B',label:'Epsilon Indi B',title:'빛의 골짜기 살펴보기',question:'파장이 바뀌면 빛의 세기는 어떻게 달라질까요?',guide:'비교를 눌러 두 관측에서 빛이 약해지는 구간을 살펴보세요. 그래프의 점은 관측에서 추출한 값이에요.',action:'점을 가리키거나 파장 슬라이더를 움직여 보세요.',visits:[0,6]},
 {id:'spectrum-rw-aur',kind:'spectrum',target:'rw_aur',name:'마차부자리 RW',label:'RW Aurigae',title:'파장별 밝기 비교하기',question:'같은 파장 부근의 밝기는 두 관측에서 같을까요?',guide:'비교 가능한 0.74–1.09 μm 구간을 살펴보세요. 파장과 관측 조건도 밝기에 영향을 줘요.',action:'한 장으로 모양을 살핀 뒤 비교로 두 관측을 겹쳐 보세요.',visits:[0,4]},
]
export function explorationFromUrl(search:string) {
 const id=new URLSearchParams(search).get('mission')
 return EXPLORATIONS.find(m=>m.id===id)??EXPLORATIONS[0]
}
