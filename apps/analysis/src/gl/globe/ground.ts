// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
//
// The ground of the sky map: an opaque dark dome below the horizon whose top edge is the skyline
// silhouette (skylineHeightDeg, procedural and deterministic), plus a soft glow just above the
// horizon so the skyline reads against the sky. Everything is built once in a LOCAL frame
// (x = east, y = zenith, z = -north, a proper rotation) and placed with one matrix per observer frame,
// so a refresh of the sky costs one matrix and no geometry work. Two meshes, two draw calls.

import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { DEG } from './healpix';
import { skylineHeightDeg, type ObserverFrame } from './horizon';

/** Azimuth step of the silhouette in degrees (roof edges are 0.1 deg multiples, so they fall on samples). */
export const SKYLINE_STEP_DEG = 0.05;
const GLOW_STEPS = 360;
/** Draw orders: tiles use 0..5, the graticule 100; the glow sits under the grid, the ground above it. */
export const GLOW_ORDER = 90;
export const GROUND_ORDER = 150;

/** Local direction (x east, y zenith, z -north) for azimuth/altitude in degrees. */
export function localDir(azDeg: number, altDeg: number): [number, number, number] {
  const a = azDeg * DEG;
  const h = altDeg * DEG;
  const ch = Math.cos(h);
  return [ch * Math.sin(a), Math.sin(h), -ch * Math.cos(a)];
}

export interface GroundColors {
  /** Ground colour at the skyline, at mid depth and at the nadir. */
  rim: string;
  mid: string;
  deep: string;
  /** Glow colour just above the horizon. */
  glow: string;
}

export interface GroundMeshes {
  group: Group;
  /** Place the meshes for an observer frame. */
  setFrame(f: ObserverFrame): void;
  dispose(): void;
}

function buildGroundGeometry(c: GroundColors): BufferGeometry {
  const n = Math.round(360 / SKYLINE_STEP_DEG);
  const cols = n + 1; // closing column duplicates azimuth 0 so the ring has no seam
  const lower: { alt: number; color: Color }[] = [
    { alt: -14, color: new Color(c.mid) },
    { alt: -45, color: new Color(c.deep) },
  ];
  const rim = new Color(c.rim);
  const deep = new Color(c.deep);
  const rings = 1 + lower.length;
  const vCount = rings * cols + 1; // plus the nadir
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const put = (i: number, v: [number, number, number], k: Color) => {
    pos.set(v, i * 3);
    col.set([k.r, k.g, k.b], i * 3);
  };
  for (let i = 0; i < cols; i++) {
    const az = (i * 360) / n;
    put(i, localDir(az, skylineHeightDeg(az)), rim);
    lower.forEach((l, r) => put((r + 1) * cols + i, localDir(az, l.alt), l.color));
  }
  const nadir = rings * cols;
  put(nadir, [0, -1, 0], deep);
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * cols + i;
      const b = a + 1;
      const d = (r + 1) * cols + i;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const last = (rings - 1) * cols;
  for (let i = 0; i < n; i++) idx.push(last + i, nadir, last + i + 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function buildGlowGeometry(c: GroundColors): BufferGeometry {
  const glow = new Color(c.glow);
  // alt (deg) and alpha of each ring: strongest at the horizon, gone by 24 deg; kept light so the imagery stays the main thing.
  const stops: [number, number][] = [
    [-2, 0.62],
    [1.5, 0.5],
    [4.5, 0.3],
    [9, 0.14],
    [16, 0.05],
    [24, 0],
  ];
  const cols = GLOW_STEPS + 1;
  const pos = new Float32Array(stops.length * cols * 3);
  const col = new Float32Array(stops.length * cols * 4);
  stops.forEach(([alt, alpha], r) => {
    for (let i = 0; i < cols; i++) {
      const az = (i * 360) / GLOW_STEPS;
      const k = r * cols + i;
      pos.set(localDir(az, alt), k * 3);
      col.set([glow.r, glow.g, glow.b, alpha], k * 4);
    }
  });
  const idx: number[] = [];
  for (let r = 0; r < stops.length - 1; r++) {
    for (let i = 0; i < GLOW_STEPS; i++) {
      const a = r * cols + i;
      const d = (r + 1) * cols + i;
      idx.push(a, d, a + 1, a + 1, d, d + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

/** Build the ground and glow meshes (hidden until setFrame is called). */
export function createGround(colors: GroundColors): GroundMeshes {
  const groundGeo = buildGroundGeometry(colors);
  const glowGeo = buildGlowGeometry(colors);
  // transparent: true is what puts these after the (transparent) sky tiles in three's draw order.
  const groundMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: DoubleSide });
  const glowMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
  const ground = new Mesh(groundGeo, groundMat);
  const glow = new Mesh(glowGeo, glowMat);
  ground.renderOrder = GROUND_ORDER;
  glow.renderOrder = GLOW_ORDER;
  ground.frustumCulled = false;
  glow.frustumCulled = false;
  const group = new Group();
  group.matrixAutoUpdate = false;
  group.add(glow, ground);
  group.visible = false;
  const m = new Matrix4();
  return {
    group,
    setFrame(f: ObserverFrame) {
      m.makeBasis(new Vector3(...f.east), new Vector3(...f.zenith), new Vector3(-f.north[0], -f.north[1], -f.north[2]));
      group.matrix.copy(m);
      group.matrixWorld.copy(m);
      group.visible = true;
    },
    dispose() {
      groundGeo.dispose();
      glowGeo.dispose();
      groundMat.dispose();
      glowMat.dispose();
    },
  };
}
