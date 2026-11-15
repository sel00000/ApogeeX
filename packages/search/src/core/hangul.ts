// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Hangul helpers: syllable -> jamo decomposition (so typos and half-typed syllables compare letter by
// letter) and initial-consonant (choseong) extraction for "ㅇㄷㄹㅁㄷ"-style searches.

const S_BASE = 0xac00;
const S_END = 0xd7a3;
// Compatibility jamo, so a syllable and a standalone typed letter decompose to the same characters.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// Standalone compound letters typed on their own split the same way as inside a syllable.
const COMPOUND: Record<string, string> = {
  ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
};

export const isSyllable = (c: string): boolean => {
  const k = c.charCodeAt(0);
  return k >= S_BASE && k <= S_END;
};

const HANGUL_RE = /[가-힣ㄱ-ㆎᄀ-ᇿ]/;
// NFKC turns typed compatibility jamo (ㅇ U+3147) into conjoining jamo (ᄋ U+110B); map them back.
const CONJ_CHO = 0x1100;
const CONJ_JUNG = 0x1161;
const CONJ_JONG = 0x11a8;
function compatOf(k: number): string | null {
  if (k >= CONJ_CHO && k < CONJ_CHO + 19) return CHO[k - CONJ_CHO]!;
  if (k >= CONJ_JUNG && k < CONJ_JUNG + 21) return JUNG[k - CONJ_JUNG]!;
  if (k >= CONJ_JONG && k < CONJ_JONG + 27) return JONG[k - CONJ_JONG + 1]!;
  return null;
}
export const hasHangul = (s: string): boolean => HANGUL_RE.test(s);

/** Decompose Hangul syllables into compatibility jamo; other characters are kept as they are. */
export function toJamo(s: string): string {
  if (!HANGUL_RE.test(s)) return s;
  let out = '';
  for (const c of s) {
    const k = c.charCodeAt(0);
    if (k >= S_BASE && k <= S_END) {
      const i = k - S_BASE;
      out += CHO[Math.floor(i / 588)]! + JUNG[Math.floor((i % 588) / 28)]! + JONG[i % 28]!;
    } else if (k >= 0x1100 && k <= 0x11ff) out += compatOf(k) ?? c;
    else out += COMPOUND[c] ?? c;
  }
  return out;
}

/** Initial consonants of the Hangul syllables (other characters dropped): "안드로메다 은하" -> "ㅇㄷㄹㅁㄷㅇㅎ". */
export function initials(s: string): string {
  let out = '';
  for (const c of s) {
    const k = c.charCodeAt(0);
    if (k >= S_BASE && k <= S_END) out += CHO[Math.floor((k - S_BASE) / 588)];
  }
  return out;
}

const CONSONANTS_ONLY = /^[ㄱ-ㅎ\s]+$/;
/** True for a query made only of initial consonants, at least two of them. */
export function isInitialsQuery(s: string): boolean {
  return CONSONANTS_ONLY.test(s) && s.replace(/\s/g, '').length >= 2;
}

/** Number of Hangul syllables in a string. */
export function syllableCount(s: string): number {
  let n = 0;
  for (const c of s) if (isSyllable(c)) n++;
  return n;
}
