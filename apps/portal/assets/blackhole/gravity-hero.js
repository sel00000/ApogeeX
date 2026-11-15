/*
 * gravity-hero.js — the home page's black-hole sky. Needs bbh-physics.js and bbh-sim.js.
 *
 * Motion: pairwise 2.5PN with environmental hardening, then a 2PN EOB Hamiltonian + leading circular
 * radiation torque for the last orbits down to 3M. After that the shadow connection is illustrative,
 * and the wave rings down using NR-fit QNMs; no common horizon is solved. This file adds screen effects:
 * gentle wandering of isolated holes,
 * soft screen edges, dragging, respawning, slow motion near merger, and rendering.
 *
 * Rendering: one WebGL2 draw call per frame —
 *   gravitational waves: each source's Q̈ history read at the retarded time t − r/c → transverse
 *   (TT) in-plane displacement, applied before everything else so stars and shadows move together;
 *   optics: one angular field S = Σ(b_c,i/θ_i)⁴ on the sky sphere gives both the capture boundary
 *   (S^¼ = 1) and the strong-field bending; an isolated hole is exact Schwarzschild, a pair is an
 *   explicit optical approximation that blends into the total-mass monopole as it fuses.
 */
class GravityHero {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.host = opts.host || canvas.parentElement;
    this.onReady = opts.onReady || (() => {});
    this.onBackground = opts.onBackground || (() => {});
    this.onStage = opts.onStage || (() => {});
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.MAX_BH = 3;
    this.RESPAWN = 4.0;          // s after a black hole disappears
    this.ARRIVAL_SECONDS = 2;    // wall-time boundary transition, not growing physical mass
    this.GW_GAIN = 12;           // [VISUAL METAPHOR] exaggeration of the TT displacement
    this.MAX_COMP = 4;
    this.MAX_SRC = 6;
    this.MAX_CLICK = 2;
    this.MAX_PIXELS = 3000000;  // fixed pixel budget; chosen on sizing, never adapted frame by frame
    this.OMEGA_REF = 4;          // slow motion starts when an orbit turns faster than ~0.6 rev/s
    this.EXIT_MERGERS = 4;       // completed ancestral mergers; background lifecycle, not recoil

    this.clicks = [];
    this.spawnAt = [];
    this.drag = null;
    this.pointer = { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
    this.slow = 1;

    this.running = false;
    this.visible = true;
    this.active = true;
    this.timings = {stepMs:0,drawMs:0,rawMs:0};
    this.t0 = performance.now();

    this.gl = canvas.getContext("webgl2", {
      antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance",
    });
    if (!this.gl || typeof BBHSim === "undefined") { this.failed = true; return; }

    this._resize();
    this.sim = new BBHSim({ c: this.C, slots: this.MAX_SRC, hist:4096, eob: true });
    this.seenEvents = 0;
    this._initGL();
    this._seed();
    this._bind();
    this._loadSky();
  }

