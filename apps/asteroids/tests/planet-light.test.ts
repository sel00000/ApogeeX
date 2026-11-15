import { describe, expect, it } from "vitest";
import { illustrativeLight, illustrativeWeight } from "../src/sky";

describe("illustrative planet lighting", () => {
  it("keeps the true light at k = 0", () => {
    for (const l of [0.12, 0.5, 1]) expect(illustrativeLight(l, 0)).toBe(l);
  });
  it("lifts the night side to at least 0.58 and keeps the day side at 1 at k = 1", () => {
    expect(illustrativeLight(0.12, 1)).toBeGreaterThanOrEqual(0.58);
    expect(illustrativeLight(0, 1)).toBeCloseTo(0.58, 10);
    expect(illustrativeLight(1, 1)).toBeCloseTo(1, 10);
  });
  it("weight is smoothstep(1, 2.5, s)", () => {
    expect(illustrativeWeight(1)).toBe(0);
    expect(illustrativeWeight(0.5)).toBe(0);
    expect(illustrativeWeight(2.5)).toBe(1);
    expect(illustrativeWeight(10)).toBe(1);
    expect(illustrativeWeight(1.75)).toBeCloseTo(0.5, 10);
  });
});
