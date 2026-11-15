// SPHEREx hero model for the home "mission" section.
// Built from the supplied spherex-3d kit (viewer.js, Three.js r180, spherex-hero.glb) and bundled
// by scripts/build-home-model.mjs into assets/model/mission-model.js. Rendering is on demand:
// a frame is drawn only while the scroll pose, the shield animation or the orbit damping is moving.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TARGET = new THREE.Vector3(0, 1.35, 0);
const POSES = { front: [4.1, 3.4, 6.6], back: [-4.1, 3.0, -6.6], top: [0.4, 8.4, 1.8] };
const ease = t => 1 - Math.pow(1 - t, 3);

export function mountMissionModel(host, { url, onReady = () => {}, onError = () => {}, onUserOrbit = () => {}, quality = 'hero',
  ariaLabel = 'SPHEREx 3D model. Drag to turn it. To zoom, use two fingers, or ⌘ or Ctrl together with scroll. The arrow keys turn it too.',
  lostMessage = 'The graphics connection was lost. Reload the page to see it again.' } = {}) {
  // Texts come from the portal (app.js) so the bundle stays free of the language module.
  const labels = { ariaLabel, lostMessage };
  // Pixel-ratio caps follow the 3D kit: Hero 1.75, Lite 1.25.
  const DPR_CAP = quality === 'lite' ? 1.25 : 1.75;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', labels.ariaLabel);
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.04, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.03);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  scene.environmentRotation.y = 0.6;
  const key = new THREE.DirectionalLight(0xe8efff, 1.6); key.position.set(2, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb5caff, 1.0); rim.position.set(-4, 3, -2); scene.add(rim);
  const warm = new THREE.DirectionalLight(0xffdcb0, 0.7); warm.position.set(4, 1, -3); scene.add(warm);
  scene.add(new THREE.HemisphereLight(0xe4eeff, 0x18212d, 0.3));

  const pivot = new THREE.Group(); scene.add(pivot);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 2.4; controls.maxDistance = 12;
  controls.autoRotateSpeed = 0.6;
  controls.enableZoom = false; controls.enablePan = false;
  controls.target.copy(TARGET);
  controls.listenToKeyEvents(canvas);
  camera.position.set(...POSES.front);
  controls.update();

  const state = {
    alive: true, hostActive: true, visible: false, frame: 0, last: 0, free: false, coarse: matchMedia('(pointer: coarse)').matches,
    yaw: 0, yawTarget: 0, lift: 0, liftTarget: 0,
    open: 0, openTarget: 0, userCutaway: null, layers: [], settle: 0,
  };

  // Page scrolling is never captured: zoom needs a pinch (ctrlKey wheel), ⌘/Ctrl + wheel, or free view.
  const wheelGate = e => { controls.enableZoom = state.free || e.ctrlKey || e.metaKey; };
  host.addEventListener('wheel', wheelGate, { capture: true, passive: true });
  const applyTouchPolicy = () => {
    const touchOrbit = state.free || !state.coarse;
    controls.enabled = touchOrbit;
    canvas.style.touchAction = touchOrbit ? 'none' : 'pan-y';
    controls.enablePan = state.free;
  };
  applyTouchPolicy();
  controls.addEventListener('change', () => invalidate());
  controls.addEventListener('start', () => { state.dragging = true; controls.autoRotate = false; onUserOrbit(); invalidate(); });
  controls.addEventListener('end', () => { state.dragging = false; invalidate(); });

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    // keep the whole observatory in frame on narrow stages
    camera.fov = camera.aspect < 0.9 ? 40 : 32;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  // coming into view: redraw at the current resolution (resizing the drawing buffer here stalled scrolling ~200 ms)
  const io = new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; if (state.visible && !state.frame && state.alive) { state.settle = 2; state.frame = requestAnimationFrame(tick); } }, { rootMargin: '120px' });
  io.observe(host);
  const onVisibility = () => { if (!document.hidden) invalidate(); };
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = e => { e.preventDefault(); host.dispatchEvent(new CustomEvent('model-error', { detail: labels.lostMessage })); };
  canvas.addEventListener('webglcontextlost', onLost);

  // Exactly one render per display frame. While a frame is being drawn state.frame is -1, so the
  // 'change' events that controls.update() raises only extend the loop instead of starting another.
  // Moving frames draw at a lighter pixel ratio; once still for a moment, one sharp frame is drawn.
  let HI_DPR = Math.min(window.devicePixelRatio || 1, DPR_CAP, 1.6), LO_DPR = Math.min(HI_DPR, 1);
  let sharpTimer = 0;
  function setDpr(v) {
    if (renderer.getPixelRatio() === v) return;
    const { width, height } = host.getBoundingClientRect();
    renderer.setPixelRatio(v); if (width && height) renderer.setSize(width, height, false);
  }
  function invalidate() {
    if (!state.alive || !state.hostActive || !state.visible || document.hidden) return;
    state.settle = 24;
    if (state.frame) return;
    clearTimeout(sharpTimer); setDpr(LO_DPR);
    state.frame = requestAnimationFrame(tick);
  }
  function sharpen() {
    clearTimeout(sharpTimer);
    sharpTimer = setTimeout(() => { if (!state.alive || !state.hostActive || document.hidden || state.frame || !state.visible) return; setDpr(HI_DPR); renderer.render(scene, camera); state.renders = (state.renders || 0) + 1; }, 180);
  }
  function tick(t) {
    state.frame = -1;
    if (!state.alive || !state.hostActive || !state.visible || document.hidden) { state.frame = 0; state.last = 0; return; }
    const raw = state.last ? (t - state.last) / 1000 : 0;
    // adaptive: if moving frames keep running slow, lower the sharp-frame resolution for this session
    if (raw > 0 && raw < 0.25) { state.govAcc = (state.govAcc || 0) + raw; state.govN = (state.govN || 0) + 1;
      if (state.govAcc > 1.5) { const avg = state.govAcc / state.govN; state.govAcc = state.govN = 0; if (avg > 1 / 48 && HI_DPR > 1) { HI_DPR = Math.max(1, HI_DPR - 0.3); LO_DPR = Math.min(LO_DPR, HI_DPR); } } }
    const dt = state.last ? Math.min((t - state.last) / 1000, 0.05) : 1 / 60;
    state.last = t;
    // critically-damped follow of the scroll pose: weighty, never springy
    const k = 1 - Math.exp(-dt * 7);
    state.yaw += (state.yawTarget - state.yaw) * k;
    state.lift += (state.liftTarget - state.lift) * k;
    pivot.rotation.y = state.yaw;
    pivot.position.y = state.lift;
    // shields peel outward layer by layer
    const target = state.userCutaway ?? state.openTarget;
    state.open += (target - state.open) * (1 - Math.exp(-dt * 2.4));
    if (Math.abs(target - state.open) < 0.001) state.open = target;
    for (const layer of state.layers) {
      const local = Math.min(1, Math.max(0, (state.open - layer.delay) / (1 - layer.delay)));
      const e = ease(local);
      layer.node.position.copy(layer.base).addScaledVector(layer.dir, e * layer.reach);
    }
    if (state.tween) {
      const u = Math.min(1, (t - state.tween.start) / 900), e = 1 - Math.pow(1 - u, 4);
      camera.position.lerpVectors(state.tween.from, state.tween.to, e);
      controls.target.lerpVectors(state.tween.fromTarget, TARGET, e);
      if (u >= 1) state.tween = null;
    }
    controls.update(dt);
    renderer.render(scene, camera); state.renders = (state.renders || 0) + 1;
    const moving = Math.abs(state.yawTarget - state.yaw) > 0.0004 || Math.abs(state.liftTarget - state.lift) > 0.0004 || state.open !== target || controls.autoRotate || !!state.tween || state.dragging;
    if (moving) state.settle = 24;
    if (moving || --state.settle > 0) state.frame = requestAnimationFrame(tick);
    else { state.frame = 0; state.last = 0; sharpen(); }
  }

  let model = null;
  new GLTFLoader().loadAsync(url).then(gltf => {
    if (!state.alive) { free(gltf.scene); return; }
    model = gltf.scene;
    pivot.add(model);
    model.updateMatrixWorld(true);
    // every cutaway half slides away from the axis; outer layer first, inner last
    const center = new THREE.Vector3(), box = new THREE.Box3();
    // measure "outward" from the cone's own axis (model centre), not from the world origin
    const whole = new THREE.Box3().setFromObject(model), axis = whole.getCenter(new THREE.Vector3());
    const radius = Math.max(whole.max.x - whole.min.x, whole.max.z - whole.min.z) / 2;
    model.traverse(node => {
      if (node.userData?.cutaway !== true) return;
      box.setFromObject(node).getCenter(center);
      const dir = new THREE.Vector3(center.x - axis.x, 0, center.z - axis.z);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      // convert the world direction into the node's parent space
      const parentInv = new THREE.Matrix4().copy(node.parent.matrixWorld).invert();
      const localDir = dir.clone().transformDirection(parentInv);
      const name = node.name || '';
      const order = name.includes('Outer') ? 0 : name.includes('Middle') ? 1 : 2;
      // reach is in world units along localDir (unit length after transformDirection): far enough to leave the frame
      const scale = node.parent.getWorldScale(new THREE.Vector3()).x || 1;
      state.layers.push({ node, base: node.position.clone(), dir: localDir, reach: radius * [1.9, 1.6, 1.35][order] / scale, delay: [0, 0.14, 0.28][order] });
    });
    resize();
    // compile every shader in the background now, so the first frame on screen does not stall scrolling
    const compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve();
    // upload textures to the GPU up front as well (first-frame uploads also stall scrolling)
    model.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (m[k]) renderer.initTexture(m[k]); });
    compiled.then(() => { if (!state.alive) return; onReady(); invalidate(); sharpen(); });
  }).catch(error => { if (state.alive) onError(error); });

  function free(root) {
    const g = new Set(), m = new Set();
    root.traverse(o => { if (o.geometry) g.add(o.geometry); for (const mat of [].concat(o.material || [])) m.add(mat); });
    g.forEach(x => x.dispose()); m.forEach(x => x.dispose());
  }

  return {
    /** Language switch: new aria-label and error text, in place. */
    setLabels({ ariaLabel: a, lostMessage: m } = {}) {
      if (typeof a === 'string') { labels.ariaLabel = a; canvas.setAttribute('aria-label', a); }
      if (typeof m === 'string') labels.lostMessage = m;
    },
    /** p: 0..1 through the sticky story. Drives yaw/lift and, until the user decides, the shields. */
    setProgress(p, step) {
      state.yawTarget = -0.55 + p * 2.6;
      state.liftTarget = Math.sin(p * Math.PI) * 0.08;
      state.openTarget = step >= 2 ? 1 : 0;
      invalidate();
    },
    setActive(active) { state.hostActive = !!active; if (state.hostActive) invalidate(); else { cancelAnimationFrame(state.frame); clearTimeout(sharpTimer); state.frame = 0; state.last = 0; } },
    setCutaway(on) { state.userCutaway = on ? 1 : 0; invalidate(); },
    get cutaway() { return (state.userCutaway ?? state.openTarget) > 0.5; },
    view(name) {
      const pose = POSES[name] || POSES.front;
      controls.autoRotate = false;
      state.tween = { from: camera.position.clone(), to: new THREE.Vector3(...pose), fromTarget: controls.target.clone(), start: performance.now() };
      invalidate();
    },
    reset() { state.userCutaway = null; controls.autoRotate = false; this.view('front'); },
    setAutoRotate(on) { controls.autoRotate = !!on; invalidate(); },
    get autoRotate() { return controls.autoRotate; },
    setFree(on) { state.free = !!on; applyTouchPolicy(); requestAnimationFrame(resize); },
    stats() { return { renders: state.renders || 0, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, loaded: !!model, pixelRatio: renderer.getPixelRatio() }; },
    dispose() {
      state.alive = false; cancelAnimationFrame(state.frame); clearTimeout(sharpTimer);
      host.removeEventListener('wheel', wheelGate, { capture: true });
      resizeObserver.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      if (model) free(model);
      environment.dispose(); pmrem.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
