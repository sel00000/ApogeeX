/*
 * bbh-sim.js — N-body (≤ 4) black-hole simulator for the background. Pure: no DOM, no WebGL.
 * Needs bbh-physics.js. Units: px, s, c in px/s, masses as gravitational radii Gm/c² in px.
 *
 * Production opts.eob=true additionally switches approaching pairs below 8M to the Hamiltonian
 * in bbh-eob.js. Position/velocity and the GW slot are preserved; the PN→EOB coordinate stitch is
 * approximate. The EOB orbit is integrated to 3M. This is not a BSSN or common-horizon solution.
 *
 * The legacy PN path: every body moves under the pairwise post-Newtonian forces of BBH.relAccel (Newton + tapered 1PN +
 * 2.5PN radiation reaction) plus environmental hardening (BBH.envAccel), integrated with RK4 in fixed
 * physics sub-steps chosen from the tightest orbit, never from the frame rate. A pair that reaches
 * r < 3M becomes one remnant (NR-fit mass) moving with the pair's barycentre; for a short time the two
 * horizons are drawn as two shrinking, growing components that fuse into the remnant (the morph), while
 * the wave emitted rings down with the remnant's quasi-normal frequency.
 *
 * Gravitational waves: for every pair (and every ringing remnant) the trace-free Q̈ is sampled at a
 * fixed physics rate into a ring buffer; the renderer reads it at the retarded time t − r/c.
 */
