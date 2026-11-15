// 축소되는 SVG(viewBox) 안의 글씨가 실제 화면에서 16px 아래로 내려가지 않게 보정한다.
const MIN = 16
let queued = false
function apply() {
  queued = false
  for (const t of document.querySelectorAll<SVGTextElement>('svg text')) {
    const base = t.dataset.baseFs ? +t.dataset.baseFs : (t.style.fontSize = '', parseFloat(getComputedStyle(t).fontSize))
    if (!t.dataset.baseFs) t.dataset.baseFs = String(base)
    const m = t.getScreenCTM(); if (!m) continue
    const k = Math.hypot(m.a, m.b) || 1
    const want = Math.max(base, MIN / k)
    const v = `${want.toFixed(2)}px`
    if (t.style.fontSize !== v) t.style.fontSize = v
  }
}
function schedule() { if (!queued) { queued = true; requestAnimationFrame(apply) } }
export function installSvgTextFloor() {
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, characterData: true })
  addEventListener('resize', schedule)
  schedule()
}
