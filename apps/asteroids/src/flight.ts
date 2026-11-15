/** Pure model of the free-flight controls in the Orbit 3D scene (no three.js, no DOM).
 * Angles in radians; yaw is measured about +Z (ecliptic north) from +X, pitch from the ecliptic plane.
 * Throttle and lift are fractions of the local full speed (flightSpeed of the distance to the nearest surface). */
export type Vec3 = [number, number, number];

export const CONTROLS = {
  /** A, D and the arrow keys turn the view at this rate (rad/s). */
  lookRate: 1.2,
  /** Left-drag look (rad per pixel). Dragging right turns right, dragging down looks down. */
  dragLook: 0.003,
  /** Pitch limit (rad). */
  pitchLimit: 1.55,
  /** Seconds W takes from 0 to full throttle (S ramps down at the same rate). */
  rampSeconds: 1.2,
  /** Seconds X takes to bring full throttle to rest. */
  brakeSeconds: 0.6,
  /** Seconds S must keep being held at rest before it starts to reverse. */
  reverseDelay: 0.3,
  /** Lowest throttle (reverse). */
  reverseLimit: -0.5,
  /** Vertical speed while Shift or Space is held, as a fraction of the local full speed. */
  lift: 0.6,
  /** Time constant (s) of the vertical speed following the keys. */
  liftSeconds: 0.2,
};

export const FLIGHT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyX",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

export interface Throttle {
  /** Fraction of full speed along the look direction, in [reverseLimit, 1]. */
  value: number;
  /** Seconds S has been held with the throttle at rest. */
  rest: number;
  /** X was pressed and the throttle is still on its way to zero. */
  braking: boolean;
}
export const IDLE: Throttle = { value: 0, rest: 0, braking: false };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toward = (v: number, goal: number, step: number) =>
  v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step);

/** One frame of throttle. W raises it, S lowers it to rest and then (after reverseDelay) into reverse,
 * no key keeps it (coasting), X brakes it to zero. Reduced motion: held keys only, no ramps, no coasting. */
export function throttleStep(s: Throttle, keys: ReadonlySet<string>, dt: number, reduced: boolean): Throttle {
  const w = keys.has("KeyW"),
    back = keys.has("KeyS"),
    x = keys.has("KeyX");
  if (reduced) {
    const value = x || w === back ? 0 : w ? 1 : CONTROLS.reverseLimit;
    return { value, rest: 0, braking: false };
  }
  dt = Math.max(0, dt);
  let braking = x || (s.braking && !w && !back);
  if (braking) {
    const value = toward(s.value, 0, dt / CONTROLS.brakeSeconds);
    if (value === 0 && !x) braking = false;
    return { value, rest: 0, braking };
  }
  const ramp = dt / CONTROLS.rampSeconds;
  if (w && !back) return { value: Math.min(1, s.value + ramp), rest: 0, braking: false };
  if (back && !w) {
    if (s.value > 0) return { value: Math.max(0, s.value - ramp), rest: 0, braking: false };
    if (s.value === 0 && s.rest + dt < CONTROLS.reverseDelay)
      return { value: 0, rest: s.rest + dt, braking: false };
    return { value: Math.max(CONTROLS.reverseLimit, s.value - ramp), rest: 0, braking: false };
  }
  return { value: s.value, rest: 0, braking: false };
}

/** Vertical key input: +1 Shift (up), -1 Space (down), 0 both or neither. */
export function liftInput(keys: ReadonlySet<string>) {
  return (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1 : 0) - (keys.has("Space") ? 1 : 0);
}
/** One frame of vertical speed (fraction of full speed): follows the keys with liftSeconds easing,
 * at once with reduced motion; X stops it at once. */
export function liftStep(current: number, keys: ReadonlySet<string>, dt: number, reduced: boolean) {
  if (keys.has("KeyX")) return 0;
  const goal = liftInput(keys) * CONTROLS.lift;
  if (reduced) return goal;
  const next = current + (goal - current) * (1 - Math.exp(-Math.max(0, dt) / CONTROLS.liftSeconds));
  return goal === 0 && Math.abs(next) < 0.005 ? 0 : next;
}

/** Held look keys -> [yaw, pitch] rate in units of lookRate. Positive yaw turns left, positive pitch looks up. */
export function lookInput(keys: ReadonlySet<string>): [number, number] {
  const left = keys.has("KeyA") || keys.has("ArrowLeft"),
    right = keys.has("KeyD") || keys.has("ArrowRight");
  return [
    (left ? 1 : 0) - (right ? 1 : 0),
    (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0),
  ];
}
/** Mouse drag in pixels (screen x right, y down) -> [yaw, pitch] change. Right turns right, down looks down. */
export function dragLook(dx: number, dy: number): [number, number] {
  return [-dx * CONTROLS.dragLook, -dy * CONTROLS.dragLook];
}
/** Apply a look change: yaw wrapped to (-pi, pi], pitch clamped to the limit. */
export function turn(yaw: number, pitch: number, dYaw: number, dPitch: number): [number, number] {
  let y = yaw + dYaw;
  y = Math.atan2(Math.sin(y), Math.cos(y));
  return [y, clamp(pitch + dPitch, -CONTROLS.pitchLimit, CONTROLS.pitchLimit)];
}
/** Unit look direction -> [yaw, pitch]. */
export function lookAngles(d: Vec3): [number, number] {
  const n = Math.hypot(d[0], d[1], d[2]) || 1;
  return [Math.atan2(d[1], d[0]), Math.asin(clamp(d[2] / n, -1, 1))];
}
/** [yaw, pitch] -> unit look direction. */
export function lookVector(yaw: number, pitch: number): Vec3 {
  return [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)];
}
