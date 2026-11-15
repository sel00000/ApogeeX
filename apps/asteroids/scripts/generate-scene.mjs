import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {access,mkdir,readFile,realpath,rename,rm,stat,writeFile} from 'node:fs/promises';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const scripts=dirname(fileURLToPath(import.meta.url));
export const SCENE_STAGES=['prepare.py','enrich.py','fixed_sky.py','model_sky.py','prepare_sightlines.py','prepare_trails.py'];
const DATA_FILES=['manifest.json','bodies.json','observations.json','comparisons.json','sightlines.json','trails.json'];
const hash=data=>createHash('sha256').update(data).digest('hex');
const exists=path=>access(path).then(()=>true,()=>false);
function within(parent,child){const rel=relative(parent,child);return rel!==''&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);}

/** Validate the published bundle independently of successful Python exit codes. */
export async function validateSceneBundle(directory) {
  const root=await realpath(directory),data={};
  for(const name of DATA_FILES)data[name]=JSON.parse(await readFile(join(root,name),'utf8'));
  const manifest=data['manifest.json'],bodies=data['bodies.json'],observations=data['observations.json'],comparisons=data['comparisons.json'];
  if(!Number.isFinite(manifest.start)||!Number.isFinite(manifest.end)||manifest.start>manifest.end)throw Error('Invalid scene time range.');
  if(!Array.isArray(bodies)||!bodies.some(body=>body.kind==='asteroid')||bodies.some(body=>typeof body.id!=='string'||!Array.isArray(body.samples)||body.samples.length<2))throw Error('The scene has no complete asteroid orbit.');
  if(!Array.isArray(observations)||!observations.length||!Array.isArray(comparisons))throw Error('The scene has no real observation metadata.');
  if(!data['sightlines.json']||Array.isArray(data['sightlines.json'])||!data['trails.json']||Array.isArray(data['trails.json']))throw Error('Invalid observation geometry metadata.');
  const ids=new Set(bodies.filter(body=>body.kind==='asteroid').map(body=>body.id));
  if(observations.some(row=>!ids.has(row.objectId)||!Number.isFinite(row.mjd)))throw Error('Observation and body identities differ.');
  const files=new Set(DATA_FILES.filter(name=>name!=='manifest.json'));
  const rows=[...observations,...comparisons.flatMap(sequence=>sequence.frames??[])];
  for(const row of rows){
    if(!row.image)continue;
    const path=row.image.path;
    if(typeof path!=='string'||!/^[A-Za-z0-9 _./()+-]+\.png$/.test(path)||path.split('/').includes('..')||path.startsWith('/'))throw Error('Invalid scene image path.');
    const physical=await realpath(join(root,path));
    if(!within(root,physical)||!(await stat(physical)).isFile())throw Error('Scene image escaped its bundle.');
    files.add(path);
  }
  const hashes={};for(const file of files)hashes[file]=hash(await readFile(join(root,file)));
  return {manifest,counts:{asteroids:ids.size,observations:observations.length,preparedImages:rows.filter(row=>row.image).length},hashes};
}

