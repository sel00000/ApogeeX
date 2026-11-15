// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// Rule-based reading of the search box: coordinates, and simple descriptive list requests of the form
// [ordering] type [near X] [count], in Korean or English, through fixed word tables.
// The rule is strict on purpose: after the known phrases are removed nothing may be left over,
// otherwise the request is not understood (the caller then answers "unknown").

                                   

/** Decimal degrees ("10.684 41.269", "10.684, +41.269") or sexagesimal RA in hours ("05:35:17.3 -05:23:28", "5h35m17s -5d23m28s"). */
export function parseCoords(text        )                                     {
  const s = text.normalize('NFKC').replace(/−/g, '-').trim().replace(/[,;]/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  const dm = s.match(/^([+]?\d+(?:\.\d*)?)\s*(?:d|°|deg)?\s+([+-]?\d+(?:\.\d*)?)\s*(?:d|°|deg)?$/i);
  if (dm) {
    const ra = Number(dm[1]);
    const dec = Number(dm[2]);
    // Two bare integers are more likely something else ("10 20"); require a decimal point or a sign/degree mark.
    if (!/[.°d+-]/i.test(s)) return null;
    return ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 ? { ra, dec } : null;
  }
  const t = s.replace(/[hHdD°:'′"″mMsS]/g, ' ').replace(/\s+/g, ' ').trim();
  const sm = t.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}(?:\.\d*)?) ([+-]?)(\d{1,2}) (\d{1,2}) (\d{1,2}(?:\.\d*)?)$/);
  if (!sm) return null;
  const h = Number(sm[1]) + Number(sm[2]) / 60 + Number(sm[3]) / 3600;
  const d = Number(sm[5]) + Number(sm[6]) / 60 + Number(sm[7]) / 3600;
  if (h >= 24 || Number(sm[2]) >= 60 || Number(sm[3]) >= 60 || Number(sm[6]) >= 60 || Number(sm[7]) >= 60 || d > 90) return null;
  return { ra: h * 15, dec: (sm[4] === '-' ? -1 : 1) * d };
}

/** Type key -> phrases (Korean phrases match with or without spaces). */
export const TYPE_WORDS                           = {
  star: ['별', '항성', 'stars', 'star'],
  brown_dwarf: ['갈색왜성', '갈색 왜성', 'brown dwarfs', 'brown dwarf'],
  red_dwarf: ['적색왜성', '적색 왜성', 'red dwarfs', 'red dwarf', 'low mass stars', 'low mass star'],
  white_dwarf: ['백색왜성', '백색 왜성', 'white dwarfs', 'white dwarf'],
  neutron_star: ['중성자별', 'neutron stars', 'neutron star'],
  pulsar: ['펄서', 'pulsars', 'pulsar'],
  black_hole: ['블랙홀', 'black holes', 'black hole', 'x ray binaries', 'x ray binary'],
  variable_star: ['변광성', 'variable stars', 'variable star', 'variables'],
  mira_variable: ['미라형 변광성', '미라 변광성', 'mira variables', 'mira variable', 'miras'],
  cepheid: ['세페이드 변광성', '세페이드', 'cepheid variables', 'cepheid variable', 'cepheids', 'cepheid'],
  eclipsing_binary: ['식쌍성', '식 쌍성', 'eclipsing binaries', 'eclipsing binary'],
  nova: ['신성', '격변 변광성', 'novae', 'novas', 'nova', 'cataclysmic variables', 'cataclysmic variable'],
  supernova: ['초신성', 'supernovae', 'supernovas', 'supernova'],
  red_giant: ['적색거성', '적색 거성', '붉은 거성', 'red giants', 'red giant'],
  red_supergiant: ['적색초거성', '적색 초거성', '붉은 초거성', 'red supergiants', 'red supergiant'],
  blue_supergiant: ['청색초거성', '청색 초거성', '푸른 초거성', 'blue supergiants', 'blue supergiant'],
  wolf_rayet: ['울프 레이에 별', '울프레이에별', 'wolf rayet stars', 'wolf rayet star'],
  carbon_star: ['탄소별', 'carbon stars', 'carbon star'],
  young_star: ['어린 별', '아기 별', '젊은 별', 'young stars', 'young star', 'young stellar objects', 'baby stars'],
  planetary_nebula: ['행성상 성운', '행성상성운', 'planetary nebulae', 'planetary nebulas', 'planetary nebula'],
  supernova_remnant: ['초신성 잔해', '초신성잔해', 'supernova remnants', 'supernova remnant'],
  star_forming_region: ['별 탄생 영역', '별 생성 영역', '별 형성 영역', 'star forming regions', 'star forming region'],
  dark_nebula: ['암흑성운', '암흑 성운', 'dark nebulae', 'dark nebulas', 'dark nebula'],
  reflection_nebula: ['반사성운', '반사 성운', 'reflection nebulae', 'reflection nebulas', 'reflection nebula'],
  nebula: ['성운', 'nebulae', 'nebulas', 'nebula'],
  open_cluster: ['산개성단', '산개 성단', 'open clusters', 'open cluster'],
  globular_cluster: ['구상성단', '구상 성단', 'globular clusters', 'globular cluster'],
  galaxy: ['은하', 'galaxies', 'galaxy'],
  quasar: ['퀘이사', 'quasars', 'quasar'],
  active_galaxy: ['활동은하', '활동 은하', 'active galaxies', 'active galaxy'],
  radio_galaxy: ['전파은하', '전파 은하', 'radio galaxies', 'radio galaxy'],
  starburst_galaxy: ['폭발적 별 생성 은하', '스타버스트 은하', 'starburst galaxies', 'starburst galaxy'],
  interacting_galaxies: ['상호작용 은하', '충돌 은하', 'interacting galaxies', 'colliding galaxies'],
  galaxy_cluster: ['은하단', 'galaxy clusters', 'galaxy cluster', 'clusters of galaxies'],
  gravitational_lens: ['중력렌즈', '중력 렌즈', 'gravitational lenses', 'gravitational lens'],
};

