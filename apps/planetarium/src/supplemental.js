/* Supplemental observation links; never loaded as an engine catalog.
 * SPDX-License-Identifier: AGPL-3.0-only */
import {openParentAnalysis} from './integration.js';
import {buildAnalysisUrl} from './analysis-target.js';
import {locale, onLangChange, t} from './i18n.js';
const base=new URL('../',import.meta.url);
const outer=new URL(base.pathname.endsWith('/dist/')?'../../':'../',base);
const references=[
 {key:'supp.horsehead',ra:85.254125,dec:-2.4533111111,distance:1300,instrument:'Hubble WFC3',image:'horsehead.jpg',credit:'NASA, ESA, Hubble Heritage Team (AURA/STScI)',source:'https://esahubble.org/images/heic1307a/'},
 {key:'supp.carina',ra:159.212625,dec:-58.6200166667,distance:7600,instrument:'Webb NIRCam',image:'carina.jpg',credit:'NASA, ESA, CSA, STScI',source:'https://esawebb.org/images/weic2205a/'},
];
const preparedKeys=new Set(['barnard','eps_indi_b','wise0855','rw_aur','r_dra']);
const preparedLabel=item=>preparedKeys.has(item.id)?t('supp.'+item.id):item.display_name;
function analyze(target){if(!openParentAnalysis(target))window.open(buildAnalysisUrl(target,base,false),'_blank','noopener');}
export async function mountSupplemental(focusCoordinates){
 const section=document.createElement('section');section.className='control-section supplemental-observations';
 section.innerHTML='<h2 class="section-heading"><span data-i18n="supp.title"></span></h2><p class="field-note" data-i18n="supp.note"></p><div class="prepared-links"></div><h3 data-i18n="supp.refTitle"></h3><p class="field-note" data-i18n="supp.refNote"></p>';
 document.querySelector('#app-controls').append(section);
 const prepared=section.querySelector('.prepared-links');
 const renders=[()=>{for(const node of section.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);}];
 try{
  const response=await fetch(new URL('analysis/data/targets.json',outer));
  if(response.ok){
   const data=await response.json();
   for(const item of data.targets||[]){
    if(!Number.isFinite(item.ra)||!Number.isFinite(item.dec)||Math.abs(item.dec)>90)continue;
    const row=document.createElement('div');row.className='prepared-row';const focus=document.createElement('button');focus.type='button';focus.className='button button-secondary';focus.onclick=()=>focusCoordinates(item.ra,item.dec,preparedLabel(item));
    const open=document.createElement('button');open.type='button';open.className='button button-secondary';open.onclick=()=>analyze({target:item.id,ra:item.ra,dec:item.dec,label:preparedLabel(item)});row.append(focus,open);prepared.append(row);
    renders.push(()=>{const label=preparedLabel(item);focus.textContent=label;open.textContent=t('supp.analyse');open.setAttribute('aria-label',t('supp.analyseLabel',{label}));});
   }
  }
 }catch{renders.push(()=>{prepared.textContent=t('supp.loadFailed');});}
 for(const item of references){
  const card=document.createElement('article');card.className='reference-observation';
  const image=document.createElement('img');image.loading='lazy';image.src=new URL('assets/reference/'+item.image,base);
  const title=document.createElement('h4');
  const text=document.createElement('p');text.className='field-note';
  const source=document.createElement('a');source.href=item.source;source.target='_blank';source.rel='noreferrer';
  const focus=document.createElement('button');focus.type='button';focus.className='button button-secondary';focus.onclick=()=>focusCoordinates(item.ra,item.dec,t(item.key));
  const open=document.createElement('button');open.type='button';open.className='button button-secondary';open.onclick=()=>analyze({...item,label:t(item.key)});
  card.append(image,title,text,source,focus,open);section.append(card);
  renders.push(()=>{
   const label=t(item.key);
   image.alt=t('supp.imageAlt',{label,instrument:item.instrument});title.textContent=label;
   text.textContent=t('supp.refText',{instrument:item.instrument,distance:item.distance.toLocaleString(locale()),credit:item.credit});
   source.textContent=t('supp.sourceLink');focus.textContent=t('supp.viewInSky');open.textContent=t('supp.analyseSpherex');
  });
 }
 const render=()=>{for(const run of renders)run();};
 render();onLangChange(render);
}