(function (root) {
  "use strict";
  const BBH = root.BBH || (typeof require !== "undefined" ? require("./bbh-physics.js") : null);
  const EOB = root.BBHEOB || (typeof require !== "undefined" ? require("./bbh-eob.js") : null);
  const SQ27 = 3 * Math.sqrt(3);          // shadow radius = 3√3 · Gm/c²
  const rhoOf = (b) => (b.morph ? b.morph.rhoF : b.rho) || 0;

  class BBHSim {
    constructor(opts) {
      this.c = opts.c;                     // px per s
      this.R_MERGE = opts.mergeM ?? 3;     // PN integration stops at r = 3 M
      this.SLOTS = opts.slots ?? 6;
      this.HIST = opts.hist ?? 512;        // samples per slot
      this.DT_S = opts.sampleDt ?? 1 / 240;  // physics seconds between samples
      this.bodies = [];
      this.slots = Array.from({ length: this.SLOTS }, (_, i) => ({
        i, key: null, kind: null, buf: new Float32Array(this.HIST * 2), head: -1, x: 0, y: 0, drain: 0, peak: 0,
      }));
      this.t = 0;
      this.nextSample = 0;
      this.nextId = 1;
      this.ext = null;                     // (body) → [ax, ay] external accel (wander, walls), held per frame
      this.events = [];                    // merger log for the UI
      this.useEOB = opts.eob ?? false;     // explicit production option; legacy PN path remains testable
      this._forcePN = new Float64Array(2);
      this._forceEnv = new Float64Array(2);
    }

    /** m in mass units; shadow radius rc = R1·m px fixes Gm/c² = rc / 3√3. */
    add(x, y, vx, vy, Mg) {
      const b = { id: this.nextId++, x, y, vx, vy, M: Mg, rho: SQ27 * Mg, mergerCount: 0, kin: false, morph: null, ext: [0, 0] };
      this.bodies.push(b);
      return b;
    }
    remove(b) {
      const i = this.bodies.indexOf(b);
      if (i >= 0) this.bodies.splice(i, 1);
    }
    /** Translate the screen-coordinate origin, never scale the physical system.
     * A viewport resize must not change separations or delete an offscreen pair.
     */
    translate(dx,dy) {
      for(const b of this.bodies){b.x+=dx;b.y+=dy;}
      for(const s of this.slots){s.x+=dx;s.y+=dy;}
    }
    /** Background interaction: place a body co-moving with its close neighbour.
     * The hand is an external force; do not turn pointer smoothing into a
     * relativistic slingshot when the user merely places a hole nearby.
     */
    releasePlaced(b) {
      b.kin=false;
      let nearest=null,d=Infinity;
      for(const q of this.bodies)if(q!==b&&!q.retiring){
        const r=Math.hypot(q.x-b.x,q.y-b.y);
        if(r<32*(q.M+b.M)&&r<d){nearest=q;d=r;}
      }
      b.vx=nearest?nearest.vx:0;b.vy=nearest?nearest.vy:0;
    }

    /* -------------------------------------------------------------- forces */
    _accel(pos, vel, out) {
      const B = this.bodies, n = B.length, c = this.c;
      for (let i = 0; i < n; i++) { out[2 * i] = B[i].ext[0]; out[2 * i + 1] = B[i].ext[1]; }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const coupling=(B[i].coupling??1)*(B[j].coupling??1);
          if(coupling<=0)continue;
          const x = pos[2 * i] - pos[2 * j], y = pos[2 * i + 1] - pos[2 * j + 1];
          const vx = vel[2 * i] - vel[2 * j], vy = vel[2 * i + 1] - vel[2 * j + 1];
          const M = B[i].M + B[j].M, eta = (B[i].M * B[j].M) / (M * M);
          const r = Math.hypot(x, y);
          const rs = Math.max(r, 0.5 * this.R_MERGE * M);   // guard inside the merge radius
          const sx = (r > 1e-12 ? x / r : 1) * rs, sy = (r > 1e-12 ? y / r : 0) * rs;
          let [ax, ay] = BBH.relAccel(sx, sy, vx, vy, M, eta, c, BBH.pn1Taper(rs, M), 1, this._forcePN);
          // The gas-disc friction models a freely orbiting pair. A hand-held hole is moved by an external
          // force (infinite effective mass), so friction on that pair would only shove the free hole along
          // the hand's motion, which is not physical. While held, gravity (PN) alone acts on the pair.
          const held = B[i].kin || B[j].kin;
          const [ex, ey] = held ? [0, 0] : BBH.envAccel(sx, sy, vx, vy, M, eta, c, this._sense(B[i], B[j], x, y, vx, vy, M),this._forceEnv);
          ax = coupling*(ax+ex); ay = coupling*(ay+ey);
          const fi = B[j].M / M, fj = B[i].M / M;
          out[2 * i] += fi * ax; out[2 * i + 1] += fi * ay;
          out[2 * j] -= fj * ax; out[2 * j + 1] -= fj * ay;
        }
      }
    }
    /** Sub-step from the tightest pair's orbital time: h = 0.02 √(r³/GM), capped at the sample interval. */
    _h() {
      const B = this.bodies, c = this.c;
      let h = this.DT_S;
      for (const b of B) if (b.eob) h = Math.min(h, 0.02*Math.sqrt(b.eob.orbit.state[0]**3)*b.M/c);
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const r = Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y), M = B[i].M + B[j].M;
        const rs = Math.max(r, this.R_MERGE * M);
        h = Math.min(h, 0.02 * Math.sqrt((rs * rs * rs) / (c * c * M)));
      }
      return Math.max(h, 2e-5);
    }
    _rk4(h) {
      const B = this.bodies, n = B.length, N2 = 2 * n;
      if (!this._w || this._w.n !== n) {
        const F = () => new Float64Array(N2);
        this._w = { n, p0: F(), v0: F(), a1: F(), a2: F(), a3: F(), a4: F(), p: F(), v: F(), v1: F(), v2: F(), v3: F() };
      }
      const W = this._w, { p0, v0, a1, a2, a3, a4, p, v, v1, v2, v3 } = W;
      for (let i = 0; i < n; i++) { p0[2 * i] = B[i].x; p0[2 * i + 1] = B[i].y; v0[2 * i] = B[i].vx; v0[2 * i + 1] = B[i].vy; }
      const stage = (dt, kp, kv, outV) => {
        for (let i = 0; i < N2; i++) {
          const fixed = B[i >> 1].kin;
          p[i] = fixed ? p0[i] : p0[i] + dt * kp[i];
          v[i] = fixed ? v0[i] : v0[i] + dt * kv[i];
          outV[i] = v[i];
        }
      };
      this._accel(p0, v0, a1);
      stage(h / 2, v0, a1, v1); this._accel(p, v, a2);
      stage(h / 2, v1, a2, v2); this._accel(p, v, a3);
      stage(h, v2, a3, v3); this._accel(p, v, a4);
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (b.kin) continue;   // held by the user: the hand sets its position (its velocity still enters the forces)
        b.x += (h / 6) * (v0[2 * i] + 2 * v1[2 * i] + 2 * v2[2 * i] + v3[2 * i]);
        b.y += (h / 6) * (v0[2 * i + 1] + 2 * v1[2 * i + 1] + 2 * v2[2 * i + 1] + v3[2 * i + 1]);
        b.vx += (h / 6) * (a1[2 * i] + 2 * a2[2 * i] + 2 * a3[2 * i] + a4[2 * i]);
        b.vy += (h / 6) * (a1[2 * i + 1] + 2 * a2[2 * i + 1] + 2 * a3[2 * i + 1] + a4[2 * i + 1]);
      }
    }

    /* -------------------------------------------------------------- pairs, merger */
    _pairState(a, b) {
      const x = a.x - b.x, y = a.y - b.y, vx = a.vx - b.vx, vy = a.vy - b.vy;
      const M = a.M + b.M, eta = (a.M * b.M) / (M * M), r = Math.hypot(x, y);
      return { x, y, vx, vy, M, eta, r, mu: eta * M };
    }
    /** Q̈ of a pair from its relative motion (PN acceleration, no external forcing). */
    _pairQ(a, b) {
      const s = this._pairState(a, b);
      const rs = Math.max(s.r, this.R_MERGE * s.M);
      const sx = (s.r > 1e-12 ? s.x / s.r : 1) * rs, sy = (s.r > 1e-12 ? s.y / s.r : 0) * rs;
      const [ax, ay] = BBH.relAccel(sx, sy, s.vx, s.vy, s.M, s.eta, this.c, BBH.pn1Taper(rs, s.M), 1);
      return BBH.quadrupoleDDot(sx, sy, s.vx, s.vy, ax, ay, s.mu, this.c);
    }
    _merge(a, b, quadrupole = null, spinFactor = null) {
      const c = this.c, s = this._pairState(a, b);
      const L = s.x * s.vy - s.y * s.vx;                         // relative angular momentum per μ
      const Lc = Math.sqrt(c * c * s.M * s.r);                   // circular-orbit value at this r
      const f = spinFactor ?? (Lc > 0 ? Math.min(1, Math.abs(L) / Lc) : 0);
      const sense = L >= 0 ? 1 : -1;
      const rem = BBH.remnant(s.eta, f);
      const Mf = rem.Mf * s.M;
      const wRD = (rem.wRD * c) / s.M;                           // rad/s
      const tauD = (rem.tauD * s.M) / c;                         // s
      const rdot = s.r > 1e-12 ? Math.min(0,(s.x * s.vx + s.y * s.vy) / s.r) : 0;
      const tauS = Math.min(3 * tauD, Math.max(1.2 * tauD, s.r / Math.max(-rdot, 1e-9)));
      const kS = s.r > 1e-12 ? Math.max(0, 1 + (rdot * tauS) / s.r) : 1;
      const vx = (a.vx * a.M + b.vx * b.M) / s.M, vy = (a.vy * a.M + b.vy * b.M) / s.M;
      const x = (a.x * a.M + b.x * b.M) / s.M, y = (a.y * a.M + b.y * b.M) / s.M;
      const [A, Bq] = quadrupole || this._pairQ(a, b);

      this.remove(a); this.remove(b);
      const R = this.add(x, y, vx, vy, Mf);
      // Continue the longer merger lineage; combining two histories is not extra encounters.
      R.mergerCount = Math.max(a.mergerCount || 0, b.mergerCount || 0) + 1;
      R.kin = false;
      R.morph = {
        t: 0, startT:this.t, tauS, kS, tauD, wRD, f, sense, r0: s.r, phi0: Math.atan2(s.y, s.x),
        w0: s.r > 1e-12 ? Math.abs(L) / (s.r * s.r) * 2 : 0,      // GW angular frequency at the hand-off
        comps: [
          { M0: a.M, rho0: a.rho, w: a.M / s.M, side: b.M / s.M },
          { M0: b.M, rho0: b.rho, w: b.M / s.M, side: -a.M / s.M },
        ],
        rhoF: SQ27 * Mf,
      };
      R.rho = 0;   // drawn through its components until the morph ends

      // The pair's wave slot becomes the remnant's ringdown slot (continuous phase and amplitude).
      let slot = this.slots.find((q) => q.key === this._key(a, b));
      if(!slot) {
        slot=this._vacantSlot();
        if(slot){slot.head=-1;slot.buf.fill(0);slot.peak=0;slot.near=0.8*Math.max(a.rho,b.rho);slot.lastK=Math.hypot(A,Bq);}
      }
      if (slot) {
        slot.key = "R" + R.id; slot.kind = "ring";
        const prevK = slot.lastK ?? Math.hypot(A, Bq);
        const K = Math.hypot(A, Bq);
        const kdot = (K - prevK) / this.DT_S;
        slot.ring = { Z: [A, Bq], a: Math.min(4, Math.max(1, 1 + (tauD * kdot) / Math.max(K, 1e-12))), body: R, tauD };
        slot.x=x;slot.y=y;slot.pair=null;
      }
      this.events.push({ t: this.t, remnant: R, eta: s.eta, f, Mf, M: s.M, af: rem.af });
      return R;
    }

    _startEOB(a,b) {
      const s=this._pairState(a,b);
      if (!(s.r>3*s.M)) return false;
      const vr=(s.x*s.vx+s.y*s.vy)/(s.r*this.c);
      const omega=(s.x*s.vy-s.y*s.vx)/(s.r*s.r)*s.M/this.c;
      const orbit=EOB.fromVelocity(s.r/s.M,Math.atan2(s.y,s.x),vr,omega,s.eta);
      if (!orbit) return false;
      const R=this.add((a.x*a.M+b.x*b.M)/s.M,(a.y*a.M+b.y*b.M)/s.M,
        (a.vx*a.M+b.vx*b.M)/s.M,(a.vy*a.M+b.vy*b.M)/s.M,s.M);
      R.eob={orbit,eta:s.eta,members:[a,b],key:"E"+R.id};
      this.remove(a);this.remove(b);
      const slot=this.slots.find(q=>q.key===this._key(a,b));
      if(slot) {slot.key=R.eob.key;slot.kind="eob";slot.eobBody=R;}
      return true;
    }
    _eobMembers(R) {
      const {orbit,members}=R.eob,s=orbit.state, v=EOB.velocity(s,orbit.eta);
      const x=s[0]*Math.cos(s[1])*R.M,y=s[0]*Math.sin(s[1])*R.M;
      return members.map((q,i)=>{
        const side=(i===0?members[1].M:-members[0].M)/R.M;
        return {id:q.id,M:q.M,rho:q.rho,mergerCount:q.mergerCount||0,x:R.x+side*x,y:R.y+side*y,vx:R.vx+side*v[0]*this.c,vy:R.vy+side*v[1]*this.c};
      });
    }
    _eobQ(R) {
      const k=R.eob.orbit.kinematics(),M=R.M,c=this.c;
      return BBH.quadrupoleDDot(k.x*M,k.y*M,k.vx*c,k.vy*c,k.ax*c*c/M,k.ay*c*c/M,R.eob.eta*M,c);
    }
    _finishEOB(R, escape=false) {
      const [a,b]=this._eobMembers(R),e=R.eob;
      const slot=this.slots.find(q=>q.key===e.key);
      if(slot) {slot.key=this._key(a,b);slot.kind="pair";slot.pair=[a,b];slot.eobBody=null;}
      const Q=this._eobQ(R);
      this.remove(R);
      if(escape) {
        // Outbound solutions are allowed; never turn them into forced mergers.
        for(const q of [a,b])this.bodies.push({...q,kin:false,morph:null,ext:[0,0]});
      } else {
        const fit=BBH.remnant(e.eta);
        // Canonical EOB j carries the angular momentum; coordinate r²φ̇
        // does not. Cap the fitted final spin by the available J/M_f².
        const spinFactor=Math.min(1,e.eta*Math.abs(e.orbit.state[3])/(fit.Mf*fit.Mf*Math.max(fit.af,1e-12)));
        const remnant=this._merge(a,b,Q,spinFactor);
        if(R.retiring){remnant.retiring=R.retiring;remnant.coupling=R.coupling;}
        this.events[this.events.length-1].model="EOB";
      }
    }
    /** GW angular frequency of a morph: relaxes from the hand-off value to the QNM. */
    _morphW(m) { return m.wRD - (m.wRD - Math.min(m.w0, m.wRD)) * Math.exp(-m.t / (0.6 * m.tauD)); }
    /** Phase Ψ(t) = ∫ω dt (closed form of the relaxation above). */
    _morphPsi(m) {
      const w0 = Math.min(m.w0, m.wRD), tw = 0.6 * m.tauD;
      return m.wRD * m.t - (m.wRD - w0) * tw * (1 - Math.exp(-m.t / tw));
    }

    /**
     * Rotation angle of the fusing horizons: ω_rot = ½ [f ω_RD + (ω₀ − f ω_RD) e^{−t/τw}], so the
     * components start at the pair's own angular velocity |L|/r² (= ½ω₀) and a head-on pair (f = 0) stops turning.
     */
    _morphRot(m) {
      const tw = 0.6 * m.tauD, wf = m.f * m.wRD;
      return 0.5 * (wf * m.t + (m.w0 - wf) * tw * (1 - Math.exp(-m.t / tw)));
    }

    /** Components to draw (lens + shadow) — bodies, or the two fusing horizons of a fresh remnant. */
    components() {
      const out = [];
      for (const b of this.bodies) {
        if (b.eob) {
          for(const q of this._eobMembers(b))out.push({...q,glow:0,eob:true,owner:b});
          continue;
        }
        if (!b.morph) { out.push({ x: b.x, y: b.y, M: b.M, rho: b.rho, glow: 0, id: b.id,owner:b }); continue; }
        const m = b.morph, u = m.t / m.tauS, ex0 = Math.exp(-u);
        const sep = m.r0 * ex0 * (1 + m.kS * u);                 // starts at r with ṡ = ṙ
        const e = ex0 * (1 + u);                                  // 1 → 0 with zero initial slope
        const phi = m.phi0 + m.sense * this._morphRot(m);
        const ex = Math.cos(phi), ey = Math.sin(phi);
        const glow = Math.exp(-m.t / (2 * m.tauD));
        for (const q of m.comps) {
          const Mi = q.M0 + (q.w * b.M - q.M0) * (1 - e);
          const rhoF = m.rhoF * Math.pow(q.w, 0.25);            // Σρ⁴ = ρ_f⁴ when the two coincide
          // Schwarzschild bending is nonlinear in mass. Two coincident M/2
          // lenses do NOT equal one M lens, even though their masses sum to M.
          // Blend the unresolved pair to its monopole before retiring its
          // components. This is a labelled optical approximation, not a horizon.
          const totalM = m.comps.reduce((sum, c) => sum + c.M0 + (c.w * b.M - c.M0) * (1-e), 0);
          out.push({ x: b.x + q.side * sep * ex, y: b.y + q.side * sep * ey, M: Mi, rho: q.rho0 + (rhoF - q.rho0) * (1 - e), glow, id: b.id,owner:b,
            group: { x: b.x, y: b.y, M: totalM, blend: 1-e*e } });
        }
      }
      for(const q of out) {
        const exit=q.owner?.retiring;
        q.opacity=(exit?exit.opacity:1)*(q.owner?.arrival?.opacity??1);
        if(exit){q.x+=exit.dx;q.y+=exit.dy;if(q.group){q.group.x+=exit.dx;q.group.y+=exit.dy;}}
      }
      return out;
    }

    _key(a, b) { return a.id < b.id ? a.id + "-" + b.id : b.id + "-" + a.id; }
    /**
     * Rotation sense of the gas disc around a pair, fixed when the pair first enters the disc and kept
     * until it leaves again (a disc does not reverse its rotation under a passing pair).
     */
    _sense(a, b, x, y, vx, vy, M) {
      const key = this._key(a, b);
      this._senses = this._senses || new Map();
      const r = Math.hypot(x, y);
      if (r > (BBH.ENV.rEnvM + 4) * M) { this._senses.delete(key); return 1; }   // outside the disc: unused
      let s = this._senses.get(key);
      if (s === undefined) {
        // the disc turns the way the pair already turns (a head-on pair picks a side once)
        const L = x * vy - y * vx, Lc = Math.sqrt(this.c * this.c * M * r);
        s = Math.abs(L) > 0.05 * Lc ? Math.sign(L) : (this._rng() < 0.5 ? -1 : 1);
        this._senses.set(key, s);
      }
      return s;
    }
    _rng() { return Math.random(); }

    /* -------------------------------------------------------------- GW sampling */
    _sample() {
      const B = this.bodies;
      const live = new Set();
      for(const R of B) if(R.eob) {
        const e=R.eob;live.add(e.key);
        let slot=this.slots.find(q=>q.key===e.key);
        if(!slot) {
          slot=this._vacantSlot();
          if(!slot)continue;
          slot.ring=null;slot.eobBody=null;slot.key=e.key;slot.head=-1;slot.buf.fill(0);slot.peak=0;slot.drain=0;
        }
        slot.kind="eob";slot.eobBody=R;slot.x=R.x;slot.y=R.y;
        slot.near=0.8*Math.max(...e.members.map(q=>q.rho));
        const [A,Bq]=this._eobQ(R);slot.lastK=Math.hypot(A,Bq);this._push(slot,A,Bq);
      }
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        if(B[i].retiring||B[j].retiring)continue;
        const key = this._key(B[i], B[j]);
        live.add(key);
        let slot = this.slots.find((q) => q.key === key);
        if (!slot) {
          slot = this._vacantSlot();
          if (!slot) continue;
          slot.ring=null;slot.eobBody=null;slot.key = key; slot.kind = "pair"; slot.head = -1; slot.buf.fill(0); slot.peak = 0; slot.drain = 0; slot.lastK = undefined; slot.near = 0;
        }
        const [A, Bq] = this._pairQ(B[i], B[j]);
        slot.x = (B[i].x * B[i].M + B[j].x * B[j].M) / (B[i].M + B[j].M);
        slot.y = (B[i].y * B[i].M + B[j].y * B[j].M) / (B[i].M + B[j].M);
        slot.lastK = Math.hypot(A, Bq);
        slot.pair = [B[i], B[j]];
        // near-zone edge for the renderer: set while the pair lives, kept unchanged through the ringdown
        slot.near = 0.8 * Math.max(rhoOf(B[i]), rhoOf(B[j]));
        this._push(slot, A, Bq);
      }
      for (const slot of this.slots) {
        if (slot.key === null || live.has(slot.key)) continue;
        if (slot.kind === "ring" && slot.ring) {
          const R = slot.ring.body, m = R.morph;
          const tt = m ? m.t : Infinity;
          const g = (1 + slot.ring.a * tt / slot.ring.tauD) * Math.exp(-tt / slot.ring.tauD);
          let A = 0, Bq = 0;
          if (m) {
            const psi = this._morphPsi(m);
            const rot = m.sense * psi, cs = Math.cos(rot), sn = Math.sin(rot);
            const [ZA, ZB] = slot.ring.Z;
            // f · Z e^{i·sense·Ψ} (rotating) + (1−f) · Z cos Ψ (standing, head-on)
            A = g * (m.f * (ZA * cs - ZB * sn) + (1 - m.f) * ZA * Math.cos(psi));
            Bq = g * (m.f * (ZA * sn + ZB * cs) + (1 - m.f) * ZB * Math.cos(psi));
          }
          slot.x = R.x; slot.y = R.y;
          if (!m || g < 1e-4) { slot.kind = "drain"; slot.drain = 0; }
          this._push(slot, A, Bq);
        } else {
          // body gone or pair broken: keep writing zeros until the stored wave has left the buffer
          slot.kind = "drain";
          this._push(slot, 0, 0);
          if (++slot.drain > this.HIST) { slot.key = null; slot.kind = null; slot.ring = null; slot.pair = null; }
        }
      }
    }
    _vacantSlot() {
      const free=this.slots.find(q=>q.key===null);if(free)return free;
      let quiet=null;
      for(const q of this.slots)if(q.kind==='drain'&&(!quiet||q.peak<quiet.peak))quiet=q;
      return quiet;
    }
    _push(slot, A, B) {
      if(slot.head<0){if(slot.blockPeak)slot.blockPeak.fill(0);slot.peak=0;slot.currentPeak=0;slot.writingPeak=0;}
      slot.head++;
      const k = ((slot.head % this.HIST) + this.HIST) % this.HIST;
      slot.buf[2 * k] = A; slot.buf[2 * k + 1] = B;
      // Visibility uses a conservative maximum of the STORED history, not
      // the current source amplitude: a packet may still be travelling after
      // its emitter has stopped ringing. Block maxima cost O(1) amortised.
      const mag=Math.hypot(A,B),blockSize=Math.min(64,this.HIST);
      if(!slot.blockPeak)slot.blockPeak=new Float32Array(Math.ceil(this.HIST/blockSize));
      if(k%blockSize===0)slot.writingPeak=0;
      slot.writingPeak=Math.max(slot.writingPeak,mag);
      slot.peak=Math.max(slot.peak,mag);
      if(k%blockSize===blockSize-1||k===this.HIST-1){
        slot.blockPeak[Math.floor(k/blockSize)]=slot.writingPeak;
        slot.peak=0;for(const value of slot.blockPeak)slot.peak=Math.max(slot.peak,value);
      }
      slot.currentPeak=Math.max((slot.currentPeak||0)*.995,mag);
      if(mag>1e-5)slot.lastSignalT=this.t;
    }

    /* -------------------------------------------------------------- step */
    /** Advance physics time by dt (s). Returns the number of sub-steps. */
    step(dt) {
      let left = dt, n = 0;
      if(this.nextSample<=this.t+1e-12){this._sample();this.nextSample=this.t+this.DT_S;}
      while (left > 1e-12 && n < 400) {
        const h = Math.min(this._h(), left, this.nextSample - this.t > 1e-12 ? this.nextSample - this.t : this.DT_S);
        this._rk4(h);
        this.t += h; left -= h; n++;
        for(const b of this.bodies.slice()) if(b.eob) {
          b.eob.orbit.step(h*this.c/b.M);
          const r=b.eob.orbit.state[0];
          if(r<=3)this._finishEOB(b);
          else if(r>12)this._finishEOB(b,true);
        }
        // morphs and ringdown generators advance with physics time
        for (const b of this.bodies) {
          if (!b.morph) continue;
          b.morph.t = b.morph.startT===undefined ? b.morph.t+h : this.t-b.morph.startT;
          if (b.morph.t > 6 * b.morph.tauS && b.morph.t > 8 * b.morph.tauD) { b.rho = b.morph.rhoF; b.morph = null; b.settledAt = this.t; }
        }
        // merger: PN stops at r < 3M (also when the user pushes one hole onto another)
        const B = this.bodies;
        outer:
        for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
          if (B[i].morph || B[j].morph || B[i].eob || B[j].eob || B[i].retiring || B[j].retiring) continue;
          const M = B[i].M + B[j].M;
          const r=Math.hypot(B[i].x-B[j].x,B[i].y-B[j].y);
          if(this.useEOB && EOB && !B[i].kin && !B[j].kin && r<8*M && r>3*M &&
            (B[i].x-B[j].x)*(B[i].vx-B[j].vx)+(B[i].y-B[j].y)*(B[i].vy-B[j].vy)<0 && this._startEOB(B[i],B[j]))break outer;
          if (r < this.R_MERGE * M) {
            if (B[i].kin) B[i].kin = false;
            if (B[j].kin) B[j].kin = false;
            this._merge(B[i], B[j]);
            break outer;
          }
        }
        if (this.t >= this.nextSample - 1e-12) { this._sample(); this.nextSample += this.DT_S; }
      }
      return n;
    }

    /** Fastest orbital (or ringdown) angular frequency on screen, rad per physics-second. */
    maxOmega() {
      let w = 0;
      const B = this.bodies;
      for(const b of B)if(b.eob&&!b.retiring)w=Math.max(w,Math.abs(EOB.rhs(b.eob.orbit.state,b.eob.eta,1)[1])*this.c/b.M);
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        if(B[i].retiring||B[j].retiring)continue;
        const s = this._pairState(B[i], B[j]);
        if (s.r > 30 * s.M) continue;
        const r = Math.max(s.r, this.R_MERGE * s.M);
        w = Math.max(w, Math.abs(s.x * s.vy - s.y * s.vx) / (r * r), Math.sqrt((this.c * this.c * s.M) / r ** 3) * 0.5);
      }
      for (const b of B) if (b.morph) w = Math.max(w, 0.5 * this._morphW(b.morph) * Math.exp(-b.morph.t / (4 * b.morph.tauD)));
      return w;
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = BBHSim;
  else root.BBHSim = BBHSim;
})(typeof self !== "undefined" ? self : this);
