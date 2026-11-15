import { asLang, readStoredLang, LANG_KEY, SearchError, tagged, t,           } from './i18n.js';
import { createSearchService,                                                             } from './service.js';
export { createSearchService, selectionFromItem, bodyChoices, readSesamePosition } from './service.js';
export { parseCoords } from './core/intent.js';
export { createSkySearch } from './core/search.js';
export { validateIndexData } from './core/index.js';
                                                                              
export { TEXT, t, readStoredLang,           } from './i18n.js';

                                                                    
                                                     
                                                                       
                       
                                                                                                                     
              
 

const CSS = `
.sx-search{color:#ecf2ff;font:inherit;width:100%;position:relative;--sx-search-line:rgba(174,198,235,.2)}
.sx-search *{box-sizing:border-box}.sx-search [hidden]{display:none!important}
.sx-search form{display:flex;gap:8px;margin:0}.sx-search label{display:block;font-size:13px;color:#c7d4ed;margin:0 0 8px}
.sx-search input{flex:1;min-width:0;padding:13px 14px;border:1px solid var(--sx-search-line);border-radius:12px;background:#10182a;color:inherit;font:inherit;outline:none}
.sx-search input:focus{border-color:#9ebcff;box-shadow:0 0 0 3px #8baaff22}
.sx-search button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--sx-search-line);border-radius:10px;background:#17233a;padding:10px 14px}
.sx-search button:hover{background:#263958}.sx-search button:focus-visible{outline:2px solid #b0c9ff;outline-offset:3px}.sx-search button:disabled{opacity:.5;cursor:default}
.sx-search .sx-search-submit{background:#dbe8ff;color:#152035;font-weight:700;white-space:nowrap}
.sx-search .sx-search-status{color:#aabbd8;font-size:12px;line-height:1.6;margin:10px 0;min-height:20px}
.sx-search .sx-search-status[data-error]{color:#ffb8ae}
.sx-search .sx-search-results{list-style:none;margin:0;padding:0;max-height:38vh;overflow:auto;border-top:1px solid var(--sx-search-line)}
.sx-search .sx-search-result{display:block;text-align:left;width:100%;border:0;border-bottom:1px solid var(--sx-search-line);border-radius:0;padding:12px 10px;background:transparent}
.sx-search .sx-search-result[aria-selected=true]{background:#253656}.sx-search .sx-search-result strong{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.sx-search .sx-search-result small{display:block;margin-top:5px;color:#aabbd8;line-height:1.5;font-size:11px;overflow-wrap:anywhere}
.sx-search .sx-search-choice{padding:16px;background:#0d1729;border:1px solid var(--sx-search-line);border-radius:12px;margin-top:12px}
.sx-search .sx-search-choice p{font-size:12px;color:#b4c4df;line-height:1.7;margin:8px 0 12px;overflow-wrap:anywhere}
.sx-search .sx-search-actions{display:flex;gap:8px;flex-wrap:wrap}.sx-search .sx-search-help{font-size:11px;color:#8fa2c0;line-height:1.7;margin:12px 0 0}
@media(max-width:480px){.sx-search input{font-size:14px;padding:12px 9px}.sx-search button{padding:10px}.sx-search .sx-search-actions button{flex:1}.sx-search .sx-search-results{max-height:32vh}}
`;
let sequence = 0;

