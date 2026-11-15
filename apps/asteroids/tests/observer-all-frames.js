async(page)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:8710/?view=alignment');await page.waitForFunction(()=>window.__app?.metrics().fixedSky&&!document.querySelector('[data-view=observer]').disabled);
 const result=await page.evaluate(async()=>{
  const seq=await(await fetch('/data/comparisons.json')).json(),obs=await(await fetch('/data/observations.json')).json();
  const groups=seq.map(s=>({id:s.objectId,frames:s.frames}));
  for(const id of new Set(obs.filter(o=>o.image).map(o=>o.objectId)))if(!groups.some(g=>g.id===id))groups.push({id,frames:obs.filter(o=>o.objectId===id&&o.image)});
  const settle=()=>new Promise(resolve=>{function tick(){if(window.__app.metrics().scheduled)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
  let maxScreenError=0,maxSkyError=0,frames=0,maxGeometries=0;
  for(const g of groups){window.__app.choose(g.id);await window.__app.showObservation(0);window.__app.setView('observer');await settle();
   for(let i=0;i<g.frames.length;i++){await window.__app.showObservation(i);await settle();const m=window.__app.metrics();
    if(!m.observer||m.observation!==g.frames[i].id)throw Error('Wrong frame');
    if(m.screenAlignmentError===null||m.screenAlignmentError>.05||m.overlayErrorPixels>.01)throw Error('Misaligned '+g.id+' '+JSON.stringify(m));
    if(Math.hypot(...m.cameraPosition.map((x,j)=>x-g.frames[i].spacecraft[j]))>1e-12)throw Error('Wrong spacecraft position');
    maxScreenError=Math.max(maxScreenError,m.screenAlignmentError);maxSkyError=Math.max(maxSkyError,m.overlayErrorPixels);maxGeometries=Math.max(maxGeometries,m.geometries);frames++;
   }
  }
  return {objects:groups.length,frames,maxScreenError,maxSkyError,maxGeometries,final:window.__app.metrics()};
 });
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const mobile=await page.evaluate(()=>window.__app.metrics());if(mobile.screenAlignmentError>.05||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile projection/layout');
 await page.screenshot({path:'docs/observer-mobile.png',fullPage:true});
 await page.evaluate(r=>window.__alignmentResult=r,{...result,mobileError:mobile.screenAlignmentError});
}
