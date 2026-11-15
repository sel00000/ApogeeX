const test=require('node:test'),assert=require('node:assert/strict');
global.BBH=require('../bbh-physics.js');
const Sim=require('../bbh-sim.js'),Hero=require('../gravity-hero.js');
test('placing a dragged hole nearby gives a bound approach in 32 directions; merger never splits',()=>{
  for(let i=0;i<32;i++) {
    const s=new Sim({c:450,eob:true}),phi=i*Math.PI/16;
    const a=s.add(500,400,3,-2,2.4),b=s.add(500+65*Math.cos(phi),400+65*Math.sin(phi),160,-140,1.6);
    b.kin=true;s.releasePlaced(b);
    assert.equal(b.vx,a.vx);assert.equal(b.vy,a.vy);
    for(let k=0;k<10000&&!s.events.length;k++)s.step(1/120);
    assert.equal(s.events.length,1,`direction ${i}`);
    const event=s.events[0];
    for(let k=0;k<600;k++)s.step(1/120);
    assert.equal(s.bodies.length,1);assert.equal(s.bodies[0],event.remnant);
  }
});
test('merger with outgoing contact velocity has a monotonically shrinking optical separation',()=>{
  const s=new Sim({c:450}),a=s.add(490,400,-30,0,2),b=s.add(500,400,30,0,2);
  const R=s._merge(a,b);let prev=Infinity;
  for(let i=0;i<300;i++) {
    const q=s.components(),d=q.length===2?Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y):0;
    assert.ok(d<=prev+1e-10);prev=d;s.step(1/240);
  }
});
test('sample zero is at t=0 and every later sample is exactly DT_S apart',()=>{
  const s=new Sim({c:450}),times=[],sample=s._sample.bind(s);
  s.add(500,400,0,0,2);s.add(580,400,0,0,2);
  s._sample=()=>{times.push(s.t);sample();};
  for(let k=0;k<60;k++)s.step(1/144);
  assert.equal(times[0],0);
  times.forEach((t,i)=>assert.ok(Math.abs(t-i*s.DT_S)<1e-10));
});
test('cold overlapping merger gets a ringdown slot immediately',()=>{
  const s=new Sim({c:450});s.add(500,400,0,0,2);s.add(500,400,0,0,2);s.step(1/240);
  const ring=s.slots.find(q=>q.kind==='ring');assert.ok(ring);assert.ok(ring.head>=0);
  assert.ok(ring.buf.some(x=>Math.abs(x)>0));
});
function scene() {
  const h=Object.create(Hero.prototype);
  Object.assign(h,{sim:new Sim({c:450,eob:true}),w:1280,h:800,SQ27:3*Math.sqrt(3),kRad:140/1280*Math.PI/180,EXIT_MERGERS:4,RESPAWN:4,spawnAt:[]});
  return h;
}
test('four-merger remnant retires beside another hole after its morph; no physical kick',()=>{
  const h=scene(),a=h.sim.add(700,400,12,-3,18);h.sim.add(760,420,0,0,2);
  a.mergerCount=4;a.morph={rhoF:a.rho};
  h._retireMerged(1/60,0);assert.equal(a.retiring,undefined);a.morph=null;
  const wave=h.sim.slots[0];wave.key='R';wave.kind='ring';wave.ring={body:a};wave.head=-1;
  h.sim._push(wave,1,0);for(let i=0;i<63;i++)h.sim._push(wave,0,0);
  h._retireMerged(1/60,0);assert.ok(a.retiring);
  const vx=a.vx,vy=a.vy;let prev=0;
  for(let k=0;k<360;k++){h._retireMerged(1/60,k/60);const r=Math.hypot(a.retiring.dx,a.retiring.dy);assert.ok(r>=prev);prev=r;}
  assert.equal(a.vx,vx);assert.equal(a.vy,vy);assert.ok(!h.sim.bodies.includes(a));assert.equal(h.spawnAt.length,1);
  for(let i=0;i<128;i++)h.sim._push(wave,0,0);assert.equal(wave.peak,0);
});
test('retiring objects cannot grow by new captures and their force fades without repulsion',()=>{
  const s=new Sim({c:450}),a=s.add(500,400,0,0,2),b=s.add(505,400,0,0,2);
  a.retiring={dx:0,dy:0,opacity:1};a.coupling=0;
  const out=new Float64Array(4);s._accel([a.x,a.y,b.x,b.y],[0,0,0,0],out);assert.deepEqual([...out],[0,0,0,0]);
  s.step(1/60);assert.equal(s.events.length,0);assert.equal(a.M,2);
});
test('placed pairs feel an inward radial force at all angles in the capture zone',()=>{
  for(const rM of [8,12,20,32])for(let i=0;i<16;i++) {
    const s=new Sim({c:450}),phi=i*Math.PI/8,x=4*rM*Math.cos(phi),y=4*rM*Math.sin(phi);
    s.add(0,0,0,0,2.8);s.add(x,y,0,0,1.2);
    const a=new Float64Array(4);s._accel([0,0,x,y],[0,0,0,0],a);
    assert.ok((a[2]-a[0])*x+(a[3]-a[1])*y<0);
  }
});
test('EOB ringdown phase starts at the actual merger event, without a double-counted substep',()=>{
  const s=new Sim({c:450,eob:true});s.add(500,400,0,30,2.4);s.add(560,400,0,-45,1.6);
  while(!s.events.length)s.step(1/144);
  const e=s.events[0];assert.equal(e.model,'EOB');assert.ok(e.remnant.morph);
  assert.ok(Math.abs(e.remnant.morph.t-(s.t-e.t))<1e-12);
});
test('new wave sources reuse a quiet drained slot instead of waiting for the history window',()=>{
  const s=new Sim({c:450,slots:2,hist:4096});
  for(const q of s.slots){q.key='old'+q.i;q.kind='drain';q.peak=.0001;q.head=10;}
  s.add(500,400,0,0,2);s.add(570,400,0,0,2);s.step(1/240);
  const q=s.slots.find(q=>q.kind==='pair');assert.ok(q);assert.ok(q.buf.some(x=>x!==0));
});
test('a newly arriving object is allowed to enter before the retirement policy applies',()=>{
  const h=scene(),b=h.sim.add(640,-50,0,20,18);b.mergerCount=4;b.entering=true;
  h._retireMerged(1/60,0);assert.equal(b.retiring,undefined);
  b.entering=false;b.y=100;h._retireMerged(1/60,1);assert.ok(b.retiring);
});
test('a travelling wave packet remains visible after its source has stopped, until overwritten',()=>{
  const s=new Sim({c:450,hist:4096}),q=s.slots[0];q.head=-1;s._push(q,1,0);
  for(let i=0;i<1000;i++)s._push(q,0,0);
  assert.equal(q.peak,1);assert.ok(q.currentPeak<.01);
  for(let i=0;i<4160;i++)s._push(q,0,0);
  assert.equal(q.peak,0);
});

