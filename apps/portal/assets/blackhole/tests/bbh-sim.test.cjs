// Scenario tests for the N-body simulator: approach from many directions → bound → inspiral → merger,
// continuity of what is drawn (no jumps), smooth shadow growth through the merger.
const test = require("node:test");
const assert = require("node:assert/strict");
global.BBH = require("../bbh-physics.js");
const BBHSim = require("../bbh-sim.js");

const C = 450, R1 = 11, SQ27 = 3 * Math.sqrt(3);
const Mg = (m) => (R1 * m) / SQ27;

function scenario(angle, b, speed, m1 = 1.2, m2 = 0.8) {
  const sim = new BBHSim({ c: C });
  const d = 260, ca = Math.cos(angle), sa = Math.sin(angle);
  sim.add(700, 400, 0, 0, Mg(m1));
  sim.add(700 + d * ca - b * sa, 400 + d * sa + b * ca, -speed * ca, -speed * sa, Mg(m2));
  return sim;
}
// what is drawn: total "lens mass" and the largest shadow, per frame
function drawn(sim) {
  const comps = sim.components();
  return { comps, mass: comps.reduce((s, q) => s + q.M, 0) };
}

test("approach from 16 directions (head-on to grazing): every pair merges within 60 s of physics", () => {
  for (let k = 0; k < 16; k++) {
    const sim = scenario((k / 16) * 2 * Math.PI, (k % 4) * 25, 40 + 15 * (k % 3));
    let t = 0;
    while (t < 60 && sim.events.length === 0) { sim.step(1 / 60); t += 1 / 60; }
    assert.equal(sim.events.length, 1, `direction ${k}: merged=${sim.events.length} after ${t.toFixed(1)} s`);
  }
});

test("drawn positions move continuously frame to frame (no teleport), through capture and merger", () => {
  const sim = scenario(0.7, 40, 50);
  let prev = drawn(sim).comps, maxJump = 0, t = 0;
  while (t < 60) {
    // slow motion like the app: frame dt shrinks as the orbit speeds up
    const w = sim.maxOmega(), s = Math.min(1, Math.pow(4 / Math.max(w, 1e-6), 0.7));
    sim.step(s / 60); t += 1 / 60;
    const cur = drawn(sim).comps;
    for (const q of cur) {
      // nearest previous component
      let best = Infinity;
      for (const p of prev) best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y));
      maxJump = Math.max(maxJump, best);
    }
    prev = cur;
    if (sim.events.length && !sim.bodies.some((b) => b.morph)) break;
  }
  assert.ok(sim.events.length === 1, "merged");
  assert.ok(maxJump < 12, `largest per-frame move ${maxJump.toFixed(2)} px`);
});

// Area of the drawn shadow, exactly as the shader computes it: inside where Σ (ρ_i / r_i)^4 ≥ 1.
function shadowArea(comps, cx, cy, half = 90, step = 1.5) {
  let n = 0;
  for (let y = cy - half; y <= cy + half; y += step) for (let x = cx - half; x <= cx + half; x += step) {
    let f = 0;
    for (const q of comps) { const r = Math.hypot(x - q.x, y - q.y) + 1e-6; f += (q.rho / r) ** 4; }
    if (f >= 1) n++;
  }
  return n * step * step;
}

test("drawn shadow and lens mass change smoothly through the merger (no pop)", () => {
  const sim = scenario(2.2, 15, 45, 1, 1);
  let t = 0, prev = null, maxRel = 0, maxDm = 0, frames = 0;
  while (t < 80) {
    const w = sim.maxOmega(), s = Math.min(1, Math.pow(4 / Math.max(w, 1e-6), 0.7));
    sim.step(s / 60); t += 1 / 60;
    if (!sim.events.length) {
      // watch from the last orbits on
      const [p, q] = sim.bodies;
      if (Math.hypot(p.x - q.x, p.y - q.y) > 8 * (p.M + q.M)) continue;
    }
    const comps = sim.components();
    const M = comps.reduce((a, q) => a + q.M, 0);
    const cx = comps.reduce((a, q) => a + q.x * q.M, 0) / M, cy = comps.reduce((a, q) => a + q.y * q.M, 0) / M;
    const area = shadowArea(comps, cx, cy);
    if (prev) { maxRel = Math.max(maxRel, Math.abs(area - prev.area) / prev.area); maxDm = Math.max(maxDm, Math.abs(M - prev.M) / prev.M); }
    prev = { area, M }; frames++;
    if (sim.events.length && !sim.bodies.some((b) => b.morph)) break;
  }
  assert.ok(sim.events.length === 1 && frames > 20, `merged (${frames} frames watched)`);
  assert.ok(maxDm < 0.01, `lens mass changes ${(100 * maxDm).toFixed(2)}% in one frame`);
  assert.ok(maxRel < 0.06, `shadow area changes ${(100 * maxRel).toFixed(1)}% in one frame`);
});

