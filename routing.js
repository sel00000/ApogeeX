/** The shell owns navigation. Child paths are deployment-relative, never source paths. */
/** [kicker, English title]; the title in the chosen language comes from VIEW_TITLES / viewTitle(). */
export const VIEWS = Object.freeze({
  home: ['SPHEREx FOR EVERYONE', 'SPHEREx for Everyone'],
  planetarium: ['EXPLORE THE SKY', 'Planetarium'],
  analysis: ['READ THE OBSERVATIONS', 'SPHEREx Analysis'],
  asteroids: ['FOLLOW THE MOVEMENT', 'Asteroid Analysis'],
});
export const VIEW_TITLES = Object.freeze({
  en: Object.freeze({ home: 'SPHEREx for Everyone', planetarium: 'Planetarium', analysis: 'SPHEREx Analysis', asteroids: 'Asteroid Analysis', suffix: 'SPHEREx for Everyone', homeTitle: 'SPHEREx for Everyone' }),
  ko: Object.freeze({ home: '모두를 위한 SPHEREx', planetarium: '플라네타리움', analysis: 'SPHEREx 분석', asteroids: '소행성 분석', suffix: '모두를 위한 SPHEREx', homeTitle: '모두를 위한 SPHEREx · SPHEREx for Everyone' }),
});
export function viewTitle(view, lang = 'en') {
  const table = VIEW_TITLES[lang === 'ko' ? 'ko' : 'en'];
  return Object.hasOwn(VIEWS, view) ? table[view] : table.home;
}
/** document.title: the home page keeps the page's own title, other views read "<view> · <site>". */
export function documentTitle(view, lang = 'en') {
  const table = VIEW_TITLES[lang === 'ko' ? 'ko' : 'en'];
  return !Object.hasOwn(VIEWS, view) || view === 'home' ? table.homeTitle : `${table[view]} · ${table.suffix}`;
}
/** Errors carry an i18n key so the shell can show them in the chosen language; the message stays English. */
function keyedError(key, message) { const e = new TypeError(message); e.i18nKey = key; return e; }
export const HOME_ANCHORS = new Set(['mission', 'light', 'spectrum', 'blink', 'sky']);

export function parseRoute(hash = '') {
  const raw = String(hash).replace(/^#/, '').slice(0, 8192);
  const split = raw.indexOf('?');
  const name = (split < 0 ? raw : raw.slice(0, split)) || 'home';
  const params = new URLSearchParams(split < 0 ? '' : raw.slice(split + 1));
  params.delete('embed');
  if (name === 'moving') {
    if (!params.has('tab')) params.set('tab', 'observations');
    return { view: 'asteroids', params, anchor: null };
  }
  if (HOME_ANCHORS.has(name)) return { view: 'home', params: new URLSearchParams(), anchor: name };
  return { view: Object.hasOwn(VIEWS, name) ? name : 'home', params, anchor: null };
}

export function routeHash(view, values = {}) {
  if (!Object.hasOwn(VIEWS, view)) throw new TypeError('Unknown application view.');
  const params = values instanceof URLSearchParams ? new URLSearchParams(values) : new URLSearchParams();
  if (!(values instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(values || {})) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
  }
  params.delete('embed');
  return `#${view}${params.size ? '?' + params : ''}`;
}

/**
 * Which header item (its data-view) is current. The sky stage of the analysis app belongs to
 * "천구 관찰"; the planetarium is its second view, so it is current there too.
 */
export function headerCurrent(view, params) {
  const values = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
  if (view === 'planetarium') return 'planetarium';
  if (view === 'analysis') return values.get('view') === 'sky' ? 'planetarium' : 'analysis';
  return Object.hasOwn(VIEWS, view) ? view : null;
}

/** The stage message for a header click: only the two analysis-backed items have one. */
export function headerStage(dataView) {
  return dataView === 'planetarium' ? 'sky' : dataView === 'analysis' ? 'workbench' : null;
}

/** Address for "SPHEREx 천구" in the planetarium row; the sky centre is added only when the state has it.
 * Accepts state.center = { ra, dec, fov } (degrees, ICRS) first, then the older query / top-level fields. */
export function skyReturnHash(state) {
  const base = '#analysis?view=sky';
  if (!state || typeof state !== 'object') return base;
  const c = state.center;
  if (c && typeof c === 'object') {
    const num = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN);
    const ra = num(c.ra), dec = num(c.dec), fov = num(c.fov);
    if ([ra, dec, fov].every(Number.isFinite) && Math.abs(dec) <= 90 && fov > 0 && fov <= 360) return `${base}&sky=${((ra % 360) + 360) % 360},${dec},${fov}`;
  }
  const q = typeof state.query === 'string' ? new URLSearchParams(state.query) : new URLSearchParams(state.query && typeof state.query === 'object' ? state.query : '');
  const read = key => {
    const raw = q.get(key) ?? state[key];
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return NaN;
    return Number(raw);
  };
  const ra = read('ra'), dec = read('dec'), fov = read('fov');
  if (![ra, dec, fov].every(Number.isFinite) || Math.abs(dec) > 90 || !(fov > 0 && fov <= 360)) return base;
  const wrapped = ((ra % 360) + 360) % 360;
  return `${base}&sky=${wrapped},${dec},${fov}`;
}

