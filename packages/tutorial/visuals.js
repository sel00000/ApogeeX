// Small, self-contained teaching diagrams. All plotted measurements are invented examples.
import { getLang, normalizeLang } from './i18n.js';
import { TEXT } from './visuals.text.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
let nextId = 0;

export function frequencyTHz(wavelengthMicron) {
  if (!Number.isFinite(wavelengthMicron) || wavelengthMicron <= 0) return NaN;
  return 299.792458 / wavelengthMicron;
}

export function syntheticFlux(wavelengthMicron) {
  const x = wavelengthMicron;
  return 10 + 40 * Math.exp(-((x - 1.2) ** 2) / 0.12)
    + 30 * Math.exp(-((x - 4.2) ** 2) / 0.5)
    - 5 * Math.exp(-((x - 2.4) ** 2) / 0.03);
}

export function uncertaintyExample(count) {
  const n = Math.max(1, Math.min(100, Math.round(Number(count) || 1)));
  const independent = 1 / Math.sqrt(n);
  const shared = 0.3;
  return { n, flux: 10, independent, shared, total: Math.hypot(independent, shared) };
}

export function normalizeRA(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/** Keep labels at their normal CSS size when a narrow card scales down its SVG. */
export function diagramLabelScale(bounds) {
  const scale = Math.min(bounds.width / 440, bounds.height / 172);
  return scale > 0 && Number.isFinite(scale) ? Math.max(1, 1 / scale) : 1;
}

/** Default SVG xMidYMid meet geometry, used when a browser cannot provide an SVG CTM. */
export function fitViewBoxPoint(clientX, clientY, bounds, width = 440, height = 172) {
  const scale = Math.min(bounds.width / width, bounds.height / height);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  return {
    x: (clientX - bounds.left - (bounds.width - width * scale) / 2) / scale,
    y: (clientY - bounds.top - (bounds.height - height * scale) / 2) / scale,
  };
}

export function clientToDiagramPoint(svg, clientX, clientY) {
  try {
    const matrix = svg.getScreenCTM?.();
    if (matrix && svg.createSVGPoint) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      if (Number.isFinite(local.x) && Number.isFinite(local.y)) return { x: local.x, y: local.y };
    }
  } catch { /* Hidden or detached SVGs may have no invertible transform. */ }
  return fitViewBoxPoint(clientX, clientY, svg.getBoundingClientRect());
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function svgNode(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
}

function addSvg(parent, tag, attrs, text) {
  const el = svgNode(tag, attrs, text);
  parent.append(el);
  return el;
}

function scaffold(container, title, description, lang = 'en') {
  const root = node('section', 'sv-visual');
  root.setAttribute('aria-label', title);
  const heading = node('div', 'sv-visual-heading');
  heading.append(node('span', 'sv-label', TEXT[lang].explore), node('strong', '', title));
  root.append(heading);
  const svg = svgNode('svg', { class: 'sv-diagram', viewBox: '0 0 440 172', role: 'img', 'aria-label': description });
  const graphic = svgNode('g');
  svg.append(graphic);
  root.append(svg);
  const caption = node('p', 'sv-caption');
  caption.id = `sv-caption-${++nextId}`;
  svg.setAttribute('aria-describedby', caption.id);
  root.append(caption);
  const controls = node('div', 'sv-controls');
  const output = node('output', 'sv-readout');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-atomic', 'true');
  const note = node('p', 'sv-note');
  root.append(controls, output, note);
  container.replaceChildren(root);
  const events = [];
  const resizeLabels = (bounds) => svg.style.setProperty('--sv-label-scale', String(diagramLabelScale(bounds)));
  resizeLabels(svg.getBoundingClientRect());
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) if (entry.target === svg) resizeLabels(entry.contentRect);
    });
    observer.observe(svg);
    events.push(() => observer.disconnect());
  }
  function on(el, event, callback) {
    el.addEventListener(event, callback);
    events.push(() => el.removeEventListener(event, callback));
  }
  return { root, svg, graphic, caption, controls, output, note, on,
    destroy() { events.forEach((off) => off()); if (root.parentNode === container) root.remove(); } };
}

