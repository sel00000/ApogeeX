// Two real origins exercise browser CORS. Jobs are fixtures; no archive analysis is launched.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.csv':'text/csv','.md':'text/plain'};
const id='00000000-0000-0000-0000-000000000001',route='/api/asteroid-analysis/jobs/'+id;
let siteOrigin,apiOrigin,available=false,sessionCalls=0;
const requests=[],checks=[],errors=[];
const job={id,status:'completed',target:'433',start:'2025-06-01',end:'2025-08-01',maxImages:120,logs:['Browser fixture: existing public scientific results'],resultUrl:route+'/result.json',scene:{status:'not_started'}};
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function file(res,base,relative){
 const path=resolve(base,relative);
 if(!path.startsWith(resolve(base)+sep))return json(res,{error:'path'},400);
 try{const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(data);}catch{json(res,{error:'missing fixture'},404);}
}
const api=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const path=url.pathname.replace(/^\/relay/,'');
 res.setHeader('Access-Control-Allow-Origin',siteOrigin);res.setHeader('Vary','Origin');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Spherex-Session');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, POST, DELETE, OPTIONS');
 requests.push({path:url.pathname,method:req.method,session:req.headers['x-spherex-session']||null});
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 if(path==='/api/session'){sessionCalls++;return json(res,{publicMode:true,sessionToken:'fixture-owner',expiresAt:new Date(Date.now()+3600000).toISOString()});}
 if(path==='/api/asteroid-analysis/capabilities')return json(res,{available,maxImages:360,reason:available?'':'Fixture unavailable'});
 const owned=path==='/api/asteroid-analysis/jobs'||path===route||(path===route+'/scene'&&req.method==='POST');
 if(owned&&req.headers['x-spherex-session']!=='fixture-owner')return json(res,{error:'owner required'},401);
 if(path==='/api/asteroid-analysis/jobs'&&req.method==='POST')return json(res,job,202);
 if(path===route)return json(res,job);
 if(path===route+'/scene'&&req.method==='POST'){job.scene={status:'completed',url:route+'/scene/'};return json(res,job,202);}
 if(path.startsWith(route+'/scene/'))return file(res,join(root,'public/data'),path.slice((route+'/scene/').length));
 if(path.startsWith(route+'/'))return file(res,join(root,'public/analysis-data/433'),path.slice((route+'/').length));
 json(res,{error:'route'},404);
});
const site=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/Apogee/config.json')return json(res,{apiBase:apiOrigin+'/relay',localServices:false});
 if(path.startsWith('/Apogee/asteroids/'))return file(res,join(root,'dist'),path.slice('/Apogee/asteroids/'.length)||'index.html');
 json(res,{error:'route'},404);
});
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;}
apiOrigin=await listen(api);siteOrigin=await listen(site);
let browser;
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(siteOrigin+'/Apogee/asteroids/?embed=1&target=433');
 await page.locator('#result-content .result-heading h2').filter({hasText:'Eros'}).waitFor();
 await page.locator('#capabilities').filter({hasText:'Fixture unavailable'}).waitFor();
 check('prepared results survive an unavailable remote server',await page.locator('#job-submit').isDisabled());
 available=true;await page.locator('#server-retry').click();await page.waitForFunction(()=>!document.querySelector('#job-submit').disabled);
 check('server retry enables new analysis without a page reload',true);
 await page.locator('#job-submit').click();await page.locator('#job-status').filter({hasText:'처리 완료'}).waitFor();
 await page.waitForFunction(prefix=>document.querySelector('#result-downloads a')?.href.startsWith(prefix),apiOrigin+'/relay'+route);
 check('relative result URL uses the external API deployment prefix',requests.some(r=>r.path==='/relay'+route+'/result.json'));
 const download=await page.locator('#result-downloads a').filter({hasText:'관측 CSV'}).getAttribute('href');
 check('CSV artifacts point to the same trusted job directory',download===apiOrigin+'/relay'+route+'/observations.csv');
 const csv=await page.evaluate(async url=>(await fetch(url)).status,download);check('public scientific CSV is readable cross-origin without a session header',csv===200);
 await page.locator('.plot-grid img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.plot-grid img')].every(image=>image.complete&&image.naturalWidth>0));
 check('all result plots decode from the API origin',await page.locator('.plot-grid img').count()===5);
 check('job mutation and status use the owner session',requests.filter(r=>r.path==='/relay/api/asteroid-analysis/jobs'||r.path==='/relay'+route).every(r=>r.method==='OPTIONS'||r.session==='fixture-owner'));
 check('the browser performed authenticated CORS preflight',requests.some(r=>r.method==='OPTIONS'&&r.path==='/relay/api/asteroid-analysis/jobs'));
 await page.locator('#scene-build').click();await page.locator('#scene-open').waitFor();await page.locator('#scene-open').click();
 await page.waitForFunction(()=>window.__app?.metrics().selected==='433'&&document.querySelector('#image-status')?.textContent?.includes('실제 SPHEREx'));
 check('generated scene JSON and observation PNG load from the API origin',requests.some(r=>r.path==='/relay'+route+'/scene/bodies.json')&&requests.some(r=>r.path.startsWith('/relay'+route+'/scene/')&&r.path.endsWith('.png')));
 await page.reload();await page.waitForFunction(()=>window.__app?.metrics().selected==='433');
 await page.getByRole('button',{name:'분석 결과 · 새 분석',exact:true}).click();await page.locator('#job-status').filter({hasText:'처리 완료'}).waitFor();
 check('scene deep links and owner sessions survive iframe reload',sessionCalls===1);
 check('public artifacts do not receive the session token',requests.filter(r=>r.path.startsWith('/relay'+route+'/')&&r.method==='GET').every(r=>!r.session));
 check('no browser runtime errors',errors.length===0);
 const output=join(root,'verification');await mkdir(output,{recursive:true});await writeFile(join(output,'remote-api-browser.json'),JSON.stringify({checks,errors,fixtures:true,sessionCalls,browser:await browser.version(),generatedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{
 await browser?.close();site.closeAllConnections();api.closeAllConnections();await Promise.all([new Promise(resolve=>site.close(resolve)),new Promise(resolve=>api.close(resolve))]);
}