test('size alone never retires a hole; exactly the fourth completed merger enables exit',()=>{
  const h=scene();let remnant=h.sim.add(700,400,0,0,40);
  h._retireMerged(1/60,0);assert.equal(remnant.retiring,undefined);
  for(let n=1;n<=4;n++){
    const incoming=h.sim.add(remnant.x+1,remnant.y,0,0,1);
    remnant=h.sim._merge(remnant,incoming);
    assert.equal(remnant.mergerCount,n);
    // The full visible merger finishes before exit begins.
    h._retireMerged(1/60,n);assert.equal(remnant.retiring,undefined);
    remnant.rho=remnant.morph.rhoF;remnant.morph=null;
    h._retireMerged(1/60,n);
    assert.equal(!!remnant.retiring,n===4);
  }
});
test('EOB handoff and escape preserve merger ancestry without incrementing it',()=>{
  const s=new Sim({c:450,eob:true}),a=s.add(500,400,0,30,2.4),b=s.add(560,400,0,-45,1.6);
  a.mergerCount=3;b.mergerCount=1;
  assert.ok(s._startEOB(a,b));const pair=s.bodies[0];
  assert.deepEqual(s._eobMembers(pair).map(q=>q.mergerCount),[3,1]);
  s._finishEOB(pair,true);
  assert.deepEqual(s.bodies.map(q=>q.mergerCount),[3,1]);
  assert.ok(s._startEOB(...s.bodies));s._finishEOB(s.bodies[0]);
  assert.equal(s.events.length,1);assert.equal(s.bodies[0].mergerCount,4);
});
test('respawn introduces optics continuously without resetting the existing simulation',()=>{
  const h=scene();Object.assign(h,{R1:11,ARRIVAL_SECONDS:2});
  const old=h.sim.add(600,400,2,-1,3);old.mergerCount=3;
  h.sim.t=8;h.sim.nextSample=8+h.sim.DT_S;
  const slot=h.sim.slots[0];slot.key='preserved';slot.head=12;slot.buf[0]=.25;
  const sim=h.sim,t=sim.t,newHole=h._spawn();
  assert.equal(h.sim,sim);assert.equal(sim.t,t);assert.equal(old.mergerCount,3);
  assert.equal(slot.key,'preserved');assert.equal(slot.head,12);assert.equal(slot.buf[0],.25);
  assert.equal(sim.components().find(q=>q.id===newHole.id).opacity,0);
  const state=[newHole.x,newHole.y,newHole.vx,newHole.vy,newHole.M];let last=0;
  for(let i=0;i<120;i++){
    h._advanceArrivals(1/60);const q=sim.components().find(q=>q.id===newHole.id);
    assert.ok(q.opacity>=last&&q.opacity<=1);last=q.opacity;
    assert.deepEqual([newHole.x,newHole.y,newHole.vx,newHole.vy,newHole.M],state);
  }
  assert.equal(last,1);assert.equal(newHole.arrival,undefined);
  assert.equal(sim.components().find(q=>q.id===old.id).opacity,1);
  h._retireMerged(1/60,10);assert.equal(old.retiring,undefined);
});
test('new shadow starts outside the view with time for the lens transition before entry',()=>{
  const random=Math.random;try{for(const side of [0,1,2,3]){
    const h=scene();Object.assign(h,{R1:11,ARRIVAL_SECONDS:2});h._rand=(a,b)=>(a+b)/2;Math.random=()=>(side+.1)/4;
    const b=h._spawn(),rho=2*b.rho,edge=side===0?-b.x:side===1?b.x-h.w:side===2?-b.y:b.y-h.h;
    assert.ok(edge-rho>Math.hypot(b.vx,b.vy)*h.ARRIVAL_SECONDS);
  }}finally{Math.random=random;}
});
