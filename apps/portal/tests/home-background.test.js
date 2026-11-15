import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {mountHomeBackground,ORIGINAL_SKY} from '../home-background.js';
const require=createRequire(import.meta.url);
const BBH=require('../assets/blackhole/bbh-physics.js'),EOB=require('../assets/blackhole/bbh-eob.js'),Sim=require('../assets/blackhole/bbh-sim.js'),Hero=require('../assets/blackhole/gravity-hero.js');
const nativeTable=BBH.deflectionTable;
let table;BBH.deflectionTable=(...args)=>table||(table=nativeTable(...args));
class Surface {
 constructor(width=0,height=0){this.listeners=new Map();this.clientWidth=width;this.clientHeight=height;this.style={opacity:''};this.capture=null;this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
 addEventListener(k,f){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f);}
 removeEventListener(k,f){const v=this.listeners.get(k);v?.delete(f);if(v?.size===0)this.listeners.delete(k);}
 getBoundingClientRect(){return {left:25,top:50,width:this.clientWidth,height:this.clientHeight};}
 setPointerCapture(id){this.capture=id;}
 releasePointerCapture(id){if(this.capture===id)this.capture=null;}
 emit(k,e={}){for(const fn of this.listeners.get(k)||[])fn({target:{closest:()=>null},button:0,pointerId:7,clientX:0,clientY:0,preventDefault(){},...e});}
}
async function setup(width=1000,height=900,{fail=false,deferImage=false}={}) {
 const callbacks=new Map(),shaders=[],requests=[],observers=[],intersections=[],media=new Surface(),windowEvents=new Surface();media.matches=false;let next=0,stage;const images=[];
 globalThis.window=globalThis;globalThis.BBH=BBH;globalThis.BBHEOB=EOB;globalThis.BBHSim=Sim;globalThis.GravityHero=Hero;
 window.matchMedia=()=>media;window.devicePixelRatio=2;
 window.addEventListener=windowEvents.addEventListener.bind(windowEvents);window.removeEventListener=windowEvents.removeEventListener.bind(windowEvents);
 globalThis.requestAnimationFrame=fn=>{callbacks.set(++next,fn);return next;};globalThis.cancelAnimationFrame=i=>callbacks.delete(i);
 globalThis.document=new Surface();document.hidden=false;
 globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;intersections.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 globalThis.fetch=()=>{throw Error('sky must load through an Image');};globalThis.Image=class{constructor(){this.naturalWidth=this.width=8192;this.naturalHeight=this.height=2731;images.push(this);}set src(url){this.url=url;requests.push(url);if(url&&!deferImage)queueMicrotask(()=>fail?this.onerror?.():this.onload?.());}};
 const host=new Surface(width,height),canvas=new Surface(width,height);canvas.parentElement=host;
 const names=['uBg','uWave','uView','uBuffer','uTime','uCenter','uBH','uCompanion','uOpacity','uDiagnostic','uGroup','uLut','uLutInfo','uK','uAspect','uSrc','uSrcB','uHist','uSampPx','uGain','uClick','uClickAmp','uTiffSize'];
 const gl=new Proxy({COMPILE_STATUS:1,LINK_STATUS:2,ACTIVE_UNIFORMS:3,MAX_TEXTURE_SIZE:4,createShader:()=>({}),shaderSource:(q,s)=>shaders.push(s),getShaderParameter:()=>true,getProgramParameter:(p,k)=>k===3?names.length:true,getActiveUniform:(p,i)=>({name:names[i]}),getUniformLocation:(p,k)=>k,getParameter:k=>k===4?16384:0,getExtension:()=>null},{get:(o,k)=>k in o?o[k]:()=>({})});canvas.getContext=()=>gl;
 const warn=console.warn;if(fail)console.warn=()=>{};
 const background=mountHomeBackground(canvas,'/sky.webp',{onStage:s=>{stage=s;}});
 await new Promise(resolve=>setImmediate(resolve));console.warn=warn;
 const resize=()=>{observers[0].fn();const queued=[...callbacks];callbacks.clear();for(const [,fn]of queued)fn();};
 return {host,canvas,background,callbacks,shaders,requests,observers,intersections,media,windowEvents,resize,get sim(){return background.sim;},get hero(){return background.renderer;},get stage(){return stage;},images,intersection:v=>intersections[0].fn([{isIntersecting:v}])};
}