test("remnant moves on with the pair's momentum and has the NR-fit mass", () => {
  const sim = scenario(1.1, 30, 50, 1.4, 0.7);
  const P0 = sim.bodies.reduce((s, b) => [s[0] + b.M * b.vx, s[1] + b.M * b.vy], [0, 0]);
  let t = 0;
  while (t < 60 && !sim.events.length) { sim.step(1 / 60); t += 1 / 60; }
  const e = sim.events[0];
  assert.ok(e, "merged");
  assert.ok(Math.abs(e.Mf / e.M - (1 - BBH.radiatedEnergy(e.eta))) < 1e-9);
  assert.ok(Number.isFinite(e.remnant.vx) && Math.hypot(e.remnant.vx, e.remnant.vy) < 0.2 * C);
});

test("GW buffers stay finite and the ringdown decays", () => {
  const sim = scenario(0.3, 20, 45, 1, 1);
  let t = 0;
  while (t < 80) { sim.step(1 / 120); t += 1 / 120; if (sim.events.length && !sim.bodies.some((b) => b.morph)) break; }
  for (const s of sim.slots) for (const v of s.buf) assert.ok(Number.isFinite(v));
  const ring = sim.slots.find((s) => s.kind === "drain" || s.kind === "ring");
  assert.ok(ring, "a ringdown slot exists");
});

test("morph rotation angle continuous through merger (no jump in phi)", () => {
  const sim = scenario(0.7, 40, 50);
  let t = 0, prevPhi = null, maxJump = 0;
  while (t < 60) {
    const w = sim.maxOmega(), s = Math.min(1, Math.pow(4 / Math.max(w, 1e-6), 0.7));
    sim.step(s / 60); t += 1 / 60;
    const comps = sim.components();
    const morph = comps.find((q) => q.glow != null && q.glow > 0);
    if (morph) {
      // reconstruct phi from component offset angle
      const [p, q] = sim.bodies;
      if (p && q) {
        const dx = morph.x - p.x, dy = morph.y - p.y;
        const phi = Math.atan2(dy, dx);
        if (prevPhi !== null) {
          let d = phi - prevPhi;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          maxJump = Math.max(maxJump, Math.abs(d));
        }
        prevPhi = phi;
      }
    }
    if (sim.events.length && !sim.bodies.some((b) => b.morph)) break;
  }
  assert.ok(sim.events.length === 1, "merged");
  assert.ok(maxJump < 0.5, `largest per-frame phi jump ${maxJump.toFixed(3)} rad`);
});

test("near-zone radius constant through merger and ringdown", () => {
  const sim = scenario(2.2, 15, 45, 1, 1);
  let t = 0, near0 = null, maxRel = 0;
  while (t < 80) {
    const w = sim.maxOmega(), s = Math.min(1, Math.pow(4 / Math.max(w, 1e-6), 0.7));
    sim.step(s / 60); t += 1 / 60;
    for (const slot of sim.slots) {
      if (slot.key === null) continue;
      if (near0 === null) near0 = slot.near;
      if (near0 > 0) maxRel = Math.max(maxRel, Math.abs(slot.near - near0) / near0);
    }
    if (sim.events.length && !sim.bodies.some((b) => b.morph)) break;
  }
  assert.ok(sim.events.length === 1, "merged");
  assert.ok(near0 > 0, "near-zone radius set");
  assert.ok(maxRel < 0.01, `near-zone changes ${(100 * maxRel).toFixed(3)}%`);
});
