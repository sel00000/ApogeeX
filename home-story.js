/** Scroll story for the home page.
 * One passive scroll listener feeds one rAF; each scene only runs while it is near the viewport
 * and writes a single CSS custom property (or a class) per frame. Nothing runs while idle.
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// SPHEREx detector bands (µm). Each of the 6 detectors records 17 colours: 6 × 17 = 102.
export const SPHEREX_BANDS = [[0.75, 1.11], [1.11, 1.64], [1.64, 2.42], [2.42, 3.82], [3.82, 4.42], [4.42, 5.0]];
export function spherexChannels() {
  const out = [];
  SPHEREX_BANDS.forEach(([lo, hi], band) => {
    for (let k = 0; k < 17; k++) out.push({ band, w: lo * Math.pow(hi / lo, (k + 0.5) / 17) });
  });
  return out;
}

import { t, onLangChange } from './i18n.js';

// Caption keys for the three infrared layers (texts in i18n/en.js and i18n/ko.js).
const SKY_CAPTIONS = { stars: 'sky.cap.stars', dust: 'sky.cap.dust', all: 'sky.cap.all' };

export function mountHomeStory(root, { reducedMotion, loadModel } = {}) {
  const motion = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [];
  const cleanups = [];
  let raf = 0;
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  function scene(el, update, { margin = '20% 0px' } = {}) {
    const s = { el, update, active: false, last: -1 };
    const io = new IntersectionObserver(([e]) => { s.active = e.isIntersecting; if (s.active) schedule(); }, { rootMargin: margin });
    io.observe(el); cleanups.push(() => io.disconnect());
    scenes.push(s);
    return s;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    const vh = innerHeight;
    for (const s of scenes) {
      if (!s.active) continue;
      const r = s.el.getBoundingClientRect();
      s.update(r, vh);
    }
  }
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', schedule, { passive: true });

  // ---- hero: title and cards ease back as the page leaves the black hole
  const hero = root.querySelector('#home-hero');
  if (hero) scene(hero, (r, vh) => {
    const p = clamp(-r.top / (r.height * 0.75));
    if (Math.abs(p - (hero._p ?? -1)) < 0.001) return;
    hero._p = p; hero.style.setProperty('--hero-out', motion.matches ? '0' : p.toFixed(4));
  }, { margin: '0px' });

  // ---- statement: words brighten one by one while it crosses the viewport
  const statement = root.querySelector('[data-words]');
  if (statement) {
    // The words are rebuilt when the language changes; --p (the scroll progress) is kept.
    const fill = text => {
      const words = text.trim().split(/\s+/);
      statement.setAttribute('aria-label', text.trim());
      statement.textContent = '';
      words.forEach((w, i) => {
        const span = document.createElement('span'); span.className = 'w'; span.style.setProperty('--i', i); span.textContent = w;
        span.setAttribute('aria-hidden', 'true');
        statement.append(span, document.createTextNode(i < words.length - 1 ? ' ' : ''));
      });
      statement.style.setProperty('--n', words.length);
    };
    const key = statement.dataset.i18nKey;
    fill(key ? t(key) : statement.textContent);
    if (key) cleanups.push(onLangChange(() => fill(t(key))));
    scene(statement, (r, vh) => {
      const p = motion.matches ? 1 : clamp((vh * 0.9 - r.top) / (vh * 0.62));
      statement.style.setProperty('--p', p.toFixed(4));
    });
  }

  // ---- mission: sticky 3D story in four steps
  const track = root.querySelector('#mission-track');
  if (track) {
    const stage = track.querySelector('.mission-stage');
    const steps = [...track.querySelectorAll('.m-step')];
    const modelStage = track.querySelector('#model-stage');
    let model = null, loading = false, step = -1, lastP = -1;
    const setStep = n => {
      if (n === step) return; step = n; stage.dataset.step = String(n);
      steps.forEach((el, i) => { el.classList.toggle('on', i === n); el.classList.toggle('past', i < n); el.setAttribute('aria-hidden', String(i !== n)); });
    };
    setStep(0);
    const ensureModel = () => {
      if (model || loading || !loadModel) return;
      loading = true;
      loadModel(modelStage).then(m => { model = m; if (lastP >= 0) model?.setProgress(lastP, step); }).catch(() => {});
    };
    // start downloading the model one screen before the story begins
    const pre = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ensureModel(); pre.disconnect(); } }, { rootMargin: '120% 0px' });
    pre.observe(track); cleanups.push(() => pre.disconnect());
    scene(track, r => {
      const span = Math.max(1, r.height - innerHeight);
      const p = clamp(-r.top / span);
      setStep(p < 0.24 ? 0 : p < 0.5 ? 1 : p < 0.74 ? 2 : 3);
      if (Math.abs(p - lastP) < 0.0005) return;
      lastP = p;
      model?.setProgress(motion.matches ? Math.round(p * 3) / 3 : p, step);
      modelStage.dispatchEvent(new Event('model-progress'));
    }, { margin: '10% 0px' });
  }

  // ---- light: 102 colours light up from 0.75 µm to 5 µm
  const lightTrack = root.querySelector('#light-track');
  if (lightTrack) {
    const ticks = lightTrack.querySelector('#spec-ticks');
    const stageEl = lightTrack.querySelector('.light-stage');
    const count = lightTrack.querySelector('#spec-count');
    const spectrum = lightTrack.querySelector('#spectrum');
    const frag = document.createDocumentFragment();
    spherexChannels().forEach((c, i) => {
      const t = document.createElement('i');
      t.style.cssText = `--w:${c.w.toFixed(4)};--i:${i};--h:${(70 + 10 * Math.sin(i * 0.9) + c.band * 7).toFixed(0)}px`;
      frag.append(t);
    });
    SPHEREX_BANDS.forEach(([a, b]) => { const g = document.createElement('b'); g.style.cssText = `--a:${a};--b:${b}`; frag.append(g); });
    ticks.append(frag);
    let shown = -1;
    scene(lightTrack, r => {
      const span = Math.max(1, r.height - innerHeight);
      const p = motion.matches ? 1 : clamp((-r.top / span - 0.08) / 0.62);
      const lit = p * 108;
      stageEl.style.setProperty('--lit', lit.toFixed(2));
      const n = Math.min(102, Math.round(p * 102));
      if (n !== shown) { shown = n; count.textContent = String(n); }
      spectrum.classList.toggle('is-done', p >= 0.98);
    }, { margin: '10% 0px' });
  }

  // ---- sky: visible ↔ infrared comparison
  const compare = root.querySelector('#sky-compare');
  if (compare) {
    const range = compare.querySelector('#sky-range');
    const caption = root.querySelector('#sky-caption');
    const segs = [...root.querySelectorAll('.sky-controls [data-layer]')];
    const layers = [...compare.querySelectorAll('.sky-ir img')];
    let touched = false;
    const setPos = v => {
      compare.style.setProperty('--pos', v + '%');
      compare.dataset.side = v < 18 ? 'ir' : v > 82 ? 'vis' : '';
    };
    const pick = name => {
      for (const img of layers) {
        const on = img.dataset.layer === name;
        if (on && img.dataset.src) { img.srcset = img.dataset.srcset; img.src = img.dataset.src; delete img.dataset.src; }
        img.classList.toggle('on', on);
      }
      segs.forEach(b => b.setAttribute('aria-checked', String(b.dataset.layer === name)));
      caption.textContent = t(SKY_CAPTIONS[name]);
    };
    pick('stars');
    cleanups.push(onLangChange(() => { const on = segs.find(b => b.getAttribute('aria-checked') === 'true'); caption.textContent = t(SKY_CAPTIONS[on?.dataset.layer || 'stars']); }));
    // warm the other two layers once the section is close, so switching is instant
    const warm = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; warm.disconnect();
      const idle = window.requestIdleCallback || (f => setTimeout(f, 400));
      idle(() => layers.forEach(img => { if (img.dataset.src) { const pre = new Image(); pre.srcset = img.dataset.srcset; pre.sizes = img.sizes; pre.src = img.dataset.src; } }));
    }, { rootMargin: '60% 0px' });
    warm.observe(compare); cleanups.push(() => warm.disconnect());
    segs.forEach(b => listen(b, 'click', () => pick(b.dataset.layer)));
    listen(compare.parentElement.querySelector('.seg'), 'keydown', e => {
      const i = segs.findIndex(b => b.getAttribute('aria-checked') === 'true');
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); const next = segs[(i + d + segs.length) % segs.length]; pick(next.dataset.layer); next.focus();
    });
    listen(range, 'input', () => { touched = true; setPos(+range.value); });
    listen(range, 'pointerdown', () => { touched = true; compare.classList.add('dragging'); });
    listen(window, 'pointerup', () => compare.classList.remove('dragging'));
    // until someone grabs the handle, scrolling sweeps it once from visible to infrared and back to the middle
    scene(compare, (r, vh) => {
      if (touched || motion.matches) return;
      const p = clamp((vh - r.top) / (vh + r.height * 0.4));
      const v = p < 0.5 ? 86 - p * 2 * 66 : 20 + (p - 0.5) * 2 * 30;
      range.value = v.toFixed(1); setPos(v);
    });
    setPos(50);
  }

  schedule();
  return () => { cancelAnimationFrame(raf); cleanups.forEach(f => f()); };
}
