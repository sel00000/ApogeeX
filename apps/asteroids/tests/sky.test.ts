import { describe, it, expect } from "vitest";
import {
  galacticToIcrs,
  galacticToEcliptic,
  eclipticToSkyUv,
  poleToEcliptic,
  PLANET_POLES,
  flightSpeed,
  flightDirection,
  easeStep,
  FLIGHT,
  OBLIQUITY_DEG,
} from "../src/sky";

const rad = Math.PI / 180;
/** Independent textbook equatorial -> ecliptic formulas (Meeus 13.1/13.2). */
function eclipticLonLat(ra: number, dec: number) {
  const e = OBLIQUITY_DEG * rad,
    a = ra * rad,
    d = dec * rad;
  const lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a)) / rad;
  const lat = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a)) / rad;
  return { lon: (lon + 360) % 360, lat };
}
const lonLat = (v: number[]) => ({
  lon: ((Math.atan2(v[1], v[0]) / rad) + 360) % 360,
  lat: Math.asin(v[2]) / rad,
});

describe("Galactic -> ICRS -> ecliptic", () => {
  it("Galactic centre is RA 266.405, Dec -28.936", () => {
    const p = galacticToIcrs(0, 0);
    expect(p.ra).toBeCloseTo(266.405, 2);
    expect(p.dec).toBeCloseTo(-28.936, 2);
  });
  it("north Galactic pole is RA 192.859, Dec +27.128", () => {
    const p = galacticToIcrs(0, 90);
    expect(p.ra).toBeCloseTo(192.859, 2);
    expect(p.dec).toBeCloseTo(27.128, 2);
  });
  it("Galactic centre and pole land at the ecliptic coordinates of their RA/Dec", () => {
    for (const [l, b, ra, dec] of [
      [0, 0, 266.405, -28.936],
      [0, 90, 192.859, 27.128],
    ]) {
      const got = lonLat(galacticToEcliptic(l, b)),
        want = eclipticLonLat(ra, dec);
      expect(got.lon).toBeCloseTo(want.lon, 1);
      expect(got.lat).toBeCloseTo(want.lat, 1);
    }
    // Galactic centre sits about 5.5 degrees south of the ecliptic, near ecliptic longitude 266.8.
    const gc = lonLat(galacticToEcliptic(0, 0));
    expect(gc.lon).toBeCloseTo(266.84, 1);
    expect(gc.lat).toBeCloseTo(-5.54, 1);
  });
  it("is a rotation (unit length preserved)", () => {
    for (const [l, b] of [[10, 20], [200, -60], [359, 1]])
      expect(Math.hypot(...galacticToEcliptic(l, b))).toBeCloseTo(1, 12);
  });
});

describe("Gaia map texture coordinates", () => {
  it("Galactic centre direction samples the image centre", () => {
    const [u, v] = eclipticToSkyUv(galacticToEcliptic(0, 0));
    expect(u).toBeCloseTo(0.5, 9);
    expect(v).toBeCloseTo(0.5, 9);
  });
  it("Galactic longitude increases to the left; north Galactic pole is the top row", () => {
    expect(eclipticToSkyUv(galacticToEcliptic(90, 0))[0]).toBeCloseTo(0.25, 9);
    expect(eclipticToSkyUv(galacticToEcliptic(-90, 0))[0]).toBeCloseTo(0.75, 9);
    expect(eclipticToSkyUv(galacticToEcliptic(0, 89.999))[1]).toBeCloseTo(1, 4);
    expect(eclipticToSkyUv(galacticToEcliptic(0, -30))[1]).toBeCloseTo(1 / 3, 9);
  });
  it("matches the asset pixel formula l = 180 - 360u, b = 90 - 180 v_image", () => {
    for (const [l, b] of [[30, 10], [250, -40], [123, 55]]) {
      const [u, vGl] = eclipticToSkyUv(galacticToEcliptic(l, b));
      expect((((180 - 360 * u) % 360) + 360) % 360).toBeCloseTo(l, 6);
      expect(90 - 180 * (1 - vGl)).toBeCloseTo(b, 6);
    }
  });
});

describe("planet pole orientation", () => {
  it("Earth's pole is the celestial north pole tilted by the obliquity", () => {
    const p = poleToEcliptic(...PLANET_POLES["399"]);
    expect(p[0]).toBeCloseTo(0, 9);
    expect(p[1]).toBeCloseTo(Math.sin(OBLIQUITY_DEG * rad), 6);
    expect(p[2]).toBeCloseTo(Math.cos(OBLIQUITY_DEG * rad), 6);
  });
  it("Uranus' pole lies close to the ecliptic plane (obliquity ~98 deg)", () => {
    const p = poleToEcliptic(...PLANET_POLES["799"]);
    expect(Math.abs(Math.asin(p[2]) / rad)).toBeLessThan(10);
  });
  it("Saturn's pole is tilted about 28 deg from the ecliptic pole", () => {
    const p = poleToEcliptic(...PLANET_POLES["699"]);
    expect(Math.acos(p[2]) / rad).toBeCloseTo(28, 0);
  });
  it("all eight planets have unit pole vectors", () => {
    expect(Object.keys(PLANET_POLES)).toHaveLength(8);
    for (const pole of Object.values(PLANET_POLES))
      expect(Math.hypot(...poleToEcliptic(...pole))).toBeCloseTo(1, 12);
  });
});

describe("WASD flight", () => {
  it("speed is 0.9 x distance to the nearest surface per second", () =>
    expect(flightSpeed(2)).toBeCloseTo(1.8, 12));
  it("has a floor and a ceiling", () => {
    expect(flightSpeed(0)).toBe(FLIGHT.min);
    expect(flightSpeed(-1)).toBe(FLIGHT.min);
    expect(flightSpeed(1e6)).toBe(FLIGHT.max);
    expect(flightSpeed(Infinity)).toBe(FLIGHT.max);
  });
  it("Shift makes it four times faster", () =>
    expect(flightSpeed(0.5, true)).toBeCloseTo(4 * flightSpeed(0.5), 12));
  it("maps keys to camera-local axes and normalises diagonals", () => {
    expect(flightDirection(new Set(["KeyW"]))).toEqual([0, 0, -1]);
    expect(flightDirection(new Set(["KeyS"]))).toEqual([0, 0, 1]);
    expect(flightDirection(new Set(["KeyD"]))).toEqual([1, 0, 0]);
    expect(flightDirection(new Set(["KeyQ"]))).toEqual([0, -1, 0]);
    expect(flightDirection(new Set(["KeyW", "KeyS"]))).toEqual([0, 0, 0]);
    expect(Math.hypot(...flightDirection(new Set(["KeyW", "KeyD", "KeyE"])))).toBeCloseTo(1, 12);
  });
  it("eases over about 0.12 s and is immediate with reduced motion", () => {
    let v = 0;
    for (let t = 0; t < 0.12; t += 1 / 60) v += (1 - v) * easeStep(1 / 60, false);
    expect(v).toBeGreaterThan(0.9);
    expect(easeStep(1 / 60, false)).toBeLessThan(0.5);
    expect(easeStep(1 / 60, true)).toBe(1);
  });
});

import { markSkyUnavailable } from "../src/sky";
describe("markSkyUnavailable", () => {
  it("unticks and disables the box and sets the title key", () => {
    const box = { checked: true, disabled: false };
    const attrs: Record<string, string> = {};
    markSkyUnavailable(box, { setAttribute: (k, v) => (attrs[k] = v) });
    expect(box).toEqual({ checked: false, disabled: true });
    expect(attrs["data-i18n-title"]).toBe("o.skyFail");
  });
});
