import { useMemo, useState } from 'react'
import type { TargetMeta, TargetsIndex } from '../types'
import type { PhotRow } from './PhotometryPanel'
import { applyStep } from '../lib/applyStep'
import { findingsFor } from '../lib/findings'
import type { Level } from '../lib/findings'
import { Badge } from './Badge'
import { useL } from '../lib/i18n'
import { missionFor } from '../lib/missions'
import { useTime } from '../store'

type Meta = TargetMeta & { photometry?: PhotRow[] }

// ------------------------------------------------------------------ sky locator
// Where the five challenge targets sit on the whole sky (Mollweide, equatorial, RA grows
// to the left as on a sky chart). Coordinates come from targets.json; the ecliptic and the
// Milky Way plane are drawn from fixed rotations.
const D = Math.PI / 180
function mollweide(ra: number, dec: number, w: number, h: number): [number, number] {
  const lam = -(((ra + 180) % 360 + 360) % 360 - 180) * D
  const phi = dec * D
  let t = phi
  for (let i = 0; i < 12; i++) {
    const f = 2 * t + Math.sin(2 * t) - Math.PI * Math.sin(phi)
    const d = 2 + 2 * Math.cos(2 * t)
    if (Math.abs(d) < 1e-9) break
    t -= f / d
  }
  const x = (2 * Math.SQRT2 / Math.PI) * lam * Math.cos(t)
  const y = Math.SQRT2 * Math.sin(t)
  return [w / 2 + (x / (2 * Math.SQRT2)) * (w / 2 - 2), h / 2 - (y / Math.SQRT2) * (h / 2 - 2)]
}
function eclipticRaDec(l: number): [number, number] {
  const e = 23.4393 * D, L = l * D
  return [((Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)) / D) + 360) % 360, Math.asin(Math.sin(e) * Math.sin(L)) / D]
}
function galacticRaDec(l: number): [number, number] {
  // galactic → ICRS for b = 0 (rotation matrix transpose, J2000)
  const L = l * D, x = Math.cos(L), y = Math.sin(L)
  const ex = -0.0548755604 * x + 0.4941094279 * y
  const ey = -0.8734370902 * x - 0.4448296300 * y
  const ez = -0.4838350155 * x + 0.7469822445 * y
  return [((Math.atan2(ey, ex) / D) + 360) % 360, Math.asin(ez) / D]
}
function curve(f: (t: number) => [number, number], w: number, h: number) {
  const pts: [number, number][] = []
  for (let t = 0; t <= 360; t += 3) pts.push(mollweide(...f(t), w, h))
  // split where the curve wraps across the map edge
  const segs: string[] = []
  let cur: string[] = []
  pts.forEach((p, i) => {
    if (i && Math.abs(p[0] - pts[i - 1][0]) > w / 3) { segs.push(cur.join(' ')); cur = [] }
    cur.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`)
  })
  segs.push(cur.join(' '))
  return segs
}

export function SkyLocator({ index, current, patch, onPick, onOpenSky }: { index: TargetsIndex; current: string | null; patch?: { ra: number; dec: number } | null; onPick: (id: string) => void; onOpenSky?: () => void }) {
  const L = useL()
  const w = 300, h = 150
  const ecl = useMemo(() => curve(eclipticRaDec, w, h), [])
  const gal = useMemo(() => curve(galacticRaDec, w, h), [])
  return (
    <figure className="sky" data-testid="sky-locator">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={L('다섯 대상의 하늘 위치 (전천 지도)', 'Where the five targets are on the sky')}>
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2} className="sky-bg" />
        {[-60, -30, 0, 30, 60].map((d) => <polyline key={d} className="sky-grid" points={Array.from({ length: 61 }, (_, i) => mollweide(i * 6, d, w, h).join(',')).join(' ')} />)}
        {gal.map((p, i) => <polyline key={`g${i}`} className="sky-gal" points={p} />)}
        {ecl.map((p, i) => <polyline key={`e${i}`} className="sky-ecl" points={p} />)}
        {index.targets.filter((t) => t.ra !== undefined && t.dec !== undefined).map((t) => {
          const [x, y] = mollweide(t.ra!, t.dec!, w, h)
          const on = !patch && t.id === current
          return (
            <g key={t.id} className={on ? 'sky-t on' : 'sky-t'} onClick={() => onPick(t.id)} role="button" tabIndex={0} aria-label={L(`${t.display_name} 열기`, `Open ${t.display_name}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') onPick(t.id) }}>
              <circle cx={x} cy={y} r={on ? 5 : 3.5} />
              {on && <circle cx={x} cy={y} r={9} className="ring" />}
            </g>
          )
        })}
        {patch && (() => { const [x, y] = mollweide(patch.ra, patch.dec, w, h); return <g className="sky-t on"><circle cx={x} cy={y} r={5} /><circle cx={x} cy={y} r={9} className="ring" /></g> })()}
      </svg>
      <figcaption className="dim small"><i className="ln-gal" />{L('은하수 면', 'Milky Way')} <i className="ln-ecl" />{L('황도 · 점을 눌러 대상 열기', 'ecliptic · click a dot to open')}{onOpenSky && <button className="link sky-open" onClick={onOpenSky} data-testid="open-sky">{L('실시간 천구 열기', 'Open the sky in Find')}</button>}</figcaption>
    </figure>
  )
}

