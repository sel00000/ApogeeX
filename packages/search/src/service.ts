import { createSkySearch, type SkySearch, type SkyIndexData } from './core/search';
import { validateIndexData } from './core/index';
import { parseCoords } from './core/intent';
import { federatedSearch, type FedItem } from './core/federate';
import { SearchError, tagged, asLang, t, type Lang } from './i18n';
import { makeAskClient, makeQuaeroResolver, makeSimbadRunner } from './core/remote';

export interface SearchSelection {
  kind: 'sky' | 'asteroid' | 'solar-system';
  id?: string;
  name: string;
  displayName?: string;
  raDeg?: number;
  decDeg?: number;
  frame?: 'ICRS';
  coordinateEpoch?: 'J2000';
  source: string;
  moving?: boolean;
  objectType?: string;
  preparedTargetId?: string;
  viaModel?: boolean;
}
export interface ChoiceText { label: string; detail: string }
/** `label` and `detail` are in the service language; `texts` holds both so a screen can switch in place. */
export interface SearchChoice { label: string; detail: string; selection: SearchSelection; texts: Record<Lang, ChoiceText> }
/** A message that can be produced in either language. */
export type Describe = (lang: Lang) => string;
interface Body { id: string; name: string; kind: 'planet' | 'asteroid' }
export interface SearchOptions {
  indexUrl?: string;
  bodyIndexUrl?: string;
  askUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Language of the texts the service returns itself (default English). A function is read on every call. */
  lang?: Lang | (() => Lang);
}
const PREPARED = new Map([
  ["NAME Barnard's star", 'barnard'], ['* eps Ind B', 'eps_indi_b'],
  ['WISEA J085510.74-071442.5', 'wise0855'], ['V* RW Aur', 'rw_aur'], ['V* R Dra', 'r_dra'],
]);
const ALIASES: Record<string, [string[], string[]]> = {
  "NAME Barnard's star": [["Barnard's Star", 'Barnard Star'], ['바너드별', '바너드 별']],
  '* eps Ind B': [['Epsilon Indi B'], ['엡실론 인디 B', '엡실론 인디 비']],
  'WISEA J085510.74-071442.5': [['WISE 0855-0714', 'WISE0855'], ['와이즈 0855']],
  'V* RW Aur': [['RW Aurigae'], ['마차부자리 RW']],
  'V* R Dra': [['R Draconis'], ['용자리 R']],
};
const PLANET_NAMES: Record<string, string> = {
  '수성': 'Mercury', '금성': 'Venus', '지구': 'Earth', '화성': 'Mars',
  '목성': 'Jupiter', '토성': 'Saturn', '천왕성': 'Uranus', '해왕성': 'Neptune',
  '태양': 'Sun', '달': 'Moon',
};
const BODY_KOREAN: Record<string, string[]> = {
  '433': ['에로스'], '16': ['프시케', '사이키'], '10': ['히기에이아', '히기아'],
  '216': ['클레오파트라'], '624': ['헥토르'], '221': ['에오스'],
};
const loaded = new Map<string, Promise<{engine: SkySearch; bodies: Body[]}>>();

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? tagged(new DOMException(t('en', 'cancelled'), 'AbortError'), 'cancelled');
}
const BOTH: Lang[] = ['en', 'ko'];
/** Notes of federatedSearch that only concern the ask function itself ('model: …', 'model did not understand …'). */
const MODEL_NOTE = /^model(?::| did not understand)/;
export async function boundedFetch(fetchFn: typeof fetch, url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const parent = init.signal;
  const cancel = () => controller.abort(parent?.reason);
  if (parent?.aborted) cancel(); else parent?.addEventListener('abort', cancel, {once: true});
  const timer = setTimeout(() => controller.abort(tagged(new DOMException(t('en', 'lookupTimeout'), 'TimeoutError'), 'lookupTimeout')), timeoutMs);
  try {
    // Read the response body inside the deadline too; a stalled transfer must not outlive search.
    const response = await fetchFn(url, {...init, signal: controller.signal});
    const bytes = await response.arrayBuffer();
    return new Response(bytes, {status: response.status, statusText: response.statusText, headers: response.headers});
  } finally { clearTimeout(timer); parent?.removeEventListener('abort', cancel); }
}

export function readSesamePosition(xml: string, name: string): {name: string; ra: number; dec: number} | null {
  const ra = Number(/<jradeg>\s*([^<]+)\s*<\/jradeg>/i.exec(xml)?.[1] ?? NaN);
  const dec = Number(/<jdedeg>\s*([^<]+)\s*<\/jdedeg>/i.exec(xml)?.[1] ?? NaN);
  return Number.isFinite(ra) && ra >= 0 && ra < 360 && Number.isFinite(dec) && dec >= -90 && dec <= 90
    ? {name, ra, dec} : null;
}

