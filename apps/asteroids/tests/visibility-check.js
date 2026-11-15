async(page)=>{
 await page.goto('http://127.0.0.1:8710');await page.waitForFunction(()=>window.__app);
 await page.evaluate(()=>window.__app.setPlaying(true));
 const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();
 const real=await page.evaluate(()=>({hidden:document.hidden,metrics:window.__app.metrics()}));
 await other.close();await page.bringToFront();
 // Headless environments may keep all pages visible. Exercise the same handler explicitly.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await page.evaluate(()=>window.__app.metrics());if(hidden.scheduled)throw Error('Rendering still scheduled while hidden');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));window.__app.setPlaying(false);});
 await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 await page.evaluate(result=>window.__visibility=result,{real,handlerStopped:!hidden.scheduled});
}
