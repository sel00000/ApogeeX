/*
 * bbh-physics.js — pure physics for the black-hole background (no DOM, no WebGL).
 *
 * Model labels follow docs/numerical-relativity/CLAUDE.md:
 *   [LECTURE p10]   inspiral → merger → ringdown are distinct stages (Intro-NR lecture, p.10)
 *   [ADDED MODEL]   post-Newtonian equations of motion for each pair — the solution of Einstein's equations
 *                   for two point masses, expanded in v²/c² — harmonic gauge (Blanchet, Living Rev. Relativ.
 *                   17, 2 (2014)): Newton + 1PN + 2PN (conservative) + 2.5PN (radiation reaction)
 *   [GR EXACT]      light deflection by each hole: null geodesics of the Schwarzschild solution
 *   [ADDED MODEL]   environmental hardening: a drag on the relative motion inside a capture radius
 *                   (stand-in for gas/stellar dynamical friction, strength boosted so captures happen on screen)
 *   [ADDED MODEL]   NR-calibrated remnant fits: radiated energy (Husa et al. 2016, eq. 3.7), final spin
 *                   (Pan et al. 2011, eq. 29b), l=m=2 QNM (Berti, Cardoso & Will 2006)
 *   [ILLUSTRATIVE]  the common-horizon morph after the PN integration stops (r < 3M)
 *   Nothing here solves Einstein's equations: it is not numerical relativity.
 *
 * Units inside the simulator: length in px, time in s, the speed of light c in px/s, and every mass is
 * stored as its gravitational radius Gm/c² in px — so G m = c² · mass.
 */
