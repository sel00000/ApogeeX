async (page) => {
  const errors = [], remoteDataRequests=[];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => {if(/irsa\.ipac|ssd\.jpl/.test(r.url()))remoteDataRequests.push(r.url());});
  await page.setViewportSize({width:1440,height:960});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8710/?catalog=jiho-324e485');
  await page.waitForFunction(()=>window.__app?.metrics().fixedSky && !document.querySelector('[data-view=observer]').disabled);
  if(await page.locator('[data-object]').count()!==24) throw Error('Catalogue count');
  const added=['64','216','596','2566','35107'], summary=[];
  for(const id of added){
    await page.locator(`[data-object="${id}"]`).click();
    await page.waitForFunction(id=>window.__app.metrics().selected===id && window.__app.metrics().fixedSky && !document.querySelector('[data-view=observer]').disabled,id);
    await page.locator('[data-view=observer]').click();
    await page.waitForFunction(()=>!window.__app.metrics().scheduled);
    const before=await page.evaluate(()=>window.__app.metrics());
    if(before.screenAlignmentError>.05 || !before.trailVisible) throw Error('Initial alignment '+id);
    await page.locator('#photo-visible').uncheck();
    const off=await page.evaluate(()=>window.__app.metrics());
    if(off.photoVisible || JSON.stringify(off.cameraPosition)!==JSON.stringify(before.cameraPosition)) throw Error('Photo toggled camera '+id);
    await page.locator('#photo-visible').check();
    const modes=[];
    for(const mode of ['photo','model','blend']){
      await page.locator(`[data-composite=${mode}]`).click();
      modes.push(await page.locator('#image').evaluate(c=>c.toDataURL()));
    }
    if(new Set(modes).size!==3)throw Error('Image/model modes '+id);
    await page.locator('#sequence-play').click();
    await page.waitForFunction(id=>window.__app.metrics().observation!==id,before.observation);
    await page.locator('#sequence-play').click();
    const after=await page.evaluate(()=>window.__app.metrics());
    if(Math.hypot(...after.predicted.map((x,i)=>x-before.predicted[i]))<.01)throw Error('No image motion '+id);
    if(after.screenAlignmentError>.05 || after.trailCurrent!==after.observation)throw Error('Playback alignment '+id);
    summary.push({id,frames:after.frameCount,screenError:after.screenAlignmentError,motionPixels:Math.hypot(...after.predicted.map((x,i)=>x-before.predicted[i]))});
    if(id==='216'||id==='35107')await page.screenshot({path:`output/playwright/jiho-${id}.png`});
  }
  const all=await page.evaluate(async()=>{
    const seq=await(await fetch('/data/comparisons.json')).json(),obs=await(await fetch('/data/observations.json')).json();
    const groups=seq.map(s=>({id:s.objectId,frames:s.frames}));
    for(const id of new Set(obs.filter(o=>o.image).map(o=>o.objectId)))if(!groups.some(g=>g.id===id))groups.push({id,frames:obs.filter(o=>o.objectId===id&&o.image)});
    const settle=()=>new Promise(resolve=>{function tick(){if(window.__app.metrics().scheduled)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
    let frames=0,maxScreenError=0,maxSkyError=0,maxGeometries=0,maxTextures=0,maxCached=0;
    for(const g of groups){window.__app.choose(g.id);await window.__app.showObservation(0);window.__app.setView('observer');await settle();
      for(let i=0;i<g.frames.length;i++){
        await window.__app.showObservation(i);await settle();const m=window.__app.metrics();
        if(m.observation!==g.frames[i].id || m.trailCurrent!==m.observation || !m.trailPoints.some(p=>p.id===m.observation) || m.trailPoints.some(p=>p.objectId!==g.id)) throw Error('Wrong image/trail '+g.id);
        if(m.screenAlignmentError===null || m.screenAlignmentError>.05 || m.overlayErrorPixels>.01)throw Error('Projection '+g.id);
        if(Math.hypot(...m.cameraPosition.map((x,j)=>x-g.frames[i].spacecraft[j]))>1e-12)throw Error('Observer position '+g.id);
        maxScreenError=Math.max(maxScreenError,m.screenAlignmentError);maxSkyError=Math.max(maxSkyError,m.overlayErrorPixels);maxGeometries=Math.max(maxGeometries,m.geometries);maxTextures=Math.max(maxTextures,m.textures);maxCached=Math.max(maxCached,m.cachedImages);frames++;
      }
    }
    if(maxCached>8 || maxTextures>3 || maxGeometries>20)throw Error('Growing resource count');
    return {objects:groups.length,frames,maxScreenError,maxSkyError,maxGeometries,maxTextures,maxCached};
  });
  await page.locator('[data-view=system]').click();
  await page.evaluate(()=>window.__app.setPlaying(true));
  const timings=await page.evaluate(()=>new Promise(resolve=>{const values=[];let prev;function tick(t){if(prev)values.push(t-prev);prev=t;if(values.length<180)requestAnimationFrame(tick);else{values.sort((a,b)=>a-b);resolve({median:values[90],p95:values[171]});}}requestAnimationFrame(tick);}));
  await page.evaluate(()=>window.__app.setPlaying(false));
  await page.waitForFunction(()=>!window.__app.metrics().scheduled);
  const stopped=await page.evaluate(()=>window.__app.metrics());
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile overflow');
  if(errors.length)throw Error(errors.join('\n'));
  if(remoteDataRequests.length)throw Error('Runtime NASA requests');
  await page.evaluate(r=>window.__catalogRefresh=r,{summary,all,timings,stopped,errors,remoteDataRequests});
}
