import * as T from "three";
import type { Observation, Sightline } from "./types";
export function calibratedPose(
  o: Observation,
  f: Sightline,
  range: number,
  aspect: number,
) {
  if (!o.spacecraft) throw Error("SPHEREx position missing");
  const position = new T.Vector3(...o.spacecraft),
    forward = new T.Vector3(...f.forward),
    up = new T.Vector3(...f.up);
  const halfWidth = Math.max(Math.abs(f.bounds[0]), Math.abs(f.bounds[1])),
    halfHeight = Math.max(Math.abs(f.bounds[2]), Math.abs(f.bounds[3]));
  // Leave room for controls, but preserve angular mapping of every image vertex.
  const tangent = Math.max(halfHeight / 0.68, halfWidth / (aspect * 0.88));
  return {
    position,
    target: position.clone().addScaledVector(forward, range),
    up,
    fov: (2 * Math.atan(tangent) * 180) / Math.PI,
  };
}
export function planeGeometry(f: Sightline) {
  const n = f.segments,
    p: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++) {
      const v = f.grid[y * (n + 1) + x];
      p.push(v[0], v[1], 0);
      uv.push(x / n, y / n);
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x,
        b = a + 1,
        c = a + n + 1,
        d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  return g;
}
/** Interpolate the exact same triangle split as the image mesh, in FITS pixel coordinates. */
export function planePoint(
  f: Sightline,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const n = f.segments,
    gx = ((x + 0.5) / width) * n,
    gy = ((y + 0.5) / height) * n,
    ix = Math.min(n - 1, Math.floor(gx)),
    iy = Math.min(n - 1, Math.floor(gy)),
    a = gx - ix,
    b = gy - iy;
  const p = f.grid[iy * (n + 1) + ix],
    q = f.grid[iy * (n + 1) + ix + 1],
    r = f.grid[(iy + 1) * (n + 1) + ix],
    s = f.grid[(iy + 1) * (n + 1) + ix + 1];
  return p.map((_, i) =>
    a + b <= 1
      ? p[i] + (q[i] - p[i]) * a + (r[i] - p[i]) * b
      : s[i] + (r[i] - s[i]) * (1 - a) + (q[i] - s[i]) * (1 - b),
  );
}
