async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:8710/?view=observer-3d');await page.waitForFunction(()=>window.__app?.metrics().fixedSky);
 const box=await page.locator('#scene canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.57,{steps:12});await page.mouse.up();
 const free=await page.evaluate(()=>window.__app.metrics());
 await page.waitForFunction(()=>!document.querySelector('[data-view=observer]').disabled);
 const flying=await page.evaluate(()=>{document.querySelector('[data-view=observer]').click();return window.__app.metrics();});if(!flying.flying)throw Error('No 3D camera flight');
 if(await page.locator('#scene').evaluate(e=>getComputedStyle(e).opacity)==='0')throw Error('3D hidden');
 await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const on=await page.evaluate(()=>window.__app.metrics());
 if(on.overlayErrorPixels>.01)throw Error('Projection mismatch');
 await page.screenshot({path:'docs/observer-photo-on.png'});
 await page.locator('#photo-visible').uncheck();await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const off=await page.evaluate(()=>window.__app.metrics());
 if(off.photoVisible||JSON.stringify(on.cameraPosition)!==JSON.stringify(off.cameraPosition)||on.cameraFov!==off.cameraFov)throw Error('Photo toggle changed camera');
 await page.screenshot({path:'docs/observer-photo-off.png'});
 await page.locator('#photo-visible').check();await page.locator('#next').click();
 await page.waitForFunction(id=>window.__app.metrics().observation!==id,on.observation);await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const next=await page.evaluate(()=>window.__app.metrics());if(next.overlayErrorPixels>.01)throw Error('Next frame alignment lost');
 await page.getByRole('button',{name:'이전 자유 시점',exact:true}).click();await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 const back=await page.evaluate(()=>window.__app.metrics());if(Math.hypot(...back.cameraPosition.map((x,i)=>x-free.cameraPosition[i]))>1e-8)throw Error('Free camera not restored');
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(r=>window.__flightResult=r,{free,flying,on,off,next,back,errors});
}
