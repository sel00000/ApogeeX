async(page)=>{
 await page.goto('http://127.0.0.1:8710/?view=observer-selection');await page.waitForFunction(()=>!document.querySelector('[data-view=observer]')?.disabled&&window.__app);
 await page.evaluate(()=>window.__app.setView('observer'));await page.waitForFunction(()=>!window.__app.metrics().scheduled);
 await page.evaluate(()=>window.__app.choose('16'));await page.waitForFunction(()=>!document.querySelector('#image-status').textContent.includes('여는 중')&&!window.__app.metrics().scheduled);
 const m=await page.evaluate(()=>window.__app.metrics());
 if(m.cameraFov<40)throw Error('Catalog switch left observer FOV');
 const before=m.cameraPosition;const b=await page.locator('#scene canvas').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.6,{steps:8});await page.mouse.up();
 const after=await page.evaluate(()=>window.__app.metrics().cameraPosition);if(Math.hypot(...after.map((x,i)=>x-before[i]))<.01)throw Error('Orbit controls disabled after selection');
 await page.evaluate(r=>window.__selectionResult=r,{fov:m.cameraFov,before,after});
}
