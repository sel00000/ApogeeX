import {LocalError, t} from './i18n';
import type {Key} from './i18n';
import type { Body } from './types';
import {normalizeApiBase} from './api-config';

export interface CatalogItem { id: string; name: string; detail: string; objectId?: string; numberedId?: string; aliases?: string[]; confidence?: string; quality?: string; nSpectralPoints?: number; analysisTimestamp?: string }
export interface Catalog { schema: string; targets: CatalogItem[]; generatedAt?: string }
export interface AnalysisResult {
  schema: string; id: string; record: Record<string, unknown>;
  coverage?: {start?: string; end?: string};
  counts?: {exposures?: number; points?: number; uniqueExposureIds?: number};
  validation?: unknown;
  assets?: {report?: string; observations?: string; spectrum?: string; components?: string; temporal?: string; plots?: {kind: string; file: string}[]};
}
export interface AnalysisJob {
  id: string; status: 'queued'|'running'|'completed'|'failed'|'cancelled'|'no_data';
  target: string; start: string; end: string; maxImages: number;
  logs: string[]; error?: string; errorCode?: string; resultUrl?: string;
  scene?: {status: 'not_started'|'running'|'completed'|'failed'|'cancelled'; url?: string; error?: string};
}

export function normalizedName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');
}
export function matchTarget<T extends {id: string; name: string; objectId?: string; numberedId?: string; aliases?: string[]}>(items: T[], query: string): T|undefined {
  const normalized = normalizedName(query);
  if (!normalized) return undefined;
  const exact = items.find(item => [item.id,item.objectId,item.numberedId,...(item.aliases??[]),item.name].some(alias=>typeof alias==='string' && normalizedName(alias)===normalized));
  if (exact) return exact;
  // Names can omit a catalogue number, but ambiguous names never silently pick a target.
  const matches = items.filter(item => normalizedName(item.name).replace(/^\d+\s+/, '').replace(/\s*\([^)]*\)$/, '') === normalized);
  return matches.length === 1 ? matches[0] : undefined;
}
export function initialBody(bodies: Body[], requested = ''): Body|undefined {
  const asteroids = bodies.filter(body => body.kind === 'asteroid');
  return requested ? matchTarget(asteroids, requested) : asteroids[0];
}
export function validateCatalog(value: unknown): Catalog {
  const data = value as Catalog;
  if (!data || data.schema !== 'spherex-asteroid-web-1' || !Array.isArray(data.targets)) throw new LocalError('rm.catalogFormat');
  const ids = new Set<string>();
  for (const row of data.targets) {
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.detail !== 'string' || ids.has(row.id)) throw new LocalError('rm.catalogRow');
    ids.add(row.id);
  }
  return data;
}
export function validateResult(value: unknown): AnalysisResult {
  const result = value as AnalysisResult;
  if (!result || result.schema !== 'spherex-asteroid-web-1' || typeof result.id !== 'string' || !result.record || typeof result.record !== 'object' || Array.isArray(result.record)) throw new LocalError('rm.resultFormat');
  return result;
}
/** Result artifacts stay in their own directory; arbitrary URL schemes and traversal are rejected. */
export function artifactUrl(base: string, file: string): string {
  const parent = new URL('.', base);
  const url = new URL(file, parent);
  if (url.origin !== parent.origin || !url.pathname.startsWith(parent.pathname) || url.username || url.password || /[\\\u0000]/.test(file) || !/^https?:$/.test(url.protocol)) throw new LocalError('rm.artifactPath');
  return url.href;
}
function jobUrl(value: string|null, origin: string, apiBase: string, leaf: 'scene/'|'result.json'): string|null {
  if (!value) return null;
  try {
    const root = normalizeApiBase(apiBase || origin,origin);
    const trusted = new URL(root);
    const prefix = trusted.pathname.replace(/\/$/, '');
    if (/[\\\s%\u0000]/.test(value) || value.startsWith('//')) return null;
    // The API returns root-relative routes even when deployed behind a prefix.
    let path = value.replace(/^\/+/, '');
    if(prefix && path.startsWith(prefix.slice(1)+'/'))path=path.slice(prefix.length);
    const url = /^https?:\/\//.test(value) ? new URL(value) : new URL(root + '/' + path);
    const expected = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/api/asteroid-analysis/jobs/[a-f0-9-]{36}/' + (leaf === 'scene/' ? 'scene/' : 'result\\.json') + '$');
    if (url.origin !== trusted.origin || !expected.test(url.pathname) || url.search || url.hash || url.username || url.password || value.split('/').includes('..')) return null;
    return url.href;
  } catch { return null; }
}
export function sceneDataUrl(value: string|null, origin: string, apiBase = ''): string|null {
  return jobUrl(value, origin, apiBase, 'scene/');
}
export function jobResultUrl(value: string|null, origin: string, apiBase = ''): string|null {
  return jobUrl(value, origin, apiBase, 'result.json');
}
export function number(value: unknown, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: digits}) : t('rm.notComputed');
}
export function interval(value: unknown): string {
  return Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n)) ? `${number(value[0])}–${number(value[1])}` : t('rm.noInterval');
}
export function scientific(value: unknown): string {
  if(typeof value!=='number'||!Number.isFinite(value))return t('rm.notComputed');
  return Math.abs(value)>=1e9?value.toExponential(3).replace('e+',' × 10^'):number(value);
}
export function statusLabel(status: string): string {
  return ['queued','running','completed','failed','cancelled','no_data','not_started'].includes(status) ? t(('st.'+status) as Key) : status;
}
