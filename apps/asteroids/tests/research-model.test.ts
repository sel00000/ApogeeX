import {describe,it,expect} from 'vitest';
import {artifactUrl,initialBody,jobResultUrl,matchTarget,sceneDataUrl,statusLabel,validateCatalog,validateResult} from '../src/research-model';
import type {Body} from '../src/types';
import {setLang} from '../src/i18n';

describe('asteroid workspace target identity',()=>{
  const bodies=[{id:'10',name:'10 Hygiea',kind:'asteroid'},{id:'764',name:'764 Gedania',kind:'asteroid'}] as Body[];
  it('chooses available data when Eros is absent',()=>expect(initialBody(bodies)?.id).toBe('10'));
  it('does not silently show another orbit for an unknown target',()=>expect(initialBody(bodies,'433')).toBeUndefined());
  it('matches an exact name without the catalogue number',()=>expect(initialBody(bodies,'Hygiea')?.id).toBe('10'));
  it('joins file IDs, provisional designations and numbered 3D IDs explicitly',()=>{
    const rows=[{id:'A913_SF',objectId:'A913 SF',numberedId:'764',aliases:['Gedania'],name:'764 Gedania (A913 SF)'}];
    for(const key of ['A913_SF','A913 SF','764','Gedania'])expect(matchTarget(rows,key)?.id).toBe('A913_SF');
  });
  it('does not choose between ambiguous names',()=>expect(matchTarget([{id:'1',name:'1 Test'},{id:'2',name:'2 Test'}],'Test')).toBeUndefined());
});
describe('analysis result boundaries',()=>{
  const base='http://localhost:4173/asteroids/analysis-data/index.json';
  it('accepts catalogue artifacts in the catalogue subtree',()=>expect(artifactUrl(base,'433/result.json')).toBe('http://localhost:4173/asteroids/analysis-data/433/result.json'));
  it('rejects cross-origin, executable and escaping artifact URLs',()=>{for(const path of ['https://evil.test/x','javascript:alert(1)','../secrets','a\\b'])expect(()=>artifactUrl(base,path)).toThrow();});
  it('checks schema and duplicate target IDs',()=>{expect(()=>validateCatalog({targets:[]})).toThrow();expect(()=>validateCatalog({schema:'spherex-asteroid-web-1',targets:[{id:'1',name:'a',detail:'a'},{id:'1',name:'b',detail:'b'}]})).toThrow();expect(()=>validateResult({schema:'spherex-asteroid-web-1',id:'1',record:[]})).toThrow();});
  it('permits scene bundles only under the local job route',()=>{
    const route='/api/asteroid-analysis/jobs/00000000-0000-0000-0000-000000000001/scene/';
    expect(sceneDataUrl(route,'http://localhost:4173')).toBe('http://localhost:4173'+route);
    expect(sceneDataUrl('https://evil.test'+route,'http://localhost:4173')).toBeNull();
    expect(sceneDataUrl('/api/private/','http://localhost:4173')).toBeNull();
  });
  it('distinguishes missing data from pipeline failure',()=>{setLang('ko');expect(statusLabel('no_data')).toBe('관측 자료 없음');expect(statusLabel('failed')).toBe('실패');setLang('en');expect(statusLabel('no_data')).toBe('No observation data');expect(statusLabel('failed')).toBe('Failed');});
  it('resolves relative and absolute job results against the configured API prefix',()=>{
    const api='https://science.example/service',origin='https://owner.github.io',route='/api/asteroid-analysis/jobs/00000000-0000-0000-0000-000000000001/result.json';
    for(const value of [route,route.slice(1),'/service'+route,api+route])expect(jobResultUrl(value,origin,api)).toBe(api+route);
    expect(artifactUrl(api+route,'spectrum.csv')).toBe(api+route.replace('result.json','spectrum.csv'));
    expect(artifactUrl(api+route,'spectrum.png')).toBe(api+route.replace('result.json','spectrum.png'));
  });
  it('permits remote scenes only at the configured server and deployment prefix',()=>{
    const api='https://science.example/service',origin='https://owner.github.io',route='/api/asteroid-analysis/jobs/00000000-0000-0000-0000-000000000001/scene/';
    expect(sceneDataUrl(route,origin,api)).toBe(api+route);
    expect(sceneDataUrl(api+route,origin,api)).toBe(api+route);
    for(const value of ['https://evil.example'+route,'https://science.example'+route,'//science.example'+route,route+'?x=1',route+'#x',route.replace('/jobs/','/jobs/../jobs/'),route.replace('/jobs/','/jobs/%2e%2e/jobs/')])expect(sceneDataUrl(value,origin,api)).toBeNull();
  });
});
