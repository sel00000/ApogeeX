import { it, expect } from "vitest";
import { visibleTrail, trailDescription } from "../src/trails";
import { setLang } from "../src/i18n";
import trails from "../public/data/trails.json";
import observations from "../public/data/observations.json";
import comparisons from "../public/data/comparisons.json";
import type { ImageTrail } from "../src/types";
it("marks all prepared objects and always includes the current real exposure", () => {
  const all = Object.values(trails) as ImageTrail[];
  const expected = new Set([
    ...observations.filter((o) => o.image).map((o) => o.objectId),
    ...comparisons.map((s) => s.objectId),
  ]);
  expect(new Set(all.map((t) => t.objectId))).toEqual(expected);
  for (const t of all) {
    expect(visibleTrail(t).some((p) => p.id === t.currentId)).toBe(true);
    expect(t.points.every((p) => p.objectId === t.objectId)).toBe(true);
  }
});
it("keeps off-image positions out and explains single-exposure limitations", () => {
  const all = Object.values(trails) as ImageTrail[];
  expect(all.some((t) => t.points.some((p) => !p.inside))).toBe(true);
  for (const t of all)
    for (const p of visibleTrail(t)) expect(p.inside).toBe(true);
  const single = {...all[0], points: [all[0].points[0]]};
  // Default language is now English (user instruction 2026-11-15); the Korean text is checked under 'ko'.
  setLang("ko");
  expect(trailDescription(single)).toContain(
    "이동 비교 자료 없음",
  );
  setLang("en");
  expect(trailDescription(single)).toContain("no motion comparison data");
});
