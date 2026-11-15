// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Relevance score of one (query, name) match.
//
//   score = TIER[match]                      how the name matched: exact 100 > prefix 60 > initials 55 > word 50 > fuzzy 40
//         + W_BM25 * Σ bm25(word)            query words found in the name, weighted by rarity (BM25, tf = 1)
//         + W_POP  * log10(1 + nbref)        popularity prior: papers that mention the object (SIMBAD nbref)
//         + W_COVER * |query| / |name|       how much of the name the query covers (prefers "Vega" over "Vega Superclump")
//         - W_EDIT * edits                   typo corrections needed (Damerau-Levenshtein)
//         - W_EXTRA * extra words            words of the name that the query did not mention
//         - W_STUB  * [designation stub]     1 when a prefix match only reaches into the first word of a catalogue
//                                            designation ("bet" in "bet Per"): that is a spelling of a Greek letter or a
//                                            catalogue code, not a name, so common names ("Betelgeuse") go first
//         + W_APP   * [app target]           1 for an object the app added itself (createSkySearch option `extra`)
//
// Fuzzy matches that only fit the leading word of a longer name ("안드로매다" for "안드로메다 은하") are scored like
// any fuzzy match (tier 40, W_EDIT per edit, coverage = how little of the name the query spans, W_EXTRA per unmentioned
// word) but are never confident (see search.ts).
//
// BM25 for one word: idf * (k1 + 1) / (1 + k1 * (1 - b + b * len / avgLen)), idf = ln(1 + (N - df + 0.5) / (df + 0.5)),
// N = number of names, df = names containing the word, len = words in the name. The tier gaps are larger than what
// popularity can add (W_POP * ~4.5 = 18 at most), so a weaker kind of match beats a stronger one only between
// prefix/word/initials, where that is intended: a very famous prefix hit may outrank an obscure whole-word hit.
// W_APP (18) equals the largest popularity bonus, so an app target wins any tie with an indexed object of the same
// match kind, but never lifts a fuzzy match over an exact one (tier gap 60).

export type MatchKind = 'exact' | 'prefix' | 'word' | 'fuzzy' | 'initials';

export const TIER: Record<MatchKind, number> = { exact: 100, prefix: 60, initials: 55, word: 50, fuzzy: 40 };
export const W_BM25 = 0.5;
export const W_POP = 4;
export const W_COVER = 10;
export const W_EDIT = 12;
export const W_EXTRA = 2;
export const W_STUB = 8;
export const W_APP = 18;
const K1 = 1.2;
const B = 0.75;

export function idf(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

export function bm25Word(df: number, n: number, len: number, avgLen: number): number {
  return (idf(df, n) * (K1 + 1)) / (1 + K1 * (1 - B + (B * len) / avgLen));
}

export const popularity = (nbref: number): number => Math.log10(1 + Math.max(0, nbref));

export interface ScoreParts {
  kind: MatchKind;
  bm25: number;
  nbref: number;
  coverage: number;
  edits: number;
  extra: number;
  stub?: boolean;
  app?: boolean;
}

export function score(p: ScoreParts): number {
  return (
    TIER[p.kind] +
    W_BM25 * p.bm25 +
    W_POP * popularity(p.nbref) +
    W_COVER * Math.min(1, p.coverage) -
    W_EDIT * p.edits -
    W_EXTRA * Math.max(0, p.extra) -
    (p.stub ? W_STUB : 0) +
    (p.app ? W_APP : 0)
  );
}
