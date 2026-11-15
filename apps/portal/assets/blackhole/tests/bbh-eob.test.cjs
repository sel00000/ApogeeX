const test=require('node:test');
const assert=require('node:assert/strict');
const EOB=require('../bbh-eob.js');

test('EOB test-mass limit: Schwarzschild circular Ω=r^(-3/2), conserved H and j',()=>{
  const r=9, j=EOB.circularJ(r,0), eob=new EOB([r,0,0,j],0,{radiation:0});
  assert.ok(Math.abs(j-r/Math.sqrt(r-3))<1e-12);
  const rhs=EOB.rhs(eob.state,0,0);
  assert.ok(Math.abs(rhs[1]-r**(-1.5))<1e-12);
  assert.ok(Math.abs(rhs[2])<1e-12);
  const initial=EOB.energy(eob.state,0).effective;
  for(let k=0;k<10000;k++)eob.step(.02);
  assert.ok(Math.abs(eob.state[0]-r)<1e-8);
  assert.ok(Math.abs(EOB.energy(eob.state,0).effective-initial)<1e-10);
  assert.equal(eob.state[3],j);
});
test('EOB equal-mass LSO matches Buonanno–Damour 2000 eq. (2.18)',()=>{
  const r=5.718, j=EOB.circularJ(r,.25), s=[r,0,0,j];
  assert.ok(Math.abs(j-3.404)<.001);
  assert.ok(Math.abs(EOB.rhs(s,.25,0)[1]-.07340)<.00002);
  assert.ok(Math.abs((EOB.energy(s,.25).total-1)-(-.01501))<.00002);
  const eps=.001, dJ=(EOB.circularJ(r+eps,.25)-EOB.circularJ(r-eps,.25))/(2*eps);
  assert.ok(Math.abs(dJ)<.0001);
});
test('EOB conservative eccentric orbit preserves Hamiltonian',()=>{
  const eob=new EOB([10,0,-.015,EOB.circularJ(10,.2)*.98],.2,{radiation:0});
  const initial=EOB.energy(eob.state,.2).binding;
  for(let k=0;k<20000;k++)eob.step(.01);
  assert.ok(Math.abs(EOB.energy(eob.state,.2).binding-initial)<1e-9);
});
test('EOB velocity matching preserves r, φ, radial and angular speed',()=>{
  for(const eta of [0,.05,.25])for(const phi of [0,1.7,-2.4]) {
    const eob=EOB.fromVelocity(8,phi,-.02,.035,eta);
    assert.ok(eob);
    const rhs=EOB.rhs(eob.state,eta,1);
    assert.ok(Math.abs(rhs[0]+.02)<1e-11);
    assert.ok(Math.abs(rhs[1]-.035)<1e-11);
    assert.equal(eob.state[0],8);assert.equal(eob.state[1],phi);
  }
  assert.equal(EOB.fromVelocity(8,0,2,0,.25),null);
});
test('EOB radiation torque obeys dH/dτ=Ω dj/dτ, and drives a finite plunge',()=>{
  const eta=.25,eob=new EOB([8,0,-.005,EOB.circularJ(8,eta)],eta);
  const f=EOB.rhs(eob.state,eta,1), eps=1e-4;
  const next=eob.state.map((v,i)=>v+eps*f[i]), prev=eob.state.map((v,i)=>v-eps*f[i]);
  const dE=(EOB.energy(next,eta).binding-EOB.energy(prev,eta).binding)/(2*eps);
  assert.ok(Math.abs(dE-f[1]*f[3])<1e-9);
  let t=0;
  while(eob.state[0]>3&&t<2000) {eob.step(.04);t+=.04;}
  assert.ok(eob.state[0]<=3,`plunge at ${t}M`);
  assert.ok([...eob.state].every(Number.isFinite));
});
