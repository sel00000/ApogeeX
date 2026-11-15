/** Image pixels and overlays share this transform. Offsets only translate the
 * analysis grid into the wider grid; they never move or rescale observed pixels. */
export function frameViewport(size: number, offset: number, center: readonly [number, number], zoom: number, display: number) {
  const half = size / (2 * zoom)
  const c = center.map(v => Math.min(size - half, Math.max(half, v + offset)))
  const scale = display / size * zoom
  return {
    window: { x0: c[0] - half, y0: c[1] - half, w: 2 * half },
    project: (p: readonly [number, number]) => [
      (p[0] + offset - c[0]) * scale + display / 2,
      (p[1] + offset - c[1]) * scale + display / 2,
    ] as const,
  }
}
