import type { TargetMeta } from '../types'
import { fitProperMotion } from '../lib/fit'
import { Badge } from './Badge'
import { useL } from '../lib/i18n'

// Target-specific context (text only; numbers come from meta.json)
// meta.json warnings are written in Korean by scripts/bake.py; English renderings of the known ones
const WARN_EN: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Gaia 측정 신뢰도 낮음 \(RUWE ([\d.]+) > 1\.4\)$/, (m) => `Low Gaia astrometric quality (RUWE ${m[1]} > 1.4)`],
  [/^시선속도 미상.*0 km\/s로 가정$/, () => 'Radial velocity unknown: 3D assumes 0 km/s'],
  [/^Gaia에 없음: 문헌값 사용$/, () => 'Not in Gaia: literature values used'],
  [/^미라형 변광성.*$/, () => 'Mira variable: its large, changing surface makes the Gaia parallax uncertain'],
  [/^시차 상대오차 (\d+)% — 거리 불확실$/, (m) => `Parallax relative error ${m[1]}%: distance uncertain`],
]
const warnEn = (w: string) => { for (const [re, f] of WARN_EN) { const m = w.match(re); if (m) return f(m) } return w }
const CONTEXT_EN: Record<string, string[]> = {
  barnard: ['The star with the largest proper motion on the sky. It moves about 1.7 SPHEREx pixels a year, visible directly in the blink.'],
  eps_indi_b: ['A pair of brown dwarfs (Ba/Bb) about 0.7″ apart: SPHEREx (6.15″ pixels) and Gaia both see one point.', 'High Gaia RUWE, probably from the orbital motion of the pair (see warnings).'],
  wise0855: ['The coldest known brown dwarf (about 250 K). Too faint in visible light for Gaia, so literature values are used.', 'A nearby star contaminates short wavelengths, so only the 3.8–5.0 µm arrays (D5–D6) are used.'],
  rw_aur: ['Variable (challenge target): a young binary with a protoplanetary disc whose brightness changes irregularly. Far away, so its position barely changes. Gaia values are unstable too.'],
  r_dra: ['Variable (challenge target): a Mira star changing strongly over about 245 days. So bright that the centre saturates; brightness is read from the outer ring.', 'Near the north ecliptic pole (SPHEREx deep field), observed almost daily; one visit per week is kept.'],
}
const CONTEXT: Record<string, string[]> = {
  barnard: ['하늘에서 고유운동이 가장 큰 별. 1년에 약 1.7 SPHEREx 픽셀씩 움직여 Blink로 직접 보입니다.'],
  eps_indi_b: [
    'Ba/Bb 두 갈색왜성이 약 0.7″ 간격으로 도는 쌍성 — SPHEREx(6.15″ 픽셀)와 Gaia 모두 하나로 봅니다.',
    '쌍성 궤도 운동 때문으로 보이는 높은 Gaia RUWE — 아래 경고 참고.',
  ],
  wise0855: [
    '가장 차가운 갈색왜성(약 250 K). 가시광에서 극히 어두워 Gaia 목록에 없습니다 → 문헌값 사용.',
    '근처 별 때문에 짧은 파장 측광·위치가 오염됩니다 → 3.8–5.0 µm 검출기(D5–D6)만 사용.',
  ],
  rw_aur: ['변광성(대회 시험 대상): 원시행성원반을 가진 젊은 쌍성으로 밝기가 불규칙하게 변합니다. 멀리 있어 위치는 거의 그대로입니다. Gaia 측정도 불안정합니다.'],
  r_dra: ['변광성(대회 시험 대상): 약 245일 주기로 밝기가 크게 변하는 미라형 별입니다. 매우 밝아 중심이 포화되므로 밝기 변화는 바깥 고리 밝기로 봅니다.', '북황극 근처(SPHEREx 심층 관측 영역)라 거의 매일 찍혀서, 1주에 한 번 관측만 골라 씁니다.'],
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{children}</div>
    </div>
  )
}

