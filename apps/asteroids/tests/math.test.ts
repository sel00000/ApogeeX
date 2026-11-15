import { describe, it, expect } from "vitest";
import { interpolate, seed, utcToTdb } from "../src/math";
describe("physical time interpolation", () => {
  const s = [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 3, 0, 0],
  ];
  it("reproduces cubic using position and velocity", () =>
    expect(interpolate(s, 0.5)[0]).toBeCloseTo(0.125, 12));
  it("keeps endpoints", () => expect(interpolate(s, 1)[0]).toBe(1));
  it("refuses extrapolation", () => expect(() => interpolate(s, 2)).toThrow());
  it("stable identity seeds", () => {
    expect(seed("433")).toBe(seed("433"));
    expect(seed("433")).not.toBe(seed("434"));
  });
  it("converts UTC to TDB approximately within documented milliseconds", () =>
    expect((utcToTdb(60800) - 60800) * 86400).toBeCloseTo(69.184, 3));
});
import { skyDirection } from "../src/math";
describe("ICRS direction to ecliptic scene", () => {
  it("keeps equinox axis", () => expect(skyDirection(0, 0)).toEqual([1, 0, 0]));
  it("rotates celestial north to ecliptic obliquity", () => {
    const v = skyDirection(0, 90);
    expect(v[1]).toBeCloseTo(0.397777156, 7);
    expect(v[2]).toBeCloseTo(0.917482062, 7);
  });
  it("remains unit length", () => {
    const v = skyDirection(223, -12);
    expect(Math.hypot(...v)).toBeCloseTo(1, 12);
  });
});
