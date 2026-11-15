import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { isLocalAsteroidRequest } from './asteroid-api.mjs';
import { createPublicAccess, createAdmission } from './public-access.mjs';
import { createObservationApi } from './observation-api.mjs';

const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jsonl':'application/x-ndjson','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.zip':'application/zip','.xml':'application/xml','.gz':'application/gzip'};
export function staticPath(root, raw) {
  let decoded; try { decoded = decodeURIComponent(raw); } catch { throw Object.assign(new Error('Malformed path'), {status:400}); }
  if (/[\0\\:]/.test(decoded)) throw Object.assign(new Error('Invalid path'), {status:400});
  if (decoded.split('/').some(p => p === '..' || (p.startsWith('.') && p !== '.nojekyll'))) throw Object.assign(new Error('Forbidden path'), {status:403});
  const base = resolve(root), file = resolve(base, decoded.replace(/^\/+/, ''));
  if (file !== base && !file.startsWith(base+sep)) throw Object.assign(new Error('Forbidden path'), {status:403});
  return file;
}
function json(res,status,value) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
export function byteRange(header, size) {
  if (!header) return null;
  const m=/^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2]) || size === 0) return false;
  const suffix=!m[1], start=suffix?Math.max(0,size-Number(m[2])):Number(m[1]);
  const end=suffix?size-1:(m[2]?Math.min(Number(m[2]),size-1):size-1);
  if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start) return false;
  return {start,end};
}
function proxy(req,res,url,base) {
  return new Promise(resolveProxy=>{
    const target=new URL(url.pathname+url.search,base);
    const headers={}; for(const key of ['content-type','content-length','accept','range','if-none-match']) if(req.headers[key]) headers[key]=req.headers[key];
    const upstream=(target.protocol==='https:'?httpsRequest:httpRequest)(target,{method:req.method,headers},response=>{
      const out={...response.headers}; delete out['access-control-allow-origin']; delete out['set-cookie'];
      res.writeHead(response.statusCode||502,out); response.pipe(res); response.once('end',resolveProxy);response.once('error',()=>{res.destroy();resolveProxy();});
    });
    upstream.setTimeout(120000,()=>upstream.destroy(new Error('Upstream timeout')));
    upstream.once('error',()=>{if(!res.headersSent)json(res,502,{error:'Observation service could not be reached.',code:'upstream_unavailable'});else res.destroy();resolveProxy();});
    req.once('aborted',()=>upstream.destroy()); res.once('close',()=>{if(!res.writableEnded)upstream.destroy();});
    req.pipe(upstream);
  });
}
export function createSiteServer({webRoot,asteroids,observationsUrl='',askUrl='',observationError='',
  access = createPublicAccess(), admission = createAdmission(), observationsAlive, stopObservations}={}) {
  if(!webRoot)throw new Error('webRoot is required.');
  const root=resolve(webRoot);
  const observations = createObservationApi({base:observationsUrl,access,admission,isAlive:observationsAlive,stopWorker:stopObservations});
  const server = createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    try {
      staticPath(root,(req.url||'/').split('?')[0]);
      const url=new URL(req.url||'/','http://localhost');
      url.pathname=url.pathname.replace(/^\/(analysis|asteroids)\/api(?=\/|$)/,'/api');
      if(url.pathname.startsWith('/api/') && access.cors(req,res))return;
      if(url.pathname==='/config.json')return json(res,200,{version:'5.0.0',apiBase:'',askUrl,localServices:true,publicMode:access.enabled,limits:access.limits,observationsAvailable:!!observationsUrl && (!observationsAlive || observationsAlive())});
      if(url.pathname==='/api/health')return json(res,200,{status:'ok',version:'5.0.0',publicMode:access.enabled,busy:admission.busy,observations:!!observationsUrl && (!observationsAlive || observationsAlive())});
      if(url.pathname==='/api/session'){
        if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
        if(!access.enabled && !isLocalAsteroidRequest(req))return json(res,403,{error:'Local same-origin requests only.',code:'local_only'});
        return json(res,200,access.issue(req));
      }
      if(asteroids && await asteroids.handle(req,res,url))return;
      if(/^\/api\/(resolve|patch)(\/|$)/.test(url.pathname)||url.pathname.startsWith('/api/observations/')) {
        if(!access.enabled && !isLocalAsteroidRequest(req,!['GET','HEAD'].includes(req.method)))return json(res,403,{error:'Local same-origin requests only.',code:'local_only'});
        if(!observationsUrl)return json(res,503,{error:observationError||'Python analysis is unavailable. Run npm run setup:python.',code:'python_unavailable'});
        if(access.enabled){
          if(await observations.handle(req,res,url))return;
          if(!['GET','HEAD'].includes(req.method)||!url.pathname.startsWith('/api/observations/data/patches/'))return json(res,404,{error:'Unknown observation endpoint.'});
        }
        return await proxy(req,res,url,observationsUrl);
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown API endpoint.'});
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
      let path=staticPath(root,url.pathname),info=await stat(path);
      if(info.isDirectory()){
        if(!url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname+'/'+url.search});return res.end();}
        path=resolve(path,'index.html');info=await stat(path);
      }
      if(!info.isFile())return json(res,404,{error:'Not found.'});
      const [physicalRoot,physicalFile]=await Promise.all([realpath(root),realpath(path)]);
      if(!physicalFile.startsWith(physicalRoot+sep))return json(res,403,{error:'Forbidden.'});
      const range=byteRange(req.headers.range,info.size);
      if(range===false){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
      const headers={'Content-Type':MIME[extname(path).toLowerCase()]||'application/octet-stream','Content-Length':range?range.end-range.start+1:info.size,'Accept-Ranges':'bytes','Cache-Control':'no-cache'};
      if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
      res.writeHead(range?206:200,headers);
      if(req.method==='HEAD')return res.end();
      createReadStream(path,range||{}).on('error',()=>res.destroy()).pipe(res);
    }catch(error){if(res.headersSent)return res.destroy();const status=error.status||(['ENOENT','ENOTDIR'].includes(error.code)?404:500);if(status===429)res.setHeader('Retry-After','10');json(res,status,{error:status===500?'Request failed.':error.message,...(error.status&&error.code?{code:error.code}:{})});}
  });
  server.once('close',()=>observations.close());
  return server;
}
export async function listenOnAvailablePort(server,{port=4173,host='127.0.0.1',automatic=true}={}){
  const ports=automatic&&port!==0?[port,...Array.from({length:19},(_,i)=>port+i+1).filter(p=>p<=65535),0]:[port];
  for(const p of ports){try{await new Promise((resolveListen,reject)=>{const done=()=>{server.off('error',error);resolveListen();};const error=e=>{server.off('listening',done);reject(e);};server.once('error',error);server.once('listening',done);server.listen(p,host);});return server.address().port;}catch(e){if(e.code!=='EADDRINUSE'||!automatic)throw e;}}
  throw new Error('No available local port.');
}
