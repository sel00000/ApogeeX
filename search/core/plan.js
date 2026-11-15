// AI-assisted code (Claude) written during NASA Space Apps Challenge 2026. See AI_USE.md.
// "List" requests: a small checked plan (object type, ordering, optional place, count) and its
// translation into one ADQL query for SIMBAD TAP. Only values from the closed lists below and numbers
// ever reach the query text. Ported from a tested prototype; the query forms were run against
// https://simbad.harvard.edu/simbad/sim-tap/sync.

                          
                                                                      
                   
                                                                             
                   
             
             
 

/** Friendly type key -> SIMBAD object types. */
export const TYPES                          = {
  star: { otypes: ['*..'], stellar: true, ko: '별', en: 'stars' },
  brown_dwarf: { otypes: ['BD*'], stellar: true, ko: '갈색왜성', en: 'brown dwarfs' },
  red_dwarf: { otypes: ['LM*'], stellar: true, ko: '적색왜성(저질량 별)', en: 'low-mass stars' },
  white_dwarf: { otypes: ['WD*'], stellar: true, ko: '백색왜성', en: 'white dwarfs' },
  neutron_star: { otypes: ['N*..'], stellar: true, ko: '중성자별', en: 'neutron stars' },
  pulsar: { otypes: ['Psr'], stellar: true, ko: '펄서', en: 'pulsars' },
  black_hole: { otypes: ['BH', 'XB*..'], stellar: true, ko: '블랙홀과 X선 쌍성', en: 'black holes and X-ray binaries' },
  variable_star: { otypes: ['V*..', 'Mi*', 'Ce*..', 'RR*', 'LP*..', 'EB*'], stellar: true, ko: '변광성', en: 'variable stars' },
  mira_variable: { otypes: ['Mi*'], stellar: true, ko: '미라형 변광성', en: 'Mira variables' },
  cepheid: { otypes: ['Ce*..'], stellar: true, ko: '세페이드 변광성', en: 'Cepheids' },
  eclipsing_binary: { otypes: ['EB*'], stellar: true, ko: '식쌍성', en: 'eclipsing binaries' },
  nova: { otypes: ['CV*..'], stellar: true, ko: '신성과 격변 변광성', en: 'novae and cataclysmic variables' },
  supernova: { otypes: ['SN*'], stellar: false, ko: '초신성', en: 'supernovae' },
  red_giant: { otypes: ['RG*', 'AB*..', 'LP*..'], stellar: true, ko: '적색거성', en: 'red giants' },
  red_supergiant: { otypes: ['s*r'], stellar: true, ko: '적색초거성', en: 'red supergiants' },
  blue_supergiant: { otypes: ['s*b..'], stellar: true, ko: '청색초거성', en: 'blue supergiants' },
  wolf_rayet: { otypes: ['WR*'], stellar: true, ko: '울프-레이에 별', en: 'Wolf-Rayet stars' },
  carbon_star: { otypes: ['C*'], stellar: true, ko: '탄소별', en: 'carbon stars' },
  young_star: { otypes: ['Y*O..'], stellar: true, ko: '어린 별', en: 'young stars' },
  planetary_nebula: { otypes: ['PN'], stellar: false, ko: '행성상 성운', en: 'planetary nebulae' },
  supernova_remnant: { otypes: ['SNR'], stellar: false, ko: '초신성 잔해', en: 'supernova remnants' },
  star_forming_region: { otypes: ['SFR', 'HII', 'MoC'], stellar: false, ko: '별 탄생 영역', en: 'star-forming regions' },
  dark_nebula: { otypes: ['DNe'], stellar: false, ko: '암흑성운', en: 'dark nebulae' },
  reflection_nebula: { otypes: ['RNe'], stellar: false, ko: '반사성운', en: 'reflection nebulae' },
  nebula: { otypes: ['GNe..', 'HII', 'PN', 'SNR', 'DNe'], stellar: false, ko: '성운', en: 'nebulae' },
  open_cluster: { otypes: ['OpC'], stellar: false, ko: '산개성단', en: 'open clusters' },
  globular_cluster: { otypes: ['GlC'], stellar: false, ko: '구상성단', en: 'globular clusters' },
  galaxy: { otypes: ['G..'], stellar: false, ko: '은하', en: 'galaxies' },
  quasar: { otypes: ['QSO..'], stellar: false, ko: '퀘이사', en: 'quasars' },
  active_galaxy: { otypes: ['AGN..'], stellar: false, ko: '활동은하', en: 'active galaxies' },
  radio_galaxy: { otypes: ['rG'], stellar: false, ko: '전파은하', en: 'radio galaxies' },
  starburst_galaxy: { otypes: ['SBG'], stellar: false, ko: '폭발적 별 생성 은하', en: 'starburst galaxies' },
  interacting_galaxies: { otypes: ['IG'], stellar: false, ko: '상호작용 은하', en: 'interacting galaxies' },
  galaxy_cluster: { otypes: ['ClG'], stellar: false, ko: '은하단', en: 'galaxy clusters' },
  gravitational_lens: { otypes: ['gLS..'], stellar: false, ko: '중력렌즈', en: 'gravitational lenses' },
};

                                                                              
export const SORTS                  = ['famous', 'nearest', 'brightest', 'fastest', 'largest'];

                           
               
               
             
                                                                              
                      
                
 