export function selectionFromItem(item: FedItem): SearchSelection {
  if (item.origin === 'imcce') {
    return {kind: item.otype === 'Asteroid' ? 'asteroid' : 'solar-system', id: item.id,
      name: item.label, source: 'IMCCE', moving: true, objectType: item.otype, viaModel: item.viaModel};
  }
  if (!Number.isFinite(item.ra) || !Number.isFinite(item.dec)
    || item.ra! < 0 || item.ra! >= 360 || item.dec! < -90 || item.dec! > 90) {
    throw new SearchError('noValidCoords');
  }
  return {kind: 'sky', id: item.id, name: item.label, raDeg: item.ra, decDeg: item.dec,
    frame: 'ICRS', coordinateEpoch: 'J2000', source: item.origin, objectType: item.otype,
    preparedTargetId: item.id ? PREPARED.get(item.id) : undefined, viaModel: item.viaModel};
}

/** The name shown first: the Korean name on the Korean screen, the English name on the English screen. */
export function nameFor(lang: Lang, en: string, ko?: string | null): string {
  return lang === 'ko' ? (ko || en) : en;
}

export function choiceFromItem(item: FedItem, lang: Lang = 'en'): SearchChoice {
  const selection = selectionFromItem(item);
  const texts = {} as Record<Lang, ChoiceText>;
  for (const l of BOTH) {
    const position = selection.kind === 'sky'
      ? `${selection.raDeg!.toFixed(5)}°, ${selection.decDeg!.toFixed(5)}° · ICRS / J2000`
      : t(l, 'movingDetail');
    texts[l] = {
      // Only objects of the catalogue carry both names; other results keep the name the service gave.
      label: item.nameEn !== undefined ? nameFor(l, item.nameEn, item.nameKo) : item.label,
      detail: `${item.otype ? item.otype + ' · ' : ''}${position}${item.viaModel ? t(l, 'aiCandidate') : ''}`,
    };
  }
  return {...texts[lang], selection, texts};
}

export function bodyChoices(query: string, bodies: Body[], exact = false, lang: Lang = 'en'): SearchChoice[] {
  const key = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const q = key(query).replace(/^(?:소행성|asteroid)\s+/i, '');
  if (!q) return [];
  return bodies.filter(b => {
    // Planetary Horizons IDs are not asteroid numbers: bare 499 must never mean Mars.
    const candidates = b.kind === 'asteroid'
      ? [b.id, b.name, b.name.replace(/^\d+\s+/, ''), ...(BODY_KOREAN[b.id] ?? [])]
      : [b.name, PLANET_NAMES[b.name] ?? b.name];
    return candidates.some(c => exact ? key(c) === q : key(c).startsWith(q));
  }).slice(0, 8).map(b => {
    const en = b.kind === 'asteroid' ? b.name : (PLANET_NAMES[b.name] ?? b.name);
    const texts = {} as Record<Lang, ChoiceText>;
    for (const l of BOTH) texts[l] = {
      label: l === 'ko' ? b.name : en,
      detail: t(l, b.kind === 'asteroid' ? 'asteroidDetail' : 'bodyDetail'),
    };
    return {...texts[lang], texts,
    selection: {kind: b.kind === 'asteroid' ? 'asteroid' : 'solar-system', id: b.id,
      name: b.kind === 'asteroid' ? b.name : (PLANET_NAMES[b.name] ?? b.name), displayName: b.name,
      source: 'prepared-body-catalogue', moving: true, objectType: b.kind}};});
}

