// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Typo tolerance: bounded Damerau-Levenshtein distance (optimal string alignment: insert, delete,
// substitute, swap two neighbours) and a bigram index that proposes candidate strings cheaply.
// Strings are compared in UTF-16 units (all indexed text is in the BMP); Hangul is passed in already decomposed to jamo.

import { digitsOf } from './normalize';
import { syllableCount } from './hangul';

/** Distance between a and b, or max + 1 as soon as it is certain to exceed max. */
export function damerauLevenshtein(a: string, b: string, max: number): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[m]!;
}

/**
 * How many edits a typed word may carry. Short words get none (too many accidental neighbours).
 * Latin: <= 4 letters 0, 5-7 letters 1, 8+ letters 2. Hangul (counted in syllables, compared in jamo):
 * <= 2 syllables 0, 3-4 syllables 1, 5+ syllables 2.
 */
export function editLimit(original: string, jamoLength: number): number {
  const syl = syllableCount(original);
  if (syl > 0) return syl <= 2 ? 0 : syl <= 4 ? 1 : 2;
  return jamoLength <= 4 ? 0 : jamoLength <= 7 ? 1 : 2;
}

export interface FuzzyHit {
  id: number;
  dist: number;
}

/** Bigram code of two UTF-16 units; 2 and 3 pad the start and the end of a string. */
const gram = (a: number, b: number): number => a * 65536 + b;

function gramsOf(s: string): number[] {
  const out: number[] = [];
  let prev = 2;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const g = gram(prev, c);
    if (!out.includes(g)) out.push(g);
    prev = c;
  }
  const g = gram(prev, 3);
  if (!out.includes(g)) out.push(g);
  return out;
}

/** Bigram index over a vocabulary of strings (ids are positions in the vocabulary). */
export class NgramIndex {
  readonly strings: string[] = [];
  private readonly digits: string[] = [];
  private readonly postings = new Map<number, number[]>();
  private counts = new Int32Array(0);

  add(s: string): number {
    const id = this.strings.length;
    this.strings.push(s);
    this.digits.push(/\d/.test(s) ? digitsOf(s) : '');
    for (const g of gramsOf(s)) {
      const p = this.postings.get(g);
      if (p) p.push(id);
      else this.postings.set(g, [id]);
    }
    return id;
  }

  /**
   * Strings within `max` edits of q whose digits equal q's digits exactly (catalogue numbers never match
   * fuzzily). A string within k edits shares at least (bigrams - 3k) bigrams with q (one swap of
   * neighbours can break three), which filters the candidates before the exact distance is computed.
   */
  search(q: string, max: number, limit = 20): FuzzyHit[] {
    if (max <= 0 || !q) return [];
    const grams = gramsOf(q);
    const need = Math.max(1, grams.length - 3 * max);
    if (this.counts.length < this.strings.length) this.counts = new Int32Array(this.strings.length);
    const counts = this.counts;
    const touched: number[] = [];
    for (const g of grams) {
      const p = this.postings.get(g);
      if (!p) continue;
      for (const id of p) {
        if (counts[id] === 0) touched.push(id);
        counts[id]!++;
      }
    }
    const qd = /\d/.test(q) ? digitsOf(q) : '';
    const hits: FuzzyHit[] = [];
    for (const id of touched) {
      const c = counts[id]!;
      counts[id] = 0;
      const s = this.strings[id]!;
      if (c < need || Math.abs(s.length - q.length) > max || this.digits[id] !== qd) continue;
      const d = damerauLevenshtein(q, s, max);
      if (d <= max && d > 0) hits.push({ id, dist: d });
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits.slice(0, limit);
  }
}
