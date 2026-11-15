import { LocalError, bindAttr, bindText, bodyName, t } from "./i18n";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { interpolate, seed, utcToTdb, skyDirection } from "./math";
import type { Body, Observation } from "./types";
import { orbitPath, asteroidScale } from "./orbits";
import { calibratedPose, planeGeometry, planePoint } from "./sightline";
import {
  GALACTIC_TO_ECLIPTIC,
  transpose,
  poleToEcliptic,
  PLANET_POLES,
  flightSpeed,
} from "./sky";
import {
  CONTROLS,
  FLIGHT_KEYS,
  IDLE,
  dragLook,
  liftStep,
  lookAngles,
  lookInput,
  lookVector,
  throttleStep,
  turn,
  type Throttle,
} from "./flight";
/** Gaia background display stretch: screen = clamp((map - SKY_BLACK) / (1 - SKY_BLACK)) x SKY_DIM.
 * Chosen from screenshots so the thinnest orbit lines and labels stay readable over the Milky Way. */
export const SKY_DIM = 0.75;
export const SKY_BLACK = 0.12;
/** Faint asteroid orbit line opacity without / with the Gaia background (same colour; only raised while the sky is shown). */
export const FAINT_ORBIT_OPACITY = 0.22;
export const FAINT_ORBIT_OPACITY_SKY = 0.3;
/** Mip footprint scale (>1 samples a slightly coarser mip level so the magnified map reads less grainy). */
export const SKY_SOFTEN = 2.5;
import { drawRadius, planetDrawRadius, pixelsPerAu, illustrativeWeight } from "./sky";
/** Planet maps (ESA/NASA public products copied to public/sky; see SOURCES.json). */
const PLANET_MAPS: Record<string, { map: string; coverage?: string }> = {
  "199": { map: "mercury.jpg" },
  "299": { map: "venus.jpg", coverage: "venus-coverage.png" },
  "399": { map: "earth.jpg" },
  "499": { map: "mars.jpg" },
  "599": { map: "jupiter.jpg" },
  "699": { map: "saturn.jpg", coverage: "saturn-coverage.png" },
  "799": { map: "uranus.jpg", coverage: "uranus-coverage.png" },
  "899": { map: "neptune.jpg", coverage: "neptune-coverage.png" },
};
/** NASA NSSDCA Saturn ring radii (km from centre) and equatorial radius; schematic only. */
const SATURN_RADIUS_KM = 60268;
const SATURN_RINGS_KM: [number, number, number][] = [
  [66900, 74510, 0.06], // D
  [74658, 91975, 0.22], // C
  [91975, 117507, 0.72], // B
  [117507, 122340, 0.1], // Cassini division (contains some material)
  [122340, 136780, 0.5], // A
];
const PLANET_TEXTURE_PX = 6;
/** Illustrative minimum radius on screen (CSS px) in the Solar system / Follow views; 1:1 in SPHEREx view. */
const PLANET_MIN_PX: Record<string, number> = {
  "199": 7, "299": 9, "399": 9, "499": 8, "599": 14, "699": 12, "799": 10, "899": 10,
};
/** Lit-limb atmosphere tint and strength (0 = none). Mercury has no atmosphere. */
const PLANET_ATMOSPHERE: Record<string, [number, number]> = {
  "299": [0xf3e2b6, 0.45],
  "399": [0x7fb2ff, 0.55],
  "499": [0xe8a27c, 0.2],
  "599": [0xf0dcc0, 0.2],
  "699": [0xf1e2b8, 0.2],
  "799": [0xb7f0f0, 0.45],
  "899": [0x7fa8ff, 0.45],
};
/** Sun disc (AU), its on-screen minimum (px) and cap (AU), and its additive halo (radius in disc radii). */
const SUN_RADIUS = 0.12;
const SUN_MIN_PX = 11;
const SUN_MAX_RADIUS = 0.3;
const SUN_GLOW_SCALE = 4.5;
/** Halo stops [radius in disc radii, alpha]: 0.62 at the disc edge, 0.26 at 2x, 0.08 at 3x, 0 at 4.5x. */
const SUN_GLOW_STOPS: [number, number][] = [
  [0, 0.75], [1, 0.62], [1.4, 0.44], [2, 0.26], [2.5, 0.15], [3, 0.08], [3.7, 0.025], [4.5, 0],
];
/** Halo colour #ffcf8a near the disc to #ff9a4a outside; disc gradient #fff3d6 centre to #ffb65c edge. */
const SUN_GLOW_NEAR = [255, 207, 138], SUN_GLOW_FAR = [255, 154, 74];
const SUN_VERTEX = `varying vec3 vN;varying vec3 vP;
void main(){vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.0);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const SUN_FRAGMENT = `varying vec3 vN;varying vec3 vP;
void main(){float m=clamp(dot(normalize(vN),normalize(cameraPosition-vP)),0.0,1.0);
gl_FragColor=vec4(mix(vec3(1.0,0.714,0.361),vec3(1.0,0.953,0.839),smoothstep(0.0,0.9,m)),1.0);}`;
const SKY_VERTEX = `varying vec3 vDir;
void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
// Mirrors eclipticToSkyUv() in sky.ts (unit-tested there).
// textureGrad with the smaller of two u-derivatives avoids a seam where u wraps from 1 to 0.
const SKY_FRAGMENT = `uniform sampler2D map;uniform mat3 toGalactic;uniform float dim;uniform float black;uniform float soften;varying vec3 vDir;
void main(){vec3 g=toGalactic*normalize(vDir);float l=atan(g.y,g.x);float b=asin(clamp(g.z,-1.0,1.0));
vec2 uv=vec2(fract(0.5-l/6.283185307179586),0.5+b/3.141592653589793);
vec2 dx=dFdx(uv),dy=dFdy(uv);vec2 ub=vec2(fract(uv.x+0.5),uv.y);vec2 dxb=dFdx(ub),dyb=dFdy(ub);
if(abs(dxb.x)+abs(dyb.x)<abs(dx.x)+abs(dy.x)){dx.x=dxb.x;dy.x=dyb.x;}
vec3 c=textureGrad(map,uv,dx*soften,dy*soften).rgb;
gl_FragColor=vec4(clamp((c-black)/(1.0-black),0.0,1.0)*dim,1.0);}`;
const PLANET_VERTEX = `varying vec2 vUv;varying vec3 vN;varying vec3 vP;
void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.0);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
// Own lighting: Sun at the origin, night side 0.12, no specular; independent of the rock lights.
// Unobserved pixels are black in these maps, so map + (1 - coverage) x mean colour stays right at every mip level.
// Atmosphere: a view-angle rim inside the disc, weighted by the day side only, so the night side never glows.
// k = illustrativeWeight(scale) (sky.ts): a planet drawn larger than true is a symbol, so it is lit evenly
// (illustrativeLight in sky.ts) and its rim runs all round the limb at 0.6; k = 0 at true size.
const PLANET_FRAGMENT = `uniform sampler2D map;uniform sampler2D coverage;uniform float hasCoverage;uniform vec3 fill;
uniform vec3 rim;uniform float rimStrength;uniform float k;
varying vec2 vUv;varying vec3 vN;varying vec3 vP;
void main(){vec3 c=texture2D(map,vUv).rgb;
if(hasCoverage>0.5){c=clamp(c+(1.0-texture2D(coverage,vUv).r)*fill,0.0,1.0);}
vec3 n=normalize(vN);float ndl=dot(n,normalize(-vP));float light=0.12+0.88*smoothstep(-0.04,0.55,ndl);light=mix(light,0.58+0.42*light,k);
float edge=1.0-clamp(dot(n,normalize(cameraPosition-vP)),0.0,1.0);
float day=smoothstep(-0.05,0.35,ndl);day=mix(day,max(day,0.6),k);
gl_FragColor=vec4(clamp(c*light+rim*(rimStrength*pow(edge,2.5)*day),0.0,1.0),1.0);}`;
const RING_VERTEX = `varying vec2 vXY;void main(){vXY=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
export class SolarScene {
  private byId: Map<string, Body>;
  renderer: T.WebGLRenderer;
  camera = new T.PerspectiveCamera(45, 1, 0.001, 400);
  scene = new T.Scene();
  controls: OrbitControls;
  private instances: T.InstancedMesh[] = [];
  private planets: T.Mesh[] = [];
  private sun!: T.Mesh;
  private sunGlow!: T.Sprite;
  private dummy = new T.Object3D();
  private p = [0, 0, 0];
  private chosen = "";
  private active = true;
  private disposed = false;
  private lifecycle = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private path: T.Line | null = null;
  private referencePath: T.Line | null = null;
  private observationPoints: T.Points | null = null;
  private marker: T.Mesh;
  private ray: T.Line;
  private tween: {
    start: number;
    from: T.Vector3;
    to: T.Vector3;
    targetFrom: T.Vector3;
    target: T.Vector3;
    fromQuaternion: T.Quaternion;
    toQuaternion: T.Quaternion;
    fromFov: number;
    toFov: number;
    up: T.Vector3;
  } | null = null;
  private freePose: {
    position: T.Vector3;
    target: T.Vector3;
    up: T.Vector3;
    fov: number;
  } | null = null;
  private photoTexture = new T.CanvasTexture(document.createElement("canvas"));
  private photoMaterial = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: T.DoubleSide,
    toneMapped: false,
  });
  private photoPlane = new T.Mesh(new T.BufferGeometry(), this.photoMaterial);
  private trailTexture = new T.CanvasTexture(document.createElement("canvas"));
  private trailMaterial = new T.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: T.DoubleSide,
    toneMapped: false,
  });
  private trailMesh = new T.Mesh(this.photoPlane.geometry, this.trailMaterial);
  private trailEnabled = true;
  private photoFrame = new T.LineLoop(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({
      color: 0x426e68,
      transparent: true,
      opacity: 0.6,
    }),
  );
  private projectionGroup = new T.Group();
  private photoEnabled = true;
  private warmup: Promise<unknown> = Promise.resolve();
  private observerRange = 1;
  private apparentPosition = new T.Vector3();
  private dirty = true;
  private frame = 0;
  private previous = 0;
  private mjd = 0;
  private playing = false;
  private hidden = false;
  private observer = false;
  private following = false;
  private observation: Observation | undefined;
  private lastTarget: T.Vector3 | null = null;
  private lastOrbit = 0;
  private labels: { body: Body; el: HTMLSpanElement }[] = [];
  private sizes: number[] = [];
  private dtSamples: number[] = [];
  private drawSamples: number[] = [];
  private frameTimes: number[] = [];
  // Gaia background
  private skyMaterial = new T.ShaderMaterial({
    uniforms: {
      map: { value: null },
      toGalactic: { value: new T.Matrix3() },
      dim: { value: SKY_DIM },
      black: { value: SKY_BLACK },
      soften: { value: SKY_SOFTEN },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  private sky = new T.Mesh(new T.SphereGeometry(200, 64, 32), this.skyMaterial);
  private skyEnabled = true;
  private skyLevel = 0;
  private skyLoading = false;
  private skyFailed = false;
  private low = false;
  private firstFrame = false;
  private textures: T.Texture[] = [];
  private photoBacking: T.Mesh;
  // WASD flight
  private keys = new Set<string>();
  private pointerOver = false;
  private velocity = new T.Vector3();
  private flightActive = false;
  private throttle: Throttle = IDLE;
  /** Vertical speed, fraction of the local full speed (+ = up). */
  private lift = 0;
  /** Left-button look drag in progress. */
  private lookDrag: { id: number; x: number; y: number } | null = null;
  onTick: (dt: number) => void = () => {};
  onSelect: (id: string) => void = () => {};
  onError: (message: () => string) => void = () => {};
  /** Called when the Gaia background becomes shown or hidden (for the credit line). */
  onSky: (shown: boolean) => void = () => {};
  /** Called once when the Gaia background cannot be loaded at all. */
  onSkyFail: () => void = () => {};
  constructor(
    private element: HTMLElement,
    private bodies: Body[],
  ) {
    this.byId = new Map(bodies.map((b) => [b.id, b]));
    this.renderer = new T.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x090e17);
    element.append(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -9, 7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 90;
    // Left drag looks around in place (lookStart/lookMove); right drag orbits the target; no panning.
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: T.MOUSE.DOLLY,
      RIGHT: T.MOUSE.ROTATE,
    };
    this.controls.enablePan = false;
    this.controls.addEventListener("change", () => this.request());
    this.controls.addEventListener("start", () => this.takeOver());
    const g = transpose(GALACTIC_TO_ECLIPTIC);
    (this.skyMaterial.uniforms.toGalactic.value as T.Matrix3).set(
      ...g[0],
      ...g[1],
      ...g[2],
    );
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.sky.visible = false;
    this.scene.add(this.sky);
    this.scene.add(new T.HemisphereLight(0xc9dfff, 0x4f413b, 2.4));
    this.scene.add(new T.PointLight(0xffe9b5, 3, 0, 0));
    const sun = new T.Mesh(
      new T.SphereGeometry(SUN_RADIUS, 48, 24),
      new T.ShaderMaterial({ vertexShader: SUN_VERTEX, fragmentShader: SUN_FRAGMENT }),
    );
    this.scene.add(sun);
    sun.userData.radius = SUN_RADIUS;
    this.sun = sun;
    {
      // Additive warm halo drawn as a camera-facing sprite; it only adds light, so orbit lines stay visible.
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      if (ctx) {
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        for (const [at, a] of SUN_GLOW_STOPS) {
          const f = Math.min(1, Math.max(0, (at - 1) / 2)),
            [r, gr, b] = SUN_GLOW_NEAR.map((x, i) => Math.round(x + (SUN_GLOW_FAR[i] - x) * f));
          g.addColorStop(at / SUN_GLOW_SCALE, `rgba(${r},${gr},${b},${a})`);
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
      }
      const texture = new T.CanvasTexture(c);
      texture.colorSpace = T.SRGBColorSpace;
      this.textures.push(texture);
      this.sunGlow = new T.Sprite(
        new T.SpriteMaterial({
          map: texture,
          blending: T.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      this.sunGlow.scale.setScalar(2 * SUN_GLOW_SCALE * SUN_RADIUS);
      this.sunGlow.renderOrder = -1;
      this.scene.add(this.sunGlow);
    }
    this.photoTexture.colorSpace = T.SRGBColorSpace;
    this.photoTexture.minFilter = this.photoTexture.magFilter = T.NearestFilter;
    this.photoTexture.generateMipmaps = false;
    this.photoMaterial.forceSinglePass = true;
    this.photoMaterial.map = this.photoTexture;
    this.photoPlane.renderOrder = 5;
    this.trailTexture.colorSpace = T.SRGBColorSpace;
    this.trailTexture.minFilter = this.trailTexture.magFilter = T.LinearFilter;
    this.trailTexture.generateMipmaps = false;
    this.trailMaterial.forceSinglePass = true;
    this.trailMaterial.map = this.trailTexture;
    this.trailMesh.renderOrder = 10;
    // Opaque backing in the flat background colour, so the 65% photo never shows the Gaia map through it.
    this.photoBacking = new T.Mesh(
      this.photoPlane.geometry,
      new T.MeshBasicMaterial({
        color: 0x090e17,
        depthWrite: false,
        side: T.DoubleSide,
        toneMapped: false,
      }),
    );
    this.photoBacking.renderOrder = 4;
    this.projectionGroup.add(
      this.photoBacking,
      this.photoPlane,
      this.photoFrame,
      this.trailMesh,
    );
    this.projectionGroup.visible = false;
    this.scene.add(this.projectionGroup);
    // Real JPL-derived osculating reference ellipses, never circular grid rings.
    for (const kind of ["planet", "asteroid"]) {
      const vertices: number[] = [];
      for (const body of bodies.filter((b) => b.kind === kind)) {
        const points = orbitPath(body.samples[0]);
        for (let i = 1; i < points.length; i++)
          vertices.push(...points[i - 1], ...points[i]);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      const material = new T.LineBasicMaterial({
        color: kind === "planet" ? 0x6689a3 : 0x3b5c65,
        transparent: true,
        opacity: kind === "planet" ? 0.65 : FAINT_ORBIT_OPACITY,
      });
      if (kind !== "planet") this.faintOrbitMaterials.push(material);
      this.scene.add(new T.LineSegments(geometry, material));
    }
    const rocks = bodies.filter((b) => b.kind === "asteroid");
    for (let k = 0; k < 4; k++) {
      const geo = new T.IcosahedronGeometry(1, k === 3 ? 0 : 1),
        a = geo.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i),
          y = a.getY(i),
          z = a.getZ(i);
        const r = 1 + 0.16 * Math.sin(x * 12 + y * 7 + z * 19 + k * 3);
        a.setXYZ(
          i,
          x * r * (k === 1 ? 1.65 : 1),
          y * r * (k === 2 ? 1.3 : 1),
          z * r * (k === 2 ? 0.55 : 1),
        );
      }
      geo.computeVertexNormals();
      const group = rocks.filter((b) => seed(b.id) % 4 === k),
        mesh = new T.InstancedMesh(
          geo,
          new T.MeshStandardMaterial({
            color: [0xa1a5ac, 0xa78f77, 0x899b9b, 0x9d929f][k],
            roughness: 1,
            flatShading: true,
          }),
          group.length,
        );
      mesh.userData.ids = group.map((b) => b.id);
      mesh.frustumCulled = false;
      this.instances.push(mesh);
      this.scene.add(mesh);
    }
    for (const body of bodies.filter((b) => b.kind === "planet")) {
      const radius =
        {
          "199": 0.013,
          "299": 0.025,
          "399": 0.027,
          "499": 0.018,
          "599": 0.065,
          "699": 0.055,
          "799": 0.04,
          "899": 0.038,
        }[body.id] ?? 0.027;
      const mesh = new T.Mesh(
        new T.IcosahedronGeometry(radius, 1),
        new T.MeshStandardMaterial({
          color: body.color,
          roughness: 1,
          flatShading: true,
        }),
      );
      mesh.userData.id = body.id;
      mesh.userData.radius = radius;
      mesh.userData.map = "none";
      this.planets.push(mesh);
      this.scene.add(mesh);
    }
    this.marker = new T.Mesh(
      new T.RingGeometry(0.0055, 0.006, 32),
      new T.MeshBasicMaterial({
        color: 0x8ce1cc,
        side: T.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.marker.renderOrder = 2;
    this.scene.add(this.marker);
    this.ray = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineBasicMaterial({
        color: 0x62b8cf,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.scene.add(this.ray);
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.hidden = true;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.onError(() => t("sc.contextLost"));
    });
    let down = [0, 0];
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    bindAttr(canvas, "aria-label", () => t("sc.canvas"));
    canvas.addEventListener("pointerenter", () => (this.pointerOver = true));
    canvas.addEventListener("pointerleave", () => (this.pointerOver = false));
    canvas.addEventListener("pointerdown", (e) => {
      down = [e.clientX, e.clientY];
      if (e.pointerType === "mouse" && document.activeElement !== canvas)
        canvas.focus({ preventScroll: true });
      this.lookStart(e);
    });
    canvas.addEventListener("pointermove", (e) => this.lookMove(e));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(type, (e) => {
        if (this.lookDrag?.id === (e as PointerEvent).pointerId) this.lookDrag = null;
      });
    const signal = this.lifecycle.signal;
    window.addEventListener("keydown", (e) => this.keyDown(e), { signal });
    window.addEventListener("keyup", (e) => this.keyUp(e), { signal });
    window.addEventListener("blur", () => this.releaseKeys(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => document.hidden && this.releaseKeys(),
      { signal },
    );
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = this.renderer.domElement.getBoundingClientRect(),
        raycaster = new T.Raycaster();
      raycaster.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = raycaster.intersectObjects(this.instances)[0];
      if (hit && hit.instanceId !== undefined) {
        this.onSelect(hit.object.userData.ids[hit.instanceId]);
        return;
      }
      // Distant asteroids are only a few pixels wide: fall back to the
      // nearest instance centre within a 12 px pick tolerance on screen.
      const m = new T.Matrix4(),
        v = new T.Vector3();
      let best: string | undefined,
        bestD = 12;
      for (const mesh of this.instances) {
        if (!mesh.visible) continue;
        const ids: string[] = mesh.userData.ids;
        for (let i = 0; i < ids.length; i++) {
          mesh.getMatrixAt(i, m);
          v.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld).project(this.camera);
          if (v.z < -1 || v.z > 1) continue;
          const d = Math.hypot(
            ((v.x + 1) / 2) * r.width + r.left - e.clientX,
            ((1 - v.y) / 2) * r.height + r.top - e.clientY,
          );
          if (d < bestD) {
            bestD = d;
            best = ids[i];
          }
        }
      }
      if (best) this.onSelect(best);
    });
    this.resizeObserver = new ResizeObserver(() => {
      const w = element.clientWidth,
        h = element.clientHeight;
      if (w <= 0 || h <= 0 || this.disposed) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      if (this.observer && !this.tween) this.alignObserver(false);
      this.camera.updateProjectionMatrix();
      this.request();
    });
    this.resizeObserver.observe(element);
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      if (this.hidden) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      } else {
        this.previous = 0;
        this.request();
      }
    }, {signal:this.lifecycle.signal});
    for (const b of bodies) {
      const label = document.createElement("span");
      label.className = "body-label";
      bindText(label, () => bodyName(b));
      label.hidden = true;
      element.append(label);
      this.labels.push({ body: b, el: label });
    }
    const first=bodies.find(body=>body.kind === "asteroid");
    if(!first) throw new LocalError("sc.noAsteroid");
    this.setSelected(first.id);
    this.warmup = this.renderer.compileAsync(this.scene, this.camera);
  }
  ready() {
    return this.warmup;
  }
  // ---------- Flight: you travel where you look ----------
  private keyDown(e: KeyboardEvent) {
    if (!FLIGHT_KEYS.has(e.code)) return;
    if (e.ctrlKey || e.altKey || e.metaKey || this.observer || this.disposed || !this.active) return;
    const canvas = this.renderer.domElement,
      focus = document.activeElement as HTMLElement | null;
    if (
      focus &&
      focus !== canvas &&
      (focus.isContentEditable ||
        /^(INPUT|SELECT|TEXTAREA)$/.test(focus.tagName))
    )
      return;
    if (focus && focus !== canvas && focus.tagName === "BUTTON") {
      // A button that was just clicked (Follow, play) keeps the focus. With the pointer over
      // the scene the keys belong to the scene, so the focus moves there and Space does not
      // press the button again. Without the pointer over the scene the button keeps its keys.
      if (!this.pointerOver) return;
      canvas.focus({ preventScroll: true });
    }
    if (!this.pointerOver && document.activeElement !== canvas) return;
    e.preventDefault();
    if (this.keys.has(e.code)) return;
    this.keys.add(e.code);
    if (e.code === "KeyX") this.throttle = { ...this.throttle, braking: true };
    this.takeOver();
    this.startFlight();
  }
  private keyUp(e: KeyboardEvent) {
    if (this.keys.delete(e.code)) this.request();
  }
  private releaseKeys() {
    this.keys.clear();
    this.lookDrag = null;
    this.request();
  }
  /** Wake the per-frame flight step. */
  private startFlight() {
    if (!this.flightActive) {
      this.flightActive = true;
      if (!this.playing) this.previous = 0;
    }
    this.request();
  }
  /** Full stop: throttle 0, no vertical motion, keys forgotten (view buttons, SPHEREx view). */
  private stopFlight() {
    this.keys.clear();
    this.throttle = IDLE;
    this.lift = 0;
    this.velocity.set(0, 0, 0);
    this.flightActive = false;
  }
  /** Starting to fly, to look or to drag the controls: follow and SPHEREx view released, running tween cancelled. */
  private takeOver() {
    if (this.tween) {
      this.camera.up.copy(this.tween.up);
      this.tween = null;
      this.controls.enabled = true;
      this.controls.update();
    }
    this.observer = false;
    this.following = false;
  }
  private lookStart(e: PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0 || this.observer || this.disposed) return;
    this.lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  private lookMove(e: PointerEvent) {
    const drag = this.lookDrag;
    if (!drag || drag.id !== e.pointerId) return;
    if (this.observer || !(e.buttons & 1)) {
      this.lookDrag = null;
      return;
    }
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!dx && !dy) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    this.takeOver();
    this.turnView(...dragLook(dx, dy));
    this.request();
  }
  /** Turn the view in place about +Z (yaw) and the camera's right axis (pitch); no roll. */
  private turnView(dYaw: number, dPitch: number) {
    const dir = this.camera.getWorldDirection(new T.Vector3()),
      [yaw, pitch] = turn(...lookAngles(dir.toArray() as [number, number, number]), dYaw, dPitch);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(this.camera.position.clone().add(new T.Vector3(...lookVector(yaw, pitch))));
    this.syncTarget();
  }
  /** Keep the orbit target straight ahead at the current target distance, so wheel zoom and right-drag
   * orbit continue from the new pose and a later controls.update() does not snap back. */
  private syncTarget() {
    const distance = Math.max(
        this.controls.minDistance,
        this.camera.position.distanceTo(this.controls.target),
      ),
      dir = this.camera.getWorldDirection(new T.Vector3());
    this.controls.target.copy(this.camera.position).addScaledVector(dir, distance);
    this.camera.updateMatrixWorld();
  }
  private nearestSurface() {
    const c = this.camera.position;
    let d = c.length() - 0.12;
    for (const mesh of this.planets)
      d = Math.min(d, c.distanceTo(mesh.position) - mesh.userData.radius);
    d = Math.min(
      d,
      c.distanceTo(this.marker.position) - asteroidScale(this.chosen) * 1.65,
    );
    return d;
  }
  private flightStep(dt: number) {
    if (!this.flightActive) return false;
    if (this.observer || this.tween) {
      this.stopFlight();
      return false;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.throttle = throttleStep(this.throttle, this.keys, dt, reduced);
    this.lift = liftStep(this.lift, this.keys, dt, reduced);
    const [yawRate, pitchRate] = lookInput(this.keys);
    if (dt > 0 && (yawRate || pitchRate))
      this.turnView(yawRate * CONTROLS.lookRate * dt, pitchRate * CONTROLS.lookRate * dt);
    const speed = flightSpeed(this.nearestSurface()),
      forward = this.camera.getWorldDirection(new T.Vector3()),
      // Lift follows the camera's own up, as in the reference experience (not the scene's +Z).
      up = new T.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.velocity
      .copy(forward)
      .multiplyScalar(this.throttle.value * speed)
      .addScaledVector(up, this.lift * speed);
    const moving = this.throttle.value !== 0 || this.lift !== 0;
    if (!moving && this.keys.size === 0 && !this.throttle.braking) {
      this.velocity.set(0, 0, 0);
      this.flightActive = false;
      return false;
    }
    if (dt > 0 && moving) {
      const distance = this.camera.position.distanceTo(this.controls.target);
      this.camera.position.addScaledVector(this.velocity, dt);
      this.controls.target.copy(this.camera.position).addScaledVector(forward, distance);
      this.camera.updateMatrixWorld();
    }
    return true;
  }
  // ---------- Gaia background ----------
  private skyBase() {
    return new URL("./sky/", location.href).href;
  }
  private loadTexture(name: string) {
    return new T.TextureLoader().loadAsync(new URL(name, this.skyBase()).href);
  }
  private canTake4k() {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return (
      !this.low &&
      this.renderer.capabilities.maxTextureSize >= 4096 &&
      !(memory !== undefined && memory < 4) &&
      !matchMedia("(pointer: coarse)").matches
    );
  }
  private async loadSky() {
    if (this.skyLoading || this.skyFailed || this.disposed || !this.skyEnabled) return;
    const want = this.skyLevel === 0 ? 2 : this.skyLevel === 2 && this.canTake4k() ? 4 : 0;
    if (!want) return;
    this.skyLoading = true;
    try {
      const texture = await this.loadTexture(want === 2 ? "gaia-sky-2k.jpg" : "gaia-sky.jpg");
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = T.NoColorSpace;
      texture.wrapS = T.RepeatWrapping;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const old = this.skyMaterial.uniforms.map.value as T.Texture | null;
      this.skyMaterial.uniforms.map.value = texture;
      this.textures.push(texture);
      if (old) {
        old.dispose();
        this.textures = this.textures.filter((t) => t !== old);
      }
      this.skyLevel = want;
      this.applySky();
    } catch {
      // Silent: the flat background stays.
      if (this.skyLevel === 0) {
        this.skyFailed = true;
        this.onSkyFail();
      }
    } finally {
      this.skyLoading = false;
    }
    if (this.skyLevel === 2 && !this.disposed)
      window.setTimeout(() => void this.loadSky(), 1500);
  }
  private faintOrbitMaterials: T.LineBasicMaterial[] = [];
  private applySky() {
    const shown = this.skyEnabled && this.skyLevel > 0;
    for (const m of this.faintOrbitMaterials) m.opacity = shown ? FAINT_ORBIT_OPACITY_SKY : FAINT_ORBIT_OPACITY;
    if (this.sky.visible !== shown) {
      this.sky.visible = shown;
      this.onSky(shown);
    }
    this.request();
  }
  setSky(enabled: boolean) {
    this.skyEnabled = enabled;
    this.applySky();
    if (enabled && this.firstFrame) void this.loadSky();
  }
  // ---------- Textured planets ----------
  private planetPixels(mesh: T.Mesh) {
    const d = this.camera.position.distanceTo(mesh.position),
      r: number = mesh.userData.radius;
    if (d <= r) return Infinity;
    return (
      (Math.asin(Math.min(1, (r * mesh.scale.x) / d)) / ((this.camera.fov * Math.PI) / 360)) *
      (this.element.clientHeight / 2)
    );
  }
  private async texturePlanet(mesh: T.Mesh) {
    const id: string = mesh.userData.id,
      spec = PLANET_MAPS[id];
    mesh.userData.map = "loading";
    if (!spec) return;
    if (id === "699") this.addSaturnRings(mesh);
    try {
      const [map, coverage] = await Promise.all([
        this.loadTexture(spec.map),
        spec.coverage ? this.loadTexture(spec.coverage) : Promise.resolve(null),
      ]);
      if (this.disposed) {
        map.dispose();
        coverage?.dispose();
        return;
      }
      for (const t of [map, coverage]) {
        if (!t) continue;
        t.colorSpace = T.NoColorSpace;
        t.anisotropy = 4;
        this.textures.push(t);
      }
      const fill = coverage
        ? meanColour(map.image as CanvasImageSource, coverage.image as CanvasImageSource)
        : [0, 0, 0];
      mesh.userData.fill = fill.map((x) => Math.round(x * 255));
      const r: number = mesh.userData.radius;
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
      mesh.geometry = new T.SphereGeometry(r, 64, 32);
      mesh.material = new T.ShaderMaterial({
        uniforms: {
          map: { value: map },
          coverage: { value: coverage },
          hasCoverage: { value: coverage ? 1 : 0 },
          fill: { value: new T.Vector3(...fill) },
          rim: { value: new T.Color(PLANET_ATMOSPHERE[id]?.[0] ?? 0) },
          rimStrength: { value: PLANET_ATMOSPHERE[id]?.[1] ?? 0 },
          k: { value: illustrativeWeight(mesh.scale.x) },
        },
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
      });
      // Sphere local +Y is the map's north pole and +X longitude 0 (east-positive maps).
      mesh.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        new T.Vector3(...poleToEcliptic(...PLANET_POLES[id])),
      );
      mesh.userData.map = "textured";
    } catch {
      mesh.userData.map = "failed";
    }
    this.request();
  }
  private addSaturnRings(mesh: T.Mesh) {
    const r: number = mesh.userData.radius,
      k = r / SATURN_RADIUS_KM,
      inner = SATURN_RINGS_KM[0][0] * k,
      outer = SATURN_RINGS_KM[SATURN_RINGS_KM.length - 1][1] * k;
    const bands = SATURN_RINGS_KM.map(
      ([a, b, alpha]) =>
        `if(r>=${(a * k).toFixed(7)}&&r<${(b * k).toFixed(7)})a=${alpha.toFixed(2)};`,
    ).join("");
    const ring = new T.Mesh(
      new T.RingGeometry(inner, outer, 160, 1),
      new T.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: `varying vec2 vXY;void main(){float r=length(vXY);float a=0.0;${bands}gl_FragColor=vec4(vec3(0.72,0.66,0.56),a);}`,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2; // ring plane = equator (perpendicular to local +Y pole)
    ring.userData.schematic = true;
    mesh.add(ring);
    const pole = new T.Vector3(...poleToEcliptic(...PLANET_POLES["699"]));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), pole);
  }
  setObservationTimes(times: number[]) {
    if (this.observationPoints) {
      this.scene.remove(this.observationPoints);
      this.observationPoints.geometry.dispose();
      (this.observationPoints.material as T.Material).dispose();
    }
    const body = this.byId.get(this.chosen)!;
    const points = times.map(
      (t) => new T.Vector3(...interpolate(body.samples, utcToTdb(t))),
    );
    this.observationPoints = new T.Points(
      new T.BufferGeometry().setFromPoints(points),
      new T.PointsMaterial({
        color: 0xf4c18a,
        size: 5,
        sizeAttenuation: false,
        depthTest: false,
      }),
    );
    this.scene.add(this.observationPoints);
    this.request();
  }
  setObservation(
    o: Observation | undefined,
    photo?: HTMLCanvasElement,
    trail?: HTMLCanvasElement,
  ) {
    this.observation = o;
    const f = o?.image?.calibration;
    if (!o?.spacecraft || !f) {
      this.projectionGroup.visible = false;
      return;
    }
    const physical = interpolate(
      this.byId.get(o.objectId)!.samples,
      utcToTdb(o.mjd),
    );
    this.observerRange = new T.Vector3(...physical).distanceTo(
      new T.Vector3(...o.spacecraft),
    );
    this.apparentPosition
      .fromArray(o.spacecraft)
      .addScaledVector(
        new T.Vector3(...skyDirection(o.ra, o.dec)),
        this.observerRange,
      );
    this.photoPlane.geometry.dispose();
    this.photoPlane.geometry = planeGeometry(f);
    this.trailMesh.geometry = this.photoPlane.geometry;
    this.photoBacking.geometry = this.photoPlane.geometry;
    const n = f.segments,
      corners = [
        f.grid[0],
        f.grid[n],
        f.grid[n * (n + 1) + n],
        f.grid[n * (n + 1)],
      ];
    this.photoFrame.geometry.dispose();
    this.photoFrame.geometry = new T.BufferGeometry().setFromPoints(
      corners.map((p) => new T.Vector3(p[0], p[1], 0)),
    );
    const d = this.observerRange * 0.97;
    this.projectionGroup.position
      .fromArray(o.spacecraft)
      .addScaledVector(new T.Vector3(...f.forward), d);
    this.projectionGroup.quaternion.setFromRotationMatrix(
      new T.Matrix4().makeBasis(
        new T.Vector3(...f.right),
        new T.Vector3(...f.up),
        new T.Vector3(...f.forward).negate(),
      ),
    );
    this.projectionGroup.scale.setScalar(d);
    if (photo) {
      this.photoTexture.image = photo;
      this.photoTexture.needsUpdate = true;
    }
    if (trail) {
      this.trailTexture.image = trail;
      this.trailTexture.needsUpdate = true;
    }
    this.trailMesh.visible = this.trailEnabled;
    this.projectionGroup.visible = this.observer;
    this.photoPlane.visible = this.photoEnabled;
    this.photoBacking.visible = this.photoEnabled;
    if (this.observer) this.alignObserver(false);
    this.dirty = true;
    this.request();
  }
  setTrailVisible(visible: boolean) {
    this.trailEnabled = visible;
    this.trailMesh.visible = visible;
    this.trailTexture.needsUpdate = true;
    this.request();
  }
  setPhotoVisible(visible: boolean) {
    this.photoEnabled = visible;
    this.photoPlane.visible = visible;
    this.photoBacking.visible = visible;
    this.request();
  }
  setPhotoOpacity(alpha: number) {
    this.photoMaterial.opacity = alpha;
    this.request();
  }
  private alignObserver(animate: boolean) {
    const o = this.observation;
    if (!o?.image?.calibration) return;
    const pose = calibratedPose(
      o,
      o.image.calibration,
      this.observerRange,
      this.camera.aspect,
    );
    if (animate) this.fly(pose);
    else {
      this.tween = null;
      this.camera.position.copy(pose.position);
      this.camera.up.copy(pose.up);
      this.camera.lookAt(pose.target);
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
      this.controls.target.copy(pose.target);
    }
  }
  private fly(pose: {
    position: T.Vector3;
    target: T.Vector3;
    up: T.Vector3;
    fov: number;
  }) {
    this.stopFlight();
    const end = this.camera.clone();
    end.position.copy(pose.position);
    end.up.copy(pose.up);
    end.lookAt(pose.target);
    this.controls.enabled = false;
    this.tween = {
      start: performance.now(),
      from: this.camera.position.clone(),
      to: pose.position,
      targetFrom: this.controls.target.clone(),
      target: pose.target,
      fromQuaternion: this.camera.quaternion.clone(),
      toQuaternion: end.quaternion.clone(),
      fromFov: this.camera.fov,
      toFov: pose.fov,
      up: pose.up,
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      this.tween.start -= 1100;
    this.request();
  }
  setSelected(id: string) {
    this.chosen = id;
    this.observer = false;
    this.following = false;
    this.tween = null;
    this.controls.enabled = true;
    this.camera.up.set(0, 0, 1);
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.projectionGroup.visible = false;
    this.lastTarget = null;
    this.updatePath();
    this.request();
  }
  private updatePath() {
    if (this.path) {
      this.scene.remove(this.path);
      this.path.geometry.dispose();
      (this.path.material as T.Material).dispose();
    }
    const b = this.byId.get(this.chosen)!;
    if (this.referencePath) {
      this.scene.remove(this.referencePath);
      this.referencePath.geometry.dispose();
      (this.referencePath.material as T.Material).dispose();
    }
    this.referencePath = new T.Line(
      new T.BufferGeometry().setFromPoints(
        orbitPath(b.samples[0]).map((p) => new T.Vector3(...p)),
      ),
      new T.LineBasicMaterial({
        color: 0x65cdb6,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.scene.add(this.referencePath);
    const points = b.samples
      .filter((_, i) => i % 2 === 0)
      .map((s) => new T.Vector3(s[1], s[2], s[3]));
    this.path = new T.Line(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({
        color: 0xb6ffe6,
        transparent: true,
        opacity: 1,
      }),
    );
    this.scene.add(this.path);
  }
  setTime(mjd: number) {
    this.mjd = mjd;
    this.dirty = true;
    this.request();
  }
  setPlaying(value: boolean) {
    this.playing = value;
    this.previous = 0;
    this.request();
  }
  setActive(active: boolean) {
    this.active=active;this.previous=0;
    if(!active){cancelAnimationFrame(this.frame);this.frame=0;}else this.request();
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.setActive(false);
    this.lifecycle.abort();this.resizeObserver?.disconnect();this.controls.dispose();
    const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
    this.scene.traverse(object=>{
      const mesh=object as T.Mesh;
      if(mesh.geometry)geometries.add(mesh.geometry);
      if(mesh.material)for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))materials.add(material);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    this.photoTexture.dispose();this.trailTexture.dispose();for(const texture of this.textures)texture.dispose();this.renderer.dispose();
    this.renderer.domElement.remove();for(const label of this.labels)label.el.remove();
  }
  quality(low: boolean) {
    this.low = low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.5));
    if (!low && this.firstFrame) void this.loadSky();
    this.request();
  }
  view(mode: "system" | "target" | "observer" | "free") {
    if (mode === "observer" && !this.observation?.image?.calibration) {
      this.onError(() => t("sc.noWcs"));
      return;
    }
    if (mode === "observer" && !this.observer)
      this.freePose = {
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
        up: this.camera.up.clone(),
        fov: this.camera.fov,
      };
    this.observer = mode === "observer";
    this.following = mode === "target";
    this.projectionGroup.visible = this.observer;
    this.dirty = true;
    if (this.observer) {
      this.alignObserver(true);
      return;
    }
    const target = new T.Vector3(
      ...interpolate(this.byId.get(this.chosen)!.samples, utcToTdb(this.mjd)),
    );
    this.lastTarget = target.clone();
    if (mode === "free" && this.freePose) {
      this.fly(this.freePose);
      return;
    }
    if (mode === "target")
      this.fly({
        position: target.clone().add(new T.Vector3(0, -0.035, 0.022)),
        target,
        up: new T.Vector3(0, 0, 1),
        fov: 45,
      });
    else
      this.fly({
        position: new T.Vector3(0, -9, 7),
        target: new T.Vector3(),
        up: new T.Vector3(0, 0, 1),
        fov: 45,
      });
  }
  request() {
    if (!this.frame && !this.hidden && this.active && !this.disposed)
      this.frame = requestAnimationFrame((t) => this.render(t));
  }
  private render(t: number) {
    this.frame = 0;
    if (this.disposed || !this.active || this.hidden) return;
    if (this.previous && this.playing) {
      this.frameTimes.push(t - this.previous);
      if (this.frameTimes.length > 600) this.frameTimes.shift();
    }
    const dt = this.previous ? Math.min((t - this.previous) / 1000, 0.1) : 0;
    this.previous = t;
    if (this.playing) this.onTick(dt);
    const begin = performance.now();
    if (this.dirty) {
      this.dirty = false;
      const epoch = utcToTdb(this.mjd);
      for (const mesh of this.instances) {
        const ids: string[] = mesh.userData.ids;
        ids.forEach((id, i) => {
          const b = this.byId.get(id)!;
          interpolate(b.samples, epoch, this.p);
          this.dummy.position.set(...(this.p as [number, number, number]));
          if (this.observer && id === this.chosen)
            this.dummy.position.copy(this.apparentPosition);
          const h = seed(id);
          this.dummy.rotation.set(
            (h % 20) * 0.1,
            (h % 31) * 0.1,
            (h % 17) * 0.1,
          );
          const pixelScale =
            this.observation?.image?.calibration?.radiansPerPixel ?? 0;
          this.dummy.scale.setScalar(
            this.observer
              ? this.observerRange * pixelScale * 0.65
              : asteroidScale(id),
          );
          this.dummy.updateMatrix();
          mesh.setMatrixAt(i, this.dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
      for (const mesh of this.planets) {
        interpolate(this.byId.get(mesh.userData.id)!.samples, epoch, this.p);
        mesh.position.set(...(this.p as [number, number, number]));
      }
      interpolate(this.byId.get(this.chosen)!.samples, epoch, this.p);
      this.marker.position.set(...(this.p as [number, number, number]));
      if (this.observer) this.marker.position.copy(this.apparentPosition);
      this.marker.scale.setScalar(
        this.observer
          ? (this.observerRange *
              (this.observation?.image?.calibration?.radiansPerPixel ?? 0) *
              5) /
              0.006
          : 1,
      );
      this.ray.visible = !this.observer;
      if (this.observationPoints)
        this.observationPoints.visible = !this.observer;
      if (this.following && !this.tween && this.lastTarget) {
        const delta = this.marker.position.clone().sub(this.lastTarget);
        this.camera.position.add(delta);
        this.controls.target.add(delta);
        this.controls.update();
      }
      this.lastTarget = this.marker.position.clone();
      const earth = this.planets.find((b) => b.userData.id === "399")!;
      const a = this.ray.geometry.getAttribute("position");
      a.setXYZ(0, earth.position.x, earth.position.y, earth.position.z);
      a.setXYZ(1, ...(this.p as [number, number, number]));
      a.needsUpdate = true;
      this.ray.geometry.computeBoundingSphere();
    }
    if (this.tween) {
      if (this.following) {
        const delta = this.marker.position.clone().sub(this.tween.target);
        this.tween.to.add(delta);
        this.tween.target.copy(this.marker.position);
      }
      const u = Math.min(1, (t - this.tween.start) / 1100),
        ease = u * u * (3 - 2 * u);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, ease);
      this.controls.target.lerpVectors(
        this.tween.targetFrom,
        this.tween.target,
        ease,
      );
      this.camera.quaternion.slerpQuaternions(
        this.tween.fromQuaternion,
        this.tween.toQuaternion,
        ease,
      );
      this.camera.fov = Math.exp(
        T.MathUtils.lerp(
          Math.log(this.tween.fromFov),
          Math.log(this.tween.toFov),
          ease,
        ),
      );
      this.camera.updateProjectionMatrix();
      if (u === 1) {
        this.camera.up.copy(this.tween.up);
        this.tween = null;
        this.controls.enabled = !this.observer;
        if (!this.observer) this.controls.update();
      }
    }
    const flying = this.flightStep(dt);
    this.sky.position.copy(this.camera.position);
    // Illustrative sizes: each body at least its minimum on screen, true size close up and in SPHEREx view.
    const viewHeight = this.element.clientHeight;
    for (const mesh of this.planets) {
      const base: number = mesh.userData.radius,
        ppa = pixelsPerAu(this.camera.position.distanceTo(mesh.position), this.camera.fov, viewHeight);
      mesh.scale.setScalar(
        planetDrawRadius(base, PLANET_MIN_PX[mesh.userData.id] ?? 0, ppa, mesh.position.length(), this.observer) / base,
      );
      // Even illustrative light (sky.ts illustrativeLight): shader uniform once mapped, emissive floor of the flat fill before.
      const k = illustrativeWeight(mesh.scale.x),
        material = mesh.material as T.ShaderMaterial & T.MeshStandardMaterial;
      mesh.userData.k = k;
      if (material.uniforms?.k) material.uniforms.k.value = k;
      else if (material.emissive) material.emissive.copy(material.color).multiplyScalar(0.58 * k);
    }
    {
      const ppa = pixelsPerAu(this.camera.position.length(), this.camera.fov, viewHeight),
        r = this.observer ? SUN_RADIUS : drawRadius(SUN_RADIUS, SUN_MIN_PX, ppa, SUN_MAX_RADIUS);
      this.sun.scale.setScalar(r / SUN_RADIUS);
      this.sunGlow.scale.setScalar(2 * SUN_GLOW_SCALE * r);
      // No glow in Low power, nor in SPHEREx view where nothing may brighten the photograph plane.
      this.sunGlow.visible = !this.low && !this.observer;
    }
    for (const mesh of this.planets)
      if (
        !this.low &&
        mesh.userData.map === "none" &&
        this.planetPixels(mesh) >= PLANET_TEXTURE_PX
      )
        void this.texturePlanet(mesh);
    this.marker.visible = !this.observer || !this.trailEnabled;
    this.marker.quaternion.copy(this.camera.quaternion);
    const labelWidth = this.element.clientWidth,
      labelHeight = this.element.clientHeight;
    for (const { body, el } of this.labels) {
      if (body.kind === "asteroid" && body.id !== this.chosen) {
        el.hidden = true;
        continue;
      }
      const p = interpolate(body.samples, utcToTdb(this.mjd));
      const v = (
        this.observer && body.id === this.chosen
          ? this.apparentPosition.clone()
          : new T.Vector3(...p)
      ).project(this.camera);
      el.hidden = v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
      if (!el.hidden) {
        // Planet names start 6 px right of the drawn disc, or left of it when the box would cover the Sun's disc.
        const planet = body.kind === "planet" ? this.planets.find((m) => m.userData.id === body.id) : undefined;
        let left = ((v.x + 1) * labelWidth) / 2 + 8;
        if (planet) {
          const x = ((v.x + 1) * labelWidth) / 2,
            y = ((-v.y + 1) * labelHeight) / 2,
            r = Math.min(this.planetPixels(planet), labelWidth),
            w = el.offsetWidth,
            h = el.offsetHeight,
            s = new T.Vector3().project(this.camera),
            sx = ((s.x + 1) * labelWidth) / 2,
            sy = ((-s.y + 1) * labelHeight) / 2,
            sr = this.planetPixels(this.sun);
          left = x + r + 6;
          const dx = Math.max(left - sx, 0, sx - left - w),
            dy = Math.max(y - 8 - sy, 0, sy - (y - 8 + h));
          if (s.z < 1 && dx * dx + dy * dy < sr * sr) left = x - r - 6 - w;
        }
        el.style.left = left + "px";
        el.style.top = ((-v.y + 1) * labelHeight) / 2 - 8 + "px";
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.drawSamples.push(performance.now() - begin);
    if (dt > 0) this.dtSamples.push(dt * 1000);
    if (this.dtSamples.length > 600) this.dtSamples.shift();
    if (this.drawSamples.length > 600) this.drawSamples.shift();
    if (this.playing || this.tween || flying) this.request();
    if (!this.firstFrame) {
      this.firstFrame = true;
      window.setTimeout(() => void this.loadSky(), 0);
    }
  }
  private overlayError() {
    const o = this.observation,
      f = o?.image?.calibration;
    if (!this.observer || this.tween || !o?.image || !o.spacecraft || !f)
      return null;
    const im = o.image,
      p = planePoint(
        f,
        im.predicted[0],
        im.height - 1 - im.predicted[1],
        im.width,
        im.height,
      );
    const direction = new T.Vector3(...f.forward)
      .addScaledVector(new T.Vector3(...f.right), p[0])
      .addScaledVector(new T.Vector3(...f.up), p[1])
      .normalize();
    return (
      direction.distanceTo(new T.Vector3(...skyDirection(o.ra, o.dec))) /
      f.radiansPerPixel
    );
  }
  private screenAlignmentError() {
    const o = this.observation,
      f = o?.image?.calibration;
    if (!this.observer || this.tween || !o?.image || !f) return null;
    const im = o.image,
      p = planePoint(
        f,
        im.predicted[0],
        im.height - 1 - im.predicted[1],
        im.width,
        im.height,
      );
    this.camera.updateMatrixWorld();
    this.projectionGroup.updateMatrixWorld();
    const photo = new T.Vector3(p[0], p[1], 0)
      .applyMatrix4(this.projectionGroup.matrixWorld)
      .project(this.camera);
    const mesh = this.instances.find((m) =>
      m.userData.ids.includes(this.chosen),
    )!;
    const matrix = new T.Matrix4();
    mesh.getMatrixAt(mesh.userData.ids.indexOf(this.chosen), matrix);
    const rock = new T.Vector3()
      .setFromMatrixPosition(matrix)
      .applyMatrix4(mesh.matrixWorld)
      .project(this.camera);
    return Math.hypot(
      ((rock.x - photo.x) * this.element.clientWidth) / 2,
      ((rock.y - photo.y) * this.element.clientHeight) / 2,
    );
  }
  /** Test hook: try another background brightness factor. */
  debugSkyDim(value: number, black = SKY_BLACK, soften = SKY_SOFTEN) {
    this.skyMaterial.uniforms.soften.value = soften;
    this.skyMaterial.uniforms.dim.value = value;
    this.skyMaterial.uniforms.black.value = black;
    this.request();
  }
  /** Test hook: place the free camera (ignored in SPHEREx view). */
  debugCamera(position: number[], target: number[]) {
    if (this.observer) return;
    this.takeOver();
    this.camera.position.fromArray(position);
    this.controls.target.fromArray(target);
    this.controls.update();
    this.request();
  }
  metrics() {
    const sorted = [...this.drawSamples].sort((a, b) => a - b);
    const frames = [...this.frameTimes].sort((a, b) => a - b);
    return {
      frameP95: frames[Math.floor(frames.length * 0.95)] ?? 0,
      drawP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      frames: this.drawSamples.length,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      scheduled: !!this.frame,
      selectedScreen: (this.observer
        ? this.apparentPosition.clone()
        : new T.Vector3(
            ...interpolate(
              this.byId.get(this.chosen)!.samples,
              utcToTdb(this.mjd),
            ),
          )
      )
        .project(this.camera)
        .toArray(),
      observer: this.observer,
      flying: !!this.tween,
      photoVisible: this.projectionGroup.visible && this.photoPlane.visible,
      photoOpacity: this.photoMaterial.opacity,
      trailVisible: this.projectionGroup.visible && this.trailMesh.visible,
      sharedTrailGeometry: this.trailMesh.geometry === this.photoPlane.geometry,
      cameraPosition: this.camera.position.toArray(),
      cameraQuaternion: this.camera.quaternion.toArray(),
      cameraFov: this.camera.fov,
      overlayErrorPixels: this.overlayError(),
      screenAlignmentError: this.screenAlignmentError(),
      controlsEnabled: this.controls.enabled,
      imageMeshErrorPixels:
        this.observation?.image?.calibration?.maxMeshErrorPixels,
      sky: { enabled: this.skyEnabled, shown: this.sky.visible, level: this.skyLevel, failed: this.skyFailed, dim: this.skyMaterial.uniforms.dim.value, black: this.skyMaterial.uniforms.black.value, soften: this.skyMaterial.uniforms.soften.value },
      planetMaps: Object.fromEntries(this.planets.map((m) => [m.userData.id, m.userData.map])),
      wasdFlying: this.flightActive,
      flight: {
        throttle: this.throttle.value,
        braking: this.throttle.braking,
        lift: this.lift,
        keys: [...this.keys],
        speed: this.velocity.length(),
        look: this.camera.getWorldDirection(new T.Vector3()).toArray(),
        position: this.camera.position.toArray(),
      },
      planetFill: Object.fromEntries(this.planets.map((m) => [m.userData.id, m.userData.fill ?? null])),
      planetPositions: Object.fromEntries(this.planets.map((m) => [m.userData.id, m.position.toArray()])),
      planetScale: Object.fromEntries(this.planets.map((m) => [m.userData.id, m.scale.x])),
      planetRadiusPx: Object.fromEntries(this.planets.map((m) => [m.userData.id, this.planetPixels(m)])),
      sunRadiusPx: this.planetPixels(this.sun),
      planetK: Object.fromEntries(this.planets.map((m) => [m.userData.id, m.userData.k ?? 0])),
      sunScreen: (() => { const s = new T.Vector3().project(this.camera); return [((s.x + 1) * this.element.clientWidth) / 2, ((-s.y + 1) * this.element.clientHeight) / 2]; })(),
      sunGlow: this.sunGlow.visible,
      controlsTarget: this.controls.target.toArray(),
      photoVertices:
        this.photoPlane.geometry.getAttribute("position")?.count ?? 0,
    };
  }
}
/** Mean colour (0..1, map's own encoding) of the observed pixels, used to fill unobserved regions. */
function meanColour(map: CanvasImageSource, coverage: CanvasImageSource): [number, number, number] {
  const w = 128,
    h = 64,
    canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [0.5, 0.5, 0.5];
  ctx.drawImage(map, 0, 0, w, h);
  const colour = ctx.getImageData(0, 0, w, h).data;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(coverage, 0, 0, w, h);
  const mask = ctx.getImageData(0, 0, w, h).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < colour.length; i += 4)
    if (mask[i] > 250) {
      r += colour[i];
      g += colour[i + 1];
      b += colour[i + 2];
      n++;
    }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5];
}