function numericCoordinateMistake(query: string): boolean {
  return /^[+\-\d][\d\s.,;:+\-°hHdDmMsS'′"″]+$/.test(query.trim())
    && /[\s,;:°hHdDmMsS]/.test(query.trim()) && !parseCoords(query);
}

export function createSearchService(options: SearchOptions = {}) {
  const lang = (): Lang => asLang(typeof options.lang === 'function' ? options.lang() : options.lang);
  const fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  const indexUrl = options.indexUrl
    ? new URL(options.indexUrl, globalThis.location?.href ?? import.meta.url).href
    : new URL('./sky-index.json', import.meta.url).href;
  const bodyIndexUrl = options.bodyIndexUrl ?? new URL('./bodies-index.json', indexUrl).href;
  const fetchRemote = (url: string, init: RequestInit = {}) => boundedFetch(fetchFn, url, init, options.timeoutMs ?? 6000);
  const cacheKey = indexUrl + '\n' + bodyIndexUrl;
  let pending: Promise<{engine: SkySearch; bodies: Body[]}> | undefined;
  let state: {engine: SkySearch; bodies: Body[]} | undefined;
  const ready = () => {
    if (state) return Promise.resolve(state);
    if (!pending) {
      // Injected test/fake fetches are independent; real mounts share the parsed index.
      pending = !options.fetchFn ? loaded.get(cacheKey) : undefined;
      if (!pending) {
        pending = Promise.all([
          boundedFetch(fetchFn, indexUrl, {}, 15000).then(async r => {if (!r.ok) throw new SearchError('indexHttp', {status: r.status}, lang()); return r.json();}),
          boundedFetch(fetchFn, bodyIndexUrl, {}, 15000).then(async r => {if (!r.ok) return null; return r.json();}).catch(() => null),
        ]).then(([raw, rawBodies]) => {
          validateIndexData(raw);
          const data: SkyIndexData = {...raw, objects: raw.objects.map(row => {
            const extra = ALIASES[row[0]];
            return extra ? [row[0], row[1], row[2], row[3], row[4], [...row[5], ...extra[0]], [...row[6], ...extra[1]]] : row;
          })};
          const bodies: Body[] = Array.isArray(rawBodies?.objects) ? rawBodies.objects.filter((b: Body) => b
            && typeof b.id === 'string' && typeof b.name === 'string' && ['asteroid', 'planet'].includes(b.kind)) : [];
          bodies.push({id: 'sun', name: '태양', kind: 'planet'}, {id: 'moon', name: '달', kind: 'planet'});
          return {engine: createSkySearch(data), bodies};
        });
        if (!options.fetchFn) loaded.set(cacheKey, pending);
      }
      pending = pending.then(value => {state = value; return value;}, error => {pending = undefined; loaded.delete(cacheKey); throw error;});
    }
    return pending;
  };
  const suggest = (query: string): SearchChoice[] => {
    if (!state || !query.trim()) return [];
    const bodies = bodyChoices(query, state.bodies, false, lang());
    const sky = state.engine.suggest(query, {limit: 7, lang: 'ko'}).map(s => choiceFromItem({label: s.label, nameEn: s.object.name, nameKo: s.label !== s.object.name ? s.label : s.object.ko,
      origin: 'engine', viaModel: false, id: s.object.id, ra: s.object.ra, dec: s.object.dec, otype: s.object.otypeLabel}, lang()));
    return [...bodies, ...sky].slice(0, 9);
  };
  const search = async (query: string, signal?: AbortSignal): Promise<{items: SearchChoice[]; message: string; describe: Describe; partial: boolean}> => {
    aborted(signal);
    const done = (items: SearchChoice[], describe: Describe, partial: boolean) => ({items, message: describe(lang()), describe, partial});
    if (!query.trim()) return done([], l => t(l, 'enterNameOrCoords'), false);
    if (numericCoordinateMistake(query)) throw new SearchError('coordsMistake', {}, lang());
    const {engine, bodies} = await ready(); aborted(signal);
    const bodyHits = bodyChoices(query, bodies, true, lang());
    if (bodyHits.length) return done(bodyHits, l => t(l, 'chooseMoving'), false);
    const result = await federatedSearch(query, {
      engine,
      resolveName: async (text, requestSignal) => {
        const response = await fetchRemote('https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?' + encodeURIComponent(text), {signal: requestSignal as AbortSignal});
        if (!response.ok) throw new Error(`Sesame HTTP ${response.status}`);
        return readSesamePosition(await response.text(), text);
      },
      resolveSolarSystem: makeQuaeroResolver(fetchRemote), runList: makeSimbadRunner(fetchRemote),
      ...(options.askUrl ? {askModel: makeAskClient(fetchRemote, options.askUrl)} : {}),
    }, {signal});
    aborted(signal);
    const items = (result.items ?? []).map(item => choiceFromItem(item, lang()));
    // The language-model fallback is optional: when it fails or does not understand, the visitor sees the
    // ordinary "nothing found" answer, not a warning about an unreachable service.
    const partial = result.notes.some(note => !MODEL_NOTE.test(note));
    const describe: Describe = l => items.length
      ? (result.summary?.[l] ?? t(l, 'chooseCount', {n: items.length})) + (partial ? t(l, 'partialSuffix') : '')
      : partial ? t(l, 'noneExternal') : t(l, 'noneFound');
    return done(items, describe, partial);
  };
  return {ready, suggest, search};
}