test('restored source is byte-identical and the sky shader, texture and framing are the original ones',async()=>{
 const audit=JSON.parse(fs.readFileSync(new URL('../assets/blackhole/source-audit.json',import.meta.url)));
 for(const file of audit.files){const raw=fs.readFileSync(new URL('../assets/blackhole/'+file.file,import.meta.url));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),file.sha256);assert.equal(file.byte_identical,true);const source=new URL('../../BLACKHOLE_BG/'+file.file,import.meta.url);if(fs.existsSync(source))assert.deepEqual(raw,fs.readFileSync(source));}
 // the panorama is the original file, so bent rays always land on sky (no black outside an ellipse)
 assert.ok(ORIGINAL_SKY.endsWith('assets/blackhole/sky_spherex_full.webp'));
 const e=await setup();
 // _finishSky is extended only to read the sky at full detail (sharper stars); wrapping stays original
 for(const k of ['_newSkyTexture','setBackground','_skyCenter','_seed','_spawn','_draw']){if(k==='_draw'||k==='_seed')continue;assert.equal(e.hero[k],Hero.prototype[k],k);}
 assert.ok(e.shaders.includes(Hero.FS_MAIN));assert.ok(!e.shaders.some(src=>src.includes('uTiffSize')));
 assert.notEqual(e.hero._finishSky,Hero.prototype._finishSky);
 e.background.dispose();
});
test('production uses original step, 4096-sample retarded histories and complete original shader',async()=>{
 const e=await setup();assert.equal(e.hero._step,Hero.prototype._step);assert.equal(e.hero._external,Hero.prototype._external);assert.equal(e.hero._retireMerged,Hero.prototype._retireMerged);assert.equal(e.hero._frame,Hero.prototype._frame);
 assert.equal(e.sim.HIST,4096);assert.equal(e.sim.DT_S,1/240);assert.equal(e.sim.useEOB,true);assert.ok(e.shaders.includes(Hero.FS_MAIN));
 e.sim.bodies=[];e.sim.add(500,400,0,30,2.4);e.sim.add(560,400,0,-45,1.6);e.hero._step(.01,1/60);assert.ok(e.stage?.slot);assert.equal(e.background.stage.slot,e.stage.slot);assert.equal(e.stage.slot.buf.length,8192);
 assert.deepEqual(e.requests,['/sky.webp']);assert.equal(e.images[0].onload,null);assert.equal(e.images[0].onerror,null);assert.equal(e.background.stats.ready,true);assert.equal(e.callbacks.size,0);e.background.dispose();
});
test('hidden layout and subsequent viewport translation preserve masses, separation and physical units',async()=>{
 const e=await setup(0,0);assert.equal(e.sim.bodies.length,0);assert.equal(e.sim.t,0);
 e.host.clientWidth=1000;e.host.clientHeight=900;e.resize();assert.equal(e.sim.bodies.length,3);const before=e.sim.bodies.map(b=>[b.x,b.y,b.M,b.vx,b.vy]),c=e.sim.c,R=e.hero.R1;
 e.host.clientWidth=e.host.clientHeight=0;e.resize();assert.deepEqual(e.sim.bodies.map(b=>[b.x,b.y,b.M,b.vx,b.vy]),before);
 e.host.clientWidth=1200;e.host.clientHeight=1000;e.resize();for(let i=0;i<before.length;i++){const b=e.sim.bodies[i];assert.ok(Math.abs(b.x-before[i][0]-100)<1e-10);assert.ok(Math.abs(b.y-before[i][1]-50)<1e-10);assert.equal(b.M,before[i][2]);}
 assert.equal(e.sim.c,c);assert.equal(e.hero.R1,R);assert.ok(e.canvas.width*e.canvas.height<=3003000);e.background.dispose();
});
test('drag follows original timed smoothing, restores EOB members and releases co-moving',async()=>{
 const e=await setup();e.sim.bodies=[];const a=e.sim.add(500,400,3,-2,2.4),b=e.sim.add(580,400,3,-2,1.6);e.background.setActive(true);
 e.host.emit('pointerdown',{clientX:525,clientY:450});assert.equal(a.kin,true);assert.equal(e.host.capture,7);
 e.host.emit('pointermove',{clientX:565,clientY:470});assert.equal(a.x,500);e.hero._step(.1,1/60);assert.ok(Math.abs(a.x-(500+40*22/60))<1e-10);
 e.host.emit('pointerup');assert.equal(a.kin,false);assert.equal(e.host.capture,null);assert.equal(a.vx,b.vx);assert.equal(a.vy,b.vy);
 a.x=500;a.y=400;a.vx=0;a.vy=30;b.x=560;b.y=400;b.vx=0;b.vy=-45;assert.ok(e.sim._startEOB(a,b));const member=e.sim._eobMembers(e.sim.bodies[0])[0];
 e.host.emit('pointerdown',{clientX:member.x+25,clientY:member.y+50});assert.equal(e.sim.bodies.some(q=>q.eob),false);assert.equal(e.sim.bodies.find(q=>q.id===a.id).kin,true);e.background.dispose();
});
test('pause, hidden state, offscreen state and disposal release holds and remove every listener',async()=>{
 const e=await setup();const a=e.sim.bodies[0];e.background.setActive(true);assert.equal(e.callbacks.size,1);e.host.emit('pointerdown',{clientX:a.x+25,clientY:a.y+50});
 e.background.setActive(false);assert.equal(a.kin,false);assert.equal(e.callbacks.size,0);assert.equal(e.host.capture,null);
 e.background.setActive(true);document.hidden=true;document.emit('visibilitychange');assert.equal(e.callbacks.size,0);document.hidden=false;document.emit('visibilitychange');assert.equal(e.callbacks.size,1);
 e.intersection(false);assert.equal(e.callbacks.size,0);e.intersection(true);assert.equal(e.callbacks.size,1);
 e.background.dispose();e.background.dispose();assert.equal(e.callbacks.size,0);assert.equal(e.host.listeners.size,0);assert.equal(e.canvas.listeners.size,0);assert.equal(document.listeners.size,0);assert.equal(e.windowEvents.listeners.size,0);assert.equal(e.media.listeners.size,0);assert.ok(e.observers[0].disconnected&&e.intersections[0].disconnected);
});
test('missing TIFF keeps static background and never substitutes a generated galaxy',async()=>{
 const e=await setup(1000,900,{fail:true});assert.deepEqual(e.requests,['/sky.webp']);assert.equal(e.background.stats.fallback,true);assert.equal(e.background.stats.ready,false);assert.equal(e.canvas.style.opacity,'0');assert.equal(e.sim.t,0);assert.equal(e.callbacks.size,0);e.background.dispose();
});

test('disposal before TIFF readiness detaches image handlers and cancels only the pending image request',async()=>{
 const e=await setup(1000,900,{deferImage:true});assert.equal(e.background.stats.ready,false);assert.equal(e.callbacks.size,0);
 e.background.dispose();assert.equal(e.images[0].onload,null);assert.equal(e.images[0].onerror,null);assert.equal(e.images[0].url,'');assert.equal(e.sim.t,0);
});