  /* ============================================================ GL */
  _shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  _program(fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this._shader(gl.VERTEX_SHADER, GravityHero.VS));
    gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  _initGL() {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    this.main = this._program(GravityHero.FS_MAIN);
    this.aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    this.bgTex = null;
    this.bgAspect = 6;
    this.HIST = this.sim.HIST;
    this.waveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.waveData = new Float32Array(this.HIST * this.MAX_SRC * 2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, this.HIST, this.MAX_SRC, 0, gl.RG, gl.FLOAT, this.waveData);
    // exact Schwarzschild deflection α(b), tabulated in w = −ln(1 − b_c/b)
    const lut = BBH.deflectionTable(512, 14);
    this.lut = lut;
    this.lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, lut.N, 1, 0, gl.RED, gl.FLOAT, lut.table);
    this.buf = {
      bh: new Float32Array(4 * this.MAX_COMP), glow: new Float32Array(this.MAX_COMP),
      group: new Float32Array(4 * this.MAX_COMP), companion: new Float32Array(4 * this.MAX_COMP), opacity:new Float32Array(this.MAX_COMP),
      src: new Float32Array(4 * this.MAX_SRC), srcB: new Float32Array(4 * this.MAX_SRC),
      clk: new Float32Array(4 * this.MAX_CLICK),
    };
  }
  _newSkyTexture() {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }
  _finishSky(tex) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    if (this.bgTex) gl.deleteTexture(this.bgTex);
    this.bgTex = tex;
  }
  /** Sky = galactic CAR panorama: l = 0 at the centre (l grows to the left), b from −30° to +30°. */
  setBackground(source, kind) {
    const gl = this.gl, max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    let src = source;
    if (source.width > max) {
      const c = document.createElement("canvas");
      c.width = max; c.height = Math.round((source.height * max) / source.width);
      c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
      src = c;
    }
    const tex = this._newSkyTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this._finishSky(tex);
    this.bgAspect = src.width / src.height;
    this.onBackground(kind);
    this._kick();
  }
  async _loadSky() {
    for (const [file, kind] of [["sky_spherex_stars.webp", "spherex"], ["dr1_galactic_plane.webp", "dr1"], ["sky_placeholder.webp", "placeholder"]]) {
      try {
        const res = await fetch(file);
        if (!res.ok) continue;
        this.setBackground(await createImageBitmap(await res.blob()), kind);
        return;
      } catch (_) { /* next */ }
    }
    this._generateGalaxy();
    this.onBackground("procedural");
    this._kick();
  }
  _generateGalaxy() {
    const gl = this.gl, max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const W = Math.min(max, 2048), H = Math.round(W / 6);
    const prog = this._program(GravityHero.FS_GALAXY);
    const tex = this._newSkyTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog.p);
    gl.uniform2f(prog.u.uSize, W, H);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteProgram(prog.p);
    this._finishSky(tex);
    this.bgAspect = 6;
  }

  /* ============================================================ sizing / units */
  _resize() {
    const r = this.host.getBoundingClientRect();
    const prevW=this.w,prevH=this.h;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    if(this.sim && Number.isFinite(prevW+prevH)) {
      const dx=(this.w-prevW)/2,dy=(this.h-prevH)/2;
      this.sim.translate(dx,dy);
      for(const click of this.clicks){click.x+=dx;click.y+=dy;}
      this.pointer.x+=dx;this.pointer.y+=dy;
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Shadow radius R1·m px. It is drawn at 3√3 Gm/c², which fixes Gm/c² = R1·m / 3√3 px.
    // Unit calibration is chosen once. A window resize must not change c,
    // the masses, orbital frequencies, or the age of a propagating wave.
    if (this.R1 === undefined) this.R1 = 11 * Math.min(1.25, Math.max(0.62, Math.min(this.w, this.h) / 850));
    this.SQ27 = 3 * Math.sqrt(3);
    // Speed of light on screen. With it, orbits at the capture radius take a few seconds and the
    // final orbits a fraction of one (then slow motion takes over).
    if (this.C === undefined) this.C = 450 * (this.R1 / 11);
    // sky angle per CSS px (the panorama shows ~140° across a wide screen)
    this.degPerPx = 140 / Math.max(this.w, this.h * 1.6);   // ~1 source pixel per CSS px for the 4160-px SPHEREx map
    this.kRad = (this.degPerPx * Math.PI) / 180;
    // Allocate the drawing buffer once the resize gesture settles; during
    // the gesture CSS scales the existing buffer. Repeated reallocations
    // clear the WebGL canvas and stall the GPU.
    if (!this.sim) this._applyQuality();
    else {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this._applyQuality();
        if (this.bgTex) this._draw(this.now());
      }, 160);
    }
  }
  _skyCenter() { return this.w * (0.5 + 0.14 * BBH.smooth(720, 1080, this.w)); }
  _applyQuality() {
    const s = Math.min(this.dpr,Math.sqrt(this.MAX_PIXELS/(this.w*this.h)));
    const bw = Math.max(1, Math.round(this.w * s)), bh = Math.max(1, Math.round(this.h * s));
    if (this.canvas.width !== bw || this.canvas.height !== bh) { this.canvas.width = bw; this.canvas.height = bh; }
    this.scale = bw / this.w;
  }
  _Mg(m) { return (this.R1 * m) / this.SQ27; }      // mass units → gravitational radius (px)
  _mass(b) { return (b.M * this.SQ27) / this.R1; }  // back to mass units

  /* ============================================================ bodies */
  _rand(a, b) { return a + Math.random() * (b - a); }
  _gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }
  _randMass() { return this._rand(0.65, 1.6); }
  _seed() {
    const placed = [];
    for (let tries = 0; placed.length < this.MAX_BH && tries < 400; tries++) {
      const m = this._randMass();
      const x = this._rand(0.1, 0.9) * this.w, y = this._rand(0.15, 0.85) * this.h;
      if (!placed.every((p) => Math.hypot(p.x - x, p.y - y) > 0.3 * Math.min(this.w, this.h) + 60)) continue;
      const a = Math.random() * Math.PI * 2;
      placed.push(this.sim.add(x, y, (Math.cos(a) * 22) / Math.sqrt(m), (Math.sin(a) * 22) / Math.sqrt(m), this._Mg(m)));
    }
    for (const b of this.sim.bodies) { b.ou = [0, 0]; }
    this.lastT = this.now();
  }
  _spawn() {
    const m = this._randMass(), pad = this.R1 * m * 4 + 30;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -pad; y = this._rand(0.2, 0.8) * this.h; }
    else if (side === 1) { x = this.w + pad; y = this._rand(0.2, 0.8) * this.h; }
    else if (side === 2) { x = this._rand(0.15, 0.85) * this.w; y = -pad; }
    else { x = this._rand(0.15, 0.85) * this.w; y = this.h + pad; }
    const tx = this._rand(0.3, 0.7) * this.w, ty = this._rand(0.3, 0.7) * this.h;
    const sp = this._rand(45, 65) / Math.sqrt(m);
    // Finish introducing the distant lens before its shadow enters the view.
    // An offscreen hole still bends every visible ray: switching it on in one
    // frame used to shift the whole panorama, even without a canvas reset.
    const duration=this.ARRIVAL_SECONDS??2;
    const entryPad=Math.max(pad,sp*duration+this.R1*m*2+24);
    if(side===0)x=-entryPad;else if(side===1)x=this.w+entryPad;
    else if(side===2)y=-entryPad;else y=this.h+entryPad;
    const d = Math.hypot(tx - x, ty - y);
    const b = this.sim.add(x, y, ((tx - x) / d) * sp, ((ty - y) / d) * sp, this._Mg(m));
    b.ou = [0, 0];
    b.entering = true;     // no screen-edge force until it is inside (it coasts in under gravity alone)
    b.arrival = {age:0,duration,opacity:0};
    return b;
  }
  _advanceArrivals(dt) {
    for(const b of this.sim.bodies)if(b.arrival) {
      const a=b.arrival; a.age+=dt;
      const u=a.age>=a.duration-1e-9?1:Math.min(1,a.age/a.duration);
      // Quintic easing has zero velocity and acceleration at both endpoints.
      a.opacity=Math.max(a.opacity,Math.min(1,u*u*u*(10+u*(-15+6*u))));
      if(u>=1)delete b.arrival;
    }
  }

  /* ============================================================ step */
  now() { return (performance.now() - this.t0) / 1000; }
  /** Einstein-ring radius on screen (px): θ_E = √(4M/D) with M/D = θ_shadow/(3√3). */
  _thetaE(b) { const rho = b.morph ? b.morph.rhoF : b.rho; return Math.sqrt((4 * rho) / (this.SQ27 * this.kRad)); }
  /** Background lifecycle, in wall time, separate from physical recoil.
   * After four completed mergers, translate the remnant's entire optical
   * image toward the closest edge and fade only at the end of the exit.
   */
  _retireMerged(dt,t) {
    const W=this.w,H=this.h;
    for(const b of this.sim.bodies.slice()) {
      const latitude=Math.max(-H*.5*this.kRad,Math.min(H*.5*this.kRad,(H*.5-b.y)*this.kRad));
      const projection=1/Math.max(.35,Math.abs(Math.cos(latitude)));
      const rho=this.SQ27*b.M*projection, radius=2*this._thetaE(b)*projection;
      const ready=(b.mergerCount||0)>=this.EXIT_MERGERS;
      if(!b.retiring&&ready&&!b.eob&&!b.morph&&!b.kin&&!b.entering) {
        const edges=[{d:b.x,nx:-1,ny:0},{d:W-b.x,nx:1,ny:0},{d:b.y,nx:0,ny:-1},{d:H-b.y,nx:0,ny:1}];
        edges.sort((a,b)=>a.d-b.d);const edge=edges[0];
        b.retiring={age:0,nx:edge.nx,ny:edge.ny,distance:Math.max(0,edge.d)+radius+rho+80,dx:0,dy:0,opacity:1};
      }
      const e=b.retiring;if(!e)continue;
      e.age+=dt;const u=Math.min(1,e.age/6),ease=Math.max(e.progress||0,Math.min(1,u*u*u*(10+u*(-15+6*u))));
      e.progress=ease;
      e.dx=e.nx*e.distance*ease;e.dy=e.ny*e.distance*ease;
      e.opacity=1-BBH.smooth(.7,1,u);
      b.coupling=1-BBH.smooth(0,1,e.age);
      if(u>=1) {
        for(const slot of this.sim.slots)if(slot.ring?.body===b||slot.eobBody===b) {
          slot.x+=e.dx;slot.y+=e.dy;slot.kind='drain';slot.ring=null;slot.eobBody=null;slot.drain=0;slot.peak=0;
          if(slot.blockPeak)slot.blockPeak.fill(0);slot.writingPeak=0;slot.currentPeak=0;
        }
        this.sim.remove(b);this.spawnAt.push(t+this.RESPAWN);
      }
    }
  }
  /**
   * Screen-level forcing, held for the frame (the orbits themselves come only from BBHSim):
   *  · [ADDED MODEL] dynamical friction from the galaxy's stars, a = −γ v_cm with γ ∝ mass (Chandrasekhar:
   *    heavier holes are braked harder), on an isolated hole or on a close pair's barycentre
   *  · [ILLUSTRATIVE] a slow random drift for a hole that feels no one (speed ∝ 1/√m). It fades out as
   *    soon as another hole's gravity becomes noticeable, so it never pushes approaching holes apart.
   *  · [ILLUSTRATIVE] soft screen edges: they act only on a barycentre that is moving out of the screen,
   *    and never on a hole still entering from outside
   *  · a retiring hole only brakes; its exit is a translation of its image (_retireMerged)
   */
  _external(dt) {
    const W=this.w,H=this.h,B=this.sim.bodies,C=this.C;
    for(const b of B){b.ou=b.ou||[0,0];b.ext[0]=b.ext[1]=0;}
    const done=this._done||(this._done=new Set());done.clear();
    for(const b of B) {
      if(done.has(b)||b.kin)continue;
      if(b.retiring){b.ext[0]=-2*b.vx;b.ext[1]=-2*b.vy;done.add(b);continue;}
      const group=[b];
      for(const o of B)if(o!==b&&!o.kin&&!o.retiring&&!done.has(o)&&Math.hypot(o.x-b.x,o.y-b.y)<30*(o.M+b.M))group.push(o);
      let M=0,x=0,y=0,vx=0,vy=0;
      for(const q of group){done.add(q);M+=q.M;x+=q.M*q.x;y+=q.M*q.y;vx+=q.M*q.vx;vy+=q.M*q.vy;}
      x/=M;y/=M;vx/=M;vy/=M;
      const mass=M*this.SQ27/this.R1,gamma=.1*mass+3*Math.max(0,Math.hypot(vx,vy)/C-.25);
      let ax=-gamma*vx,ay=-gamma*vy;
      if(group.length===1&&!b.eob&&!this.reduce) {
        let pull=0;
        for(const o of B)if(o!==b)pull+=C*C*o.M*(o.coupling??1)/((o.x-b.x)**2+(o.y-b.y)**2+1);
        const lonely=1-BBH.smooth(2,8,pull),noise=20/Math.sqrt(mass)*Math.sqrt(dt);
        b.ou[0]+=-.6*b.ou[0]*dt+noise*this._gauss();b.ou[1]+=-.6*b.ou[1]*dt+noise*this._gauss();
        ax+=lonely*b.ou[0];ay+=lonely*b.ou[1];
      }
      if(!group.some(q=>q.entering)) {
        const pad=.05*Math.min(W,H)+Math.max(...group.map(q=>this.SQ27*q.M));
        const wall=(p,lo,hi,v)=>p<lo?1.2*(lo-p)+(v<0?-1.5*v:0):p>hi?-1.2*(p-hi)+(v>0?-1.5*v:0):0;
        ax+=wall(x,pad,W-pad,vx);ay+=wall(y,pad,H-pad,vy);
      }
      for(const q of group){q.ext[0]=ax;q.ext[1]=ay;if(q.entering&&q.x>q.rho&&q.x<W-q.rho&&q.y>q.rho&&q.y<H-q.rho)q.entering=false;}
    }
  }
  _step(t, dt) {
    const sim = this.sim;
    // Slow motion: when the fastest orbit (or ringdown) turns faster than OMEGA_REF, physics time runs slower.
    const w = sim.maxOmega();
    this.orbitalOmega=w;
    const target = Math.max(0.15, Math.min(1, Math.pow(this.OMEGA_REF / Math.max(w, 1e-6), 0.7)));
    // ease towards it: quickly when slowing down (the orbit is speeding up), gently when releasing
    this.slow += (target - this.slow) * (1-Math.exp(-dt*(target<this.slow?2:1)));
    const dtp = this.reduce && !this.drag ? 0 : dt * this.slow;

    if (this.drag) {
      const b = this.drag.bh;
      if (!sim.bodies.includes(b)) { this.drag = null; this.host.classList.remove("grabbing"); }
      else {
        // the held hole follows the pointer; its velocity is the pointer's (capped below c)
        const k = Math.min(1, dt * 22);
        const nx = b.x + (this.pointer.x - b.x) * k, ny = b.y + (this.pointer.y - b.y) * k;
        let vx = (nx - b.x) / Math.max(dtp, 1e-4), vy = (ny - b.y) / Math.max(dtp, 1e-4);
        const sp = Math.hypot(vx, vy), cap = 0.35 * this.C;
        if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
        b.vx += (vx - b.vx) * 0.5; b.vy += (vy - b.vy) * 0.5;
        b.x = nx; b.y = ny;
      }
    }
    this._advanceArrivals(dt);
    this._retireMerged(dt,t);
    this._external(dtp);
    sim.step(dtp);
    // a remnant counts as settled 2 s after its ringdown (no exit or other change before that)
    for (const b of sim.bodies) if (b.settledAt !== undefined && b.bornAt === undefined) b.bornAt = t;
    for (const b of sim.bodies) if (b.morph) b.bornAt = undefined;

    // mergers → one hole fewer → another drifts in RESPAWN seconds later
    while (this.seenEvents < sim.events.length) { this.seenEvents++; this.spawnAt.push(t + this.RESPAWN); }
    for (let i = this.spawnAt.length - 1; i >= 0; i--) {
      if (t >= this.spawnAt[i] && sim.bodies.reduce((n,b)=>n+(b.eob?2:1),0) < this.MAX_BH) { this.spawnAt.splice(i, 1); this._spawn(); }
    }
    for (const b of sim.bodies.slice()) {
      if (b.kin || b.morph || b.eob || b.retiring) continue;
      const pad = this.R1 * this._mass(b) * 6 + 240;
      if (b.x < -pad || b.x > this.w + pad || b.y < -pad || b.y > this.h + pad) {
        sim.remove(b);
        this.spawnAt.push(t + this.RESPAWN);
      }
    }
    this.clicks = this.clicks.filter((k) => t - k.t0 < 1.0 + Math.hypot(this.w, this.h) / 600);
    this.onStage(this._stageInfo());
  }

  /** What the waveform strip should show: the loudest live source. */
  _stageInfo() {
    const sim = this.sim;
    let best = null;
    for (const s of sim.slots) {
      if (!s.key) continue;
      if((s.ring?.body||s.eobBody)?.retiring||s.pair?.some(b=>b.retiring))continue;
      let info = null;
      if (s.kind === "eob" && s.eobBody) {
        info = {stage:"plunge",rM:s.eobBody.eob.orbit.state[0],model:"EOB"};
      } else if (s.kind === "pair" && s.pair) {
        const [a, b] = s.pair, M = a.M + b.M, r = Math.hypot(a.x - b.x, a.y - b.y) / M;
        if (r > 20) continue;
        info = { stage: "inspiral", rM: r, gas: r > BBH.ENV.innerHi };
      } else if (s.kind === "ring" && s.ring) {
        const m = s.ring.body.morph;
        info = { stage: m && m.t < 2.5 * m.tauS ? "merger" : "ringdown", ev: sim.events[sim.events.length - 1] };
      } else continue;
      if (!best || (s.currentPeak??s.peak) > (best.slot.currentPeak??best.slot.peak)) best = { slot: s, ...info };
    }
    return best;
  }

  /* ============================================================ draw */
  _draw(t) {
    const gl = this.gl, u = this.main.u, sim = this.sim, B = this.buf;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.main.p);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.uniform1i(u.uBg, 0);

    // GW histories → texture (24 KB per frame)
    const H = this.HIST;
    B.src.fill(0); B.srcB.fill(0);
    const tLast = sim.nextSample - sim.DT_S;
    const waveDirty=this.waveSim!==sim||this.waveSampleT!==tLast;
    const back0 = Math.max(0, (sim.t - tLast) / sim.DT_S);
    sim.slots.forEach((s, i) => {
      if (i >= this.MAX_SRC) return;
      if(waveDirty)this.waveData.set(s.buf, i * H * 2);
      if (!s.key || s.head < 0) return;
      // near-zone edge: the pair's value, kept through merger and ringdown (no jump at the hand-off)
      const near = Math.max(s.near || 20, 6);
      // largest displacement this source can make (at the edge of its near zone): skip if < 0.05 px
      if (0.25 * s.peak * this.GW_GAIN < 0.05) return;
      const exit=(s.ring?.body||s.eobBody)?.retiring;
      const sx=s.x+(exit?.dx||0),sy=s.y+(exit?.dy||0);
      const far=Math.hypot(Math.max(Math.abs(sx),Math.abs(this.w-sx)),Math.max(Math.abs(sy),Math.abs(this.h-sy)));
      if(s.lastSignalT!==undefined&&sim.t-s.lastSignalT>far/this.C+2*sim.DT_S)return;
      B.src.set([sx,sy,back0,exit?exit.opacity:1], i * 4);
      B.srcB.set([s.head % H, Math.min(s.head, H - 2), near, 0], i * 4);
    });
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
    if(waveDirty){gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, H, this.MAX_SRC, gl.RG, gl.FLOAT, this.waveData);this.waveSim=sim;this.waveSampleT=tLast;}
    gl.uniform1i(u.uWave, 1);
    gl.uniform4fv(u.uSrc, B.src);
    gl.uniform4fv(u.uSrcB, B.srcB);
    gl.uniform1f(u.uHist, H);
    gl.uniform1f(u.uSampPx, this.C * sim.DT_S);           // px a wave travels per sample
    gl.uniform1f(u.uGain, this.reduce ? 0 : this.GW_GAIN);

    // horizon components (bodies, or the two fusing horizons of a fresh remnant)
    B.bh.fill(0);B.group.fill(0);B.companion.fill(0);B.opacity.fill(0);
    const comps=sim.components();
    let index=0;
    for(let j=0;j<comps.length&&index<this.MAX_COMP;j++) {
      const q=comps[j],k=4*index;
      B.bh[k]=q.x;B.bh[k+1]=q.y;B.bh[k+2]=q.rho;B.bh[k+3]=q.M;B.opacity[index]=q.opacity??1;
      if(q.group) {
        B.group[k]=q.group.x;B.group[k+1]=q.group.y;B.group[k+2]=q.group.M;B.group[k+3]=q.group.blend;
        const other=comps[j+1];
        if(other&&other.id===q.id&&other.group){B.companion[k]=other.x;B.companion[k+1]=other.y;B.companion[k+2]=other.rho;B.companion[k+3]=other.M;j++;}
      }
      index++;
    }
    gl.uniform4fv(u.uBH,B.bh);gl.uniform4fv(u.uGroup,B.group);gl.uniform4fv(u.uCompanion,B.companion);gl.uniform1fv(u.uOpacity,B.opacity);
    gl.uniform1f(u.uDiagnostic,this.diagnostic||0);

    B.clk.fill(0);
    this.clicks.slice(-this.MAX_CLICK).forEach((c, i) => B.clk.set([c.x, c.y, c.t0, c.chi], i * 4));
    gl.uniform4fv(u.uClick, B.clk);
    gl.uniform1f(u.uClickAmp, this.reduce ? 0 : 3.0 * (this.R1 / 15));

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1i(u.uLut, 2);
    gl.uniform2f(u.uLutInfo, this.lut.N, this.lut.wMax);
    gl.uniform1f(u.uK, this.kRad);
    gl.uniform1f(u.uAspect, this.bgAspect);
    gl.uniform2f(u.uView, this.w, this.h);
    gl.uniform2f(u.uBuffer, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uCenter, this._skyCenter());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _frame() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._frame());
    const t = this.now();
    const raw = t - this.lastT;
    this.lastT = t;
    // a long frame (tab switch, GC) must not make the holes jump: cap the step at 1/30 s
    const dt = Math.min(1 / 30, Math.max(0, raw));
    if(!this.bgTex)return;
    // fixed render resolution: never changes while running (a resolution switch reads as a jolt)

    this.timings.rawMs=raw*1000;
    const stepStart=performance.now();
    this._step(t, dt);
    this.timings.stepMs=performance.now()-stepStart;
    const active=!!this.drag||(this.orbitalOmega||0)>2||this.clicks.length>0||this.sim.bodies.some(b=>b.retiring||b.arrival);
    if(!this.reduce&&!active&&this.lastDraw!==undefined&&t-this.lastDraw<1/30-0.001)return;
    this.lastDraw=t;
    const drawStart=performance.now();
    try { this._draw(t); } catch (err) { console.warn("[hero] frame skipped", err); }
    this.timings.drawMs=performance.now()-drawStart;
    this.timings.drawCount=(this.timings.drawCount||0)+1;
    if (!this.readyFired) { this.readyFired = true; this.onReady(); }
    if (this.reduce && !this.drag) this.stop();
  }
  _kick() { if (this.active && this.visible && !document.hidden && !this.failed) this.start(); }
  start() {
    if (this.running || this.failed) return;
    this.running = true;
    this.lastT = this.now();
    this.raf = requestAnimationFrame(() => this._frame());
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  setActive(on) { this.active = on; on ? this._kick() : this.stop(); }

  /* ============================================================ input */
  _hit(x, y) {
    let best = null, bd = Infinity;
    for (const b of this.sim.bodies) {
      if (b.morph || b.retiring) continue;
      const targets=b.eob?this.sim._eobMembers(b):[b];
      for(const q of targets) {
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < Math.max(q.rho * 1.8, 24) && d < bd) {
          if(b.eob)q.eobParent=b;
          best=q;bd=d;
        }
      }
    }
    return best;
  }
  _local(e) {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  _bind() {
    const host = this.host;
    const isUI = (el) => el && el.closest && el.closest("a, button, input, label, select, textarea, [data-ui]");
    host.addEventListener("pointerdown", (e) => {
      if (!this.active || isUI(e.target) || (e.button !== undefined && e.button !== 0)) return;
      const p = this._local(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      let b = this._hit(p.x, p.y);
      if (b) {
        if(b.eobParent) {
          const id=b.id;
          this.sim._finishEOB(b.eobParent,true);
          b=this.sim.bodies.find(q=>q.id===id);
        }
        this.drag = { bh: b };
        b.kin = true; b.vx = 0; b.vy = 0;
        host.classList.add("grabbing");
        try { host.setPointerCapture(e.pointerId); } catch (_) {}
      } else {
        this.clicks.push({ x: p.x, y: p.y, t0: this.now(), chi: Math.random() * Math.PI });
        if (this.clicks.length > this.MAX_CLICK) this.clicks.shift();
      }
      this._kick();
      this.onInteract && this.onInteract();
    });
    host.addEventListener("pointermove", (e) => {
      const p = this._local(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      if (!this.drag) host.classList.toggle("grab", !!this._hit(p.x, p.y) && !isUI(e.target));
      else this._kick();
    }, { passive: true });
    const up = (e) => {
      if (!this.drag) return;
      const b = this.drag.bh;
      this.drag = null;
      // released: from here on only the equations of motion move it, starting from the hand's velocity
      this.sim.releasePlaced(b);
      host.classList.remove("grabbing");
      try { host.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; if (!t) return;
      const p = this._local(t);
      if (this._hit(p.x, p.y)) e.preventDefault();
    }, { passive: false });

    let rt = 0;
    const resize = () => {
      cancelAnimationFrame(rt);
      rt = requestAnimationFrame(() => { this._resize(); if (!this.running && this.bgTex) this._draw(this.now()); });
    };
    window.addEventListener("resize", resize);
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(host);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.stop() : this._kick()));
    new IntersectionObserver((ents) => {
      this.visible = ents[0].isIntersecting;
      this.visible ? this._kick() : this.stop();
    }, { threshold: 0.02 }).observe(host);
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.stop(); this.failed = true; });
  }
}

