// Guided missions for 탐험 mode. The mission-card idea (story · what to look for · steps that
// set the viewer) comes from 경보's TrueBlink; the wording and the steps are ours and drive
// our own viewer: SPHEREx blink, A−B difference, cold-object filter, 3D space-time and the labs.
import type { AnalysisTab, ImageView, PlayMode, UiMode, ViewMode } from '../store'
import type { TargetMeta } from '../types'

export interface StepAction {
  ui?: UiMode
  view?: ImageView
  /** 'common' = the detector array present in the most visits */
  det?: number | 'common'
  zoom?: number | null
  mode?: ViewMode
  showImage3d?: boolean
  /** null = stop playback */
  play?: PlayMode | null
  /** A = first visit, B = last visit */
  abEnds?: boolean
  tab?: AnalysisTab
}
export interface MissionStep { title: string; hint: string; action: StepAction }
export interface Mission { name: string; tag: string; story: string; look: string; steps: MissionStep[] }

const BLINK: MissionStep = { title: '날짜순으로 깜빡이기', hint: '같은 시야와 같은 밝기 기준으로 관측을 차례로 넘깁니다.', action: { view: 'image', det: 0, play: 'blink', mode: 'overview' } }
const DIFF: MissionStep = { title: '처음과 마지막 빼 보기', hint: '주황은 A가 더 밝은 곳, 파랑은 B가 더 밝은 곳입니다. 색의 짝은 이동 후보일 수 있지만 파장·PSF·정렬 차이도 같은 잔차를 만들 수 있습니다.', action: { view: 'diff', play: null, abEnds: true } }
const LOS: MissionStep = { title: 'SPHEREx 시선으로 겹쳐 보기', hint: '3D 모형을 망원경 방향에서 보면 왼쪽 영상과 같은 각도·시야가 됩니다.', action: { mode: 'los', showImage3d: true, view: 'image', play: null } }

export const MISSIONS: Record<string, Mission> = {
  barnard: {
    name: '바너드 별',
    tag: '하늘에서 가장 빨리 움직이는 별',
    story: '약 6광년 떨어진 작은 적색왜성입니다. 해마다 하늘에서 10.4″씩 자리를 옮겨, SPHEREx 픽셀(6.15″)로 1년에 1.7칸쯤 움직입니다.',
    look: '목록으로 예측한 북쪽(위) 이동과 영상 속 밝은 별의 위치를 비교하세요. 이웃 별·파장·PSF도 확인해야 합니다. 빗금은 포화 또는 품질 조건 때문에 값이 없는 곳입니다.',
    steps: [
      BLINK,
      DIFF,
      { title: '3D에서 기울어진 실 보기', hint: '바닥은 하늘, 높이는 시간입니다. 비스듬한 선은 목록값으로 계산한 시간별 경로이며 영상의 독립 검출이 아닙니다.', action: { mode: 'overview', view: 'image', play: 'time' } },
      LOS,
    ],
  },
  eps_indi_b: {
    name: '인디언자리 엡실론 B',
    tag: '쌍둥이 갈색왜성',
    story: '약 12광년 거리에서 서로 도는 두 갈색왜성(Ba·Bb)입니다. 둘 사이가 0.7″라 SPHEREx에서는 점 하나로 보이고, 함께 1년에 4.7″씩 움직입니다.',
    look: '목록에서 예측한 남동쪽(왼쪽 아래) 이동은 한 해에 1픽셀보다 작습니다. 차영상 후보와 3D 예측 경로를 비교하고 파장·PSF·정렬 차이도 점검하세요.',
    steps: [
      BLINK,
      DIFF,
      LOS,
      { title: '물·메탄 대역의 후보 비교', hint: '흑체 곡선 하나로는 설명되지 않는 움푹한 파장을 분광 실험실에서 찾습니다.', action: { ui: 'research', tab: 'spectrum', play: null } },
    ],
  },
  wise0855: {
    name: 'WISE 0855−0714',
    tag: '가장 차가운 갈색왜성',
    story: '온도가 약 250–285 K로 지구와 비슷한, 알려진 가장 차가운 갈색왜성입니다. 7.4광년 거리이고 빛 대부분이 4–5 µm로만 나옵니다.',
    look: '긴 파장과 차가운 천체 필터로 희미한 후보를 찾아보세요. 목록의 서쪽(오른쪽) 이동 예측 약 8.1″/년과 비교하되, 필터 잔차에는 보정 차이·우주선 흔적도 남을 수 있습니다.',
    steps: [
      { title: '전체 파장으로 깜빡이기', hint: '보이나요? 짧은 파장의 별빛에 묻혀 거의 보이지 않습니다.', action: { view: 'image', det: 0, play: 'blink', mode: 'overview' } },
      { title: '4.4–5.0 µm(D6)만 보기', hint: '차가운 천체가 빛나는 파장입니다.', action: { view: 'image', det: 6, play: 'blink' } },
      { title: '차가운 천체 필터 켜기', hint: 'D6에서 D5를 이론 비율만큼 빼서 긴 파장에 밝은 후보를 살펴봅니다. 보정 차이와 영상 결함도 남을 수 있습니다.', action: { view: 'cold', play: 'blink' } },
      { ...LOS, action: { ...LOS.action, det: 6 } },
    ],
  },
  rw_aur: {
    name: '마차부자리 RW',
    tag: '어두워진 어린 별',
    story: '가스와 먼지 원반에 둘러싸인 젊은 별입니다. 원반의 먼지가 별빛을 가리면 몇 달씩 어두워집니다.',
    look: 'RW Aur의 날짜별 밝기를 비교해 보세요. 같은 검출기 안에서도 실제 파장은 다를 수 있습니다. 좁은 파장 구간·품질 조건과 이웃 별을 함께 확인해야 변광 후보를 해석할 수 있습니다.',
    steps: [
      { title: '한 검출기로 범위 좁히기', hint: '여러 관측에 있는 검출기를 고릅니다. 같은 검출기는 같은 픽셀 파장을 보장하지 않습니다.', action: { view: 'image', det: 'common', play: 'blink', mode: 'overview' } },
      { ...DIFF, hint: '한 색의 잔차에도 밝기·파장·PSF 차이가 섞일 수 있습니다. 잔차만으로 변광을 확정하지 않습니다.', action: { ...DIFF.action, det: 'common' } },
      { title: '시간·파장 지도에서 고르기', hint: '변광 분석실에서 관측과 파장 구간을 골라 밝기 변화를 봅니다.', action: { ui: 'research', tab: 'variable', play: null } },
      { title: '원반의 적외선 초과 보기', hint: '분광 실험실에서 흑체보다 밝은 긴 파장을 확인합니다.', action: { ui: 'research', tab: 'spectrum', play: null } },
    ],
  },
  r_dra: {
    name: '용자리 R',
    tag: '맥동하는 거성',
    story: '약 245일 주기로 부풀었다 줄어드는 미라형 변광성입니다. SPHEREx 북쪽 심층 관측 구역 안이라 아주 자주 찍혔습니다.',
    look: '관측 한 번이 한 검출기만 찍는 경우가 많아, 그냥 깜빡이면 파장이 바뀌며 깜빡입니다. 같은 검출기를 고르고, 포화된 중심 대신 둘레(고리) 밝기를 보세요.',
    steps: [
      { title: '그냥 깜빡이기', hint: '파장이 관측마다 달라 생기는 깜빡임입니다. 아직 변광의 증거가 아닙니다.', action: { view: 'image', det: 0, play: 'blink', mode: 'overview' } },
      { title: '같은 검출기만 보기', hint: '검출기 범위를 좁힌 뒤 실제 파장·품질 조건을 확인하세요. 고리 밝기는 PSF에도 영향을 받는 상대 지표입니다.', action: { view: 'image', det: 'common', play: 'blink' } },
      { title: '주기로 접어 보기', hint: '변광 분석실에서 245.6일(문헌값)로 접어 모양을 봅니다.', action: { ui: 'research', tab: 'variable', play: null } },
    ],
  },
}

