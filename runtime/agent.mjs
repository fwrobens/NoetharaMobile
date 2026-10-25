// Persistent owner-only coding jobs for NoetharaMobile.
// Jobs remain on the existing private AWS gateway, not in Expo or on the phone.
// BEFORE multi-tenant rollout, place every job in an isolated container/VM.
import { readFile, writeFile, mkdir, readdir, lstat, rename, rmdir, unlink, cp } from 'node:fs/promises';
import { resolve, relative, join, sep, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { startPreview } from './preview.mjs';
import { ENGINEERING_PROMPT } from './prompts/engineering.mjs';
import { DESIGN_PROMPT } from './prompts/design.mjs';
import { sandboxStatus, classifyCommand, isRemembered, rememberAllow, runShell, startProcess, processLogs, stopProcess, listProcesses } from './sandbox.mjs';

const MAX_ROUNDS = 80;
const RUN_BUDGET_MS = 14 * 60 * 1000;
const HISTORY_BATCHES = 10;
const READ_LIMIT = 36000;
const TEMPLATE_DIR = fileURLToPath(new URL('./templates/react-native/', import.meta.url));
const jobs = new Map();
// Jobs are persisted to disk so leaving the chat, reconnecting or a PM2 restart
// never loses progress. Checkpoints live in a separate git dir outside the workspace.
const STATE_DIR = process.env.NOETHARA_STATE_DIR || join(homedir(),'.noethara');
const JOB_DIR = join(STATE_DIR,'jobs');
const CHECKPOINT_DIR = join(STATE_DIR,'checkpoints');
try{mkdirSync(JOB_DIR,{recursive:true,mode:0o700});mkdirSync(CHECKPOINT_DIR,{recursive:true,mode:0o700})}catch{}
const serialize=job=>JSON.stringify({...job,files:[...job.files],_saveTimer:undefined,_approve:undefined});
function saveJobNow(job){
 clearTimeout(job._saveTimer);job._saveTimer=undefined;
 try{writeFileSync(join(JOB_DIR,job.id+'.json'),serialize(job),{mode:0o600})}catch{}
}
function scheduleSave(job){
 if(job._saveTimer)return;
 job._saveTimer=setTimeout(()=>saveJobNow(job),500);
 job._saveTimer.unref?.();
}
function hydrate(raw){
 const job={...raw,files:new Set(raw.files||[]),plan:raw.plan||[],checks:raw.checks||{},checkpoints:raw.checkpoints||[],events:raw.events||[],pendingApproval:null};
 if(job.status==='running'){
  job.status='paused';job.phase='paused';job.interrupted=true;
  job.answer='The server restarted while this session was running. Your files and checkpoints are saved. Tap Continue to resume.';
  job.events.push({id:(job.events.at(-1)?.id||0)+1,kind:'paused',message:'Server restarted; session paused safely.',at:Date.now()});
 }
 return job;
}
function loadJob(id){
 if(!/^[0-9a-f-]{36}$/.test(id))return null;
 try{const job=hydrate(JSON.parse(readFileSync(join(JOB_DIR,id+'.json'),'utf8')));jobs.set(job.id,job);return job}catch{return null}
}
(function restoreJobs(){
 let names=[];try{names=readdirSync(JOB_DIR).filter(n=>n.endsWith('.json'))}catch{return}
 const week=7*24*3600*1000;
 for(const name of names){
  const file=join(JOB_DIR,name);
  try{
   if(Date.now()-statSync(file).mtimeMs>week){unlinkSync(file);continue}
   const raw=JSON.parse(readFileSync(file,'utf8'));
   if(Date.now()-raw.created<24*3600*1000){const job=hydrate(raw);jobs.set(job.id,job);if(raw.status==='running')saveJobNow(job)}
  }catch{}
 }
})();
const getJob=id=>jobs.get(id)||loadJob(id);
const pause = ms=>new Promise(r=>setTimeout(r,ms));
const deny = (res,status,error)=>{
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify({error}));
};
const send = (res,status,body)=>{
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify(body));
};
const forbidden = /^(?:\.git|\.ssh|\.aws|\.config|\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?|node_modules|\.next|dist|build|\.expo|\.vite)$/i;
const validPath = value=>typeof value==='string'&&value.length>0&&value.length<320&&!value.startsWith('/')&&
 !value.includes('\\')&&value.split('/').every(s=>s.length>0&&s.length<120&&s!=='.'&&s!=='..'&&
 /^[\w.@+\- ]+$/.test(s)&&!forbidden.test(s));
