import { it, expect } from "vitest";
import * as T from "three";
import rawData from "../public/data/sightlines.json";
import rawSequences from "../public/data/comparisons.json";
import { calibratedPose, planePoint, planeGeometry } from "../src/sightline";
import { skyDirection } from "../src/math";
const data: Record<string, any> = rawData;
const seqs: any[] = rawSequences;
it("all real calibrated frames project image and asteroid onto the same sensor location", () => {
  for (const o of seqs.flatMap((s: any) => s.frames)) {
    const frame = data[o.image.path],
      pose = calibratedPose(o, frame, 2, 1.5),
      camera = new T.PerspectiveCamera(pose.fov, 1.5, 0.000001, 400);
    camera.position.copy(pose.position);
    camera.up.copy(pose.up);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
    const ray = new T.Vector3(...skyDirection(o.ra, o.dec));
    const target = pose.position.clone().addScaledVector(ray, 2);
    const projected = target.clone().project(camera),
      pixel = planePoint(
        frame,
        o.image.predicted[0],
        o.image.height - 1 - o.image.predicted[1],
        o.image.width,
        o.image.height,
      );
    const photoPoint = pose.position
      .clone()
      .addScaledVector(new T.Vector3(...frame.forward), 1.94)
      .addScaledVector(new T.Vector3(...frame.right), pixel[0] * 1.94)
      .addScaledVector(new T.Vector3(...frame.up), pixel[1] * 1.94)
      .project(camera);
    expect(projected.distanceTo(photoPoint)).toBeLessThan(1e-5);
    const g = planeGeometry(frame);
    expect(g.getAttribute("position").count).toBe(289);
    g.dispose();
  }
});
it("original SIP images have independently validated subpixel image meshes", () => {
  for (const f of Object.values(data) as any[]) {
    expect(f.maxMeshErrorPixels).toBeLessThan(0.01);
    expect(new T.Vector3(...f.forward).dot(new T.Vector3(...f.up))).toBeCloseTo(
      0,
      10,
    );
  }
});