GravityHero.VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

GravityHero.FS_MAIN = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uBg;
uniform sampler2D uWave;   // per source: ring buffer of (A, B) = ((Q̈xx−Q̈yy)/2, Q̈xy), px
uniform vec2  uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uCenter;
uniform vec4  uBH[4];      // horizon components: x, y, shadow radius ρ (px), mass
uniform vec4 uCompanion[4];
uniform float uOpacity[4];
uniform float uDiagnostic;
uniform vec4  uGroup[4];   // unresolved pair: centre x,y, total mass, monopole blend (ILLUSTRATIVE)
uniform sampler2D uLut;    // α(w), w = −ln(1 − b_c/b)
uniform vec2  uLutInfo;    // N, w_max
uniform float uK;          // sky radians per CSS px
uniform float uAspect;     // panorama width / height
uniform vec4  uSrc[6];     // GW source: x, y, samples since the last one, active
uniform vec4  uSrcB[6];    // head column, oldest usable lag, near-zone px, –
uniform float uHist;
uniform float uSampPx;     // c · Δt_sample (px)
uniform float uGain;
uniform vec4  uClick[2];   // x, y, t0, χ   [VISUAL METAPHOR]
uniform float uClickAmp;
out vec4 outColor;

// screen px → unit vector on the sky (galactic longitude grows to the left, latitude up)
vec3 skyDir(vec2 q) {
  float lon = -(q.x - uCenter) * uK, lat = (0.5 * uView.y - q.y) * uK;
  return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
}
// exact Schwarzschild deflection from the table, linear in w
float deflect(float x) {
  float w = -log(1.0 - min(x, 0.99999));
  float f = clamp(w / uLutInfo.y, 0.0, 1.0) * (uLutInfo.x - 1.0);
  int i0 = int(floor(f));
  int i1 = min(i0 + 1, int(uLutInfo.x) - 1);
  return mix(texelFetch(uLut, ivec2(i0, 0), 0).r, texelFetch(uLut, ivec2(i1, 0), 0).r, f - float(i0));
}