export const PATCH_MISSION: Mission = {
  name: '내가 고른 하늘',
  tag: '좌표 검색',
  story: '챌린지 대상이 아닌 곳입니다. 미리 알려진 천체가 없으니 예측 위치는 표시하지 않습니다.',
  look: '날짜별로 깜빡이며 튀는 점, 어두워지거나 밝아지는 점을 찾아보세요. 한 장에만 있는 점은 우주선 흔적일 수 있습니다.',
  steps: [BLINK, DIFF],
}

/** Does visit i have a frame for detector d in the frames the viewer shows (context frames when present)? */
export function hasDetector(meta: TargetMeta, i: number, d: number): boolean {
  const wide = meta.kind !== 'patch' && meta.wide ? meta.wide : null
  const det = wide ? wide.visits[i]?.f32_det : meta.visits[i].f32_det
  return det ? !!det[String(d)] : meta.visits[i].detectors.includes(d)
}

/** Detector array present in the most visits (ties → longer wavelength). */
export function commonDetector(meta: TargetMeta): number {
  let best = 0, n = -1
  for (let d = 1; d <= 6; d++) {
    const c = meta.visits.filter((_, i) => hasDetector(meta, i, d)).length
    if (c >= n) { best = d; n = c }
  }
  return best
}

// English texts for the same missions (actions are shared, so both languages drive the same steps).
type MissionText = { name: string; tag: string; story: string; look: string; steps: [string, string][] }
const EN: Record<string, MissionText> = {
  barnard: {
    name: "Barnard's Star", tag: 'The fastest-moving star on the sky',
    story: 'A small red dwarf about 6 light-years away. It moves 10.4″ across the sky every year, about 1.7 SPHEREx pixels (6.15″).',
    look: 'Compare the catalogue-predicted northward (upward) motion with the bright source in the images. Check neighbours, wavelengths and PSF too. Hatching marks pixels unavailable through saturation or quality conditions.',
    steps: [['Blink the dates', 'Steps through the visits with the same field and the same stretch.'], ['Subtract first from last', 'Orange marks A brighter than B; blue marks B brighter than A. A pair may suggest motion, but wavelength, PSF and alignment differences can produce the same residual.'], ['See the slanted thread in 3D', 'The floor is the sky, height is time. The slanted line is a catalogue-based predicted path, not an independent image detection.'], ['Overlay the SPHEREx line of sight', 'Seen from the telescope, the 3D model matches the image on the left in angle and field.']],
  },
  eps_indi_b: {
    name: 'Epsilon Indi B', tag: 'Twin brown dwarfs',
    story: 'Two brown dwarfs (Ba, Bb) orbiting each other about 12 light-years away. They are 0.7″ apart, one point for SPHEREx, and move 4.7″ a year together.',
    look: 'The catalogue predicts south-east (down-left) motion of less than a pixel per year. Compare difference candidates with the predicted 3D path, checking wavelength, PSF and alignment effects.',
    steps: [['Blink the dates', 'Steps through the visits with the same field and the same stretch.'], ['Subtract first from last', 'Orange marks A brighter than B; blue marks B brighter than A. A pair may suggest motion, but wavelength, PSF and alignment differences can produce the same residual.'], ['Overlay the SPHEREx line of sight', 'Seen from the telescope, the 3D model matches the image on the left in angle and field.'], ['Compare water and methane band candidates', 'In the spectrum lab, look for dips no single blackbody explains.']],
  },
  wise0855: {
    name: 'WISE 0855−0714', tag: 'The coldest known brown dwarf',
    story: 'About 250–285 K, close to Earth temperatures, and 7.4 light-years away. Almost all its light comes out at 4–5 µm.',
    look: 'Explore faint candidates at long wavelengths or with the cold-object filter. Compare with the catalogue-predicted westward (rightward) motion of about 8.1″ per year; calibration residuals and cosmic-ray hits may remain.',
    steps: [['Blink all wavelengths', 'Can you see it? Short-wavelength starlight drowns it.'], ['Show 4.4–5.0 µm (D6) only', 'The wavelengths where cold objects shine.'], ['Turn on the cold-object filter', 'Subtract a theoretical share of D5 from D6 to explore long-wavelength-bright candidates. Calibration differences and image defects can also remain.'], ['Overlay the SPHEREx line of sight', 'Seen from the telescope, the 3D model matches the image on the left in angle and field.']],
  },
  rw_aur: {
    name: 'RW Aurigae', tag: 'A young star that dimmed',
    story: 'A young star wrapped in a disc of gas and dust. When dust in the disc crosses our line of sight, it can dim for months.',
    look: 'Compare RW Aur across dates. Pixel wavelengths can differ within one detector. Check narrow wavelength bins, quality and neighbouring stars before interpreting a variability candidate.',
    steps: [['Narrow to one detector', 'Uses a detector present in most visits; it does not guarantee identical pixel wavelengths.'], ['Subtract first from last', 'A single-colour residual can mix brightness, wavelength and PSF differences; it does not establish variability.'], ['Pick from the time × wavelength map', 'In the variability lab, choose visits and a wavelength band.'], ['See the infrared excess of the disc', 'In the spectrum lab, check the long wavelengths brighter than a blackbody.']],
  },
  r_dra: {
    name: 'R Draconis', tag: 'A pulsating giant',
    story: 'A Mira variable that swells and shrinks over about 245 days. It lies in the SPHEREx northern deep field, so it was observed very often.',
    look: 'Many visits use only one detector, so a plain blink flickers with wavelength. Pick one detector and read the ring around the saturated centre.',
    steps: [['Plain blink', 'This flicker comes from changing wavelength, not yet evidence of variability.'], ['One detector only', 'After narrowing the detector range, check actual wavelengths and quality. Ring brightness is a relative indicator affected by the PSF.'], ['Fold by the period', 'In the variability lab, fold at 245.6 days (literature value).']],
  },
  patch: {
    name: 'My patch of sky', tag: 'Coordinate search',
    story: 'Not a challenge target. No object is known in advance, so no predicted positions are drawn.',
    look: 'Blink the dates and look for points that jump, fade or brighten. A point in a single image may be a cosmic-ray hit.',
    steps: [['Blink the dates', 'Steps through the visits with the same field and the same stretch.'], ['Subtract first from last', 'Orange marks A brighter than B; blue marks B brighter than A. A pair may suggest motion, but wavelength, PSF and alignment differences can produce the same residual.']],
  },
}

/** The mission for a target in the chosen language (same steps and actions). */
export function missionFor(id: string, isPatch: boolean, lang: 'ko' | 'en'): Mission | undefined {
  const base = isPatch ? PATCH_MISSION : MISSIONS[id]
  if (!base || lang === 'ko') return base
  const t = EN[isPatch ? 'patch' : id]
  if (!t) return base
  return { name: t.name, tag: t.tag, story: t.story, look: t.look, steps: base.steps.map((s, i) => ({ ...s, title: t.steps[i]?.[0] ?? s.title, hint: t.steps[i]?.[1] ?? s.hint })) }
}
