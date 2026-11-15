export const GUIDE_VERSION = '5.0';
export const PAGES = ['home', 'planetarium', 'analysis', 'asteroids'];

export function courseFor(modules, track = 'beginner', moduleId = 'all') {
  const safeTrack = track === 'research' ? 'research' : 'beginner';
  const selected = moduleId === 'all' ? modules : modules.filter((item) => item.id === moduleId);
  return selected.flatMap((module) => (module.steps[safeTrack] || []).map((step) => ({
    ...step, moduleId: module.id, moduleTitle: module.title,
  })));
}

export function validSelection(modules, track, moduleId) {
  return {
    track: track === 'research' ? 'research' : 'beginner',
    moduleId: moduleId === 'all' || modules.some((item) => item.id === moduleId) ? moduleId : 'all',
  };
}

export function nextStep(index, length, direction = 1) {
  if (!Number.isInteger(index) || !Number.isInteger(length) || length < 1) return { index: 0, complete: false };
  if (direction > 0 && index >= length - 1) return { index: length - 1, complete: true };
  return { index: Math.max(0, Math.min(length - 1, index + (direction < 0 ? -1 : 1))), complete: false };
}

export function shouldAutoOpen({ embedded, handoff = false }) {
  // A fresh portal visit always offers the guide, even if an earlier visit was skipped.
  return !embedded && !handoff;
}

export function storageKey(appRoot) {
  const url = new URL(appRoot);
  return `sky-lab:tutorial:${GUIDE_VERSION}:${url.origin}${url.pathname}`;
}

/** Never accept selectors, arbitrary URLs, or an unvalidated course position from storage. */
export function readHandoff(raw, modules, page, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== GUIDE_VERSION || !PAGES.includes(page)) return null;
    const mode = value.mode ?? 'practice';
    if (value.page !== page && !(mode === 'lesson' && value.page === '*')) return null;
    if (!Number.isFinite(value.createdAt) || now - value.createdAt < 0 || now - value.createdAt > 30 * 60 * 1000) return null;
    const valid = validSelection(modules, value.track, value.moduleId);
    if (valid.track !== value.track || valid.moduleId !== value.moduleId) return null;
    const steps = courseFor(modules, valid.track, valid.moduleId);
    if (!Number.isInteger(value.index) || value.index < 0 || value.index >= steps.length) return null;
    if (!['practice', 'continue', 'lesson'].includes(mode)) return null;
    if (mode !== 'lesson' && !steps[value.index].practice) return null;
    if (mode === 'practice' && steps[value.index].practice.page !== page) return null;
    return { ...valid, index: value.index, page, mode };
  } catch { return null; }
}

/** A real practice link may continue only on one of this deployment's three pages. */
export function pageForUrl(appRoot, destination) {
  try {
    const root = new URL(appRoot);
    const url = new URL(destination, root);
    if (url.origin !== root.origin || url.username || url.password) return null;
    if (url.pathname === root.pathname || url.pathname === root.pathname + 'index.html') {
      const route = url.hash.slice(1).split('?')[0] || 'home';
      if (PAGES.includes(route)) return route;
      if (route === 'moving') return 'asteroids';
      return null;
    }
    const routes = { planetarium: 'planetarium/', analysis: 'analysis/', asteroids: 'asteroids/' };
    return Object.entries(routes).find(([, route]) => {
      const path = new URL(route, root).pathname;
      return url.pathname === path || url.pathname === path + 'index.html' || (path !== root.pathname && url.pathname === path.slice(0, -1));
    })?.[0] ?? null;
  } catch { return null; }
}

/** Frames share session storage: a closed child must not delete its parent's continuation. */
export function ownsHandoff(raw, owner) {
  if(typeof owner!=='string' || !owner)return false;
  try {return JSON.parse(raw)?.owner===owner;} catch {return false;}
}
