async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:8710');
 await page.waitForFunction(()=>window.__app&&document.querySelector('#image-status').textContent.includes('실제 SPHEREx'));
 const initial=await page.evaluate(()=>window.__app.metrics());
 await page.getByRole('button',{name:'SPHEREx 시점',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-view=observer]').classList.contains('active'));
 await page.evaluate(()=>window.__app.choose('913'));
 if(await page.locator('[data-view=observer]').isEnabled())throw Error('Unprepared observer mode enabled');
 if(await page.locator('[data-view=observer]').evaluate(e=>e.classList.contains('active')))throw Error('Stale observer mode');
 await page.locator('.availability summary').click();
 if(!(await page.locator('#availability').textContent()).includes('UNMEASURED'))throw Error('Missing quality explanation');
 await page.evaluate(()=>window.__app.choose('433'));
 await page.waitForFunction(()=>document.querySelector('#image-status').textContent.includes('실제 SPHEREx'));
 await page.getByRole('button',{name:'재생',exact:true}).click();
 const timings=await page.evaluate(()=>new Promise(resolve=>{let previous=0,values=[];function tick(t){if(previous)values.push(t-previous);previous=t;if(values.length<240)requestAnimationFrame(tick);else{values.sort((a,b)=>a-b);resolve({frameMedian:values[120],frameP95:values[228]});}}requestAnimationFrame(tick);}));
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const paused=await page.evaluate(()=>window.__app.metrics());
 if(paused.mjd<=initial.mjd)throw Error('Timeline did not advance');
 const names=await page.locator('[data-object]').evaluateAll(es=>es.map(e=>e.dataset.object));
 for(const id of names){await page.evaluate(id=>window.__app.choose(id),id);if(id!=='913')await page.waitForFunction(()=>!document.querySelector('#image-status').textContent.includes('여는 중'));}
 await page.evaluate(()=>{for(let i=0;i<100;i++){window.__app.choose(i%2?'433':'10');window.__app.showObservation(i%3);}});
 await page.waitForFunction(()=>document.querySelector('#image-status').textContent.includes('실제 SPHEREx'));
 const after=await page.evaluate(()=>window.__app.metrics());
 if(after.cachedImages>8||after.bytes>64*1024*1024)throw Error('Image cache unbounded');
 if(after.geometries>paused.geometries+1)throw Error('Geometry leak');
 await page.evaluate(()=>{window.__app.choose('433');window.__app.setView('target');});
 await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 await page.screenshot({path:'docs/preview-desktop.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'SPHEREx 시점',exact:true}).click();
 await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 await page.screenshot({path:'docs/preview-observer.png'});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile horizontal overflow');
 await page.screenshot({path:'docs/preview-mobile.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(result=>{window.__validation=result;},{initial,paused,after,timings,errors,browser:await page.evaluate(()=>navigator.userAgent)});
}
