import {childURL, trustedFrameMessage} from '../routing.js';
import {t} from '../i18n.js';

// Keep the native engine document connected while hidden so returning from an
// analysis restores selection/camera. Its render loop is explicitly suspended.
let cached=null;

function createEntry(params){
 const frame=document.createElement('iframe');
 frame.className='planetarium-original-frame';frame.title=t('pl.frame');frame.dataset.i18nAttr='title:pl.frame';frame.allowFullscreen=true;
 Object.assign(frame.style,{position:'absolute',border:'0',display:'none',background:'#080d13',zIndex:'2'});
 frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.inert=true;
 let resolveReady;
 const entry={frame,active:false,owner:null,options:null,loaded:false,engineReady:false,pendingState:null,paused:true,query:params.toString(),ready:new Promise(resolve=>{resolveReady=resolve;})};
 entry.setPaused=paused=>{
  entry.paused=!!paused;
  try{frame.contentWindow?.__stellariumIntegration?.setPaused(entry.paused);}catch{}
  frame.contentWindow?.postMessage({type:'spherex-planetarium-visibility',paused:entry.paused},location.origin);
 };
 const loaded=()=>{entry.loaded=true;entry.setPaused(!entry.active||entry.paused);};
 frame.addEventListener('load',loaded);
 window.addEventListener('message',event=>{
  if(!trustedFrameMessage(event,frame,location.origin))return;
  const data=event.data;
  if(data.type==='spherex-planetarium-ready'){
   loaded();entry.engineReady=true;
   if(entry.pendingState){frame.contentWindow?.postMessage({type:'spherex-planetarium-restore',state:entry.pendingState},location.origin);entry.pendingState=null;}
   resolveReady();entry.options?.onReady?.();
  }
  if(!entry.active)return;
  if(data.type==='spherex-planetarium-analyze'){
   const target=data.target;
   if(target&&Number.isFinite(target.ra)&&Number.isFinite(target.dec)&&Math.abs(target.dec)<=90)entry.options?.onAnalyze?.({...target,ra:((target.ra%360)+360)%360});
  }
  if(data.type==='spherex-planetarium-home')entry.options?.onNavigate?.('home');
  if(data.type==='spherex-tutorial-open')document.querySelector('[data-sky-tutorial-open]')?.click();
  if(data.type==='spherex-planetarium-error'){const o=entry.options;if(o?.toastKeyed)o.toastKeyed('pl.error');else o?.toast?.(t('pl.error'));}
  if(data.type==='spherex-planetarium-share'&&typeof data.query==='string'){
   entry.query=data.query;entry.options?.onShare?.(data.query);
  }
 });
 frame.src=childURL('planetarium',params,document.baseURI).href;
 document.body.append(frame);
 return entry;
}

export function mountPlanetarium(container,options={}){
 const params=new URLSearchParams(options.params||'');params.delete('embed');
 const entry=cached||(cached=createEntry(params));
 const host=document.createElement('div');host.className='planetarium-original-host';
 Object.assign(host.style,{width:'100%',height:'calc(100svh - 74px)',minHeight:'360px'});
 container.replaceChildren(host);
 const owner={};entry.owner=owner;entry.options=options;entry.active=true;entry.paused=false;
 const frame=entry.frame;frame.hidden=false;frame.style.display='block';frame.inert=false;frame.removeAttribute('aria-hidden');
 // A bare #planetarium means return to the previous state, not reset it.
 if(params.size&&params.toString()!==entry.query){
  entry.query=params.toString();
  if(entry.engineReady)frame.contentWindow?.postMessage({type:'spherex-planetarium-restore',state:Object.fromEntries(params)},location.origin);
  else entry.pendingState=Object.fromEntries(params);
 }
 let disposed=false;
 const position=()=>{
  if(disposed)return;const rect=host.getBoundingClientRect();
  Object.assign(frame.style,{left:`${rect.left+scrollX}px`,top:`${rect.top+scrollY}px`,width:`${rect.width}px`,height:`${rect.height}px`});
 };
 const observer=new ResizeObserver(position);observer.observe(host);
 window.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true,capture:true});position();entry.setPaused(false);
 return {
  frame,ready:entry.ready,
  setActive(active){if(entry.owner===owner)entry.setPaused(!active);},
  getDocument(){try{return frame.contentDocument;}catch{return null;}},getWindow(){return frame.contentWindow;},
  getState(){try{return frame.contentWindow?.__stellariumIntegration?.getState()||{};}catch{return {}; }},
  dispose(){
   if(disposed)return;disposed=true;observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);host.remove();
   if(entry.owner!==owner)return;
   entry.active=false;entry.options=null;entry.setPaused(true);frame.hidden=true;frame.style.display='none';frame.inert=true;frame.setAttribute('aria-hidden','true');
  },
 };
}
