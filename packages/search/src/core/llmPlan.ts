// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// The model contract: the system prompt, a tolerant JSON extractor and the validator that turns a
// model answer into a checked plan. The model never states objects or coordinates: it picks a kind and
// fills closed lists; everything else is rejected. Model text is never shown to visitors.

import { TYPES, validatePlan, type ListPlan } from './plan';

export const KINDS = ['name', 'list', 'sso', 'none'] as const;

/** A plan that passed validation. */
export type ModelPlan =
  | { kind: 'name'; name: string }
  | { kind: 'sso'; name: string }
  | { kind: 'none' }
  | { kind: 'list'; plan: ListPlan };

export type ModelPlanResult = { ok: true; plan: ModelPlan } | { ok: false; why: string };

/** Type keys are generated from TYPES so the prompt and the validator cannot drift apart. */
export const SYSTEM_PROMPT = `You turn a visitor's sky-search request (Korean or English) into ONE JSON object for an astronomy website. Output the JSON object only: no prose, no markdown, no code fence.

Schema: {"kind":"name"|"list"|"sso"|"none","name":string|null,"type":string|null,"sort":string|null,"near":string|null,"limit":number}

kind:
- "name": the request means one specific star, nebula, cluster or galaxy outside the Solar System. Put its standard catalogue name in "name", in Latin letters, the way the SIMBAD database writes it (for example "M 42", "NGC 7293", "Vega", "Sgr A*"). Translate Korean names. Descriptions that identify one famous object also count.
- "list": the request describes a kind of object, not one object. Fill "type" and "sort".
- "sso": a Solar System body (planet, moon, asteroid, comet). Put its English name or designation in "name".
- "none": the request is not about objects in the sky, or asks you to do something else.

type (only for "list"; choose exactly one of these keys):
${Object.keys(TYPES).join(', ')}

sort (only for "list"):
- "nearest": closest to the Sun
- "brightest": brightest in the sky
- "fastest": moving fastest across the sky (proper motion)
- "largest": looks biggest on the sky
- "famous": best known / most studied; use this when the request gives no ordering

near (only for "list"): when the request says the objects are inside or close to a named place in the sky, give that place's catalogue name in Latin letters; otherwise null.
limit: number of results wanted, 10 by default, at most 20; 1 for "name" and "sso".
Unused fields are null. Never invent a type key or a sort value.

Examples:
가장 가까운 백색왜성 -> {"kind":"list","name":null,"type":"white_dwarf","sort":"nearest","near":null,"limit":10}
오리온 대성운 -> {"kind":"name","name":"M 42","type":null,"sort":null,"near":null,"limit":1}
globular clusters close to the Galactic centre -> {"kind":"list","name":null,"type":"globular_cluster","sort":"famous","near":"Sgr A*","limit":10}
핼리 혜성 -> {"kind":"sso","name":"1P/Halley","type":null,"sort":null,"near":null,"limit":1}
근처 피자 맛집 -> {"kind":"none","name":null,"type":null,"sort":null,"near":null,"limit":1}`;

/** Pull the first JSON object out of a model answer (drops <think> blocks and code fences). */
export function extractJson(text: unknown): unknown {
  if (text && typeof text === 'object') return text;
  const s = String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{');
  if (a < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = a; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(a, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Strict pattern for names the model may hand on (also used for "near"). */
export const NAME_OK = /^[A-Za-z0-9 .+\-*'/()[\]]{1,60}$/;

function checkName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return NAME_OK.test(t) ? t : null;
}

/**
 * Check a model answer (text or an already parsed object) against the closed lists.
 * The `why` text only quotes the kind of failure, never the model's own words.
 */
export function validateModelPlan(raw: unknown): ModelPlanResult {
  const p = extractJson(raw);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, why: 'no JSON object' };
  const q = p as Record<string, unknown>;
  if (typeof q.kind !== 'string' || !(KINDS as readonly string[]).includes(q.kind)) return { ok: false, why: 'unknown kind' };
  if (q.kind === 'none') return { ok: true, plan: { kind: 'none' } };
  if (q.kind === 'name' || q.kind === 'sso') {
    const name = checkName(q.name);
    if (name === null) return { ok: false, why: 'bad name' };
    return { ok: true, plan: { kind: q.kind, name } };
  }
  const v = validatePlan({ kind: 'list', type: q.type, sort: q.sort, near: q.near, limit: q.limit });
  if (!v.ok) return { ok: false, why: 'bad list plan' };
  return { ok: true, plan: { kind: 'list', plan: v.plan } };
}

/**
 * Re-check a plan that arrives already in checked shape (the answer of /api/ask), so the app never
 * trusts the network. Returns null when it is not a valid ModelPlan.
 */
export function parseCheckedPlan(x: unknown): ModelPlan | null {
  if (!x || typeof x !== 'object') return null;
  const q = x as Record<string, unknown>;
  if (q.kind === 'none') return { kind: 'none' };
  if (q.kind === 'name' || q.kind === 'sso') {
    const name = checkName(q.name);
    return name === null ? null : { kind: q.kind, name };
  }
  if (q.kind === 'list') {
    const v = validatePlan(q.plan);
    return v.ok ? { kind: 'list', plan: v.plan } : null;
  }
  return null;
}
