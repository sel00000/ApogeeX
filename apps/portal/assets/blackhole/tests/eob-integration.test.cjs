const test=require('node:test');
const assert=require('node:assert/strict');
const Sim=require('../bbh-sim.js');

function pair() {
  const sim=new Sim({c:450,eob:true});
  sim.add(500,350,0,30,2.4);sim.add(560,350,0,-45,1.6);
  return sim;
}
test('PN→EOB preserves unequal masses, arbitrary orientation, positions, velocities and GW history',()=>{
  const sim=new Sim({c:450,eob:true});
  const a=sim.add(510,360,10,-20,2.4),b=sim.add(491,337,-15,30,1.6);
  sim._sample();
  const slot=sim.slots.find(q=>q.kind==='pair'),head=slot.head,buf=slot.buf.slice();
  assert.ok(sim._startEOB(a,b));
  const parts=sim.components();
  for(const original of [a,b]) {
    const q=parts.find(p=>p.id===original.id);
    for(const key of ['M','x','y','vx','vy'])assert.ok(Math.abs(q[key]-original[key])<1e-9,`${key}: ${q[key]} vs ${original[key]}`);
  }
  assert.equal(slot.head,head);assert.deepEqual(slot.buf,buf);assert.equal(slot.kind,'eob');
});
test('production EOB path reaches ringdown with finite waves and continuous components',()=>{
  const sim=pair();let eob=false,ring=false,prev=sim.components(),jump=0;
  for(let i=0;i<6000;i++) {
    sim.step(1/240);eob ||=sim.bodies.some(b=>b.eob);ring ||=sim.slots.some(s=>s.kind==='ring');
    const cur=sim.components();
    for(const q of cur)jump=Math.max(jump,Math.min(...prev.map(p=>Math.hypot(p.x-q.x,p.y-q.y))));
    assert.ok(cur.every(q=>Number.isFinite(q.M+q.x+q.y+q.rho)));
    for(const s of sim.slots)assert.ok(s.buf.every(Number.isFinite));
    prev=cur;
    if(sim.events.length&&!sim.bodies.some(b=>b.morph))break;
  }
  assert.ok(eob&&ring);assert.equal(sim.events.length,1);assert.equal(sim.events[0].model,'EOB');
  assert.ok(jump<3,`max jump ${jump}`);assert.ok(sim.events[0].af>.6);
});
test('EOB result is independent of render frame rate',()=>{
  const run=dt=>{const s=pair();while(s.t<1.5-1e-10)s.step(Math.min(dt,1.5-s.t));return s.components();};
  const a=run(1/30),b=run(1/144);
  for(let i=0;i<a.length;i++)assert.ok(Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y)<.1);
});
test('exactly coincident dragged holes merge without NaN',()=>{
  const sim=new Sim({c:450,eob:true});
  sim.add(500,350,0,0,2);sim.add(500,350,0,0,2);
  sim.step(1/240);
  assert.equal(sim.events.length,1);
  assert.ok(sim.components().every(q=>Number.isFinite(q.M+q.x+q.y+q.rho)));
  for(const slot of sim.slots)assert.ok(slot.buf.every(Number.isFinite));
});
test('nonlinear lens transition reaches one total-mass Schwarzschild lens before component retirement',()=>{
  const sim=pair();while(!sim.events.length)sim.step(1/240);
  const rem=sim.events[0].remnant,m=rem.morph;
  m.t=6*m.tauS;
  const parts=sim.components(), mass=parts.reduce((sum,q)=>sum+q.M,0);
  assert.ok(parts.every(q=>q.group.blend>.999));
  assert.ok(parts.every(q=>Math.abs(q.group.M-mass)<1e-12));
  assert.ok(Math.abs(parts.reduce((sum,q)=>sum+q.M/q.group.M,0)-1)<1e-12);
});
test('viewport camera translation preserves EOB separation, velocities, masses and wave positions',()=>{
  const sim=pair();while(!sim.bodies.some(b=>b.eob))sim.step(1/240);
  const before=sim.components(),times=sim.t,orb=sim.bodies[0].eob.orbit.state.slice();
  const source=sim.slots.find(s=>s.kind==='eob'),sourceX=source.x,sourceY=source.y;
  sim.translate(-600,50);
  const after=sim.components();
  for(let i=0;i<before.length;i++) {
    assert.ok(Math.abs(after[i].x-before[i].x+600)<1e-10);
    assert.ok(Math.abs(after[i].y-before[i].y-50)<1e-10);
    for(const k of ['vx','vy','M','rho'])assert.equal(after[i][k],before[i][k]);
  }
  assert.equal(sim.t,times);assert.deepEqual(sim.bodies[0].eob.orbit.state,orb);
  assert.equal(source.x,sourceX-600);assert.equal(source.y,sourceY+50);
});