// ------------------------------------------------------------------ mission
export function MissionCard({ meta }: { meta: TargetMeta }) {
  const L = useL()
  const lang = useTime((s) => s.lang)
  const mission = missionFor(meta.id, meta.kind === 'patch', lang)
  const [active, setActive] = useState<number | null>(null)
  if (!mission) return null
  return (
    <section className="mission" data-testid="mission-card">
      <p className="m-tag">{mission.tag}</p>
      <h2>{mission.name}</h2>
      <p>{mission.story}</p>
      <h3>{L('무엇을 찾을까요', 'What to look for')}</h3>
      <p>{mission.look}</p>
      <h3>{L('따라 해 보기', 'Try this')}</h3>
      <ol className="steps">
        {mission.steps.map((s, i) => (
          <li key={i}>
            <button className={active === i ? 'step on' : 'step'} aria-pressed={active === i} onClick={() => { applyStep(meta, s.action); setActive(i) }} data-testid={`step-${i + 1}`}>
              <span className="n">{i + 1}</span>
              <span className="t"><b>{s.title}</b><small>{s.hint}</small></span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ------------------------------------------------------------------ findings
const LEVEL_CLASS: Record<Level, string> = { 후보: 'lv-cand', '판단 보류': 'lv-hold' }
const LEVEL_EN: Record<Level, string> = { 후보: 'candidate', '판단 보류': 'undecided' }

export function Findings({ meta }: { meta: Meta }) {
  const L = useL()
  const list = useMemo(() => (meta.kind === 'patch' ? [] : findingsFor(meta, L)), [meta, L])
  return (
    <section className="findings" data-testid="findings">
      <h3>{L('살펴볼 변화 후보', 'Changes to investigate')}</h3>
      {!list.length && <p className="dim small">{L('좌표 검색 영역은 미리 알려진 대상이 없어 자동 결과를 만들지 않습니다. 깜빡이며 직접 찾아보세요.', 'A searched patch has no known target, so no automatic findings. Blink and look yourself.')}</p>}
      {list.map((f) => (
        <article key={f.id} className="finding" data-testid={`finding-${f.id}`}>
          <header><b>{f.title}</b><span className={`level ${LEVEL_CLASS[f.level]}`}>{L(f.level, LEVEL_EN[f.level])}</span></header>
          <p>{f.body}</p>
          {f.value && (
            <dl className="nums">
              <div><dt>{L(f.prov.includes('model') ? '자료 기반 모델값' : '자료 비교값', f.prov.includes('model') ? 'Data-based model' : 'Data comparison')}</dt><dd>{f.value}</dd></div>
              {f.reference && <div><dt>{L('목록값', 'Catalogue')}</dt><dd>{f.reference}</dd></div>}
            </dl>
          )}
          <div className="prov">{f.prov.map((p) => <Badge key={p} kind={p} />)}</div>
        </article>
      ))}
      {list.length > 0 && <p className="dim small">{L('발견은 모두 후보로 적습니다. 다른 관측과 전문가 검토로 확인해야 합니다.', 'Every finding is recorded as a candidate. Other observations and expert review must confirm it.')}</p>}
    </section>
  )
}

// ------------------------------------------------------------------ guides
/** Why blink only like with like: SPHEREx's linear variable filter, drawn. */
function LvfDiagram() {
  const L = useL()
  const cols = ['#7f8cff', '#4fc3f7', '#4cc38a', '#e0c341', '#ff9a3c', '#ff5d5d']
  return (
    <svg viewBox="0 0 280 96" className="lvf" role="img" aria-label={L('별이 선형 가변 필터를 가로질러 노출마다 다른 파장으로 찍히는 모습', 'A star crossing the linear variable filter, imaged at a different wavelength in each exposure')}>
      <defs>
        <linearGradient id="lvf-g" x1="0" x2="1" y1="0" y2="0">
          {cols.map((c, i) => <stop key={c} offset={i / (cols.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect x={10} y={14} width={260} height={34} rx={3} fill="url(#lvf-g)" opacity={0.85} />
      <text x={10} y={10} className="lvf-t">{L('짧은 파장', 'short λ')}</text>
      <text x={270} y={10} textAnchor="end" className="lvf-t">{L('긴 파장', 'long λ')}</text>
      {[0, 1, 2, 3].map((i) => {
        const x = 40 + i * 66
        return (
          <g key={i}>
            <circle cx={x} cy={31} r={5} fill="#fff" stroke="#0a101c" strokeWidth={1.5} />
            <line x1={x} y1={48} x2={x} y2={64} stroke="#8794ae" strokeDasharray="2 2" />
            <circle cx={x} cy={76} r={8 - Math.abs(1.5 - i) * 1.6} fill={cols[Math.min(5, i + 1)]} />
            <text x={x} y={94} textAnchor="middle" className="lvf-t">{L('노출', 'exp.')} {i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

const LOOKS: [string, string, string, string][] = [
  ['빗금이나 가운데가 빈 별', '너무 밝아 포화됐거나 품질 표시로 가린 픽셀입니다. 값이 없는 곳은 0으로 채우지 않고 비워 둡니다.', 'Hatching, or a star with a hollow centre', 'Saturated or flagged pixels. Missing values stay empty; they are never filled with zeros.'],
  ['한 관측에만 있는 밝은 점', '우주선(고에너지 입자)이 검출기를 때린 흔적일 수 있습니다. 여러 관측에서 같은 자리에 있는지 보세요.', 'A bright dot in one visit only', 'Possibly a cosmic-ray hit on the detector. Check whether it is there in other visits.'],
  ['밝은 별 둘레의 고리와 줄무늬', '망원경의 산란광·고스트 또는 PSF 잔차일 수 있습니다. 반복 관측과 주변 구조를 확인해 천체와 구별하세요.', 'Rings and streaks around bright stars', 'These may be stray light, ghosts or PSF residuals. Check repeat observations and surrounding structure before identifying an object.'],
  ['관측마다 별 모양이 조금 다름', '관측마다 망원경 방향과 검출기 위치가 달라 별상(PSF)이 바뀝니다. 차이 영상에 고정 별 잔차가 남는 이유입니다.', 'Star shapes differ a little between visits', 'Pointing and detector position change between visits, so the PSF changes. That is why fixed stars leave residuals in difference images.'],
  ['전체 파장에서 별이 깜빡임', '관측마다 섞인 파장이 달라 생기는 색 효과일 수 있습니다. 같은 검출기로 좁혀도 픽셀별 파장 차이는 남으므로 변광으로 단정하지 않습니다.', 'Stars flicker with all wavelengths on', 'Different wavelength mixtures can cause colour flicker. One detector narrows the range but does not remove pixel wavelength differences or establish variability.'],
  ['3D의 노란 점과 파란 십자', '노란 점은 목록값으로 계산한 위치, 파란 십자는 SPHEREx 영상에서 잰 위치입니다.', 'Yellow dots and blue crosses', 'Yellow dots are positions computed from the catalogue; blue crosses are positions measured on SPHEREx images.'],
  ['파란 원 (Gaia 별)', 'Gaia DR3 목록의 별을 관측 날짜로 옮긴 위치입니다. 영상과의 겹침은 좌표 확인의 참고이며, 정량 잔차·관측자·오차도 점검해야 합니다.', 'Blue circles (Gaia stars)', 'Gaia DR3 stars moved to the visit date. Visual overlap helps inspect alignment; quantitative residuals, observer and uncertainties still need checking.'],
]

export function Guides({ open = false }: { open?: boolean }) {
  const L = useL()
  return (
    <section className="guides" data-testid="guides">
      <details open={open}>
        <summary>{L('왜 같은 파장끼리 비교하나요?', 'Why compare like with like?')}</summary>
        <LvfDiagram />
        <p>{L('SPHEREx의 필터는 무지개처럼 자리마다 보는 파장이 다릅니다. 망원경이 조금씩 옮겨 가며 찍기 때문에, 같은 별도 노출마다 다른 색(파장)으로 찍힙니다.', 'The SPHEREx filter is a rainbow: each position sees a different wavelength. The telescope steps the sky across it, so the same star is imaged in a different colour in every exposure.')}</p>
        <p>{L('날짜순 깜빡임에는 색에 따른 밝기 차이가 섞입니다. 위 눈금은 검출기의 넓은 파장 범위를 고르는 기능이며, 같은 검출기를 선택해도 픽셀별 파장이 같아지지는 않습니다. 정량 비교에는 실제 파장 응답·PSF·품질·불확도 확인이 필요합니다.', 'Date-order blinking mixes in colour-dependent brightness. The ruler selects a broad detector range; selecting one detector does not make pixel wavelengths identical. Quantitative comparison needs wavelength response, PSF, quality and uncertainty checks.')}</p>
        <p className="dim small">{L('이 설명과 “같은 것끼리 깜빡이기” 원칙은 팀원 경보의 TrueBlink에서 가져왔습니다.', '') || <>This explanation and the like-with-like principle come from our teammate <span lang="ko">경보</span>'s TrueBlink.</>}</p>
      </details>
      <details>
        <summary>{L('지금 보이는 건 뭘까요?', 'What am I looking at?')}</summary>
        <dl className="looks">
          {LOOKS.map(([t, d, te, de]) => <div key={t}><dt>{L(t, te)}</dt><dd>{L(d, de)}</dd></div>)}
        </dl>
      </details>
    </section>
  )
}
