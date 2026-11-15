import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPage,featureDocument,navigatePractice} from './adapter.js';
import {pageForUrl} from './state.js';

test('shell route URLs preserve the deployment base and reject other origins',()=>{
  const base='https://example.org/S/';
  assert.equal(pageForUrl(base,base+'#analysis?target=eps_indi_b'),'analysis');
  assert.equal(pageForUrl(base,base+'#asteroids?target=433'),'asteroids');
  // The Space Journey route left the site's menus; the tutorial no longer recognises or navigates to it.
  assert.equal(pageForUrl(base,base+'#experience'),null);
  assert.equal(pageForUrl(base,'https://other.example/S/#analysis'),null);
  assert.equal(pageForUrl(base,'https://example.org/other/#analysis'),null);
});
test('practice navigates through the shell and waits for readiness without replacing document',async()=>{
  const calls=[];
  const win={location:{origin:'https://example.org',hash:'#home'},__spherexApp:{view:'home',async navigate(view,params){calls.push([view,params]);this.view=view;},async whenReady(){calls.push('ready');}}};
  assert.equal(await navigatePractice(win,{page:'analysis',params:{target:'eps_indi_b',mode:'research',tab:'spectrum'}}),true);
  assert.deepEqual(calls,[['analysis',{target:'eps_indi_b',mode:'research',tab:'spectrum'}],'ready']);
  assert.equal(currentPage(win),'analysis');
});
test('closing during a pending route cancels the practice continuation',async()=>{
  let resolve;const controller=new AbortController();
  const app={view:'home',navigate(){return new Promise(r=>{resolve=r;});},whenReady(){throw Error('must not start after close');}};
  const pending=navigatePractice({__spherexApp:app},'analysis',controller.signal);
  controller.abort();resolve();
  assert.equal(await pending,false);
});
test('feature adapter never reads cross-origin feature internals',()=>{
  const shell={name:'shell'};
  const win={location:{origin:'https://portal.example'},__spherexApp:{getFeatureDocument(){throw Error('cross origin');}}};
  assert.equal(featureDocument(win,shell,'home'),shell);
  assert.equal(featureDocument(win,shell,'analysis'),null);
  const child={defaultView:{location:{origin:'https://portal.example'}}};
  win.__spherexApp.getFeatureDocument=()=>child;
  assert.equal(featureDocument(win,shell,'analysis'),child);
  child.defaultView.location.origin='https://other.example';
  assert.equal(featureDocument(win,shell,'analysis'),null);
});