(function (root) {
  "use strict";
  const BBH = {};

  BBH.eta = (m1, m2) => {
    if (!(m1 > 0 && m2 > 0)) throw new RangeError("masses must be positive");
    return (m1 * m2) / ((m1 + m2) * (m1 + m2));
  };

  /* ---------- leading-order quasi-circular reference (02 §5, 03 §B) — used for validation ---------- */
  BBH.inspiralX = (eta, x0, tau) => Math.pow(Math.max(0, x0 ** 4 - (256 / 5) * eta * tau), 0.25);
  BBH.tauBetween = (eta, x0, x1) => (5 / (256 * eta)) * (x0 ** 4 - x1 ** 4);

  /* ---------- NR-calibrated remnant fits (non-spinning progenitors) ---------- */
  BBH.radiatedEnergy = (eta) => 0.0559745 * eta + 0.580951 * eta ** 2 - 0.960673 * eta ** 3 + 3.35241 * eta ** 4;
  BBH.finalSpin = (eta) => Math.sqrt(12) * eta - 3.871 * eta ** 2 + 4.028 * eta ** 3;
  BBH.qnm22 = (a) => ({
    Mfw: 1.5251 - 1.1568 * Math.pow(1 - a, 0.1292),
    Q: 0.7 + 1.4187 * Math.pow(1 - a, -0.499),
  });
  /** Remnant in units of the initial total mass: mass, spin, ringdown ω and amplitude e-folding time. */
  BBH.remnant = (eta, spinFactor = 1) => {
    const Mf = 1 - BBH.radiatedEnergy(eta);
    const af = Math.min(0.99, Math.max(0, BBH.finalSpin(eta) * spinFactor));
    const { Mfw, Q } = BBH.qnm22(af);
    const wRD = Mfw / Mf;
    return { Mf, af, wRD, tauD: (2 * Q) / wRD, Q };
  };

  /**
   * Relative acceleration of a pair in the centre-of-mass frame, harmonic coordinates — the
   * post-Newtonian solution of Einstein's field equations for two point masses through 2.5PN
   * (Blanchet, Faye & Ponsot 1998; Blanchet, Living Rev. Relativ. 17, 2 (2014)):
   *   a = −(GM/r²) [ (1 + A) n + B v ],   x = x1 − x2, v = v1 − v2, ν = m1 m2 / M²
   *   1PN   A = −(3/2)ν ṙ² + (1+3ν) v² − (4+2ν) U
   *         B = −(4 − 2ν) ṙ
   *   2PN   A = (15/8)ν ṙ⁴ − (45/8)ν² ṙ⁴ − (9/2)ν ṙ² v² + 6ν² ṙ² v² + 3ν v⁴ − 4ν² v⁴
   *             + U (−2 ṙ² − 25ν ṙ² − 2ν² ṙ² − (13/2)ν v² + 2ν² v²) + U² (9 + (87/4)ν)
   *         B = (9/2)ν ṙ³ + 3ν² ṙ³ − (15/2)ν ṙ v² − 2ν² ṙ v² + U (2 + (41/2)ν + 4ν²) ṙ
   *   2.5PN A = −(8/5)ν U ṙ (3 v² + (17/3) U)      (radiation reaction)
   *         B = (8/5)ν U (v² + 3 U)
   * with U = GM/r and velocities in units of c (each order carries 1/c², 1/c⁴, 1/c⁵).
   * wPN scales the conservative 1PN+2PN part (tapered near merger, where the series fails); rr scales 2.5PN.
   */
  BBH.relAccel = (x, y, vx, vy, M, eta, c, wPN = 1, rr = 1, out = null) => {
    const r2 = x * x + y * y, r = Math.sqrt(r2);
    const nx = x / r, ny = y / r;
    const GM = c * c * M;
    const rd = (nx * vx + ny * vy) / c, v2 = (vx * vx + vy * vy) / (c * c);
    const U = GM / (r * c * c);                 // GM/(r c²)
    const n = eta, n2 = eta * eta;
    let A = 0, B = 0;                            // B is per unit of v/c
    if (wPN) {
      const rd2 = rd * rd, v4 = v2 * v2;
      const A1 = -1.5 * n * rd2 + (1 + 3 * n) * v2 - (4 + 2 * n) * U;
      const B1 = -(4 - 2 * n) * rd;
      const A2 = (15 / 8) * n * rd2 * rd2 - (45 / 8) * n2 * rd2 * rd2 - 4.5 * n * rd2 * v2 + 6 * n2 * rd2 * v2
        + 3 * n * v4 - 4 * n2 * v4
        + U * (-2 * rd2 - 25 * n * rd2 - 2 * n2 * rd2 - 6.5 * n * v2 + 2 * n2 * v2)
        + U * U * (9 + (87 / 4) * n);
      const B2 = 4.5 * n * rd2 * rd + 3 * n2 * rd2 * rd - 7.5 * n * rd * v2 - 2 * n2 * rd * v2
        + U * (2 * rd + 20.5 * n * rd + 4 * n2 * rd);
      A += wPN * (A1 + A2); B += wPN * (B1 + B2);
    }
    if (rr) {
      A += rr * (-(8 / 5) * n * U * rd * (3 * v2 + (17 / 3) * U));
      B += rr * ((8 / 5) * n * U * (v2 + 3 * U));
    }
    const k = -GM / r2;
    out = out || [0, 0];
    out[0]=k * ((1 + A) * nx + (B * vx) / c);out[1]=k * ((1 + A) * ny + (B * vy) / c);
    return out;
  };

  /**
   * Conserved energy per reduced mass of the conservative 2PN dynamics (harmonic coordinates), in units
   * of c² (velocities in c, U = GM/rc²): E = E_N + E_1PN + E_2PN. Used to check the 2PN coefficients.
   */
  BBH.energy2PN = (rd, v2, U, n) => {
    const n2 = n * n, rd2 = rd * rd, v4 = v2 * v2;
    const EN = 0.5 * v2 - U;
    const E1 = (3 / 8) * (1 - 3 * n) * v4 + 0.5 * U * ((3 + n) * v2 + n * rd2 + U);
    const E2 = (5 / 16) * (1 - 7 * n + 13 * n2) * v4 * v2
      + (1 / 8) * U * ((21 - 23 * n - 27 * n2) * v4 + 2 * n * (1 - 15 * n) * rd2 * v2 - 3 * n * (1 - 3 * n) * rd2 * rd2)
      + 0.25 * U * U * ((14 - 55 * n + 4 * n2) * v2 + (4 + 69 * n + 12 * n2) * rd2)
      - 0.25 * (2 + 15 * n) * U * U * U;
    return { EN, E1, E2, E: EN + E1 + E2 };
  };

  /**
   * Exact light deflection by a Schwarzschild black hole (null geodesic of the Schwarzschild solution),
   * impact parameter b in units of M:  α(b) = 2 ∫₀^{u₀} du / √(1/b² − u² + 2u³) − π,
   * u₀ the smallest positive root (closest approach). Captured (shadow) for b ≤ 3√3.
   */
  BBH.B_CRIT = 3 * Math.sqrt(3);
  BBH.deflection = (b) => {
    if (b <= BBH.B_CRIT) return Infinity;
    // closest approach: 1/b² − u² + 2u³ = 0, smallest positive root (Newton from u = 1/b)
    let u0 = 1 / b;
    for (let i = 0; i < 60; i++) {
      const f = 1 / (b * b) - u0 * u0 + 2 * u0 ** 3, df = -2 * u0 + 6 * u0 * u0;
      const du = f / df; u0 -= du;
      if (Math.abs(du) < 1e-15) break;
    }
    // u = u0 (1 − t²) removes the inverse-square-root endpoint; Gauss–Legendre on t ∈ [0, 1]
    const g = (t) => {
      const u = u0 * (1 - t * t);
      const q = 1 / (b * b) - u * u + 2 * u ** 3;
      return (2 * u0 * t) / Math.sqrt(Math.max(q, 1e-300));
    };
    const N = 400;
    let sum = 0;
    for (let i = 0; i < N; i++) {      // composite midpoint with t² clustering handled by the substitution
      const t0 = i / N, t1 = (i + 1) / N;
      const xs = [-0.906179845938664, -0.538469310105683, 0, 0.538469310105683, 0.906179845938664];
      const ws = [0.236926885056189, 0.478628670499366, 0.568888888888889, 0.478628670499366, 0.236926885056189];
      for (let k = 0; k < 5; k++) { const t = 0.5 * (t0 + t1) + 0.5 * (t1 - t0) * xs[k]; sum += 0.5 * (t1 - t0) * ws[k] * g(t); }
    }
    return 2 * sum - Math.PI;
  };
  /**
   * Table of α for the shader, uniform in w = −ln(1 − b_c/b) ∈ [0, wMax]
   * (dense near the photon sphere where α grows like −ln(b/b_c − 1)).
   */
  BBH.deflectionTable = (N = 512, wMax = 14) => {
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const w = (i / (N - 1)) * wMax;
      const x = 1 - Math.exp(-w);
      out[i] = i === 0 ? 0 : BBH.deflection(BBH.B_CRIT / x);
    }
    return { table: out, wMax, N };
  };

  /**
   * Taper of the conservative 1PN+2PN terms: full above 12M, off below 6M. Inside ~10M the PN series
   * converges badly (the 2PN term reaches ~30% of Newton at 6M), so the last orbits keep Newton + 2.5PN.
   */
  BBH.PN_TAPER = { lo: 6, hi: 12 };
  BBH.pn1Taper = (r, M) => {
    const t = Math.min(1, Math.max(0, (r / M - BBH.PN_TAPER.lo) / (BBH.PN_TAPER.hi - BBH.PN_TAPER.lo)));
    return t * t * (3 - 2 * t);
  };

  /**
   * [ADDED MODEL] environmental hardening by a co-rotating circumbinary gas disc, inside rEnv:
   *   a_rel = −k (v_rel − v_gas),  v_gas = q v_c ê_φ · sense   (v_c: 1PN circular speed, q ≤ 1)
   *   k = β Ω + κ max(0, |v_rel − v_c ê_φ| − 0.15 v_c) / r
   *     linear part: a near-circular orbit shrinks by roughly 4πβ(1−q) of its radius per orbit
   *     quadratic (ram-pressure-like) part: a fast or radial plunge is turned into the disc's rotation,
   *     so a pair arriving from any direction is captured and spirals in instead of passing through
   * Faded out between innerHi and innerLo: the last orbits are driven by radiation reaction (2.5PN) alone.
   * Returns the relative acceleration [ax, ay].
   */
  BBH.ENV = { rEnvM: 30, beta: 0.4, q: 0.94, kappa: 5, innerLo: 4.5, innerHi: 6.5 };
  /**
   * Circular-orbit speed of BBH.relAccel (conservative part, tapered by w): solves v²/r = (GM/r²)(1 + A(v))
   * with ṙ = 0 by fixed-point iteration.
   */
  BBH.circularSpeed = (r, M, eta, c) => {
    const U = (c * c * M) / r, w = BBH.pn1Taper(r, M), u = M / r, n = eta, n2 = eta * eta;
    let v2 = u;                                  // (v/c)²
    for (let i = 0; i < 30; i++) {
      const A1 = (1 + 3 * n) * v2 - (4 + 2 * n) * u;
      const A2 = 3 * n * v2 * v2 - 4 * n2 * v2 * v2 + u * (-6.5 * n * v2 + 2 * n2 * v2) + u * u * (9 + (87 / 4) * n);
      v2 = u * Math.max(0.15, 1 + w * (A1 + A2));
    }
    return Math.sqrt(v2) * c;
  };
  BBH.envAccel = (x, y, vx, vy, M, eta, c, sense, out = null) => {
    out = out || [0, 0];
    const E_ = BBH.ENV;
    const r = Math.hypot(x, y), rm = r / M;
    if (rm > E_.rEnvM) {out[0]=out[1]=0;return out;}
    const vc = BBH.circularSpeed(r, M, eta, c), omega = vc / r;
    const outer = 1 - smooth(0.6 * E_.rEnvM, E_.rEnvM, rm);
    const inner = smooth(E_.innerLo, E_.innerHi, rm);
    // the disc turns sub-circular far out (hardening) and exactly circular near the hand-off radius,
    // so the pair is left on a circular orbit for the radiation-reaction chirp
    const q = 1 - (1 - E_.q) * smooth(E_.innerHi, E_.innerHi + 8, rm);
    const tx = (-y / r) * sense, ty = (x / r) * sense;
    const dx = vx - tx * q * vc, dy = vy - ty * q * vc;
    // quadratic (ram-pressure-like) part: only for clear departures from a circular orbit
    const offCirc = Math.max(0, Math.hypot(vx - tx * vc, vy - ty * vc) - 0.15 * vc);
    const k = outer * inner * (E_.beta * omega + (E_.kappa * offCirc) / r);
    out[0]=-k*dx;out[1]=-k*dy;return out;
  };
  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  BBH.smooth = smooth;

  /**
   * Trace-free second time derivative of the pair's mass quadrupole about its barycentre,
   * Q̈ = μ (a x + 2 v v + x a): returns A = (Q̈xx − Q̈yy)/2, B = Q̈xy (units: px, mass as Gm/c²).
   * Face-on observer at distance D: h₊ = 2A/D, h× = 2B/D. In-plane field: TT displacement ξ = (−A sin2ψ + B cos2ψ)/4.
   */
  BBH.quadrupoleDDot = (x, y, vx, vy, ax, ay, mu, c) => {
    const k = mu / (c * c);
    const qxx = k * (2 * ax * x + 2 * vx * vx);
    const qyy = k * (2 * ay * y + 2 * vy * vy);
    const qxy = k * (ax * y + x * ay + 2 * vx * vy);
    return [0.5 * (qxx - qyy), qxy];
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BBH;
  else root.BBH = BBH;
})(typeof self !== "undefined" ? self : this);
