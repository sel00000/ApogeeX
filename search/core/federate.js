// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Orchestration: the offline engine answers first; public name services are asked together when it is
// unsure; a language model is asked only when all of those found nothing. An object that came from the
// model is never opened directly, it is always offered as a choice. Only an abort rejects.

                                                           
import { compileAdql, describePlan,                          } from './plan.js';
                                           
                                                

                                
               
             
              
 

                               
                                                      
                                                                                       
                                                                                               
                                                                        
                                                              
                                                                                                                                     
 
                               
                                                  
 

                                                                         
                                                                          

                          
                
                                          
                                                   
                                                                                                                
                    
                                                                                                            
                  
                         
              
              
               
                 
                  
                                                                                                                          
                 
                           
 

                            
                
                                                                                                             
                    
                     
                                       
                                                                                                                  
                  
                    
                  
 

const SAME_SPOT_DEG = 0.01;
const MODEL_SUMMARY = { ko: 'AI가 요청을 해석해 찾은 후보예요. 맞는지 확인하고 고르세요.', en: 'Candidates from an AI reading of your request. Check that they fit, then choose one.' };

function aborted(opts               )          {
  return !!opts?.signal?.aborted;
}
function abortError(opts               )          {
  const r = opts?.signal?.reason;
  if (r !== undefined) return r;
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}
function msg(e         )         {
  return e instanceof Error && e.message ? e.message : 'failed';
}

function fromSuggestion(s            , viaModel         )          {
  return { label: s.label, nameEn: s.object.name, nameKo: s.label !== s.object.name ? s.label : s.object.ko, origin: 'engine', viaModel, id: s.object.id, ra: s.object.ra, dec: s.object.dec, otype: s.object.otypeLabel };
}
function fromPosition(p               , viaModel         )          {
  return { label: p.name, origin: 'sesame', viaModel, ra: p.ra, dec: p.dec };
}
function fromSso(h        , viaModel         )          {
  return { label: h.name, origin: 'imcce', viaModel, id: h.name, otype: h.type, detail: h.class || undefined };
}

/** Drop items that sit at the same place as an earlier one (the same object found by two services). */
function dedupe(items           )            {
  const out            = [];
  for (const it of items) {
    const dup = out.some((o) => {
      if (o.ra !== undefined && o.dec !== undefined && it.ra !== undefined && it.dec !== undefined) {
        // Great-circle separation handles the RA seam and poles without a flat-sky approximation.
        const rad = Math.PI / 180;
        const dra = (((o.ra - it.ra + 540) % 360) - 180) * rad;
        const ddec = (o.dec - it.dec) * rad;
        const hav = Math.sin(ddec / 2) ** 2
          + Math.cos(o.dec * rad) * Math.cos(it.dec * rad) * Math.sin(dra / 2) ** 2;
        return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, hav)))) / rad < SAME_SPOT_DEG;
      }
      return o.origin === it.origin && o.label.toLowerCase() === it.label.toLowerCase();
    });
    if (!dup) out.push(it);
  }
  return out;
}

function listItems(rows           , limit        )            {
  return rows.slice(0, limit).map((r) => ({
    label: r.id.replace(/^(NAME|V\*|\*\*|\*)\s+/, ''),
    origin: 'simbad'         ,
    viaModel: false,
    id: r.id,
    ra: r.ra,
    dec: r.dec,
    otype: r.otype,
    nbref: r.nbref,
    extra: r.extra,
  }));
}