const SYSTEM_ROOTS = /^\/(?:home|root|etc|usr|var|tmp|opt|bin|sbin|lib|proc|sys|dev|boot|mnt|srv|run)(?:\/|$)/;
// Models send "src/App.tsx", "./src/App.tsx", ".", "/abs/workspace/src/App.tsx",
// "workspace-name/src/App.tsx" or "/src/App.tsx". All resolve inside this workspace
// or throw; nothing may escape it.
function normalizeRel(dir,path){
 if(typeof path!=='string')throw Error('File path must be a string');
 let p=path.trim().replace(/\\/g,'/');
 const name=basename(dir);
 if(p===dir)p='';
 else if(p.startsWith(dir+'/'))p=p.slice(dir.length+1);
 else if(p.startsWith('/')){
  const marker='/'+name+'/';
  const at=p.indexOf(marker);
  if(at>=0)p=p.slice(at+marker.length);
  else if(SYSTEM_ROOTS.test(p))throw Error('File path is outside the workspace. Use a path relative to the project root, e.g. src/App.tsx');
  else p=p.replace(/^\/+/,'');
 }
 while(p.startsWith('./'))p=p.slice(2);
 p=p.replace(/\/{2,}/g,'/').replace(/\/$/,'');
 if(p==='.'||p==='')return '';
 if(p.startsWith(name+'/'))p=p.slice(name.length+1);
 else if(p===name)return '';
 return p;
}
export function canonicalPath(dir,path){
 const p=normalizeRel(dir,path);
 if(!validPath(p))throw Error('Invalid file path "'+String(path).slice(0,80)+'". Use a path relative to the project root such as package.json or src/App.tsx (no .., dotfiles or node_modules).');
 return p;
}
async function safePath(dir,path,createParents=false){
 path=canonicalPath(dir,path);
 const parts=path.split('/');
 let parent=dir;
 for(const part of parts.slice(0,-1)){
   parent=join(parent,part);
   try{const stat=await lstat(parent);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Unsafe project directory')}
   catch(e){if(e.code==='ENOENT'&&createParents)await mkdir(parent,{mode:0o700});else throw e}
 }
 const target=resolve(dir,path);
 if(!target.startsWith(dir+sep))throw Error('Path escaped project');
 try{const stat=await lstat(target);if(stat.isSymbolicLink()||!stat.isFile())throw Error('Unsafe file type')}
 catch(e){if(e.code!=='ENOENT')throw e}
 return target;
}
function event(job,message,kind='tool',extra={}){
 job.events.push({id:job.events.length?job.events[job.events.length-1].id+1:1,kind,message:String(message).slice(0,1800),at:Date.now(),...extra});
 if(job.events.length>300)job.events.shift();
 scheduleSave(job);
}
// Live command output updates the running action in place (no event spam).
function streamOutput(job,text){
 const now=Date.now();
 if(job._streamAt&&now-job._streamAt<500)return;
 job._streamAt=now;
 const live=[...job.events].reverse().find(e=>e.ref&&e.ref===job._liveRef&&e.status==='running');
 if(live){live.output=String(text).slice(-700);live.at=now;scheduleSave(job)}
}
// Ask the user before a sandbox command runs (permission mode 'ask').
function requestApproval(job,command,reason){
 return new Promise(resolve=>{
  const ref=randomUUID().slice(0,8),since=Date.now(),phase=job.phase;
  job.pendingApproval={ref,command:String(command).slice(0,600),reason:reason||'Runs inside this project\'s isolated sandbox.'};
  job.phase='awaiting_approval';
  event(job,'Waiting for your approval: '+String(command).slice(0,90),'progress');
  saveJobNow(job);
  const done=allow=>{
   clearTimeout(timer);clearInterval(watcher);
   job._approve=undefined;job.pendingApproval=null;job.phase=phase;
   job._waitedMs=(job._waitedMs||0)+(Date.now()-since);
   event(job,(allow?'Approved: ':'Denied: ')+String(command).slice(0,90),allow?'result':'progress');
   resolve(allow);
  };
  const timer=setTimeout(()=>done(false),10*60*1000);
  const watcher=setInterval(()=>{if(job.cancelled)done(false)},800);
  timer.unref?.();watcher.unref?.();
  job._approve=done;
 });
}
async function authorize(job,command){
 const mode=job.input?.permission||'ask';
 if(mode==='safe')throw Error('Shell commands are disabled in Safe mode. Use run_command for npm install, typecheck, build and test.');
 const verdict=classifyCommand(command);
 if(verdict.decision==='deny')throw Error(verdict.reason);
 if(mode==='auto'||verdict.decision==='allow'||isRemembered(STATE_DIR,job.workspaceId,command))return true;
 if(!await requestApproval(job,command))throw Error('The user denied: '+command+'. Use a different approach, or explain in your final answer why it is needed.');
 return true;
}
// Recursive project tree (bounded) so the model sees the structure in one call.
export async function projectTree(dir,start='',maxEntries=260){
 const out=[];
 async function walk(rel,depth){
  if(out.length>=maxEntries||depth>6)return;
  let entries;
  try{entries=await readdir(rel?join(dir,rel):dir,{withFileTypes:true})}catch{return}
  entries.sort((a,b)=>(Number(b.isDirectory())-Number(a.isDirectory()))||a.name.localeCompare(b.name));
  for(const e of entries){
   if(out.length>=maxEntries)return;
   if(e.name.startsWith('.')||forbidden.test(e.name)||e.isSymbolicLink())continue;
   const p=rel?rel+'/'+e.name:e.name;
   if(e.isDirectory()){out.push(p+'/');await walk(p,depth+1)}
   else if(e.isFile())out.push(p);
  }
 }
 await walk(start,0);
 return out;
}
async function listFiles(dir,path=''){
 const rel=normalizeRel(dir,String(path||''));
 if(rel){
  canonicalPath(dir,rel);
  let node=dir;
  for(const part of rel.split('/')){node=join(node,part);const st=await lstat(node).catch(()=>null);
   if(!st)throw Error('Folder '+rel+' does not exist');
   if(!st.isDirectory()||st.isSymbolicLink())throw Error(rel+' is not a folder');}
 }
 const tree=await projectTree(dir,rel);
 return tree.length?tree.join('\n'):'(empty folder)';
}
async function readText(dir,path){
 const target=await safePath(dir,path);
 let bytes;
 try{bytes=await readFile(target)}catch(e){if(e.code==='ENOENT')throw Error(canonicalPath(dir,path)+' does not exist. Use list_files to see real paths.');throw e}
 if(bytes.length>200000||bytes.includes(0))throw Error('Not a readable source file');
 const text=bytes.toString('utf8');
 return text.length>READ_LIMIT?text.slice(0,READ_LIMIT)+'\n[truncated: file is '+text.length+' chars; split it into smaller modules]':text;
}
async function writeText(dir,path,content){
 if(typeof content!=='string')throw Error('write_file needs the complete file text in "content"');
 if(Buffer.byteLength(content)>90000)throw Error('File exceeds 90KB; split it into smaller modules');
 if(/\/\/\s*\.\.\.\s*(?:rest|existing|remaining)|\{\/\*\s*\.\.\.|\/\*\s*\.\.\.\s*\*\//i.test(content))
  throw Error('Content contains an omitted-code placeholder. Write the complete file.');
 const target=await safePath(dir,path,true);
 await writeFile(target,content,{mode:0o600});
 return 'Saved '+relative(dir,target)+' ('+content.split('\n').length+' lines)';
}
async function editText(dir,path,find,replace){
 if(typeof find!=='string'||!find)throw Error('edit_file needs non-empty "find" text copied exactly from read_file output');
 if(typeof replace!=='string')throw Error('edit_file needs "replace" text (use an empty string to delete)');
 const target=await safePath(dir,path);
 let text;
 try{text=await readFile(target,'utf8')}catch(e){if(e.code==='ENOENT')throw Error(canonicalPath(dir,path)+' does not exist; use write_file to create it');throw e}
 let count=text.split(find).length-1;
 let next;
 if(count===1)next=text.replace(find,()=>replace);
 else if(count===0){
  // Tolerate trailing-whitespace / CRLF drift, still requiring a unique match.
  const norm=s=>s.replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');
  const t=norm(text),f=norm(find);
  const c=t.split(f).length-1;
  if(c!==1)throw Error((c>1?'"find" matches '+c+' places':'"find" text was not found')+' in '+canonicalPath(dir,path)+'. Re-read the file and copy the exact lines, or use write_file for a full rewrite.');
  next=t.replace(f,()=>replace);
 }else throw Error('"find" matches '+count+' places in '+canonicalPath(dir,path)+'; include more surrounding lines so it is unique.');
 await writeFile(target,next,{mode:0o600});
 return 'Edited '+relative(dir,target)+' ('+next.split('\n').length+' lines)';
}
async function deleteFile(dir,path){
 const target=await safePath(dir,path);
 try{await unlink(target)}catch(e){if(e.code==='ENOENT')throw Error(canonicalPath(dir,path)+' does not exist');throw e}
 return 'Deleted '+relative(dir,target);
}
async function scaffold(dir){
 try{await lstat(join(dir,'package.json'));throw Object.assign(Error('package.json already exists. Read and edit the existing project instead of scaffolding.'),{exists:true})}
 catch(e){if(e.exists||e.code!=='ENOENT')throw e}
 await cp(TEMPLATE_DIR,dir,{recursive:true,force:false,errorOnExist:false,filter:s=>!s.includes(sep+'node_modules')});
 const pkgPath=join(dir,'package.json');
 const pkg=JSON.parse(await readFile(pkgPath,'utf8'));
 pkg.name=basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')||'noethara-app';
 await writeFile(pkgPath,JSON.stringify(pkg,null,2)+'\n',{mode:0o600});
 const files=await projectTree(dir);
 return 'Scaffolded a verified React Native + TypeScript project (react-native-web + Vite preview). Files:\n'+files.join('\n')+
  '\nNext: run_command "npm install", then build the app in src/ (start from src/App.tsx and src/theme.ts).';
}
function git(gitDir,dir,args){
 return new Promise(done=>{
  const child=spawn('git',['--git-dir='+gitDir,'--work-tree='+dir,...args],{cwd:dir,stdio:['ignore','pipe','pipe'],
   env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:STATE_DIR,GIT_AUTHOR_NAME:'Noethara',GIT_AUTHOR_EMAIL:'agent@noethara.local',
    GIT_COMMITTER_NAME:'Noethara',GIT_COMMITTER_EMAIL:'agent@noethara.local'}});
  let out='';child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{out+=d});
  child.on('error',e=>done({code:1,out:String(e.message)}));child.on('close',code=>done({code,out:out.trim()}));
 });
}
const gitDirFor=workspaceId=>join(CHECKPOINT_DIR,String(workspaceId).replace(/[^\w-]/g,'_')+'.git');
export async function checkpoint(job,dir,label){
 try{
  const gitDir=gitDirFor(job.workspaceId);
  try{await lstat(gitDir)}catch{const r=await git(gitDir,dir,['init','-q']);if(r.code)return null}
  await mkdir(join(gitDir,'info'),{recursive:true});
  await writeFile(join(gitDir,'info','exclude'),'node_modules/\ndist/\nbuild/\n.vite/\n.expo/\n.git/\n*.log\n.env\n.env.*\n.npmrc\n');
  await git(gitDir,dir,['add','-A']);
  await git(gitDir,dir,['commit','-q','--allow-empty','-m',label]);
  const r=await git(gitDir,dir,['rev-parse','--short','HEAD']);
  if(r.code||!/^[0-9a-f]{4,40}$/.test(r.out))return null;
  job.checkpoints.push({sha:r.out,label,at:Date.now()});scheduleSave(job);
  return r.out;
 }catch{return null}
}
async function restoreCheckpoint(job,dir,sha){
 const known=job.checkpoints.find(c=>c.sha===sha);
 if(!known)throw Error('Unknown checkpoint');
 const gitDir=gitDirFor(job.workspaceId);
 await checkpoint(job,dir,'Before restoring '+sha);
 let r=await git(gitDir,dir,['reset','-q','--hard',sha]);
 if(r.code)throw Error('Restore failed: '+r.out.slice(0,200));
 r=await git(gitDir,dir,['clean','-fdq']);
 event(job,'Restored files to checkpoint "'+known.label+'"','result');
 return known;
}
const PLAN_STATUS={pending:'pending',todo:'pending',active:'active',in_progress:'active',running:'active',doing:'active',done:'done',completed:'done',complete:'done'};
function setPlan(job,steps){
 if(!Array.isArray(steps)||!steps.length)throw Error('update_plan needs steps: [{"title":"...","status":"pending|active|done"}]');
 job.plan=steps.slice(0,10).map(s=>typeof s==='string'?{title:s.slice(0,90),status:'pending'}:
  {title:String(s.title||s.step||s.name||'Step').slice(0,90),status:PLAN_STATUS[String(s.status||'').toLowerCase()]||'pending'});
 const active=job.plan.find(s=>s.status==='active');
 if(active)event(job,active.title,'plan',{status:'active'});
 return 'Plan updated. Keep it current as you work.';
}
// Repair an older agent bug that created workspace-name/package.json *inside*
// workspace-name. Move only non-conflicting source entries, never overwrite files,
// follow symlinks, or move hidden credentials. Remaining conflicts need an agent edit.
export async function recoverNestedProject(dir){
 try{await lstat(join(dir,'package.json'));return []}
 catch(e){if(e.code!=='ENOENT')throw e}
 const nested=join(dir,basename(dir));
 try{const st=await lstat(join(nested,'package.json'));if(!st.isFile()||st.isSymbolicLink())return []}
 catch(e){if(e.code==='ENOENT')return [];throw e}
 const moved=[],skipped=[];
 for(const entry of await readdir(nested,{withFileTypes:true})){
  if(entry.name.startsWith('.')||forbidden.test(entry.name)||entry.isSymbolicLink()||(!entry.isFile()&&!entry.isDirectory())){
   skipped.push(entry.name);continue;
  }
  const dest=join(dir,entry.name);
  try{await lstat(dest);skipped.push(entry.name);continue}
  catch(e){if(e.code!=='ENOENT')throw e}
  await rename(join(nested,entry.name),dest);moved.push(entry.name);
 }
 if(skipped.length===0)await rmdir(nested).catch(e=>{if(e.code!=='ENOTEMPTY')throw e});
 return {moved,skipped};
}
async function execute(dir,name,job){
 const allowed={
  'npm install':['install','--no-audit','--no-fund','--legacy-peer-deps'],
  'npm run build':['run','build'],
  'npm run typecheck':['run','typecheck'],
  'npm test':['test','--','--run'],
  'npm run dev':['run','dev','--','--host','127.0.0.1'],
 };
 if(!Object.hasOwn(allowed,name))throw Error('Unsupported command; choose npm install, npm run build, npm run typecheck, npm test or npm run dev');
 // The execution runtime is OWNER-ONLY. Do not expose to ordinary signups.
 // Environment deliberately excludes provider keys, Supabase tokens and user secrets.
 if(name==='npm run dev')throw Error('Interactive preview processes require the managed preview service; use start_preview.');
 const recovery=await recoverNestedProject(dir);
 if(recovery?.moved?.length){
  event(job,'Recovered nested generated files to project root: '+recovery.moved.join(', ')+
    (recovery.skipped.length?'. Existing files kept unchanged: '+recovery.skipped.join(', '):''),'result');
 }
 try{const stat=await lstat(join(dir,'package.json'));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid package.json')}
 catch(e){if(e.code==='ENOENT')throw Error('npm cannot run: package.json is missing from workspace root. Write package.json (not workspace-name/package.json) before running npm.');throw e}
 return await new Promise((resolve,reject)=>{
  let text='',finished=false;
  const child=spawn('npm',allowed[name],{
   cwd:dir,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:dir,TMPDIR:'/tmp',CI:'1',
     LANG:'C.UTF-8',NO_COLOR:'1',npm_config_audit:'false',npm_config_fund:'false'},
   stdio:['ignore','pipe','pipe'],detached:false
  });
  const close=(err,output)=>{if(finished)return;finished=true;clearTimeout(timer);err?reject(err):resolve(output)};
  const limit=name==='npm install'?150000:90000;
  const timer=setTimeout(()=>{child.kill('SIGKILL');close(Error(name+' exceeded '+Math.round(limit/1000)+'s limit'))},limit);
  const output=buf=>{
   text=(text+buf.toString('utf8')).slice(-10000);
   streamOutput(job,text);
  };
  child.stdout.on('data',output);child.stderr.on('data',output);
  child.once('error',e=>close(e));
  child.once('close',code=>code===0?
    close(null,JSON.stringify({exitCode:code,output:text.slice(-7000)})):
    close(Error(name+' failed (exit '+code+'): '+text.slice(-2800))));
 });
}
const SYSTEM_PROMPT=ENGINEERING_PROMPT+'\n\n'+DESIGN_PROMPT;
const str=(description)=>({type:'string',description});
const functions=[
 {type:'function',function:{name:'update_plan',description:'Show the user a live checklist. Call first, then whenever a step changes status.',parameters:{
  type:'object',properties:{steps:{type:'array',items:{type:'object',properties:{title:str('Short step title'),status:{type:'string',enum:['pending','active','done']}},required:['title','status']}}},required:['steps']}}},
 {type:'function',function:{name:'list_files',description:'Return the project tree (recursive). path "" lists the whole project.',parameters:{
  type:'object',properties:{path:str('Folder relative to project root, or "" for root')},required:['path']}}},
 {type:'function',function:{name:'read_file',description:'Read a text file in the project.',parameters:{
  type:'object',properties:{path:str('Path relative to project root, e.g. src/App.tsx')},required:['path']}}},
 {type:'function',function:{name:'write_file',description:'Create or fully overwrite a file with COMPLETE content. Parent folders are created.',parameters:{
  type:'object',properties:{path:str('Path relative to project root'),content:str('Complete file content')},required:['path','content']}}},
 {type:'function',function:{name:'edit_file',description:'Replace one exact, unique snippet in an existing file.',parameters:{
  type:'object',properties:{path:str('Path relative to project root'),find:str('Exact existing text, copied from read_file'),replace:str('Replacement text')},required:['path','find','replace']}}},
 {type:'function',function:{name:'delete_file',description:'Delete a file in the project.',parameters:{
  type:'object',properties:{path:str('Path relative to project root')},required:['path']}}},
 {type:'function',function:{name:'scaffold_app',description:'Create a verified React Native + TypeScript project (react-native-web + Vite preview) in an EMPTY workspace. Use before writing app code when package.json is missing.',parameters:{type:'object',properties:{}}}},
 {type:'function',function:{name:'run_command',description:'Run a standard npm step (install, typecheck, build, test). Always available.',parameters:{
  type:'object',properties:{command:{type:'string',enum:['npm install','npm run typecheck','npm run build','npm test']}},required:['command']}}},
 {type:'function',function:{name:'start_preview',description:'Start the private live preview. Only after npm run build passes.',parameters:{type:'object',properties:{}}}},
 {type:'function',function:{name:'run_shell',description:'Run a shell command in this project\'s isolated Linux sandbox (cwd = project root; Node 22, npm, npx, Python 3, pip, git, curl, build tools). Returns exit code and output. For servers or watchers use start_process instead.',parameters:{
  type:'object',properties:{command:str('Bash command, e.g. "python3 scripts/seed.py" or "npx vitest run"'),timeout_seconds:{type:'number',description:'Max seconds (default 300, max 900)'}},required:['command']}}},
 {type:'function',function:{name:'start_process',description:'Start a long-running process (API server, worker, watcher) in the sandbox under a short name. Returns its first output.',parameters:{
  type:'object',properties:{name:str('Short id, e.g. "api"'),command:str('Command, e.g. "npm run dev:api"')},required:['name','command']}}},
 {type:'function',function:{name:'process_logs',description:'Read the latest output of a started process.',parameters:{type:'object',properties:{name:str('Process name')},required:['name']}}},
 {type:'function',function:{name:'stop_process',description:'Stop a started process.',parameters:{type:'object',properties:{name:str('Process name')},required:['name']}}},
 {type:'function',function:{name:'list_processes',description:'List started processes and whether they are running.',parameters:{type:'object',properties:{}}}},
];
const SHELL_TOOLS=new Set(['run_shell','start_process','process_logs','stop_process','list_processes']);
const BASE_FUNCTIONS=functions.filter(f=>!SHELL_TOOLS.has(f.function.name));
const TOOL_NAMES=new Set(functions.map(f=>f.function.name));
const ALIASES={list:'list_files',ls:'list_files',list_dir:'list_files',read:'read_file',open_file:'read_file',write:'write_file',
 create_file:'write_file',save_file:'write_file',edit:'edit_file',replace:'edit_file',str_replace:'edit_file',delete:'delete_file',
 remove_file:'delete_file',scaffold:'scaffold_app',run:'run_command',shell:'run_shell',bash:'run_shell',exec:'run_shell',terminal:'run_shell',execute_command:'run_shell',preview:'start_preview',plan:'update_plan'};
const pick=(...v)=>v.find(x=>x!==undefined&&x!==null);
function normalizeArgs(args){
 const a={...(args&&typeof args==='object'?args:{})};
 if(a.path===undefined){const alt=pick(a.file_path,a.filepath,a.file,a.filename,a.dir,a.directory,Array.isArray(a.paths)?a.paths[0]:undefined);if(alt!==undefined)a.path=String(alt)}
 if(a.content===undefined){const alt=pick(a.code,a.text,a.contents,a.body);if(typeof alt==='string')a.content=alt}
 if(a.find===undefined){const alt=pick(a.search,a.old,a.old_str,a.old_string,a.old_text);if(typeof alt==='string')a.find=alt}
 if(a.replace===undefined){const alt=pick(a.new,a.new_str,a.new_string,a.new_text,a.replacement);if(typeof alt==='string')a.replace=alt}
 if(a.command===undefined&&typeof a.cmd==='string')a.command=a.cmd;
 if(typeof a.command==='string')a.command=a.command.trim().replace(/\s+/g,' ');
 if(a.steps===undefined&&Array.isArray(a.plan))a.steps=a.plan;
 return a;
}
function parseArgs(raw){
 if(raw&&typeof raw==='object')return normalizeArgs(raw);
 const s=String(raw||'').trim();
 if(!s)return {};
 try{return normalizeArgs(JSON.parse(s))}catch{}
 throw Error('Tool arguments were not valid JSON (the reply was probably cut off). Write smaller files (under 250 lines) or use edit_file for targeted changes.');
}
// Some NVIDIA-hosted models print tool calls as text (<tool_call>{...}</tool_call>,
// fenced JSON, or {"action":"list_files",...}). Recover them into real calls.
export function extractTextToolCalls(content){
 const candidates=[];
 for(const m of content.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g))candidates.push(m[1]);
 for(const m of content.matchAll(/```(?:json|tool_call|tool)?\s*([\[{][\s\S]*?)```/g))candidates.push(m[1]);
 const trimmed=content.trim();
 if(!candidates.length&&/^[\[{][\s\S]*[\]}]$/.test(trimmed))candidates.push(trimmed);
 const calls=[];
 for(const raw of candidates){
  let parsed;try{parsed=JSON.parse(raw)}catch{continue}
  for(const item of (Array.isArray(parsed)?parsed:[parsed])){
   if(!item||typeof item!=='object')continue;
   const fn=item.function&&typeof item.function==='object'?item.function:item;
   let name=String(pick(fn.name,fn.tool,fn.action,typeof fn.function==='string'?fn.function:undefined,'')).trim();
   name=ALIASES[name]||name;
   if(!TOOL_NAMES.has(name))continue;
   let args=pick(fn.arguments,fn.parameters,fn.args,fn.input);
   if(typeof args==='string'){try{args=JSON.parse(args)}catch{args={}}}
   if(!args||typeof args!=='object'){const {name:_n,tool:_t,action:_a,function:_f,...rest}=fn;args=rest}
   calls.push({id:'call_'+randomUUID().replace(/-/g,'').slice(0,12),type:'function',function:{name,arguments:JSON.stringify(normalizeArgs(args))}});
  }
 }
 return calls.slice(0,6);
}
const looksLikeToolJson=s=>/^\s*(?:```(?:json)?\s*)?[\[{][\s\S]{0,400}["'](?:action|tool|function|name|paths?|command)["']\s*:/i.test(s)||/<tool_call>/i.test(s);
const displayAction=(name,args={})=>{
 const path=String(args.path||'').slice(0,100);
 if(name==='list_files')return {kind:'read',phase:'reading',message:path?'Scanning '+path:'Scanning project'};
 if(name==='read_file')return {kind:'read',phase:'reading',message:'Reading '+path};
 if(name==='write_file')return {kind:'write',phase:'writing',message:'Writing '+path};
 if(name==='edit_file')return {kind:'write',phase:'writing',message:'Editing '+path};
 if(name==='delete_file')return {kind:'write',phase:'writing',message:'Deleting '+path};
 if(name==='scaffold_app')return {kind:'write',phase:'writing',message:'Scaffolding React Native project'};
 if(name==='run_command')return {kind:'command',phase:'running',message:String(args.command||'npm command').slice(0,65)};
 if(name==='start_preview')return {kind:'preview',phase:'previewing',message:'Starting live preview'};
 if(name==='update_plan')return {kind:'plan',phase:'planning',message:'Updating plan'};
 if(name==='run_shell')return {kind:'command',phase:'running',message:'$ '+String(args.command||'').slice(0,70)};
 if(name==='start_process')return {kind:'command',phase:'running',message:'Starting '+String(args.name||'process')};
 if(name==='process_logs')return {kind:'read',phase:'reading',message:'Reading '+String(args.name||'process')+' logs'};
 if(name==='stop_process')return {kind:'command',phase:'running',message:'Stopping '+String(args.name||'process')};
 if(name==='list_processes')return {kind:'read',phase:'reading',message:'Checking processes'};
 return {kind:'progress',phase:'thinking',message:'Working with project tools'};
};
async function action(dir,name,arg,job){
 if(name==='update_plan')return setPlan(job,arg.steps);
 if(name==='list_files')return await listFiles(dir,String(arg.path||''));
 if(name==='read_file')return await readText(dir,String(arg.path||''));
 if(name==='write_file'){const r=await writeText(dir,arg.path,arg.content);job.files.add(canonicalPath(dir,arg.path));job.dirty=true;return r}
 if(name==='edit_file'){const r=await editText(dir,arg.path,arg.find,arg.replace);job.files.add(canonicalPath(dir,arg.path));job.dirty=true;return r}
 if(name==='delete_file'){const r=await deleteFile(dir,arg.path);job.files.add(canonicalPath(dir,arg.path));job.dirty=true;return r}
 if(name==='scaffold_app'){const r=await scaffold(dir);job.files.add('package.json');job.dirty=true;return r}
 if(name==='start_preview'){
  await startPreview(dir,job.workspaceId);job.checks.preview='ready';
  return 'Private live preview started; the user can open it with the Preview button in Noethara.';
 }
 if(name==='run_command'){
  const key=arg.command==='npm run typecheck'?'typecheck':arg.command==='npm run build'?'build':arg.command==='npm install'?'install':'test';
  try{const out=await execute(dir,arg.command,job);job.checks[key]='passed';if(key==='build'||key==='typecheck')job.dirty=false;return out}
  catch(e){job.checks[key]='failed';throw e}
 }
 if(name==='run_shell'){
  const command=String(arg.command||'').trim();
  await authorize(job,command);
  const r=await runShell(job.workspaceId,dir,command,{timeoutSec:arg.timeout_seconds,onOutput:t=>streamOutput(job,t)});
  const m=/^npm run (build|typecheck)$|^npm (test)\b|^npm (install|i)\b/.exec(command);
  if(m){const key=m[1]||m[2]||'install';job.checks[key]=r.exitCode===0?'passed':'failed';if(r.exitCode===0&&(key==='build'||key==='typecheck'))job.dirty=false}
  if(r.exitCode!==0&&!/^(?:ls|cat|grep|rg|find|git)\b/.test(command))job.dirty=true;
  return JSON.stringify({exitCode:r.exitCode,timedOut:Boolean(r.timedOut),output:r.output});
 }
 if(name==='start_process'){const command=String(arg.command||'').trim();await authorize(job,command);return await startProcess(job.workspaceId,dir,String(arg.name||''),command)}
 if(name==='process_logs')return await processLogs(job.workspaceId,dir,String(arg.name||''));
 if(name==='stop_process')return await stopProcess(job.workspaceId,dir,String(arg.name||''));
 if(name==='list_processes')return await listProcesses(job.workspaceId,dir);
 throw Error('Unknown tool '+name+'. Available: '+[...TOOL_NAMES].join(', '));
}
async function complete(key,model,messages,tools=functions){
 let maxTokens=Number(process.env.NOETHARA_AGENT_MAX_TOKENS)||16384;
 let lastError;
 for(let attempt=0;attempt<4;attempt++){
  let resp;
  try{
   resp=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{
    method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({model,messages,tools,tool_choice:'auto',temperature:0.2,top_p:0.95,max_tokens:maxTokens,stream:false}),
    signal:AbortSignal.timeout(170000)
   });
  }catch(e){lastError=Error('AI provider unreachable: '+String(e.message||e));await pause(1500*(attempt+1));continue}
  if(resp.ok)return await resp.json();
  const detail=(await resp.text().catch(()=>'')).slice(0,400);
  lastError=Error('AI provider returned HTTP '+resp.status+(detail?': '+detail.slice(0,240):''));
  if(resp.status===400&&/max_tokens|max_completion|context length|too long/i.test(detail)&&maxTokens>4096){maxTokens=Math.floor(maxTokens/2);continue}
  if(![408,409,425,429,500,502,503,504].includes(resp.status))throw lastError;
  await pause(2000*(attempt+1)**2);
 }
 throw lastError;
}
async function generate(job,dir,body){
 const key=process.env.NOETHARA_NVIDIA_API_KEY||process.env.NVIDIA_API_KEY;
 if(!key)throw Error('AWS coding agent is not configured: set NOETHARA_NVIDIA_API_KEY in the managed runtime environment.');
 const model=String(body.model||process.env.NOETHARA_AGENT_MODEL||'nvidia/nemotron-3-super-120b-a12b');
 if(!/^[\w.-]{1,90}\/[\w.:-]{1,100}$/.test(model))throw Error('Unsupported AI model');
 const recovery=await recoverNestedProject(dir).catch(()=>null);
 if(recovery?.moved?.length)event(job,'Recovered nested files to project root: '+recovery.moved.join(', '),'result');
 const origin=body.messages.slice(-10);
 await checkpoint(job,dir,'Before session '+job.id.slice(0,8));
 const snapshot=await projectTree(dir);
 const hasPackage=snapshot.includes('package.json');
 const workspaceNote='\n\n# Workspace snapshot at session start ('+basename(dir)+')\n'+
  (snapshot.length?snapshot.join('\n'):'(empty workspace: call update_plan, then scaffold_app, then npm install)')+
  (hasPackage?'':'\nNo package.json yet.');
 const permission=job.input?.permission||'ask';
 const box=await sandboxStatus().catch(()=>({available:false,reason:'unknown'}));
 const shell=box.available&&permission!=='safe';
 const tools=shell?functions:BASE_FUNCTIONS;
 const terminalNote=shell
  ?'\n\n# Terminal\nrun_shell and start_process run in an isolated Linux sandbox at the project root (Node 22, npm, Python 3, pip, git, build tools). Permission mode: '+permission+
   (permission==='ask'?' — commands that change things wait for the user to approve, so batch work into few purposeful commands.':'.')+
   ' Use start_process for servers and watchers, then process_logs to confirm they are healthy. Never print secrets.'
  :'\n\n# Terminal\nNo shell in this session ('+(permission==='safe'?'Safe mode':box.reason)+'). Use run_command for npm install, typecheck, build and test.';
 const workHistory=[];
 const completedActions=[];
 const started=Date.now();
 let errorsInARow=0,malformed=0,verifyNudges=0,truncations=0;
 job.phase='planning';
 event(job,snapshot.length?'Reading your project and planning the changes':'Empty workspace. Planning a new React Native app','commentary');
 for(let round=0;round<MAX_ROUNDS;round++){
  job.round=round+1;
  if(job.cancelled)throw Error('Generation cancelled');
  if(Date.now()-started-(job._waitedMs||0)>RUN_BUDGET_MS){
   job.status='paused';job.phase='paused';
   job.answer='The session reached its time budget. Saved files remain in the workspace. Tap Continue to pick up from the existing files.';
   event(job,'Session paused safely. Continue without resending the prompt.','paused');
   return;
  }
  const recent=workHistory.slice(-HISTORY_BATCHES).flat();
  const older=completedActions.slice(0,-HISTORY_BATCHES*2).slice(-60);
  const memory=older.length?'\n\n# Earlier verified actions this session (do not assume unlisted work succeeded)\n'+older.join('\n').slice(-4000):'';
  const planNote=job.plan.length?'\n\n# Current plan\n'+job.plan.map(s=>'- ['+s.status+'] '+s.title).join('\n'):'';
  const messages=[{role:'system',content:SYSTEM_PROMPT+workspaceNote+terminalNote+planNote+memory},...origin,...recent];
  job.phase=round===0?'planning':'thinking';
  const payload=await complete(key,model,messages,tools);
  const choice=payload.choices?.[0];
  const msg=choice?.message;
  if(!msg)throw Error('Model did not return a response');
  let content=typeof msg.content==='string'?msg.content.replace(/<think>[\s\S]*?<\/think>/g,'').trim():'';
  let calls=Array.isArray(msg.tool_calls)?msg.tool_calls.filter(c=>c?.function?.name).slice(0,6):[];
  let recovered=false;
  if(!calls.length&&content){
   calls=extractTextToolCalls(content);
   if(calls.length){recovered=true;content=''}
  }
  if(!calls.length){
   if(choice?.finish_reason==='length'&&truncations<3){
    truncations++;
    workHistory.push([{role:'assistant',content:content.slice(0,2000)||'(cut off)'},
     {role:'user',content:'Your reply was cut off by the output limit. Continue with smaller steps: write files under 250 lines or use edit_file.'}]);
    event(job,'Output limit reached; continuing in smaller steps','progress');
    continue;
   }
   if(looksLikeToolJson(content)&&malformed<2){
    malformed++;
    workHistory.push([{role:'assistant',content:content.slice(0,1500)},
     {role:'user',content:'You printed tool instructions as text, so nothing ran. Call the declared tools directly through function calling ('+[...TOOL_NAMES].join(', ')+'). Do not print JSON.'}]);
    event(job,'Correcting a tool-call format issue','progress');
    continue;
   }
   const pkgNow=await lstat(join(dir,'package.json')).then(()=>true,()=>false);
   if(job.dirty&&pkgNow&&verifyNudges<2){
    verifyNudges++;
    workHistory.push([{role:'assistant',content:content.slice(0,1500)||'(done)'},
     {role:'user',content:'Before finishing: files changed since the last passing check. Run "npm run typecheck" and "npm run build" now (npm install first if dependencies changed), fix every error, start_preview, then give the final report.'}]);
    event(job,'Verifying the build before finishing','progress');
    continue;
   }
   job.plan=job.plan.map(s=>s.status==='active'?{...s,status:job.dirty?'pending':'done'}:s);
   job.answer=content||'I finished this session. The activity log lists every confirmed file change and check.';
   job.phase='done';
   return;
  }
  malformed=0;
  if(content)event(job,content.slice(0,420),'commentary');
  const batch=[{role:'assistant',content:content||null,tool_calls:calls.map(c=>({id:c.id||('call_'+randomUUID().slice(0,8)),type:'function',function:{name:c.function.name,arguments:typeof c.function.arguments==='string'?c.function.arguments:JSON.stringify(c.function.arguments||{})}}))}];
  if(recovered)event(job,'Recovered '+calls.length+' tool call'+(calls.length>1?'s':'')+' from text','progress');
  for(const tool of batch[0].tool_calls){
   if(job.cancelled)throw Error('Generation cancelled');
   const name=ALIASES[tool.function.name]||tool.function.name;
   let args={},output='',ok=false,parseError=null;
   try{args=parseArgs(tool.function.arguments)}catch(e){parseError=e}
   const described=displayAction(name,args);
   const ref=tool.id;
   job.phase=described.phase;
   if(name!=='update_plan')event(job,described.message,described.kind,{ref,status:'running',tool:name,path:args.path?String(args.path).slice(0,120):undefined});
   const t0=Date.now();
   try{
    if(parseError)throw parseError;
    job._liveRef=ref;
    output=await action(dir,name,args,job);
    ok=true;errorsInARow=0;
    if(name!=='update_plan')event(job,described.message,'result',{ref,status:'done',tool:name,ms:Date.now()-t0,path:args.path?String(args.path).slice(0,120):undefined});
   }catch(e){
    const reason=String(e.message||e);
    output='Tool error: '+reason;
    errorsInARow++;
    event(job,described.message+' failed: '+reason.slice(0,260),'error',{ref,status:'failed',tool:name,ms:Date.now()-t0});
   }
   if(name!=='update_plan')completedActions.push((ok?'OK ':'FAILED ')+described.message);
   const limit=name==='read_file'?READ_LIMIT+200:14000;
   batch.push({role:'tool',tool_call_id:tool.id,content:String(output).slice(0,limit)});
  }
  workHistory.push(batch);
  if(errorsInARow>=8){
   job.status='paused';job.phase='paused';
   job.answer='Repeated tool failures interrupted this session. Your files are preserved. Tap Continue to diagnose and fix the errors.';
   event(job,'Repeated errors. Continue to troubleshoot instead of looping.','paused');
   return;
  }
 }
 job.status='paused';job.phase='paused';
 job.answer='This session reached its step budget. Your project files are saved. Tap Continue to resume from the current workspace.';
 event(job,'Session paused. Continue to finish the remaining work.','paused');
}
const newJob=(id,workspaceId,input)=>({id,workspaceId,created:Date.now(),status:'running',phase:'starting',answer:'',events:[],
 cancelled:false,error:'',input,plan:[],files:new Set(),checks:{},round:0,dirty:false,checkpoints:[]});
const finish=(job,dir)=>checkpoint(job,dir,'After session '+job.id.slice(0,8)).finally(()=>saveJobNow(job));

function clean(){
 for(const [id,job] of jobs)if(job.status!=='running'&&Date.now()-job.created>24*3600*1000)jobs.delete(id);
}
export async function handleAgentRequest(req,res,url,workspaceId,dir){
 clean();
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts[2]!=='agent')return false;
 if(parts.length===3&&req.method==='POST'){
  const input=await new Promise((ok,no)=>{
   let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>80000){no(Error('Prompt too long'));req.destroy()}});
   req.on('end',()=>{try{ok(JSON.parse(raw))}catch{no(Error('Invalid JSON'))}});
   req.on('error',no);
  });
  if(!Array.isArray(input.messages)||input.messages.length<1||input.messages.length>15||
     input.messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>11000))
    throw Error('Invalid message history');
  const active=[...jobs.values()].filter(j=>j.status==='running').length;
  if(active>=1){deny(res,429,'Coding job already running on this single-owner server');return true}
  const id=randomUUID();
  const permission=['ask','auto','safe'].includes(input.permission)?input.permission:'ask';
  const job=newJob(id,workspaceId,{model:input.model,messages:input.messages,permission});
  jobs.set(id,job);event(job,'Starting the coding agent','progress');
  void generate(job,dir,input).then(()=>{if(job.status==='running'){job.status='completed';job.phase='done';event(job,'Finished','done')}}).finally(()=>finish(job,dir))
    .catch(e=>{job.status='failed';job.phase='failed';job.error=String(e.message||e);event(job,job.error,'error')});
  send(res,202,{jobId:id,status:'running'});return true;
 }
 if(parts.length===3&&req.method==='GET'){
  const list=[...jobs.values()].filter(j=>j.workspaceId===workspaceId).sort((a,b)=>b.created-a.created).slice(0,15)
   .map(j=>({jobId:j.id,status:j.status,phase:j.phase,created:j.created,prompt:String(j.input?.messages?.at(-1)?.content||'').slice(0,140)}));
  send(res,200,{jobs:list});return true;
 }
 if(parts.length===5&&parts[4]==='restore'&&req.method==='POST'){
  const job=getJob(parts[3]);
  if(!job||job.workspaceId!==workspaceId){deny(res,404,'Job not found');return true}
  if(job.status==='running'){deny(res,409,'Stop the session before restoring files');return true}
  const body=await new Promise((ok,no)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>2000)req.destroy()});req.on('end',()=>{try{ok(JSON.parse(raw||'{}'))}catch{no(Error('Invalid JSON'))}});req.on('error',no)});
  const sha=String(body.sha||job.checkpoints[0]?.sha||'');
  const restored=await restoreCheckpoint(job,dir,sha);
  saveJobNow(job);send(res,200,{restored:restored.sha,label:restored.label});return true;
 }
 if(parts.length===4&&req.method==='GET'){
  const job=getJob(parts[3]);
  if(!job||job.workspaceId!==workspaceId){deny(res,404,'Job not found');return true}
  send(res,200,{jobId:job.id,status:job.status,phase:job.phase,answer:job.answer,error:job.error,events:job.events,
   plan:job.plan,files:[...job.files],checks:job.checks,round:job.round,startedAt:job.created,model:job.input?.model||null,
   checkpoints:job.checkpoints,interrupted:Boolean(job.interrupted),pendingApproval:job.pendingApproval||null});
  return true;
 }
 if(parts.length===5&&parts[4]==='continue'&&req.method==='POST'){
  const previous=getJob(parts[3]);
  if(!previous||previous.workspaceId!==workspaceId){deny(res,404,'Job not found');return true}
  if(previous.status==='running'){deny(res,409,'The coding session is already running');return true}
  if([...jobs.values()].some(j=>j.status==='running')){deny(res,429,'Another coding session is running');return true}
  const id=randomUUID();
  const note='Continue the previous coding task from the existing files. Inspect current source and fix unfinished or failed steps. Do not recreate already working files. Previous session status: '+previous.status+'. '+(previous.answer||previous.error||'').slice(0,1100);
  const history=previous.input.messages.slice(-8);
  // A new instruction keeps the prior task in history while explicitly resuming.
  const input={model:previous.input.model,permission:previous.input.permission||'ask',messages:[...history,{role:'user',content:note}].slice(-10)};
  const job=newJob(id,workspaceId,input);job.plan=(previous.plan||[]).map(s=>({...s}));
  jobs.set(id,job);
  event(job,'Continuing from the files already in your workspace.','commentary');
  void generate(job,dir,input).then(()=>{if(job.status==='running'){job.status='completed';job.phase='done';event(job,'Finished','done')}}).finally(()=>finish(job,dir))
   .catch(e=>{job.status='failed';job.phase='failed';job.error=String(e.message||e);event(job,job.error,'error')});
  send(res,202,{jobId:id,status:'running'});return true;
 }
 if(parts.length===5&&parts[4]==='approve'&&req.method==='POST'){
  const job=getJob(parts[3]);
  if(!job||job.workspaceId!==workspaceId){deny(res,404,'Job not found');return true}
  const body=await new Promise((ok,no)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>2000)req.destroy()});req.on('end',()=>{try{ok(JSON.parse(raw||'{}'))}catch{no(Error('Invalid JSON'))}});req.on('error',no)});
  if(!job.pendingApproval||!job._approve){deny(res,409,'Nothing is waiting for approval');return true}
  if(body.allow&&body.always)rememberAllow(STATE_DIR,workspaceId,job.pendingApproval.command);
  job._approve(Boolean(body.allow));send(res,200,{ok:true});return true;
 }
 if(parts.length===5&&parts[4]==='cancel'&&req.method==='POST'){
  const job=getJob(parts[3]);
  if(!job||job.workspaceId!==workspaceId){deny(res,404,'Job not found');return true}
  job.cancelled=true;saveJobNow(job);send(res,200,{cancelled:true});return true;
 }
 deny(res,404,'Unknown coding job endpoint');return true;
}
export { generate as _generate, newJob as _newJob, authorize as _authorize };