export function runPythonStage(stage,{python,env,signal,onLog=()=>{}}) {
  return new Promise((resolveStage,reject)=>{
    signal?.throwIfAborted();
    const interpreter=typeof python==='string'?{executable:python,args:[]}:python;
    if(!interpreter?.executable)throw Error('A Python interpreter is required.');
    let settled=false,killTimer;
    const child=spawn(interpreter.executable,[...(interpreter.args??[]),'-X','utf8','-u','-B',join(scripts,stage)],{cwd:scripts,env:{...process.env,...env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',MPLBACKEND:'Agg'},shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(killTimer);signal?.removeEventListener('abort',abort);error?reject(error):resolveStage();};
    const abort=()=>{child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),2000);killTimer.unref?.();};
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    for(const stream of [child.stdout,child.stderr]){
      let pending='';stream.setEncoding('utf8');
      stream.on('data',chunk=>{pending+=chunk;const lines=pending.split(/\r?\n|\r/);pending=lines.pop()??'';for(const line of lines)if(line.trim())onLog(line.slice(0,1200));if(pending.length>8192){onLog(pending.slice(0,1200));pending='';}});
      stream.on('end',()=>{if(pending.trim())onLog(pending.slice(0,1200));});
    }
    child.once('error',finish);
    child.once('close',code=>finish(signal?.aborted?(signal.reason instanceof Error?signal.reason:Error('3D generation cancelled.')):code===0?null:Error(`${stage} failed with exit code ${code}.`)));
  });
}

/** Raw scientific output and SQLite are independent inputs; web-export filenames are not used. */
export async function generateScene({sourceDir,sourceRoot,dbPath,destinationDir,python,signal,onLog=()=>{},runStage=runPythonStage}) {
  signal?.throwIfAborted();
  const [source,root,database]=await Promise.all([realpath(sourceDir),realpath(sourceRoot),realpath(dbPath)]);
  if(!within(root,source))throw Error('The analysis result must be inside its raw output directory.');
  if(!(await stat(database)).isFile())throw Error('The analysis SQLite input is not a file.');
  const inputHashes={};
  for(const name of ['integrated_record.json','stage1_observations.csv','stage2_spectrum.csv'])inputHashes[name]=hash(await readFile(join(source,name)));
  const destination=resolve(destinationDir),parent=dirname(destination);
  if(await exists(destination))throw Error('The destination already exists; a completed scene is immutable.');
  await mkdir(parent,{recursive:true});
  const physicalParent=await realpath(parent),stage=join(physicalParent,'.scene-build-'+randomUUID()),physicalDestination=join(physicalParent,basename(destination));
  await mkdir(stage);
  const env={SPHEREX_SCENE_SOURCE:root,SPHEREX_SCENE_DB:database,SPHEREX_SCENE_OUT:stage,SPHEREX_SCENE_CACHE:join(physicalParent,'scene-cache'),SPHEREX_SCENE_SOURCE_COMMIT:'analysis-'+inputHashes['integrated_record.json'].slice(0,20)};
  try{
    for(const step of SCENE_STAGES){signal?.throwIfAborted();onLog(`3D 자료 준비: ${step}`);await runStage(step,{python,env,signal,onLog});}
    signal?.throwIfAborted();
    const validated=await validateSceneBundle(stage);
    const manifest={...validated.manifest,schema:'spherex-asteroid-scene-1',status:'ready',input:{recordSha256:inputHashes['integrated_record.json'],files:inputHashes,sqliteSha256:hash(await readFile(database))},artifacts:validated.hashes,counts:validated.counts,completedAt:new Date().toISOString()};
    await writeFile(join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    signal?.throwIfAborted();
    await rename(stage,physicalDestination);
    return {manifestPath:join(physicalDestination,'manifest.json'),counts:validated.counts,warnings:manifest.warnings??[]};
  }catch(error){
    // This unique directory was created above. Never remove the requested destination or any input.
    if(dirname(stage)!==physicalParent||!basename(stage).startsWith('.scene-build-'))throw Error('Refusing unexpected staging cleanup.');
    await rm(stage,{recursive:true,force:true});
    throw error;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
  const sourceDir=get('--source-dir'),sourceRoot=get('--source-root'),dbPath=get('--db-path'),destinationDir=get('--output-dir');
  if(!sourceDir||!sourceRoot||!dbPath||!destinationDir){console.error('Usage: node generate-scene.mjs --source-dir <raw target> --source-root <raw outputs> --db-path <sqlite> --output-dir <new scene directory> [--python <executable>]');process.exitCode=2;}
  else await generateScene({sourceDir,sourceRoot,dbPath,destinationDir,python:{executable:get('--python')||process.env.SPHEREX_PYTHON||'python',args:[]},onLog:line=>console.log(line)}).then(result=>console.log(JSON.stringify(result)),error=>{console.error(error.message);process.exitCode=1;});
}
