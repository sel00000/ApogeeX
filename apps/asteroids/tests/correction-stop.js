async(page)=>{
 await page.goto('http://127.0.0.1:8710');await page.waitForFunction(()=>window.__app?.metrics().fixedSky);
 const initial=await page.evaluate(()=>window.__app.metrics().observation);
 let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);
 await page.route('**/data/images/fixed-433-1-atlas.png',async route=>{started();await gate;await route.continue().catch(()=>{});});
 await page.locator('#sequence-play').click();await ready;
 await page.locator('#sequence-play').click();release();
 await page.waitForFunction(()=>!window.__app.metrics().sequencePlaying);
 await page.unrouteAll({behavior:'wait'});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const result=await page.evaluate(()=>window.__app.metrics());
 if(result.observation!==initial)throw Error('Stopped pending sequence still changed committed frame');
 await page.evaluate(r=>window.__stopResult=r,{initial,after:result.observation,playing:result.sequencePlaying});
}
