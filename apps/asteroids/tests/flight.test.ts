import { describe, expect, it } from "vitest";
import {
  CONTROLS,
  FLIGHT_KEYS,
  IDLE,
  dragLook,
  liftInput,
  liftStep,
  lookAngles,
  lookInput,
  lookVector,
  throttleStep,
  turn,
  type Throttle,
} from "../src/flight";

const keys = (...k: string[]) => new Set(k);
const run = (s: Throttle, k: Set<string>, seconds: number, reduced = false, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) s = throttleStep(s, k, dt, reduced);
  return s;
};

describe("throttle", () => {
  it("W ramps to full in about 1.2 s and no further", () => {
    expect(run(IDLE, keys("KeyW"), 0.6).value).toBeCloseTo(0.5, 6);
    expect(run(IDLE, keys("KeyW"), 1.2).value).toBeCloseTo(1, 6);
    expect(run(IDLE, keys("KeyW"), 3).value).toBe(1);
  });
  it("releasing W keeps the speed (coasting)", () => {
    const s = run(IDLE, keys("KeyW"), 0.6);
    expect(run(s, keys(), 5).value).toBe(s.value);
  });
  it("S slows to rest, pauses, then reverses down to -0.5", () => {
    const full = run(IDLE, keys("KeyW"), 2);
    const atRest = run(full, keys("KeyS"), 1.2);
    expect(atRest.value).toBeCloseTo(0, 6);
    const paused = run({ ...atRest, value: 0 }, keys("KeyS"), 0.2);
    expect(paused.value).toBe(0);
    const back = run(IDLE, keys("KeyS"), 0.6);
    expect(back.value).toBeCloseTo(-0.25, 1);
    expect(back.value).toBeLessThan(0);
    expect(back.value).toBeGreaterThan(CONTROLS.reverseLimit);
    expect(run(IDLE, keys("KeyS"), 5).value).toBe(CONTROLS.reverseLimit);
  });
  it("X brakes full throttle to zero within 0.6 s, also when tapped", () => {
    const full = run(IDLE, keys("KeyW"), 2);
    const tapped = throttleStep({ ...full, braking: true }, keys(), 1 / 60, false);
    expect(tapped.value).toBeLessThan(1);
    expect(tapped.braking).toBe(true);
    const stopped = run({ ...full, braking: true }, keys(), CONTROLS.brakeSeconds + 0.02);
    expect(stopped).toEqual({ value: 0, rest: 0, braking: false });
    expect(run(full, keys("KeyX", "KeyW"), 0.62).value).toBe(0);
    expect(run(run(IDLE, keys("KeyS"), 5), keys("KeyX"), 0.31).value).toBe(0);
  });
  it("W and S together hold the throttle", () => {
    const s = run(IDLE, keys("KeyW"), 0.6);
    expect(run(s, keys("KeyW", "KeyS"), 1).value).toBe(s.value);
  });
  it("reduced motion: moves only while held, no ramp, no coasting", () => {
    const fast = run(IDLE, keys("KeyW"), 2);
    expect(throttleStep(IDLE, keys("KeyW"), 1 / 60, true).value).toBe(1);
    expect(throttleStep(fast, keys(), 1 / 60, true).value).toBe(0);
    expect(throttleStep(IDLE, keys("KeyS"), 1 / 60, true).value).toBe(CONTROLS.reverseLimit);
    expect(throttleStep(fast, keys("KeyW", "KeyX"), 1 / 60, true).value).toBe(0);
  });
});

describe("lift", () => {
  it("Shift is up, Space is down", () => {
    expect(liftInput(keys("ShiftLeft"))).toBe(1);
    expect(liftInput(keys("ShiftRight"))).toBe(1);
    expect(liftInput(keys("Space"))).toBe(-1);
    expect(liftInput(keys("ShiftLeft", "Space"))).toBe(0);
  });
  it("reaches 0.6 of full speed while held and falls back to 0 after release", () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = liftStep(v, keys("ShiftLeft"), 1 / 60, false);
    expect(v).toBeGreaterThan(0.59);
    expect(v).toBeLessThanOrEqual(CONTROLS.lift);
    for (let i = 0; i < 120; i++) v = liftStep(v, keys(), 1 / 60, false);
    expect(v).toBe(0);
  });
  it("X stops it at once; reduced motion follows the keys at once", () => {
    expect(liftStep(0.6, keys("KeyX", "ShiftLeft"), 1 / 60, false)).toBe(0);
    expect(liftStep(0, keys("Space"), 1 / 60, true)).toBe(-CONTROLS.lift);
    expect(liftStep(0.6, keys(), 1 / 60, true)).toBe(0);
  });
});

describe("look", () => {
  it("A and left arrow turn left (+yaw), D and right arrow right, arrows tilt", () => {
    expect(lookInput(keys("KeyA"))).toEqual([1, 0]);
    expect(lookInput(keys("ArrowLeft"))).toEqual([1, 0]);
    expect(lookInput(keys("KeyD"))).toEqual([-1, 0]);
    expect(lookInput(keys("ArrowRight", "ArrowUp"))).toEqual([-1, 1]);
    expect(lookInput(keys("ArrowDown"))).toEqual([0, -1]);
    expect(lookInput(keys("KeyA", "KeyD"))).toEqual([0, 0]);
    expect(lookInput(keys("KeyW", "KeyS"))).toEqual([0, 0]);
  });
  it("dragging right turns right, dragging down looks down, 0.003 rad per pixel", () => {
    const [dy, dp] = dragLook(200, 100);
    expect(dy).toBeCloseTo(-0.6, 12);
    expect(dp).toBeCloseTo(-0.3, 12);
  });
  it("clamps pitch and wraps yaw", () => {
    expect(turn(0, 1.5, 0, 1)[1]).toBe(CONTROLS.pitchLimit);
    expect(turn(0, -1.5, 0, -1)[1]).toBe(-CONTROLS.pitchLimit);
    const [y] = turn(3, 0, 0.5, 0);
    expect(y).toBeCloseTo(3.5 - 2 * Math.PI, 12);
  });
  it("angles and vectors round-trip; +yaw rotates counter-clockwise about +Z", () => {
    const v = lookVector(0.7, -0.4);
    expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    const [y, p] = lookAngles(v);
    expect(y).toBeCloseTo(0.7, 12);
    expect(p).toBeCloseTo(-0.4, 12);
    const left = lookVector(Math.PI / 2, 0);
    expect(left[1]).toBeCloseTo(1, 12);
  });
  it("binds the reference keys and not the old Q, E", () => {
    for (const k of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyX", "Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
      expect(FLIGHT_KEYS.has(k)).toBe(true);
    expect(FLIGHT_KEYS.has("KeyQ")).toBe(false);
    expect(FLIGHT_KEYS.has("KeyE")).toBe(false);
  });
});
