import { initialBody } from "./research-model";
import { SolarScene } from "./scene";
import { ObservationViewer } from "./observations";
import { date } from "./math";
import { markSkyUnavailable } from "./sky";
import { trailDescription } from "./trails";
import { LocalError, applyI18n, bindAttr, bindHtml, bindText, statusPhrase, t } from "./i18n";
const tr = t;
import type {
  Body,
  Observation,
  Manifest,
  Sequence,
  Sightline,
  ImageTrail,
} from "./types";
export async function mountOrbit(app: HTMLElement, options: {target?: string; dataBase: string; signal?: AbortSignal; onTarget: (id: string) => void}) {
const lifecycle = new AbortController();
options.signal?.throwIfAborted();
options.signal?.addEventListener('abort',()=>lifecycle.abort(),{once:true});
async function json<T>(p: string): Promise<T> {
  const r = await fetch(new URL(p, options.dataBase), {signal:lifecycle.signal});
  if (!r.ok) throw Error(`${p}: ${r.status}`);
  return r.json();
}

  const [manifest, bodies, observations, sequences, sightlines, trails] =
    await Promise.all([
      json<Manifest>("manifest.json"),
      json<Body[]>("bodies.json"),
      json<Observation[]>("observations.json"),
      json<Sequence[]>("comparisons.json"),
      json<Record<string, Sightline>>("sightlines.json"),
      json<Record<string, ImageTrail>>("trails.json"),
    ]);
  lifecycle.signal.throwIfAborted();
  for (const o of [...observations, ...sequences.flatMap((s) => s.frames)])
    if (o.image) {
      o.image.calibration = sightlines[o.image.path];
      o.image.trail = trails[o.image.path];
    }
  const asteroids = bodies.filter((b) => b.kind === "asteroid");
  const initial = initialBody(bodies, options.target);
  if (!initial) throw options.target ? new LocalError("o.noTarget3d", { t: options.target }) : new LocalError("o.noAsteroids");
  let selected = initial.id,
    playing = false,
    mjd = manifest.start,
    speed = 10,
    observation: Observation | undefined,
    mode = "system";
  const freeCaptionKey = matchMedia("(pointer: coarse)").matches
    ? "o.captionTouch"
    : "o.captionKeys";
  const freeCaption = () => t(freeCaptionKey);
  const SKY_KEY = "spherex-asteroids:sky";
  let skyOn = true;
  try {
    skyOn = localStorage.getItem(SKY_KEY) !== "0";
  } catch {
    /* storage unavailable: default on */
  }
  app.innerHTML = ` <main><aside class="catalog"><div class="eyebrow">SOLAR SYSTEM EXPLORER</div><h1 data-i18n-html="o.title"></h1><p class="intro" data-i18n-html="o.intro"></p><label class="search"><span>⌕</span><input id="search" data-i18n-ph="o.search" data-i18n-aria="o.search"></label><div class="list-head"><bdi data-i18n="o.listHead"></bdi> <span>${asteroids.length} OBJECTS</span></div><div id="objects" role="list"></div><div class="catalog-foot" data-i18n-html="o.foot"></div></aside>
 <section class="universe"><div id="scene"></div><div class="sky-scrim" aria-hidden="true"></div><div id="observer-tools" hidden><div class="photo-controls"><label><input id="photo-visible" type="checkbox" checked> <bdi data-i18n="o.photoOn"></bdi></label><label><bdi data-i18n="o.photoOpacity"></bdi> <input id="photo-opacity" type="range" data-i18n-aria="o.photoOpacityAria" min="0" max="1" step=".05" value=".65"></label><button data-view="free" data-i18n="o.freeView"></button></div><span id="sky-label"></span></div><div class="scene-top"><div><div class="eyebrow">HELIOCENTRIC / AU</div><h2 id="target-name"></h2><span id="target-sub" data-i18n="o.targetSubDefault"></span></div><div class="view-switch"><button data-view="system" class="active" data-i18n="o.viewSystem"></button><button data-view="target" data-i18n="o.viewTarget"></button><button data-view="observer" data-i18n="o.viewObserver"></button></div></div><div class="scene-foot"><div class="compass"><span>Z ↑</span><span data-i18n="o.ecliptic"></span></div><div class="scene-bottom"><span id="scene-caption"></span><span class="scene-toggles"><label><input id="sky" type="checkbox"${skyOn ? " checked" : ""}> <bdi data-i18n="o.sky"></bdi></label><label><input id="low" type="checkbox"> <bdi data-i18n="o.low"></bdi></label></span></div><div class="scale-note"><bdi data-i18n="o.scale"></bdi><span id="sky-credit" hidden data-i18n="o.skyCredit"></span></div></div></section>
 <aside class="compare"><div class="eyebrow">THROUGH SPHEREX</div><div class="panel-title"><h2 data-i18n="o.momentTitle"></h2><span class="badge">REAL IMAGE</span></div><p class="panel-desc" data-i18n="o.momentDesc"></p><div class="image-wrap"><canvas id="image" data-i18n-aria="o.imageAria"></canvas><span class="image-corner">SPHEREx / IRSA</span></div><p id="image-status" role="status"></p><label class="trail-toggle"><input id="show-trail" type="checkbox" checked> <bdi data-i18n="o.showTrail"></bdi></label><div class="trail-legend"><span data-i18n="o.legendPrev"></span><span data-i18n="o.legendNow"></span><span data-i18n="o.legendNext"></span></div><p id="trail-note"></p><div class="compare-modes"><button data-composite="photo" data-i18n="o.compPhoto"></button><button data-composite="model" data-i18n="o.compModel"></button><button data-composite="blend" class="active" data-i18n="o.compBlend"></button></div><div class="overlay-control"><label for="overlay" data-i18n="o.overlay"></label><input id="overlay" type="range" min="0" max="1" step=".05" value=".65"></div><div class="legend"><span class="prediction" data-i18n="o.legendModel"></span></div><button id="sequence-play"></button><p id="sequence-note"></p><div id="obs-detail"></div><details class="availability"><summary data-i18n="o.availability"></summary><div id="availability"></div></details><label class="obs-label" for="observation" data-i18n="o.pickExposure"></label><select id="observation"></select><div class="step-buttons"><button id="prev" data-i18n="o.prev"></button><button id="next" data-i18n="o.next"></button></div><a id="source" target="_blank" rel="noopener noreferrer" data-i18n="o.source"></a><p class="science-note"></p></aside></main>
 <footer><div class="transport"><button id="play">▶</button><div><span class="eyebrow">SIMULATION TIME · UTC</span><strong id="clock"></strong></div><select id="speed" data-i18n-aria="o.speed"><option value="1" data-i18n="o.speed1"></option><option value="10" selected data-i18n="o.speed10"></option><option value="30" data-i18n="o.speed30"></option></select></div><div class="timeline"><div class="timeline-labels"><span id="range-start">${date(manifest.start).slice(0, 10)}</span><span id="time-note"></span><span id="range-end">${date(manifest.end).slice(0, 10)}</span></div><input id="time" type="range" min="${manifest.start}" max="${manifest.end}" step=".000001"><div id="ticks"></div></div></footer><div id="toast" role="status" hidden></div>`;
  applyI18n(app);
  const el = <T extends HTMLElement>(s: string) =>
    app.querySelector<T>(s)!;
  bindText(el("#scene-caption"), freeCaption);
  bindText(el("#sequence-play"), () => t("o.seqPlay"));
  bindText(el(".science-note"), () => t("o.scienceSeq"));
  bindText(el("#time-note"), () => t("o.timeNoteDefault"));
  bindAttr(el("#time"), "aria-label", () => t("o.timeAria"));
  const scene = new SolarScene(el("#scene"), bodies),
    viewer = new ObservationViewer(el("#image"), el("#image-status"), options.dataBase);
  const clock = el("#clock"),
    slider = el<HTMLInputElement>("#time"),
    select = el<HTMLSelectElement>("#observation");

  const sequence = () => sequences.find((s) => s.objectId === selected);
  const ready = () =>
    sequence()?.frames ??
    observations.filter((o) => o.objectId === selected && o.image);
  let sequencePlaying = false,
    sequenceTimer = 0,
    sequenceGeneration = 0,
    observationGeneration = 0,
    intentGeneration = 0;
  let hasSelected = false, suspended = false, resumePlaying = false, resumeSequence = false;
  function transportState() {
    const running = playing || sequencePlaying;
    el("#play").textContent = running ? "Ⅱ" : "▶";
    bindAttr(el("#play"), "aria-label", () => t(running ? "o.pause" : "o.play"));
  }
  function stopSequence() {
    if (sequencePlaying) {
      ++observationGeneration;
      viewer.cancelPending();
      select.value = String(
        Math.max(
          0,
          ready().findIndex((o) => o.id === observation?.id),
        ),
      );
      if (mode === "observer") slider.value = select.value;
    }
    sequencePlaying = false;
    ++sequenceGeneration;
    clearTimeout(sequenceTimer);
    bindText(el("#sequence-play"), () => t("o.seqPlay"));
    transportState();
  }
  async function toggleSequence() {
    if (sequencePlaying) {
      stopSequence();
      return;
    }
    if (!sequence()) return;
    setPlaying(false);
    const entering = mode !== "observer";
    if (entering) setView("observer");
    sequencePlaying = true;
    const generation = ++sequenceGeneration;
    bindText(el("#sequence-play"), () => t("o.seqStop"));
    transportState();
    const advance = async () => {
      if (generation !== sequenceGeneration || document.hidden) return;
      await showObservation((Number(select.value) + 1) % ready().length);
      if (generation === sequenceGeneration)
        sequenceTimer = window.setTimeout(advance, 750);
    };
    sequenceTimer = window.setTimeout(
      advance,
      entering || scene.metrics().flying ? 1300 : 750,
    );
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSequence();
  }, {signal:lifecycle.signal});
  function setPlaying(v: boolean) {
    if (v) {
      ++intentGeneration;
      stopSequence();
    }
    playing = v;
    transportState();
    scene.setPlaying(v);
  }
  let lastClock = 0;
  let timeNoteKey = "";
  function setTime(t: number) {
    mjd = Math.max(manifest.start, Math.min(manifest.end, t));
    scene.setTime(mjd);
    slider.value = mode === "observer" ? select.value : String(mjd);
    if (performance.now() - lastClock > 100 || !playing) {
      clock.textContent = date(mjd);
      lastClock = performance.now();
    }
    const note =
      observation && Math.abs(mjd - observation.mjd) < 0.00001
        ? "o.timeMatch"
        : "o.timeNote";
    if (note !== timeNoteKey) {
      timeNoteKey = note;
      bindText(el("#time-note"), () => tr(note));
    }
  }
  function setView(v: string) {
    if (
      v === "observer" &&
      !(observation?.spacecraft && observation.image?.calibration)
    ) {
      const toast = el("#toast");
      toast.hidden = false;
      bindText(toast, () => t("o.observerNotReady"));
      return;
    }
    el("#toast").hidden = true;
    if (v !== "observer") stopSequence();
    mode = v;
    const items = ready(),
      isSky = v === "observer";
    slider.min = String(isSky ? 0 : manifest.start);
    slider.max = String(isSky ? Math.max(0, items.length - 1) : manifest.end);
    slider.step = isSky ? "1" : ".000001";
    bindAttr(slider, "aria-label", () => t(isSky ? "o.frameAria" : "o.timeAria"));
    el<HTMLSelectElement>("#speed").disabled = isSky;
    el("#range-start").textContent = date(
      isSky && items.length ? items[0].mjd : manifest.start,
    ).slice(0, isSky ? 19 : 10);
    el("#range-end").textContent = date(
      isSky && items.length ? items.at(-1)!.mjd : manifest.end,
    ).slice(0, isSky ? 19 : 10);
    el("#ticks").hidden = isSky;
    slider.value = isSky ? select.value : String(mjd);
    el(".universe").classList.toggle("observing", v === "observer");
    el("#observer-tools").hidden = v !== "observer";
    document
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-view") === v),
      );
    if (v === "observer" && observation) {
      setPlaying(false);
      setTime(observation.mjd);
    }
    scene.view(v as "system" | "target" | "observer" | "free");
    bindText(el("#scene-caption"), v === "observer" ? () => t("o.captionObserver") : freeCaption);
  }
  async function showObservation(index: number) {
    const generation = ++observationGeneration,
      intent = intentGeneration;
    setPlaying(false);
    const items = ready();
    if (!items.length) {
      viewer.clear();
      bindText(el("#trail-note"), () => t("o.noTrail"));
      observation = undefined;
      scene.setObservation(undefined);
      select.disabled = true;
      bindText(el("#obs-detail"), () => t("o.noImages"));
      el<HTMLAnchorElement>("#source").removeAttribute("href");
      return;
    }
    index = Math.max(0, Math.min(items.length - 1, index));
    const nextObservation = items[index];
    select.value = String(index);
    if (
      !(await viewer.show(nextObservation)) ||
      generation !== observationGeneration
    )
      return;
    await scene.ready();
    if (generation !== observationGeneration) return;
    observation = nextObservation;
    scene.setObservation(observation, viewer.photoCanvas, viewer.trailCanvas);
    const trail = observation.image?.trail;
    bindText(el("#trail-note"), () => trailDescription(trail));
    select.disabled = false;
    if (intent === intentGeneration) setTime(observation.mjd);
    el<HTMLButtonElement>("[data-view=observer]").disabled = !(
      observation.spacecraft && observation.image?.calibration
    );
    const skyLabel = `${date(observation.mjd)} UTC · ${index + 1} / ${items.length} · `,
      fixed = Boolean(sequence());
    bindText(el("#sky-label"), () => skyLabel + t(fixed ? "o.fixedSky" : "o.single"));
    const o = observation;
    bindHtml(el("#obs-detail"), () =>
      `<dl><dt>${t("o.dtTime")}</dt><dd>${date(o.mjd)}</dd><dt>${t("o.dtDetector")}</dt><dd>D${o.detector} / ${o.wavelength?.toFixed(2) ?? "—"} μm</dd><dt>${t("o.dtRaDec")}</dt><dd>${o.ra.toFixed(4)}° / ${o.dec.toFixed(4)}°</dd><dt>${t("o.dtQuality")}</dt><dd>${o.quality} / ${o.snr?.toFixed(1) ?? "—"}</dd><dt>${t("o.dtChi2")}</dt><dd>${o.image?.model?.chi2Reduced.toFixed(2) ?? t("o.notReady")}</dd></dl>`);
    el<HTMLAnchorElement>("#source").href = o.url;
  }
  function choose(id: string) {
    const body = initialBody(bodies, id);
    if (!body) return false;
    id = body.id;
    if (hasSelected && selected === id) return true;
    hasSelected = true;
    const resetView = mode !== "system";
    stopSequence();
    viewer.clear();
    observation = undefined;
    scene.setObservation(undefined);
    bindText(el("#obs-detail"), () => t("o.preparing"));
    bindText(el("#trail-note"), () => t("o.preparing"));
    el<HTMLAnchorElement>("#source").removeAttribute("href");
    selected = id;
    options.onTarget(id);
    scene.setSelected(id);
    if (resetView) setView("system");
    el("#target-name").textContent = body.name;
    document
      .querySelectorAll("[data-object]")
      .forEach((b) =>
        b.classList.toggle("selected", b.getAttribute("data-object") === id),
      );
    const all = observations.filter((o) => o.objectId === id);
    const counts = new Map<string, number>();
    for (const o of all) {
      const key = o.image
        ? "ready\u0000" + o.quality
        : o.availabilityReason !== undefined
          ? "reason\u0000" + o.availabilityReason
          : "missing\u0000" + o.quality;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const availability = el("#availability");
    availability.replaceChildren();
    for (const [reason, count] of counts) {
      const p = document.createElement("p");
      const [kind, value] = reason.split("\u0000");
      bindText(p, () => {
        const shown = kind === "ready" ? t("o.imageReadyQ", { q: value }) : kind === "missing" ? t("o.imageNotReadyQ", { q: value }) : statusPhrase(value);
        return t("o.rows", { reason: shown, n: count });
      });
      availability.append(p);
    }
    const items = ready();
    el<HTMLInputElement>("#show-trail").disabled = !items.length;
    el(".trail-legend").hidden = !items.length;
    el<HTMLButtonElement>("#sequence-play").disabled = !sequence();
    const seqVars = sequence() ? { n: items.length, m: Math.round((items.at(-1)!.mjd - items[0].mjd) * 1440) } : null;
    bindText(el("#sequence-note"), () => seqVars ? t("o.seqNote", seqVars) : t("o.seqNone"));
    document
      .querySelectorAll<HTMLButtonElement>("[data-composite]")
      .forEach(
        (b) => (b.disabled = b.dataset.composite !== "photo" && !sequence()),
      );
    setComposite(sequence() ? "blend" : "photo");
    el<HTMLInputElement>("#overlay").disabled = !sequence();
    el(".legend").hidden = !sequence();
    const hasSequence = Boolean(sequence());
    bindText(el(".science-note"), () => t(hasSequence ? "o.scienceSeq" : "o.scienceSingle"));
    scene.setObservationTimes(items.map((o) => o.mjd));
    el<HTMLButtonElement>("[data-view=observer]").disabled = true;
    el<HTMLButtonElement>("#prev").disabled = !items.length;
    el<HTMLButtonElement>("#next").disabled = !items.length;
    select.innerHTML = items
      .map(
        (o, i) =>
          `<option value="${i}">${date(o.mjd)} · D${o.detector}</option>`,
      )
      .join("");
    const subVars = { rows: observations.filter((o) => o.objectId === id).length, n: items.length };
    el("#target-sub").removeAttribute("data-i18n");
    bindText(el("#target-sub"), () => t(hasSequence ? "o.targetSubSeq" : "o.targetSubSingle", subVars));
    el("#ticks").innerHTML = items
      .map(
        (o, i) =>
          `<button title="${date(o.mjd)} UTC" data-tick="${i}" style="left:${((o.mjd - manifest.start) / (manifest.end - manifest.start)) * 100}%"></button>`,
      )
      .join("");
    el("#ticks")
      .querySelectorAll<HTMLElement>("[data-tick]")
      .forEach(
        (b) =>
          (bindAttr(b, "aria-label", () => t("o.tick", { i: Number(b.dataset.tick) + 1 })), b.onclick = () => {
            stopSequence();
            void showObservation(Number(b.dataset.tick));
          }),
      );
    showObservation(0);
    scene.setTime(mjd);
    return true;
  }
  function list(query = "") {
    el("#objects").innerHTML = asteroids
      .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
      .map(
        (b, i) =>
          `<button role="listitem" data-object="${b.id}" class="object ${b.id === selected ? "selected" : ""}"><span class="rock-icon rock-${i % 4}"></span><span>${b.name}<small data-count="${readyCount(b.id)}"></small></span><span class="object-arrow">↗</span></button>`,
      )
      .join("");
    el("#objects")
      .querySelectorAll<HTMLElement>("[data-object]")
      .forEach((b) => (b.onclick = () => choose(b.dataset.object!)));
    el("#objects")
      .querySelectorAll<HTMLElement>("[data-count]")
      .forEach((s) => bindText(s, () => t("o.listCount", { n: s.dataset.count! })));
  }
  function readyCount(id: string) {
    return (
      sequences.find((s) => s.objectId === id)?.frames.length ??
      observations.filter((o) => o.objectId === id && o.image).length
    );
  }
  el<HTMLInputElement>("#search").oninput = (e) =>
    list((e.target as HTMLInputElement).value);
  el("#play").onclick = () => {
    if (mode === "observer" && sequence()) {
      void toggleSequence();
      return;
    }
    if (mjd >= manifest.end) setTime(manifest.start);
    if (mode === "observer") setView("system");
    setPlaying(!playing);
  };
  el<HTMLSelectElement>("#speed").onchange = (e) =>
    (speed = Number((e.target as HTMLSelectElement).value));
  slider.oninput = () => {
    ++intentGeneration;
    stopSequence();
    if (mode === "observer") {
      void showObservation(Number(slider.value));
      return;
    }
    setPlaying(false);
    if (mode === "observer") setView("system");
    setTime(Number(slider.value));
  };
  select.onchange = () => {
    stopSequence();
    void showObservation(Number(select.value));
  };
  el("#prev").onclick = () => {
    stopSequence();
    void showObservation(Number(select.value) - 1);
  };
  el("#next").onclick = () => {
    stopSequence();
    void showObservation(Number(select.value) + 1);
  };
  el<HTMLInputElement>("#overlay").oninput = (e) =>
    viewer.setOpacity(Number((e.target as HTMLInputElement).value));
  scene.onSky = (shown) => {
    el("#sky-credit").hidden = !shown;
    el(".universe").classList.toggle("sky-on", shown);
  };
  scene.onSkyFail = () => {
    const box = el<HTMLInputElement>("#sky"),
      label = box.closest("label");
    markSkyUnavailable(box, label);
    if (label) applyI18n(label.parentElement ?? label);
  };
  scene.setSky(skyOn);
  el<HTMLInputElement>("#sky").onchange = (e) => {
    const on = (e.target as HTMLInputElement).checked;
    try {
      localStorage.setItem(SKY_KEY, on ? "1" : "0");
    } catch {
      /* not remembered */
    }
    scene.setSky(on);
  };
  el<HTMLInputElement>("#low").onchange = (e) =>
    scene.quality((e.target as HTMLInputElement).checked);
  document
    .querySelectorAll<HTMLElement>("[data-view]")
    .forEach((b) => (b.onclick = () => setView(b.dataset.view!)));
  el<HTMLInputElement>("#photo-visible").onchange = (e) =>
    scene.setPhotoVisible((e.target as HTMLInputElement).checked);
  el<HTMLInputElement>("#photo-opacity").oninput = (e) =>
    scene.setPhotoOpacity(Number((e.target as HTMLInputElement).value));
  el("#sequence-play").onclick = () => {
    void toggleSequence();
  };
  function setComposite(value: "photo" | "model" | "blend") {
    viewer.setMode(value);
    document
      .querySelectorAll<HTMLElement>("[data-composite]")
      .forEach((c) =>
        c.classList.toggle("active", c.dataset.composite === value),
      );
  }
  document
    .querySelectorAll<HTMLElement>("[data-composite]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          setComposite(b.dataset.composite as "photo" | "model" | "blend")),
    );
  el<HTMLInputElement>("#show-trail").onchange = (e) => {
    const v = (e.target as HTMLInputElement).checked;
    viewer.setTrailVisible(v);
    scene.setTrailVisible(v);
  };
  scene.onSelect = choose;
  scene.onTick = (dt) => {
    setTime(mjd + dt * speed);
    if (mjd >= manifest.end) setPlaying(false);
  };
  scene.onError = (message) => {
    const toast = el("#toast");
    toast.hidden = false;
    bindText(toast, message);
    setPlaying(false);
  };
  list();
  setTime(manifest.start);
  choose(initial.id);
  (window as unknown as { __app: unknown }).__app = {
    metrics: () => ({
      ...scene.metrics(),
      ...viewer.metrics(),
      mjd,
      playing,
      selected,
      sequencePlaying,
      frameCount: ready().length,
    }),
    choose,
    showObservation,
    setView,
    setPlaying,
    debugSkyDim: (value: number, black?: number, soften?: number) => scene.debugSkyDim(value, black, soften),
    debugCamera: (position: number[], target: number[]) =>
      scene.debugCamera(position, target),
  };
  return {
    choose,
    setActive(active: boolean) {
      if(!active&&!suspended){resumePlaying=playing;resumeSequence=sequencePlaying;suspended=true;stopSequence();setPlaying(false);viewer.cancelPending();}
      scene.setActive(active);
      if(active&&suspended){suspended=false;if(resumeSequence)void toggleSequence();else if(resumePlaying)setPlaying(true);}
    },
    dispose() { lifecycle.abort();stopSequence();scene.dispose();viewer.dispose();app.replaceChildren(); },
  };
}
