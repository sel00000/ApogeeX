// Line-of-sight ("시선 보기") camera and projection to SPHEREx frame pixels.
//
// A perspective camera *is* a gnomonic (TAN) projection, so a camera placed at the
// Earth, looking at the common-WCS centre (crval) with celestial north as "up" and
// tan(fov/2) = (n/2)·pixel, renders the sky exactly on the baked north-up grid.
// The renderer (Scene3D) and the tests use the same `makeLosCamera`, so the match
// error shown in the UI is measured on the camera that draws the picture.
//
// Pixel convention (scripts/bake.py): PNG pixels, origin at the top-left image
// corner, x right, y down, pixel i centred at i+0.5; crval sits at (n/2, n/2).

import { PerspectiveCamera, Vector3 } from 'three'
import type { CommonWcs, Vec3 } from '../types'
import { cross, dot, scale, sub, unit } from './ephem'

const DEG = Math.PI / 180

export function radecToVec(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

export function vecToRadec(v: Vec3): [number, number] {
  const r = Math.hypot(v[0], v[1], v[2])
  return [((Math.atan2(v[1], v[0]) / DEG) % 360 + 360) % 360, Math.asin(v[2] / r) / DEG]
}

export interface LosBasis {
  /** look direction: unit vector toward crval */
  forward: Vec3
  /** celestial north projected perpendicular to forward */
  up: Vec3
  /** forward × up — points WEST on the sky, so east is on the left */
  right: Vec3
  /** vertical (= horizontal) field of view, degrees */
  fovDeg: number
}

export function losBasis(wcs: CommonWcs): LosBasis {
  const forward = radecToVec(wcs.crval[0], wcs.crval[1])
  const z: Vec3 = [0, 0, 1]
  const up = unit(sub(z, scale(forward, dot(z, forward))))
  const halfRad = (wcs.size_px[1] / 2) * (wcs.cdelt_arcsec / 3600) * DEG
  return { forward, up, right: cross(forward, up), fovDeg: (2 * Math.atan(halfRad)) / DEG }
}

/** three.js line-of-sight camera.
 *  `position` is the Earth in whatever frame the scene uses (origin = camera by default,
 *  or the target-local frame in Scene3D). `zoom` > 1 shows a window of the frame centred on
 *  `center` (frame pixels) via setViewOffset, which crops without changing the projection. */
export function makeLosCamera(
  wcs: CommonWcs,
  camera = new PerspectiveCamera(),
  { position = [0, 0, 0] as Vec3, zoom = 1, center }: { position?: Vec3; zoom?: number; center?: [number, number] } = {},
): PerspectiveCamera {
  const b = losBasis(wcs)
  const [nx, ny] = wcs.size_px
  camera.position.set(...position)
  camera.up.set(...b.up)
  camera.lookAt(position[0] + b.forward[0], position[1] + b.forward[1], position[2] + b.forward[2])
  camera.fov = b.fovDeg
  camera.aspect = nx / ny
  camera.near = 1e-2
  camera.far = 1e9 // AU; targets are ~1e5-1e7 AU away
  const [cx, cy] = center ?? [nx / 2, ny / 2]
  if (zoom === 1 && !center) camera.clearViewOffset()
  else camera.setViewOffset(nx * zoom, ny * zoom, cx * zoom - nx / 2, cy * zoom - ny / 2, nx, ny)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

/** Project a point (same frame as the camera) to frame pixels. */
export function projectToPx(camera: PerspectiveCamera, point: Vec3, wcs: CommonWcs): [number, number] {
  const p = new Vector3(...point).project(camera)
  const [nx, ny] = wcs.size_px
  const v = camera.view?.enabled ? camera.view : null
  const z = v ? v.fullWidth / nx : 1
  const ox = v ? v.offsetX : 0
  const oy = v ? v.offsetY : 0
  return [(ox + ((p.x + 1) / 2) * nx) / z, (oy + ((1 - p.y) / 2) * ny) / z]
}

/** Where the 3D camera at `earth` sees the target, in frame pixels. */
export function losPixel(wcs: CommonWcs, earth: Vec3, target: Vec3): [number, number] {
  return projectToPx(makeLosCamera(wcs), sub(target, earth), wcs)
}

export const pxDistance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])
