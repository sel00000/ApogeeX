async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:8710/?view=motion-circles');await page.waitForFunction(()=>window.__app?.metrics().trailCurrent&&!document.querySelector('[data-view=observer]').disabled);
 await page.evaluate(async()=>{window.__app.choose('69');await window.__app.showObservation(1);window.__app.setView('observer');});await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 await page.locator('#photo-opacity').evaluate(e=>{e.value='1';e.dispatchEvent(new Event('input',{bubbles:true}));});
 const hesperia=await page.evaluate(()=>window.__app.metrics());if(!hesperia.trailVisible||hesperia.trailPoints.length!==hesperia.frameCount||!hesperia.sharedTrailGeometry)throw Error('Hesperia trail missing');
 await page.screenshot({path:'docs/movement-hesperia.png'});
 await page.locator('[data-composite=photo]').click();
 const core=()=>page.locator('#image').evaluate(c=>{const p=window.__app.metrics().predicted;return [...c.getContext('2d').getImageData(Math.floor((p[0]+.5)*4)-1,Math.floor((p[1]+.5)*4)-1,3,3).data];});
 const coreOn=await core();
 const on=await page.locator('#image').evaluate(c=>c.toDataURL());
 await page.locator('#show-trail').uncheck();const off=await page.locator('#image').evaluate(c=>c.toDataURL());
 if(JSON.stringify(coreOn)!==JSON.stringify(await core()))throw Error('Trail obscures current source core');
 if(on===off||(await page.evaluate(()=>window.__app.metrics())).trailVisible)throw Error('Toggle failed');
 await page.locator('#show-trail').check();
 const groups=await page.evaluate(async()=>{const seq=await(await fetch('/data/comparisons.json')).json(),obs=await(await fetch('/data/observations.json')).json();const g=seq.map(s=>({id:s.objectId,frames:s.frames}));for(const id of new Set(obs.filter(o=>o.image).map(o=>o.objectId)))if(!g.some(s=>s.id===id))g.push({id,frames:obs.filter(o=>o.objectId===id&&o.image)});return g;});
 let total=0,maxTextures=0;
 for(const g of groups){await page.evaluate(async id=>{window.__app.choose(id);await window.__app.showObservation(0);window.__app.setView('observer');},g.id);
  for(let i=0;i<g.frames.length;i++){await page.evaluate(i=>window.__app.showObservation(i),i);await page.waitForFunction(()=>!window.__app.metrics().scheduled);const m=await page.evaluate(()=>window.__app.metrics());
   if(!m.trailVisible||m.trailCurrent!==g.frames[i].id||!m.trailPoints.some(p=>p.id===m.trailCurrent)||m.trailPoints.some(p=>p.objectId!==g.id))throw Error('Wrong trail '+g.id);
   maxTextures=Math.max(maxTextures,m.textures);total++;
  }
 }
 await page.evaluate(()=>window.__app.choose('913'));if(await page.locator('#show-trail').isEnabled())throw Error('Missing image has active trail');
 await page.evaluate(async()=>{window.__app.choose('433');await window.__app.showObservation(3);window.__app.setView('observer');});await page.waitForFunction(()=>!window.__app.metrics().scheduled);await page.screenshot({path:'docs/movement-eros.png'});
 await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile overflow');
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(r=>window.__trailResult=r,{objects:groups.length,total,maxTextures,hesperia,errors});
}
