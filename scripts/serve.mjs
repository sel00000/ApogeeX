import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './paths.mjs';
import { findPython } from './python.mjs';
import { publicAskUrl } from './public-config.mjs';
import { createSiteServer, listenOnAvailablePort } from '../services/gateway/server.mjs';
import { createAsteroidApi } from '../services/gateway/asteroid-api.mjs';
import { createPublicAccess, createAdmission } from '../services/gateway/public-access.mjs';

async function startObservations() {
  const python=await findPython({imports:['numpy','astropy','pyvo','requests','PIL','reproject','astroquery']});
  if(!python)return {url:'',error:'Python dependencies are unavailable. Run npm run setup:python.',close:async()=>{}};
  const child=spawn(python.executable,[...python.args,'-X','utf8','-u','-B',join(projectRoot,'services/observations/server.py'),'--host','127.0.0.1','--port','0'],{
    cwd:projectRoot,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',MPLBACKEND:'Agg',SPHEREX_PROJECT_ROOT:projectRoot,SPHEREX_DATA_DIR:join(projectRoot,'apps/analysis/public/data'),SPHEREX_RUNTIME_DIR:join(projectRoot,'var/observations')}
  });
  return new Promise(resolveService=>{
    let settled=false,pending='',logs='';
    let exited=false;
    child.once('exit',()=>{exited=true;});
    const close=async()=>{if(exited||child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(()=>{child.kill('SIGKILL');r();},4000);child.once('exit',()=>{clearTimeout(t);r();});});};
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolveService({...value,close,isAlive:()=>!exited&&child.exitCode===null});};
    const timer=setTimeout(()=>{child.kill();finish({url:'',error:'Observation service start timed out.'});},45000);
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split(/\r?\n/);pending=lines.pop()||'';for(const line of lines){if(line.startsWith('SPHEREX_OBSERVATIONS_READY=')){try{const {port}=JSON.parse(line.slice('SPHEREX_OBSERVATIONS_READY='.length));if(Number.isInteger(port)&&port>0)finish({url:`http://127.0.0.1:${port}`});}catch{}}else if(line)console.log(`[observations] ${line}`);}});
    child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{logs=(logs+chunk).slice(-3000);if(settled)process.stderr.write(`[observations] ${chunk}`);});
    child.once('error',e=>finish({url:'',error:e.message}));child.once('exit',code=>{if(!settled)finish({url:'',error:logs||`Observation service exited (${code}).`});});
  });
}
export async function startSiteServer(args=process.argv.slice(2)) {
  const access=createPublicAccess(),admission=createAdmission();
  const portAt=args.indexOf('--port'),port=Number(portAt<0?(process.env.PORT||4173):args[portAt+1]);
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Use --port 0–65535.');
  const webRoot=join(projectRoot,'dist');await stat(join(webRoot,'index.html')).catch(()=>{throw new Error('Run npm run build first.');});
  // Same search helper address as the built config.json (deployment/public.json, SPHEREX_ASK_URL overrides).
  const askUrl=await publicAskUrl(projectRoot);
  const observations=await startObservations();
  if(observations.error)console.warn(observations.error);
  const asteroids=createAsteroidApi({projectRoot,access,admission});
  const server=createSiteServer({webRoot,asteroids,observationsUrl:observations.url,observationError:observations.error,askUrl,
    access,admission,observationsAlive:observations.isAlive,stopObservations:observations.close});
  let actualPort;
  try { actualPort=await listenOnAvailablePort(server,{port,host:process.env.HOST||'127.0.0.1',automatic:portAt<0&&!process.env.PORT}); }
  catch(error){await Promise.allSettled([asteroids.close(),observations.close()]);throw error;}
  const url=`http://127.0.0.1:${actualPort}/`;
  console.log(`SPHEREx Sky Lab v5.0.0\nLocal: ${url}\nObservation API: ${observations.url||'unavailable'}\nPress Ctrl+C to stop.`);
  console.log('SPHEREX_SITE_READY='+JSON.stringify({url,observationsUrl:observations.url}));
  let closing=false;
  const close=async()=>{if(closing)return;closing=true;await Promise.allSettled([asteroids.close(),observations.close()]);await new Promise(r=>server.close(r));};
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void close().then(()=>process.exit(0)));
  if(args.includes('--open')){const exe=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const child=spawn(exe,process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();}
  return {server,url,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await startSiteServer();
