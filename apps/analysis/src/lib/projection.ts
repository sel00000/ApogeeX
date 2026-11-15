/** Orthogonal projection onto a constant-time floor: preserve sky X/Y exactly. */
export function projectTrack(points: readonly (readonly [number, number, number])[], floor: number): [number, number, number][] {
  return points.map(([x,y]) => [x,y,floor])
}
