import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlassDisplacementMap,mountGlassCards} from '../glass.js';
const at=(map,x,y)=>Array.from(map.pixels.slice((y*map.width+x)*4,(y*map.width+x)*4+4));
test('glass map keeps interior neutral and bends opposite edges inward',()=>{
 const map=createGlassDisplacementMap();
 assert.equal(map.pixels.length,256*128*4);
 assert.deepEqual(at(map,128,64),[128,128,128,255]);
 const left=at(map,0,64),right=at(map,255,64),top=at(map,128,0),bottom=at(map,128,127);
 assert.ok(left[0]>128&&right[0]<128);assert.equal(left[1],128);assert.equal(right[1],128);
 assert.ok(top[1]>128&&bottom[1]<128);assert.equal(top[0],128);assert.equal(bottom[0],128);
 assert.equal(left[0]+right[0],256);assert.equal(top[1]+bottom[1],256);
 // Distant stars behind the readable center stay undisplaced; no turbulence noise.
 for(let y=25;y<103;y++)for(let x=25;x<231;x++)assert.deepEqual(at(map,x,y),[128,128,128,255]);
});
test('glass map validates allocations and keeps all opaque channel values bounded',()=>{
 assert.throws(()=>createGlassDisplacementMap({width:99999}),RangeError);
 assert.throws(()=>createGlassDisplacementMap({depth:0}),RangeError);
 const map=createGlassDisplacementMap();
 for(let i=0;i<map.pixels.length;i+=4){assert.ok(map.pixels[i]>=1&&map.pixels[i]<=255);assert.ok(map.pixels[i+1]>=1&&map.pixels[i+1]<=255);assert.equal(map.pixels[i+2],128);assert.equal(map.pixels[i+3],255);}
});
function fallbackSurface(){
 const frames=new Map();let next=0;
 const motion={matches:false,listeners:new Map(),addEventListener(k,f){this.listeners.set(k,f);},removeEventListener(k){this.listeners.delete(k);}};
 const win={navigator:{userAgent:'Safari/18'},CSS:{supports:()=>true},matchMedia:()=>motion,requestAnimationFrame:f=>{frames.set(++next,f);return next;},cancelAnimationFrame:i=>frames.delete(i)};
 const props=new Map([['--glass-x',['12%','important']]]),attrs=new Map(),listeners=new Map();
 const card={ownerDocument:{defaultView:win},style:{getPropertyValue:k=>props.get(k)?.[0]||'',getPropertyPriority:k=>props.get(k)?.[1]||'',setProperty:(k,v,p='')=>props.set(k,[v,p]),removeProperty:k=>props.delete(k)},getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),getBoundingClientRect:()=>({left:10,top:20,width:440,height:214})};
 return {card,motion,props,attrs,listeners,frames};
}
test('fallback highlight is event-driven and disposer restores previous styles',()=>{
 const e=fallbackSurface(),dispose=mountGlassCards([e.card]);
 assert.equal(e.attrs.get('data-glass-refraction'),'off');assert.equal(e.frames.size,0);
 e.listeners.get('pointermove')({clientX:230,clientY:127,pointerType:'mouse'});assert.equal(e.frames.size,1);
 const [id,fn]=[...e.frames][0];e.frames.delete(id);fn();assert.equal(e.frames.size,0);assert.equal(e.props.get('--glass-x')[0],'50%');
 e.listeners.get('pointermove')({clientX:240,clientY:140,pointerType:'mouse'});assert.equal(e.frames.size,1);
 e.motion.matches=true;e.motion.listeners.get('change')();assert.equal(e.frames.size,0);assert.deepEqual(e.props.get('--glass-x'),['12%','important']);
 e.listeners.get('pointermove')({clientX:100,clientY:100,pointerType:'mouse'});assert.equal(e.frames.size,0);
 dispose();dispose();assert.equal(e.listeners.size,0);assert.equal(e.motion.listeners.size,0);assert.equal(e.attrs.size,0);assert.deepEqual(e.props.get('--glass-x'),['12%','important']);assert.equal(e.props.has('--glass-y'),false);
});