export function analysisParams(target) {
  if (!target || typeof target !== 'object') throw keyedError('err.noTarget', 'Choose an object to analyse.');
  const params = new URLSearchParams();
  const prepared = target.preparedTargetId ?? target.target;
  if (typeof prepared === 'string' && /^[a-z0-9_-]{1,64}$/.test(prepared)) params.set('target', prepared);
  else {
    const ra = target.raDeg ?? target.ra, dec = target.decDeg ?? target.dec;
    if (typeof ra !== 'number' || typeof dec !== 'number' || !Number.isFinite(ra) || !Number.isFinite(dec) || Math.abs(dec) > 90) {
      throw keyedError('err.needCoords', 'A valid right ascension and declination are needed. Choose moving objects in Asteroid Analysis.');
    }
    // Apparent solar-system coordinates must not masquerade as an ICRS field.
    if (target.frame && !['ICRS', 'ASTROM'].includes(target.frame)) {
      throw keyedError('err.apparent', 'The apparent position of a moving object cannot be used directly for a fixed-coordinate analysis. Select an area on the sky with the ‘SPHEREx data analysis’ button.');
    }
    params.set('ra', String(ra >= 0 && ra < 360 ? ra : ((ra % 360) + 360) % 360));
    params.set('dec', String(dec));
  }
  const label = target.name ?? target.label;
  if (typeof label === 'string') params.set('label', label.slice(0, 160));
  if (['motion', 'variable', 'spectrum', 'provenance'].includes(target.tab)) params.set('tab', target.tab);
  for (const key of ['frame', 'coordinateEpoch', 'timeScale', 'observer']) {
    if (typeof target[key] === 'string' && target[key].length <= 80) params.set(key, target[key]);
  }
  for (const key of ['epoch', 'predictionMjd', 'observationMjd']) {
    if (Number.isFinite(target[key])) params.set(key, String(target[key]));
  }
  const fov = target.fovDeg ?? (Number.isFinite(target.fovArcsec) ? target.fovArcsec / 3600 : undefined);
  if (Number.isFinite(fov) && fov > 0 && fov <= 180) params.set('fov', String(fov));
  if (target.moving) params.set('moving', '1');
  return params;
}

export function childURL(view, params, base) {
  if (!['analysis', 'asteroids', 'planetarium'].includes(view)) throw new TypeError('Unknown child application.');
  const url = new URL(`${view}/`, base);
  for (const [key, value] of params) if (key !== 'embed') url.searchParams.set(key, value);
  url.searchParams.set('embed', '1');
  if (view === 'analysis' && !url.searchParams.has('target') && !url.searchParams.has('ra') && !url.searchParams.has('q')) url.searchParams.set('target', 'barnard');
  return url;
}

export function trustedFrameMessage(event, frame, expectedOrigin) {
  return !!frame?.contentWindow && event.source === frame.contentWindow && event.origin === expectedOrigin &&
    !!event.data && typeof event.data === 'object';
}

// Focus after a switch between the two sky views (review X2 item 2).
// source: 'sky-nav' (a press in #sky-navigation) or 'child-navigate' (spherex-navigate from a child frame);
// ordinary navigation (header menu, links) passes nothing and keeps today's focus behaviour.
export function skyViewFocus(source, view) {
 if (view === 'planetarium' && (source === 'child-navigate' || source === 'sky-nav')) return 'sky-navigation';
 if (view === 'analysis' && source === 'sky-nav') return 'analysis-sky-mode';
 return null;
}
