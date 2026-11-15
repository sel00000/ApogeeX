/** Home page labs: how SPHEREx gathers 102 colours, one patch of sky in all of them, and a blink.
 *
 * Real data only:
 *  - assets/spectrum/rw_aur/  101 real SPHEREx exposures of one 8′ field, one per channel, one common
 *    stretch (scripts/build_home_spectrum.py). The scan drawing on the left is a labelled schematic.
 *  - assets/blink/vesta/      three real SPHEREx exposures of 4 Vesta on one grid + MOST predictions
 *    (copied from sel00000/Apogee, see SOURCE.md).
 * Every animation runs only while its section is on screen, and stops for prefers-reduced-motion.
 */
import { getLang, onLangChange } from './i18n.js';
// short bilingual strings drawn on canvases; page text uses the portal dictionaries (i18n/en.js, ko.js)
const T = (ko, en) => (getLang() === 'ko' ? ko : en);
const onLang = onLangChange;
const BANDS = [[0.75, 1.09], [1.10, 1.62], [1.63, 2.42], [2.42, 3.82], [3.83, 4.42], [4.42, 5.00]];
const GOLD = '#f2cf6b', ACCENT = '#e9c48f', INK = '#06080c';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function fit(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}
const loadImage = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; });
const fmtUtc = iso => iso.replace('T', ' ').slice(0, 16) + ' UTC';

/** Run `tick(now)` on rAF only while `el` is visible and `isOn()` says so. */
function visibleLoop(el, tick, isOn, cleanups) {
  let raf = 0, visible = false;
  const loop = t => { raf = 0; if (!visible || !isOn()) return; tick(t); raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf && visible && isOn()) raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { rootMargin: '10% 0px' });
  io.observe(el); cleanups.push(() => { io.disconnect(); cancelAnimationFrame(raf); });
  return kick;
}

