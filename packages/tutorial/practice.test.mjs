
import test from 'node:test';
import assert from 'node:assert/strict';
import {rendered,inViewport,practiceStatus,monitorPractice} from './practice.js';
function element(attributes={},parent=null){return {isConnected:true,hidden:false,inert:false,disabled:false,parentElement:parent,dataset:{},style:{display:'block',visibility:'visible',opacity:'1'},getAttribute:key=>attributes[key]??null,getBoundingClientRect:()=>({left:10,top:10,right:110,bottom:50,width:100,height:40})};}
function doc(entries={}){return {querySelector:selector=>entries[selector]??null,defaultView:{innerWidth:390,innerHeight:844,getComputedStyle:el=>el.style}};}
test('hidden/inert/disconnected tools are not advertised as ready',()=>{
 const parent=element(),target=element({},parent),d=doc();
 assert.equal(rendered(target,d),true);
 parent.inert=true;assert.equal(rendered(target,d),false);parent.inert=false;
 parent.style.visibility='hidden';assert.equal(rendered(target,d),false);parent.style.visibility='visible';
 target.isConnected=false;assert.equal(rendered(target,d),false);target.isConnected=true;
 target.getBoundingClientRect=()=>({left:10,top:900,right:110,bottom:940,width:100,height:40});
 assert.equal(rendered(target,d),true);assert.equal(inViewport(target,d.defaultView),false);
});
test('research prerequisites distinguish mode, unsupported patch, metadata loading and ready target',()=>{
 const viewer=element();viewer.dataset={analysisKind:'patch',analysisReady:'true'};
 const entries={'[data-analysis-kind]':viewer,'[data-testid="mode-research"]':element({'aria-pressed':'false'})};
 const p={selector:'[data-testid="atab-spectrum"]',requires:['research','prepared','field'],tab:'spectrum'};
 assert.equal(practiceStatus(doc(entries),p,'analysis').action.selector,'[data-testid="mode-research"]');
 entries['[data-testid="mode-research"]']=element({'aria-pressed':'true'});
 assert.equal(practiceStatus(doc(entries),p,'analysis').state,'unsupported');
 viewer.dataset={analysisKind:'target',analysisReady:'false'};
 assert.equal(practiceStatus(doc(entries),p,'analysis').state,'loading');
 viewer.dataset.analysisReady='true';
 const tab=element({'aria-selected':'false'});entries[p.selector]=tab;
 assert.equal(practiceStatus(doc(entries),p,'analysis').action.selector,p.selector);
 entries[p.selector]=element({'aria-selected':'true'});
 assert.equal(practiceStatus(doc(entries),p,'analysis').state,'ready');
});
test('absent frame and disabled controls remain recoverable while guide can continue',()=>{
 assert.equal(practiceStatus(null,{selector:'#x'},'analysis').state,'loading');
 const control=element();control.disabled=true;
 assert.equal(practiceStatus(doc({'#x':control}),{selector:'#x'},'asteroids').state,'waiting');
 control.disabled=false;
 assert.equal(practiceStatus(doc({'#x':control}),{selector:'#x'},'asteroids').target,control);
});
test('a retained sky stage offers the real workbench control rather than waiting forever',()=>{
  const d=doc({'[data-testid="stage-sky"]':element({'aria-pressed':'true'}),'[data-testid="mode-explore"]':element()});
  assert.equal(practiceStatus(d,{selector:'[data-tutorial="analysis-timeline"]',requires:['field']},'analysis').action.selector,'[data-testid="mode-explore"]');
});
test('planetarium requires an open panel and accepts analysis continuation',()=>{
 assert.equal(practiceStatus(doc({'#toggle-panel':element({'aria-expanded':'false'})}),{selector:'#time-now',requires:['panel']},'planetarium').action.selector,'#toggle-panel');
 assert.equal(practiceStatus(doc({'#analysis-dialog':{open:true}}),{selector:'#analysis-pick'},'planetarium').state,'analysis-open');
});
test('late controls never cause repeated scroll/focus and monitoring stops on exit',()=>{
 let tick,cleared=false,current={target:null,state:'loading',message:'loading'};
 const seen=[],timers={setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{cleared=true;}};
 const m=monitorPractice(()=>current,(s,{first})=>seen.push({target:s.target,first}),timers);
 for(let i=0;i<40;i++)tick();assert.equal(seen.length,1);
 const target=element();current={target,state:'ready',message:'ready'};tick();
 assert.deepEqual(seen.at(-1),{target,first:false});
 current={target:element(),state:'ready',message:'ready'};tick();assert.equal(seen.length,3);
 m.stop();tick();assert.equal(seen.length,3);assert.equal(cleared,true);
});
