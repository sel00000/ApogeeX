/* How SPHEREx photographs the sky: seen from just behind the spacecraft, near Earth, looking the way
 * the telescope looks. The scene frame is GALACTIC (x → l=0, y → l=90°, z → north galactic pole), so
 * the real SPHEREx all-sky map, the target (RW Aurigae) and the scan direction (a great circle through
 * the ecliptic poles, as SPHEREx surveys) are in their true directions. Sizes and distances of Earth,
 * the spacecraft and the footprint's distance are illustrative; the footprint's angular size
 * (3 detectors, 3.5° × 11.3° in all, 17 filter strips each) is to scale on the sky.
 *
 * mountSkyScan(canvas) -> { draw(state), project(), ready, dispose }
 * state: { step, prev, k (0..1 ease between poses), flash (0..1), flashAll, upto, fade (0..1) }
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const D2R = Math.PI / 180;
const gal = (l, b) => new THREE.Vector3(Math.cos(b * D2R) * Math.cos(l * D2R), Math.cos(b * D2R) * Math.sin(l * D2R), Math.sin(b * D2R));
const TARGET = gal(174.2044, -6.0030);        // RW Aurigae (meta.json centre, galactic)
const ECL_POLE = gal(96.3840, 29.8114);       // north ecliptic pole in galactic coordinates
const DET = 3.5, GAP = 0.2, STRIPS = 17;     // degrees: one detector square, gap between detectors
const LONG = 3 * DET + 2 * GAP;               // ≈ 11.3° along the scan
const R = 40;                                  // sky sphere radius for the footprint (scene units)
const SKY_R = 60;

export function mountSkyScan(canvas, { skyUrl, craftUrl, starsUrl } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  let pr = Math.min(devicePixelRatio || 1, 1.4); renderer.setPixelRatio(pr);
  renderer.setClearColor(0x05070a);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, 0.01, 200);

  // scan frame: t = target, s = along the scan (toward the ecliptic pole), c = across
  const t = TARGET.clone();
  const s = ECL_POLE.clone().sub(t.clone().multiplyScalar(t.dot(ECL_POLE))).normalize();
  const c = new THREE.Vector3().crossVectors(t, s).normalize();
  const sun = new THREE.Vector3().crossVectors(t, ECL_POLE).normalize(); // on the ecliptic, 90° from the target

  // ---- the real sky (SPHEREx all-sky map, galactic plate carrée, l = 0 centre, l grows to the left)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { map: { value: null }, gain: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float gain; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float l = atan(d.y, d.x), b = asin(clamp(d.z,-1.,1.));
  vec3 col = texture2D(map, vec2(fract(0.5 - l / 6.28318530718), 0.5 + b / 3.14159265359)).rgb;
  gl_FragColor = vec4(col * gain, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 96, 48), skyMat);
  sky.renderOrder = -10; scene.add(sky);
  new THREE.TextureLoader().load(skyUrl, tex => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.generateMipmaps = false;
    tex.minFilter = tex.magFilter = THREE.LinearFilter; skyMat.uniforms.map.value = tex; skyMat.uniforms.gain.value = 0.34; invalidate();
  });

  // ---- bright stars (V ≤ 7, Hipparcos/Gaia via Stellarium data) as crisp points over the SPHEREx glow
  if (starsUrl) fetch(starsUrl).then(r => { if (!r.ok) throw Error(r.status); return r.arrayBuffer(); }).then(buf => {
    const f = new Float32Array(buf), n = f.length / 4, pos = new Float32Array(n * 3), mag = new Float32Array(n), bv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = gal(f[4 * i], f[4 * i + 1]).multiplyScalar(SKY_R * 0.98); pos.set([v.x, v.y, v.z], 3 * i); mag[i] = f[4 * i + 2]; bv[i] = Number.isFinite(f[4 * i + 3]) ? f[4 * i + 3] : 0.6; }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)).setAttribute('mag', new THREE.BufferAttribute(mag, 1)).setAttribute('bv', new THREE.BufferAttribute(bv, 1));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { pr: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float mag; attribute float bv; uniform float pr; varying float vA; varying vec3 vC;
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float L = pow(10.0, -0.4 * (mag - 7.0));            // brightness relative to a V = 7 star
  gl_PointSize = clamp(1.3 + 0.9 * log(L), 1.3, 7.0) * pr;
  vA = clamp(0.32 + 0.12 * log(L), 0.32, 1.0);
  float t = clamp((bv + 0.2) / 1.8, 0.0, 1.0);          // B−V → a faint warm/cool tint
  vC = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.88, 0.74), t); }`,
      fragmentShader: `varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * a * vA, 1.0); }`,
    }));
    pts.renderOrder = -9; pts.frustumCulled = false; scene.add(pts); invalidate();
  }).catch(() => {});

  // ---- light from the Sun (Earth is behind the camera, out of view)
  scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x0b0d10, 0.35));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.6); key.position.copy(sun).multiplyScalar(10); scene.add(key);

  // ---- SPHEREx: low Earth orbit, toward the target side of Earth (size illustrative)
  const P = t.clone().multiplyScalar(0.5).add(c.clone().multiplyScalar(0.86)).normalize().multiplyScalar(1.24);
  const craft = new THREE.Group(); craft.position.copy(P); scene.add(craft);
  const boresight = t.clone(); // R ≫ |P|: looking at the footprint centre ≈ looking along t
  {
    // +Y (telescope) along the boresight, −Z (solar cells) rolled toward the Sun
    const Z = sun.clone().sub(boresight.clone().multiplyScalar(sun.dot(boresight))).normalize().negate();
    const X = new THREE.Vector3().crossVectors(boresight, Z);
    craft.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, boresight, Z));
  }
  let ready = Promise.resolve();
  if (craftUrl) ready = new GLTFLoader().loadAsync(craftUrl).then(g => {
    const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const k = 0.11 / Math.max(size.x, size.y, size.z);
    g.scene.scale.setScalar(k); g.scene.position.copy(mid).multiplyScalar(-k);
    craft.add(g.scene);
    return renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : null;
  }).then(() => invalidate()).catch(() => {});

  // ---- camera: just behind SPHEREx and a little toward Earth, looking the way the telescope looks
  const C = P.clone().add(t.clone().multiplyScalar(-0.9)).add(s.clone().multiplyScalar(0.24)).add(c.clone().multiplyScalar(-0.02));
  camera.position.copy(C); camera.up.copy(c);
  // the view follows the telescope's line of sight as it sweeps; the visitor can also drag to look around
  const view = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0, follow: 0 };
  function aimCamera() {
    const base = poseAt(view.follow).centre.multiplyScalar(R).add(c.clone().multiplyScalar(R * 0.02)).add(s.clone().multiplyScalar(-R * 0.07));
    const dir = base.clone().sub(C).normalize();
    dir.applyAxisAngle(c, view.yaw).applyAxisAngle(new THREE.Vector3().crossVectors(dir, c).normalize(), view.pitch);
    camera.lookAt(C.clone().add(dir));
  }

  // ---- footprint: 3 detectors × 17 strips; wavelength order shown as ivory → amber (not a real colour)
  const tex = (() => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 96; const g = cv.getContext('2d');
    const dw = cv.width * DET / LONG, gp = cv.width * GAP / LONG;
    for (let d = 0; d < 3; d++) {
      const x0 = d * (dw + gp);
      for (let j = 0; j < STRIPS; j++) {
        const u = j / (STRIPS - 1);
        g.fillStyle = `rgba(${Math.round(244 - 20 * u)},${Math.round(236 - 72 * u)},${Math.round(222 - 134 * u)},${0.16 + 0.34 * u})`;
        g.fillRect(x0 + j * dw / STRIPS, 0, dw / STRIPS - 1.2, cv.height);
      }
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.strokeRect(x0 + 1, 1, dw - 2, cv.height - 2);
    }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
  })();
  const W = 2 * R * Math.tan(LONG / 2 * D2R), H = 2 * R * Math.tan(DET / 2 * D2R);
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  foot.renderOrder = 2; scene.add(foot);
  const flashAllMat = new THREE.MeshBasicMaterial({ color: 0xf2cf6b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const flashAll = new THREE.Mesh(new THREE.PlaneGeometry(W, H), flashAllMat); flashAll.renderOrder = 3; scene.add(flashAll);
  const stripW = W * (DET / LONG) / STRIPS;
  const flashMat = flashAllMat.clone();
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(stripW, H), flashMat); flash.renderOrder = 3; scene.add(flash);

  // pose of exposure n: the target sits in strip n % 17 of detector n / 17
  const xDeg = n => { const d = Math.floor(n / STRIPS), j = n % STRIPS; return d * (DET + GAP) + (j + 0.5) * DET / STRIPS - LONG / 2; };
  const poseAt = x => { // footprint centre rotated by -x degrees along the scan
    const a = -x * D2R, centre = t.clone().multiplyScalar(Math.cos(a)).add(s.clone().multiplyScalar(Math.sin(a)));
    const along = s.clone().multiplyScalar(Math.cos(a)).sub(t.clone().multiplyScalar(Math.sin(a)));
    return { centre, along };
  };
  const place = (mesh, x, dx = 0) => {
    const { centre, along } = poseAt(x);
    mesh.position.copy(centre).multiplyScalar(R).add(along.clone().multiplyScalar(dx));
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, c, centre));
  };
  const corners = x => { const { centre, along } = poseAt(x), m = centre.clone().multiplyScalar(R);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => m.clone().add(along.clone().multiplyScalar(a * W / 2)).add(c.clone().multiplyScalar(b * H / 2))); };

  // earlier footprints: thin outlines that stay on the sky
  const ghosts = Array.from({ length: 51 }, (_, n) => {
    const g = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners(xDeg(n))), new THREE.LineBasicMaterial({ color: 0xe9c48f, transparent: true, opacity: 0 }));
    g.visible = false; scene.add(g); return g;
  });
  // the scan path: a great circle through the target, like SPHEREx's survey rings
  {
    const pts = []; for (let a = -70; a <= 70; a += 1) pts.push(poseAt(a).centre.multiplyScalar(R * 1.001));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe9c48f, transparent: true, opacity: 0.22 })));
  }
  // target: 8′ field drawn as a small gold square (to scale: one strip is ≈ 12′ wide)
  const half = R * Math.tan(0.07 * D2R) * 1.6;
  const tPos = t.clone().multiplyScalar(R * 0.999);
  const tCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => tPos.clone().add(s.clone().multiplyScalar(a * half)).add(c.clone().multiplyScalar(b * half)));
  const target = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(tCorners), new THREE.LineBasicMaterial({ color: 0xf2cf6b }));
  target.renderOrder = 5; scene.add(target);

  // field of view: four edges from the telescope to the footprint corners + faint side faces
  const beamLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3)),
    new THREE.LineBasicMaterial({ color: 0xf4ecde, transparent: true, opacity: 0.32 }));
  const beamFaces = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3)),
    new THREE.MeshBasicMaterial({ color: 0xf4ecde, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(beamLines, beamFaces);
  const aperture = P.clone().add(boresight.clone().multiplyScalar(0.08));

  let dirty = true;
  function invalidate() { dirty = true; }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let last = '';
  let govT = 0, govAcc = 0, govN = 0;
  function govern() { // adaptive: drop the pixel ratio for this session if frames keep running slow
    const now = performance.now(), dt = govT ? (now - govT) / 1000 : 0; govT = now;
    if (!(dt > 0 && dt < 0.25)) return; govAcc += dt; govN++;
    if (govAcc < 1.5) return; const avg = govAcc / govN; govAcc = govN = 0;
    if (avg > 1 / 48 && pr > 1) { pr = Math.max(1, pr - 0.2); renderer.setPixelRatio(pr); resize(); }
  }
  function draw(st) {
    govern();
    const x0 = xDeg(st.prev) + (xDeg(st.step) - xDeg(st.prev)) * st.k;
    view.follow += (x0 * 0.55 - view.follow) * 0.06;               // gently track the sweep
    view.yaw += (view.yawT - view.yaw) * 0.12; view.pitch += (view.pitchT - view.pitch) * 0.12;
    const moving = Math.abs(view.follow - x0 * 0.55) > 0.01 || Math.abs(view.yawT - view.yaw) > 1e-4 || Math.abs(view.pitchT - view.pitch) > 1e-4;
    const key = JSON.stringify(st);
    if (key === last && !dirty && !moving) return; last = key; dirty = false;
    aimCamera();
    const x = xDeg(st.prev) + (xDeg(st.step) - xDeg(st.prev)) * st.k;
    place(foot, x); place(flashAll, x);
    const d = Math.floor(st.step / STRIPS), j = st.step % STRIPS;
    const off = (d * (DET + GAP) + (j + 0.5) * DET / STRIPS - LONG / 2) / LONG * W;
    place(flash, x, off);
    foot.material.opacity = st.fade; flashAllMat.opacity = st.flashAll ? 0.5 * st.flash : 0; flashMat.opacity = st.flashAll ? 0 : 0.75 * st.flash;
    ghosts.forEach((g, n) => { g.visible = n < st.upto && st.fade > 0.01; g.material.opacity = Math.max(0.05, 0.42 * (1 - (st.upto - n) / 18)) * st.fade; });
    const cs = corners(x), bl = beamLines.geometry.attributes.position, bf = beamFaces.geometry.attributes.position;
    cs.forEach((p, i) => { bl.setXYZ(2 * i, aperture.x, aperture.y, aperture.z); bl.setXYZ(2 * i + 1, p.x, p.y, p.z); });
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], i) => { bf.setXYZ(3 * i, aperture.x, aperture.y, aperture.z); bf.setXYZ(3 * i + 1, cs[a].x, cs[a].y, cs[a].z); bf.setXYZ(3 * i + 2, cs[b].x, cs[b].y, cs[b].z); });
    bl.needsUpdate = bf.needsUpdate = true;
    beamLines.material.opacity = 0.32 * st.fade; beamFaces.material.opacity = 0.045 * st.fade;
    renderer.render(scene, camera);
  }
  /** target square in canvas CSS pixels, for the 2D overlay */
  function project() {
    const r = canvas.getBoundingClientRect();
    return tCorners.map(p => { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height }; });
  }
  /** drag to look around (radians, clamped); release springs back to the telescope's view */
  function look(dyaw, dpitch) { view.yawT = Math.max(-0.5, Math.min(0.5, view.yawT + dyaw)); view.pitchT = Math.max(-0.3, Math.min(0.3, view.pitchT + dpitch)); dirty = true; }
  function release() { view.yawT = 0; view.pitchT = 0; dirty = true; }
  /** which exposure's strip is under a canvas point (for clicking the footprint), or -1 */
  return { draw, project, ready, invalidate, look, release, dispose() { ro.disconnect(); renderer.dispose(); } };
}
