/*
 * bbh-nr.js — numerical relativity on the GPU (WebGL2): BSSN evolution of two black-hole punctures,
 * frozen-slice null-geodesic ray tracing of the evolved spacetime into a lens map. Needs bbh-nr-id.js.
 *
 * [GR EXACT]     Einstein's vacuum equations in the BSSN form (Shibata–Nakamura 1995, Baumgarte–Shapiro 1998),
 *                χ-variant of the moving-puncture method (Campanelli, Lousto, Marronetti & Zlochower 2006):
 *                variables χ, γ̃_ij, K, Ã_ij, Γ̃^i; gauge 1+log slicing ∂_t α = β^i∂_iα − 2αK and the Γ-driver shift
 *                ∂_t β^i = β^j∂_jβ^i + ¾B^i, ∂_t B^i = β^j∂_jB^i + ∂_tΓ̃^i − β^j∂_jΓ̃^i − ηB^i (van Meter et al. 2006).
 *                The equations are exact; their solution here is a coarse finite-difference approximation:
 *                4th-order centred differences, 4th-order lopsided upwinding of β^i∂_i, 6th-order Kreiss–Oliger
 *                dissipation, SSP-RK3 in time, Sommerfeld outgoing-wave condition in the outer 3 cells,
 *                det γ̃ = 1 and tr Ã = 0 enforced after every stage.
 * [ADDED MODEL]  resolution: one uniform N × N × N/2 cell grid (mirror symmetry about the orbital plane),
 *                h ≈ 0.31 M for N = 64, L = 10 M — production codes use mesh refinement down to ~M/50 near
 *                each hole. This implementation has NOT passed shadow preservation, binary-merger,
 *                or constraint-convergence qualification; no percentage accuracy is established.
 * [ADDED MODEL]  initial lapse α₀ = smoothmax((2 − ψ)/ψ, 0) (static Schwarzschild lapse in isotropic coordinates
 *                for one hole) and initial shift β₀ = −Σ_a v_a φ_a / (1 + Σφ), so the punctures keep moving with
 *                the holes at the hand-off. Any lapse/shift is a valid gauge; these make the hand-off smooth.
 * [ILLUSTRATIVE] the lens map: null geodesics (3+1 form, Vincent, Gourgoulhon & Novak 2012, CQG 29 245005)
 *                integrated through the current slice with the fields held fixed while the ray crosses it
 *                (exact for a stationary spacetime, an approximation while the holes move), outside the grid
 *                through Schwarzschild of the total mass, plus a weak-field correction beyond ±Z_s.
 *
 * Units: the binary's total mass M = 1 (G = c = 1). Grid cell centres x = −L + (i + ½)h, z = (k + ½)h.
 * Storage: each grid function lives in a 2D atlas of N × N z-tiles (TX tiles across).
 */
