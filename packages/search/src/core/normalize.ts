// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Text normalisation shared by the index and the queries, plus catalogue-name helpers
// (display names, Bayer/Flamsteed spellings). Query and index go through the same function,
// so any two spellings that normalise to the same string are treated as the same name.

/** SIMBAD Greek-letter abbreviation -> full English name. */
export const GREEK: Record<string, string> = {
  alf: 'alpha', bet: 'beta', gam: 'gamma', del: 'delta', eps: 'epsilon', zet: 'zeta', eta: 'eta', tet: 'theta',
  iot: 'iota', kap: 'kappa', lam: 'lambda', mu: 'mu', nu: 'nu', ksi: 'xi', omi: 'omicron', pi: 'pi', rho: 'rho',
  sig: 'sigma', tau: 'tau', ups: 'upsilon', phi: 'phi', chi: 'chi', psi: 'psi', ome: 'omega',
};
const GREEK_UNICODE = 'αβγδεζηθικλμνξοπρστυφχψω';
const GREEK_ABBR = ['alf', 'bet', 'gam', 'del', 'eps', 'zet', 'eta', 'tet', 'iot', 'kap', 'lam', 'mu', 'nu', 'ksi', 'omi', 'pi', 'rho', 'sig', 'tau', 'ups', 'phi', 'chi', 'psi', 'ome'];
const UNICODE_TO_ABBR = new Map<string, string>([...GREEK_UNICODE].map((c, i) => [c, GREEK_ABBR[i]!]));
UNICODE_TO_ABBR.set('ς', 'sig');
UNICODE_TO_ABBR.set('ϑ', 'tet');
UNICODE_TO_ABBR.set('ϕ', 'phi');
/** Full Greek letter names (and common variants) -> SIMBAD abbreviation. */
const WORD_TO_ABBR = new Map<string, string>(Object.entries(GREEK).map(([a, w]) => [w, a]));
WORD_TO_ABBR.set('alfa', 'alf');
WORD_TO_ABBR.set('ksi', 'ksi');
// Catalogue words people type that SIMBAD spells differently (one-to-one, never ambiguous).
WORD_TO_ABBR.set('gliese', 'gj');

/** IAU constellation abbreviation -> Latin genitive. */
export const CONSTELLATIONS: Record<string, string> = {
  And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae',
  Boo: 'Bootis', Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris',
  Cap: 'Capricorni', Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini',
  Col: 'Columbae', Com: 'Comae Berenices', CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis',
  Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum',
  Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis',
  LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii',
  Mon: 'Monocerotis', Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi',
  Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium', PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli',
  Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri',
  Tel: 'Telescopii', Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris',
  Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae',
};

// SIMBAD prefixes: NAME, * (star), ** (double), V* (variable), and X for X-ray names such as "X Cyg X-1".
const PREFIX_RE = /^(?:name|\*\*|\*|v\*|x(?=\s+[a-z]{3}\s+x[\s-]*\d))\s+(?=\S)/;
const PUNCT_RE = /[.,;:!?()[\]{}"“”‘’`´/\\_~|·・<>=&#@%^\s-]+/g;
const APOS_RE = /['ʼ]/g;
const MESSIER_RE = /(^|\s)(?:messier|메시에)\s*(?=\d)/g;
const LETTER_DIGIT_RE = /(^|\s)([a-z]+)(?=\d)/g;
const LEADING_ZERO_RE = /(^|\s)0+(?=\d)/g;
const ASCII_RE = /^[\x00-\x7f]*$/;
const GREEK_RE = /[α-ως]/;
const DIGIT_RE = /\d/;

/**
 * Canonical spaced form: NFKC, lower case, SIMBAD prefixes ("NAME ", "* ", "V* ") removed, Greek letters
 * and Greek letter names as SIMBAD abbreviations, "Messier"/"메시에" as "m", a space between a leading
 * catalogue word and its number ("ngc7293" -> "ngc 7293"), leading zeros dropped, punctuation as spaces.
 */
export function normalize(text: string): string {
  // NFKC only matters outside ASCII (full-width letters, superscript digits, compatibility jamo).
  let s = (ASCII_RE.test(text) ? text : text.normalize('NFKC')).toLowerCase().trim();
  s = s.replace(PREFIX_RE, '');
  if (GREEK_RE.test(s)) {
    let t = '';
    for (const c of s) {
      const a = UNICODE_TO_ABBR.get(c);
      t += a ? ` ${a} ` : c;
    }
    s = t;
  }
  s = s.replace(APOS_RE, '').replace(PUNCT_RE, ' ');
  if (s.includes('messier') || s.includes('메시에')) s = s.replace(MESSIER_RE, '$1m ');
  if (DIGIT_RE.test(s)) s = s.replace(LETTER_DIGIT_RE, '$1$2 ').replace(LEADING_ZERO_RE, '$1');
  const words = s.split(' ');
  let out = '';
  for (const w of words) {
    if (!w) continue;
    const a = WORD_TO_ABBR.get(w);
    out += (out ? ' ' : '') + (a ?? w);
  }
  return out;
}

export const tokens = (norm: string): string[] => (norm ? norm.split(' ') : []);
export const compact = (norm: string): string => norm.replace(/ /g, '');
/** All digits of a string, in order: fuzzy matching may only pair strings whose digits are identical. */
export const digitsOf = (s: string): string => s.replace(/\D+/g, '');

/** Human-readable form of a SIMBAD identifier: "NAME Andromeda Galaxy" -> "Andromeda Galaxy", "* alf Ori" -> "alf Ori". */
export function displayId(id: string): string {
  return id.replace(/^(?:NAME|\*\*|\*|V\*|X(?= [A-Z][a-z]{2} X-\d))\s+(?=\S)/, '');
}

const BAYER_RE = /^(?:\*|V\*) ([a-z]{2,3})(\d{0,2}) ([A-Z][A-Za-z]{2})((?: [A-Z])?)$/;
const FLAMSTEED_RE = /^\* (\d{1,3}) ([A-Z][A-Za-z]{2})((?: [A-Z])?)$/;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Extra typeable spellings of a Bayer or Flamsteed identifier, beyond what normalize() already unifies
 * ("alf Ori" = "alpha Ori" = "α Ori"): the Latin genitive forms "Alpha Orionis", "61 Cygni".
 */
export function starNameVariants(id: string): string[] {
  const b = BAYER_RE.exec(id);
  if (b && GREEK[b[1]!] && CONSTELLATIONS[b[3]!]) {
    const num = b[2] ? String(Number(b[2])) : '';
    return [`${cap(GREEK[b[1]!]!)}${num} ${CONSTELLATIONS[b[3]!]}${b[4]}`];
  }
  const f = FLAMSTEED_RE.exec(id);
  if (f && CONSTELLATIONS[f[2]!]) return [`${f[1]} ${CONSTELLATIONS[f[2]!]}${f[3]}`];
  return [];
}
