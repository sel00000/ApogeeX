/*
 * bbh-nr-id.js — initial data for the numerical-relativity stage (pure JS, no DOM, no WebGL).
 *
 * [GR EXACT] Bowen–York puncture data (Bowen & York 1980; Brandt & Brügmann 1997, PRL 78 3606):
 *   conformally flat γ_ij = ψ⁴ δ_ij, maximal slice K = 0,
 *   K_ij = ψ⁻² Â_ij,  Â_ij = Σ_a (3 / 2r_a²) [P_i n_j + P_j n_i − (δ_ij − n_i n_j) P·n]   (solves the momentum constraint)
 *   ψ = 1 + Σ_a m_a / (2 r_a) + u,  Δu + (1/8) Â_ij Â^ij ψ⁻⁷ = 0                       (the Hamiltonian constraint)
 * The regular part u is solved here with a cell-centred multigrid on the NR grid (z ≥ 0, mirror symmetry
 * about the orbital plane), outer boundary u ∝ 1/r.
 * Bare masses are chosen so each hole's mass m_a (1 + u_a + Σ_b m_b / 2 r_ab) equals the mass it had in
 * the post-Newtonian stage (Brandt & Brügmann's puncture ADM mass).
 *
 * Units: the binary's total mass M = 1 (G = c = 1). Grid: N × N × N/2 cells over x, y ∈ [−L, L], z ∈ [0, L],
 * cell centres x = −L + (i + ½) h, z = (k + ½) h, h = 2L / N; flat index i + N (j + N k).
 */
