/** Integration adapter for the byte-identical BLACKHOLE_BG renderer (assets/blackhole/*).
 * Motion (PN → EOB → NR-fit ringdown), shadows, Schwarzschild LUT bending, retarded GW optics,
 * the sky shader and its sky texture all stay exactly as in BLACKHOLE_BG: the galactic CAR panorama
 * sky_spherex_stars.webp with the original REPEAT/MIRRORED_REPEAT wrapping, so every bent ray still
 * lands on sky. This file only adds what the one-page app needs: waiting for a laid-out host,
 * pause/resume with the route, and complete disposal.
 */
const STAR_MAX_LOD=0;
// Full-sky (l 360° × b ±90°) galactic CAR panorama built at the TIF's native resolution (4096×2048,
// no upsampling) from SPHEREx_StarsRGB.tif. The original shader reads any CAR aspect via uAspect.
export const ORIGINAL_SKY=new URL('./assets/blackhole/sky_spherex_full.webp',import.meta.url).href;
export function mountHomeBackground(canvas,imageURL=ORIGINAL_SKY,callbacks={}) {
 const Original=window.GravityHero;
 if(!Original||!window.BBHSim)return {setActive(){},dispose(){},get stage(){return null;},get stats(){return {fallback:true,error:'Original BLACKHOLE_BG scripts unavailable'};}};
 const previousOpacity=canvas.style.opacity,host=canvas.parentElement;
 // the canvas fades in on its first drawn frame, as in the original page
 canvas.style.opacity='0';
 class AppGravityHero extends Original {
  constructor(){super(canvas,{host,...callbacks});this.active=false;}
  _program(fs){const result=super._program(fs);(this._programs||(this._programs=[])).push(result.p);return result;}
  _shader(type,source){const shader=super._shader(type,source);(this._shaders||(this._shaders=[])).push(shader);return shader;}
  _loadSky(){
   // Same panorama and the same setBackground() as the original _loadSky; only the URL is app-relative.
   const image=new Image();this._skyImage=image;image.decoding='async';
   const clear=()=>{image.onload=image.onerror=null;if(this._skyImage===image)this._skyImage=null;};
   const fail=error=>{clear();if(this._disposed)return;this.failed=true;this.loadError=error.message;this.stop();canvas.style.opacity='0';console.warn('[home] black-hole sky unavailable',error);};
   image.onload=()=>{if(this._disposed){clear();return;}try{this.setBackground(image,'spherex');this._draw(this.now());clear();}catch(error){fail(error);}};
   image.onerror=()=>fail(new Error('sky panorama could not be loaded'));
   image.src=imageURL;
  }
  // Sharper stars at the original 3 M-pixel budget: the sky texture is read from its full-
  // resolution level instead of a blurrier mip level. Same shader work per pixel, so no extra GPU cost.
  _finishSky(tex){super._finishSky(tex);const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameterf(gl.TEXTURE_2D,gl.TEXTURE_MAX_LOD,STAR_MAX_LOD);}
  // Framing only: show ~210° across the hero (≈1.6 TIF pixels per CSS px, as in the earlier V2 hero)
  // instead of 140°, so stars are not magnified past the data. Dynamics stay in screen px and are unchanged.
  _frame210(){if(this.w&&this.h){this.degPerPx=210/Math.max(this.w,this.h*1.6);this.kRad=this.degPerPx*Math.PI/180;}}
  _applyQuality(){this._frame210();super._applyQuality();}
  _resize(){
   const rect=this.host.getBoundingClientRect();if(rect.width<=0||rect.height<=0){
    this._awaitLayout=true;
    if(!this.sim){this.w=this.h=0;this.C=450;this.SQ27=3*Math.sqrt(3);this.kRad=1;this.dpr=Math.min(window.devicePixelRatio||1,2);}
    return;
   }
   if(this._awaitLayout&&this._pendingSeed){this.w=this.h=undefined;this.C=undefined;}
   super._resize();this._frame210();
   if(this._pendingSeed){this.sim.c=this.C;this._applyQuality();this._pendingSeed=false;super._seed();}
   this._awaitLayout=false;this._kick();
  }
  _seed(){if(this._awaitLayout){this._pendingSeed=true;return;}super._seed();}
  // Adaptive pixel budget: if the page has been running slower than ~48 fps for two seconds, shrink the
  // lens buffer by 30% (never below 0.9 Mpx) and keep it there. One-way, so quality never pumps up and down.
  // Only the drawing buffer changes; physics, light speed and mass units are in CSS px and stay the same.
  _govern(t){
   const dt=t-(this._govT??t);this._govT=t;this._govStart??=t;if(t-this._govStart<4||!(dt>0&&dt<0.25)||this.drag)return; // ignore page-load frames
   this._govAcc=(this._govAcc||0)+dt;this._govN=(this._govN||0)+1;
   if(this._govAcc<2)return;const avg=this._govAcc/this._govN;this._govAcc=this._govN=0;
   if(avg>1/48&&this.MAX_PIXELS>900000){this.MAX_PIXELS=Math.max(900000,Math.round(this.MAX_PIXELS*0.7));this._resize();}
  }
  _draw(t){
   this._govern(t);
   // Physics still steps every display frame; the sky is drawn at most 30 times a second
   // (60 only while a hole is held), keeping the GPU free for pointer, cards and scrolling.
   if(!this.drag&&this._shownAt!==undefined&&t-this._shownAt<1/30-0.002&&t>=this._shownAt)return;
   this._shownAt=t;
   if(this._disposed||this._awaitLayout||!this.bgTex||!this.w||!this.h)return;
   super._draw(t);canvas.style.opacity=previousOpacity;
  }
  _kick(){if(!this._disposed&&this.bgTex&&!this._awaitLayout&&this.active&&this.visible&&!document.hidden&&!this.failed)this.start();}
  _release(pointerId=this._heldPointerId){
   if(this.drag){const b=this.drag.bh;this.drag=null;if(this.sim.bodies.includes(b))this.sim.releasePlaced(b);}
   this.host.classList.remove('grabbing');
   if(pointerId!==undefined)try{this.host.releasePointerCapture(pointerId);}catch{}
   this._heldPointerId=undefined;
  }
  setActive(value){if(this._disposed)return;this.active=!!value;if(!this.active){this._release();this.stop();}else this._kick();}
  _bind(){
   this._listeners=[];const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);this._listeners.push(()=>target.removeEventListener(type,fn,options));};
   const isUI=el=>el?.closest?.('a,button,input,label,select,textarea,[data-ui]');
   listen(this.host,'pointerdown',e=>{
    if(!this.active||!this.visible||document.hidden||this.failed||!this.bgTex||isUI(e.target)||(e.button!==undefined&&e.button!==0))return;
    const p=this._local(e);this.pointer.x=p.x;this.pointer.y=p.y;let b=this._hit(p.x,p.y);
    if(b){
     if(b.eobParent){const id=b.id;this.sim._finishEOB(b.eobParent,true);b=this.sim.bodies.find(q=>q.id===id);if(!b)return;}
     this.drag={bh:b};b.kin=true;b.vx=0;b.vy=0;this._heldPointerId=e.pointerId;this.host.classList.add('grabbing');try{this.host.setPointerCapture(e.pointerId);}catch{}
    }else{this.clicks.push({x:p.x,y:p.y,t0:this.now(),chi:Math.random()*Math.PI});if(this.clicks.length>this.MAX_CLICK)this.clicks.shift();}
    this._kick();this.onInteract?.();
   });
   listen(this.host,'pointermove',e=>{if(!this.active||!this.visible||document.hidden)return;const p=this._local(e);this.pointer.x=p.x;this.pointer.y=p.y;if(!this.drag)this.host.classList.toggle('grab',!!this._hit(p.x,p.y)&&!isUI(e.target));else this._kick();},{passive:true});
   const up=e=>{if(e.pointerId===undefined||this._heldPointerId===e.pointerId)this._release(e.pointerId);};
   listen(this.host,'pointerup',up);listen(this.host,'pointercancel',up);listen(this.host,'lostpointercapture',up);
   listen(this.host,'touchstart',e=>{if(!this.active||!this.visible||document.hidden||isUI(e.target))return;const t=e.touches[0];if(t){const p=this._local(t);if(this._hit(p.x,p.y))e.preventDefault();}},{passive:false});
   const resize=()=>{cancelAnimationFrame(this._resizeFrame);this._resizeFrame=requestAnimationFrame(()=>{this._resizeFrame=0;if(this._disposed)return;this._resize();if(!this.running&&this.bgTex)this._draw(this.now());});};
   listen(window,'resize',resize);this.resizeObserver=new ResizeObserver(resize);this.resizeObserver.observe(this.host);
   listen(document,'visibilitychange',()=>{if(document.hidden){this._release();this.stop();}else this._kick();});
   this.intersectionObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this._kick();else{this._release();this.stop();}},{threshold:.02});this.intersectionObserver.observe(this.host);
   listen(this.canvas,'webglcontextlost',e=>{e.preventDefault();this._release();this.stop();this.failed=true;canvas.style.opacity='0';});
   this.motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
   listen(this.motionQuery,'change',()=>{this.reduce=this.motionQuery.matches;if(this.reduce&&!this.drag){if(this.bgTex)this._draw(this.now());this.stop();}else this._kick();});
  }
  dispose(){
   if(this._disposed)return;this._release();this.stop();this._disposed=true;this.active=false;if(this._skyImage){this._skyImage.onload=this._skyImage.onerror=null;this._skyImage.src='';this._skyImage=null;}
   clearTimeout(this.resizeTimer);cancelAnimationFrame(this._resizeFrame);this.resizeObserver?.disconnect();this.intersectionObserver?.disconnect();for(const remove of this._listeners||[])remove();
   this.host.classList.remove('grab','grabbing');canvas.style.opacity=previousOpacity;
   if(this.gl){for(const key of ['bgTex','waveTex','lutTex'])if(this[key])this.gl.deleteTexture(this[key]);for(const p of this._programs||[])this.gl.deleteProgram(p);for(const s of this._shaders||[])this.gl.deleteShader(s);if(this.vao)this.gl.deleteVertexArray(this.vao);}
  }
 }
 const hero=new AppGravityHero();
 return {setActive:value=>hero.setActive(value),dispose:()=>hero.dispose(),get stage(){return hero.sim?hero._stageInfo():null;},get sim(){return hero.sim;},get renderer(){return hero;},get stats(){return {fallback:!!hero.failed,error:hero.loadError,ready:!!hero.bgTex,model:'Original PN → EOB → NR-fit ringdown',optics:'Original Schwarzschild LUT + shared angular shadow field + retarded GW',draws:hero.timings.drawCount||0,shadePixels:canvas.width*canvas.height,physicsMs:hero.timings.stepMs,drawMs:hero.timings.drawMs,buffer:[canvas.width,canvas.height],running:hero.running};}};
}