export function mountHomeLab(root, { reducedMotion } = {}) {
  const motion = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); cleanups.push(() => t.removeEventListener(type, fn, o)); };
  const spectrum = Promise.all([fetch('assets/spectrum/rw_aur/meta.json').then(r => { if (!r.ok) throw Error(r.status); return r.json(); }), loadImage('assets/spectrum/rw_aur/frames.png')]);
  const lvf = root.querySelector('#lvf'), view = root.querySelector('#spec-view'), blink = root.querySelector('#blink-demo');
  if (lvf) spectrum.then(([meta, sprite]) => mountScan(lvf, meta, sprite)).catch(e => fail(lvf, e));
  if (view) spectrum.then(([meta, sprite]) => mountSpectrum(view, meta, sprite)).catch(e => fail(view, e));
  if (blink) Promise.all([fetch('assets/blink/vesta/vesta.json').then(r => r.json()), ...[0, 1, 2].map(i => loadImage(`assets/blink/vesta/vesta_0${i}.png`))])
    .then(([meta, ...imgs]) => mountBlink(blink, meta, imgs)).catch(e => fail(blink, e));

  function fail(el, e) {
    console.warn('[home-lab]', e);
    const p = document.createElement('p'); p.className = 'lab-fail'; p.textContent = T('관측 자료를 불러오지 못했어요. 새로고침해 보세요.', 'Could not load the observations. Please reload.');
    el.prepend(p);
  }

  // ------------------------------------------------------------------ 1. one exposure, many exposures, one picture
  function mountScan(el, meta, sprite) {
    const sky = el.querySelector('.lvf-sky'), overlay = el.querySelector('.lvf-overlay'), cube = el.querySelector('.lvf-cube-canvas');
    const count = el.querySelector('[data-count]'), rows = el.querySelector('.lvf-rows');
    const shots = [...el.querySelectorAll('[data-shot]')], ums = [...el.querySelectorAll('[data-um]')];
    const n = meta.tile_px, byKey = new Map(meta.channels.map(c => [`${c.det}-${c.ch}`, c]));
    rows.innerHTML = BANDS.map((_, i) => `<span>D${i + 1}</span>`).join('');
    let combined = null, scene3d = null, loading = false;
    loadImage('assets/spectrum/rw_aur/combined.png').then(i => { combined = i; }).catch(() => {});
    const ONE = 2600, STEP = 150, MANY = 50 * STEP, MERGE = 1400, HOLD = 2800, END = ONE + MANY + MERGE + HOLD;
    let t0 = performance.now(), still = motion.matches, paused = motion.matches, heldT = END - 1, hover = -1, scrubAt = 0, overlayKey = '';
    let resumeTimer = 0;
    const timeNow = now => paused ? heldT : (now - t0) % END;
    const timeOfStep = q => q === 0 ? ONE * 0.85 : ONE + (q - 1) * STEP + STEP * 0.8;
    const setPaused = v => {
      if (v && !paused) heldT = timeNow(performance.now());
      if (!v && paused) t0 = performance.now() - heldT;
      paused = v; kick();
    };
    function stateAt(t) {
      if (t < ONE) { // ① one exposure: the whole footprint is captured at once
        const fl = clamp((t - 700) / 900, 0, 1);
        return { phase: 1, step: 0, prev: 0, k: 1, flashAll: true, flash: fl > 0 && fl < 1 ? Math.sin(fl * Math.PI) : 0, upto: 0, fade: 1, done: t > 1100 ? 1 : 0, merge: 0 };
      }
      if (t < ONE + MANY) { // ② step by step: the same spot crosses one strip per exposure
        const q = (t - ONE) / STEP, i = Math.floor(q), f = q - i;
        return { phase: 2, step: i + 1, prev: i, k: ease(clamp(f / 0.5, 0, 1)), flashAll: false, flash: f >= 0.5 ? 1 - (f - 0.5) / 0.5 : 0, upto: i + 1, fade: 1, done: i + 1 + (f >= 0.5 ? 1 : 0), merge: 0 };
      }
      const m = clamp((t - ONE - MANY) / MERGE, 0, 1); // ③ merge
      return { phase: 3, step: 50, prev: 50, k: 1, flashAll: false, flash: 0, upto: 51, fade: 1 - m, done: 51, merge: m };
    }
    function draw(now) {
      if (settling > 0) settling--;
      const tt = timeNow(now), st = stateAt(tt);
      if (scene3d) scene3d.draw({ step: st.step, prev: st.prev, k: +st.k.toFixed(3), flash: +st.flash.toFixed(3), flashAll: st.flashAll, upto: st.upto, fade: +st.fade.toFixed(3) });
      drawOverlay(st);
      drawCube(st.done, st.phase === 1 ? 0 : st.phase === 2 ? (st.step + (st.flash > 0 ? 1 - st.flash : 1)) : 99);
      let got = 0; for (let q = 0; q < st.done; q++) { const c = Math.floor(q / 17) + 1, j = (q % 17) + 1; got += byKey.has(`${c}-${j}`) + byKey.has(`${c + 3}-${j}`); }
      count.textContent = String(got);
      const cur = hover >= 0 ? hover : Math.max(0, st.done - 1), c = Math.floor(cur / 17), j = cur % 17;
      [[c + 1, j + 1], [c + 4, j + 1]].forEach(([d, ch], k) => {
        const x = shots[k].getContext('2d'), info = byKey.get(`${d}-${ch}`); x.imageSmoothingEnabled = false; x.clearRect(0, 0, n, n);
        if (info && (st.done > 0 || hover >= 0)) x.drawImage(sprite, (ch - 1) * n, (d - 1) * n, n, n, 0, 0, n, n);
        ums[k].textContent = st.done === 0 && hover < 0 ? `D${d}` : info ? `D${d} · ${info.um.toFixed(2)} µm` : `D${d} · ${T('이 기간 촬영 없음', 'not observed in this pass')}`;
      });
    }
    function drawOverlay(st) {
      const tc = scene3d ? scene3d.project() : null;
      const key = [st.phase, st.step, st.merge.toFixed(3), tc ? tc.map(p => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(';') : '', overlay.clientWidth, document.documentElement.lang].join('|');
      if (key === overlayKey) return; overlayKey = key;
      const { ctx, w, h } = fit(overlay);
      ctx.clearRect(0, 0, w, h);
      if (!tc) return;
      const tx = Math.max(...tc.map(p => p.x)), ty = Math.min(...tc.map(p => p.y));
      if (st.merge === 0) return;
      // the merged picture pops out of the gold square, joined by dotted leaders (like a zoom-out)
      const m = ease(st.merge), S = h * 0.46 * m, x = 28, y = h - 28 - S;
      if (S < 2) return;
      const box = [[x, y], [x + S, y], [x + S, y + S], [x, y + S]];
      ctx.globalAlpha = Math.min(1, st.merge * 1.6);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(242,207,107,.7)'; ctx.lineWidth = 1;
      [[0, 0], [1, 1], [2, 2], [3, 3]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(tc[a].x, tc[a].y); ctx.lineTo(box[b][0], box[b][1]); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.fillStyle = '#05070a'; ctx.fillRect(x, y, S, S);
      if (combined) { ctx.imageSmoothingEnabled = false; ctx.drawImage(combined, x, y, S, S); }
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.strokeRect(x + .5, y + .5, S - 1, S - 1);
      ctx.globalAlpha = 1;
    }
    function drawCube(done, p) {
      const g = 3, T = (cube.getBoundingClientRect().width - 16 * g) / 17, H = 6 * T + 5 * g;
      if (Math.abs(cube.getBoundingClientRect().height - H) > 0.5) { cube.style.height = H + 'px'; rows.style.height = H + 'px'; }
      const { ctx, w, h } = fit(cube);
      ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
      for (let det = 1; det <= 6; det++) for (let ch = 1; ch <= 17; ch++) {
        const x = (ch - 1) * (T + g), y = (det - 1) * (T + g), step = (det - 1) % 3 * 17 + (ch - 1);
        ctx.fillStyle = '#0d1219'; ctx.fillRect(x, y, T, T);
        if (step < done || step === hover) {
          if (byKey.has(`${det}-${ch}`)) ctx.drawImage(sprite, (ch - 1) * n, (det - 1) * n, n, n, x, y, T, T);
          if (step === hover) { ctx.strokeStyle = '#f4f2ee'; ctx.lineWidth = 1.5; ctx.strokeRect(x + .75, y + .75, T - 1.5, T - 1.5); continue; }
          const age = p - step - 1;
          if (age < 3) { ctx.strokeStyle = `rgba(242,207,107,${(1 - age / 3) * .9})`; ctx.lineWidth = 1.5; ctx.strokeRect(x + .75, y + .75, T - 1.5, T - 1.5); }
        } else { ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, T - 1, T - 1); }
      }
    }
    // the 3D scene (Three.js shared with the mission model) loads when the section is about a screen away
    const pre = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || loading) return; loading = true; pre.disconnect();
      import('./assets/model/sky-scan.js').then(mod => {
        scene3d = mod.mountSkyScan(sky, { skyUrl: 'assets/blackhole/sky_spherex_full.webp', craftUrl: 'assets/model/spherex-lite.glb', starsUrl: 'assets/sky/stars-v7.bin' });
        scene3d.ready.then(() => { scene3d.invalidate(); draw(performance.now()); });
        cleanups.push(() => scene3d.dispose());
        draw(performance.now());
      }).catch(e => console.warn('[home-lab] sky scan', e));
    }, { rootMargin: '250% 0px' });
    pre.observe(el); cleanups.push(() => pre.disconnect());
    const kick = visibleLoop(el, draw, () => !paused || dragging || settling > 0, cleanups);
    // ---- interaction: play / pause, scrub, drag the sky, hover and click the grid
    let dragging = false, settling = 0, lx = 0, ly = 0;
    on(sky, 'pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; sky.setPointerCapture(e.pointerId); kick(); });
    on(sky, 'pointermove', e => { if (!dragging || !scene3d) return; scene3d.look(-(e.clientX - lx) * 0.0035, (e.clientY - ly) * 0.0035); lx = e.clientX; ly = e.clientY; });
    const end = () => { if (!dragging) return; dragging = false; scene3d?.release(); settling = 60; kick(); };
    on(sky, 'pointerup', end); on(sky, 'pointercancel', end);
    const tileAt = e => {
      const r = cube.getBoundingClientRect(), g = 3, T = (r.width - 16 * g) / 17;
      const ch = Math.floor((e.clientX - r.left) / (T + g)), det = Math.floor((e.clientY - r.top) / (T + g));
      return ch >= 0 && ch < 17 && det >= 0 && det < 6 ? (det % 3) * 17 + ch : -1;
    };
    on(cube, 'pointermove', e => { const q = tileAt(e); if (q !== hover) { hover = q; draw(performance.now()); } });
    on(cube, 'pointerleave', () => { hover = -1; draw(performance.now()); });
    on(cube, 'click', e => {
      const q = tileAt(e); if (q < 0 || still) return;
      heldT = timeOfStep(q); paused = true; draw(performance.now());
      clearTimeout(resumeTimer); resumeTimer = setTimeout(() => setPaused(false), 2600);
    });
    cleanups.push(() => clearTimeout(resumeTimer));
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting && !paused) t0 = performance.now(); }, { threshold: 0.3 });
    seen.observe(el); cleanups.push(() => seen.disconnect());
    const ro = new ResizeObserver(() => { scene3d?.invalidate(); draw(performance.now()); }); ro.observe(el); cleanups.push(() => ro.disconnect());
    cleanups.push(onLang(() => draw(performance.now())));
    draw(performance.now());
  }

  // ------------------------------------------------------------------ 2. one patch, every colour
  function mountSpectrum(el, meta, sprite) {
    const frame = el.querySelector('.spec-frame-canvas'), chart = el.querySelector('.spec-chart-canvas'), range = el.querySelector('.spec-range');
    const um = el.querySelector('[data-um]'), flux = el.querySelector('[data-flux]');
    const n = meta.tile_px, ch = [...meta.channels].sort((a, b) => a.um - b.um);
    const fmax = Math.max(...ch.map(c => c.flux_mjy ?? 0)) * 1.1;
    frame.width = frame.height = n;
    range.max = String(ch.length - 1);
    let i = 0, playing = !motion.matches, last = 0, idleUntil = 0;
    const X = (w, v) => 34 + (v - 0.7) / (5.05 - 0.7) * (w - 46);
    const Y = (h, v) => h - 24 - (v / fmax) * (h - 40);
    function show(k) {
      i = (k + ch.length) % ch.length; const c = ch[i];
      const fx = frame.getContext('2d'); fx.clearRect(0, 0, n, n); fx.imageSmoothingEnabled = false;
      fx.drawImage(sprite, (c.ch - 1) * n, (c.det - 1) * n, n, n, 0, 0, n, n);
      um.textContent = `${c.um.toFixed(3)} µm`;
      flux.textContent = c.flux_mjy != null ? `${Math.round(c.flux_mjy).toLocaleString('ko-KR')} ± ${Math.max(1, Math.round(c.err_mjy))} mJy` : (c.flux_note || T('측정 없음', 'no measurement'));
      range.value = String(i);
      drawChart();
    }
    // wavelength order shown with the visible rainbow (violet = 0.75 µm … red = 5 µm); infrared itself has no colour
    const spec = um => { const u = clamp(Math.log(um / 0.75) / Math.log(5 / 0.75), 0, 1); return `hsl(${Math.round(268 - 268 * u)} 85% 62%)`; };
    function drawChart() {
      const { ctx, w, h } = fit(chart);
      ctx.clearRect(0, 0, w, h);
      const base = h - 24;
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(111,120,132,1)'; ctx.font = '11px -apple-system, sans-serif'; ctx.textBaseline = 'top';
      for (const v of [0.75, 2, 3, 4, 5]) { const x = X(w, v); ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, base); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(`${v} µm`, x, h - 14); } ctx.textAlign = 'left';
      ctx.textBaseline = 'middle'; ctx.fillText('mJy', 2, 14);
      // the spectrum band along the axis, and the area under the measured points in the same colours
      const grad = ctx.createLinearGradient(X(w, 0.75), 0, X(w, 5), 0);
      for (let k = 0; k <= 24; k++) { const um = 0.75 * Math.pow(5 / 0.75, k / 24); grad.addColorStop((um - 0.75) / (5 - 0.75), spec(um)); }
      ctx.fillStyle = grad; ctx.fillRect(X(w, 0.75), base + 1, X(w, 5) - X(w, 0.75), 5);
      const pts = ch.filter(c => c.flux_mjy != null);
      ctx.save(); ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.moveTo(X(w, pts[0].um), base);
      pts.forEach(c => ctx.lineTo(X(w, c.um), Y(h, c.flux_mjy))); ctx.lineTo(X(w, pts.at(-1).um), base); ctx.closePath(); ctx.fill(); ctx.restore();
      for (let d = 1; d <= 6; d++) {
        const seg = pts.filter(c => c.det === d);
        ctx.strokeStyle = 'rgba(244,242,238,.28)'; ctx.lineWidth = 1.2; ctx.beginPath();
        seg.forEach((c, j) => { const x = X(w, c.um), y = Y(h, c.flux_mjy); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      }
      for (const [j, c] of ch.entries()) {
        if (c.flux_mjy == null) continue;
        ctx.globalAlpha = j <= i ? 1 : 0.4; ctx.fillStyle = spec(c.um);
        ctx.beginPath(); ctx.arc(X(w, c.um), Y(h, c.flux_mjy), 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const c = ch[i], x = X(w, c.um);
      ctx.strokeStyle = 'rgba(244,242,238,.45)'; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, base); ctx.stroke();
      if (c.flux_mjy != null) { ctx.fillStyle = spec(c.um); ctx.beginPath(); ctx.arc(x, Y(h, c.flux_mjy), 5.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f4f2ee'; ctx.lineWidth = 2; ctx.stroke(); }
      frame.style.setProperty('--spec', spec(c.um));
    }
    const pickAt = e => {
      const r = chart.getBoundingClientRect(), v = 0.7 + (e.clientX - r.left - 34) / (r.width - 46) * (5.05 - 0.7);
      let best = 0; ch.forEach((c, j) => { if (Math.abs(c.um - v) < Math.abs(ch[best].um - v)) best = j; });
      idleUntil = performance.now() + 5000; show(best);
    };
    on(chart, 'pointermove', pickAt); on(chart, 'pointerdown', pickAt);
    on(range, 'input', () => { idleUntil = performance.now() + 5000; show(+range.value); });
    const kick = visibleLoop(el, now => { if (now < idleUntil || now - last < 140) return; last = now; show(i + 1); }, () => playing, cleanups);
    const ro = new ResizeObserver(drawChart); ro.observe(chart); cleanups.push(() => ro.disconnect());
    cleanups.push(onLang(() => show(i)));
    show(0);
  }

  // ------------------------------------------------------------------ 3. blink: 4 Vesta, always running, fast
  function mountBlink(el, meta, imgs) {
    const canvas = el.querySelector('.blink-canvas'), list = el.querySelector('.blink-frames');
    const frames = meta.frames, t0 = frames[0].mjd_mid, MS = 300;
    let i = 0, last = 0, held = false, items = [];
    const renderText = () => {
    list.innerHTML = frames.map((f, k) => `<li data-k="${k}"><b>${fmtUtc(f.date_utc)}</b><span>${k ? T(`+${((f.mjd_mid - t0) * 24).toFixed(1)}시간`, `+${((f.mjd_mid - t0) * 24).toFixed(1)} h`) : T('첫 촬영', 'first')}</span></li>`).join('');
    items = [...list.children];
    el.querySelector('[data-blink-move]').textContent = T(`약 ${sep.toFixed(0)}′ (보름달 지름의 ${(sep / 31).toFixed(1)}배)`, `About ${sep.toFixed(0)}′ (${(sep / 31).toFixed(1)} × the full Moon)`);
    };
    const a = frames[0], b = frames.at(-1), d2r = Math.PI / 180;
    const sep = Math.acos(Math.sin(a.predicted_dec * d2r) * Math.sin(b.predicted_dec * d2r) + Math.cos(a.predicted_dec * d2r) * Math.cos(b.predicted_dec * d2r) * Math.cos((a.predicted_ra - b.predicted_ra) * d2r)) / d2r * 60;
    renderText();
    const ctx = canvas.getContext('2d');
    function draw() {
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 384, 384); ctx.drawImage(imgs[i], 0, 0);
      const pts = frames.map(f => [f.marker_x + .5, f.marker_y + .5]), RR = 11;
      // path between the predicted positions, trimmed at the rings, with an arrow for the direction of travel
      ctx.strokeStyle = 'rgba(244,242,238,.55)'; ctx.lineWidth = 1;
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
        ctx.beginPath(); ctx.moveTo(x0 + ux * (RR + 3), y0 + uy * (RR + 3)); ctx.lineTo(x1 - ux * (RR + 3), y1 - uy * (RR + 3)); ctx.stroke();
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, a = Math.atan2(uy, ux);
        ctx.beginPath(); ctx.moveTo(mx + 6 * Math.cos(a), my + 6 * Math.sin(a)); ctx.lineTo(mx + 6 * Math.cos(a + 2.5), my + 6 * Math.sin(a + 2.5)); ctx.lineTo(mx + 6 * Math.cos(a - 2.5), my + 6 * Math.sin(a - 2.5)); ctx.closePath();
        ctx.fillStyle = 'rgba(244,242,238,.8)'; ctx.fill();
      }
      const label = (txt, [x, y], below) => {
        ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = below ? 'top' : 'bottom';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,7,10,.85)'; ctx.strokeText(txt, x, below ? y + RR + 5 : y - RR - 5);
        ctx.fillStyle = 'rgba(244,242,238,.95)'; ctx.fillText(txt, x, below ? y + RR + 5 : y - RR - 5); ctx.textAlign = 'left';
      };
      ctx.strokeStyle = 'rgba(244,242,238,.75)'; ctx.lineWidth = 1.2;
      for (const p of [pts[0], pts.at(-1)]) { ctx.beginPath(); ctx.arc(p[0], p[1], RR, 0, Math.PI * 2); ctx.stroke(); }
      const f = frames[i]; ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.marker_x + .5, f.marker_y + .5, RR + 3, 0, Math.PI * 2); ctx.stroke();
      items.forEach((li, k) => li.toggleAttribute('data-on', k === i));
    }
    const kick = visibleLoop(el, now => { if (now - last < MS) return; last = now; i = (i + 1) % frames.length; draw(); }, () => !motion.matches && !held, cleanups);
    // interaction: move across the picture to blink by hand (left = first, right = last); leave to let it run.
    // Hover a time to hold that exposure.
    const hold = k => { held = true; if (k !== i) { i = k; draw(); } };
    const letGo = () => { held = false; kick(); };
    on(canvas, 'pointermove', e => { const r = canvas.getBoundingClientRect(); hold(clamp(Math.floor((e.clientX - r.left) / r.width * frames.length), 0, frames.length - 1)); });
    on(canvas, 'pointerleave', letGo);
    on(list, 'pointerover', e => { const li = e.target.closest('[data-k]'); if (li) hold(+li.dataset.k); });
    on(list, 'pointerleave', letGo);
    on(list, 'click', e => { const li = e.target.closest('[data-k]'); if (li) hold(+li.dataset.k); });
    cleanups.push(onLang(() => { renderText(); draw(); }));
    draw();
  }

  return () => cleanups.forEach(f => f());
}
