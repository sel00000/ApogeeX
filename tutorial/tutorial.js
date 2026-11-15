import { contentFor } from './content.js';
import { readLang, setCurrentLang, publishLang, watchLang, normalizeLang, ui } from './i18n.js';
import { mountVisual, captureControls, restoreControls } from './visuals.js';
import { PAGES, courseFor, validSelection, nextStep, shouldAutoOpen, storageKey } from './state.js';
import { currentPage, featureDocument, navigatePractice, installHighlightStyle, NOT_READY } from './adapter.js';
import { publishVisibility, createScrollLock } from './lifecycle.js';
import { rendered, practiceStatus, monitorPractice } from './practice.js';

const ROOT = new URL('../', import.meta.url);
const memory = new Map();
const SINGLETON = Symbol.for('sky-lab.tutorial');
const NOTE = '과학자 캐릭터의 설명은 학습용으로 구성했으며, 실제 인용문이 아닙니다.';
const PAGE_LABELS = { home:'입장 화면', planetarium:'플라네타리움', analysis:'SPHEREx 분석', asteroids:'소행성 분석' };
const NOTE_EN = 'The scientist characters’ explanations were written for learning. They are not real quotations.';
const PAGE_LABELS_EN = { home:'Home', planetarium:'Planetarium', analysis:'SPHEREx Analysis', asteroids:'Asteroid Analysis' };
/** Shell texts kept beside the Korean originals; both languages have the same keys (tested). */
export const SHELL_TEXT = { ko:{ note:NOTE, pages:PAGE_LABELS }, en:{ note:NOTE_EN, pages:PAGE_LABELS_EN } };

