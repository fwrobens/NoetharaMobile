// Isolated per-workspace command sandbox (Docker). Every command runs inside a
// locked-down container that only sees /workspace (the project) and a shared cache.
// No host secrets, no capabilities, CPU/memory/pid limits. Required before any
// multi-user rollout; the host never executes model-chosen shell text.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const IMAGE=process.env.NOETHARA_SANDBOX_IMAGE||'noethara/devbox:latest';
const FALLBACK_IMAGE='node:22-bookworm';
let dockerState=null;
const run=(args,{env,input,timeoutMs=20000}={})=>new Promise(done=>{
 const child=spawn('docker',args,{env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'/tmp',...env},stdio:['pipe','pipe','pipe']});
 let out='';const t=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
 child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{out+=d});
 child.on('error',e=>{clearTimeout(t);done({code:127,out:String(e.message)})});
 child.on('close',code=>{clearTimeout(t);done({code,out:out.trim()})});
 if(input)child.stdin.end(input);else child.stdin.end();
});
export async function sandboxStatus(){
 if(dockerState&&Date.now()-dockerState.at<60000)return dockerState;
 const v=await run(['version','--format','{{.Server.Version}}'],{timeoutMs:6000});
 let image=null;
 if(v.code===0){
  if((await run(['image','inspect',IMAGE],{timeoutMs:6000})).code===0)image=IMAGE;
  else if((await run(['image','inspect',FALLBACK_IMAGE],{timeoutMs:6000})).code===0)image=FALLBACK_IMAGE;
 }
 dockerState={at:Date.now(),available:v.code===0&&Boolean(image),image,reason:v.code!==0?'Docker is not available on this server':!image?'Sandbox image missing: run infra/aws/update-agent.sh':''};
 return dockerState;
}
const containerName=id=>'nws-'+String(id).toLowerCase().replace(/[^a-z0-9_-]/g,'-').slice(0,48);
async function ensureContainer(workspaceId,dir){
 const status=await sandboxStatus();
 if(!status.available)throw Error('Isolated sandbox unavailable: '+status.reason+'. Use run_command for npm steps.');
 const name=containerName(workspaceId);
 const state=await run(['inspect','-f','{{.State.Running}}',name],{timeoutMs:6000});
 if(state.code===0&&state.out==='true')return name;
 await run(['rm','-f',name],{timeoutMs:10000});
 const r=await run(['run','-d','--name',name,'--hostname','noethara','--user','1000:1000',
  '--memory','2g','--memory-swap','2g','--cpus','2','--pids-limit','512',
  '--cap-drop','ALL','--security-opt','no-new-privileges','--init',
  '--tmpfs','/tmp:rw,exec,size=1g','-e','HOME=/home/node','-e','CI=1','-e','PIP_BREAK_SYSTEM_PACKAGES=1',
  '-v',dir+':/workspace','-v','noethara-cache:/home/node','-w','/workspace',
  status.image,'sleep','infinity'],{timeoutMs:60000});
 if(r.code!==0)throw Error('Could not start sandbox: '+r.out.slice(0,300));
 return name;
}
// --- permissions -----------------------------------------------------------
const READ_ONLY=/^(?:ls|pwd|cat|head|tail|wc|grep|rg|find|tree|echo|which|whoami|env|date|du|df|stat|file|diff|node\s+(?:-v|--version)|npm\s+(?:-v|--version|ls|outdated|view|run\s+(?:typecheck|lint|test|build))|npx\s+tsc(?:\s+--noEmit)?|python3?\s+(?:-V|--version)|pip3?\s+(?:list|show|--version)|git\s+(?:status|log|diff|show|branch)|tsc\b)(?:\s|$)/;
const BLOCKED=[/\brm\s+-[a-z]*r[a-z]*f?\s+\/(?:\s|$|\*)/i,/:\(\)\s*\{\s*:\|:&\s*\};:/,/\bmkfs\b/,/\bdd\s+if=.*of=\/dev\//,/\b(?:shutdown|reboot|halt)\b/,/\/var\/run\/docker\.sock/];
export function classifyCommand(command){
 const c=String(command||'').trim();
 if(!c)return {decision:'deny',reason:'Empty command'};
 if(c.length>2000)return {decision:'deny',reason:'Command too long'};
 if(BLOCKED.some(r=>r.test(c)))return {decision:'deny',reason:'Blocked: destructive system command'};
 const simple=!/[;&|`$><]/.test(c);
 if(simple&&READ_ONLY.test(c))return {decision:'allow',reason:'Read-only command'};
 return {decision:'ask',reason:''};
}
const permDir=stateDir=>join(stateDir,'permissions');
const prefixOf=c=>String(c).trim().split(/\s+/).slice(0,2).join(' ');
export function loadAllowlist(stateDir,workspaceId){
 try{return new Set(JSON.parse(readFileSync(join(permDir(stateDir),workspaceId+'.json'),'utf8')))}catch{return new Set()}
}
export function rememberAllow(stateDir,workspaceId,command){
 const set=loadAllowlist(stateDir,workspaceId);set.add(prefixOf(command));
 try{mkdirSync(permDir(stateDir),{recursive:true,mode:0o700});writeFileSync(join(permDir(stateDir),workspaceId+'.json'),JSON.stringify([...set].slice(-100)),{mode:0o600})}catch{}
}
export function isRemembered(stateDir,workspaceId,command){
 const c=String(command).trim();
 if(/[;&|`$><]/.test(c))return false;
 return loadAllowlist(stateDir,workspaceId).has(prefixOf(c));
}
// --- execution -------------------------------------------------------------
export async function runShell(workspaceId,dir,command,{timeoutSec=300,onOutput}={}){
 const name=await ensureContainer(workspaceId,dir);
 const limit=Math.max(5,Math.min(900,Number(timeoutSec)||300));
 return await new Promise((resolve)=>{
  const child=spawn('docker',['exec','-e','NOETHARA_CMD='+command,'-e','NOETHARA_LIMIT='+limit,name,
   'bash','-c','timeout -s KILL "$NOETHARA_LIMIT" bash -lc "$NOETHARA_CMD"'],
   {env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'/tmp'},stdio:['ignore','pipe','pipe']});
  let text='';
  const guard=setTimeout(()=>child.kill('SIGKILL'),(limit+15)*1000);
  const take=b=>{text=(text+b.toString('utf8')).slice(-16000);onOutput?.(text)};
  child.stdout.on('data',take);child.stderr.on('data',take);
  child.on('error',e=>{clearTimeout(guard);resolve({exitCode:127,output:String(e.message)})});
  child.on('close',code=>{clearTimeout(guard);resolve({exitCode:code===137?124:code,output:text.slice(-9000),timedOut:code===137})});
 });
}
const validName=n=>/^[a-z0-9][a-z0-9-]{0,29}$/.test(String(n||''));
export async function startProcess(workspaceId,dir,procName,command){
 if(!validName(procName))throw Error('Process name must be lowercase letters, digits or dashes');
 const name=await ensureContainer(workspaceId,dir);
 const r=await run(['exec','-e','NOETHARA_CMD='+command,'-e','NOETHARA_NAME='+procName,name,'bash','-c',
  'mkdir -p /tmp/noethara; if [ -f /tmp/noethara/$NOETHARA_NAME.pid ] && kill -0 $(cat /tmp/noethara/$NOETHARA_NAME.pid) 2>/dev/null; then kill -TERM -- -$(cat /tmp/noethara/$NOETHARA_NAME.pid) 2>/dev/null; sleep 1; fi; '+
  'setsid bash -lc "$NOETHARA_CMD" > /tmp/noethara/$NOETHARA_NAME.log 2>&1 < /dev/null & echo $! > /tmp/noethara/$NOETHARA_NAME.pid; sleep 3; '+
  'if kill -0 $(cat /tmp/noethara/$NOETHARA_NAME.pid) 2>/dev/null; then echo RUNNING; else echo EXITED; fi; tail -c 2500 /tmp/noethara/$NOETHARA_NAME.log'],{timeoutMs:30000});
 return r.out.slice(0,3000);
}
export async function processLogs(workspaceId,dir,procName){
 if(!validName(procName))throw Error('Invalid process name');
 const name=await ensureContainer(workspaceId,dir);
 const r=await run(['exec','-e','NOETHARA_NAME='+procName,name,'bash','-c',
  'f=/tmp/noethara/$NOETHARA_NAME; [ -f $f.log ] || { echo "No process named $NOETHARA_NAME"; exit 0; }; if kill -0 $(cat $f.pid) 2>/dev/null; then echo "[running]"; else echo "[exited]"; fi; tail -c 6000 $f.log']);
 return r.out;
}
export async function stopProcess(workspaceId,dir,procName){
 if(!validName(procName))throw Error('Invalid process name');
 const name=await ensureContainer(workspaceId,dir);
 const r=await run(['exec','-e','NOETHARA_NAME='+procName,name,'bash','-c',
  'f=/tmp/noethara/$NOETHARA_NAME.pid; [ -f $f ] || { echo "No process named $NOETHARA_NAME"; exit 0; }; kill -TERM -- -$(cat $f) 2>/dev/null || kill $(cat $f) 2>/dev/null; rm -f $f; echo stopped']);
 return r.out;
}
export async function listProcesses(workspaceId,dir){
 const name=await ensureContainer(workspaceId,dir);
 const r=await run(['exec',name,'bash','-c','cd /tmp/noethara 2>/dev/null || { echo none; exit 0; }; for p in *.pid; do [ -f "$p" ] || continue; n=${p%.pid}; if kill -0 $(cat $p) 2>/dev/null; then echo "$n running"; else echo "$n exited"; fi; done']);
 return r.out||'none';
}
