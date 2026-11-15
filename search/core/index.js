// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Build the in-memory search structures from the baked index (data/sky-index.json).
// Every searchable name of an object becomes an Entry; entries are numbered in object popularity order
// (the baked objects are sorted by nbref, descending), so every posting list is already popularity-sorted.

import { SearchError } from '../i18n.js';
import { compact, displayId, normalize, starNameVariants, tokens } from './normalize.js';
import { hasHangul, initials, toJamo } from './hangul.js';
import { NgramIndex } from './fuzzy.js';

/** One baked object: [main_id, ra, dec, otype, nbref, aliases, korean names]. */
                                                                                            

                               
            
                    
                                 
                       
 

/** Reject a stale HTML response, unsupported schema or malformed catalogue at the load boundary. */
export function validateIndexData(value         )                                {
  if (!value || typeof value !== 'object') throw new SearchError('indexNotObject');
  const data = value                ;
  if (data.v !== 1) throw new SearchError('indexVersion');
  if (!data.otypes || typeof data.otypes !== 'object' || Array.isArray(data.otypes)
    || Object.values(data.otypes).some(v => typeof v !== 'string') || !Array.isArray(data.objects)) {
    throw new SearchError('indexFormat');
  }
  for (let i = 0; i < data.objects.length; i++) {
    const row = data.objects[i];
    if (!Array.isArray(row) || row.length !== 7 || typeof row[0] !== 'string' || !row[0].trim()
      || typeof row[1] !== 'number' || !Number.isFinite(row[1]) || row[1] < 0 || row[1] >= 360
      || typeof row[2] !== 'number' || !Number.isFinite(row[2]) || row[2] < -90 || row[2] > 90
      || (row[3] !== null && typeof row[3] !== 'string') || !Number.isFinite(row[4]) || row[4] < 0
      || !Array.isArray(row[5]) || row[5].some(v => typeof v !== 'string')
      || !Array.isArray(row[6]) || row[6].some(v => typeof v !== 'string')) {
      throw new SearchError('indexRow', { n: i + 1 });
    }
  }
}

                            
                                                                     
             
                                                              
               
                                   
                    
             
              
                
                     
                
                                                           
                    
                    
                                                                     
                  
 

                                            

                        
              
                                                                             
               
                  
                                                     
                 
                                                                   
              
 

                              
                       
                   
                         
                               
                                                                    
                                 
                                                                             
                                 
                          
                                  
                                                       
                    
                                                     
                                             
                 
 

const PREFIX1_CAP = 64;

function push   (m                  , k   , v        )       {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

/** `nExtra`: the first nExtra records are app-specific targets (they come first, so they win ties). */
export function buildIndex(data              , nExtra = 0)              {
  validateIndexData(data);
  const objects              = [];
  const entries          = [];
  const exact = new Map                  ();
  const prefix2 = new Map                  ();
  const prefix1 = new Map                  ();
  const postings = new Map                  ();
  const vocab = new NgramIndex();
  const inVocab = new Set        ();
  const ini                                   = [];
  let lenSum = 0;

  const addVocab = (s        ) => {
    if (!inVocab.has(s)) {
      inVocab.add(s);
      vocab.add(s);
    }
  };

  for (const [main, ra, dec, rawType, nbref, aliases, ko] of data.objects) {
    const otype = rawType ?? '';
    const o = objects.length;
    // Display name: a word-like common name ("Large Magellanic Cloud" rather than "LMC"), else any common name.
    const names = [main, ...aliases].filter((a) => a.startsWith('NAME '));
    // An app target keeps its own label, also when names of an index twin were merged into it.
    const firstName = o < nExtra ? undefined : (names.find((a) => /[a-z]{3}/.test(a.slice(5))) ?? names[0]);
    objects.push({
      id: main,
      name: displayId(firstName ?? main),
      ko: ko[0] ?? null,
      ra,
      dec,
      otype,
      otypeLabel: data.otypes?.[otype] ?? otype,
      nbref,
      aliases,
      koNames: ko,
      ...(o < nExtra ? { extra: true } : {}),
    });
    const seen = new Set        ();
    const addEntry = (text        , source        , lang           ) => {
      const norm = normalize(source);
      if (!norm) return;
      const key = toJamo(compact(norm));
      if (seen.has(key)) return;
      seen.add(key);
      const toks = tokens(norm).map(toJamo);
      const e = entries.length;
      entries.push({ obj: o, text, lang, toks, key });
      lenSum += toks.length;
      push(exact, key, e);
      // Keys are compared in UTF-16 units: all indexed text is in the BMP.
      const p1 = key[0] ;
      const l1 = prefix1.get(p1);
      if (!l1) prefix1.set(p1, [e]);
      else if (l1.length < PREFIX1_CAP) l1.push(e);
      if (key.length >= 2) push(prefix2, key.slice(0, 2), e);
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i] ;
        if (toks.indexOf(t) !== i) continue;
        push(postings, t, e);
        addVocab(t);
      }
      // Whole multi-word names join the typo vocabulary (spacing-free typos such as "안드로매다은하");
      // names with digits do not: their numbers must match exactly anyway.
      if (toks.length > 1 && !/\d/.test(key)) addVocab(key);
      if (lang === 'ko') {
        const i = initials(source);
        if (i.length >= 2) ini.push({ entry: e, ini: i });
      }
    };
    for (const id of [main, ...aliases]) {
      addEntry(displayId(id), id, id.startsWith('NAME ') || o < nExtra ? 'en' : 'cat');
      for (const v of starNameVariants(id)) addEntry(v, v, 'cat');
    }
    for (const k of ko) addEntry(k, k, hasHangul(k) ? 'ko' : 'en');
  }
  return { objects, entries, exact, prefix2, prefix1, postings, vocab, initials: ini, avgLen: entries.length ? lenSum / entries.length : 1 };
}
