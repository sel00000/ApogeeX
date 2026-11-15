async(page)=>{
 await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:5188');await page.waitForFunction(()=>window.__app);
 const result=await page.evaluate(async()=>{
 const {SolarScene}=await import('/src/scene.ts');const bodies=await(await fetch('/data/bodies.json')).json();const base=bodies.find(b=>b.id==='433');const real=bodies.filter(b=>b.kind==='asteroid');
 const stress=[...bodies,...Array.from({length:1000-real.length},(_,i)=>({...base,id:String(900000+i),name:'TEST FIXTURE '+i}))];
 const box=document.createElement('div');box.style.cssText='position:fixed;inset:0;width:1000px;height:700px;z-index:100;background:#000';document.body.append(box);
 const scene=new SolarScene(box,stress);let mjd=60860;scene.setTime(mjd);scene.onTick=dt=>scene.setTime(mjd+=dt);scene.setPlaying(true);
 const times=await new Promise(resolve=>{let a=[],prev=0;function tick(t){if(prev)a.push(t-prev);prev=t;if(a.length<240)requestAnimationFrame(tick);else{a.sort((x,y)=>x-y);resolve({p50:a[120],p95:a[228]});}}requestAnimationFrame(tick);});
 scene.setPlaying(false);return {fixture:'1000 asteroids / repeated real orbit, TEST ONLY, never product data',...scene.metrics(),timings:times};
 });await page.reload();await page.evaluate(result=>{window.__stress=result;},result);
}
