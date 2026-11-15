async(page)=>{
 await page.goto('http://127.0.0.1:8710');await page.waitForFunction(()=>window.__app?.metrics().fixedSky);
 const result=await page.evaluate(async()=>{
  const sequences=await(await fetch('/data/comparisons.json')).json();let frames=0;
  for(const s of sequences){window.__app.choose(s.objectId);for(let i=0;i<s.frames.length;i++){
   await window.__app.showObservation(i);const m=window.__app.metrics();
   if(m.observation!==s.frames[i].id||!m.fixedSky)throw Error('Frame not committed '+s.objectId+' '+i);
   if(m.cachedImages>8)throw Error('Unbounded cache');frames++;
  }}
  return{sequences:sequences.length,frames,cache:window.__app.metrics().cachedImages};
 });await page.evaluate(r=>window.__allComparisons=r,result);
}
