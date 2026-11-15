/** Real SPHEREx fixed-sky blink and retained project asteroid spectra.
 * New integration UI; existing TrueBlink data retains original provenance.
 */
import { t, onLangChange } from '../i18n.js';
const ROOT = new URL('./', import.meta.url);
const URL_FOR = path => new URL(path, ROOT).href;
const fmt = (x,n=3) => Number.isFinite(x) ? x.toFixed(n) : t('mv.na');
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// T(key): escaped text for templates; the element also carries data-i18n so a language switch updates it in place.
const T = k => esc(t(k));
export function mountMoving(container, {onAnalyze=()=>{}}={}) {
  const controller=new AbortController(), signal=controller.signal;
  let disposed=false,suspended=false,resumePlaying=false,tab='motion',target='vesta',meta=null,frames=[],index=0,timer=null,spectrum=null,serial=0,spectrumSerial=0,period=800;
  const pendingImages=new Set();
  const link=document.createElement('link');link.rel='stylesheet';link.href=URL_FOR('style.css');document.head.append(link);
  container.innerHTML=`<section class="moving-page" aria-labelledby="moving-title">
    <header class="moving-intro"><div><p class="moving-eyebrow">MOVING OBJECTS</p><h1 id="moving-title" data-i18n="mv.lead.h">${T('mv.lead.h')}</h1><p data-i18n="mv.lead.p">${T('mv.lead.p')}</p></div><a href="https://irsa.ipac.caltech.edu/applications/MOST/" target="_blank" rel="noreferrer" data-i18n="mv.irsa">${T('mv.irsa')}</a></header>
    <nav class="moving-tabs" aria-label="${T('mv.tabs')}" data-i18n-attr="aria-label:mv.tabs"><button data-tab="motion" class="selected" aria-pressed="true" data-i18n="mv.tab.motion">${T('mv.tab.motion')}</button><button data-tab="spectrum" aria-pressed="false" data-i18n="mv.tab.spectrum">${T('mv.tab.spectrum')}</button></nav>
    <div class="moving-body"></div>
  </section>`;
  const page=container.querySelector('.moving-page'),body=page.querySelector('.moving-body');
  const on=(el,type,fn)=>el.addEventListener(type,fn,{signal});
  const stop=()=>{clearInterval(timer);timer=null;const p=body.querySelector('[data-play]');if(p){p.textContent=t('mv.play');p.setAttribute('aria-pressed','false');}};
  const play=()=>{if(disposed||suspended||!meta||timer)return;timer=setInterval(()=>show(index+1),period);const p=body.querySelector('[data-play]');if(p){p.textContent=t('mv.pause');p.setAttribute('aria-pressed','true');}};
  const fail=error=>{stop();if(disposed||error?.name==='AbortError')return;body.innerHTML=`<div class="moving-error" role="alert"><h2 data-i18n="mv.err.h">${T('mv.err.h')}</h2><p data-i18n="mv.err.p">${T('mv.err.p')}</p><p>${esc(error.message||error)}</p><button data-retry data-i18n="mv.reload">${T('mv.reload')}</button></div>`;on(body.querySelector('[data-retry]'),'click',()=>render());};
  const load=async path=>{const r=await fetch(URL_FOR(path),{signal});if(!r.ok)throw Error(t('mv.httpErr',{s:r.status}));return r.json();};
  function motionShell(){body.innerHTML=`<div class="moving-toolbar"><div class="moving-targets" role="group" aria-label="${T('mv.targets')}" data-i18n-attr="aria-label:mv.targets"><button data-object="vesta" class="${target==='vesta'?'selected':''}">4 Vesta <span data-i18n="mv.vesta">${T('mv.vesta')}</span></button><button data-object="atlas" class="${target==='atlas'?'selected':''}">3I/ATLAS <span data-i18n="mv.atlas">${T('mv.atlas')}</span></button></div><span class="moving-badge" data-i18n="mv.badge.real">${T('mv.badge.real')}</span></div>
      <div class="moving-grid"><article class="moving-image-panel"><div class="moving-panel-title"><div><span class="moving-dot"></span> <strong data-object-name>${T('mv.loadingName')}</strong><span data-field></span></div><label><input type="checkbox" data-mark checked> <span data-i18n="mv.mark">${T('mv.mark')}</span></label></div><div class="moving-viewport" tabindex="0" aria-label="${T('mv.viewport')}" data-i18n-attr="aria-label:mv.viewport"><div class="moving-image-wrap"><img class="moving-image" alt="${T('mv.imgAlt')}"><svg class="moving-overlay" aria-hidden="true"><circle class="moving-marker" r="9"/><path d="M12 0V19M0 9H19" class="moving-north"/></svg><span class="moving-orientation">N ↑<br>E ←</span><span class="moving-image-time"></span></div><div class="moving-loading" role="status" data-i18n="mv.loading">${T('mv.loading')}</div></div>
      <div class="moving-playbar"><button data-prev disabled aria-label="${T('mv.prev')}" data-i18n-attr="aria-label:mv.prev">←</button><button data-play disabled aria-pressed="false">${T('mv.play')}</button><button data-next disabled aria-label="${T('mv.next')}" data-i18n-attr="aria-label:mv.next">→</button><label class="moving-speed"><span data-i18n="mv.speed">${T('mv.speed')}</span><select data-speed aria-label="${T('mv.speed')}" data-i18n-attr="aria-label:mv.speed"><option value="1200" data-i18n="mv.slow">${T('mv.slow')}</option><option value="800" selected data-i18n="mv.normal">${T('mv.normal')}</option><option value="400" data-i18n="mv.fast">${T('mv.fast')}</option></select></label><output data-count></output></div><div class="moving-timeline"></div><p class="moving-caption" data-i18n="mv.caption">${T('mv.caption')}</p></article>
      <aside class="moving-side"><div class="moving-facts"><p class="moving-eyebrow">THIS OBSERVATION</p><h2 data-date>${T('mv.date')}</h2><dl><div><dt>UTC</dt><dd data-utc>—</dd></div><div><dt data-i18n="mv.detector">${T('mv.detector')}</dt><dd data-detector>—</dd></div><div><dt data-i18n="mv.wave">${T('mv.wave')}</dt><dd data-wave>—</dd></div><div><dt data-i18n="mv.ra">${T('mv.ra')}</dt><dd data-ra>—</dd></div><div><dt data-i18n="mv.dec">${T('mv.dec')}</dt><dd data-dec>—</dd></div></dl><p class="moving-small" data-i18n="mv.circleNote">${T('mv.circleNote')}</p><button class="moving-primary" data-analyze disabled data-i18n="mv.analyze">${T('mv.analyze')}</button><p class="moving-small" data-i18n="mv.analyzeNote">${T('mv.analyzeNote')}</p></div>
      <div class="moving-track"><div class="moving-track-title"><h3 data-i18n="mv.track.h">${T('mv.track.h')}</h3><span class="moving-badge" data-i18n="mv.badge.model">${T('mv.badge.model')}</span></div><svg data-track viewBox="0 0 280 165" role="img" aria-label="${T('mv.track.aria')}" data-i18n-attr="aria-label:mv.track.aria"></svg><p class="moving-small" data-i18n="mv.track.note">${T('mv.track.note')}</p></div>
      <details class="moving-provenance"><summary data-i18n="mv.prov.summary">${T('mv.prov.summary')}</summary><p data-i18n="mv.prov.p">${T('mv.prov.p')}</p><a data-raw download data-i18n="mv.raw">${T('mv.raw')}</a><a data-source target="_blank" rel="noreferrer" data-i18n="mv.irsaFits">${T('mv.irsaFits')}</a><a href="${URL_FOR('README.md')}" target="_blank" data-i18n="mv.readme">${T('mv.readme')}</a></details></aside></div>`;
    for(const b of body.querySelectorAll('[data-object]'))on(b,'click',()=>{target=b.dataset.object;render();});
    on(body.querySelector('[data-prev]'),'click',()=>{stop();show(index-1);});on(body.querySelector('[data-next]'),'click',()=>{stop();show(index+1);});
    on(body.querySelector('[data-play]'),'click',()=>{if(timer)stop();else play();});
    on(body.querySelector('[data-speed]'),'change',e=>{period=Number(e.target.value);if(timer){stop();body.querySelector('[data-play]').click();}});
    on(body.querySelector('[data-mark]'),'change',e=>{body.querySelector('.moving-marker').style.display=e.target.checked?'':'none';});
    on(body.querySelector('.moving-viewport'),'keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stop();show(index+(e.key==='ArrowLeft'?-1:1));}});
    on(body.querySelector('[data-analyze]'),'click',()=>{stop();const f=meta.frames[index];onAnalyze({ra:f.predicted_ra,dec:f.predicted_dec,label:meta.name,moving:true,epoch:f.prediction_mjd,observationMjd:f.mjd_mid});});
  }
  function show(i){if(!meta||disposed)return;index=(i+frames.length)%frames.length;const f=meta.frames[index];const image=body.querySelector('.moving-image');if(!image)return;
    image.src=frames[index].src;image.alt=t('mv.imgAltFrame',{name:meta.name,date:f.date_utc});body.querySelector('.moving-image-time').textContent=f.date_utc.slice(0,19).replace('T',' ')+' UTC';
    body.querySelector('[data-count]').textContent=`${index+1} / ${frames.length}`;body.querySelector('[data-date]').textContent=f.date_utc.slice(0,10);body.querySelector('[data-utc]').textContent=f.date_utc.slice(11,19);body.querySelector('[data-detector]').textContent=f.detector+' · 4.42–5.00 μm';body.querySelector('[data-wave]').textContent=fmt(f.predicted_wavelength_um,3)+' μm · Δλ '+fmt(f.predicted_bandwidth_um,3);body.querySelector('[data-ra]').textContent=fmt(f.predicted_ra,5)+'°';body.querySelector('[data-dec]').textContent=fmt(f.predicted_dec,5)+'°';
    const marker=body.querySelector('.moving-marker');marker.setAttribute('cx',f.marker_x);marker.setAttribute('cy',f.marker_y);body.querySelector('[data-raw]').href=URL_FOR('data/'+f.raw_file);body.querySelector('[data-source]').href=f.source_url;
    for(const b of body.querySelectorAll('[data-epoch]')){const active=Number(b.dataset.epoch)===index;b.classList.toggle('selected',active);b.setAttribute('aria-current',active?'step':'false');}
    const rs=meta.frames.map(x=>x.predicted_ra),ds=meta.frames.map(x=>x.predicted_dec),rmin=Math.min(...rs),rmax=Math.max(...rs),dmin=Math.min(...ds),dmax=Math.max(...ds);
    const xy=f=>[250-(f.predicted_ra-rmin)/Math.max(rmax-rmin,1e-9)*220,135-(f.predicted_dec-dmin)/Math.max(dmax-dmin,1e-9)*105];
    body.querySelector('[data-track]').innerHTML=`<path d="M30 14V139H260" fill="none" stroke="#30404d"/><polyline points="${meta.frames.map(f=>xy(f).join(',')).join(' ')}" fill="none" stroke="#758b9a" stroke-width="1.3"/>${meta.frames.map((f,j)=>{const [x,y]=xy(f);return `<circle cx="${x}" cy="${y}" r="${j===index?5:3}" fill="${j===index?'#dfb785':'#6a7c8b'}"/><text x="${x+7}" y="${y-7}">${j+1}</text>`;}).join('')}<text x="185" y="160">${T('mv.raInc')}</text><text x="5" y="12">Dec ↑</text>`;
  }
  async function renderMotion(request){motionShell();const loaded=await load(`data/${target}.json`);if(disposed||request!==serial)return;
    const loadedFrames=await Promise.all(loaded.frames.map(f=>new Promise((resolve,reject)=>{const img=new Image();const pending={img,resolve};pendingImages.add(pending);img.onload=()=>{pendingImages.delete(pending);resolve(img);};img.onerror=()=>{pendingImages.delete(pending);reject(Error(t('mv.pngErr')));};img.src=URL_FOR('data/'+f.file);})));
    if(disposed||request!==serial)return;meta=loaded;frames=loadedFrames;
    body.querySelector('[data-object-name]').textContent=meta.name;
    if(target==='atlas'){const c=body.querySelector('.moving-caption');c.dataset.i18n='mv.caption.atlas';c.textContent=t('mv.caption.atlas');}body.querySelector('[data-field]').textContent=t('mv.field',{v:fmt(meta.grid.width_arcmin,1)});
    body.querySelector('.moving-overlay').setAttribute('viewBox',`0 0 ${meta.grid.size} ${meta.grid.size}`);body.querySelector('.moving-loading').hidden=true;for(const el of body.querySelectorAll('[data-play],[data-prev],[data-next],[data-analyze]'))el.disabled=false;
    body.querySelector('.moving-timeline').innerHTML=meta.frames.map((f,i)=>`<button data-epoch="${i}" aria-label="${esc(t('mv.epochAria',{date:f.date_utc,n:i+1}))}"><i></i><span>${f.date_utc.slice(5,10)}</span><small>${f.date_utc.slice(11,16)}</small></button>`).join('');
    for(const b of body.querySelectorAll('[data-epoch]'))on(b,'click',()=>{stop();show(Number(b.dataset.epoch));});index=0;show(0);
  }
  async function renderSpectrum(request){body.innerHTML=`<div class="moving-spectrum"><div class="moving-toolbar"><label><span data-i18n="mv.spec.label">${T('mv.spec.label')}</span> <select data-spectrum-target><option value="hygiea">10 Hygiea</option><option value="dembowska">349 Dembowska</option><option value="eros">433 Eros</option><option value="kollaa">1929 Kollaa</option></select></label><span class="moving-badge" data-i18n="mv.badge.spec">${T('mv.badge.spec')}</span></div><div class="moving-spectrum-content" role="status">${T('mv.spec.loading')}</div></div>`;
    async function draw(id){const drawRequest=++spectrumSerial;const data=await load('data/'+id+'.json');if(disposed||request!==serial||drawRequest!==spectrumSerial||tab!=='spectrum')return;spectrum=data;spectrum.redraw=()=>draw(id).catch(fail);const pts=data.points.filter(p=>p.kept&&Number.isFinite(p.flux_mJy)&&p.flux_mJy>0);const min=Math.log10(Math.min(...pts.map(p=>p.flux_mJy))),max=Math.log10(Math.max(...pts.map(p=>p.flux_mJy)));const X=v=>70+(v-.7)/4.4*790,Y=v=>315-(Math.log10(v)-min)/(max-min)*270;
      body.querySelector('.moving-spectrum-content').innerHTML=`<div class="moving-spectrum-heading"><div><p class="moving-eyebrow">MEASURED SPECTRUM</p><h2>${esc(data.number+' '+data.name)}</h2></div><p>${esc(t('mv.spec.counts',{k:data.provenance.nKept,e:data.provenance.nExposures}))}<br>${esc(data.provenance.firstDate)} — ${esc(data.provenance.lastDate)}</p></div><svg viewBox="0 0 900 365" class="moving-spectrum-chart" role="img" aria-label="${T('mv.spec.aria')}" data-i18n-attr="aria-label:mv.spec.aria">${[0,1,2,3,4].map(i=>`<path d="M70 ${315-i*67.5}H860" stroke="#25303a"/><text x="12" y="${319-i*67.5}">${fmt(10**(min+(max-min)*i/4),1)}</text>`).join('')}<path d="M70 30V315H860" fill="none" stroke="#53606a"/>${[1,2,3,4,5].map(v=>`<text x="${X(v)-3}" y="342">${v}</text>`).join('')}${pts.map(p=>`<circle cx="${X(p.wavelength_um)}" cy="${Y(p.flux_mJy)}" r="2.4" fill="#dfb785" fill-opacity=".72"><title>${p.wavelength_um} μm · ${p.flux_mJy} ± ${p.err_mJy} mJy · ${p.obs_id}</title></circle>`).join('')}<text x="70" y="18">Flux (mJy · log)</text><text x="756" y="360" data-i18n="mv.spec.xaxis">${T('mv.spec.xaxis')}</text></svg><div class="moving-spectrum-notes"><p data-i18n-html="mv.spec.note">${t('mv.spec.note')}</p><p>${esc(data.provenance.method)}</p><a href="${URL_FOR('data/'+id+'.json')}" download data-i18n="mv.spec.download">${T('mv.spec.download')}</a></div>`;
    }
    on(body.querySelector('[data-spectrum-target]'),'change',e=>draw(e.target.value).catch(fail));await draw('hygiea');
  }
  async function render(){stop();meta=null;const request=++serial;try{if(tab==='motion')await renderMotion(request);else await renderSpectrum(request);}catch(e){if(request===serial)fail(e);}}
  for(const b of page.querySelectorAll('[data-tab]'))on(b,'click',()=>{tab=b.dataset.tab;for(const other of page.querySelectorAll('[data-tab]')){other.classList.toggle('selected',other===b);other.setAttribute('aria-pressed',String(other===b));}render();});
  on(document,'visibilitychange',()=>{if(document.hidden)stop();});
  // Language switch in place: static nodes carry data-i18n (the shell re-applies them); dynamic texts are redrawn here
  // without reloading data, so the object, the frame, playback and the open tab stay as they are.
  const offLang=onLangChange(()=>{
    if(disposed)return;
    const p=body.querySelector('[data-play]');if(p)p.textContent=t(timer?'mv.pause':'mv.play');
    if(tab==='motion'&&meta){
      body.querySelector('[data-field]').textContent=t('mv.field',{v:fmt(meta.grid.width_arcmin,1)});
      for(const b of body.querySelectorAll('[data-epoch]')){const f=meta.frames[Number(b.dataset.epoch)];b.setAttribute('aria-label',t('mv.epochAria',{date:f.date_utc,n:Number(b.dataset.epoch)+1}));}
      show(index);
    }else if(tab==='motion'){const n=body.querySelector('[data-object-name]');if(n)n.textContent=t('mv.loadingName');const d=body.querySelector('[data-date]');if(d)d.textContent=t('mv.date');}
    if(tab==='spectrum'&&spectrum&&spectrum.redraw)spectrum.redraw();
  });
  const ready=render();return {ready,getDocument:()=>document,
    setActive(active){if(!active&&!suspended){resumePlaying=!!timer;suspended=true;stop();}else if(active&&suspended){suspended=false;if(resumePlaying)play();resumePlaying=false;}},
    dispose(){if(disposed)return;disposed=true;offLang();stop();controller.abort();for(const {img,resolve} of pendingImages){img.onload=null;img.onerror=null;img.src='';resolve(null);}pendingImages.clear();link.remove();container.replaceChildren();},
  };
}
