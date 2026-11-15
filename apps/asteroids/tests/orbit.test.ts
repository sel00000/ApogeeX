import { it, expect } from "vitest";
import { orbitPath, asteroidScale } from "../src/orbits";
it("circular Kepler orbit passes through its state and closes", () => {
  const mu = 0.0002959122082855911;
  const p = orbitPath([0, 1, 0, 0, 0, Math.sqrt(mu), 0], 128);
  expect(p).toHaveLength(129);
  for (const q of p) expect(Math.hypot(...q)).toBeCloseTo(1, 8);
  expect(p[0]).toEqual(p.at(-1));
});
it("asteroid remains at least ten times smaller than Earth marker", () => {
  for (let i = 0; i < 100; i++)
    expect(asteroidScale(String(i)) * 1.65 * 1.16).toBeLessThan(0.027 / 10);
});
it("eccentric inclined reference passes through the input state and lies in its orbital plane", () => {
  const p = orbitPath([0, 1.2, 0.3, 0.2, -0.004, 0.013, 0.006]);
  expect(p.length).toBeGreaterThan(100);
  for (let i = 0; i < 3; i++)
    expect(p[0][i]).toBeCloseTo([1.2, 0.3, 0.2][i], 10);
  const h = [
    0.3 * 0.006 - 0.2 * 0.013,
    0.2 * -0.004 - 1.2 * 0.006,
    1.2 * 0.013 - 0.3 * -0.004,
  ];
  for (const q of p)
    expect(q.reduce((s, v, i) => s + v * h[i], 0)).toBeCloseTo(0, 10);
});
