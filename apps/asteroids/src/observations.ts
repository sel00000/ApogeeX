import { LocalError, bindText, t } from "./i18n";
import type { Observation } from "./types";
import { drawTrail, visibleTrail } from "./trails";
export async function fetchImage(
  url: string,
  signal: AbortSignal,
): Promise<Blob> {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new LocalError("v.httpStatus", { s: r.status });
      return await r.blob();
    } catch (error) {
      if (signal.aborted || attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
  throw new LocalError("v.noResponse");
}
/** One bitmap atlas per frame; bounded cache; stale responses never replace the selection. */
export class ObservationViewer {
  private cache = new Map<string, ImageBitmap>();
  private generation = 0;
  private controller: AbortController | null = null;
  private current: Observation | null = null;
  private bitmap: ImageBitmap | null = null;
  private alpha = 0.65;
  private mode: "photo" | "model" | "blend" = "blend";
  private trailEnabled = true;
  readonly trailCanvas = document.createElement("canvas");
  readonly photoCanvas = document.createElement("canvas");
  private modelCanvas = document.createElement("canvas");
  constructor(
    private canvas: HTMLCanvasElement,
    private status: HTMLElement,
    private dataBase = new URL("./data/", location.href).href,
  ) {
    this.trailCanvas.width = this.trailCanvas.height = 512;
    this.canvas.width = this.canvas.height = 512;
    this.modelCanvas.width = this.modelCanvas.height = 512;
  }
  setTrailVisible(v: boolean) {
    this.trailEnabled = v;
    this.draw();
  }
  setOpacity(v: number) {
    this.alpha = v;
    this.draw();
  }
  setMode(mode: "photo" | "model" | "blend") {
    this.mode = mode;
    this.draw();
  }
  async show(obs: Observation) {
    const generation = ++this.generation;
    this.controller?.abort();
    if (!obs.image) {
      this.clear();
      return false;
    }
    const key = obs.image.path;
    bindText(this.status, () => t("v.opening"));
    try {
      let bitmap = this.cache.get(key);
      if (bitmap) {
        this.cache.delete(key);
        this.cache.set(key, bitmap);
      } else {
        this.controller = new AbortController();
        bitmap = await createImageBitmap(
          await fetchImage(new URL(key, this.dataBase).href, this.controller.signal),
        );
        if (generation !== this.generation) {
          bitmap.close();
          return false;
        }
        this.cache.set(key, bitmap);
        while (this.cache.size > 8) {
          const oldest = this.cache.keys().next().value!;
          this.cache.get(oldest)!.close();
          this.cache.delete(oldest);
        }
      }
      if (generation !== this.generation) return false;
      this.current = obs;
      this.bitmap = bitmap;
      const atlas = obs.image.atlas;
      bindText(this.status, () => t(atlas ? "v.atlas" : "v.single"));
      this.draw();
      return true;
    } catch (e) {
      if (generation !== this.generation) return false;
      this.current = null;
      this.bitmap = null;
      this.draw();
      bindText(this.status, () => t("v.failed"));
      return false;
    }
  }
  cancelPending() {
    ++this.generation;
    this.controller?.abort();
    const real = Boolean(this.current);
    bindText(this.status, () => t(real ? "v.pausedReal" : "v.paused"));
  }
  clear() {
    ++this.generation;
    this.controller?.abort();
    this.current = null;
    this.bitmap = null;
    this.draw();
    bindText(this.status, () => t("v.none"));
  }
  dispose() {
    this.controller?.abort();++this.generation;
    for(const bitmap of this.cache.values()) bitmap.close();
    this.cache.clear();this.current=null;this.bitmap=null;
  }
  private draw() {
    const c = this.canvas,
      ctx = c.getContext("2d")!;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#080d15";
    ctx.fillRect(0, 0, 512, 512);
    if (this.bitmap && this.current?.image) {
      const im = this.current.image;
      ctx.imageSmoothingEnabled = false;
      if (this.mode !== "model" || !im.atlas)
        ctx.drawImage(this.bitmap, 0, 0, im.width, im.height, 0, 0, 512, 512);
      if (im.atlas && this.mode !== "photo") {
        const mc = this.modelCanvas.getContext("2d")!;
        mc.imageSmoothingEnabled = false;
        mc.globalCompositeOperation = "source-over";
        mc.drawImage(
          this.bitmap,
          im.width,
          0,
          im.width,
          im.height,
          0,
          0,
          512,
          512,
        );
        if (this.mode === "blend") {
          mc.globalCompositeOperation = "multiply";
          mc.fillStyle = "#78f5d4";
          mc.fillRect(0, 0, 512, 512);
          mc.globalCompositeOperation = "source-over";
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = this.alpha;
        }
        ctx.drawImage(this.modelCanvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
    const trailCtx = this.trailCanvas.getContext("2d")!;
    trailCtx.clearRect(0, 0, 512, 512);
    if (this.trailEnabled && this.bitmap && this.current?.image) {
      const im = this.current.image;
      drawTrail(trailCtx, im.trail, im.width, im.height);
      ctx.drawImage(this.trailCanvas, 0, 0);
    }

    const photo = this.photoCanvas;
    if (this.bitmap && this.current?.image) {
      const im = this.current.image;
      photo.width = im.width;
      photo.height = im.height;
      photo
        .getContext("2d")!
        .drawImage(
          this.bitmap,
          0,
          0,
          im.width,
          im.height,
          0,
          0,
          im.width,
          im.height,
        );
    } else {
      photo.getContext("2d")!.clearRect(0, 0, photo.width, photo.height);
    }
  }
  metrics() {
    return {
      cachedImages: this.cache.size,
      bytes: [...this.cache.values()].reduce(
        (n, b) => n + b.width * b.height * 4,
        0,
      ),
      observation: this.current?.id,
      compositeMode: this.mode,
      fixedSky: !!this.current?.image?.atlas,
      predicted: this.current?.image?.predicted,
      trailEnabled: this.trailEnabled,
      trailPoints: visibleTrail(this.current?.image?.trail),
      trailCurrent: this.current?.image?.trail?.currentId,
    };
  }
}
