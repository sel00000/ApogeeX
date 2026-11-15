async(page)=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:8710/?view=follow');await page.waitForFunction(()=>window.__app?.metrics().fixedSky&&!document.querySelector('[data-view=observer]').disabled);
 await page.selectOption('#speed','30');await page.evaluate(()=>{window.__app.setPlaying(true);window.__app.setView('target');});await page.waitForFunction(()=>!window.__app.metrics().flying);
 const result=await page.evaluate(()=>{window.__app.setPlaying(false);return window.__app.metrics();});
 if(Math.hypot(result.selectedScreen[0],result.selectedScreen[1])>.05)throw Error('Moving target lost during fly-in');
 await page.evaluate(r=>window.__followResult=r,result);
}