function node(tag, className, text) {
  const element=document.createElement(tag);
  if (className) element.className=className;
  if (text !== undefined) element.textContent=text;
  return element;
}
function button(text, className, action, label) {
  const item=node('button',className,text);
  item.type='button';
  if(label) item.setAttribute('aria-label',label);
  item.addEventListener('click',action);
  return item;
}
function read(key) {
  try { return sessionStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
function write(key,value) {
  try { sessionStorage.setItem(key,value);memory.delete(key);return true; }
  catch { memory.set(key,value);return false; }
}
function stylesheet(name) {
  const url=new URL(name,import.meta.url).href;
  if ([...document.querySelectorAll('link[data-sky-guide-css]')].some(link=>link.href===url)) return;
  const link=node('link'); link.rel='stylesheet'; link.href=url; link.dataset.skyGuideCss='';
  document.head.append(link);
}
function portrait(characters, T, character, full=false) {
  const person=characters[character] ?? characters.spherex;
  const wrap=node('div',`sg-portrait${full?' sg-portrait-full':''}`);
  const img=node('img');
  img.src=new URL(full?'assets/spherex-full.png':person.image,import.meta.url).href;
  img.alt=full?T.fullAlt:T.portraitAlt(person.name);
  img.decoding='async'; img.width=full?420:256; img.height=full?420:256;
  img.addEventListener('error',()=>{img.remove();wrap.append(node('span','sg-image-fallback',full?'✦':person.name));},{once:true});
  wrap.append(img);
  return wrap;
}
function makeLink(text,url,className) {
  const link=node('a',className,text); link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; return link;
}

/** One guide per document. Storage is tab-session scoped; completion never permanently hides it. */
export function mountTutorial({ page='home', autoOpen=true, embedded=window.self!==window.top }={}) {
  if (window[SINGLETON]) return window[SINGLETON];
  if (!PAGES.includes(page)) page='home';
  stylesheet('tutorial.css'); stylesheet('visuals.css');
  const key=storageKey(ROOT);
  let lang=setCurrentLang(readLang(window));
  let C=contentFor(lang), T=ui(lang), S=SHELL_TEXT[lang];

  let phase='closed';
  let selection=validSelection(C.MODULES,read(`${key}:track`),'all');
  let index=0;
  let steps=courseFor(C.MODULES,selection.track,selection.moduleId);
  let lastFocus=null;
  let cleanupVisual=()=>{};
  let practiceTarget=null;
  let practiceMonitor=null;
  let answer=null;
  let welcome=false;
  let destroyed=false;
  let practiceNavigation=null;
  let navigationError=null;
  let navigationPending=false;
  let suspended=null;
  const dialog=node('dialog','sky-guide');
  dialog.setAttribute('aria-labelledby','sky-guide-title');
  dialog.setAttribute('aria-modal','true');
  dialog.dataset.skyTutorialDialog='';
  const dock=node('aside','sg-practice-dock');
  dock.setAttribute('aria-label',T.dockLabel); dock.hidden=true;
  dialog.lang=lang; dock.lang=lang;
  const live=node('p','sg-sr-only');live.setAttribute('aria-live','polite');
  document.body.append(dialog,dock);
  const setScrollLocked=createScrollLock(window,document);

  function signal(open) {
    setScrollLocked(open);
    publishVisibility(window,document,open,phase);
  }
  function snapshotGuide() {
    return phase==='closed'?null:{phase,selection:{...selection},index,welcome};
  }
  function clearPractice() {
    practiceNavigation?.abort();practiceNavigation=null;
    practiceMonitor?.stop();practiceMonitor=null;
    practiceTarget?.classList.remove('sky-tutorial-target');
    practiceTarget=null; dock.hidden=true; dock.replaceChildren();
    if(dock.parentElement!==document.body)document.body.append(dock);
  }
  function focusHeading() {
    dialog.scrollTop=0;
    for(const scroll of dialog.querySelectorAll('.sg-chooser,.sg-lesson,.sg-lesson-main')) scroll.scrollTop=0;
    dialog.querySelector('#sky-guide-title')?.focus({preventScroll:true});
  }
  function show() {
    if (!dialog.open) {
      signal(true);
      try {dialog.showModal();}
      catch(error) {signal(false);throw error;}
    }
    focusHeading();
  }
  function close({restoreFocus=true,preserveHistory=false}={}) {
    if(!preserveHistory)suspended=null;
    cleanupVisual(); cleanupVisual=()=>{}; clearPractice(); phase='closed';
    if (dialog.open) dialog.close();
    signal(false);
    if(restoreFocus) {
      const candidate=lastFocus?.isConnected && lastFocus!==document.body ? lastFocus : document.querySelector('[data-sky-tutorial-open]');
      if(candidate?.focus) candidate.focus({preventScroll:true});
    }
  }
  function header() {
    const top=node('header','sg-top');
    const brand=node('div','sg-brand');
    brand.append(node('span','sg-brand-star','✦'),node('span','','SKY LAB / FIELD GUIDE'));
    const actions=node('div','sg-top-actions');
    if (phase!=='chooser') actions.append(button(T.topics,'sg-text-button',()=>open({track:selection.track,moduleId:selection.moduleId}),T.topicsLabel));
    actions.append(languageToggle(),button(phase==='complete'?T.close:T.skip,'sg-skip',()=>close(),T.skipLabel));
    top.append(brand,actions); return top;
  }
  /** The same two-segment EN | 한 switch as the portal bar (spec-i18n D2); both write the shared key. */
  function languageToggle() {
    const group=node('div','sg-lang');group.setAttribute('role','group');group.setAttribute('aria-label',T.langGroup);
    for(const id of ['en','ko']) {
      const option=button(id==='en'?'EN':'한','sg-lang-option',()=>chooseLang(id),id==='ko'?'한국어':undefined);
      option.lang=id;option.dataset.lang=id;option.setAttribute('aria-pressed',String(lang===id));
      group.append(option);
    }
    return group;
  }
  function chooseLang(next) {
    if(normalizeLang(next)===lang)return;
    publishLang(window,next);
    applyLang(next);
  }
  /** Re-render the current phase in place: same course, module, step, answer and practice. */
  function applyLang(next) {
    next=normalizeLang(next);
    if(next===lang||destroyed)return;
    const focused=document.activeElement instanceof Element&&dialog.contains(document.activeElement)?document.activeElement.closest('[data-lang]')?.dataset.lang:null;
    lang=setCurrentLang(next);C=contentFor(lang);T=ui(lang);S=SHELL_TEXT[lang];
    dialog.lang=lang;dock.lang=lang;dock.setAttribute('aria-label',T.dockLabel);
    steps=courseFor(C.MODULES,selection.track,selection.moduleId);
    const keptControls=phase==='lesson'?captureControls(dialog):[];
    if(phase==='chooser')renderChooser();
    else if(phase==='lesson'){renderLesson();restoreControls(dialog,keptControls);}
    else if(phase==='complete')renderComplete();
    else if(phase==='practice'){renderDock({relabel:true});}
    live.textContent=T.langLive;
    if(focused)dialog.querySelector(`.sg-lang [data-lang="${focused}"]`)?.focus({preventScroll:true});
  }
  function title(text) { const h=node('h2','sg-title',text);h.id='sky-guide-title';h.tabIndex=-1;return h; }
  function setView() {
    cleanupVisual(); cleanupVisual=()=>{};
    dialog.replaceChildren(header(),live);
  }
  function open(options={}) {
    if(destroyed) return;
    if(phase==='closed' || phase==='practice') lastFocus=document.activeElement;
    clearPractice();suspended=null;
    selection=validSelection(C.MODULES,options.track ?? selection.track,options.moduleId ?? 'all');
    welcome=options.welcome===true;
    phase='chooser';
    renderChooser(); show();
  }
  function renderChooser() {
    setView();
    const layout=node('div','sg-chooser');
    const intro=node('aside','sg-intro');
    intro.append(node('p','sg-eyebrow',welcome?'WELCOME ABOARD':'YOUR NEXT DISCOVERY'),portrait(C.CHARACTERS,T,'spherex',true));
    const greeting=node('div','sg-intro-copy');
    greeting.append(node('strong','',T.greeting),node('p','',T.greetingLine));
    const crew=node('p','sg-crew',T.crew);
    intro.append(greeting,crew);
    const main=node('section','sg-chooser-main');
    main.append(node('p','sg-eyebrow',T.chooserEyebrow),title(welcome?T.welcomeTitle:T.againTitle),
      node('p','sg-lead',T.chooserLead));
    const tracks=node('div','sg-track-options'); tracks.setAttribute('role','group'); tracks.setAttribute('aria-label',T.trackGroup);
    for (const id of ['beginner','research']) {
      const info=C.TRACKS[id];
      const option=button('',`sg-track${selection.track===id?' is-selected':''}`,()=>{
        selection.track=id;write(`${key}:track`,id);renderChooser();dialog.querySelector(`[data-sg-track="${id}"]`)?.focus();
      });
      option.dataset.sgTrack=id;option.setAttribute('aria-pressed',String(selection.track===id));
      option.append(node('span','sg-track-icon',id==='beginner'?'✧':'⌁'),node('strong','',info.label),node('span','sg-track-desc',info.description));
      tracks.append(option);
    }
    main.append(tracks,node('h3','sg-section-label',T.topicHeading));
    const topics=node('div','sg-topic-list');
    C.MODULES.forEach((module,i)=>{
      const option=button('','sg-topic',()=>start(module.id),T.startTopic(module.title));
      if(selection.moduleId===module.id) option.classList.add('is-recommended');
      const copy=node('span','sg-topic-copy');copy.append(node('strong','',module.title),node('span','',module.description));
      option.append(node('span','sg-topic-number',String(i+1).padStart(2,'0')),copy,node('span','sg-topic-time',T.minutes(module.minutes[selection.track])));
      topics.append(option);
    });
    const total=C.MODULES.reduce((sum,item)=>sum+Number(item.minutes[selection.track]||0),0);
    const all=button(T.startAll,'sg-primary sg-start-all',()=>start('all'));
    all.append(node('small','',T.allSummary(C.MODULES.length,total)));
    main.append(topics,all,node('p','sg-note',S.note));
    layout.append(intro,main);dialog.append(layout);
  }
  function start(moduleId) {
    selection=validSelection(C.MODULES,selection.track,moduleId);
    steps=courseFor(C.MODULES,selection.track,selection.moduleId); index=0;answer=null;
    if(!steps.length) {open();return;}
    write(`${key}:track`,selection.track); phase='lesson';renderLesson();show();
  }
  function advance(direction) {
    const next=nextStep(index,steps.length,direction);index=next.index;answer=null;
    phase=next.complete?'complete':'lesson';
    if(next.complete) renderComplete(); else renderLesson();
    focusHeading();
  }
  function lessonAside(step) {
    const person=C.CHARACTERS[step.character]??C.CHARACTERS.spherex;
    const aside=node('aside','sg-mentor');
    aside.append(node('p','sg-eyebrow',selection.track==='research'?'RESEARCH NOTE':'EXPLORER NOTE'),portrait(C.CHARACTERS,T,step.character));
    const identity=node('div','sg-mentor-identity');
    identity.append(node('p','sg-mentor-name',person.name),node('p','sg-mentor-role',person.role));
    aside.append(identity,node('div','sg-mentor-line'),node('p','sg-mentor-topic',step.moduleTitle),node('p','sg-mentor-note',S.note));
    return aside;
  }
  function renderLesson() {
    setView();
    const step=steps[index];
    const layout=node('div','sg-lesson');layout.append(lessonAside(step));
    const article=node('article','sg-lesson-main');
    const breadcrumb=node('p','sg-eyebrow',`${C.TRACKS[selection.track].label} / ${step.moduleTitle}`);
    article.append(breadcrumb,title(step.title));
    const words=node('div','sg-explanation');
    step.body.forEach(text=>words.append(node('p','',text)));
    if(step.bullets?.length) { const list=node('ul');step.bullets.forEach(text=>list.append(node('li','',text)));words.append(list); }
    article.append(words);
    const visual=node('section','sg-visual');visual.setAttribute('aria-label',T.visualLabel);
    if(step.visual) article.append(visual);
    if(step.check) {
      const quiz=node('section','sg-check');quiz.setAttribute('aria-labelledby','sg-check-question');
      const question=node('h3','',step.check.question);question.id='sg-check-question';
      quiz.append(node('p','sg-eyebrow',T.checkEyebrow),question);
      const choices=node('div','sg-check-choices');
      const feedback=node('p','sg-check-feedback');feedback.setAttribute('role','status');
      step.check.choices.forEach((text,i)=>{
        const choice=button(text,'sg-check-choice',()=>{
          answer=i;
          for(const child of choices.children) child.setAttribute('aria-pressed',String(Number(child.dataset.answer)===i));
          feedback.classList.toggle('is-correct',i===step.check.answer);
          feedback.textContent=`${i===step.check.answer?T.correct:T.retry} ${step.check.explanation}`;
        });
        choice.dataset.answer=String(i);choice.setAttribute('aria-pressed',String(answer===i));choices.append(choice);
      });
      if(answer!==null) {feedback.textContent=`${answer===step.check.answer?T.correct:T.retry} ${step.check.explanation}`;feedback.classList.toggle('is-correct',answer===step.check.answer);}
      quiz.append(choices,feedback);article.append(quiz);
    }
    if(step.practice) {
      const practice=node('div','sg-practice-action');
      practice.append(button(step.practice.page===currentPage(window,page)?T.tryHere:T.tryOn(S.pages[step.practice.page]),'sg-secondary',()=>practiceStep()),
        node('span','',step.practice.label));
      article.append(practice);
    }
    if(step.sources?.length) {
      const refs=node('details','sg-sources');refs.append(node('summary','',T.sources));
      const list=node('ul');
      step.sources.forEach(id=>{const ref=C.REFERENCES[id];if(!ref)return;const li=node('li');li.append(makeLink(ref.title,ref.url));list.append(li);});
      refs.append(list);article.append(refs);
    }
    layout.append(article);dialog.append(layout);
    const footer=node('footer','sg-footer');
    const back=button(T.back,'sg-secondary',()=>advance(-1));back.disabled=index===0;
    const progress=node('div','sg-progress');
    progress.append(node('span','',`${index+1} / ${steps.length}`));
    const meter=node('progress');meter.max=steps.length;meter.value=index+1;meter.setAttribute('aria-label',T.progress);progress.append(meter);
    const next=button(index===steps.length-1?T.finish:T.next,'sg-primary',()=>advance(1));
    footer.append(back,progress,next);dialog.append(footer);
    if(step.visual) {
      try {cleanupVisual=mountVisual(visual,step.visual,{track:selection.track,step,lang})??(()=>{});}
      catch {visual.replaceChildren(node('p','sg-note',T.visualError));}
    }
  }
  function renderComplete() {
    setView();
    const wrap=node('section','sg-complete');
    wrap.append(portrait(C.CHARACTERS,T,'spherex'),node('p','sg-eyebrow','READY FOR YOUR NEXT DISCOVERY'),title(T.completeTitle),
      node('p','sg-lead',selection.moduleId==='all'?T.completeAll:T.completeModule(C.MODULES.find(item=>item.id===selection.moduleId)?.title)));
    const actions=node('div','sg-complete-actions');
    actions.append(button(T.backToObserving,'sg-primary',()=>close()),button(T.otherTopic,'sg-secondary',()=>open({track:selection.track})),button(T.replay,'sg-text-button',()=>start(selection.moduleId)));
    wrap.append(actions,node('p','sg-note',T.completeNote));
    dialog.append(wrap);
  }

  function practiceStep() {
    if (!steps[index]?.practice) return;
    enterPractice({navigating:true});
    const controller=new AbortController();
    practiceNavigation=controller;
    navigationError=null;
    void navigatePractice(window,steps[index].practice,controller.signal).then((ready)=>{
      if(controller.signal.aborted || destroyed || phase!=='practice')return;
      navigationPending=false;
      if(!ready)navigationError={code:'incomplete'};
      practiceMonitor?.refresh();
    }).catch((error)=>{
      if(controller.signal.aborted || destroyed || phase!=='practice')return;
      navigationPending=false;
      navigationError={code:'failed',message:error?.message};
      practiceMonitor?.refresh();
    });
  }
  function enterPractice({navigating=false}={}) {
    if(destroyed)return;
    cleanupVisual();cleanupVisual=()=>{};
    clearPractice();phase='practice';navigationError=null;navigationPending=navigating;
    if(dialog.open)dialog.close();signal(false);
    renderDock();
  }
  function navigationMessage() {
    if(navigationError.code==='incomplete')return T.navIncomplete;
    const message=navigationError.message;
    if(Object.values(NOT_READY).includes(message))return NOT_READY[lang];
    return message||T.navFailed;
  }
  /** Build the practice dock. A language switch rebuilds it without touching navigation or the highlighted tool. */
  function renderDock({relabel=false}={}) {
    practiceMonitor?.stop();practiceMonitor=null;
    dock.replaceChildren();
    const step=steps[index];
    const copy=node('div','sg-practice-copy');
    copy.append(node('strong','',T.practiceTitle),node('p','',step.practice?.label??step.title));
    const status=node('p','sg-practice-status',T.practiceSearching);
    status.setAttribute('role','status');copy.append(status);
    const setup=node('div','sg-practice-setup');copy.append(setup);
    const controls=node('div','sg-practice-controls');
    controls.append(button(T.continueGuide,'sg-primary',()=>{
      clearPractice();phase='lesson';renderLesson();show();
    }),button(T.closeTutorial,'sg-text-button',()=>close()));
    dock.append(portrait(C.CHARACTERS,T,step.character),copy,controls);dock.hidden=false;
    const practiceDoc=()=>featureDocument(window,document,step.practice.page);
    const reveal=(candidate)=>{
      if(!rendered(candidate,candidate?.ownerDocument))return;
      candidate.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const focusable=candidate.matches('button,input,select,textarea,a[href],[tabindex]')?candidate:candidate.querySelector('summary,button,input,select,textarea,a[href],[tabindex]');
      focusable?.focus({preventScroll:true});
    };
    const readStatus=()=>{
      if(navigationError)return {target:null,state:'navigation-error',message:navigationMessage()};
      if(navigationPending)return {target:null,state:'loading',message:T.navLoading};
      if(currentPage(window,page)!==step.practice.page)return {target:null,state:'other-screen',message:T.otherScreen(S.pages[step.practice.page])};
      const doc=practiceDoc();
      const result=practiceStatus(doc,step.practice,step.practice.page,lang);
      // The analysis app's own Korean switch is offered only to a reader who chose Korean.
      const language=lang==='ko'&&step.practice.page==='analysis'?doc?.querySelector('[data-testid="lang-ko"]'):null;
      result.languageAvailable=rendered(language,doc)&&language.getAttribute('aria-pressed')!=='true';
      return result;
    };
    if(!relabel)controls.querySelector('button')?.focus({preventScroll:true});
    practiceMonitor=monitorPractice(readStatus,(current,{first})=>{
      if(phase!=='practice')return;
      if(practiceTarget!==current.target){
        practiceTarget?.classList.remove('sky-tutorial-target');
        practiceTarget=current.target;
        if(practiceTarget){installHighlightStyle(practiceTarget.ownerDocument);practiceTarget.classList.add('sky-tutorial-target');}
      }
      status.textContent=current.message;setup.replaceChildren();
      if(current.action)setup.append(button(current.action.label,'sg-secondary',()=>{
        const doc=practiceDoc();const control=doc?.querySelector(current.action.selector);
        if(!rendered(control,doc)||control.disabled)return;
        if(current.action.type==='focus')reveal(control);else control.click();
        practiceMonitor?.refresh();
      }));
      if(current.target)setup.append(button(T.goToTool,'sg-text-button',()=>reveal(practiceTarget)));
      if(current.languageAvailable)setup.append(button(T.viewKorean,'sg-text-button',()=>{
        practiceDoc()?.querySelector('[data-testid="lang-ko"]')?.click();practiceMonitor?.refresh();
      }));
      // Delayed loads update only the hint. They never pull the user's scroll/focus back.
      if(first&&current.target&&!relabel)reveal(current.target);
    });
  }

  const launch=(event)=>{
    const control=event.target instanceof Element?event.target.closest('[data-sky-tutorial-open]'):null;
    if(!control)return;
    event.preventDefault();open({track:control.dataset.skyTutorialTrack,moduleId:control.dataset.skyTutorialModule});
  };
  const custom=(event)=>open(event.detail??{});

  const pageHide=()=>{
    suspended=snapshotGuide();
    close({restoreFocus:false,preserveHistory:true});
  };
  const pageShow=(event)=>{
    if(!event.persisted||destroyed||!suspended)return;
    const saved=suspended;suspended=null;
    selection=saved.selection;index=saved.index;welcome=saved.welcome;
    steps=courseFor(C.MODULES,selection.track,selection.moduleId);
    if(saved.phase==='practice'){enterPractice();return;}
    phase=saved.phase;
    if(phase==='chooser')renderChooser();else if(phase==='complete')renderComplete();else renderLesson();
    show();
  };
  document.addEventListener('click',launch);
  const stopWatchingLang=watchLang(window,applyLang);
  window.addEventListener('sky-tutorial-open',custom);
  window.addEventListener('pagehide',pageHide);
  window.addEventListener('pageshow',pageShow);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Keep app-level Escape, Space and arrow shortcuts from acting behind a modal guide.
  for(const type of ['keydown','keyup','keypress']) dialog.addEventListener(type,event=>{
    event.stopPropagation();
    if(type==='keydown' && event.key==='Escape') {event.preventDefault();close();}
  });
  const api={open,close,destroy(){
    close({restoreFocus:false});destroyed=true;
    stopWatchingLang();document.removeEventListener('click',launch);window.removeEventListener('sky-tutorial-open',custom);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);
    dialog.remove();dock.remove();delete window[SINGLETON];
  }};
  window[SINGLETON]=api;
  if(autoOpen && shouldAutoOpen({embedded}))queueMicrotask(()=>open({welcome:true}));
  return api;
}