export function TargetCard({ meta }: { meta: TargetMeta }) {
  const L = useL()
  const en = L('', 'en') === 'en'
  const a = meta.astrometry
  const cdelt = meta.wcs.cdelt_arcsec
  const src = a.source.startsWith('Gaia') ? 'Gaia DR3' : L('문헌', 'literature')
  const distPc = 1000 / a.parallax_mas
  const distErr = a.parallax_err_mas ? (distPc * a.parallax_err_mas) / a.parallax_mas : null
  const mu = Math.hypot(a.pmra, a.pmdec) / 1000 // ″/yr
  const vt = 4.74 * mu * distPc
  const pxPerYr = mu / cdelt
  const plxPx = a.parallax_mas / 1000 / cdelt
  const fit = fitProperMotion(meta)
  const nMeas = meta.visits.filter((v) => v.meas_px).length
  const nExposures = new Set(meta.visits.flatMap(v => v.exposures)).size

  const warnings = [...a.warnings]
  if (a.parallax_err_mas && a.parallax_err_mas / a.parallax_mas > 0.1)
    warnings.push(L(`시차 상대오차 ${((100 * a.parallax_err_mas) / a.parallax_mas).toFixed(0)}% — 거리 불확실`, `Parallax relative error ${((100 * a.parallax_err_mas) / a.parallax_mas).toFixed(0)}%: distance uncertain`))

  return (
    <section className="card" data-testid="target-card">
      <header>
        <h3>{meta.display_name}</h3>
        <span className="dim small">{a.source}</span>
      </header>

      <div className="stats">
        <Stat label={L('거리', 'Distance')}>
          {distPc < 10 ? distPc.toFixed(3) : distPc < 100 ? distPc.toFixed(2) : distPc.toFixed(0)} pc
          {distErr !== null && <span className="dim"> ± {distErr.toPrecision(2)}</span>}
          <span className="dim"> ({(distPc * 3.2616).toFixed(distPc < 100 ? 2 : 0)} {L('광년', 'ly')})</span>
          <Badge kind="catalog" detail={src} />
        </Stat>
        <Stat label={L('고유운동 (μα*, μδ)', 'Proper motion (μα*, μδ)')}>
          {a.pmra.toFixed(1)}, {a.pmdec.toFixed(1)} mas/yr <Badge kind="catalog" detail={src} />
        </Stat>
        <Stat label={L('시선속도', 'Radial velocity')}>
          {a.rv_kms !== null
            ? <>{a.rv_kms.toFixed(1)} km/s <Badge kind="catalog" detail={src} /></>
            : <><span className="warn">{L('미상', 'unknown')}</span> <span className="badge badge-warn">{L('시선속도 미상 · 3D는 0으로 계산', 'unknown · 3D uses 0')}</span></>}
        </Stat>
        <Stat label={L('접선속도 vₜ = 4.74·μ·d', 'Tangential velocity vₜ = 4.74·μ·d')}>
          {vt.toFixed(1)} km/s <Badge kind="model" />
        </Stat>
        <Stat label={L('1년 이동', 'Motion per year')}>
          {pxPerYr.toFixed(pxPerYr < 0.01 ? 4 : 2)} px <span className="dim">({mu.toFixed(3)}″)</span> <Badge kind="model" />
        </Stat>
        <Stat label={L('시차 진폭', 'Parallax amplitude')}>
          {plxPx.toFixed(plxPx < 0.01 ? 4 : 3)} px <span className="dim">({a.parallax_mas.toFixed(1)} mas)</span> <Badge kind="model" />
        </Stat>
        <Stat label={L('SPHEREx 위치 측정', 'SPHEREx positions')}>
          {nMeas}/{meta.visits.length} {L('관측', 'visits')}
          {fit && <span className="dim"> · {L('예측과 rms', 'rms vs prediction')} {fit.rmsPx.toFixed(2)} px</span>} <Badge kind="spherex" />
        </Stat>
        {fit && (
          <Stat label={L(`SPHEREx로 잰 고유운동 (${fit.baselineYr.toFixed(1)}년)`, `Proper motion measured by SPHEREx (${fit.baselineYr.toFixed(1)} yr)`)}>
            {fit.pm[0].toFixed(0)}±{fit.pmErr[0].toFixed(0)}, {fit.pm[1].toFixed(0)}±{fit.pmErr[1].toFixed(0)} mas/yr
            <span className={fit.sigmaDiff < 3 ? 'ok' : 'warn'}> · {L('카탈로그와', 'vs catalogue')} {fit.sigmaDiff.toFixed(1)}σ</span> <Badge kind="spherex" />
          </Stat>
        )}
      </div>

      <div className="notes">
        <p data-testid="data-coverage"><Badge kind="spherex" /> {meta.provenance.collections.join(' · ')} ·
          {L(`표시 자료 ${meta.visits.length}회 관측 / 원본 노출 ${nExposures}장`, `${meta.visits.length} visits shown / ${nExposures} source exposures`)}
          {meta.provenance.exposures_found !== undefined && <> · {L(`검색된 노출 ${meta.provenance.exposures_found}장 (필터·선별 전)`, `${meta.provenance.exposures_found} exposures found (before selection)`)}</>}
        </p>
        {(meta.frame.max_exp_per_visit || meta.frame.min_visit_spacing_days) && <p className="warn">
          {L('선별 자료입니다. 전체 노출을 모두 사용한 자료가 아닙니다.', 'A selection: not every exposure was used.')}
          {meta.frame.max_exp_per_visit && <> {L(`관측당 최대 ${meta.frame.max_exp_per_visit}장.`, `At most ${meta.frame.max_exp_per_visit} per visit.`)}</>}
          {meta.frame.min_visit_spacing_days && <> {L(`관측 선택 최소 간격 ${meta.frame.min_visit_spacing_days}일.`, `Visits at least ${meta.frame.min_visit_spacing_days} days apart.`)}</>}
        </p>}
        <p>{L('파란 위치 측정에는 오차가 포함됩니다. 측정점을 잇는 굴곡만으로 천체의 실제 궤도 변화라고 해석할 수 없습니다.', 'Measured (blue) positions carry errors; wiggles between them are not by themselves real orbital changes.')}</p>
        <p>{L('SPHEREx 픽셀(6.15″)보다 시차가 훨씬 작아 거리는 Gaia/문헌 값을 사용합니다.', 'Parallax is far smaller than a SPHEREx pixel (6.15″), so distances come from Gaia or the literature.')}</p>
        {((en ? CONTEXT_EN : CONTEXT)[meta.id] ?? []).map((t) => <p key={t}>{t}</p>)}
        {warnings.length > 0 && (
          <ul className="warnings">
            {warnings.map((w) => <li key={w}>⚠ {en ? warnEn(w) : w}</li>)}
          </ul>
        )}
      </div>
    </section>
  )
}
