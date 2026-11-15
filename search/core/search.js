// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Public API: createSkySearch(data) -> { size, suggest(text, opts), interpret(text) }.
// Plain TypeScript, no dependencies, no network: the caller loads data/sky-index.json and runs any SIMBAD query.

import { buildIndex, validateIndexData,                                                                                 } from './index.js';
import { compact, normalize, tokens } from './normalize.js';
import { hasHangul, isInitialsQuery, toJamo } from './hangul.js';
import { damerauLevenshtein, editLimit } from './fuzzy.js';
import { bm25Word, score,                } from './rank.js';
import { parseCoords, parseListRequest } from './intent.js';
import { describePlan, validatePlan,               } from './plan.js';

                                                       
                                       
export { compileAdql, describePlan, TYPES } from './plan.js';

                             
                    
                                                                         
                
                                                 
                  
                   
                
 

                            
                     
                                               
                                                                                  
                                                                                           
                        

/** An app-specific target (not in the baked index). Behaves like an indexed object and wins ties. */
                              
               
                                
             
                                   
              
                     
                
                                                                              
                 
 

                                   
                        
 

                            
               
                                                                                     
                                          
 

               
                
                  
                
                
                                                                                                                           
                  
                                                                                                                     
                    
 

/** Jamo that a typist confuses with each other (plain / aspirated / tense consonants, neighbouring vowels). */
const CONFUSABLE = ['ㄱㅋㄲ', 'ㄷㅌㄸ', 'ㅂㅍㅃ', 'ㅈㅊㅉ', 'ㅅㅆ', 'ㅐㅔㅖㅒㅣ', 'ㅗㅜㅡ', 'ㅓㅏ'];
const MIN_FUZZY_LATIN = 6;
const MIN_FUZZY_JAMO = 7;

/**
 * May a one-edit fuzzy match be opened without asking? Only when the typed key is long enough that one slip
 * rarely lands on another real name (Latin 6 letters, Korean 7 jamo), has no digits (a changed catalogue
 * number names another object), and the single edit is the kind a typist makes: Latin substitution, deletion,
 * insertion or swap; Korean a swap or a confusable jamo pair (ㅐ/ㅔ, ㅗ/ㅜ, ㄷ/ㅌ ...), never a missing or extra jamo.
 */
function fuzzyIsSafe(q        , name        , korean         )          {
  // Both the typed key and the matched name must be long enough: a common word one letter away from a short name
  // ("dragon" / "Dagon") is not a typo of that name.
  const min = korean ? MIN_FUZZY_JAMO : MIN_FUZZY_LATIN;
  if (/\d/.test(q) || q.length < min || name.length < min) return false;
  if (!korean) return true;
  let a = 0;
  while (a < q.length && a < name.length && q[a] === name[a]) a++;
  let b = 0;
  while (b < q.length - a && b < name.length - a && q[q.length - 1 - b] === name[name.length - 1 - b]) b++;
  const x = q.slice(a, q.length - b);
  const y = name.slice(a, name.length - b);
  if (x.length === 2 && y.length === 2) return x[0] === y[1] && x[1] === y[0];
  if (x.length === 1 && y.length === 1) return CONFUSABLE.some((g) => g.includes(x) && g.includes(y));
  return false;
}

/**
 * Papers an object needs before a fuzzy (not exact) match of its name may open it unasked. In the baked index 2,590 of
 * 19,975 objects have at least 300 papers (the 1,500th most popular common name has 363), so every well-known target
 * is still covered, while the obscure rest (an exoplanet, a galaxy group, a loop of the Galactic plane) is not: an
 * ordinary word that lands one letter from such an alias is far more likely than a typo of that alias.
 */
const FUZZY_CONFIDENT_NBREF = 300;

/** Do the typed words line up with the words of the matched name: same count, each within its own edit budget? */
function wordsAgree(orig          , q          , name          )          {
  if (q.length !== name.length || q.length === 0) return false;
  for (let i = 0; i < q.length; i++) {
    const lim = editLimit(orig[i] , q[i] .length);
    if (damerauLevenshtein(q[i] , name[i] , lim) > lim) return false;
  }
  return true;
}

const PREFIX_CAP = 300;
const WORD_CAP = 500;
const FUZZY_ALTS = 5;
const MIN_WORD_COVER = 0.6;
/** A choice that is this much more popular (and within RIVAL_GAP score points) is listed first. */
/** Papers mentioning an object: above this it may be offered for a small part of its name. */
const FAMOUS_NBREF = 3000;
const RIVAL_RATIO = 1.25;
const RIVAL_GAP = 40;

