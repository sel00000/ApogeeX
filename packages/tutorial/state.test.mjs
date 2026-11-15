import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFor, validSelection, nextStep, shouldAutoOpen, storageKey, readHandoff, pageForUrl, ownsHandoff, GUIDE_VERSION } from './state.js';

const modules = [
  { id:'sky', title:'하늘', steps:{beginner:[{id:'s1',practice:{page:'planetarium'}},{id:'s2'}],research:[{id:'r1',practice:{page:'analysis'}}]} },
  { id:'wave', title:'파장', steps:{beginner:[{id:'w1'}],research:[{id:'r2'},{id:'r3'}]} },
];

test('a selected topic never leaks steps from the other topic or track', () => {
  assert.deepEqual(courseFor(modules,'beginner','sky').map(s=>s.id),['s1','s2']);
  assert.deepEqual(courseFor(modules,'research','wave').map(s=>s.id),['r2','r3']);
  assert.deepEqual(courseFor(modules,'research','all').map(s=>s.id),['r1','r2','r3']);
  assert.equal(modules[0].steps.beginner[0].moduleId,undefined);
});
test('invalid replay selections safely fall back to the beginner complete course', () => {
  assert.deepEqual(validSelection(modules,'x','bad'),{track:'beginner',moduleId:'all'});
});
test('last next reaches completion and back stays within the selected course', () => {
  assert.deepEqual(nextStep(1,2),{index:1,complete:true});
  assert.deepEqual(nextStep(0,2,-1),{index:0,complete:false});
  assert.deepEqual(nextStep(1,2,-1),{index:0,complete:false});
});
test('every new top-level entry offers the guide while embedded documents do not', () => {
  assert.equal(shouldAutoOpen({embedded:false,seen:false}),true);
  assert.equal(shouldAutoOpen({embedded:true,seen:false}),false);
  assert.equal(shouldAutoOpen({embedded:false,seen:true}),true);
  assert.equal(shouldAutoOpen({embedded:false,seen:false,handoff:true}),false);
});
test('seen state is scoped to the deployment path and origin', () => {
  assert.notEqual(storageKey('http://localhost:4200/a/'),storageKey('http://localhost:4200/b/'));
  assert.notEqual(storageKey('http://localhost:4200/a/'),storageKey('http://localhost:4201/a/'));
});
const now=1700000000000;
const handoff = (changes={}) => JSON.stringify({version:GUIDE_VERSION,track:'beginner',moduleId:'sky',index:0,page:'planetarium',createdAt:now,...changes});
test('valid cross-page practice restores only the declared lesson position', () => {
  assert.deepEqual(readHandoff(handoff({selector:'body',url:'https://invalid/'}),modules,'planetarium',now),{track:'beginner',moduleId:'sky',index:0,page:'planetarium',mode:'practice'});
});
test('stale, wrong-page, malformed or out-of-bounds practice cannot hijack the guide', () => {
  assert.equal(readHandoff(handoff(),modules,'analysis',now),null);
  assert.equal(readHandoff(handoff({createdAt:now-1800001}),modules,'planetarium',now),null);
  assert.equal(readHandoff(handoff({createdAt:now+1}),modules,'planetarium',now),null);
  assert.equal(readHandoff(handoff({index:1}),modules,'planetarium',now),null);
  assert.equal(readHandoff(handoff({index:999}),modules,'planetarium',now),null);
  assert.equal(readHandoff(handoff({track:'malicious'}),modules,'planetarium',now),null);
  assert.equal(readHandoff('{',modules,'planetarium',now),null);
});

test('performing a real practice link can keep the same lesson on another known page', () => {
  assert.deepEqual(readHandoff(handoff({page:'analysis',mode:'continue'}),modules,'analysis',now),
    {track:'beginner',moduleId:'sky',index:0,page:'analysis',mode:'continue'});
  assert.equal(readHandoff(handoff({page:'analysis',mode:'practice'}),modules,'analysis',now),null);
  assert.equal(readHandoff(handoff({page:'analysis',mode:'continue',index:1}),modules,'analysis',now),null);
  assert.equal(readHandoff(handoff({mode:'script'}),modules,'planetarium',now),null);
});

test('continuation only recognizes the three exact pages under this deployment', () => {
  const base='https://example.test/project/';
  assert.equal(pageForUrl(base,'https://example.test/project/planetarium/?view=allsky'),'planetarium');
  assert.equal(pageForUrl(base,'https://example.test/project/analysis/#ra=1&dec=2'),'analysis');
  assert.equal(pageForUrl(base,'https://example.test/project/index.html'),'home');
  for(const url of ['https://elsewhere.test/project/analysis/','https://example.test/analysis/','https://example.test/project/analysis/other','javascript:alert(1)','https://user:pass@example.test/project/'])assert.equal(pageForUrl(base,url),null);
});

test('an inactive analysis child cannot clear the parent checkpoint during top-level navigation',()=>{
  const saved=handoff({page:'analysis',mode:'continue',owner:'parent-controller'});
  let storage=saved;
  const closeOwner=(owner)=>{if(ownsHandoff(storage,owner))storage=null;};
  closeOwner('closed-child-controller');
  assert.equal(storage,saved);
  assert.deepEqual(readHandoff(storage,modules,'analysis',now),{track:'beginner',moduleId:'sky',index:0,page:'analysis',mode:'continue'});
  closeOwner('parent-controller');assert.equal(storage,null);
  assert.equal(ownsHandoff('{','parent-controller'),false);
  assert.equal(ownsHandoff('{}',''),false);
});

test('active lesson survives a fresh-document Back or reload on a known app page',()=>{
  const saved=handoff({page:'*',mode:'lesson',index:1,owner:'analysis-controller'});
  for(const page of ['home','planetarium','analysis'])assert.deepEqual(readHandoff(saved,modules,page,now),
    {track:'beginner',moduleId:'sky',index:1,page,mode:'lesson'});
  assert.equal(readHandoff(saved,modules,'external',now),null);
  assert.equal(readHandoff(handoff({page:'*',mode:'practice'}),modules,'analysis',now),null);
  assert.equal(readHandoff(handoff({page:'*',mode:'lesson',index:999}),modules,'analysis',now),null);
});

test('closing an owned lesson checkpoint prevents later fresh-page restoration',()=>{
  let saved=handoff({page:'*',mode:'lesson',index:1,owner:'current-controller'});
  if(ownsHandoff(saved,'current-controller'))saved=null;
  assert.equal(readHandoff(saved,modules,'planetarium',now),null);
});