/** Shell-owned, lazy-search UI. No routing or scientific processing is started until an action is chosen. */
export function mountSearch(host             , options              ) {
  if (!host || !options?.onSelect) throw new SearchError('needHostAndHandler');
  const doc = host.ownerDocument;
  if (!doc.getElementById('spherex-search-style')) {
    const style = doc.createElement('style'); style.id = 'spherex-search-style'; style.textContent = CSS; doc.head.append(style);
  }
  const id = `sx-search-${++sequence}`;
  const root = doc.createElement('section'); root.className = 'sx-search';
  let lang       = options.lang ? asLang(options.lang) : readStoredLang();
  root.innerHTML = `<label for="${id}-input"></label>
    <form role="search"><input id="${id}-input" type="search" autocomplete="off" spellcheck="false" maxlength="160"
      role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results" data-tutorial-search-input>
      <button class="sx-search-submit" type="submit"></button></form>
    <p class="sx-search-status" role="status" aria-live="polite"></p>
    <ul class="sx-search-results" id="${id}-results" role="listbox" hidden></ul>
    <section class="sx-search-choice" hidden></section>
    <p class="sx-search-help"><span data-help="coords"></span><br><span data-help="moving"></span></p>`;
  host.replaceChildren(root);
  const input = root.querySelector('input')                     ;
  const form = root.querySelector('form') ;
  const status = root.querySelector('.sx-search-status')                ;
  const list = root.querySelector('ul') ;
  const choice = root.querySelector('.sx-search-choice')                ;
  const events = new AbortController();
  const service = createSearchService({...options, lang: () => lang});
  let destroyed = false, composing = false, generation = 0, active = -1;
  let choices                 = [];
  let selectedChoice                          ;
  let running                             ;
  let loadReady = false;
  // The status line is kept as a function of the language so that a switch re-words it in place.
  let describeStatus                      = l => t(l, 'preparing');
  let statusError = false;
  const labelEl = root.querySelector('label')                ;
  const submitEl = root.querySelector('.sx-search-submit')                ;
  const field = (name        ) => root.querySelector(`[data-help=${name}]`)                ;
  const failure = (error         )                        => {
    const e = error                                                 ;
    if (e instanceof SearchError) return l => e.text(l);
    if (e?.i18nKey) return l => t(l, e.i18nKey );
    return () => e?.message || '';
  };

  const say = (describe                     , error = false) => {
    if (destroyed) return;
    describeStatus = describe; statusError = error;
    status.textContent = describe(lang); status.toggleAttribute('data-error', error);
  };
  const cancel = () => {generation++; running?.abort(); running = undefined; form.removeAttribute('aria-busy');};
  const setActive = (index        ) => {
    active = index;
    const nodes = list.querySelectorAll                   ('[role=option]');
    nodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
    if (active >= 0 && nodes[active]) {input.setAttribute('aria-activedescendant', nodes[active].id); nodes[active].scrollIntoView({block: 'nearest'});}
    else input.removeAttribute('aria-activedescendant');
  };
  const close = () => {
    cancel(); list.hidden = true; choice.hidden = true; selectedChoice = undefined; input.setAttribute('aria-expanded', 'false'); setActive(-1);
  };
  const selectAction = (selected              , action              ) => {
    cancel();
    options.onSelect({...selected.selection}, action);
  };
  const applyChoiceText = () => {
    if (!selectedChoice) return;
    const text = selectedChoice.texts[lang];
    choice.querySelector('[data-role=title]') .textContent = text.label;
    choice.querySelector('[data-role=detail]') .textContent = text.detail;
    choice.querySelectorAll             ('button[data-i18n]').forEach(b => {b.textContent = t(lang, b.dataset.i18n             );});
  };
  const choose = (index        ) => {
    const selected = choices[index]; if (!selected || destroyed) return;
    cancel(); setActive(index); selectedChoice = selected; choice.replaceChildren(); choice.hidden = false;
    const title = doc.createElement('strong'); title.dataset.role = 'title';
    const detail = doc.createElement('p'); detail.dataset.role = 'detail';
    const actions = doc.createElement('div'); actions.className = 'sx-search-actions';
    const add = (key                                        , action              ) => {
      const button = doc.createElement('button'); button.type = 'button'; button.dataset.i18n = key;
      button.dataset.action = action; actions.append(button);
    };
    if (selected.selection.kind === 'asteroid') add('openAsteroid', 'asteroids');
    else {
      add('viewSky', 'planetarium');
      if (selected.selection.kind === 'sky') add('analyse', 'analysis');
    }
    choice.append(title, detail, actions); applyChoiceText();
    actions.querySelector('button')?.focus({preventScroll: true});
  };
  const render = (items                ) => {
    if (destroyed) return;
    choices = items; selectedChoice = undefined; list.replaceChildren(); choice.hidden = true; setActive(-1);
    list.hidden = items.length === 0; input.setAttribute('aria-expanded', String(items.length > 0));
    items.forEach((item, i) => {
      const li = doc.createElement('li'); li.setAttribute('role', 'presentation');
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'sx-search-result';
      button.id = `${id}-option-${i}`; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false');
      button.dataset.index = String(i);
      const title = doc.createElement('strong'); title.textContent = item.texts[lang].label; title.dataset.role = 'title';
      const detail = doc.createElement('small'); detail.textContent = item.texts[lang].detail; detail.dataset.role = 'detail';
      button.append(title, detail); li.append(button); list.append(li);
    });
  };
  const suggest = () => {
    if (!loadReady || composing || destroyed) return;
    render(service.suggest(input.value));
    say(l => t(l, input.value.trim() ? 'suggestHint' : 'typeHint'));
  };
  const ready = service.ready().then(() => {
    if (!destroyed) {loadReady = true; suggest();}
  }).catch(error => {const why = failure(error); say(l => t(l, 'loadFailed', {detail: why(l)}), true);});
  const search = async (text         ) => {
    if (destroyed || composing) return;
    if (text !== undefined) input.value = text;
    cancel(); const current = generation; running = new AbortController(); const request = running;
    const timer = setTimeout(() => request.abort(tagged(new DOMException(t(lang, 'searchTimeout'), 'TimeoutError'), 'searchTimeout', lang)), 20000);
    render([]); form.setAttribute('aria-busy', 'true'); say(l => t(l, 'searching'));
    try {
      const result = await service.search(input.value, request.signal);
      if (destroyed || current !== generation) return;
      loadReady = true; render(result.items); say(result.describe, result.partial && !result.items.length);
    } catch (error) {
      if (destroyed || current !== generation) return;
      const e = error         ;
      if (e.name !== 'AbortError') {const why = failure(e); say(l => why(l) || t(l, 'searchFailed'), true);}
    } finally {
      clearTimeout(timer);
      if (current === generation) {running = undefined; form.removeAttribute('aria-busy');}
    }
  };
  form.addEventListener('submit', event => {event.preventDefault(); if (!composing) void search();}, {signal: events.signal});
  list.addEventListener('click', event => {
    const button = (event.target           ).closest                   ('button[data-index]');
    if (button && list.contains(button)) choose(Number(button.dataset.index));
  }, {signal: events.signal});
  choice.addEventListener('click', event => {
    const button = (event.target           ).closest                   ('button[data-action]');
    if (button && selectedChoice && choice.contains(button)) selectAction(selectedChoice, button.dataset.action                );
  }, {signal: events.signal});
  input.addEventListener('input', () => {cancel(); suggest();}, {signal: events.signal});
  input.addEventListener('compositionstart', () => {composing = true; cancel();}, {signal: events.signal});
  input.addEventListener('compositionend', () => {composing = false; suggest();}, {signal: events.signal});
  input.addEventListener('keydown', event => {
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!choices.length || list.hidden) return;
      event.preventDefault(); setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
    } else if (event.key === 'Enter' && active >= 0 && !list.hidden) {event.preventDefault(); choose(active);}
    else if (event.key === 'Escape' && (!list.hidden || !choice.hidden || running)) {event.preventDefault(); event.stopPropagation(); close(); say(l => t(l, 'closed'));}
  }, {signal: events.signal});
  const applyLang = () => {
    root.lang = lang; labelEl.textContent = t(lang, 'label'); submitEl.textContent = t(lang, 'submit');
    input.placeholder = t(lang, 'placeholder');
    list.setAttribute('aria-label', t(lang, 'resultsAria')); choice.setAttribute('aria-label', t(lang, 'choiceAria'));
    field('coords').textContent = t(lang, 'helpCoords'); field('moving').textContent = t(lang, 'helpMoving');
    status.textContent = describeStatus(lang); status.toggleAttribute('data-error', statusError);
    list.querySelectorAll             ('button[data-index]').forEach(button => {
      const text = choices[Number(button.dataset.index)]?.texts[lang]; if (!text) return;
      button.querySelector('strong') .textContent = text.label; button.querySelector('small') .textContent = text.detail;
    });
    applyChoiceText();
  };
  /** Switch language in place: the typed query, the results and the open choice stay as they are. */
  const setLang = (next      ) => {if (destroyed || next === lang) return; lang = next; applyLang();};
  const onChange = (event       ) => setLang(asLang((event               ).detail?.lang));
  const onStorage = (event              ) => {if (event.key === LANG_KEY) setLang(asLang(event.newValue));};
  const view = doc.defaultView;
  view?.addEventListener('spherex-lang-change', onChange, {signal: events.signal});
  view?.addEventListener('storage', onStorage, {signal: events.signal});
  applyLang();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; cancel(); events.abort(); options.signal?.removeEventListener('abort', destroy); root.remove();
  };
  if (options.signal?.aborted) destroy(); else options.signal?.addEventListener('abort', destroy, {once: true});
  return {ready, search, close, destroy, focus: () => {if (!destroyed) input.focus();},
    setLang, setValue: (value        ) => {if (!destroyed) {input.value = value; cancel(); suggest();}}};
}