function range(ctx, label, { min, max, step = 1, value }) {
  const id = `sv-input-${++nextId}`;
  const wrap = node('div', 'sv-range');
  const name = node('label', '', label);
  name.htmlFor = id;
  const input = node('input');
  Object.assign(input, { id, type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  wrap.append(name, input);
  ctx.controls.append(wrap);
  return input;
}

function button(ctx, text, callback) {
  const el = node('button', 'sv-button', text);
  el.type = 'button';
  ctx.on(el, 'click', callback);
  ctx.controls.append(el);
  return el;
}

function label(g, x, y, text, className = 'sv-text', anchor = 'start') {
  return addSvg(g, 'text', { x, y, class: className, 'text-anchor': anchor }, text);
}

function hatch(svg) {
  const id = `sv-hatch-${++nextId}`;
  const defs = addSvg(svg, 'defs');
  const pattern = addSvg(defs, 'pattern', { id, width: 7, height: 7, patternUnits: 'userSpaceOnUse' });
  addSvg(pattern, 'rect', { width: 7, height: 7, fill: '#182b3a' });
  addSvg(pattern, 'path', { d: 'M-2 2 L2 -2 M0 7 L7 0 M5 9 L9 5', stroke: '#a7b7c9', 'stroke-width': 1.5 });
  return `url(#${id})`;
}

function wavelength(container, options) {
  const t = TEXT[options.lang].wavelength;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const slider = range(ctx, t.slider, { min: 75, max: 500, value: 120 });
  const update = () => {
    const lambda = Number(slider.value) / 100;
    const g = ctx.graphic;
    g.replaceChildren();
    addSvg(g, 'line', { x1: 22, y1: 92, x2: 418, y2: 92, class: 'sv-grid' });
    const spacing = lambda * 46;
    const start = 31;
    let path = '';
    for (let x = 22; x <= 418; x += 2) {
      const y = 92 - 31 * Math.cos((x - start) * Math.PI * 2 / spacing);
      path += `${x === 22 ? 'M' : 'L'}${x},${y.toFixed(2)} `;
    }
    addSvg(g, 'path', { d: path, class: 'sv-wave' });
    addSvg(g, 'line', { x1: start, y1: 41, x2: start + spacing, y2: 41, class: 'sv-wavelength-mark' });
    for (const x of [start, start + spacing]) addSvg(g, 'line', { x1: x, y1: 35, x2: x, y2: 50, class: 'sv-wavelength-mark' });
    label(g, 220, 28, `λ = ${lambda.toFixed(2)} µm`, 'sv-gold-text', 'middle');
    label(g, 22, 151, t.short, 'sv-muted-text');
    label(g, 418, 151, t.long, 'sv-muted-text', 'end');
    slider.setAttribute('aria-valuetext', t.valuetext(lambda.toFixed(2)));
    ctx.output.textContent = options.track === 'research'
      ? t.research(lambda.toFixed(2), frequencyTHz(lambda).toFixed(2))
      : t.simple(lambda.toFixed(2));
    ctx.svg.setAttribute('aria-label', t.svgLabel(lambda.toFixed(2)));
  };
  ctx.on(slider, 'input', update);
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

function spectrum(container, options) {
  const t = TEXT[options.lang].spectrum;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const slider = range(ctx, t.slider, { min: 75, max: 500, value: 120 });
  const sx = (lambda) => 48 + (lambda - 0.75) / 4.25 * 366;
  const sy = (flux) => 140 - flux / 65 * 105;
  const update = () => {
    const lambda = Number(slider.value) / 100;
    const flux = syntheticFlux(lambda);
    const g = ctx.graphic;
    g.replaceChildren();
    for (const f of [0, 20, 40, 60]) {
      addSvg(g, 'line', { x1: 48, y1: sy(f), x2: 414, y2: sy(f), class: 'sv-grid' });
      label(g, 39, sy(f) + 4, String(f), 'sv-muted-text', 'end');
    }
    for (const x of [1, 2, 3, 4, 5]) label(g, sx(x), 156, String(x), 'sv-muted-text', 'middle');
    label(g, 48, 19, 'Fν (mJy)', 'sv-text');
    let path = '';
    for (let i = 0; i <= 160; i++) {
      const x = 0.75 + 4.25 * i / 160;
      path += `${i ? 'L' : 'M'}${sx(x).toFixed(2)},${sy(syntheticFlux(x)).toFixed(2)} `;
    }
    addSvg(g, 'path', { d: path, class: 'sv-spectrum' });
    addSvg(g, 'line', { x1: sx(lambda), y1: 28, x2: sx(lambda), y2: 140, class: 'sv-cursor' });
    addSvg(g, 'circle', { cx: sx(lambda), cy: sy(flux), r: 5, class: 'sv-selected' });
    slider.setAttribute('aria-valuetext', t.valuetext(lambda.toFixed(2), flux.toFixed(1)));
    ctx.output.textContent = t.readout(lambda.toFixed(2), flux.toFixed(1));
  };
  ctx.on(slider, 'input', update);
  ctx.on(ctx.svg, 'click', (event) => {
    const point = clientToDiagramPoint(ctx.svg, event.clientX, event.clientY);
    if (!point || point.x < 48 || point.x > 414 || point.y < 28 || point.y > 140) return;
    const { x } = point;
    slider.value = String(Math.round(Math.max(0.75, Math.min(5, 0.75 + (x - 48) / 366 * 4.25)) * 100));
    update();
  });
  ctx.caption.textContent = t.caption;
  ctx.note.textContent = options.track === 'research' ? t.researchNote : t.note;
  update();
  return ctx.destroy;
}

function sky(container, options) {
  const t = TEXT[options.lang].sky;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const slider = range(ctx, t.slider, { min: 0, max: 359, value: 120 });
  const update = () => {
    const ra = normalizeRA(Number(slider.value));
    const g = ctx.graphic;
    g.replaceChildren();
    const left = 50, right = 410, top = 27, bottom = 139;
    for (let i = 0; i <= 4; i++) {
      const x = left + (right - left) * i / 4;
      const y = top + (bottom - top) * i / 4;
      addSvg(g, 'line', { x1: x, y1: top, x2: x, y2: bottom, class: 'sv-grid' });
      addSvg(g, 'line', { x1: left, y1: y, x2: right, y2: y, class: 'sv-grid' });
    }
    label(g, left, 17, t.decTop, 'sv-muted-text');
    label(g, left, 157, '−90°', 'sv-muted-text');
    label(g, right, 157, t.raZero, 'sv-muted-text', 'end');
    label(g, 220, 157, t.raIncrease, 'sv-text', 'middle');
    const x = right - ra;
    const y = top + (90 - 30) / 180 * (bottom - top);
    addSvg(g, 'line', { x1: x, y1: top, x2: x, y2: bottom, class: 'sv-cursor' });
    addSvg(g, 'line', { x1: left, y1: y, x2: right, y2: y, class: 'sv-cursor' });
    addSvg(g, 'circle', { cx: x, cy: y, r: 7, class: 'sv-selected' });
    label(g, 410, 17, t.decFixed, 'sv-gold-text', 'end');
    slider.setAttribute('aria-valuetext', t.valuetext(ra));
    ctx.output.textContent = options.track === 'research'
      ? t.research(ra, (ra / 15).toFixed(2))
      : t.simple(ra);
  };
  ctx.on(slider, 'input', update);
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

function region(container, options) {
  const t = TEXT[options.lang].region;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const wrap = node('label', 'sv-select');
  wrap.append(node('span', '', t.select));
  const select = node('select');
  for (const value of [2, 3, 5, 10]) {
    const option = node('option', '', `${value}′`);
    option.value = String(value);
    select.append(option);
  }
  select.value = '3';
  wrap.append(select);
  ctx.controls.append(wrap);
  const update = () => {
    const minutes = Number(select.value);
    const g = ctx.graphic;
    g.replaceChildren();
    const stars = [[61,35],[91,126],[120,62],[158,111],[187,37],[220,86],[265,44],[280,126],[316,76],[369,38],[385,130]];
    for (let i = 0; i < stars.length; i++) addSvg(g, 'circle', { cx: stars[i][0], cy: stars[i][1], r: i === 5 ? 4.5 : 1.8, class: i === 5 ? 'sv-selected' : 'sv-star' });
    const size = minutes * 11.8;
    addSvg(g, 'rect', { x: 220 - size / 2, y: 86 - size / 2, width: size, height: size, rx: 2, class: 'sv-region' });
    addSvg(g, 'line', { x1: 208, y1: 86, x2: 232, y2: 86, class: 'sv-cursor' });
    addSvg(g, 'line', { x1: 220, y1: 74, x2: 220, y2: 98, class: 'sv-cursor' });
    label(g, 220, 17, `${minutes}′ × ${minutes}′`, 'sv-gold-text', 'middle');
    label(g, 220, 165, t.centre, 'sv-text', 'middle');
    ctx.output.textContent = t.readout(minutes, (minutes / 60).toFixed(3));
  };
  ctx.on(select, 'change', update);
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

function timeline(container, options) {
  const t = TEXT[options.lang].timeline;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const pattern = hatch(ctx.svg);
  let mismatch = false;
  const toggle = button(ctx, t.mismatchOn, () => { mismatch = !mismatch; update(); });
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    for (const [x, name, wave, value] of [[16,t.a,'1.20 µm','10.0'],[168,t.b,mismatch?'2.20 µm':'1.20 µm','12.0']]) {
      addSvg(g, 'rect', { x, y: 25, width: 122, height: 102, rx: 10, class: 'sv-panel' });
      label(g, x + 61, 48, name, 'sv-text', 'middle');
      label(g, x + 61, 72, wave, 'sv-gold-text', 'middle');
      label(g, x + 61, 105, `${value} mJy`, 'sv-big-text', 'middle');
    }
    label(g, 151, 84, '→', 'sv-text', 'middle');
    label(g, 311, 84, '→', 'sv-text', 'middle');
    addSvg(g, 'rect', { x: 330, y: 25, width: 94, height: 102, rx: 10, class: mismatch ? 'sv-result-mask' : 'sv-result', ...(mismatch ? { fill: pattern } : {}) });
    label(g, 377, 63, mismatch ? t.held : t.difference, 'sv-text', 'middle');
    label(g, 377, 96, mismatch ? '—' : '+2.0', 'sv-big-text', 'middle');
    toggle.textContent = mismatch ? t.mismatchOff : t.mismatchOn;
    toggle.setAttribute('aria-pressed', String(mismatch));
    ctx.output.textContent = mismatch ? t.mismatchReadout : t.matchReadout;
  };
  ctx.caption.textContent = t.caption;
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

function mask(container, options) {
  const t = TEXT[options.lang].mask;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const pattern = hatch(ctx.svg);
  let reasons = true;
  const toggle = button(ctx, t.hide, () => { reasons = !reasons; update(); });
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 9; col++) {
      const invalid = (col < 2 && row < 2) || (col === 6 && row >= 1) || (col >= 7 && row === 3);
      const distance = Math.hypot(row - 1.5, col - 4);
      addSvg(g, 'rect', { x: 20 + col * 23, y: 29 + row * 27, width: 22, height: 26,
        fill: invalid ? pattern : `hsl(191 30% ${Math.max(12, 73 - distance * 18)}%)` });
    }
    label(g, 255, 43, reasons ? t.reasonsTitle : t.legendTitle, 'sv-gold-text');
    for (const [i, text] of (reasons ? t.reasons : t.legend).entries()) label(g, 255, 70 + i * 26, text, 'sv-text');
    label(g, 20, 157, t.pixels, 'sv-muted-text');
    toggle.textContent = reasons ? t.hide : t.show;
    toggle.setAttribute('aria-pressed', String(reasons));
    ctx.output.textContent = reasons ? t.reasonsReadout : t.legendReadout;
  };
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

function uncertainty(container, options) {
  const t = TEXT[options.lang].uncertainty;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const slider = range(ctx, t.slider, { min: 1, max: 25, value: 1 });
  const update = () => {
    const v = uncertaintyExample(slider.value);
    const g = ctx.graphic;
    g.replaceChildren();
    const sx = (flux) => 230 + (flux - 10) * 125;
    for (const flux of [9, 9.5, 10, 10.5, 11]) {
      addSvg(g, 'line', { x1: sx(flux), y1: 33, x2: sx(flux), y2: 130, class: 'sv-grid' });
      label(g, sx(flux), 149, String(flux), 'sv-muted-text', 'middle');
    }
    for (const [y, error, name, css] of [[60,v.independent,'①','sv-stat-error'],[108,v.total,'②','sv-total-error']]) {
      addSvg(g, 'line', { x1: sx(10 - error), y1: y, x2: sx(10 + error), y2: y, class: css });
      for (const x of [sx(10 - error),sx(10 + error)]) addSvg(g, 'line', { x1: x, y1: y - 7, x2: x, y2: y + 7, class: css });
      addSvg(g, 'circle', { cx: sx(10), cy: y, r: 4, class: 'sv-selected' });
      label(g, 18, y + 4, name, 'sv-text');
    }
    label(g, 230, 167, t.axis, 'sv-muted-text', 'middle');
    ctx.output.textContent = t.readout(v.n, v.independent.toFixed(2), v.total.toFixed(2));
    slider.setAttribute('aria-valuetext', t.valuetext(v.n));
  };
  ctx.caption.textContent = t.caption;
  ctx.on(slider, 'input', update);
  ctx.note.textContent = options.track === 'research' ? t.researchNote : t.note;
  update();
  return ctx.destroy;
}

function provenance(container, options) {
  const t = TEXT[options.lang].provenance;
  const ctx = scaffold(container, t.title, t.description, options.lang);
  const { names, simple, research } = t;
  let active = 0;
  // Long box words (English 'Measurement') need a slightly smaller size to stay inside the 91-unit boxes at phone width.
  const boxClass = t.boxes.some((box) => box.split('\n').some((line) => line.length > 9)) ? 'sv-text sv-box-text' : 'sv-text';
  const buttons = names.map((name, i) => button(ctx, `${i + 1}. ${name}`, () => { active = i; update(); }));
  ctx.controls.classList.add('sv-stages');
  const update = () => {
    const g = ctx.graphic;
    g.replaceChildren();
    names.forEach((name, i) => {
      const x = 10 + i * 110;
      addSvg(g, 'rect', { x, y: 48, width: 91, height: 69, rx: 12, class: i === active ? 'sv-stage-active' : 'sv-panel' });
      label(g, x + 45.5, 73, `0${i + 1}`, i === active ? 'sv-gold-text' : 'sv-muted-text', 'middle');
      const lines = t.boxes[i].split('\n');
      lines.forEach((line, n) => label(g, x + 45.5, lines.length === 1 ? 98 : 93 + n * 15, line, boxClass, 'middle'));
      if (i < 3) label(g, x + 100, 88, '→', 'sv-muted-text', 'middle');
      buttons[i].setAttribute('aria-pressed', String(active === i));
    });
    label(g, 220, 151, t.footer, 'sv-gold-text', 'middle');
    ctx.output.textContent = (options.track === 'research' ? research : simple)[active];
  };
  ctx.note.textContent = t.note;
  update();
  return ctx.destroy;
}

const visualizers = { sky, region, timeline, wavelength, spectrum, mask, uncertainty, provenance };

/** Mount one accessible teaching diagram. No network requests or real session state changes. */
export function mountVisual(container, kind, options = {}) {
  if (!container || typeof container.replaceChildren !== 'function') return () => {};
  const render = Object.hasOwn(visualizers, kind) ? visualizers[kind] : null;
  if (!render) { container.replaceChildren(); return () => {}; }
  return render(container, { track: options.track === 'research' ? 'research' : 'beginner', step: options.step, lang: normalizeLang(options.lang ?? getLang()) });
}

const CONTROL_SELECTOR = '.sv-controls input[type="range"], .sv-controls [aria-pressed]';
/** Remember each diagram control (slider value, pressed state) so a language re-render can put them back. */
export function captureControls(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  return [...root.querySelectorAll(CONTROL_SELECTOR)].map(el => el.type === 'range'
    ? { value: String(el.value) } : { pressed: el.getAttribute('aria-pressed') });
}
/** Re-apply captured control values to a freshly mounted diagram of the same step; a changed layout is ignored. */
export function restoreControls(root, saved) {
  if (!root || !Array.isArray(saved) || !saved.length || typeof root.querySelectorAll !== 'function') return;
  const els = [...root.querySelectorAll(CONTROL_SELECTOR)];
  if (els.length !== saved.length) return;
  els.forEach((el, i) => {
    if ('value' in saved[i]) {
      if (String(el.value) !== saved[i].value) { el.value = saved[i].value; el.dispatchEvent(new Event('input')); }
    }
  });
  // Pressed first, then the rest, re-checking each: a button group ends on the remembered button.
  for (const wantPressed of [true, false]) els.forEach((el, i) => {
    const want = saved[i].pressed;
    if (want == null || (want === 'true') !== wantPressed) return;
    if (el.getAttribute('aria-pressed') !== want) el.click();
  });
}
