// node --test tests/ — checks from 03_EQUATIONS_AND_VALIDATION.md §E plus PN equations-of-motion checks.
const test = require("node:test");
const assert = require("node:assert/strict");
const BBH = require("../bbh-physics.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// RK4 on the relative orbit, G = c = M = 1
function integrate(state, eta, T, h, opt = {}) {
  const f = (s) => {
    const [x, y, vx, vy] = s;
    const r = Math.hypot(x, y);
    const pn1 = opt.pn1 === "taper" ? BBH.pn1Taper(r, 1) : (opt.pn1 ?? 0);
    let [ax, ay] = BBH.relAccel(x, y, vx, vy, 1, eta, 1, pn1, opt.rr ?? 0);
    if (opt.env) {
      const L = x * vy - y * vx;
      const sense = Math.abs(L) > 0.05 * Math.sqrt(r) ? Math.sign(L) : 1;
      const [ex, ey] = BBH.envAccel(x, y, vx, vy, 1, eta, 1, sense); ax += ex; ay += ey;
    }
    return [vx, vy, ax, ay];
  };
  let s = state.slice(), t = 0;
  const out = { min: Infinity, trace: [] };
  while (t < T) {
    const k1 = f(s), k2 = f(s.map((v, i) => v + 0.5 * h * k1[i])), k3 = f(s.map((v, i) => v + 0.5 * h * k2[i])), k4 = f(s.map((v, i) => v + h * k3[i]));
    s = s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += h;
    const r = Math.hypot(s[0], s[1]);
    out.min = Math.min(out.min, r);
    if (opt.onStep && opt.onStep(s, t)) break;
    if (opt.stopR && r < opt.stopR) { out.stopped = t; break; }
  }
  out.state = s; out.t = t;
  return out;
}

test("BBH-01 eta range", () => {
  close(BBH.eta(1, 1), 0.25, 1e-15, "equal");
  assert.throws(() => BBH.eta(0, 1));
});

test("Newtonian circular orbit stays circular (no PN, no RR)", () => {
  const r0 = 20, v = Math.sqrt(1 / r0);
  const o = integrate([r0, 0, 0, v], 0.25, 2 * Math.PI * r0 ** 1.5 * 3, 0.5);
  close(Math.hypot(o.state[0], o.state[1]), r0, 1e-4, "radius after 3 orbits");
});

test("1PN: periastron advance per orbit ≈ 6πM / (a(1−e²))", () => {
  const a = 60, e = 0.4, rp = a * (1 - e);
  const vp = Math.sqrt((1 + e) / rp);   // Newtonian periastron speed
  let lastAng = null, prevR = rp, prevPrev = rp, peri = [];
  integrate([rp, 0, 0, vp], 0.25, 2 * Math.PI * a ** 1.5 * 3.2, 0.2, {
    pn1: 1,
    onStep: (s) => {
      const r = Math.hypot(s[0], s[1]);
      if (prevR < prevPrev && prevR < r) peri.push(Math.atan2(s[1], s[0]));
      prevPrev = prevR; prevR = r;
    },
  });
  assert.ok(peri.length >= 1, "found a periastron");
  let d = peri[0]; if (d < 0) d += 2 * Math.PI;      // started at periastron on the +x axis
  const expected = (6 * Math.PI) / (a * (1 - e * e));
  close(d, expected, 0.25 * expected, "advance (rad/orbit, 1PN harmonic vs Newtonian-orbit estimate)");
});

test("2.5PN: circular decay rate matches Peters da/dt = −(64/5) η M³/a³", () => {
  const eta = 0.25, r0 = 30, v = Math.sqrt(1 / r0);
  const T = 2000;
  const o = integrate([r0, 0, 0, v], eta, T, 0.5, { rr: 1 });
  const rNum = Math.hypot(o.state[0], o.state[1]);
  const rPeters = BBH.inspiralX(eta, r0, T);
  close(rNum, rPeters, 0.01 * r0, "radius after 2000 M");
});

test("2.5PN: orbit-averaged energy loss of an eccentric orbit matches Peters–Mathews", () => {
  const eta = 0.25, a = 40, e = 0.5, rp = a * (1 - e), vp = Math.sqrt((1 + e) / rp);
  const P = 2 * Math.PI * a ** 1.5;
  const E = (s) => 0.5 * (s[2] ** 2 + s[3] ** 2) - 1 / Math.hypot(s[0], s[1]);
  const s0 = [rp, 0, 0, vp];
  // stop exactly at the 5th periastron so the Schott (oscillating) terms average out
  let pr = rp, pp = rp, n = 0;
  const o = integrate(s0, eta, 20 * P, 0.02, { rr: 1, onStep: (s) => {
    const r = Math.hypot(s[0], s[1]); const hit = pr < pp && pr < r; pp = pr; pr = r; return hit && ++n === 5;
  } });
  // energy per reduced mass: dE/dt = −(32/5) η M⁴/a⁵ f(e) (per μ), f = (1 + 73/24 e² + 37/96 e⁴)/(1−e²)^{7/2}
  const f = (1 + (73 / 24) * e * e + (37 / 96) * e ** 4) / Math.pow(1 - e * e, 3.5);
  const expected = -(32 / 5) * eta * f / a ** 5 * o.t;
  close(E(o.state) - E(s0), expected, 0.08 * Math.abs(expected), "ΔE over 5 orbits");
});

test("full model (PN tapered): a plunge from 14M reaches 3M, no NaN, never moves back out by more than 2%", () => {
  const r0 = 14, v = BBH.circularSpeed(r0, 1, 0.25, 1);   // circular under the same (PN) equations
  let last = Infinity, ok = true;
  const o = integrate([r0, 0, 0, v], 0.25, 1e5, 0.05, {
    pn1: "taper", rr: 1, stopR: 3,
    onStep: (s) => {
      for (const q of s) if (!Number.isFinite(q)) ok = false;
      const r = Math.hypot(s[0], s[1]);
      // the PN taper (12M → 6M) changes the force law slowly; allow a wobble below 2% of r
      last = Math.min(last, r);
      if ((r - last) / r > 0.02) ok = false;
      return !ok;
    },
  });
  assert.ok(ok, "finite, and r never grows back by more than 2%");
  assert.ok(o.stopped > 0, "reached 3M");
});

// note: the 1PN taper used in the app
test("capture: close approaches from any direction merge (env drag + RR), none escape", () => {
  let merged = 0, tries = 0;
  for (let k = 0; k < 24; k++) {
    const ang = (k / 24) * 2 * Math.PI;
    const b = (k % 4) * 3;                       // impact parameter 0..9 M (head-on included)
    const speed = 0.08 + 0.04 * (k % 3);          // relative speed 0.08–0.16 c (unbound)
    const x0 = 30, vx = -speed;
    const c = Math.cos(ang), s = Math.sin(ang);
    const st = [x0 * c - b * s, x0 * s + b * c, vx * c, vx * s];
    tries++;
    const o = integrate(st, 0.22, 4e4, 0.05, { pn1: "taper", rr: 1, env: 1, stopR: 3 });
    if (o.stopped) merged++;
  }
  assert.equal(merged, tries, `${merged}/${tries} merged`);
});

test("remnant fits for an equal-mass, non-spinning binary", () => {
  const r = BBH.remnant(0.25);
  close(1 - r.Mf, 0.0484, 0.0005, "radiated energy ≈ 4.8% M");
  close(r.af, 0.686, 0.003, "final spin");
  close(r.wRD * r.Mf, 0.53, 0.003, "M_f ω_22");
  close(r.tauD / r.Mf, 12.3, 0.3, "τ_d / M_f");
});

test("quadrupole of a circular orbit: |Q̈| = 2 μ a² Ω² (geometric units)", () => {
  const a = 10, w = Math.sqrt(1 / a ** 3), mu = 0.25;
  const [A, B] = BBH.quadrupoleDDot(a, 0, 0, a * w, -a * w * w, 0, mu, 1);
  close(Math.hypot(A, B), 2 * mu * a * a * w * w, 1e-12, "amplitude");
});

test("2PN coefficients: the 2PN energy is conserved by the conservative 2PN dynamics", () => {
  // eccentric orbit around r ~ 15–40 M, c = G = M = 1; compare drift of E_N+E_1PN vs E_N+E_1PN+E_2PN
  const eta = 0.2, a = 25, e = 0.45, rp = a * (1 - e), vp = Math.sqrt((1 + e) / rp) * 0.97;
  const en = (s) => {
    const r = Math.hypot(s[0], s[1]), rd = (s[0] * s[2] + s[1] * s[3]) / r, v2 = s[2] ** 2 + s[3] ** 2;
    return BBH.energy2PN(rd, v2, 1 / r, eta);
  };
  let s = [rp, 0, 0, vp];
  const f = (q) => { const [ax, ay] = BBH.relAccel(q[0], q[1], q[2], q[3], 1, eta, 1, 1, 0); return [q[2], q[3], ax, ay]; };
  const e0 = en(s);
  let d1 = 0, d2 = 0;
  const h = 0.02, T = 2 * Math.PI * a ** 1.5 * 2;
  for (let t = 0; t < T; t += h) {
    const k1 = f(s), k2 = f(s.map((v, i) => v + 0.5 * h * k1[i])), k3 = f(s.map((v, i) => v + 0.5 * h * k2[i])), k4 = f(s.map((v, i) => v + h * k3[i]));
    s = s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    const E = en(s);
    d1 = Math.max(d1, Math.abs(E.EN + E.E1 - (e0.EN + e0.E1)));
    d2 = Math.max(d2, Math.abs(E.E - e0.E));
  }
  // with the right 2PN terms the 2PN energy is constant to O(1/c⁶): far better than the 1PN energy
  assert.ok(d2 < d1 / 8, `2PN energy drift ${d2.toExponential(2)} vs 1PN-only ${d1.toExponential(2)}`);
});

test("2PN coefficients: circular-orbit frequency matches Ω² = (M/r³)[1 + (ν−3)γ + (6 + 41ν/4 + ν²)γ²]", () => {
  for (const [r, eta] of [[30, 0.25], [16, 0.2], [50, 0.1]]) {
    const v = BBH.circularSpeed(r * 1, 1, eta, 1);      // r ≥ 12M so the taper is 1
    const g = 1 / r;
    const series = (1 / r ** 3) * (1 + (eta - 3) * g + (6 + (41 / 4) * eta + eta * eta) * g * g);
    const omega2 = (v / r) ** 2;
    close(omega2 / series, 1, 2.5 * g ** 3 * 30, `r=${r} ν=${eta}`);
  }
});

test("Schwarzschild deflection: weak-field series, strong-field logarithm, table", () => {
  close(BBH.deflection(1000), 4 / 1000 + (15 * Math.PI) / 4 / 1e6, 1e-7, "b = 1000 M");
  close(BBH.deflection(100), 4 / 100 + (15 * Math.PI) / 4 / 1e4 + 128 / 3 / 1e6, 2e-6, "b = 100 M");
  // Bozza (2002): α ≈ −ln(b/b_c − 1) + ln[216(7 − 4√3)] − π near the photon sphere
  const strong = (b) => -Math.log(b / BBH.B_CRIT - 1) + Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI;
  close(BBH.deflection(BBH.B_CRIT * 1.0005), strong(BBH.B_CRIT * 1.0005), 0.01, "b → b_c");
  const T = BBH.deflectionTable(256, 14);
  for (const v of T.table) assert.ok(Number.isFinite(v) && v >= 0);
  for (let i = 1; i < T.N; i++) assert.ok(T.table[i] > T.table[i - 1], "monotonic in b_c/b");
});
