import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeHash,analysisParams,childURL,trustedFrameMessage} from '../routing.js';

test('legacy moving links open the retained observations and unknown routes stay in shell',()=>{
 const legacy=parseRoute('#moving?target=433');
 assert.equal(legacy.view,'asteroids');assert.equal(legacy.params.get('tab'),'observations');assert.equal(legacy.params.get('target'),'433');
 assert.equal(parseRoute('#constructor').view,'home');
 assert.equal(parseRoute('#mission').anchor,'mission');
});

test('a shared analysis selection retains coordinate, field, observer and timing context',()=>{
 const query=analysisParams({raDeg:359.99,decDeg:-12.3,name:'움직인 자리',frame:'ICRS',coordinateEpoch:'J2000',timeScale:'UTC',observer:'SPHEREx',moving:true,observationMjd:60900.25,predictionMjd:60901.5,fovArcsec:360});
 const route=parseRoute(routeHash('analysis',query));
 assert.equal(route.params.get('ra'),'359.99');assert.equal(route.params.get('dec'),'-12.3');
 assert.equal(route.params.get('frame'),'ICRS');assert.equal(route.params.get('coordinateEpoch'),'J2000');
 assert.equal(route.params.get('observer'),'SPHEREx');assert.equal(route.params.get('timeScale'),'UTC');
 assert.equal(route.params.get('observationMjd'),'60900.25');assert.equal(route.params.get('predictionMjd'),'60901.5');assert.equal(route.params.get('fov'),'0.1');
});

test('invalid or apparent positions cannot silently open a fixed ICRS analysis',()=>{
 for(const target of [{name:'Eros'}, {ra:2,dec:91}, {ra:NaN,dec:0}, {ra:2,dec:1,frame:'apparent-ICRF'}])assert.throws(()=>analysisParams(target));
 assert.equal(analysisParams({preparedTargetId:'eps_indi_b',name:'Epsilon Indi B'}).get('target'),'eps_indi_b');
 assert.throws(()=>analysisParams({target:'../unknown'}));
});

test('child links work beneath a repository base and keep shell-only embed owned by caller',()=>{
 const input=new URLSearchParams('ra=0&dec=0&embed=no&label=A%26B');
 const url=childURL('analysis',input,'https://example.test/S/');
 assert.equal(url.pathname,'/S/analysis/');assert.equal(url.searchParams.get('embed'),'1');
 assert.equal(url.searchParams.get('label'),'A&B');assert.equal(url.searchParams.has('target'),false);
 assert.equal(childURL('analysis',new URLSearchParams(),'https://example.test/S/').searchParams.get('target'),'barnard');
 assert.equal(childURL('asteroids',new URLSearchParams('target=16'),'https://example.test/S/').pathname,'/S/asteroids/');
 assert.equal(parseRoute(routeHash('planetarium',{lat:37.5,lon:127,time:'2026-01-01T00:00:00Z',embed:1})).params.has('embed'),false);
});

test('child messages require both the exact source window and origin',()=>{
 const child={},frame={contentWindow:child},event={origin:'https://example.test',source:child,data:{type:'spherex-analysis-url'}};
 assert.equal(trustedFrameMessage(event,frame,'https://example.test'),true);
 assert.equal(trustedFrameMessage({...event,source:{}},frame,'https://example.test'),false);
 assert.equal(trustedFrameMessage({...event,origin:'https://evil.test'},frame,'https://example.test'),false);
 assert.equal(trustedFrameMessage({...event,data:null},frame,'https://example.test'),false);
});

import {headerCurrent,headerStage,skyReturnHash} from '../routing.js';

test('header highlight: 천구 관찰 covers the planetarium and the analysis sky stage',()=>{
 assert.equal(headerCurrent('planetarium',new URLSearchParams()),'planetarium');
 assert.equal(headerCurrent('analysis',new URLSearchParams('view=sky&target=barnard')),'planetarium');
 assert.equal(headerCurrent('analysis',new URLSearchParams('target=barnard')),'analysis');
 assert.equal(headerCurrent('analysis',new URLSearchParams('view=workbench')),'analysis');
 assert.equal(headerCurrent('analysis',new URLSearchParams()),'analysis');
 assert.equal(headerCurrent('asteroids',new URLSearchParams('view=sky')),'asteroids');
 assert.equal(headerCurrent('experience',new URLSearchParams()),null,'Space Journey is no longer a view');
 assert.equal(parseRoute('#experience').view,'home','the removed route falls back to home');
 assert.equal(headerCurrent('home',new URLSearchParams()),'home');
 assert.equal(headerCurrent('nope',new URLSearchParams()),null);
 assert.equal(headerCurrent('analysis',parseRoute('#analysis?view=sky').params),'planetarium');
});

test('header stage messages exist only for the two analysis-backed items',()=>{
 assert.equal(headerStage('planetarium'),'sky');
 assert.equal(headerStage('analysis'),'workbench');
 assert.equal(headerStage('asteroids'),null);
});

test('SPHEREx 천구 address carries the sky centre only when the planetarium state has it',()=>{
 assert.equal(skyReturnHash({query:'ra=83.82&dec=-5.39&fov=12'}),'#analysis?view=sky&sky=83.82,-5.39,12');
 assert.equal(skyReturnHash({query:'ra=-10&dec=20&fov=5'}),'#analysis?view=sky&sky=350,20,5');
 assert.equal(skyReturnHash({query:'lat=37.5&lon=127&fov=60&yaw=1&pitch=2'}),'#analysis?view=sky');
 assert.equal(skyReturnHash({query:'ra=1&dec=95&fov=5'}),'#analysis?view=sky');
 assert.equal(skyReturnHash({query:'ra=1&dec=2&fov=0'}),'#analysis?view=sky');
 assert.equal(skyReturnHash({query:'ra=&dec=&fov='}),'#analysis?view=sky');
 assert.equal(skyReturnHash({}),'#analysis?view=sky');
 assert.equal(skyReturnHash(null),'#analysis?view=sky');
 assert.equal(parseRoute(skyReturnHash({query:'ra=1&dec=2&fov=3'})).params.get('sky'),'1,2,3');
});

import {skyViewFocus} from '../routing.js';
test('focus after a sky view switch: only switches from the sky sub-navigation or the child view switch move focus',()=>{
 assert.equal(skyViewFocus('child-navigate','planetarium'),'sky-navigation');
 assert.equal(skyViewFocus('sky-nav','planetarium'),'sky-navigation');
 assert.equal(skyViewFocus('sky-nav','analysis'),'analysis-sky-mode');
 assert.equal(skyViewFocus(undefined,'planetarium'),null);
 assert.equal(skyViewFocus(undefined,'analysis'),null);
 assert.equal(skyViewFocus('child-navigate','analysis'),null);
 assert.equal(skyViewFocus('child-navigate','asteroids'),null);
});