// One angular impact field is shared by capture and strong-field bending.
// In the one-body limit weak * alpha(x)/(4x/b_c) = alpha(x) exactly.
void opticalPart(vec4 b,vec3 n,out float field,out vec3 weak) {
  field=0.0;weak=vec3(0.0);if(b.w<=0.0)return;
  vec3 nb=skyDir(b.xy);float cs=clamp(dot(n,nb),-1.0,1.0);
  float th=max(atan(length(cross(n,nb)),cs),1e-7);
  vec3 t=nb-n*cs;float tl=length(t);
  float q=max(b.z,0.0)*uK/th;field=q*q*q*q;
  if(tl>1e-8)weak=(4.0*b.w*uK/th)*t/tl;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y) * uView / uBuffer;

  // ---- gravitational waves: TT in-plane displacement ξ_ψ = (−A sin2ψ + B cos2ψ)/4 at t − r/c
  vec2 gw = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec4 s = uSrc[i];
    if (s.w <= 0.001) continue;
    vec2 d = p - s.xy;
    float r2 = dot(d, d) + 1e-4, r = sqrt(r2);
    float back = s.z + r / uSampPx;                 // how many samples ago this pixel's wave left
    if (back > uSrcB[i].y) continue;
    float pos = uSrcB[i].x - back;
    float f0 = floor(pos), w = pos - f0;
    int c0 = int(mod(f0, uHist)), c1 = int(mod(f0 + 1.0, uHist));
    vec2 AB = mix(texelFetch(uWave, ivec2(c0, i), 0).rg, texelFetch(uWave, ivec2(c1, i), 0).rg, w);
    float c2 = (d.x * d.x - d.y * d.y) / r2, s2 = 2.0 * d.x * d.y / r2;
    // the strain falls off as 1/r: a star field far from the source barely moves, near it it rings.
    // Displacement = strain × a fixed reference length (the near-zone edge), ×gain.
    float r0 = 2.5 * uSrcB[i].z;
    float xi = 0.25 * (-AB.x * s2 + AB.y * c2) * uGain * s.w * smoothstep(uSrcB[i].z, r0, r) * min(1.0, r0 / r);
    gw += xi * vec2(-d.y, d.x) / r;
  }
  for (int i = 0; i < 2; i++) {
    vec4 k = uClick[i];
    if (k.z <= 0.0) continue;
    vec2 d = p - k.xy;
    float r2 = dot(d, d) + 1e-4, r = sqrt(r2);
    float tt = uTime - k.z - r / 600.0;
    if (tt < 0.0 || tt > 0.9) continue;
    float env = exp(-pow((tt - 0.25) / 0.11, 2.0));
    float ph = 6.2831853 * 2.6 * tt + k.w;
    vec2 AB = env * vec2(cos(ph), sin(ph));
    float c2 = (d.x * d.x - d.y * d.y) / r2, s2 = 2.0 * d.x * d.y / r2;
    gw += (-AB.x * s2 + AB.y * c2) * uClickAmp * smoothstep(0.0, 40.0, r) * vec2(-d.y, d.x) / r;
  }

  if(uDiagnostic>1.5){outColor=vec4(vec2(.5)+gw/16.0,0.0,1.0);return;}
  // Same projected ray, angular distance and merged field for shadow AND lens.
  // The binary field is an optical approximation; the isolated limit uses
  // the exact Schwarzschild bending table. No independent screen-space disc.
  vec3 n=skyDir(p+gw),D=vec3(0.0);
  float shadow=1.0,rayEscape=1.0;
  for(int i=0;i<4;i++) {
    vec4 b=uBH[i];float opacity=uOpacity[i];
    if(b.w<=0.0||opacity<=0.0)continue;
    float field;vec3 weak;opticalPart(b,n,field,weak);
    if(uCompanion[i].w>0.0){float f;vec3 w;opticalPart(uCompanion[i],n,f,w);field+=f;weak+=w;}
    vec4 group=uGroup[i];
    if(group.z>0.0){
      float f;vec3 w;opticalPart(vec4(group.xy,5.196152*group.z,group.z),n,f,w);
      field=mix(field,f,group.w);weak=mix(weak,w,group.w);
    }
    float x=pow(max(field,1e-24),.25),inv=1.0/x;
    float fw=max(fwidth(inv),1e-3);
    shadow*=mix(1.0,smoothstep(1.0-fw,1.0+fw,inv),opacity);
    rayEscape*=mix(1.0,x<1.0?1.0:0.0,opacity);
    if(x<1.0&&x>1e-7)D+=opacity*weak*(deflect(x)/(0.76980036*x));
  }
  if(uDiagnostic>0.5){outColor=vec4(shadow,rayEscape,0.0,1.0);return;}
  float a = length(D);
  vec3 ns = a > 1e-7 ? cos(a) * n + sin(a) * (D / a) : n;
  vec2 uv = vec2(0.5 - atan(ns.y, ns.x) / 6.2831853, 0.5 + asin(clamp(ns.z, -1.0, 1.0)) * uAspect / 6.2831853);
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5); gy.x -= floor(gy.x + 0.5);   // no mip spike across the ±180° seam

  vec3 col = textureGrad(uBg, uv, gx, gy).rgb * shadow;
  outColor = vec4(col, 1.0);
}`;

GravityHero.FS_GALAXY = `#version 300 es
precision highp float;
uniform vec2 uSize;
out vec4 outColor;
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float l = (0.5 - uv.x) * 360.0, b = (uv.y - 0.5) * 60.0, al = abs(l), ab = abs(b);
  vec3 P = vec3(cos(radians(l)), sin(radians(l)), radians(b));
  float n2 = fbm(P * 26.0 + 7.7);
  float disk = exp(-ab / (2.1 + 0.014 * al)) * (0.32 + 0.68 * exp(-pow(l / 70.0, 2.0)));
  float bulge = exp(-pow(pow(l / 10.0, 2.0) + pow(b / 6.5, 2.0), 0.8)) * 1.6;
  vec3 col = vec3(0.01, 0.013, 0.026) + (disk * (0.7 + 0.6 * n2) + bulge) * vec3(0.95, 0.8, 0.6) * 0.55;
  col += step(0.997, h12(floor(gl_FragCoord.xy))) * vec3(0.8);
  outColor = vec4(pow(1.0 - exp(-col * 1.5), vec3(0.92)), 1.0);
}`;

if (typeof window !== "undefined") window.GravityHero = GravityHero;

if(typeof module!=="undefined"&&module.exports)module.exports=GravityHero;
