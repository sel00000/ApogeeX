import type { TargetMeta } from '../types'
import { useTime, visitIndexAt } from '../store'
import { Badge } from './Badge'
import { useL } from '../lib/i18n'

/** Right-hand panel for an arbitrary sky patch: what was observed, when, and how. */
export function PatchInfo({ meta }: { meta: TargetMeta }) {
  const tMjd = useTime((s) => s.tMjd)
  const L = useL()
  const { goToVisit } = useTime.getState()
  const k = visitIndexAt(meta, tMjd)
  const vs = meta.visits
  const prov = meta.provenance as TargetMeta['provenance'] & { exposures_found?: number; cutouts?: { downloaded: number; failed: number; skipped_404: number } }
  const frame = meta.frame as TargetMeta['frame'] & { thinned?: string | null }
  const span = vs.length ? (vs[vs.length - 1].mjd - vs[0].mjd) / 365.25 : 0

  return (
    <div className="patch-info" data-testid="patch-info">
      <div className="stats">
        <div className="stat"><div className="stat-label">{L('중심', 'Centre')}</div><div className="stat-value">{meta.display_name}</div></div>
        <div className="stat"><div className="stat-label">{L('시야', 'Field')}</div><div className="stat-value">{meta.fov_deg}° × {meta.fov_deg}° ({meta.wcs.size_px[0]}×{meta.wcs.size_px[1]} {L('픽셀', 'px')})</div></div>
        <div className="stat"><div className="stat-label">{L('관측', 'Visits')}</div><div className="stat-value">{vs.length}{L('회', '')} · {span.toFixed(1)} {L('년', 'yr')} <Badge kind="spherex" /></div></div>
        <div className="stat">
          <div className="stat-label">{L('노출', 'Exposures')}</div>
          <div className="stat-value">
            {prov.cutouts?.downloaded ?? '—'} {L('장 사용', 'used')}{prov.exposures_found ? L(` / ${prov.exposures_found}장 찾음`, ` / ${prov.exposures_found} found`) : ''}
            {prov.cutouts?.failed ? <span className="warn"> · {L('실패', 'failed')} {prov.cutouts.failed}</span> : null}
          </div>
        </div>
      </div>
      {frame?.thinned && <p className="dim small">{L('심층 관측 영역', 'Deep field')}: {frame.thinned}</p>}
      <p className="dim small">{L('자료', 'Data')}: NASA/IPAC IRSA SPHEREx ({prov.collections.join(', ')}) · {L('처리', 'processed')} {prov.query_time_utc.slice(0, 16).replace('T', ' ')} UTC</p>

      <table className="visits" data-testid="patch-visits">
        <thead>
          <tr><th>#</th><th>UTC</th><th>{L('검출기', 'Detectors')}</th><th>{L('파장', 'Wavelength')}</th><th>{L('노출', 'Exp.')}</th><th>{L('데이터 없음', 'No data')}</th></tr>
        </thead>
        <tbody>
          {vs.map((v, i) => (
            <tr key={i} className={i === k ? 'on' : ''} onClick={() => goToVisit(meta, i)}>
              <td>{i + 1}</td>
              <td>{v.utc.slice(0, 16).replace('T', ' ')}</td>
              <td>{v.detectors.map((d) => `D${d}`).join(' ')}</td>
              <td>{v.wave_um ? `${v.wave_um[0].toFixed(2)}–${v.wave_um[1].toFixed(2)} µm` : '—'}</td>
              <td>{v.n_exp}</td>
              <td className={(v.masked_frac ?? 0) > 0.2 ? 'warn' : ''}>{((v.masked_frac ?? 0) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">
        {L('행을 누르면 그 관측으로 이동합니다. 관측마다 검출기·파장이 달라 밝기가 다를 수 있습니다. Blink·차영상은 후보 탐색용이며, 잔차만으로 이동·변광을 확정할 수 없습니다.', 'Click a row to go to that visit. Detectors and wavelengths differ per visit, so brightness can differ. Blink and differences explore candidates; residuals alone do not establish motion or variability.')}
      </p>
    </div>
  )
}