(function (root) {
  "use strict";
  const NRID = {};

  NRID.grid = (N, L) => ({ N, NZ: N >> 1, L, h: (2 * L) / N });

  /** Bowen–York Â_ij of all punctures at a point → [xx, xy, xz, yy, yz, zz] (flat-space indices). */
  NRID.byA = (P, x, y, z, out = new Float64Array(6)) => {
    out.fill(0);
    for (const p of P) {
      const dx = x - p.x, dy = y - p.y, dz = z;
      const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
      const nx = dx / r, ny = dy / r, nz = dz / r;
      const Pn = p.px * nx + p.py * ny, k = 1.5 / r2;
      out[0] += k * (2 * p.px * nx - (1 - nx * nx) * Pn);
      out[1] += k * (p.px * ny + p.py * nx + nx * ny * Pn);
      out[2] += k * (p.px * nz + nx * nz * Pn);
      out[3] += k * (2 * p.py * ny - (1 - ny * ny) * Pn);
      out[4] += k * (p.py * nz + ny * nz * Pn);
      out[5] += k * (-(1 - nz * nz) * Pn);
    }
    return out;
  };
  NRID.A2 = (A) => A[0] * A[0] + A[3] * A[3] + A[5] * A[5] + 2 * (A[1] * A[1] + A[2] * A[2] + A[4] * A[4]);
  NRID.psiBL = (P, x, y, z) => {
    let s = 1;
    for (const p of P) s += p.m / (2 * Math.hypot(x - p.x, y - p.y, z));
    return s;
  };

  /* ---------------------------------------------------------------- multigrid */
  function level(n, nz, h, L) {
    const size = n * n * nz;
    // Robin ratio r_in / r_ghost for each boundary face cell (1/r fall-off)
    return { n, nz, h, L, u: new Float64Array(size), f: new Float64Array(size), r: new Float64Array(size) };
  }
  const cx = (lv, i) => -lv.L + (i + 0.5) * lv.h;
  const cz = (lv, k) => (k + 0.5) * lv.h;
  /** r_in / r_ghost for the ghost cell across a face */
  function ratio(lv, i, j, k, di, dj, dk) {
    const x = cx(lv, i), y = cx(lv, j), z = cz(lv, k);
    const xg = cx(lv, i + di), yg = cx(lv, j + dj), zg = cz(lv, k + dk);
    return Math.hypot(x, y, z) / Math.hypot(xg, yg, zg);
  }
  /** Diagonal pieces of the 7-point operator with the boundary rules folded in (precomputed per level). */
  function prepare(lv) {
    const { n, nz } = lv, size = n * n * nz;
    lv.diag = new Float64Array(size);
    for (let k = 0; k < nz; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let d = -6;
      if (i === 0) d += ratio(lv, i, j, k, -1, 0, 0);
      if (i === n - 1) d += ratio(lv, i, j, k, 1, 0, 0);
      if (j === 0) d += ratio(lv, i, j, k, 0, -1, 0);
      if (j === n - 1) d += ratio(lv, i, j, k, 0, 1, 0);
      if (k === 0) d += 1;                               // mirror about z = 0
      if (k === nz - 1) d += ratio(lv, i, j, k, 0, 0, 1);
      lv.diag[i + n * (j + n * k)] = d;
    }
  }
  function offSum(lv, u, i, j, k) {
    const { n, nz } = lv, c = i + n * (j + n * k);
    let s = 0;
    if (i > 0) s += u[c - 1];
    if (i < n - 1) s += u[c + 1];
    if (j > 0) s += u[c - n];
    if (j < n - 1) s += u[c + n];
    if (k > 0) s += u[c - n * n];
    if (k < nz - 1) s += u[c + n * n];
    return s;
  }
  function smooth(lv, sweeps) {
    const { n, nz, u, f } = lv, h2 = lv.h * lv.h;
    for (let s = 0; s < sweeps; s++) for (let colour = 0; colour < 2; colour++) {
      for (let k = 0; k < nz; k++) for (let j = 0; j < n; j++) {
        for (let i = (j + k + colour) & 1; i < n; i += 2) {
          const c = i + n * (j + n * k);
          u[c] = (h2 * f[c] - offSum(lv, u, i, j, k)) / lv.diag[c];
        }
      }
    }
  }
  function residual(lv) {
    const { n, nz, u, f, r } = lv, ih2 = 1 / (lv.h * lv.h);
    let norm = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = i + n * (j + n * k);
      r[c] = f[c] - (offSum(lv, u, i, j, k) + lv.diag[c] * u[c]) * ih2;
      norm = Math.max(norm, Math.abs(r[c]));
    }
    return norm;
  }
  function restrict(fine, coarse) {
    const { n, nz } = coarse, nf = fine.n;
    for (let k = 0; k < nz; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let s = 0;
      for (let c = 0; c < 8; c++) {
        const fi = 2 * i + (c & 1), fj = 2 * j + ((c >> 1) & 1), fk = 2 * k + (c >> 2);
        s += fine.r[fi + nf * (fj + nf * fk)];
      }
      coarse.f[i + n * (j + n * k)] = s / 8;
      coarse.u[i + n * (j + n * k)] = 0;
    }
  }
  function prolongAdd(coarse, fine) {
    const { n, nz } = coarse, nf = fine.n, nzf = fine.nz;
    const at = (i, j, k) => coarse.u[Math.min(n - 1, Math.max(0, i)) + n * (Math.min(n - 1, Math.max(0, j)) + n * Math.min(nz - 1, Math.max(0, k)))];
    for (let k = 0; k < nzf; k++) for (let j = 0; j < nf; j++) for (let i = 0; i < nf; i++) {
      const I = i >> 1, J = j >> 1, K = k >> 1;
      const si = i & 1 ? 1 : -1, sj = j & 1 ? 1 : -1, sk = k & 1 ? 1 : -1;
      let v = 0;
      for (let c = 0; c < 8; c++) {
        const a = c & 1, b = (c >> 1) & 1, d = c >> 2;
        const w = (a ? 0.25 : 0.75) * (b ? 0.25 : 0.75) * (d ? 0.25 : 0.75);
        v += w * at(I + a * si, J + b * sj, K + d * sk);
      }
      fine.u[i + nf * (j + nf * k)] += v;
    }
  }
  function vcycle(levels, l) {
    const lv = levels[l];
    if (l === levels.length - 1) { smooth(lv, 40); return; }
    smooth(lv, 2);
    residual(lv);
    restrict(lv, levels[l + 1]);
    vcycle(levels, l + 1);
    prolongAdd(levels[l + 1], lv);
    smooth(lv, 2);
  }
  function hierarchy(N, L) {
    const levels = [];
    let n = N, nz = N >> 1, h = (2 * L) / N;
    while (true) {
      const lv = level(n, nz, h, L);
      prepare(lv);
      levels.push(lv);
      if (nz <= 2 || n <= 4 || (n & 1) || (nz & 1)) break;
      n >>= 1; nz >>= 1; h *= 2;
    }
    return levels;
  }

  /**
   * Solve the Hamiltonian constraint for u on an N × N × N/2 grid. P: [{x, y, m, px, py}] (punctures in the
   * z = 0 plane). Picard iteration on the (weak) nonlinearity, multigrid V-cycles for each linear solve.
   * Returns { u: Float64Array, residual, grid }.
   */
  NRID.solve = (P, N, L, opt = {}) => {
    const levels = opt.levels || hierarchy(N, L);
    const lv = levels[0], { n, nz } = lv;
    const A = new Float64Array(6);
    const a2 = lv.a2 || (lv.a2 = new Float64Array(n * n * nz));
    const psi0 = lv.psi0 || (lv.psi0 = new Float64Array(n * n * nz));
    for (let k = 0; k < nz; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = i + n * (j + n * k), x = cx(lv, i), y = cx(lv, j), z = cz(lv, k);
      a2[c] = NRID.A2(NRID.byA(P, x, y, z, A));
      psi0[c] = NRID.psiBL(P, x, y, z);
    }
    if (opt.u0) lv.u.set(opt.u0); else lv.u.fill(0);
    const outer = opt.outer ?? 4, cycles = opt.cycles ?? 1;
    let res = 0;
    for (let it = 0; it < outer; it++) {
      for (let c = 0; c < lv.u.length; c++) lv.f[c] = -0.125 * a2[c] * Math.pow(psi0[c] + lv.u[c], -7);
      for (let v = 0; v < cycles; v++) vcycle(levels, 0);
    }
    for (let c = 0; c < lv.u.length; c++) lv.f[c] = -0.125 * a2[c] * Math.pow(psi0[c] + lv.u[c], -7);
    res = residual(lv);
    return { u: lv.u, residual: res, grid: NRID.grid(N, L), levels };
  };

  /** Trilinear sample of a cell-centred grid function (z mirrored, clamped at the outer faces). */
  NRID.sample = (u, N, L, x, y, z) => {
    const NZ = N >> 1, h = (2 * L) / N;
    const fx = (x + L) / h - 0.5, fy = (y + L) / h - 0.5, fz = Math.abs(z) / h - 0.5;
    const cl = (v, n) => Math.min(n - 1, Math.max(0, v));
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
    const tx = fx - i0, ty = fy - j0, tz = fz - k0;
    let s = 0;
    for (let c = 0; c < 8; c++) {
      const a = c & 1, b = (c >> 1) & 1, d = c >> 2;
      let k = k0 + d; if (k < 0) k = -k - 1;
      const w = (a ? tx : 1 - tx) * (b ? ty : 1 - ty) * (d ? tz : 1 - tz);
      s += w * u[cl(i0 + a, N) + N * (cl(j0 + b, N) + N * cl(k, NZ))];
    }
    return s;
  };

  /**
   * The whole initial-data problem for a pair, in units of its total mass.
   * holes: [{M, x, y, vx, vy}] — masses (sum 1), positions about the barycentre, velocities in c.
   * Returns punctures with bare masses and momenta, plus u on the solver grid.
   * Bare masses: m_a (1 + u_a + m_b / 2d) = M_a, iterated with u.
   */
  NRID.pair = (holes, opt = {}) => {
    const Ns = opt.solverN ?? 32, L = opt.L ?? 10;
    const d = Math.hypot(holes[0].x - holes[1].x, holes[0].y - holes[1].y);
    const P = holes.map((b) => {
      const v2 = b.vx * b.vx + b.vy * b.vy, g = 1 / Math.sqrt(Math.max(1e-6, 1 - v2));
      return { x: b.x, y: b.y, m: b.M, M: b.M, px: b.M * g * b.vx, py: b.M * g * b.vy, vx: b.vx, vy: b.vy };
    });
    const solveU = opt.solveU !== false;
    let sol = null, ua = [0, 0];
    for (let it = 0; it < (solveU ? 3 : 1); it++) {
      for (let a = 0; a < 2; a++) {
        const b = 1 - a;
        // fixed point m_a = M_a / (1 + u_a + m_b / 2d)
        P[a].m = P[a].M / (1 + ua[a] + P[b].m / (2 * d));
      }
      if (!solveU) break;
      sol = NRID.solve(P, Ns, L, { u0: sol ? sol.u : null, levels: sol ? sol.levels : null, outer: it === 0 ? 3 : 2 });
      ua = P.map((p) => NRID.sample(sol.u, Ns, L, p.x, p.y, 0));
    }
    return { punctures: P, u: sol ? Float32Array.from(sol.u) : null, solverN: Ns, L, residual: sol ? sol.residual : 0, ua };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = NRID;
  else root.NRID = NRID;
})(typeof self !== "undefined" ? self : this);