const SORT_WORDS                         = {
  nearest: ['태양에서 가장 가까운', '지구에서 가장 가까운', '가장 가까운', '제일 가까운', '가까운', 'nearest', 'closest'],
  brightest: ['가장 밝은', '제일 밝은', '밝은', 'brightest'],
  fastest: ['가장 빨리 움직이는', '제일 빨리 움직이는', '빨리 움직이는', '가장 빠른', '제일 빠른', 'fastest moving', 'fastest'],
  largest: ['가장 크게 보이는', '제일 크게 보이는', '크게 보이는', '가장 큰', '제일 큰', 'largest', 'biggest'],
  famous: ['가장 유명한', '제일 유명한', '유명한', '잘 알려진', 'most famous', 'famous', 'best known', 'well known', 'most studied'],
};

/** Words that carry no meaning here; anything else left over makes the request "not understood". */
const FILLERS = [
  '밤하늘에서', '밤하늘의', '하늘에서', '하늘의', '우주에서', '중에서', '중', '의', '목록', '보여줘', '보여 줘', '알려줘', '알려 줘', '찾아줘', '찾아 줘',
  'to the sun', 'to earth', 'from earth', 'from the sun', 'in the sky', 'on the sky', 'show me', 'list of', 'find', 'the', 'top', 'most', 'some', 'all', 'of', 'me', 'list',
];
const NEAR_KO = /^(.+?)\s*(?:근처|주변|부근|가까이)\s*(?:의|에\s*있는|에서|에)?\s+(.+)$/;
const NEAR_EN = /^(.+?)\s+(?:near|around|close to|next to)\s+(.+)$/;
const COUNT_RE = /(?:^|\s)(?:top\s+)?(\d{1,3})\s*(?:개|곳)?(?:의)?(?=\s|$)/;
// What may be left once the phrases are removed: nothing. Particles are accepted only inside a phrase match (see phraseRe).
const LEFTOVER_OK = /^\s*$/;

                              
               
             
                                                                             
                          
                
                                                                                      
                     
 