const NAME_OK = /^[A-Za-z0-9 .+\-*'/()[\]]{1,60}$/;

/** Check a plan against the closed lists. Returns {ok, plan} or {ok:false, why}. */
export function validatePlan(p         )                                                            {
  if (!p || typeof p !== 'object') return { ok: false, why: 'no plan object' };
  const q = p                           ;
  if (q.kind !== 'list') return { ok: false, why: `kind "${String(q.kind)}"` };
  if (typeof q.type !== 'string' || !Object.prototype.hasOwnProperty.call(TYPES, q.type)) return { ok: false, why: `type "${String(q.type)}"` };
  // Absent, null (the prompt says unused fields are null), zero, negative or not a number: the default. Only a real
  // positive number is clamped. Number(null) is 0, so the type is checked before converting.
  const raw = q.limit;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  const limit = Number.isFinite(n) && n > 0 ? Math.min(20, Math.max(1, Math.round(n))) : 10;
  const sort = SORTS.includes(q.sort        ) ? (q.sort        ) : 'famous';
  let near                = null;
  if (typeof q.near === 'string' && q.near.trim()) {
    if (!NAME_OK.test(q.near.trim())) return { ok: false, why: `near "${q.near}"` };
    near = q.near.trim();
  }
  return { ok: true, plan: { kind: 'list', type: q.type, sort, near, limit } };
}

/**
 * Turn a checked plan into ADQL for SIMBAD. `nearPos` is the position of plan.near in degrees, if any.
 * Returns { adql, sortUsed } (sortUsed differs from plan.sort when that ordering has no data for the type).
 * Service quirks: unqualified column names, `otype='X..'` for a type and its sub-types.
 */
export function compileAdql(plan          , nearPos                                     )                                   {
  const t = TYPES[plan.type];
  if (!t) throw new Error(`unknown type ${plan.type}`);
  const where = ['(' + t.otypes.map((o) => `otype='${o}'`).join(' OR ') + ')'];
  if (plan.type === 'star') where.push("otype<>'Pl'");
  let from = 'basic';
  let extra = '';
  let order = 'nbref DESC';
  let sortUsed       = plan.sort;
  if (plan.sort === 'nearest' && t.stellar) {
    where.push('plx_value IS NOT NULL');
    extra = ', plx_value';
    order = 'plx_value DESC';
  } else if (plan.sort === 'fastest' && t.stellar) {
    if (plan.type === 'star' && !nearPos) where.push('(pmra>1000 OR pmra<-1000 OR pmdec>1000 OR pmdec<-1000)');
    else where.push('pmra IS NOT NULL AND pmdec IS NOT NULL');
    extra = ', SQRT(pmra*pmra+pmdec*pmdec) AS pm';
    order = 'pm DESC';
  } else if (plan.sort === 'brightest') {
    from = 'basic JOIN allfluxes ON oidref=oid';
    const band = t.stellar ? 'K' : 'V';
    where.push(`${band} IS NOT NULL`);
    extra = `, ${band}`;
    order = `${band} ASC`;
  } else if (plan.sort === 'largest' && !t.stellar) {
    where.push('galdim_majaxis IS NOT NULL');
    extra = ', galdim_majaxis';
    order = 'galdim_majaxis DESC';
  } else {
    sortUsed = 'famous';
  }
  if (nearPos) {
    if (!Number.isFinite(nearPos.ra) || !Number.isFinite(nearPos.dec)) throw new Error('bad near position');
    where.push(`CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${nearPos.ra.toFixed(5)}, ${nearPos.dec.toFixed(5)}, 1.0))=1`);
  }
  // A few spare rows: companions and planets share their star's position and are merged by the caller.
  const top = Math.min(60, plan.limit * 3);
  const adql = `SELECT TOP ${top} main_id, ra, dec, otype, nbref${extra} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${order}`;
  return { adql, sortUsed };
}

const SORT_TEXT                                           = {
  famous: { ko: '많이 연구된 순', en: 'most studied first' },
  nearest: { ko: '가까운 순', en: 'nearest first' },
  brightest: { ko: '밝은 순', en: 'brightest first' },
  fastest: { ko: '빨리 움직이는 순', en: 'fastest moving first' },
  largest: { ko: '크게 보이는 순', en: 'largest on the sky first' },
};

/** Plain-language summary of what will be searched, built by code. `nearLabel` names plan.near for people. */
export function describePlan(plan          , sortUsed       , nearLabel                             )                             {
  const s = SORT_TEXT[sortUsed ?? plan.sort];
  const t = TYPES[plan.type] ;
  const nk = plan.near ? ` · ${nearLabel?.ko ?? plan.near} 주변 1°` : '';
  const ne = plan.near ? ` · within 1° of ${nearLabel?.en ?? plan.near}` : '';
  return { ko: `${t.ko} · ${s.ko}${nk} · ${plan.limit}개`, en: `${t.en} · ${s.en}${ne} · ${plan.limit} ${plan.limit === 1 ? 'result' : 'results'}.` };
}
