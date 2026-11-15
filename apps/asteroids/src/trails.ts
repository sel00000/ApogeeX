import { t } from "./i18n";
import type { ImageTrail, TrailPoint } from "./types";
export function visibleTrail(trail: ImageTrail | undefined): TrailPoint[] {
  return (
    trail?.points.filter(
      (p) => p.inside && Number.isFinite(p.x) && Number.isFinite(p.y),
    ) ?? []
  );
}
/** One tiny ring per exposure. Coordinates never come from another image's pixel grid. */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: ImageTrail | undefined,
  width: number,
  height: number,
  size = 512,
) {
  const points = visibleTrail(trail),
    current = trail?.points.find((p) => p.id === trail.currentId);
  if (!current) return;
  const xy = (p: TrailPoint) => [
    ((p.x! + 0.5) * size) / width,
    ((p.y! + 0.5) * size) / height,
  ];
  ctx.save();
  ctx.lineCap = "round";
  // Connect only consecutive on-image exposures. Do not bridge a gap outside the field.
  for (let i = 1; i < (trail?.points.length ?? 0); i++) {
    const a = trail!.points[i - 1],
      b = trail!.points[i];
    if (!a.inside || !b.inside) continue;
    const [x, y] = xy(a),
      [u, v] = xy(b),
      d = Math.hypot(u - x, v - y),
      ra = a.id === current.id ? 9 : 6,
      rb = b.id === current.id ? 9 : 6;
    if (d <= ra + rb) continue;
    ctx.beginPath();
    ctx.moveTo(x + ((u - x) * ra) / d, y + ((v - y) * ra) / d);
    ctx.lineTo(u - ((u - x) * rb) / d, v - ((v - y) * rb) / d);
    ctx.strokeStyle = "rgba(5,12,18,.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle =
      b.order <= current.order
        ? "rgba(255,195,112,.75)"
        : "rgba(191,207,217,.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash(b.order <= current.order ? [] : [3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const p of [
    ...points.filter((p) => p.id !== current.id),
    ...points.filter((p) => p.id === current.id),
  ]) {
    const now = p.id === current.id,
      past = p.order < current.order,
      [x, y] = xy(p),
      radius = now ? 7 : 4;
    ctx.globalAlpha = now ? 1 : past ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#071019";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = now ? "#8bffe0" : past ? "#ffc370" : "#d1dfe8";
    ctx.lineWidth = now ? 1.8 : 1.2;
    ctx.stroke();
    // Label only separated rings; nearby exposures retain their true overlapping positions.
    if (
      now ||
      points.every(
        (q) => q === p || Math.hypot(...xy(q).map((v, i) => v - xy(p)[i])) > 18,
      )
    ) {
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#071019";
      ctx.strokeText(String(p.order), x + radius + 4, y - 9);
      ctx.fillStyle = now ? "#8bffe0" : past ? "#ffc370" : "#d1dfe8";
      ctx.fillText(String(p.order), x + radius + 4, y - 9);
    }
  }
  // Leave the source cores unobscured even when consecutive positions nearly overlap.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  for (const p of points) {
    const [x, y] = xy(p);
    ctx.beginPath();
    ctx.arc(x, y, p.id === current.id ? 4 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
export function trailDescription(trail: ImageTrail | undefined) {
  if (!trail) return t("tr.none");
  if (trail.points.length === 1)
    return t("tr.single");
  const visible = visibleTrail(trail).length,
    outside = trail.points.length - visible;
  return t("tr.count", { order: String(trail.points.find((p) => p.id === trail.currentId)?.order), total: trail.points.length, visible, outside: outside ? t("tr.outside", { n: outside }) : "" });
}