export async function federatedSearch(text        , deps              , opts               )                     {
  const signal = opts?.signal;
  const notes           = [];
  const guard = () => {
    if (aborted(opts)) throw abortError(opts);
  };
  /** Run one remote call; failures become notes, an abort rejects. */
  async function attempt   (label        , f                  )                         {
    guard();
    try {
      const v = await f();
      guard();
      return v;
    } catch (e) {
      if (aborted(opts)) throw abortError(opts);
      notes.push(`${label}: ${msg(e)}`);
      return undefined;
    }
  }
  const asArray = (v                                                    )                  =>
    v == null ? [] : (Array.isArray(v) ? v : [v]).filter((p) => p && Number.isFinite(p.ra) && Number.isFinite(p.dec)
      && p.ra >= 0 && p.ra < 360 && p.dec >= -90 && p.dec <= 90);

  /** Compile and run a checked list plan. `near` is the place's position when already known. */
  async function runPlan(plan          , near                                    , source                   , viaModel         )                     {
    const usedModel = source === 'model';
    let pos = near;
    let nearLabel                                        ;
    if (plan.near && !pos) {
      let found                                                        ;
      const i = deps.engine.interpret(plan.near);
      // Only a confident match is a place: a fuzzy or ambiguous one would centre the list on another object while the
      // summary names the place that was asked for.
      if (i.kind === 'object' && i.confident) found = { ra: i.best.object.ra, dec: i.best.object.dec, label: i.best.label };
      if (!found) {
        const p = asArray(await attempt('name service (near)', () => deps.resolveName(plan.near          , signal)))[0];
        if (p) found = { ra: p.ra, dec: p.dec, label: p.name };
      }
      if (!found) {
        notes.push(`could not find the place "${plan.near}"`);
        return { kind: 'nothing', source, usedModel, notes };
      }
      pos = { ra: found.ra, dec: found.dec };
      nearLabel = { ko: found.label, en: found.label };
    }
    const { adql, sortUsed } = compileAdql(plan, pos);
    const rows = await attempt('SIMBAD list', () => deps.runList(adql, signal));
    const items = rows ? listItems(rows, plan.limit).map((it) => ({ ...it, viaModel })) : [];
    if (!items.length) {
      if (rows) notes.push('SIMBAD returned no rows');
      return { kind: 'nothing', source, usedModel, notes };
    }
    const summary = describePlan(plan, sortUsed, nearLabel);
    return { kind: 'list', source, usedModel, summary, sortUsed, items, notes };
  }

  guard();
  const t = text.trim();
  const first = deps.engine.interpret(t);
  if (first.kind === 'empty') return { kind: 'nothing', source: 'engine', usedModel: false, notes };
  if (first.kind === 'coords') {
    return { kind: 'coords', source: 'engine', usedModel: false, items: [{ label: `${first.ra}, ${first.dec}`, origin: 'engine', viaModel: false, ra: first.ra, dec: first.dec }], notes };
  }
  if (first.kind === 'object' && first.confident) {
    return { kind: 'open', source: 'engine', usedModel: false, items: [fromSuggestion(first.best, false)], notes };
  }
  if (first.kind === 'list') {
    const near = first.near ? { ra: first.near.ra, dec: first.near.dec } : null;
    return runPlan(first.plan, near, 'rules', false);
  }

  // Not sure: ask both name services together.
  const engineItems            = first.kind === 'object' ? [first.best, ...first.others].map((s) => fromSuggestion(s, false)) : [];
  guard();
  const [sesame, sso] = await Promise.allSettled([deps.resolveName(t, signal), deps.resolveSolarSystem(t, signal)]);
  guard();
  let sesameItems            = [];
  let ssoItems            = [];
  if (sesame.status === 'fulfilled') sesameItems = asArray(sesame.value).map((p) => fromPosition(p, false));
  else notes.push(`name service: ${msg(sesame.reason)}`);
  if (sso.status === 'fulfilled') ssoItems = (sso.value ?? []).map((h) => fromSso(h, false));
  else notes.push(`solar system service: ${msg(sso.reason)}`);

  const choices = dedupe([...engineItems, ...sesameItems, ...ssoItems]);
  // One name-service hit and nothing else: the app opens a typed name in that case. A Solar System body needs
  // a date first, so those stay choices; so do model-derived objects (handled below).
  if (choices.length === 1 && engineItems.length === 0 && ssoItems.length === 0 && sesameItems.length === 1) {
    return { kind: 'open', source: 'sesame', usedModel: false, items: choices, notes };
  }
  if (choices.length) {
    const source            = sesameItems.length ? 'sesame' : ssoItems.length ? 'imcce' : 'engine';
    return { kind: 'choices', source, usedModel: false, items: choices, notes };
  }

  // Nothing at all came back: the last resort.
  if (!deps.askModel) return { kind: 'nothing', source: 'engine', usedModel: false, notes };
  const answer = await attempt('model', () => deps.askModel (t, signal));
  if (!answer) return { kind: 'nothing', source: 'model', usedModel: true, notes };
  if (!answer.ok) {
    notes.push('model did not understand the request');
    return { kind: 'nothing', source: 'model', usedModel: true, notes };
  }
  const plan = answer.plan;
  if (plan.kind === 'none') return { kind: 'nothing', source: 'model', usedModel: true, notes };
  if (plan.kind === 'list') return runPlan(plan.plan, null, 'model', true);

  let items            = [];
  if (plan.kind === 'name') {
    const i = deps.engine.interpret(plan.name);
    if (i.kind === 'object') items.push(...[i.best, ...i.others].map((s) => fromSuggestion(s, true)));
    const p = await attempt('name service (model name)', () => deps.resolveName(plan.name, signal));
    items.push(...asArray(p).map((x) => fromPosition(x, true)));
  } else {
    const h = await attempt('solar system service (model name)', () => deps.resolveSolarSystem(plan.name, signal));
    items = (h ?? []).map((x) => fromSso(x, true));
  }
  items = dedupe(items);
  if (!items.length) return { kind: 'nothing', source: 'model', usedModel: true, notes };
  return { kind: 'choices', source: 'model', usedModel: true, summary: MODEL_SUMMARY, items, notes };
}