(function (root) {
  "use strict";
  const NRID = root.NRID || (typeof require !== "undefined" ? require("./bbh-nr-id.js") : null);

  const VS = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  // z-reflection parity of each packed component (odd ⇔ an odd number of z indices)
  const PAR = `
const vec4 P0 = vec4(1.0, 1.0, -1.0, 1.0);   // γ̃xx γ̃xy γ̃xz γ̃yy
const vec4 P1 = vec4(-1.0, 1.0, 1.0, 1.0);   // γ̃yz γ̃zz χ α
const vec4 P2 = vec4(1.0, 1.0, -1.0, 1.0);   // βx βy βz K
const vec4 P3 = vec4(1.0, 1.0, -1.0, 1.0);   // Ãxx Ãxy Ãxz Ãyy
const vec4 P4 = vec4(-1.0, 1.0, 1.0, 1.0);   // Ãyz Ãzz Γ̃x Γ̃y
const vec4 P5 = vec4(-1.0, 1.0, 1.0, -1.0);  // Γ̃z Bx By Bz
`;

  function header(g) {
    return `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
#define N_ ${g.N}
#define NZ_ ${g.NZ}
#define TX_ ${g.TX}
const bool CONFORMAL_W = ${g.conformalW ? "true" : "false"};
const float H = ${g.h.toFixed(9)};
const float L = ${g.L.toFixed(9)};
ivec2 at(ivec3 c) { return ivec2((c.z % TX_) * N_ + c.x, (c.z / TX_) * N_ + c.y); }
ivec3 cellOf(vec2 f) { ivec2 p = ivec2(f); int tx = p.x / N_, ty = p.y / N_; return ivec3(p.x - tx * N_, p.y - ty * N_, ty * TX_ + tx); }
vec3 posOf(ivec3 c) { return vec3(-L + (float(c.x) + 0.5) * H, -L + (float(c.y) + 0.5) * H, (float(c.z) + 0.5) * H); }
vec4 F(sampler2D t, vec4 par, ivec3 c) {
  c.xy = clamp(c.xy, ivec2(0), ivec2(N_ - 1));
  vec4 s = vec4(1.0);
  if (c.z < 0) { c.z = -c.z - 1; s = par; }
  c.z = min(c.z, NZ_ - 1);
  return texelFetch(t, at(c), 0) * s;
}
mat3 sym(float xx, float xy, float xz, float yy, float yz, float zz) { return mat3(xx, xy, xz, xy, yy, yz, xz, yz, zz); }
${PAR}
`;
  }

  /* ------------------------------------------------------------------ BSSN right-hand side + SSP-RK3 stage */
  function rhsFS(g) {
    return header(g) + `
uniform sampler2D S0, S1, S2, S3, S4, S5;   // stage input (stencils)
uniform sampler2D Y0, Y1, Y2, Y3, Y4, Y5;   // u^n (centre only)
uniform float uA, uB, uDt, uEta, uSigma, uCAKO, uDiagnostics;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3; layout(location = 4) out vec4 o4; layout(location = 5) out vec4 o5;

vec4 mixed(sampler2D t, vec4 par, ivec3 c, ivec3 ea, ivec3 eb) {
  const float w[4] = float[4](1.0, -8.0, 8.0, -1.0);
  const int o[4] = int[4](-2, -1, 1, 2);
  vec4 s = vec4(0.0);
  for (int a = 0; a < 4; a++) for (int b = 0; b < 4; b++) s += (w[a] * w[b]) * F(t, par, c + o[a] * ea + o[b] * eb);
  return s * (1.0 / (144.0 * H * H));
}
// value, centred 1st & 2nd derivatives along each axis, upwinded advection β·∂, KO sum
void axes(sampler2D t, vec4 par, ivec3 c, vec3 bt, vec4 v, out vec4 d[3], out vec4 d2[3], out vec4 adv, out vec4 ko) {
  adv = vec4(0.0); ko = vec4(0.0);
  for (int a = 0; a < 3; a++) {
    ivec3 e = ivec3(a == 0 ? 1 : 0, a == 1 ? 1 : 0, a == 2 ? 1 : 0);
    vec4 m3 = F(t, par, c - 3 * e), m2 = F(t, par, c - 2 * e), m1 = F(t, par, c - e);
    vec4 p1 = F(t, par, c + e), p2 = F(t, par, c + 2 * e), p3 = F(t, par, c + 3 * e);
    d[a] = (m2 - 8.0 * m1 + 8.0 * p1 - p2) * (1.0 / (12.0 * H));
    d2[a] = (-m2 + 16.0 * m1 - 30.0 * v + 16.0 * p1 - p2) * (1.0 / (12.0 * H * H));
    vec4 up = bt[a] >= 0.0 ? (-3.0 * m1 - 10.0 * v + 18.0 * p1 - 6.0 * p2 + p3) : (3.0 * p1 + 10.0 * v - 18.0 * m1 + 6.0 * m2 - m3);
    adv += bt[a] * up * (1.0 / (12.0 * H));
    ko += m3 - 6.0 * m2 + 15.0 * m1 - 20.0 * v + 15.0 * p1 - 6.0 * p2 + p3;
  }
}
int hi(int l, int m) { return l == m ? l : (l + m == 1 ? 3 : (l + m == 2 ? 4 : 5)); }

// Sommerfeld: ∂_t u = −(x^i/r) ∂_i u − (u − u∞)/r   (outer 3 cells)
vec4 dirD(sampler2D t, vec4 par, ivec3 c, vec3 n, vec4 v) {
  vec4 s = vec4(0.0);
  for (int a = 0; a < 3; a++) {
    ivec3 e = ivec3(a == 0 ? 1 : 0, a == 1 ? 1 : 0, a == 2 ? 1 : 0);
    int ci = a == 0 ? c.x : (a == 1 ? c.y : c.z);
    int nmax = a == 2 ? NZ_ - 1 : N_ - 1;
    bool lo = a != 2 && ci == 0, top = ci == nmax;
    vec4 dv;
    if (top) dv = (3.0 * v - 4.0 * F(t, par, c - e) + F(t, par, c - 2 * e)) / (2.0 * H);
    else if (lo) dv = (-3.0 * v + 4.0 * F(t, par, c + e) - F(t, par, c + 2 * e)) / (2.0 * H);
    else dv = (F(t, par, c + e) - F(t, par, c - e)) / (2.0 * H);
    s += n[a] * dv;
  }
  return s;
}

void finish(vec4 r0, vec4 r1, vec4 r2, vec4 r3, vec4 r4, vec4 r5, vec4 s0, vec4 s1, vec4 s2, vec4 s3, vec4 s4, vec4 s5, ivec3 c) {
  ivec2 q = at(c);
  vec4 n0 = uA * texelFetch(Y0, q, 0) + uB * (s0 + uDt * r0);
  vec4 n1 = uA * texelFetch(Y1, q, 0) + uB * (s1 + uDt * r1);
  vec4 n2 = uA * texelFetch(Y2, q, 0) + uB * (s2 + uDt * r2);
  vec4 n3 = uA * texelFetch(Y3, q, 0) + uB * (s3 + uDt * r3);
  vec4 n4 = uA * texelFetch(Y4, q, 0) + uB * (s4 + uDt * r4);
  vec4 n5 = uA * texelFetch(Y5, q, 0) + uB * (s5 + uDt * r5);
  // algebraic constraints: det γ̃ = 1, tr Ã = 0, χ > 0
  mat3 gt = sym(n0.x, n0.y, n0.z, n0.w, n1.x, n1.y);
  float det = determinant(gt);
  gt *= pow(max(det, 1e-6), -1.0 / 3.0);
  mat3 gu = inverse(gt);
  mat3 At = sym(n3.x, n3.y, n3.z, n3.w, n4.x, n4.y);
  float tr = 0.0;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) tr += gu[i][j] * At[i][j];
  At -= (tr / 3.0) * gt;
  o0 = vec4(gt[0][0], gt[0][1], gt[0][2], gt[1][1]);
  o1 = vec4(gt[1][2], gt[2][2], max(n1.z, 1e-5), n1.w);
  o2 = n2;
  o3 = vec4(At[0][0], At[0][1], At[0][2], At[1][1]);
  o4 = vec4(At[1][2], At[2][2], n4.z, n4.w);
  o5 = n5;
}

void main() {
  ivec3 c = cellOf(gl_FragCoord.xy);
  vec4 s0 = F(S0, P0, c), s1 = F(S1, P1, c), s2 = F(S2, P2, c), s3 = F(S3, P3, c), s4 = F(S4, P4, c), s5 = F(S5, P5, c);

  if (c.x < 3 || c.y < 3 || c.x > N_ - 4 || c.y > N_ - 4 || c.z > NZ_ - 4) {
    vec3 x = posOf(c); float r = length(x); vec3 n = x / r;
    vec4 r0 = -dirD(S0, P0, c, n, s0) - (s0 - vec4(1.0, 0.0, 0.0, 1.0)) / r;
    vec4 r1 = -dirD(S1, P1, c, n, s1) - (s1 - vec4(0.0, 1.0, 1.0, 1.0)) / r;
    vec4 r2 = -dirD(S2, P2, c, n, s2) - s2 / r;
    vec4 r3 = -dirD(S3, P3, c, n, s3) - s3 / r;
    vec4 r4 = -dirD(S4, P4, c, n, s4) - s4 / r;
    vec4 r5 = -dirD(S5, P5, c, n, s5) - s5 / r;
    finish(r0, r1, r2, r3, r4, r5, s0, s1, s2, s3, s4, s5, c);
    return;
  }

  vec3 bt = s2.xyz;
  vec4 d0[3], d1[3], d2[3], d3[3], d4[3], d5[3];
  vec4 e0[3], e1[3], e2[3], e3[3], e4[3], e5[3];
  vec4 a0, a1, a2, a3, a4, a5, k0, k1, k2, k3, k4, k5;
  axes(S0, P0, c, bt, s0, d0, e0, a0, k0);
  axes(S1, P1, c, bt, s1, d1, e1, a1, k1);
  axes(S2, P2, c, bt, s2, d2, e2, a2, k2);
  axes(S3, P3, c, bt, s3, d3, e3, a3, k3);
  axes(S4, P4, c, bt, s4, d4, e4, a4, k4);
  axes(S5, P5, c, bt, s5, d5, e5, a5, k5);
  const ivec3 EX = ivec3(1, 0, 0), EY = ivec3(0, 1, 0), EZ = ivec3(0, 0, 1);
  vec4 h0[6], h1[6], h2[6];
  for (int a = 0; a < 3; a++) { h0[a] = e0[a]; h1[a] = e1[a]; h2[a] = e2[a]; }
  h0[3] = mixed(S0, P0, c, EX, EY); h0[4] = mixed(S0, P0, c, EX, EZ); h0[5] = mixed(S0, P0, c, EY, EZ);
  h1[3] = mixed(S1, P1, c, EX, EY); h1[4] = mixed(S1, P1, c, EX, EZ); h1[5] = mixed(S1, P1, c, EY, EZ);
  h2[3] = mixed(S2, P2, c, EX, EY); h2[4] = mixed(S2, P2, c, EX, EZ); h2[5] = mixed(S2, P2, c, EY, EZ);

  // ---- unpack
  mat3 gt = sym(s0.x, s0.y, s0.z, s0.w, s1.x, s1.y);
  float W = max(s1.z, 1e-6);
  float chi = CONFORMAL_W ? W*W : max(s1.z, 1e-8), alpha = s1.w, K = s2.w;
  vec3 beta = s2.xyz, Bv = s5.yzw;
  mat3 At = sym(s3.x, s3.y, s3.z, s3.w, s4.x, s4.y);
  mat3 dg[3]; float dchi[3], dal[3], dK[3]; vec3 db[3], dGam[3];
  for (int k = 0; k < 3; k++) {
    dg[k] = sym(d0[k].x, d0[k].y, d0[k].z, d0[k].w, d1[k].x, d1[k].y);
    dchi[k] = CONFORMAL_W ? 2.0*W*d1[k].z : d1[k].z; dal[k] = d1[k].w; db[k] = d2[k].xyz; dK[k] = d2[k].w;
    dGam[k] = vec3(d4[k].z, d4[k].w, d5[k].x);           // ∂_k Γ̃^i
  }
  mat3 ddg[6]; float ddchi[6], ddal[6]; vec3 ddb[6];
  for (int m = 0; m < 6; m++) {
    ddg[m] = sym(h0[m].x, h0[m].y, h0[m].z, h0[m].w, h1[m].x, h1[m].y);
    int i = m < 3 ? m : (m == 5 ? 1 : 0);
    int j = m < 3 ? m : (m == 3 ? 1 : 2);
    ddchi[m] = CONFORMAL_W ? 2.0*(W*h1[m].z + d1[i].z*d1[j].z) : h1[m].z; ddal[m] = h1[m].w; ddb[m] = h2[m].xyz;
  }
  mat3 gu = inverse(gt);

  // ---- Christoffels of γ̃: C1[k][i][j] = Γ̃_kij, C2[k][i][j] = Γ̃^k_ij, Gd^k = γ̃^ij Γ̃^k_ij
  mat3 C1[3], C2[3];
  for (int k = 0; k < 3; k++) for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++)
    C1[k][i][j] = 0.5 * (dg[i][j][k] + dg[j][i][k] - dg[k][i][j]);
  vec3 Gd = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    C2[k] = gu[k][0] * C1[0] + gu[k][1] * C1[1] + gu[k][2] * C1[2];
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) Gd[k] += gu[i][j] * C2[k][i][j];
  }

  // ---- Ricci tensor R_ij = R̃_ij + R^χ_ij
  mat3 Ric;
  float trDDchi = 0.0, dchi2 = 0.0;
  mat3 DDchi;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float v = ddchi[hi(i, j)];
    for (int k = 0; k < 3; k++) v -= C2[k][i][j] * dchi[k];
    DDchi[i][j] = v;
  }
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) { trDDchi += gu[i][j] * DDchi[i][j]; dchi2 += gu[i][j] * dchi[i] * dchi[j]; }
  for (int i = 0; i < 3; i++) for (int j = i; j < 3; j++) {
    float r = 0.0;
    for (int l = 0; l < 3; l++) for (int m = 0; m < 3; m++) {
      r -= 0.5 * gu[l][m] * ddg[hi(l, m)][i][j];
      for (int k = 0; k < 3; k++)
        r += gu[l][m] * (C2[k][l][i] * C1[j][k][m] + C2[k][l][j] * C1[i][k][m] + C2[k][i][m] * C1[k][l][j]);
    }
    for (int k = 0; k < 3; k++) {
      r += 0.5 * (gt[k][i] * dGam[j][k] + gt[k][j] * dGam[i][k]);
      r += 0.5 * Gd[k] * (C1[i][j][k] + C1[j][i][k]);
    }
    r += (0.5 / chi) * (DDchi[i][j] + gt[i][j] * trDDchi) - (0.25 / (chi * chi)) * (dchi[i] * dchi[j] + 3.0 * gt[i][j] * dchi2);
    Ric[i][j] = r; Ric[j][i] = r;
  }

  // ---- D_i D_j α (physical metric)
  mat3 DDal;
  float gdcda = 0.0;
  for (int k = 0; k < 3; k++) for (int l = 0; l < 3; l++) gdcda += gu[k][l] * dchi[l] * dal[k];
  float lapA = 0.0;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float v = ddal[hi(i, j)];
    for (int k = 0; k < 3; k++) v -= C2[k][i][j] * dal[k];
    v += (0.5 / chi) * (dal[i] * dchi[j] + dal[j] * dchi[i] - gt[i][j] * gdcda);
    DDal[i][j] = v;
    lapA += chi * gu[i][j] * v;
  }

  // ---- Ã with raised indices
  mat3 Amix, Aup;                         // Amix[i][j] = Ã^i_j, Aup[i][j] = Ã^ij
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float v = 0.0; for (int k = 0; k < 3; k++) v += gu[i][k] * At[k][j];
    Amix[i][j] = v;
  }
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float v = 0.0; for (int k = 0; k < 3; k++) v += Amix[i][k] * gu[k][j];
    Aup[i][j] = v;
  }
  float AA = 0.0;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) AA += At[i][j] * Aup[i][j];
  if (uDiagnostics > 0.5) {
    // Vacuum ADM constraints, evaluated independently of the algebraic
    // projection: H = R + 2 K²/3 - Ã_ij Ã^ij, M^i = D_j(K^ij-γ^ij K).
    float Rscalar = 0.0;
    for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) Rscalar += chi * gu[i][j] * Ric[i][j];
    vec3 Mom = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      mat3 dAt = sym(d3[j].x, d3[j].y, d3[j].z, d3[j].w, d4[j].x, d4[j].y);
      mat3 dgu = -gu * dg[j] * gu;
      mat3 dAu = dgu * At * gu + gu * dAt * gu + gu * At * dgu;
      for (int i = 0; i < 3; i++) {
        Mom[i] += dAu[i][j] - 1.5 * Aup[i][j] * dchi[j] / chi - (2.0/3.0) * gu[i][j] * dK[j];
        for (int k = 0; k < 3; k++) Mom[i] += C2[i][j][k] * Aup[j][k];
      }
    }
    o0 = vec4(Rscalar + (2.0/3.0)*K*K - AA, chi * Mom);
    o1 = vec4(vec3(s4.z, s4.w, s5.x) - Gd, chi);
    o2 = vec4(Rscalar, AA, K, alpha); o3 = o4 = o5 = vec4(0.0);
    return;
  }
  float divb = db[0].x + db[1].y + db[2].z;

  // ---- evolution equations
  float rchi = a1.z + (CONFORMAL_W ? W / 3.0 : (2.0 / 3.0) * chi) * (alpha * K - divb);
  float rK = a2.w - lapA + alpha * (AA + K * K / 3.0);
  mat3 X;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) X[i][j] = -DDal[i][j] + alpha * Ric[i][j];
  float trX = 0.0;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) trX += gu[i][j] * X[i][j];
  mat3 rg, rA;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float lg = -2.0 / 3.0 * gt[i][j] * divb, lA = -2.0 / 3.0 * At[i][j] * divb, AAm = 0.0;
    for (int k = 0; k < 3; k++) {
      lg += gt[i][k] * db[j][k] + gt[j][k] * db[i][k];
      lA += At[i][k] * db[j][k] + At[j][k] * db[i][k];
      AAm += At[i][k] * Amix[k][j];
    }
    rg[i][j] = -2.0 * alpha * At[i][j] + lg;
    rA[i][j] = chi * (X[i][j] - gt[i][j] * trX / 3.0) + alpha * (K * At[i][j] - 2.0 * AAm) + lA;
  }
  vec3 rGam;
  for (int i = 0; i < 3; i++) {
    float v = (2.0 / 3.0) * Gd[i] * divb;
    for (int j = 0; j < 3; j++) {
      v -= Gd[j] * db[j][i];
      v -= 2.0 * Aup[i][j] * dal[j];
      v += 2.0 * alpha * (-1.5 * Aup[i][j] * dchi[j] / chi - (2.0 / 3.0) * gu[i][j] * dK[j]);
      for (int k = 0; k < 3; k++) {
        v += gu[j][k] * ddb[hi(j, k)][i] + (1.0 / 3.0) * gu[i][j] * ddb[hi(j, k)][k];
        v += 2.0 * alpha * C2[i][j][k] * Aup[j][k];
      }
    }
    rGam[i] = v;
  }
  float ral = -2.0 * alpha * K;
  vec3 rbeta = 0.75 * Bv;
  vec3 advG = vec3(a4.z, a4.w, a5.x);
  vec3 rB = rGam - uEta * Bv;    // ∂_0 B uses ∂_tΓ̃ − β·∂Γ̃ (= rGam before advG is added)
  rGam += advG;                  // ∂_t Γ̃ includes β·∂Γ̃

  // Etienne (2024), arXiv:2404.01137, eq. (20): suppress the
  // numerical filter at punctures instead of erasing the sharp fields there.
  float ks = uSigma * mix(1.0, sqrt(chi), uCAKO) / (64.0 * H);
  vec4 r0 = vec4(rg[0][0], rg[0][1], rg[0][2], rg[1][1]) + a0 + ks * k0;
  vec4 r1 = vec4(rg[1][2], rg[2][2], rchi, ral) + vec4(a1.xy, 0.0, a1.w) + ks * k1;
  vec4 r2 = vec4(rbeta, rK) + vec4(a2.xyz, 0.0) + ks * k2;
  vec4 r3 = vec4(rA[0][0], rA[0][1], rA[0][2], rA[1][1]) + a3 + ks * k3;
  vec4 r4 = vec4(rA[1][2], rA[2][2], rGam.x, rGam.y) + vec4(a4.xy, 0.0, 0.0) + ks * k4;
  vec4 r5 = vec4(rGam.z, rB) + vec4(0.0, a5.yzw) + ks * k5;
  finish(r0, r1, r2, r3, r4, r5, s0, s1, s2, s3, s4, s5, c);
}`;
  }

  /* ------------------------------------------------------------------ initial data / analytic snapshot */
  function initFS(g) {
    return header(g) + `
uniform vec4 uQ0, uQ1;    // puncture: x, y, bare mass m, –
uniform vec4 uV0, uV1;    // momentum P (x, y), velocity v (x, y)
uniform float uUseU, uPrecollapsed;
uniform sampler3D uU;     // u on the solver grid (cell-centred, z ≥ 0)
uniform vec3 uUScale;     // 1 / (2L), 1 / (2L), 1 / L
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3; layout(location = 4) out vec4 o4; layout(location = 5) out vec4 o5;
mat3 by(vec3 x, vec4 Q, vec4 V) {
  vec3 d = x - vec3(Q.xy, 0.0); float r2 = dot(d, d); vec3 n = d * inversesqrt(r2);
  vec3 P = vec3(V.xy, 0.0); float Pn = dot(P, n);
  mat3 A;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++)
    A[i][j] = (1.5 / r2) * (P[i] * n[j] + P[j] * n[i] - ((i == j ? 1.0 : 0.0) - n[i] * n[j]) * Pn);
  return A;
}
void main() {
  ivec3 c = cellOf(gl_FragCoord.xy);
  vec3 x = posOf(c);
  float f0 = uQ0.z / (2.0 * length(x - vec3(uQ0.xy, 0.0)));
  float f1 = uQ1.z / (2.0 * length(x - vec3(uQ1.xy, 0.0)));
  float u = uUseU > 0.5 ? texture(uU, vec3((x.x + L) * uUScale.x, (x.y + L) * uUScale.y, x.z * uUScale.z)).r : 0.0;
  float psi = 1.0 + f0 + f1 + u;
  mat3 A = (by(x, uQ0, uV0) + by(x, uQ1, uV1)) * pow(psi, -6.0);
  float a = (2.0 - psi) / psi, e2 = 0.0016;
  float alpha = mix(0.5 * (a + sqrt(a * a + e2)), pow(psi, -2.0), uPrecollapsed);
  vec2 bxy = -(uV0.zw * f0 + uV1.zw * f1) / (1.0 + f0 + f1);
  o0 = vec4(1.0, 0.0, 0.0, 1.0);
  o1 = vec4(0.0, 1.0, pow(psi, CONFORMAL_W ? -2.0 : -4.0), alpha);
  o2 = vec4(bxy, 0.0, 0.0);
  o3 = vec4(A[0][0], A[0][1], A[0][2], A[1][1]);
  o4 = vec4(A[1][2], A[2][2], 0.0, 0.0);
  o5 = vec4(0.0);
}`;
  }

  /* ------------------------------------------------------------------ puncture tracking: dx/dt = −β(x) */
  function trackFS(g) {
    return header(g) + `
uniform sampler2D uPos, uB2; uniform float uDt;
out vec4 o;
vec3 betaAt(vec3 p) {
  vec3 f = vec3((p.x + L) / H - 0.5, (p.y + L) / H - 0.5, abs(p.z) / H - 0.5);
  f.xy = clamp(f.xy, vec2(0.0), vec2(float(N_ - 1)));
  ivec3 i0 = ivec3(floor(f)); vec3 t = f - vec3(i0);
  vec3 s = vec3(0.0);
  for (int q = 0; q < 8; q++) {
    ivec3 o3 = ivec3(q & 1, (q >> 1) & 1, q >> 2);
    vec3 w = mix(1.0 - t, t, vec3(o3));
    s += w.x * w.y * w.z * F(uB2, P2, i0 + o3).xyz;
  }
  return s;
}
vec2 move(vec2 x) {
  vec2 m = x - 0.5 * uDt * betaAt(vec3(x, 0.0)).xy;
  return x - uDt * betaAt(vec3(m, 0.0)).xy;
}
void main() { vec4 p = texelFetch(uPos, ivec2(0), 0); o = vec4(move(p.xy), move(p.zw)); }`;
  }
  const COPY_FS = `#version 300 es
precision highp float; uniform sampler2D uPos; out vec4 o; void main() { o = texelFetch(uPos, ivec2(0), 0); }`;

  /* ------------------------------------------------------------------ geodesic coefficients from the slice */
  // dV^i/dt = c^i + C^i_j V^j + G^i_jk V^j V^k + V^i (d_j V^j + E_jk V^j V^k),  dx^i/dt = α V^i − β^i
  //   c^i = −γ^ij ∂_jα, C^i_j = 2αK^i_j − ∂_jβ^i, G^i_jk = −αΓ^i_jk, d_j = ∂_jα, E_jk = −αK_jk
  const CPAR = [
    [1, 1, -1, 1], [1, 1, -1, 1], [1, -1, 1, 1], [-1, 1, -1, 1], [1, 1, -1, 1], [1, -1, -1, -1],
    [1, 1, 1, -1], [1, -1, 1, 1], [1, -1, 1, -1], [1, -1, -1, 1], [-1, 1, -1, 1],
  ];
  function coefFS(g, part) {
    const outs = part === 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [8, 9, 10];
    return header(g) + `
uniform sampler2D S0, S1, S2, S3, S4;
${outs.map((k, i) => `layout(location = ${i}) out vec4 c${k};`).join("\n")}
void main() {
  ivec3 c = cellOf(gl_FragCoord.xy);
  vec4 s0 = F(S0, P0, c), s1 = F(S1, P1, c), s2 = F(S2, P2, c), s3 = F(S3, P3, c), s4 = F(S4, P4, c);
  vec4 d0[3], d1[3], d2[3];
  for (int a = 0; a < 3; a++) {
    ivec3 e = ivec3(a == 0 ? 1 : 0, a == 1 ? 1 : 0, a == 2 ? 1 : 0);
    d0[a] = (F(S0, P0, c - 2 * e) - 8.0 * F(S0, P0, c - e) + 8.0 * F(S0, P0, c + e) - F(S0, P0, c + 2 * e)) / (12.0 * H);
    d1[a] = (F(S1, P1, c - 2 * e) - 8.0 * F(S1, P1, c - e) + 8.0 * F(S1, P1, c + e) - F(S1, P1, c + 2 * e)) / (12.0 * H);
    d2[a] = (F(S2, P2, c - 2 * e) - 8.0 * F(S2, P2, c - e) + 8.0 * F(S2, P2, c + e) - F(S2, P2, c + 2 * e)) / (12.0 * H);
  }
  mat3 gt = sym(s0.x, s0.y, s0.z, s0.w, s1.x, s1.y), gu = inverse(gt);
  float W = max(s1.z, 1e-6);
  float chi = CONFORMAL_W ? W*W : max(s1.z, 1e-8), alpha = s1.w, K = s2.w;
  vec3 beta = s2.xyz;
  mat3 At = sym(s3.x, s3.y, s3.z, s3.w, s4.x, s4.y);
  mat3 dg[3]; vec3 dchi, dal; vec3 db[3];
  for (int k = 0; k < 3; k++) { dg[k] = sym(d0[k].x, d0[k].y, d0[k].z, d0[k].w, d1[k].x, d1[k].y); dchi[k] = CONFORMAL_W ? 2.0*W*d1[k].z : d1[k].z; dal[k] = d1[k].w; db[k] = d2[k].xyz; }
  // Γ^i_jk of γ_ij = γ̃_ij / χ
  mat3 G[3];
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) for (int k = 0; k < 3; k++) {
    float v = 0.0;
    for (int l = 0; l < 3; l++) v += 0.5 * gu[i][l] * (dg[j][k][l] + dg[k][j][l] - dg[l][j][k]);
    float gdc = 0.0; for (int l = 0; l < 3; l++) gdc += gu[i][l] * dchi[l];
    v -= (0.5 / chi) * ((i == j ? dchi[k] : 0.0) + (i == k ? dchi[j] : 0.0) - gt[j][k] * gdc);
    G[i][j][k] = -alpha * v;
  }
  vec3 ci = vec3(0.0);
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) ci[i] -= chi * gu[i][j] * dal[j];
  mat3 Cm;                                   // Cm[i][j] = C^i_j
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) {
    float Kij = (i == j ? K / 3.0 : 0.0);
    for (int k = 0; k < 3; k++) Kij += gu[i][k] * At[k][j];
    Cm[i][j] = 2.0 * alpha * Kij - db[j][i];
  }
  mat3 E;
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) E[i][j] = -alpha * (At[i][j] + gt[i][j] * K / 3.0) / chi;
  vec4 C[11];
  C[0] = vec4(ci, alpha);
  C[1] = vec4(beta, dal.x);
  C[2] = vec4(dal.y, dal.z, E[0][0], E[0][1]);
  C[3] = vec4(E[0][2], E[1][1], E[1][2], E[2][2]);
  C[4] = vec4(Cm[0][0], Cm[0][1], Cm[0][2], Cm[1][0]);
  C[5] = vec4(Cm[1][1], Cm[1][2], Cm[2][0], Cm[2][1]);
  C[6] = vec4(Cm[2][2], G[0][0][0], G[0][0][1], G[0][0][2]);
  C[7] = vec4(G[0][1][1], G[0][1][2], G[0][2][2], G[1][0][0]);
  C[8] = vec4(G[1][0][1], G[1][0][2], G[1][1][1], G[1][1][2]);
  C[9] = vec4(G[1][2][2], G[2][0][0], G[2][0][1], G[2][0][2]);
  C[10] = vec4(G[2][1][1], G[2][1][2], G[2][2][2], chi);
  ${outs.map((k) => `c${k} = C[${k}];`).join(" ")}
}`;
  }

  /* ------------------------------------------------------------------ ray tracer → lens map */
  function rayFS(g, lensRes) {
    const cs = Array.from({ length: 11 }, (_, k) => `C${k}`);
    return header(g) + `
uniform sampler2D ${cs.join(", ")};
uniform sampler2D uPos;
uniform float uMfar, uZs, uMode;   // far-field mass; ray start height; 1 = grid metric, 0 = far metric only
out vec4 o;
const vec2 ATL = vec2(float(N_ * TX_), float(N_ * ((NZ_ + TX_ - 1) / TX_)));
${CPAR.map((p, k) => `const vec4 Q${k} = vec4(${p.map((v) => v.toFixed(1)).join(", ")});`).join("\n")}
vec4 tri(sampler2D t, vec4 par, vec3 p) {
  vec2 f = clamp(vec2((p.x + L) / H - 0.5, (p.y + L) / H - 0.5), vec2(0.0), vec2(float(N_ - 1)));
  float fz = abs(p.z) / H - 0.5;
  int k0 = int(floor(fz)); float tz = fz - float(k0);
  int k1 = min(k0 + 1, NZ_ - 1);
  vec4 sk = vec4(1.0);
  if (k0 < 0) { k0 = 0; sk = par; }
  k0 = min(k0, NZ_ - 1);
  vec2 u0 = (vec2(float((k0 % TX_) * N_), float((k0 / TX_) * N_)) + f + 0.5) / ATL;
  vec2 u1 = (vec2(float((k1 % TX_) * N_), float((k1 / TX_) * N_)) + f + 0.5) / ATL;
  vec4 v = mix(texture(t, u0) * sk, texture(t, u1), tz);
  return p.z < 0.0 ? v * par : v;
}
// geodesic RHS in the grid metric
void gridRHS(vec3 x, vec3 V, out vec3 dx, out vec3 dV, out float chi) {
  vec4 c0 = tri(C0, Q0, x), c1 = tri(C1, Q1, x), c2 = tri(C2, Q2, x), c3 = tri(C3, Q3, x);
  vec4 c4 = tri(C4, Q4, x), c5 = tri(C5, Q5, x), c6 = tri(C6, Q6, x), c7 = tri(C7, Q7, x);
  vec4 c8 = tri(C8, Q8, x), c9 = tri(C9, Q9, x), c10 = tri(C10, Q10, x);
  float al = c0.w; vec3 be = c1.xyz;
  vec3 d = vec3(c1.w, c2.x, c2.y);
  mat3 E = sym(c2.z, c2.w, c3.x, c3.y, c3.z, c3.w);
  vec3 Cv = vec3(c4.x * V.x + c4.y * V.y + c4.z * V.z, c4.w * V.x + c5.x * V.y + c5.y * V.z, c5.z * V.x + c5.w * V.y + c6.x * V.z);
  vec3 VV1 = vec3(V.x * V.x, V.y * V.y, V.z * V.z), VV2 = vec3(V.x * V.y, V.x * V.z, V.y * V.z);
  float Gx = c6.y * VV1.x + c7.x * VV1.y + c7.z * VV1.z + 2.0 * (c6.z * VV2.x + c6.w * VV2.y + c7.y * VV2.z);
  float Gy = c7.w * VV1.x + c8.z * VV1.y + c9.x * VV1.z + 2.0 * (c8.x * VV2.x + c8.y * VV2.y + c8.w * VV2.z);
  float Gz = c9.y * VV1.x + c10.x * VV1.y + c10.z * VV1.z + 2.0 * (c9.z * VV2.x + c9.w * VV2.y + c10.y * VV2.z);
  dV = c0.xyz + Cv + vec3(Gx, Gy, Gz) + V * (dot(d, V) + dot(V, E * V));
  dx = al * V - be;
  chi = c10.w;
}
// Schwarzschild of uMfar in isotropic coordinates (static)
void farRHS(vec3 x, vec3 V, out vec3 dx, out vec3 dV) {
  float r = max(length(x), 1e-3), q = uMfar / (2.0 * r);
  float psi = 1.0 + q, al = (1.0 - q) / (1.0 + q);
  vec3 n = x / r;
  vec3 dpsi = -q / r * n, dal = (uMfar / (r * r)) / ((1.0 + q) * (1.0 + q)) * n;
  float p4 = 1.0 / (psi * psi * psi * psi);
  dV = -p4 * dal - al * (2.0 / psi) * (2.0 * V * dot(V, dpsi) - dot(V, V) * dpsi) + V * dot(V, dal);
  dx = al * V;
}
float boxW(vec3 x) {
  vec3 a = vec3(abs(x.x), abs(x.y), abs(x.z));
  float lim = L - 1.0 * H, inner = L - 4.0 * H;
  return (1.0 - smoothstep(inner, lim, a.x)) * (1.0 - smoothstep(inner, lim, a.y)) * (1.0 - smoothstep(inner - 0.5 * H, lim - 0.5 * H, a.z));
}
void rhs(vec3 x, vec3 V, out vec3 dx, out vec3 dV, out float chi) {
  float w = uMode > 0.5 ? boxW(x) : 0.0;
  chi = 1.0;
  if (w >= 1.0) { gridRHS(x, V, dx, dV, chi); return; }
  farRHS(x, V, dx, dV);
  if (w > 0.0) {
    vec3 gx, gV; float gc; gridRHS(x, V, gx, gV, gc);
    dx = mix(dx, gx, w); dV = mix(dV, gV, w); chi = mix(1.0, gc, w);
  }
}
vec2 kick(vec2 b, float z) {   // weak-field deflection collected beyond |z| (towards the centre)
  float bb = max(length(b), 1e-3);
  return -(2.0 * uMfar / (bb * bb)) * (1.0 - z / sqrt(z * z + bb * bb)) * b;
}
void main() {
  vec2 uv = gl_FragCoord.xy / float(${lensRes});
  vec2 b = (uv * 2.0 - 1.0) * L;
  vec4 P = texelFetch(uPos, ivec2(0), 0);
  vec3 x = vec3(b, uZs);
  float psi0 = 1.0 + uMfar / (2.0 * length(x));
  vec3 V = vec3(kick(b, uZs), -1.0);
  V /= length(V) * psi0 * psi0;
  float esc = 0.0; int n = 0;
  for (int it = 0; it < 360; it++) {
    n = it;
    float rn = min(length(x - vec3(P.xy, 0.0)), length(x - vec3(P.zw, 0.0)));
    rn = min(rn, length(x));
    vec3 k1x, k1V; float chi;
    rhs(x, V, k1x, k1V, chi);
    if (chi < 0.12) break;                                   // inside the horizon region: captured
    float ds = clamp(0.06 * rn, 0.015, 2.5);
    float dt = ds / max(length(k1x), 0.04);
    vec3 k2x, k2V; float chi2;
    rhs(x + 0.5 * dt * k1x, V + 0.5 * dt * k1V, k2x, k2V, chi2);
    x += dt * k2x; V += dt * k2V;
    if (x.z < -uZs || (x.z > uZs && V.z > 0.0) || length(x) > 4.0 * uZs) { esc = 1.0; break; }
  }
  vec3 D = normalize(V);
  if (esc > 0.5) { D.xy += kick(x.xy, max(abs(x.z), 1.0)); D = normalize(D); }   // the rest of the way out
  float tl = length(D.xy);
  float ang = atan(tl, -D.z);
  vec2 dir = tl > 1e-9 ? D.xy / tl : vec2(0.0);
  o = vec4(esc > 0.5 ? ang * dir : vec2(0.0), esc, float(n) / 360.0);
}`;
  }

  /* ================================================================== host */
  class BBHNR {
    // GPU support is NOT scientific validation. Experimental evolutions may be
    // run explicitly in tests; the interactive background must not switch to
    // this solver until the physical acceptance tests pass.
    canStart() { return false; }
    static supported(gl) {
      if (!gl || !gl.getExtension("EXT_color_buffer_float") || !gl.getExtension("OES_texture_float_linear")) return false;
      return gl.getParameter(gl.MAX_DRAW_BUFFERS) >= 8 && gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) >= 16;
    }
    constructor(gl, opt = {}) {
      this.gl = gl;
      // Floating-point color buffer / linear filtering 확장 활성화 (MRT + RGBA32F 첨부 필수)
      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("OES_texture_float_linear");
      const N = opt.N ?? 64, L = opt.L ?? 10, NZ = N >> 1;
      let TX = Math.ceil(Math.sqrt(NZ));
      while (NZ % TX) TX++;
      this.g = { N, NZ, L, h: (2 * L) / N, TX, TY: NZ / TX, W: N * TX, H: N * (NZ / TX), conformalW: opt.conformalW ?? false };
      this.lensRes = opt.lensRes ?? 160;
      this.solverN = opt.solverN ?? 16;
      this.courant = opt.courant ?? 0.3;
      this.eta = opt.eta ?? 2;
      this.sigma = opt.sigma ?? 0.35;
      this.cako = opt.cako ?? false;
      this.precollapsed = opt.precollapsed ?? false;
      this.zs = opt.zs ?? 3 * L;
      this.t = 0;
      this.track = { t: [], x1: [], y1: [], x2: [], y2: [] };
      this.mode = "off";
      this._init();
    }
    _tex(w, h, internal, format, type, filter, data = null) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
      return t;
    }
    _fbo(texs) {
      const gl = this.gl, fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error("NR framebuffer incomplete " + st);
      return fb;
    }
    _prog(fs) {
      const gl = this.gl, p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("NR shader: " + gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("NR link: " + gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    }
    _init() {
      const gl = this.gl, g = this.g;
      const F = gl.FLOAT, RGBA = gl.RGBA, R32 = gl.RGBA32F;
      this.sets = [0, 1, 2].map(() => {
        const tex = Array.from({ length: 6 }, () => this._tex(g.W, g.H, R32, RGBA, F, gl.NEAREST));
        return { tex, fb: this._fbo(tex) };
      });
      this.cur = 0;
      this.coef = Array.from({ length: 11 }, () => this._tex(g.W, g.H, R32, RGBA, F, gl.LINEAR));
      this.coefFb = [this._fbo(this.coef.slice(0, 8)), this._fbo(this.coef.slice(8))];
      this.pos = [0, 1].map(() => { const t = this._tex(1, 1, R32, RGBA, F, gl.NEAREST); return { tex: t, fb: this._fbo([t]) }; });
      this.posCur = 0;
      this.HISTN = 64;
      this.hist = this._tex(this.HISTN, 1, R32, RGBA, F, gl.NEAREST);
      this.histFb = this._fbo([this.hist]);
      this.histBuf = new Float32Array(4 * this.HISTN);
      this.lens = this._tex(this.lensRes, this.lensRes, R32, RGBA, F, gl.LINEAR);
      this.lensFb = this._fbo([this.lens]);
      // u on the solver grid (3D texture, linear filter, clamp: Neumann at z = 0)
      const Ns = this.solverN;
      this.uTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_3D, this.uTex);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R32F, Ns, Ns, Ns >> 1, 0, gl.RED, F, new Float32Array(Ns * Ns * (Ns >> 1)));
      this.vao = gl.createVertexArray();
      this.P = {
        rhs: this._prog(rhsFS(g)),
        init: this._prog(initFS(g)),
        track: this._prog(trackFS(g)),
        copy: this._prog(COPY_FS),
        coef0: this._prog(coefFS(g, 0)),
        coef1: this._prog(coefFS(g, 1)),
        ray: this._prog(rayFS(g, this.lensRes)),
      };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    _bind(prog, names, texs, unit0 = 0) {
      const gl = this.gl;
      names.forEach((n, i) => {
        gl.activeTexture(gl.TEXTURE0 + unit0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texs[i]);
        gl.uniform1i(prog.u[n], unit0 + i);
      });
    }
    _draw(fb, w, h) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /**
     * Write the Bowen–York slice of a pair into the current state.
     * holes: [{M, x, y, vx, vy}] in units of the pair's total mass, about the barycentre, velocities in c.
     * solve = true: solve the Hamiltonian constraint for u (the start of an evolution); false: u = 0
     * (an analytic snapshot, only for drawing the pair before the hand-off).
     */
    setPair(holes, { solve = false } = {}) {
      const gl = this.gl, g = this.g, Ns = this.solverN;
      const id = NRID.pair(holes, { solverN: Ns, L: g.L, solveU: solve });
      this.id = id;
      const [q0, q1] = id.punctures;
      if (solve) {
        gl.bindTexture(gl.TEXTURE_3D, this.uTex);
        gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, Ns, Ns, Ns >> 1, gl.RED, gl.FLOAT, id.u);
      }
      const P = this.P.init;
      gl.useProgram(P.p);
      gl.uniform4f(P.u.uQ0, q0.x, q0.y, q0.m, 0); gl.uniform4f(P.u.uQ1, q1.x, q1.y, q1.m, 0);
      gl.uniform4f(P.u.uV0, q0.px, q0.py, q0.vx, q0.vy); gl.uniform4f(P.u.uV1, q1.px, q1.py, q1.vx, q1.vy);
      gl.uniform1f(P.u.uUseU, solve ? 1 : 0);
      gl.uniform1f(P.u.uPrecollapsed, this.precollapsed ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, this.uTex); gl.uniform1i(P.u.uU, 0);
      gl.uniform3f(P.u.uUScale, 1 / (2 * g.L), 1 / (2 * g.L), 1 / g.L);
      this._draw(this.sets[this.cur].fb, g.W, g.H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, null);
      // puncture positions
      gl.bindTexture(gl.TEXTURE_2D, this.pos[this.posCur].tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, new Float32Array([q0.x, q0.y, q1.x, q1.y]));
      this.posNow = [q0.x, q0.y, q1.x, q1.y];
      if (solve) {
        this.t = 0;
        for (const k in this.track) this.track[k].length = 0;
        this._record(0, this.posNow);
        this.mode = "nr";
      } else this.mode = "snapshot";
      return id;
    }
    _record(t, p) { const T = this.track; T.t.push(t); T.x1.push(p[0]); T.y1.push(p[1]); T.x2.push(p[2]); T.y2.push(p[3]); }
    dtMax() { return this.courant * this.g.h; }

    /** One SSP-RK3 step of size dt (M). */
    _step(dt) {
      const gl = this.gl, g = this.g, P = this.P.rhs;
      const A = this.sets[this.cur], Bs = this.sets[(this.cur + 1) % 3], Cs = this.sets[(this.cur + 2) % 3];
      gl.useProgram(P.p);
      gl.uniform1f(P.u.uDt, dt); gl.uniform1f(P.u.uEta, this.eta); gl.uniform1f(P.u.uSigma, this.sigma);
      gl.uniform1f(P.u.uCAKO, this.cako ? 1 : 0);
      gl.uniform1f(P.u.uDiagnostics, 0);
      const S = ["S0", "S1", "S2", "S3", "S4", "S5"], Y = ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5"];
      const stage = (src, dst, a, b) => {
        this._bind(P, S, src.tex, 0); this._bind(P, Y, A.tex, 6);
        gl.uniform1f(P.u.uA, a); gl.uniform1f(P.u.uB, b);
        this._draw(dst.fb, g.W, g.H);
      };
      stage(A, Bs, 0, 1);              // u1 = u + dt f(u)
      stage(Bs, Cs, 0.75, 0.25);       // u2 = ¾u + ¼(u1 + dt f(u1))
      stage(Cs, Bs, 1 / 3, 2 / 3);     // u  = ⅓u + ⅔(u2 + dt f(u2))
      this.cur = (this.cur + 1) % 3;
      // punctures
      const T = this.P.track, src = this.pos[this.posCur], dst = this.pos[1 - this.posCur];
      gl.useProgram(T.p);
      this._bind(T, ["uPos", "uB2"], [src.tex, this.sets[this.cur].tex[2]]);
      gl.uniform1f(T.u.uDt, dt);
      this._draw(dst.fb, 1, 1);
      this.posCur = 1 - this.posCur;
    }
    /** Evolve by dT (M) in equal steps ≤ dtMax; returns the step count. Reads back the puncture tracks. */
    advance(dT, maxSteps = 24) {
      if (this.mode !== "nr" || !(dT > 0)) return 0;
      if (!Number.isFinite(dT) || !(maxSteps>0)) return 0;
      const n = Math.min(this.HISTN, Math.floor(maxSteps), Math.max(1, Math.ceil(dT / this.dtMax() - 1e-9)));
      const dt = Math.min(dT / n, this.dtMax());
      const gl = this.gl, C = this.P.copy;
      for (let i = 0; i < n; i++) {
        this._step(dt);
        gl.useProgram(C.p);
        this._bind(C, ["uPos"], [this.pos[this.posCur].tex]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.histFb);
        gl.viewport(i % this.HISTN, 0, 1, 1);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.histFb);
      gl.readPixels(0, 0, Math.min(n, this.HISTN), 1, gl.RGBA, gl.FLOAT, this.histBuf);
      for (let i = 0; i < Math.min(n, this.HISTN); i++) {
        this.t += dt;
        const p = this.histBuf.subarray(4 * i, 4 * i + 4);
        this.posNow = [p[0], p[1], p[2], p[3]];
        this._record(this.t, this.posNow);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return n;
    }
    /** Ray-trace the current slice into the lens map. Mfar: mass of the Schwarzschild exterior. */
    trace(Mfar = 1) {
      const gl = this.gl, g = this.g, st = this.sets[this.cur].tex;
      for (const [k, prog] of [[0, this.P.coef0], [1, this.P.coef1]]) {
        gl.useProgram(prog.p);
        this._bind(prog, ["S0", "S1", "S2", "S3", "S4"], st.slice(0, 5));
        this._draw(this.coefFb[k], g.W, g.H);
      }
      const R = this.P.ray;
      gl.useProgram(R.p);
      this._bind(R, Array.from({ length: 11 }, (_, k) => "C" + k), this.coef);
      this._bind(R, ["uPos"], [this.pos[this.posCur].tex], 11);
      gl.uniform1f(R.u.uMfar, Mfar); gl.uniform1f(R.u.uZs, this.zs); gl.uniform1f(R.u.uMode, 1);
      this._draw(this.lensFb, this.lensRes, this.lensRes);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    /** Tests: one forward-Euler stage S → S + dt·f(S) into the next set, without advancing; returns its 6 textures. */
    probeRHS(dt) {
      const gl = this.gl, g = this.g, P = this.P.rhs;
      const A = this.sets[this.cur], Bs = this.sets[(this.cur + 1) % 3];
      gl.useProgram(P.p);
      gl.uniform1f(P.u.uDt, dt); gl.uniform1f(P.u.uEta, this.eta); gl.uniform1f(P.u.uSigma, this.sigma);
      gl.uniform1f(P.u.uCAKO, this.cako ? 1 : 0);
      gl.uniform1f(P.u.uDiagnostics, 0);
      this._bind(P, ["S0", "S1", "S2", "S3", "S4", "S5"], A.tex, 0); this._bind(P, ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5"], A.tex, 6);
      gl.uniform1f(P.u.uA, 0); gl.uniform1f(P.u.uB, 1);
      this._draw(Bs.fb, g.W, g.H);
      const keep = this.cur; this.cur = (this.cur + 1) % 3;
      const out = [0, 1, 2, 3, 4, 5].map((k) => this.read(k));
      this.cur = keep;
      return out;
    }
    /** Constraint norms outside excised puncture balls; no claim of horizon finding.
     * Norms must converge with resolution before an evolution is trusted.
     * This is an explicit diagnostic (GPU readback), never called from the render loop.
     */
    constraints({ excision = 1, radius = 6 } = {}) {
      const gl = this.gl, g = this.g, P = this.P.rhs;
      const dst = (this.cur + 1) % 3, keep = this.cur;
      gl.useProgram(P.p);
      this._bind(P, ["S0", "S1", "S2", "S3", "S4", "S5"], this.sets[keep].tex);
      this._bind(P, ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5"], this.sets[keep].tex, 6);
      gl.uniform1f(P.u.uDiagnostics, 1);
      this._draw(this.sets[dst].fb, g.W, g.H);
      this.cur = dst;
      const H = this.read(0), G = this.read(1), F = this.read(2);
      this.cur = keep;
      gl.useProgram(P.p); gl.uniform1f(P.u.uDiagnostics, 0);
      const p = this.posNow || [0, 0, 0, 0];
      let h2 = 0, m2 = 0, g2 = 0, scale2 = 0, maxH = 0, cells = 0, invalid = 0;
      for (let k = 0; k < g.NZ - 3; k++) for (let j = 3; j < g.N - 3; j++) for (let i = 3; i < g.N - 3; i++) {
        const x = -g.L + (i+.5)*g.h, y = -g.L + (j+.5)*g.h, z = (k+.5)*g.h;
        if (Math.hypot(x, y, z) > radius || Math.hypot(x-p[0], y-p[1], z) < excision || Math.hypot(x-p[2], y-p[3], z) < excision) continue;
        const c = this.cell(i, j, k), hh = H[c];
        if (![hh,H[c+1],H[c+2],H[c+3],G[c],G[c+1],G[c+2]].every(Number.isFinite)) { invalid++; continue; }
        h2 += hh*hh; maxH = Math.max(maxH, Math.abs(hh));
        for (let q = 1; q < 4; q++) m2 += H[c+q]**2;
        for (let q = 0; q < 3; q++) g2 += G[c+q]**2;
        const scale = Math.abs(F[c]) + F[c+1] + (2/3)*F[c+2]**2;
        scale2 += scale*scale; cells++;
      }
      return { H: Math.sqrt(h2/cells), M: Math.sqrt(m2/cells), Gamma: Math.sqrt(g2/cells), relativeH: Math.sqrt(h2/Math.max(scale2,1e-30)), maxH, cells, invalid };
    }
    /** Read a state texture back (tests / diagnostics). */
    read(k) {
      const gl = this.gl, g = this.g, fb = gl.createFramebuffer(), out = new Float32Array(4 * g.W * g.H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sets[this.cur].tex[k], 0);
      gl.readPixels(0, 0, g.W, g.H, gl.RGBA, gl.FLOAT, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
      return out;
    }
    readLens() {
      const gl = this.gl, out = new Float32Array(4 * this.lensRes * this.lensRes);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.lensFb);
      gl.readPixels(0, 0, this.lensRes, this.lensRes, gl.RGBA, gl.FLOAT, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return out;
    }
    /** Index of cell (i, j, k) in a read-back atlas (RGBA). */
    cell(i, j, k) { const g = this.g; return 4 * (((k / g.TX | 0) * g.N + j) * g.W + (k % g.TX) * g.N + i); }
    /** Write arbitrary fields (tests): fn(x, y, z) → [24 numbers in texture order]. */
    writeState(fn) {
      const gl = this.gl, g = this.g;
      const bufs = Array.from({ length: 6 }, () => new Float32Array(4 * g.W * g.H));
      for (let k = 0; k < g.NZ; k++) for (let j = 0; j < g.N; j++) for (let i = 0; i < g.N; i++) {
        const v = fn(-g.L + (i + 0.5) * g.h, -g.L + (j + 0.5) * g.h, (k + 0.5) * g.h), c = this.cell(i, j, k);
        for (let t = 0; t < 6; t++) for (let q = 0; q < 4; q++) bufs[t][c + q] = v[4 * t + q];
      }
      bufs.forEach((b, t) => { gl.bindTexture(gl.TEXTURE_2D, this.sets[this.cur].tex[t]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, g.W, g.H, gl.RGBA, gl.FLOAT, b); });
    }
    setPunctures(p) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.pos[this.posCur].tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, new Float32Array(p));
      this.posNow = p.slice();
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = BBHNR;
  else root.BBHNR = BBHNR;
})(typeof self !== "undefined" ? self : this);