function canon(text        )         {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,;:!?()"“”/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const esc = (s        ) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasFinal = (c        )          => (c.charCodeAt(0) - 0xac00) % 28 !== 0;
// Korean fillers may follow a noun or precede a modifier with no space between ("별목록", "은하중에서", "밤하늘에서가장밝은별").
const koFillers = (minSyllables        ) => FILLERS.filter((f) => /[가-힣]/.test(f) && f.replace(/\s/g, '').length >= minSyllables)
  .sort((a, b) => b.length - a.length).map((f) => f.split(' ').map(esc).join('\\s*')).join('|');
const KO_FILLER_ALT = koFillers(1);
// In front of a glued type noun only these place fillers count. The list fillers (목록, 보여줘, ...) must not: "목록별"
// is an ordinary word, and "의" or "중" alone would read "주의별" or "중별" as stars.
const PLACE_FILLERS = ['밤하늘에서', '밤하늘의', '하늘에서', '하늘의', '우주에서', '중에서'];
// Fail at load time if the list drifts from FILLERS (the leftover check relies on every entry being a filler).
for (const f of PLACE_FILLERS) if (!FILLERS.includes(f)) throw new Error(`PLACE_FILLERS entry not in FILLERS: ${f}`);
const KO_PLACE_FILLER_ALT = [...PLACE_FILLERS].sort((a, b) => b.length - a.length).map(esc).join('|');
/**
 * Phrase -> regex. Latin phrases need word boundaries. A Korean phrase tolerates missing or extra spaces inside it.
 * A Korean type word must start the text, follow a space, or follow one of the place fillers in PLACE_FILLERS glued to
 * it ("밤하늘의별", "우주에서은하"); other fillers do not count: not 의 or 중 alone ("이별", "주의별" are not requests
 * for stars), and not 목록, 보여줘, 알려줘, 찾아줘 ("목록별", "보여줘별" are not list requests). A noun phrase ('noun') may be followed by the plural 들 and by one particle that agrees with its last
 * syllable (별이, 은하가, 별들을; never 별가 or 은하이), and then ends the word or runs straight into a Korean filler
 * ("별목록", "은하중에서"). A modifier (an ordering) may follow a space, the start or any Korean filler, and be followed
 * directly by the next word ("가까운별", "하늘에서가장밝은"). Fillers match anywhere. The filler in front is part of the
 * match (no lookbehind: old Safari cannot compile one); the caller replaces the whole match by a space and drops
 * fillers anyway.
 */
function phraseRe(p        , role                                 = 'noun')         {
  if (/[가-힣]/.test(p)) {
    const body = p.split(' ').map(esc).join('\\s*');
    if (role === 'filler') return new RegExp(body);
    if (role === 'modifier') return new RegExp(`(?:^|\\s|(?:${KO_FILLER_ALT}))${body}`);
    const own = hasFinal(p[p.length - 1] ) ? '이|은|을' : '가|는|를';
    return new RegExp(`(?:^|\\s|(?:${KO_PLACE_FILLER_ALT}))${body}(?:들(?:이|은|을|의|만)?|(?:${own}|의|만))?(?=\\s|$|${KO_FILLER_ALT})`);
  }
  return new RegExp(`(?:^|\\s)${p.split(' ').map(esc).join('\\s+')}(?=\\s|$)`);
}
const byLength = (a                          , b                          ) => b[0].length - a[0].length;
const TYPE_TABLE                             = Object.entries(TYPE_WORDS)
  .flatMap(([k, ps]) => ps.map((p) => [p, phraseRe(p), k]                            ))
  .sort(byLength);
const SORT_TABLE                             = Object.entries(SORT_WORDS)
  .flatMap(([k, ps]) => ps.map((p) => [p, phraseRe(p, 'modifier'), k]                            ))
  .sort(byLength);
const FILLER_TABLE           = [...FILLERS].sort((a, b) => b.length - a.length).map((p) => phraseRe(p, 'filler'));

/** Parse a descriptive list request, or return null when any part of it is not understood. */
export function parseListRequest(text        )                     {
  let s = canon(text);
  if (!s) return null;
  let nearText                = null;
  const nk = NEAR_KO.exec(s);
  const ne = nk ? null : NEAR_EN.exec(s);
  if (nk) {
    nearText = nk[1] .trim();
    s = nk[2] ;
  } else if (ne) {
    nearText = ne[2] .replace(/^the\s+/, '').trim();
    s = ne[1] ;
  }
  let limit = 10;
  let counted = false;
  const c = COUNT_RE.exec(s);
  if (c) {
    limit = Math.min(20, Math.max(1, Number(c[1])));
    counted = true;
    s = s.replace(COUNT_RE, ' ');
  }
  let sort              = null;
  for (const [, re, k] of SORT_TABLE) {
    if (re.test(s)) {
      sort = k        ;
      s = s.replace(re, ' ');
      break;
    }
  }
  let type                = null;
  for (const [, re, k] of TYPE_TABLE) {
    if (re.test(s)) {
      type = k;
      s = s.replace(re, ' ');
      break;
    }
  }
  if (!type) return null;
  for (const re of FILLER_TABLE) s = s.replace(re, ' ');
  if (!LEFTOVER_OK.test(s)) return null;
  return { type, sort: sort ?? 'famous', nearText, limit, qualified: !!(sort || nearText || counted) };
}
