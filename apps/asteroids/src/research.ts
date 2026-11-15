import {artifactUrl, interval, jobResultUrl, matchTarget, number, scientific, statusLabel, validateCatalog, validateResult} from './research-model';
import {forgetSession, loadApiConfig, sessionHeaders} from './api-config';
import type {ApiConfig} from './api-config';
import {LocalError, applyI18n, bindText, onLang, t} from './i18n';
import type {Key} from './i18n';
import type {AnalysisJob, AnalysisResult, CatalogItem} from './research-model';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const api = '/api/asteroid-analysis';
const catalogUrl = new URL('./analysis-data/index.json', location.href).href;
const confident = (v: unknown) => ['Low','Medium','High'].includes(String(v)) ? t(('c.'+String(v)) as Key) : String(v ?? t('r.notProvided'));

export function mountResearch(host: HTMLElement, options: {
  target?: string; onTarget: (target: string) => void;
  onOrbit: (target: string, sceneUrl?: string) => void;
}) {
  let catalog: CatalogItem[] = [], target = options.target ?? '', currentJob: AnalysisJob|null = null;
  let active = true, disposed = false, generation = 0, pollTimer = 0;
  let capabilities: {available: boolean; reason?: string; maxImages?: number; activeJobId?: string}|null = null;
  let loadController: AbortController|null = null, pollController: AbortController|null = null;
  const controller = new AbortController();
  let apiConfig: ApiConfig = {apiBase:''}, checking = false;
  const storageKey = () => 'spherex-v5-asteroid-job:'+(apiConfig.apiBase || location.origin);
  let loadedJobResult = '', lastJobId = '', submitting = false;
  host.innerHTML = `<div class="research-layout">
    <aside class="research-controls"><div class="eyebrow">SPHEREX ASTEROID LAB</div><h1 data-i18n-html="r.title"></h1>
      <p data-i18n="r.lead"></p>
      <label for="research-target" data-i18n="r.prepared"></label><select id="research-target" data-tutorial="asteroid-target" data-i18n-aria="r.preparedAria"><option value="" data-i18n="r.listLoading"></option></select>
      <p id="catalog-status" role="status"></p><button id="catalog-retry" hidden data-i18n="r.listRetry"></button>
      <button id="research-orbit" data-i18n="r.orbit"></button>
      <form id="analysis-form" data-tutorial="asteroid-run"><h2 data-i18n="r.newTitle"></h2>
        <label for="job-target" data-i18n="r.jobTarget"></label><input id="job-target" maxlength="80" data-i18n-ph="r.jobTargetPh" required autocomplete="off">
        <div class="date-fields"><label><span data-i18n="r.start"></span><input id="job-start" type="date" value="2025-06-01" min="1900-01-01" max="2100-12-31" required></label><label><span data-i18n="r.end"></span><input id="job-end" type="date" value="2025-08-01" min="1900-01-01" max="2100-12-31" required></label></div>
        <label for="job-limit" data-i18n="r.limit"></label><input id="job-limit" type="number" min="1" max="360" step="1" value="120" required>
        <p class="form-note" data-i18n="r.formNote"></p>
        <button id="job-submit" type="submit" disabled data-i18n="r.submit"></button><p id="capabilities" role="status"></p><button id="server-retry" type="button" data-i18n="r.serverRetry"></button>
      </form>
      <section class="job-panel" id="job-panel" hidden data-i18n-aria="r.jobPanel"><h2 id="job-title"></h2><p id="job-status" role="status" aria-live="polite"></p><pre id="job-logs" data-i18n-aria="r.jobLogs"></pre><div class="job-actions"><button id="job-cancel" data-i18n="r.jobCancel"></button><button id="job-retry-status" hidden data-i18n="r.jobRetry"></button><button id="job-open" hidden data-i18n="r.jobOpen"></button><button id="scene-build" hidden></button><button id="scene-cancel" hidden data-i18n="r.sceneCancel"></button><button id="scene-open" hidden data-i18n="r.sceneOpen"></button></div><p id="scene-status" role="status"></p></section>
    </aside>
    <section class="research-result" data-tutorial="asteroid-results" data-i18n-aria="r.resultAria"><div id="result-status" role="status"></div><div id="result-content"></div></section>
  </div>`;
  applyI18n(host);
  let shownResult: {result: AnalysisResult; url: string}|null = null;
  const el = <T extends HTMLElement>(id: string) => host.querySelector<T>('#'+id)!;
  const input = el<HTMLInputElement>('job-target');
  const resultStatus = el('result-status');
  const resultContent = el('result-content');
  const setStatus = (message: ()=>string, isError = false) => { bindText(resultStatus, message); resultStatus.classList.toggle('error', isError); };
  bindText(el('capabilities'),()=>t('r.checking'));
  // A language switch re-renders the open result in place and keeps open <details> and scroll positions.
  const offLang = onLang(() => {
    if (!shownResult) return;
    const open = [...resultContent.querySelectorAll('details')].map(d => d.open);
    const scrolls = [...host.querySelectorAll<HTMLElement>('.research-result, .table-scroll, details pre')].map(e => [e.scrollTop, e.scrollLeft]);
    const page = [scrollX, scrollY];
    renderResult(shownResult.result, shownResult.url);
    resultContent.querySelectorAll('details').forEach((d, i) => { if (open[i]) d.open = true; });
    host.querySelectorAll<HTMLElement>('.research-result, .table-scroll, details pre').forEach((e, i) => { if (scrolls[i]) { e.scrollTop = scrolls[i][0]; e.scrollLeft = scrolls[i][1]; } });
    scrollTo(page[0], page[1]);
  });
  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {cache:'no-store', credentials:'omit', ...init});
    let value: any;
    try { value = await response.json(); } catch { throw new LocalError('r.badJson',{s:response.status}); }
    if (!response.ok) throw Object.assign(value.error ? Error(value.error) : new LocalError('r.requestFailed',{s:response.status}),{status:response.status,jobId:value.id});
    return value;
  }
  async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const config=apiConfig;
    const headers = new Headers(init.headers);
    for(const [name,value] of Object.entries(await sessionHeaders(config, init.signal ?? controller.signal))) headers.set(name,value);
    try{return await request<T>(config.apiBase+api+path,{...init,headers,redirect:'error'});}
    catch(error){if((error as {status?:number}).status===401)forgetSession(config);throw error;}
  }
  async function checkCapabilities(force = false) {
    if(checking || disposed)return;
    checking=true;el<HTMLButtonElement>('server-retry').disabled=true;updateRunButton();
    try {
      const config=await loadApiConfig(controller.signal,force);
      if(disposed)return;
      if(config.apiBase!==apiConfig.apiBase){clearTimeout(pollTimer);pollController?.abort();currentJob=null;lastJobId='';loadedJobResult='';el('job-panel').hidden=true;}
      apiConfig=config;
      if(!config.apiBase && config.localServices===false && !config.publicMode)throw new LocalError('r.noServer');
      capabilities = await request(config.apiBase+api+'/capabilities', {signal:controller.signal});
      if(disposed)return;
      const caps=capabilities!;bindText(el('capabilities'),()=>caps.available ? t('r.connected') : caps.reason || t('r.unavailable'));
      el<HTMLInputElement>('job-limit').max = String(capabilities!.maxImages ?? 360);
      if (!currentJob && capabilities!.activeJobId) void poll(capabilities!.activeJobId);
      else if(!currentJob && capabilities!.available){try{const remembered=sessionStorage.getItem(storageKey());if(remembered&&/^[a-f0-9-]{36}$/.test(remembered))void poll(remembered);}catch{/* Optional persistence. */}}
    } catch (error) {
      if (disposed) return;
      capabilities = {available:false};
      bindText(el('capabilities'),()=>t('r.notConnected',{m:(error as Error).message}));
    } finally {
      checking=false;if(!disposed){el<HTMLButtonElement>('server-retry').disabled=false;updateRunButton();}
    }
  }
  function updateRunButton() {
    el<HTMLButtonElement>('job-submit').disabled = checking || submitting || !capabilities?.available || !!currentJob && ['running','queued'].includes(currentJob.status);
  }
  function renderResult(result: AnalysisResult, url: string) {
    const r = result.record;
    const text = (key: string) => typeof r[key] === 'string' ? String(r[key]) : t('r.notProvided');
    const diameterRows = [
      [t('r.dThermal'), r.diameter_km, r.diameter_interval_68_km, r.diameter_source],
      [t('r.dStat'), r.diameter_statistical_km, r.diameter_statistical_interval_68_km, r.diameter_statistical_method],
      [t('r.dCombined'), r.diameter_combined_km, r.diameter_combined_interval_68_km, r.diameter_combined_method],
      [t('r.dCatalog'), r.catalog_diameter_km, null, r.catalog_diameter_source],
      [t('r.dShape'), r.catalog_effective_diameter_km, r.catalog_effective_diameter_interval_68_km, t('r.dShapeNote')],
    ];
    const limits = Array.isArray(r.limitations) ? r.limitations : [];
    const densityOnHold = limits.some(v => /density.*hold/i.test(String(v)));
    const plots = result.assets?.plots ?? [];
    const plotNames: Record<string,string> = {spectrum:t('p.spectrum'),separation:t('p.separation'),residuals:t('p.residuals'),reference_comparison:t('p.reference'),'reference-comparison':t('p.reference'),sky_track:t('p.skyTrack'),'sky-track':t('p.skyTrack')};
    resultContent.innerHTML = `<div class="result-heading"><div><div class="eyebrow">OBSERVATION & MODEL</div><h2>${esc(r.official_name || result.id)}</h2><p>${esc(r.observation_date || '')}</p></div><span class="result-badge">${t('r.realBased')}</span></div>
      <div class="result-metrics"><article><span>${t('r.mStatus')}</span><strong>${esc(r.quality_status || t('r.notProvided'))}</strong><small>${t('r.mStatusNote')}</small></article><article><span>${t('r.mConf')}</span><strong>${esc(confident(r.confidence_level))}</strong><small>${t('r.mConfNote')}</small></article><article><span>${t('r.mSpec')}</span><strong>${esc(number(result.counts?.points,0))}</strong><small>${t('r.mSpecNote')}</small></article><article><span>${t('r.mClass')}</span><strong>${esc(r.spectral_class || t('r.notDerived'))}</strong><small>${esc(t('r.mClassNote',{c:confident(r.classification_confidence)}))}</small></article></div>
      <p class="research-explanation">${t('r.explain')}</p>
      <div class="plot-grid">${plots.map(plot => {try {return `<figure><img loading="lazy" width="1000" height="600" src="${esc(artifactUrl(url,plot.file))}" alt="${esc(plotNames[plot.kind] || plot.kind)}"><figcaption>${esc(plotNames[plot.kind] || plot.kind)}</figcaption></figure>`;} catch {return '';}}).join('')}</div>
      <section class="result-card"><h3>${t('r.diamTitle')}</h3><p>${t('r.diamText')}</p><div class="table-scroll"><table><thead><tr><th>${t('r.thMethod')}</th><th>${t('r.thDiam')}</th><th>${t('r.th68')}</th><th>${t('r.thSource')}</th></tr></thead><tbody>${diameterRows.map(row => `<tr><th>${esc(row[0])}</th><td>${esc(number(row[1]))}</td><td>${esc(interval(row[2]))}</td><td>${esc(row[3] || t('r.notProvided'))}</td></tr>`).join('')}</tbody></table></div><p>${esc(t('r.bestSource',{s:String(r.diameter_best_source || t('r.notProvided')),c:confident(r.diameter_best_confidence)}))}</p></section>
      <section class="result-card"><h3>${t('r.physTitle')}</h3><dl class="physical-values"><dt>${t('r.albedo')}</dt><dd>${esc(number(r.geometric_albedo_pV,3))} ± ${esc(number(r.albedo_uncertainty,3))} · ${esc(r.albedo_status || t('r.notProvided'))}</dd><dt>${t('r.mass')}</dt><dd>${esc(scientific(r.mass_kg))} ± ${esc(scientific(r.mass_uncertainty))}</dd><dt>${t('r.massSource')}</dt><dd>${esc(r.mass_method || t('r.notProvided'))}${t('r.massNote')}</dd><dt>${t('r.density')}</dt><dd>${esc(number(r.density,0))} ± ${esc(number(r.density_uncertainty,0))}${densityOnHold?` · <strong>${t('r.densityHold')}</strong>`:''}</dd><dt>${t('r.shape')}</dt><dd>${esc(text('shape_assumption'))}</dd></dl></section>
      <section class="result-card"><h3>${t('r.limitsTitle')}</h3>${limits.length?`<ul>${limits.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:`<p>${t('r.noLimits')}</p>`}</section>
      <section class="result-card"><h3>${t('r.reproTitle')}</h3><div id="result-downloads" class="download-links"></div><p>${esc(t('r.repro',{a:String(r.analysis_timestamp || t('r.notProvided')),m:String(r.model_version || t('r.notProvided'))}))}</p><details><summary>${t('r.inputs')}</summary><pre>${esc(JSON.stringify(r.input_data_sources ?? [],null,2))}</pre></details><details><summary>${t('r.prior')}</summary><pre>${esc(JSON.stringify(r.classification_prior ?? null,null,2))}</pre></details><details><summary>${t('r.fullJson')}</summary><pre>${esc(JSON.stringify(result,null,2))}</pre></details></section>`;
    const downloads = el('result-downloads');
    for (const [key,label] of [['report',t('r.dlReport')],['observations',t('r.dlObs')],['spectrum',t('r.dlSpec')],['components',t('r.dlComp')],['temporal',t('r.dlTemporal')]]) {
      const file = result.assets?.[key as keyof NonNullable<AnalysisResult['assets']>];
      if (typeof file !== 'string') continue;
      try { const a = document.createElement('a'); a.href=artifactUrl(url,file); a.textContent=label+' ↗'; a.target='_blank'; a.rel='noopener'; downloads.append(a); } catch { /* Invalid artifact paths are never opened. */ }
    }
  }
  async function loadResult(url: string, expectedId?: string) {
    const ownGeneration = ++generation;
    loadController?.abort(); loadController = new AbortController();
    resultContent.replaceChildren(); shownResult=null; setStatus(()=>t('r.loadingResult'));
    try {
      const result = validateResult(await request(url,{signal:loadController.signal}));
      if (disposed || ownGeneration!==generation) return;
      if (expectedId && result.id!==expectedId) throw new LocalError('r.idMismatch');
      shownResult={result,url};renderResult(result,url); setStatus(()=>'');
      if (result.coverage?.start?.match(/^\d{4}-\d{2}-\d{2}/)) el<HTMLInputElement>('job-start').value=result.coverage.start.slice(0,10);
      if (result.coverage?.end?.match(/^\d{4}-\d{2}-\d{2}/)) el<HTMLInputElement>('job-end').value=result.coverage.end.slice(0,10);
    } catch(error) {
      if (disposed || ownGeneration!==generation || loadController.signal.aborted) return;
      setStatus(()=>t('r.openFailed',{m:String((error as Error).message)}),true);
      const retry=document.createElement('button');bindText(retry,()=>t('r.reloadResult'));retry.onclick=()=>void loadResult(url,expectedId);resultContent.append(retry);
    }
  }
  function selectTarget(value: string, announce = true) {
    const item = matchTarget(catalog,value);
    target=item?.numberedId || item?.objectId || item?.id || value.trim(); input.value=target;
    el<HTMLSelectElement>('research-target').value=item?.id || '';
    if (announce) options.onTarget(target);
    if (item) {
      try { void loadResult(artifactUrl(catalogUrl,item.detail),item.id); } catch(error) { setStatus(()=>String(error),true); }
    } else if (target) {
      ++generation;loadController?.abort();resultContent.replaceChildren();shownResult=null;const missing=target;setStatus(()=>t('r.noPrepared',{t:missing}));
    }
  }
  async function loadCatalog() {
    bindText(el('catalog-status'),()=>t('r.listLoading'));el('catalog-retry').hidden=true;
    try {
      const value=validateCatalog(await request(catalogUrl,{signal:controller.signal}));
      if(disposed)return;
      catalog=value.targets;
      el<HTMLSelectElement>('research-target').innerHTML='<option value="" data-i18n="r.choose">'+esc(t('r.choose'))+'</option>'+catalog.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
      const n=catalog.length;bindText(el('catalog-status'),()=>t('r.catalogCount',{n}));
      if(target)selectTarget(target,false); else if(catalog[0])selectTarget(catalog[0].id); else setStatus(()=>t('r.noResults'));
    } catch(error) {
      if(disposed)return;
      bindText(el('catalog-status'),()=>t('r.catalogFailed'));el('catalog-retry').hidden=false;
      el<HTMLSelectElement>('research-target').innerHTML='<option value="" data-i18n="r.catalogError">'+esc(t('r.catalogError'))+'</option>';
      setStatus(()=>t('r.catalogFailedLong'),true);
    }
  }
  function rememberJob(id: string) { try {sessionStorage.setItem(storageKey(),id);} catch { /* Session persistence is optional. */ } }
  function renderJob(job: AnalysisJob) {
    currentJob=job;rememberJob(job.id);el('job-panel').hidden=false;
    bindText(el('job-title'),()=>t('r.jobTitleT',{t:job.target}));
    bindText(el('job-status'),()=>`${statusLabel(job.status)}${job.error?' · '+job.error:''}`);
    const log=el('job-logs');const atEnd=log.scrollHeight-log.scrollTop-log.clientHeight<30;
    log.textContent=(job.logs || []).join('\n');if(atEnd)log.scrollTop=log.scrollHeight;
    el('job-cancel').hidden=!['queued','running'].includes(job.status);
    el('job-open').hidden=job.status!=='completed'||!job.resultUrl;
    el('scene-build').hidden=job.status!=='completed'||job.scene?.status==='running'||job.scene?.status==='completed';
    bindText(el('scene-build'),()=>job.scene?.status==='failed'?t('r.sceneRebuild'):t('r.sceneBuild'));
    el('scene-open').hidden=job.scene?.status!=='completed'||!job.scene.url;
    el('scene-cancel').hidden=job.scene?.status!=='running';
    bindText(el('scene-status'),()=>job.scene?.status==='completed'?t('r.sceneReady'):job.scene?.status==='running'?t('r.sceneRunning'):job.scene?.error?t('r.sceneFailed',{e:job.scene.error}):job.status==='completed'?t('r.completeNote'):'');
    updateRunButton();
  }
  async function openJobResult() {
    if(!currentJob?.resultUrl)return;
    const url=jobResultUrl(currentJob.resultUrl,location.origin,apiConfig.apiBase);
    if(!url){bindText(el('job-status'),()=>t('r.jobUrlMismatch'));return;}
    loadedJobResult=currentJob.id;
    target=currentJob.target;input.value=target;options.onTarget(target);
    await loadResult(url);
  }
  async function poll(id: string) {
    lastJobId=id;
    clearTimeout(pollTimer);if(disposed||!active)return;
    pollController?.abort();const ownController=new AbortController();pollController=ownController;
    try {
      const job=await requestApi<AnalysisJob>('/jobs/'+encodeURIComponent(id),{signal:ownController.signal});
      if(disposed||ownController.signal.aborted||pollController!==ownController)return;
      el('job-retry-status').hidden=true;renderJob(job);
      if(job.status==='completed'&&loadedJobResult!==job.id&&target===job.target)void openJobResult();
      if(['queued','running'].includes(job.status)||job.scene?.status==='running')pollTimer=window.setTimeout(()=>void poll(id),1500);
    } catch(error) {
      if(disposed||ownController.signal.aborted||pollController!==ownController)return;
      el('job-panel').hidden=false;bindText(el('job-status'),()=>t('r.statusFailed',{m:(error as Error).message}));
      el('job-retry-status').hidden=false;
    }
  }
  el<HTMLFormElement>('analysis-form').onsubmit=async event=>{
    event.preventDefault();
    if(submitting)return;
    const start=el<HTMLInputElement>('job-start').value,end=el<HTMLInputElement>('job-end').value;
    if(end<start){bindText(el('capabilities'),()=>t('r.endBeforeStart'));return;}
    submitting=true;updateRunButton();
    try {
      const job=await requestApi<AnalysisJob>('/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:input.value.trim(),start,end,maxImages:el<HTMLInputElement>('job-limit').valueAsNumber}),signal:controller.signal});
      target=job.target;options.onTarget(target);renderJob(job);void poll(job.id);
    }catch(error){
      if(!disposed){
        bindText(el('capabilities'),()=>(error as Error).message);
        const conflict=error as {status?:number;jobId?:string};
        if(conflict.status===409&&conflict.jobId&&/^[a-f0-9-]{36}$/.test(conflict.jobId))void poll(conflict.jobId);
      }
    }finally{submitting=false;updateRunButton();}
  };
  el('job-cancel').onclick=async()=>{if(!currentJob)return;try{renderJob(await requestApi('/jobs/'+currentJob.id,{method:'DELETE',signal:controller.signal}));clearTimeout(pollTimer);}catch(error){bindText(el('job-status'),()=>(error as Error).message);}};
  el('scene-build').onclick=async()=>{if(!currentJob)return;el<HTMLButtonElement>('scene-build').disabled=true;try{renderJob(await requestApi('/jobs/'+currentJob.id+'/scene',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal}));void poll(currentJob.id);}catch(error){bindText(el('scene-status'),()=>(error as Error).message);}finally{el<HTMLButtonElement>('scene-build').disabled=false;}};
  el('scene-cancel').onclick=async()=>{if(!currentJob)return;try{renderJob(await requestApi('/jobs/'+currentJob.id+'/scene',{method:'DELETE',signal:controller.signal}));clearTimeout(pollTimer);}catch(error){bindText(el('scene-status'),()=>(error as Error).message);}};
  el('scene-open').onclick=()=>{if(currentJob?.scene?.url)options.onOrbit(currentJob.target,currentJob.scene.url);};
  el('job-open').onclick=()=>void openJobResult();
  el('job-retry-status').onclick=()=>{if(lastJobId)void poll(lastJobId);};
  el('catalog-retry').onclick=()=>void loadCatalog();
  el('server-retry').onclick=()=>void checkCapabilities(true);
  el<HTMLSelectElement>('research-target').onchange=event=>selectTarget((event.target as HTMLSelectElement).value);
  el('research-orbit').onclick=()=>options.onOrbit(target);
  void loadCatalog();void checkCapabilities();
  return {
    selectTarget,
    setActive(value: boolean){active=value;if(!value){clearTimeout(pollTimer);pollController?.abort();}else if(lastJobId)void poll(lastJobId);},
    dispose(){offLang();disposed=true;++generation;clearTimeout(pollTimer);controller.abort();loadController?.abort();pollController?.abort();host.replaceChildren();},
  };
}
