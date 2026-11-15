/** Event-driven decorative glass. Actual backdrop refraction is Chromium-only;
 * other engines retain the CSS blur/tint/highlight fallback supplied by the app.
 * The displacement image is generated once; no animation runs while idle.
 */
export function createGlassDisplacementMap({width=256,height=128,physicalWidth=440,physicalHeight=214,radius=26,depth=18}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>1024||height>1024)throw new RangeError('Glass map dimensions must be integers between 2 and 1024');
  if(![physicalWidth,physicalHeight,radius,depth].every(Number.isFinite)||physicalWidth<=0||physicalHeight<=0||depth<=0||radius<0)throw new RangeError('Invalid glass geometry');
  radius=Math.min(radius,physicalWidth/2,physicalHeight/2);
  const pixels=new Uint8ClampedArray(width*height*4),hx=physicalWidth/2,hy=physicalHeight/2;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const px=(x+.5)/width*physicalWidth-hx,py=(y+.5)/height*physicalHeight-hy;
    const qx=Math.abs(px)-(hx-radius),qy=Math.abs(py)-(hy-radius),ox=Math.max(qx,0),oy=Math.max(qy,0),len=Math.hypot(ox,oy);
    const distance=len+Math.min(Math.max(qx,qy),0)-radius;
    let nx,ny;
    if(len>0){nx=ox/len*Math.sign(px);ny=oy/len*Math.sign(py);}
    else if(qx>qy){nx=Math.sign(px);ny=0;}else{nx=0;ny=Math.sign(py);}
    const amount=distance<=0?Math.max(0,1+distance/depth)**2:0,i=(y*width+x)*4;
    // feDisplacementMap samples SourceGraphic at output + scale * (channel-.5).
    // Sampling inward at the rim produces a convex-glass edge, with neutral interior.
    pixels[i]=Math.round(128-127*nx*amount);pixels[i+1]=Math.round(128-127*ny*amount);pixels[i+2]=128;pixels[i+3]=255;
  }
  return {width,height,pixels};
}

