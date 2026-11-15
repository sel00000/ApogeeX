// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Thin clients for the public services, built from an injected fetch (so tests need no network):
// SIMBAD TAP (list queries), IMCCE quaero (Solar System bodies) and this site's /api/ask function.

import { parseCheckedPlan, type ModelPlan } from './llmPlan';

/** The part of Response the clients use. The real fetch fits. */
export interface ResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}
/** The part of fetch the clients use. `any` keeps the DOM, Workers and Node fetch types assignable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FetchLike = (url: string, init?: any) => Promise<ResponseLike>;

const SIMBAD_URL = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
const QUAERO_URL = 'https://api.ssodnet.imcce.fr/quaero/1/sso/search';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---- SIMBAD -------------------------------------------------------------------------------------

export interface ListRow {
  id: string;
  ra: number;
  dec: number;
  otype: string;
  nbref: number;
  /** Other columns of the query (plx_value, pm, K, V, galdim_majaxis). */
  extra: Record<string, string | number | null>;
  /** Identifiers of rows merged into this one because they share its position. */
  also: string[];
}
export type ListRunner = (adql: string, signal?: unknown) => Promise<ListRow[]>;

export function makeSimbadRunner(fetchFn: FetchLike): ListRunner {
  return async (adql, signal) => {
    const url = `${SIMBAD_URL}?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodeURIComponent(adql)}`;
    const res = await fetchFn(url, { signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`SIMBAD answered HTTP ${res.status}`);
    const j = parseJson(text) as { metadata?: { name?: unknown }[]; data?: unknown[][] } | undefined;
    if (!j || !Array.isArray(j.metadata) || !Array.isArray(j.data)) throw new Error('SIMBAD answer was not a table');
    const names = j.metadata.map((m) => String(m?.name ?? '').toLowerCase());
    const col = (n: string) => names.indexOf(n);
    const [ci, cr, cd, co, cn] = ['main_id', 'ra', 'dec', 'otype', 'nbref'].map(col) as [number, number, number, number, number];
    if (ci < 0 || cr < 0 || cd < 0) throw new Error('SIMBAD table lacks main_id/ra/dec');
    const seen = new Map<string, ListRow>();
    for (const r of j.data) {
      const ra = Number(r[cr]);
      const dec = Number(r[cd]);
      if (r[cr] == null || r[cd] == null || !Number.isFinite(ra) || !Number.isFinite(dec)
        || ra < 0 || ra >= 360 || dec < -90 || dec > 90) continue;
      const id = String(r[ci]).replace(/\s+/g, ' ').trim();
      // Planets and companions repeat their star's coordinates: keep the first row of each position.
      const key = `${ra.toFixed(3)},${dec.toFixed(3)}`;
      const prev = seen.get(key);
      if (prev) {
        if (id !== prev.id) prev.also.push(id);
        continue;
      }
      const extra: ListRow['extra'] = {};
      names.forEach((n, k) => {
        if (k !== ci && k !== cr && k !== cd && k !== co && k !== cn) {
          const v = r[k];
          extra[n] = typeof v === 'number' || typeof v === 'string' ? v : null;
        }
      });
      seen.set(key, { id, ra, dec, otype: co >= 0 ? String(r[co] ?? '') : '', nbref: cn >= 0 ? Number(r[cn]) || 0 : 0, extra, also: [] });
    }
    return [...seen.values()];
  };
}

// ---- quaero (IMCCE) -----------------------------------------------------------------------------

export interface SsoHit {
  name: string;
  type: string;
  class: string;
  aliases: string[];
}
export type SsoResolver = (text: string, signal?: unknown) => Promise<SsoHit[]>;

const SSO_TYPES = new Set(['Asteroid', 'Comet', 'Dwarf Planet', 'Planet', 'Satellite']);

// Words that describe the kind of body and say nothing about which one (longest phrases first).
const GENERIC = ['minor planet', 'dwarf planet', 'asteroid', 'comet', 'planet', 'moon', '소행성', '혜성', '왜소행성', '행성', '위성'];

/** Lower case, no parentheses or commas, single spaces. */
function plain(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[()（）,;]/g, ' ').replace(/\s+/g, ' ').trim();
}
const compactKey = (s: string) => s.replace(/\s+/g, '');

/**
 * quaero is a loose full-text search: it matches any single word or number of the query. This rule accepts a
 * hit only when the WHOLE query is accounted for by it. After dropping generic words (asteroid, comet, 혜성 ...)
 * the remaining words, taken one at a time or as runs of neighbouring words ("2008 BH1", "C/2025 N1"), must each
 * equal the hit's name, id, title, number or an alias (case and spacing ignored; the parts of a name split at "/"
 * count too, so "Halley" fits "P/Halley"). A query with nothing left after that is not accepted.
 */
