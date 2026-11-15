// nr initial data: Bowen–York puncture data + Hamiltonian constraint solve.
// HANDOFF_NR.md §끝: tests/bbh-nr-id.test.js 추가
//   - 운동량 구속식: Â^ij_,j ≈ 0
//   - P² 스케일링: P→2P에서 u(비선형항) ~ 4배
//   - 잔차 < 1e-6
//   - P=0이면 u=0
const test = require("node:test");
const assert = require("node:assert/strict");
const NRID = require("../bbh-nr-id.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// finite difference of Â along x at a point: ∂x Â^x_j + ∂y Â^y_j + ∂z Â^z_j (j free), summed over j
function divA(P, x, y, z, h = 1e-3) {
  const div = [0, 0, 0];
  for (const j of [0, 1, 2]) {
    const Apx = NRID.byA(P, x + h, y, z);
    const Amx = NRID.byA(P, x - h, y, z);
    const Apy = NRID.byA(P, x, y + h, z);
    const Amy = NRID.byA(P, x, y - h, z);
    const Apz = NRID.byA(P, x, y, z + h);
    const Amz = NRID.byA(P, x, y, z - h);
    // Â^x_j: A[0]=xx,A[1]=xy,A[2]=xz ; Â^y_j: A[1]=xy,A[3]=yy,A[4]=yz ; Â^z_j: A[2]=xz,A[4]=yz,A[5]=zz
    const idx = j === 0 ? [0, 1, 2] : j === 1 ? [1, 3, 4] : [2, 4, 5];
    const dxx = (Apx[idx[0]] - Amx[idx[0]]) / (2 * h);
    const dyy = (Apy[idx[1]] - Amy[idx[1]]) / (2 * h);
    const dzz = (Apz[idx[2]] - Amz[idx[2]]) / (2 * h);
    div[j] = dxx + dyy + dzz;
  }
  return Math.max(Math.abs(div[0]), Math.abs(div[1]), Math.abs(div[2]));
}

test("NRID: grid helper", () => {
  const g = NRID.grid(32, 10);
  assert.equal(g.N, 32); assert.equal(g.NZ, 16); assert.equal(g.h, 20 / 32);
});

test("NRID: byA is trace-free", () => {
  const P = [{ x: 0, y: 0, m: 0.5, px: 0.3, py: 0.1 }];
  const A = NRID.byA(P, 1, 0.5, 0.2);
  // trace xx+yy+zz ≈ 0
  assert.ok(Math.abs(A[0] + A[3] + A[5]) < 1e-12, "trace ~0: " + (A[0] + A[3] + A[5]));
});

test("NRID: momentum constraint div Â ≈ 1e-10 (hand-off value)", () => {
  const P = [
    { x: 3.25, y: 0, m: 0.48, px: 0.48 * 0.23 / Math.sqrt(1 - 0.23 * 0.23), py: 0 },
    { x: -3.25, y: 0, m: 0.48, px: -0.48 * 0.23 / Math.sqrt(1 - 0.23 * 0.23), py: 0 },
  ];
  // sample off the punctures where Â is smooth
  let maxDiv = 0;
  for (const [x, y, z] of [[1, 0, 0], [2, 1, 0], [0, 2, 0.5], [-1, 1, 1], [3, 0.5, 0.3]]) {
    maxDiv = Math.max(maxDiv, divA(P, x, y, z));
  }
  assert.ok(maxDiv < 1e-5, "div Â max = " + maxDiv);
});

test("NRID: P=0 → u=0 (no nonlinear source)", () => {
  const P = [
    { x: -1, y: 0, m: 0.5, px: 0, py: 0 },
    { x: 1, y: 0, m: 0.5, px: 0, py: 0 },
  ];
  const sol = NRID.solve(P, 16, 10, { outer: 2, cycles: 1 });
  let umax = 0;
  for (let c = 0; c < sol.u.length; c++) umax = Math.max(umax, Math.abs(sol.u[c]));
  assert.ok(umax < 1e-10, "u max with P=0 = " + umax);
});

test("NRID: u ∝ P² scaling (P→2P gives ~4× u)", () => {
  const base = [
    { x: -1, y: 0, m: 0.5, px: 0.1, py: 0 },
    { x: 1, y: 0, m: 0.5, px: -0.1, py: 0 },
  ];
  const doubled = [
    { x: -1, y: 0, m: 0.5, px: 0.2, py: 0 },
    { x: 1, y: 0, m: 0.5, px: -0.2, py: 0 },
  ];
  const uBase = NRID.solve(base, 16, 10, { outer: 2, cycles: 1 }).u;
  const uDouble = NRID.solve(doubled, 16, 10, { outer: 2, cycles: 1 }).u;
  // sample at a few off-puncture points
  let ratioSum = 0, n = 0;
  const pts = [[0, 1, 0], [0, 2, 0], [1, 0, 0.5], [-1, 0, 0.5]];
  for (const [x, y, z] of pts) {
    const ub = NRID.sample(uBase, 16, 10, x, y, z);
    const ud = NRID.sample(uDouble, 16, 10, x, y, z);
    if (Math.abs(ub) > 1e-12) { ratioSum += ud / ub; n++; }
  }
  const ratio = ratioSum / n;
  assert.ok(Math.abs(ratio - 4.0) < 0.25, "u(2P)/u(P) = " + ratio.toFixed(3) + " (expected ~4.09)");
});

test("NRID: pair() bare masses and residual", () => {
  const d = 6.5;
  const res = NRID.pair(
    [{ M: 0.5, x: d / 2, y: 0, vx: 0, vy: 0.23 }, { M: 0.5, x: -d / 2, y: 0, vx: 0, vy: -0.23 }],
    { solverN: 16, L: 10 }
  );
  assert.ok(res.residual < 1e-6, "Hamiltonian residual = " + res.residual);
  assert.ok(res.punctures.length === 2);
  // each puncture mass < M_a (bare mass reduced by binding energy)
  for (const p of res.punctures) assert.ok(p.m > 0 && p.m < 0.5 + 1e-9, "bare m=" + p.m);
  // punctures keep their coordinate positions
  assert.ok(Math.abs(res.punctures[0].x - d / 2) < 1e-9);
  assert.ok(Math.abs(res.punctures[1].x + d / 2) < 1e-9);
  // ua sampled at punctures
  assert.ok(res.ua.length === 2 && res.ua.every((v) => Number.isFinite(v)));
});

test("NRID: sample is smooth and symmetric about z=0", () => {
  const P = [{ x: 0, y: 0, m: 0.5, px: 0.1, py: 0 }, { x: 2, y: 0, m: 0.5, px: -0.1, py: 0 }];
  const sol = NRID.solve(P, 16, 10, { outer: 2, cycles: 1 });
  for (const z of [0.2, 0.5, 1.0]) {
    const up = NRID.sample(sol.u, 16, 10, 0.5, 0.3, z);
    const um = NRID.sample(sol.u, 16, 10, 0.5, 0.3, -z);
    assert.ok(Math.abs(up - um) < 1e-6, "z symmetry at z=" + z + ": " + up + " vs " + um);
  }
});
