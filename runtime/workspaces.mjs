// Owner-scoped managed workspaces. This is intentionally SINGLE OWNER.
// Do not reuse this host-path implementation for arbitrary signups: provide
// a separately isolated container/VM per user before expanding availability.
import { mkdir, readdir, readFile, writeFile, lstat, realpath, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, relative, sep, basename } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(process.env.NOETHARA_WORKSPACE_ROOT || join(homedir(), 'noethara-workspaces'));
const NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/;
const REPO = /^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/;
const SAFE_SEGMENT = /^(?!\.{1,2}$)[\w.@+\- ]{1,150}$/;
const FORBIDDEN = /^(?:\.git|\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?|node_modules|\.next|dist|build|\.expo|\.DS_Store)$/i;
const MAX_FILE = 128 * 1024;
const MAX_REPOS = 12;
const reply = (res,status,payload) => {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(payload));
};
const fail = (res,status,error)=> reply(res,status,{error});
async function body(req){
  let data='';
  for await(const chunk of req){
    data+=chunk.toString('utf8');
    if(data.length>140000)throw Error('Request too large');
  }
  try{return JSON.parse(data||'{}');}catch{throw Error('Invalid JSON');}
}
async function root(){
  await mkdir(ROOT,{recursive:true,mode:0o700});
  const st=await lstat(ROOT);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('Unsafe workspace root');
}
function name(value){
  if(typeof value!=='string'||!NAME.test(value)) throw Error('Workspace name must use letters, numbers, hyphens or underscores.');
  return value;
}
export async function workspaceDirectory(value){
  await root();
  return workspace(value);
}
async function workspace(value){
  const n=name(value);
  const dir=join(ROOT,n);
  const s=await lstat(dir);
  if(!s.isDirectory()||s.isSymbolicLink())throw Error('Workspace is not a directory');
  return dir;
}
async function checkedFile(workspaceRoot,path,allowMissing=false){
  if(typeof path!=='string'||path.length>450)throw Error('Invalid path');
  const parts=path.split('/').filter(Boolean);
  if(parts.length>12||parts.some(part=>!SAFE_SEGMENT.test(part)||FORBIDDEN.test(part)))
    throw Error('This path is not available for workspace tools');
  const output=resolve(workspaceRoot,...parts);
  if(output!==workspaceRoot&&!output.startsWith(workspaceRoot+sep))
    throw Error('Path escapes workspace');
  // Check every existing path component so symlinks cannot bypass root.
  let node=workspaceRoot;
  for(let i=0;i<parts.length;i++){
    node=join(node,parts[i]);
    try {
      const st=await lstat(node);
      if(st.isSymbolicLink())throw Error('Symlink paths are not permitted');
      if(i<parts.length-1&&!st.isDirectory())throw Error('Invalid directory');
    }catch(e){
      if(allowMissing&&e?.code==='ENOENT'&&i===parts.length-1)break;
      throw e;
    }
  }
  return output;
}
async function runGit(args,{cwd,env={},timeout=70000}={}){
  return await new Promise((yes,no)=>{
    const child=spawn('git',args,{
      cwd,env:{...process.env,...env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'},
      stdio:['ignore','pipe','pipe']
    });
    let stdout='',stderr='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
    child.stdout.on('data',b=>stdout=(stdout+b.toString()).slice(-18000));
    child.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-2000));
    child.once('error',e=>{clearTimeout(timer);no(e)});
    child.once('close',code=>{
      clearTimeout(timer);
      code===0?yes(stdout):no(Error('Git failed: '+stderr.slice(-350)));
    });
  });
}
const PRIVATE_HEADERS=token=>({
  GIT_CONFIG_COUNT:'1',
  GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',
  GIT_CONFIG_VALUE_0:'Authorization: Basic '+Buffer.from('x-access-token:'+token).toString('base64'),
});
async function clone(repo,id,token){
  if(!REPO.test(repo)||repo.includes('..'))throw Error('Invalid GitHub repository');
  if(!NAME.test(id))throw Error('Invalid workspace name');
  if(typeof token!=='string'||token.length<15||token.length>2048)throw Error('Connect GitHub to clone private repositories');
  const check=await fetch('https://api.github.com/repos/'+repo,{
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','user-agent':'NoetharaMobile'},
    signal:AbortSignal.timeout(8000)
  });
  if(!check.ok)throw Error('GitHub access denied or repository not found (HTTP '+check.status+')');
  const meta=await check.json();
  if((Number(meta.size)||0)>150000)throw Error('Repository exceeds the 150 MB workspace import limit');
  const url='https://github.com/'+repo+'.git';
  const target=join(ROOT,id);
  // Reserve destination atomically. Never import into another workspace.
  await mkdir(target,{mode:0o700});
  try {
    await runGit(['clone','--depth','1','--single-branch','--no-tags',url,'.'],{
      cwd:target,env:PRIVATE_HEADERS(token),timeout:85000
    });
  }catch(e){await rm(target,{recursive:true,force:true});throw e}
  return {id,name:id,repo,path:target};
}
export async function handleWorkspaceRequest(req,res,url,userId){
  if(!userId){fail(res,401,'Not authorized');return}
  try {
    await root();
    const method=req.method||'GET';
    const fragments=url.pathname.split('/').filter(Boolean);
    if(fragments[0]!=='workspaces')return false;
    if(fragments.length===1){
      if(method==='GET'){
        const names=(await readdir(ROOT,{withFileTypes:true})).filter(e=>e.isDirectory()&&NAME.test(e.name)).slice(0,MAX_REPOS);
        reply(res,200,{workspaces:names.map(e=>({id:e.name,name:e.name,path:join(ROOT,e.name)}))});return true;
      }
      if(method==='POST'){
        const payload=await body(req);
        const id=name(payload.name);
        const dirs=(await readdir(ROOT,{withFileTypes:true})).filter(e=>e.isDirectory());
        if(dirs.length>=MAX_REPOS){fail(res,409,'Workspace limit reached');return true}
        await mkdir(join(ROOT,id),{mode:0o700});
        reply(res,201,{workspace:{id,name:id,path:join(ROOT,id)}});return true;
      }
    }
    if(fragments.length===2 && fragments[1]==='clone' && method==='POST'){
      const payload=await body(req);
      const token=req.headers['x-github-token'];
      const id=name(payload.name||String(payload.repo||'').split('/')[1]);
      const dirs=(await readdir(ROOT,{withFileTypes:true})).filter(e=>e.isDirectory());
      if(dirs.length>=MAX_REPOS){fail(res,409,'Workspace limit reached');return true}
      const result=await clone(payload.repo,id,token);
      reply(res,201,{workspace:result});return true;
    }
    if(fragments.length>=2){
      const dir=await workspace(fragments[1]);
      if(fragments.length===3 && fragments[2]==='files' && method==='GET'){
        const path=url.searchParams.get('path')||'';
        const current=await checkedFile(dir,path);
        const st=await lstat(current);
        if(!st.isDirectory()){fail(res,400,'Not a folder');return true}
        const entries=await readdir(current,{withFileTypes:true});
        reply(res,200,{workspace:fragments[1],path,entries:entries
          .filter(e=>!FORBIDDEN.test(e.name)&&!e.isSymbolicLink())
          .slice(0,200).map(e=>({name:e.name,path:[path,e.name].filter(Boolean).join('/'),
            type:e.isDirectory()?'dir':e.isFile()?'file':'other'}))});return true;
      }
      if(fragments.length===3 && fragments[2]==='file' && method==='GET'){
        const path=url.searchParams.get('path')||'';
        if(!path){fail(res,400,'Select a file');return true}
        const target=await checkedFile(dir,path);
        const stat=await lstat(target);
        if(!stat.isFile()||stat.size>MAX_FILE){fail(res,413,'Only text files up to 128 KB supported');return true}
        const bytes=await readFile(target);
        if(bytes.includes(0)){fail(res,415,'Binary files are not available');return true}
        const sha256=await import('node:crypto').then(c=>c.createHash('sha256').update(bytes).digest('hex'));
        reply(res,200,{path,content:bytes.toString('utf8'),sha256});return true;
      }
      if(fragments.length===3 && fragments[2]==='file' && method==='PUT'){
        const payload=await body(req);
        if(typeof payload.content!=='string'||Buffer.byteLength(payload.content)>MAX_FILE)
          throw Error('Invalid or oversized file contents');
        const target=await checkedFile(dir,payload.path,true);
        // Require an explicit known hash to prevent overwriting unnoticed edits.
        let previous=null;
        try{previous=await readFile(target,'utf8')}catch(e){if(e?.code!=='ENOENT')throw e}
        const digest=await import('node:crypto').then(c=>c.createHash('sha256').update(previous??'').digest('hex'));
        if(payload.expectedSha256!==digest)throw Error('File changed since it was reviewed. Reload before saving.');
        await writeFile(target,payload.content,{flag:'w',mode:0o600});
        reply(res,200,{saved:true,path:payload.path});return true;
      }
      if(fragments.length===3 && fragments[2]==='git-status' && method==='GET'){
        const changes=await runGit(['status','--porcelain','--untracked-files=normal'],{cwd:dir,timeout:7000});
        reply(res,200,{workspace:fragments[1],changes:changes.slice(0,10000)});return true;
      }
    }
    fail(res,404,'Unknown workspace operation');
    return true;
  }catch(e){
    const msg=e instanceof Error?e.message:'Workspace request failed';
    const code=e?.code==='EEXIST'?409:e?.code==='ENOENT'?404:400;
    fail(res,code,msg.slice(0,230));return true;
  }
}
