import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {sanitizeViewState,portalShareUrl} from '../src/view-state.js';
const source=await readFile(new URL('../src/integration.js',import.meta.url),'utf8');
function setup(){
 const sent=[],listeners=new Map();let pauseChanges=0;
 const parent={postMessage:(data,origin)=>sent.push({data:structuredClone(data),origin})};
 const window={parent,addEventListener:(type,fn)=>listeners.set(type,fn)};
 const restored=[];
 const context={window,location:{origin:'https://example.test',search:'?embed=1',href:'https://example.test/project/planetarium/?embed=1'},URLSearchParams,sanitizeViewState,portalShareUrl,document:{documentElement:{classList:{add(){}}},querySelector:()=>null}};
 vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')+'\nwindow.api={openParentAnalysis,registerIntegration,integrationPaused,shareView};',context);
 window.api.registerIntegration({getState:()=>({ready:true,selected:'Sirius'}),onPauseChanged:()=>pauseChanges++,restoreState:async query=>restored.push(query)});
 return {window,parent,sent,listeners,restored,get pauseChanges(){return pauseChanges;}};
}
test('embedded original selection hands off ICRF degrees, labels and observation epoch intact',()=>{
 const e=setup();const target={ra:101.287,dec:-16.716,label:'시리우스',moving:true,observationMjd:61234.5};
 assert.equal(e.window.api.openParentAnalysis(target),true);
 assert.deepEqual(e.sent.at(-1),{data:{type:'spherex-planetarium-analyze',target},origin:'https://example.test'});
 const before=e.sent.length;assert.equal(e.window.api.openParentAnalysis({ra:12,dec:91}),false);assert.equal(e.sent.length,before);
});

test('state restore is validated and state/share replies stay inside the portal contract',async()=>{
 const e=setup(),receive=e.listeners.get('message');
 receive({source:e.parent,origin:'https://other.test',data:{type:'spherex-planetarium-restore',state:{ra:0,dec:0}}});
 assert.equal(e.restored.length,0);
 receive({source:e.parent,origin:'https://example.test',data:{type:'spherex-planetarium-restore',requestId:'r1',state:{ra:'359',dec:'-45',speed:'-10',src:'https://evil.test'}}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(e.restored,['speed=-10&ra=359&dec=-45']);
 assert.equal(e.sent.at(-1).data.type,'spherex-planetarium-restored');
 assert.equal(e.sent.at(-1).data.requestId,'r1');
 e.window.api.shareView({frame:'equatorial',layers:'',time:'2026-11-15T00:00:00Z'});
 const shared=e.sent.at(-1).data;
 assert.equal(shared.type,'spherex-planetarium-share');
 assert.ok(shared.url.startsWith('https://example.test/project/#planetarium?'));
});
test('only same-origin parent can pause retained engine and diagnostics preserve selection',()=>{
 const e=setup(),receive=e.listeners.get('message'),event={source:e.parent,origin:'https://example.test',data:{type:'spherex-planetarium-visibility',paused:true}};
 receive({...event,origin:'https://other.test'});assert.equal(e.window.api.integrationPaused(),false);
 receive({...event,source:{}});assert.equal(e.window.api.integrationPaused(),false);
 receive(event);assert.equal(e.window.api.integrationPaused(),true);assert.equal(e.pauseChanges,2);
 assert.equal(e.window.__stellariumIntegration.getState().selected,'Sirius');
 e.window.__stellariumIntegration.setPaused(false);assert.equal(e.window.api.integrationPaused(),false);
});
