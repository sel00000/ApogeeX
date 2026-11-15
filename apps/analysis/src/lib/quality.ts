/** Conservative quality policy for numerical spectroscopy. Displaying a value is not
 * permission to fit it: saturation, defective pixels and persistence bias the flux. */
export const SPECTRAL_REJECT_FLAGS = new Set([
  'NONFUNC', 'MISSING_DATA', 'HOT', 'COLD', 'PERSIST', 'SATURATED',
  'SATURATION', 'SAT', 'OVERFLOW', 'SUR_ERROR', 'TRANSIENT',
])

export function usableSpectralRow(row: {
  flux_mjy: number | null; err_mjy: number | null; wave_um: number | null; flags?: string[]
}): boolean {
  return typeof row.flux_mjy === 'number' && Number.isFinite(row.flux_mjy) && row.flux_mjy > 0 &&
    typeof row.err_mjy === 'number' && Number.isFinite(row.err_mjy) && row.err_mjy > 0 &&
    typeof row.wave_um === 'number' && Number.isFinite(row.wave_um) && row.wave_um > 0 &&
    !(row.flags ?? []).some(flag => SPECTRAL_REJECT_FLAGS.has(flag.toUpperCase()))
}
