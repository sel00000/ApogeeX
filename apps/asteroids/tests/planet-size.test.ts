import { describe, it, expect } from "vitest";
import { drawRadius, planetDrawRadius, pixelsPerAu, PLANET_SIZE_CAP } from "../src/sky";

describe("planet draw radius", () => {
  const earth = 0.027;
  it("reaches the minimum on screen far away", () => {
    const ppa = pixelsPerAu(11.4, 45, 900);
    const r = planetDrawRadius(earth, 9, ppa, 1);
    expect(r * ppa).toBeCloseTo(9, 6);
    expect(r).toBeGreaterThan(earth);
  });
  it("returns the true radius near the planet", () => {
    const ppa = pixelsPerAu(0.05, 45, 900);
    expect(planetDrawRadius(earth, 9, ppa, 1)).toBe(earth);
  });
  it("caps at 0.22 x the distance from the Sun", () => {
    const ppa = pixelsPerAu(60, 45, 900);
    expect(PLANET_SIZE_CAP).toBe(0.22);
    expect(planetDrawRadius(0.013, 7, ppa, 0.39)).toBeCloseTo(0.22 * 0.39, 9);
  });
  it("never shrinks below the true radius even if the cap is smaller", () => {
    expect(drawRadius(0.12, 11, 1, 0.05)).toBe(0.12);
  });
  it("gives the true radius in observer mode", () => {
    const ppa = pixelsPerAu(11.4, 45, 900);
    expect(planetDrawRadius(earth, 9, ppa, 1, true)).toBe(earth);
  });
  it("ignores a bad scale", () => {
    expect(drawRadius(earth, 9, 0, 1)).toBe(earth);
    expect(drawRadius(earth, 9, Infinity, 1)).toBe(earth);
  });
});
