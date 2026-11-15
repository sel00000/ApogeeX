import test from 'node:test';
import assert from 'node:assert/strict';
import { publishVisibility, createScrollLock } from './lifecycle.js';
import { installTutorialHost } from './host.js';

test('pre-existing app listeners see current modal state before the dynamically installed host runs',()=>{
  const win=new EventTarget();
  const doc=new EventTarget();doc.documentElement={dataset:{}};doc.hidden=false;
  const observed=[];
  win.addEventListener('sky-tutorial-visibility',event=>{
    observed.push({value:doc.documentElement.dataset.skyTutorialActive,open:event.detail.open,phase:event.detail.phase});
  });
  const dispose=installTutorialHost(win,doc,'analysis');
  publishVisibility(win,doc,true,'lesson');
  publishVisibility(win,doc,false,'practice');
  publishVisibility(win,doc,true,'chooser');
  publishVisibility(win,doc,false,'closed');
  assert.deepEqual(observed,[
    {value:'true',open:true,phase:'lesson'}, {value:'false',open:false,phase:'practice'},
    {value:'true',open:true,phase:'chooser'}, {value:'false',open:false,phase:'closed'},
  ]);
  dispose();
});

function style(value='',priority='') {
  const values=new Map(value?[['overflow',{value,priority}]]:[]);
  return {getPropertyValue:key=>values.get(key)?.value??'',getPropertyPriority:key=>values.get(key)?.priority??'',
    setProperty:(key,value,priority='')=>values.set(key,{value,priority}),removeProperty:key=>values.delete(key)};
}
test('modal scroll lock restores original inline styles and page position after close or practice',()=>{
  const html={style:style('auto','important')};const body={style:style()};
  const calls=[];const win={scrollX:12,scrollY:420,scrollTo(value){calls.push(value);this.scrollX=value.left;this.scrollY=value.top;}};
  const setLocked=createScrollLock(win,{documentElement:html,body});
  setLocked(true);setLocked(true);
  assert.equal(html.style.getPropertyValue('overflow'),'hidden');
  assert.equal(body.style.getPropertyValue('overflow'),'hidden');
  win.scrollY=0;
  setLocked(false);setLocked(false);
  assert.equal(html.style.getPropertyValue('overflow'),'auto');
  assert.equal(html.style.getPropertyPriority('overflow'),'important');
  assert.equal(body.style.getPropertyValue('overflow'),'');
  assert.deepEqual(calls,[{left:12,top:420,behavior:'instant'}]);
});
test('reopening a guide saves the new page position without retaining an earlier visit',()=>{
  const doc={documentElement:{style:style()},body:{style:style('clip')}};
  const win={scrollX:0,scrollY:50,scrollTo(value){this.scrollX=value.left;this.scrollY=value.top;}};
  const lock=createScrollLock(win,doc);
  lock(true);lock(false);win.scrollY=900;lock(true);win.scrollY=10;lock(false);
  assert.equal(win.scrollY,900);
  assert.equal(doc.body.style.getPropertyValue('overflow'),'clip');
});