let instance=0;
export function mountGlassCards(nodes,{reducedMotionMedia,refraction=true}={}) {
  const cards=Array.from(nodes||[]);if(!cards.length)return ()=>{};
  const doc=cards[0].ownerDocument,win=doc.defaultView,motion=reducedMotionMedia||win.matchMedia('(prefers-reduced-motion:reduce)');
  const NS='http://www.w3.org/2000/svg',make=(name,attrs={})=>{const el=doc.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
  const previous=cards.map(card=>({card,attribute:card.getAttribute('data-glass-refraction'),styles:Object.fromEntries(['--glass-filter','--glass-x','--glass-y','--glass-a','--tx','--ty'].map(k=>[k,[card.style.getPropertyValue(k),card.style.getPropertyPriority(k)]]))}));
  const restore=(item,key)=>{const [value,priority]=item.styles[key];if(value)item.card.style.setProperty(key,value,priority);else item.card.style.removeProperty(key);};
  let disposed=false,raf=0,pending=null,svg=null,observer=null;
  const records=[],removers=[];
  // Parsing @supports alone does not establish that an SVG backdrop filter renders.
  // Chromium implements it; WebKit's tracked reference-filter issue remains open.
  const brands=win.navigator.userAgentData?.brands||[],ua=win.navigator.userAgent||'';
  const chromium=brands.some(b=>/Chromium|Google Chrome|Microsoft Edge/.test(b.brand))||/Chrome\/|Chromium\/|Edg\//.test(ua);
  const supported=refraction&&chromium&&!!win.CSS?.supports?.('backdrop-filter','url("#spherex-glass-probe")');
  if(supported)try {
    const map=createGlassDisplacementMap(),canvas=doc.createElement('canvas');canvas.width=map.width;canvas.height=map.height;
    const context=canvas.getContext('2d');if(!context)throw Error('No canvas map');
    const image=context.createImageData(map.width,map.height);image.data.set(map.pixels);context.putImageData(image,0,0);const href=canvas.toDataURL('image/png');
    svg=make('svg',{'aria-hidden':'true',width:0,height:0,focusable:'false'});svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';const defs=make('defs');svg.append(defs);doc.body.append(svg);
    const group=++instance;
    cards.forEach((card,i)=>{
      const id=`spherex-glass-${group}-${i}`,filter=make('filter',{id,filterUnits:'userSpaceOnUse',x:0,y:0,'color-interpolation-filters':'sRGB'});
      const image=make('feImage',{href,x:0,y:0,preserveAspectRatio:'none',result:'rim-map'});
      const displacement=make('feDisplacementMap',{in:'SourceGraphic',in2:'rim-map',scale:30,xChannelSelector:'R',yChannelSelector:'G'});
      filter.append(image,displacement);defs.append(filter);records.push({card,filter,image});
      card.style.setProperty('--glass-filter',`url("#${id}")`);card.setAttribute('data-glass-refraction','on');
    });
    const sizes=new Map();
    // Each card gets a rim map with its own proportions so the lens edge stays even on tall cards.
    const mapFor=(w,h)=>{const key=Math.round(w)+'x'+Math.round(h);if(sizes.has(key))return sizes.get(key);const mw=256,mh=Math.max(2,Math.min(1024,Math.round(256*h/w))),m=createGlassDisplacementMap({width:mw,height:mh,physicalWidth:w,physicalHeight:h,radius:28,depth:26}),c=doc.createElement('canvas');c.width=mw;c.height=mh;const x=c.getContext('2d'),d=x.createImageData(mw,mh);d.data.set(m.pixels);x.putImageData(d,0,0);const url=c.toDataURL('image/png');sizes.set(key,url);return url;};
    const resize=()=>{if(disposed)return;for(const {card,filter,image} of records){const rect=card.getBoundingClientRect(),w=card.offsetWidth||rect.width,h=card.offsetHeight||rect.height;if(w<=0||h<=0)continue;for(const el of [filter,image]){el.setAttribute('width',String(w));el.setAttribute('height',String(h));}try{image.setAttribute('href',mapFor(w,h));}catch{}}};
    resize();if(win.ResizeObserver){observer=new win.ResizeObserver(resize);for(const card of cards)observer.observe(card);}
  }catch {
    svg?.remove();svg=null;records.length=0;
    for(const item of previous){restore(item,'--glass-filter');item.card.setAttribute('data-glass-refraction','off');}
  }
  else for(const card of cards)card.setAttribute('data-glass-refraction','off');
  const reset=()=>{if(raf)win.cancelAnimationFrame(raf);raf=0;pending=null;for(const item of previous){for(const key of ['--glass-x','--glass-y','--glass-a','--tx','--ty'])restore(item,key);}};
  function flush(){raf=0;if(disposed||motion.matches||!pending)return;const {card,x,y}=pending;pending=null;card.style.setProperty('--glass-x',x+'%');card.style.setProperty('--glass-y',y+'%');
    // tilt (-1..1) and the direction the bright rim should face (toward the pointer)
    const tx=(x-50)/50,ty=(y-50)/50;card.style.setProperty('--tx',tx.toFixed(3));card.style.setProperty('--ty',ty.toFixed(3));card.style.setProperty('--glass-a',(Math.atan2(ty,tx)*180/Math.PI+90).toFixed(1)+'deg');}
  for(const card of cards){
    const move=e=>{if(disposed||motion.matches||e.pointerType==='touch')return;const r=card.getBoundingClientRect();if(!r.width||!r.height)return;pending={card,x:Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100)),y:Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100))};if(!raf)raf=win.requestAnimationFrame(flush);};
    card.addEventListener('pointermove',move,{passive:true});card.addEventListener('pointerleave',reset);card.addEventListener('pointercancel',reset);removers.push(()=>{card.removeEventListener('pointermove',move);card.removeEventListener('pointerleave',reset);card.removeEventListener('pointercancel',reset);});
  }
  motion.addEventListener?.('change',reset);
  return ()=>{if(disposed)return;disposed=true;reset();observer?.disconnect();for(const remove of removers)remove();motion.removeEventListener?.('change',reset);svg?.remove();for(const item of previous){for(const key of Object.keys(item.styles))restore(item,key);if(item.attribute===null)item.card.removeAttribute('data-glass-refraction');else item.card.setAttribute('data-glass-refraction',item.attribute);}};
}