export function queryAccountedBy(query: string, hit: { name: string; title?: string; id?: string; aliases?: readonly string[] }): boolean {
  let q = ` ${plain(query)} `;
  for (const g of GENERIC) q = q.split(` ${g} `).join('  ').split(` ${g} `).join('  ');
  const words = q.split(' ').filter(Boolean);
  if (!words.length) return false;
  const known = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const p = plain(raw);
    if (!p) return;
    known.add(compactKey(p));
    const num = /^\s*\((\d+)\)/.exec(raw)?.[1];
    if (num) known.add(num);
    if (p.includes('/')) for (const part of p.split('/')) if (part.trim().length > 1) known.add(compactKey(part.trim()));
  };
  [hit.name, hit.title, hit.id, ...(hit.aliases ?? [])].forEach(add);
  // Cover the words left to right with runs of neighbouring words (longest run first).
  const cover = (i: number): boolean => {
    if (i >= words.length) return true;
    for (let j = words.length; j > i; j--) if (known.has(compactKey(words.slice(i, j).join(' '))) && cover(j)) return true;
    return false;
  };
  return cover(0);
}

export function makeQuaeroResolver(fetchFn: FetchLike): SsoResolver {
  async function query(q: string, asked: string, signal: unknown): Promise<SsoHit[] | undefined> {
    const res = await fetchFn(`${QUAERO_URL}?q=${encodeURIComponent(q)}&limit=5`, { signal });
    if (!res.ok) throw new Error(`IMCCE answered HTTP ${res.status}`);
    const j = parseJson(await res.text()) as { data?: unknown } | undefined;
    if (!j || typeof j !== 'object' || !Array.isArray(j.data)) return undefined; // HTML error page etc.
    const out: SsoHit[] = [];
    for (const d of j.data as Record<string, unknown>[]) {
      if (!d || typeof d.name !== 'string' || typeof d.type !== 'string' || !SSO_TYPES.has(d.type)) continue;
      const aliases = Array.isArray(d.aliases) ? d.aliases.filter((a): a is string => typeof a === 'string') : [];
      const title = typeof d.title === 'string' ? d.title : undefined;
      const id = typeof d.id === 'string' ? d.id : undefined;
      if (!queryAccountedBy(asked, { name: d.name, title, id, aliases })) continue;
      // The real service sends class as a list of strings (["MB","Middle"]).
      const cls = Array.isArray(d.class) ? d.class.filter((c): c is string => typeof c === 'string').join('/') : typeof d.class === 'string' ? d.class : '';
      out.push({ name: d.name, type: d.type, class: cls, aliases });
    }
    return out;
  }
  return async (text, signal) => {
    const t = text.trim();
    if (!t) return [];
    let first: SsoHit[] | undefined;
    let firstError: unknown;
    try { first = await query(t, t, signal); } catch (error) {
      if ((signal as {aborted?: boolean} | undefined)?.aborted) throw error;
      firstError = error;
    }
    if (first) return first;
    // "3I/ATLAS" got an HTML error page: retry once with the part before the slash.
    const head = t.includes('/') ? (t.split('/')[0] ?? '').trim() : '';
    if (head) return (await query(head, t, signal)) ?? [];
    if (firstError) throw firstError;
    return [];
  };
}

// ---- /api/ask -----------------------------------------------------------------------------------

export type ModelAnswer = { ok: true; plan: ModelPlan; model: string } | { ok: false; reason: 'not_understood' };
export type AskModel = (text: string, signal?: unknown) => Promise<ModelAnswer>;

/** Client for functions/ask.ts. Throws when the service is unavailable; re-checks every plan it receives. */
export function makeAskClient(fetchFn: FetchLike, url: string): AskModel {
  return async (text, signal) => {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetchFn(`${url}${sep}q=${encodeURIComponent(text)}`, { signal });
    const j = parseJson(await res.text()) as { ok?: unknown; plan?: unknown; model?: unknown; reason?: unknown } | undefined;
    if (res.status === 503) throw new Error('model service unavailable');
    if (!res.ok || !j || typeof j !== 'object') throw new Error(`model service answered HTTP ${res.status}`);
    if (j.ok === true) {
      const plan = parseCheckedPlan(j.plan);
      if (plan) return { ok: true, plan, model: typeof j.model === 'string' ? j.model : '' };
    }
    return { ok: false, reason: 'not_understood' };
  };
}