/** Intersection of ascending id lists. */
function intersect(lists            )           {
  lists.sort((a, b) => a.length - b.length);
  let cur = lists[0] ?? [];
  for (let i = 1; i < lists.length && cur.length; i++) {
    const other = new Set(lists[i]);
    cur = cur.filter((x) => other.has(x));
  }
  return cur;
}

function collect(ix             , text        , mode                         )        {
  const { entries, objects } = ix;
  const N = entries.length;
  const best = new Map             ();
  const df = (t        ) => ix.postings.get(t)?.length ?? 1;
  const consider = (id        , kind           , qtoks          , edits        , coverage        , extra        , flag                               ) => {
    const e        = entries[id] ;
    const o = objects[e.obj] ;
    let bm = 0;
    for (const t of qtoks) if (e.toks.includes(t)) bm += bm25Word(df(t), N, e.toks.length, ix.avgLen);
    const s = score({ kind, bm25: bm, nbref: o.nbref, coverage, edits, extra, stub: flag === 'stub', app: o.extra === true });
    const prev = best.get(e.obj);
    if (!prev || s > prev.score) best.set(e.obj, { entry: id, kind, score: s, edits, ...(flag === 'partial' ? { partial: true, loose: true } : flag === 'loose' ? { loose: true } : {}) });
  };

  const raw = text.normalize('NFKC').trim();
  const asJamo = toJamo(raw);
  if (isInitialsQuery(asJamo)) {
    const q = asJamo.replace(/\s/g, '');
    // While typing, initials may be the start of a name's initials; a submitted query must give them all.
    for (const { entry, ini } of ix.initials) {
      if (mode === 'suggest' ? ini.startsWith(q) : ini === q) consider(entry, 'initials', [], 0, q.length / ini.length, 0);
    }
    return [...best.values()].sort((a, b) => b.score - a.score);
  }

  const norm = normalize(raw);
  if (!norm) return [];
  const orig = tokens(norm);
  const qt = orig.map(toJamo);
  const key = toJamo(compact(norm));
  const keyLen = key.length;
  const cover = (e       ) => keyLen / Math.max(keyLen, e.key.length);

  // 1. exact name (spacing-insensitive)
  // Typed text that equals a name only once its spaces are removed ("Orin" for "Ori N", "pica" for "Pic A") is a
  // guess about spacing, not a spelling of that name: it competes as a one-edit fuzzy match and is never confident.
  // Korean spacing variants ("안드로메다은하") are ordinary and stay exact.
  for (const id of ix.exact.get(key) ?? []) {
    if (!hasHangul(raw) && qt.join(' ') !== entries[id] .toks.join(' ')) consider(id, 'fuzzy', qt, 1, 1, 0, 'loose');
    else consider(id, 'exact', qt, 0, 1, 0);
  }

  // 2. name starts with the query (autocomplete only)
  if (mode === 'suggest') {
    const bucket = key.length === 1 ? ix.prefix1.get(key) : ix.prefix2.get(key.slice(0, 2));
    let n = 0;
    for (const id of bucket ?? []) {
      const e = entries[id] ;
      if (e.key === key || !e.key.startsWith(key)) continue;
      // A prefix that stops inside the first word of a catalogue designation ("bet" of "bet Per") is a stub, not a name.
      consider(id, 'prefix', qt, 0, cover(e), 0, e.lang === 'cat' && e.toks.length > 1 && key.length <= e.toks[0] .length ? 'stub' : undefined);
      if (++n >= PREFIX_CAP) break;
    }
  }

  // 3. every query word is a whole word of the name (while typing, the last word may be a word prefix)
  {
    const full = mode === 'suggest' && qt.length > 1 ? qt.slice(0, -1) : qt;
    const last = mode === 'suggest' && qt.length > 1 ? qt[qt.length - 1]  : null;
    const lists = full.map((t) => ix.postings.get(t));
    if (lists.every((l)                => !!l)) {
      let n = 0;
      for (const id of intersect(lists.map((l) => l))) {
        const e = entries[id] ;
        if (last && !e.toks.some((t) => t.startsWith(last))) continue;
        // A submitted query that is only a small part of a name ("토성" in "토성 성운") is too vague to answer.
        // Only a famous object may be offered for such a small part of its name ("orion" -> Orion Nebula), and never opened.
        const small = mode === 'interpret' && cover(e) < MIN_WORD_COVER;
        if (small && objects[e.obj] .nbref < FAMOUS_NBREF) continue;
        consider(id, 'word', qt, 0, cover(e), e.toks.length - qt.length, small ? 'loose' : undefined);
        if (++n >= WORD_CAP) break;
      }
    }
  }

  // 4. typos: the whole name, then word by word. Digits must match exactly (see NgramIndex.search).
  {
    const lim = editLimit(compact(norm), keyLen);
    // A one-letter last word is a component ("Sirius B", "alf Cen A"): a typo fix must not change it.
    const lastTok = qt[qt.length - 1] ;
    const component = lastTok.length === 1 && qt.length > 1 ? lastTok : null;
    for (const h of ix.vocab.search(key, lim)) {
      for (const id of ix.exact.get(ix.vocab.strings[h.id] ) ?? []) {
        const et = entries[id] .toks;
        if (component && et[et.length - 1] !== component) continue;
        consider(id, 'fuzzy', qt, h.dist, 1, 0);
      }
    }
    // One misspelled word that fits the leading word of a longer name ("안드로매다" -> "안드로메다 은하").
    if (qt.length === 1) {
      const lead = qt[0] ;
      // A four-letter Latin word gets one edit here (never confident: see fuzzyIsSafe), so "Orin" can reach "Orion ...".
      const lim = Math.max(editLimit(orig[0] , lead.length), !hasHangul(raw) && lead.length === 4 && !ix.postings.has(lead) ? 1 : 0);
      for (const h of ix.vocab.search(lead, lim, FUZZY_ALTS * 2)) {
        const s = ix.vocab.strings[h.id] ;
        let n = 0;
        for (const id of ix.postings.get(s) ?? []) {
          const e = entries[id] ;
          if (e.toks.length < 2 || e.toks[0] !== s) continue;
          consider(id, 'fuzzy', qt, h.dist, cover(e), e.toks.length - 1, 'partial');
          if (++n >= WORD_CAP) break;
        }
      }
    }
    if (qt.length > 1) {
      const perWord                        = [];
      let anyEdit = false;
      for (let i = 0; i < qt.length; i++) {
        const t = qt[i] ;
        const alts                             = ix.postings.has(t) ? [{ s: t, d: 0 }] : [];
        for (const h of ix.vocab.search(t, editLimit(orig[i] , t.length), FUZZY_ALTS * 2)) {
          const s = ix.vocab.strings[h.id] ;
          if (ix.postings.has(s) && alts.length < FUZZY_ALTS + 1) alts.push({ s, d: h.dist });
        }
        if (!alts.length) {
          perWord.length = 0;
          break;
        }
        if (alts.some((a) => a.d > 0)) anyEdit = true;
        const m = new Map                ();
        for (const a of alts) for (const id of ix.postings.get(a.s) ) if (!m.has(id) || m.get(id)  > a.d) m.set(id, a.d);
        perWord.push(m);
      }
      if (anyEdit && perWord.length === qt.length) {
        perWord.sort((a, b) => a.size - b.size);
        let n = 0;
        for (const [id, d0] of perWord[0] ) {
          let d = d0;
          let ok = true;
          for (let k = 1; k < perWord.length && ok; k++) {
            const dk = perWord[k] .get(id);
            if (dk === undefined) ok = false;
            else d += dk;
          }
          if (!ok || d === 0) continue;
          const e = entries[id] ;
          if (mode === 'interpret' && cover(e) < MIN_WORD_COVER) continue;
          consider(id, 'fuzzy', qt, d, cover(e), e.toks.length - qt.length);
          if (++n >= WORD_CAP) break;
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function extraRecords(extra               )              {
  return extra.map((x, i)            => {
    const bad = (why        ) => new Error(`sky-search: extra[${i}] ${why}`);
    if (!x || typeof x.name !== 'string' || !x.name.trim()) throw bad('needs a name');
    if (!Number.isFinite(x.ra) || x.ra < 0 || x.ra >= 360) throw bad('ra must be in [0, 360)');
    if (!Number.isFinite(x.dec) || x.dec < -90 || x.dec > 90) throw bad('dec must be in [-90, 90]');
    const strs = (a         , what        )           => {
      if (a === undefined) return [];
      if (!Array.isArray(a) || a.some((s) => typeof s !== 'string' || !s.trim())) throw bad(`${what} must be a list of non-empty strings`);
      return a.map((s        ) => s.trim());
    };
    return [x.name.trim(), x.ra, x.dec, x.otype ?? 'Unknown', 0, strs(x.aliases, 'aliases'), strs(x.ko, 'ko')];
  });
}

/** A catalogue position this close to an app target is the same object (the app's positions are epoch-propagated). */
const SAME_OBJECT_DEG = 180 / 3600;
/**
 * An object that shares a name with an app target is the same object only when it is not farther than this: 360 arcsec
 * covers the proper motion of Barnard's Star, the fastest star, since J2000 (265 arcsec), yet excludes a planet whose
 * name differs only in letter case ("eps Ind b", 506 arcsec from "eps Ind B").
 */
const SAME_NAME_DEG = 360 / 3600;

const nameKey = (s        )         => toJamo(compact(normalize(s)));

/**
 * An app target and the object of the baked index that is the same thing are one object: same position within
 * 180 arcsec, or a shared name (within 360 arcsec, so a same-named object elsewhere stays a separate rival).
 * The target keeps its label, position and type; the index twin's names, papers count and type (when the target
 * gives none) join it, and the twin is dropped so that the two never rival each other. Without a shared name only
 * the nearest object within 180 arcsec counts, so a neighbour is never folded in.
 */
function mergeExtras(extra             , objects             )                                               {
  if (!extra.length || !objects.length) return { extra, objects };
  const drop = new Set        ();
  const merged = extra.map((x)            => {
    const keys = new Set([x[0], ...x[5], ...x[6]].map(nameKey).filter(Boolean));
    const cosd = Math.cos((x[2] * Math.PI) / 180);
    const shared           = [];
    let near = -1;
    let nearD = SAME_OBJECT_DEG;
    for (let i = 0; i < objects.length; i++) {
      if (drop.has(i)) continue;
      const o = objects[i] ;
      const dRa = Math.abs(o[1] - x[1]);
      const d = Math.hypot(Math.min(dRa, 360 - dRa) * cosd, o[2] - x[2]);
      if (d < nearD) {
        nearD = d;
        near = i;
      }
      if (d < SAME_NAME_DEG && [o[0], ...o[5], ...o[6]].some((n) => keys.has(nameKey(n)))) shared.push(i);
    }
    const used = shared.length ? shared : near >= 0 ? [near] : [];
    if (!used.length) return x;
    const names = [...x[5]];
    const ko = [...x[6]];
    let nbref = x[4];
    let otype = x[3];
    for (const i of used) {
      const o = objects[i] ;
      drop.add(i);
      names.push(o[0], ...o[5]);
      ko.push(...o[6]);
      nbref = Math.max(nbref, o[4]);
      if (otype === 'Unknown') otype = o[3];
    }
    return [x[0], x[1], x[2], otype, nbref, names, ko];
  });
  return { extra: merged, objects: drop.size ? objects.filter((_, i) => !drop.has(i)) : objects };
}

export function createSkySearch(data              , options                   = {})            {
  validateIndexData(data);
  const rawExtra = options.extra?.length ? extraRecords(options.extra) : [];
  const { extra, objects: rest } = mergeExtras(rawExtra, data.objects);
  const ix = extra.length ? buildIndex({ ...data, objects: [...extra, ...rest] }, extra.length) : buildIndex(data);

  const toSuggestion = (h     , lang             )             => {
    const e = ix.entries[h.entry] ;
    const o = ix.objects[e.obj] ;
    // Korean requested: the Korean name that matched ("북극성"), else the first Korean name, else the English name.
    const label = lang === 'ko' ? (e.lang === 'ko' ? e.text : (o.ko ?? o.name)) : o.name;
    return { object: o, label, matched: e.text, match: h.kind, score: Math.round(h.score * 100) / 100 };
  };

  /** Confidence that the first hit is what was meant. Accuracy over coverage: when in doubt, false. */
  const isConfident = (hits       , text        )          => {
    const top = hits[0];
    if (!top) return false;
    const topObj = ix.objects[ix.entries[top.entry] .obj] ;
    if (top.kind === 'exact') {
      // Another object with the same name and comparable fame: let the person choose.
      return !hits.slice(1).some((h) => h.kind === 'exact' && ix.objects[ix.entries[h.entry] .obj] .nbref * 4 >= topObj.nbref);
    }
    if (top.kind === 'fuzzy') {
      if (top.loose) return false;
      // Not exact, so only a plain typo of a well-known, long enough name may open it: the typed words must line up
      // with the words of the name (comparing keys without spaces let "cloudy" reach "Cloud M" and "Lone star"
      // reach "Lodestar"), each within its own edit budget; query and name are long enough (fuzzyIsSafe); the object
      // is famous (FUZZY_CONFIDENT_NBREF); and no other fuzzy reading is nearly as good.
      const te = ix.entries[top.entry] ;
      const qnorm = normalize(text);
      const qkey = toJamo(compact(qnorm));
      if (topObj.nbref < FUZZY_CONFIDENT_NBREF) return false;
      if (!wordsAgree(tokens(qnorm), tokens(qnorm).map(toJamo), te.toks)) return false;
      // Partial (leading-word) hits are weaker readings and do not count as rivals: this keeps the old behaviour.
      const second = hits.slice(1).find((h) => !h.partial);
      return top.edits <= 1 && fuzzyIsSafe(qkey, te.key, hasHangul(text)) && (!second || second.score <= top.score - 10);
    }
    return false;
  };

  /**
   * Choices only: when a clearly more popular object is nearly as good a match as the first one, put it first
   * ("orion" -> the Orion Nebula before "Orion A"; "Orin" -> the Orion Nebula before "Ori N"). Never used to open anything.
   */
  const rivalFirst = (hits       )       => {
    const top = hits[0];
    if (!top || ix.objects[ix.entries[top.entry] .obj] .extra) return; // an app target stays where the app put it
    const pop = (h     ) => ix.objects[ix.entries[h.entry] .obj] .nbref;
    let bi = 0;
    for (let i = 1; i < Math.min(hits.length, 8); i++) {
      if (top.score - hits[i] .score > RIVAL_GAP) break; // hits are sorted by score
      if (pop(hits[i] ) > pop(hits[bi] )) bi = i;
    }
    if (bi > 0 && pop(hits[bi] ) >= RIVAL_RATIO * pop(top)) hits.unshift(...hits.splice(bi, 1));
  };

  const resolveNear = (text        )                   => {
    const hits = collect(ix, text, 'interpret');
    if (!hits.length || !isConfident(hits, text)) return null;
    return ix.objects[ix.entries[hits[0] .entry] .obj] ;
  };

  return {
    size: ix.objects.length,

    suggest(text, opts = {}) {
      const limit = Math.max(1, Math.min(50, opts.limit ?? 8));
      const lang = opts.lang ?? (hasHangul(text) ? 'ko' : 'en');
      if (!text || !text.trim()) return [];
      return collect(ix, text, 'suggest')
        .slice(0, limit)
        .map((h) => toSuggestion(h, lang));
    },

    interpret(text) {
      const t = (text ?? '').normalize('NFKC').trim();
      if (!t) return { kind: 'empty' };
      const pos = parseCoords(t);
      if (pos) return { kind: 'coords', ra: pos.ra, dec: pos.dec };
      const lang = hasHangul(t) ? 'ko' : 'en';
      // A bare number ("12") names nothing; "M 12" or "12 Oph" do.
      if (/^[+-]?\d+(?:[.,]\d+)?$/.test(t)) return { kind: 'unknown' };
      // A single Latin letter or digit is too little to go on.
      if (!hasHangul(t) && compact(normalize(t)).length < 2) return { kind: 'unknown' };
      const hits = collect(ix, t, 'interpret');
      const confident = isConfident(hits, t);
      if (!confident) rivalFirst(hits);
      const asObject = ()                 => ({
        kind: 'object',
        best: toSuggestion(hits[0] , lang),
        others: hits.slice(1, 6).map((h) => toSuggestion(h, lang)),
        confident,
      });
      if (hits.length && hits[0] .kind === 'exact' && confident) return asObject();

      const req = parseListRequest(t);
      if (req) {
        let near                   = null;
        if (req.nearText) {
          near = resolveNear(req.nearText);
          if (!near) return { kind: 'unknown' }; // a place we cannot pin down: do not guess
        }
        const v = validatePlan({ kind: 'list', type: req.type, sort: req.sort, near: near?.id ?? null, limit: req.limit });
        if (!v.ok) return { kind: 'unknown' };
        const summary = describePlan(v.plan, undefined, near ? { ko: near.ko ?? near.name, en: near.name } : undefined);
        return near ? { kind: 'list', plan: v.plan, near, summary } : { kind: 'list', plan: v.plan, summary };
      }
      if (hits.length) return asObject();
      return { kind: 'unknown' };
    },
  };
}
