import { t } from './i18n.js';
// Original BLACKHOLE_BG/index.html waveform display, connected to GravityHero's
// real quadrupole history. This draws only on the renderer's stage callback.
export function mountHomeWaveform(panel) {
  const canvas = panel.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const stage = panel.querySelector('[data-stage]');
  const note = panel.querySelector('[data-note]');
  const value = panel.querySelector('[data-value]');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 276 * dpr;
  canvas.height = 56 * dpr;
  let shown = false, hideTimer = 0, lastDraw = 0, norm = 1e-9, lastSlot = null, disposed = false;
  function draw(slot) {
    const W = canvas.width, H = canvas.height, n = 180, HIST = slot.buf.length / 2;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const k = (((slot.head - i) % HIST) + HIST) % HIST;
      peak = Math.max(peak, Math.abs(slot.buf[2 * k]), Math.abs(slot.buf[2 * k + 1]));
    }
    norm = Math.max(peak, norm * 0.985);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(238,242,248,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    for (const [off, color] of [[0, '#9cd4ff'], [1, 'rgba(200,166,255,0.85)']]) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.4 * dpr; ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const back = n - 1 - i;
        if (back > slot.head) continue;
        const k = (((slot.head - back) % HIST) + HIST) % HIST;
        const y = H / 2 - slot.buf[2 * k + off] / (norm * 1.08) * (H / 2 - 3);
        const x = i / (n - 1) * W;
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        started = true;
      }
      ctx.stroke();
    }
  }
  return {
    update(info) {
      if (disposed) return;
      const now = performance.now();
      if (!info) {
        if (shown && lastSlot && now - lastDraw > 66) { draw(lastSlot); lastDraw = now; }
        if (shown && !hideTimer) hideTimer = setTimeout(() => {
          panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true');
          shown = false; hideTimer = 0;
        }, 1200);
        return;
      }
      clearTimeout(hideTimer); hideTimer = 0;
      if (!shown) { shown = true; norm = 1e-9; panel.classList.add('on'); panel.setAttribute('aria-hidden', 'false'); }
      lastSlot = info.slot;
      if (now - lastDraw < 66) return;
      lastDraw = now; stage.className = info.stage;
      let text = '', number = '';
      if (info.stage === 'inspiral') {
        stage.textContent = 'INSPIRAL';
        text = t(info.gas ? 'wave.inspiral.gas' : 'wave.inspiral');
        number = t('wave.sep', { r: info.rM.toFixed(1) });
      } else if (info.stage === 'plunge') {
        stage.textContent = 'EOB PLUNGE'; text = t('wave.plunge'); number = `${info.rM.toFixed(1)} M`;
      } else if (info.stage === 'merger') {
        stage.textContent = 'MERGER'; text = t('wave.merger');
      } else {
        stage.textContent = 'RINGDOWN';
        text = info.ev ? t('wave.ring', { m: (info.ev.Mf / info.ev.M).toFixed(3) }) : t('wave.ring0');
        number = info.ev ? t('wave.spin', { a: info.ev.af.toFixed(2) }) : '';
      }
      note.textContent = text; note.title = text; value.textContent = number;
      draw(info.slot);
    },
    dispose() { disposed = true; clearTimeout(hideTimer); panel.classList.remove('on'); }
  };
}
