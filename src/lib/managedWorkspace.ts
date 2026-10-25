import { getSession, getGitHubConnection, getGitHubToken } from './noetharaBackend';

const HOST='https://terminal.noethara.cloud';
export type ManagedWorkspace={id:string;name:string;path:string;repo?:string};
export type ManagedEntry={name:string;path:string;type:'dir'|'file'|'other'};
async function api<T>(path:string,method:'GET'|'POST'|'PUT'='GET',
  data?:unknown,needsGitHub=false):Promise<T>{
  const session=await getSession();
  if(!session?.access_token)throw Error('Sign in to access managed workspaces.');
  let token:string|null=null;
  if(needsGitHub){
    if(!await getGitHubConnection())throw Error('Connect GitHub in Settings first.');
    token=getGitHubToken();
    if(!token)throw Error('GitHub authentication has expired. Reconnect GitHub.');
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),path==='/workspaces/clone'?95000:path.includes('/upload')?45000:path.includes('/preview/start')?42000:25000);
  try {
    const result=await fetch(HOST+path,{
      method,
      headers:{
        Authorization:'Bearer '+session.access_token,
        'Content-Type':'application/json',
        ...(token?{'x-github-token':token}:{})
      },
      ...(data!==undefined?{body:JSON.stringify(data)}:{}),
      signal:controller.signal,
    });
    const raw=await result.text();
    let json:any;
    try{json=raw?JSON.parse(raw):{}}catch{
      const kind=result.headers.get('content-type')||'';
      throw Error('Workspace server returned '+result.status+' '+(kind.includes('text/html')?'HTML':'non-JSON')+
        '. Expo is running, but the AWS terminal gateway may still be on the old code. Update the AWS gateway and restart noethara-terminal on EC2.');}
    if(!result.ok){
      if(result.status===404){
        const preview=path.includes('/preview/');
        throw Error(preview?
          'Live preview route unavailable on AWS (404). Deploy the latest NoetharaMobile gateway and restart noethara-terminal on EC2.':
          'Workspace resource not found (404). '+String(json.error||'Check the workspace name and EC2 gateway version.'));
      }
      throw Error(json.error||('Workspace request failed ('+result.status+')'));
    }
    return json as T;
  }finally{clearTimeout(timeout);}
}
const p=(value:string)=>encodeURIComponent(value);
export const managedWorkspace={
  list:()=>api<{workspaces:ManagedWorkspace[]}>('/workspaces'),
  create:(name:string)=>api<{workspace:ManagedWorkspace}>('/workspaces','POST',{name}),
  clone:(repo:string,name?:string)=>api<{workspace:ManagedWorkspace}>('/workspaces/clone','POST',{repo,name},true),
  createGitHub:(name:string)=>api<{workspace:ManagedWorkspace}>('/workspaces/github-create','POST',{name,approved:true},true),
  listFiles:(id:string,path='')=>api<{workspace:string;path:string;entries:ManagedEntry[]}>(
    '/workspaces/'+p(id)+'/files?path='+p(path)),
  readFile:(id:string,path:string)=>api<{path:string;content:string;sha256:string}>(
    '/workspaces/'+p(id)+'/file?path='+p(path)),
  saveFile:(id:string,path:string,content:string,expectedSha256:string)=>api<{saved:boolean;path:string}>(
    '/workspaces/'+p(id)+'/file','PUT',{path,content,expectedSha256}),
  startPreview:(id:string)=>api<{url:string;engine:string;status:string}>(
    '/workspaces/'+p(id)+'/preview/start','POST',{}),
  previewStatus:(id:string)=>api<{status:string;output?:string}>(
    '/workspaces/'+p(id)+'/preview/status'),
  stopPreview:(id:string)=>api<{stopped:boolean}>(
    '/workspaces/'+p(id)+'/preview/stop','POST',{}),
  upload:(id:string,file:{name:string;type:string;data:string})=>
    api<{path:string;name:string;size:number;type:string}>(
      '/workspaces/'+p(id)+'/upload','POST',file),
  startAgent:(id:string,messages:Array<{role:'user'|'assistant';content:string}>,model:string,permission:'ask'|'auto'|'safe'='ask')=>
    api<{jobId:string;status:string}>('/workspaces/'+p(id)+'/agent','POST',{messages,model,permission}),
  agentStatus:(id:string,jobId:string)=>
    api<{jobId:string;status:'running'|'completed'|'failed'|'paused';answer:string;error:string;
      events:Array<{id:number;kind:string;message:string;at:number;ref?:string;
        status?:'running'|'done'|'failed'|'active';tool?:string;path?:string;ms?:number}>;
      phase?:string;plan?:Array<{title:string;status:'pending'|'active'|'done'}>;files?:string[];
      checks?:Partial<Record<'install'|'typecheck'|'build'|'test'|'preview',string>>;startedAt?:number;
      checkpoints?:Array<{sha:string;label:string;at:number}>;interrupted?:boolean;
      pendingApproval?:{ref:string;command:string;reason:string}|null}>(
      '/workspaces/'+p(id)+'/agent/'+p(jobId)),
  continueAgent:(id:string,jobId:string)=>api<{jobId:string;status:string}>(
    '/workspaces/'+p(id)+'/agent/'+p(jobId)+'/continue','POST',{}),
  listAgents:(id:string)=>api<{jobs:Array<{jobId:string;status:string;phase:string;created:number;prompt:string}>}>(
      '/workspaces/'+p(id)+'/agent'),
  restoreAgent:(id:string,jobId:string,sha?:string)=>api<{restored:string;label:string}>(
      '/workspaces/'+p(id)+'/agent/'+p(jobId)+'/restore','POST',sha?{sha}:{}),
  approveAgent:(id:string,jobId:string,allow:boolean,always=false)=>api<{ok:boolean}>(
      '/workspaces/'+p(id)+'/agent/'+p(jobId)+'/approve','POST',{allow,always}),
  cancelAgent:(id:string,jobId:string)=>api<{cancelled:boolean}>(
      '/workspaces/'+p(id)+'/agent/'+p(jobId)+'/cancel','POST',{}),
  status:(id:string)=>api<{workspace:string;changes:string}>('/workspaces/'+p(id)+'/git-status'),
  review:(id:string)=>api<{status:string;diff:string;staged:string}>('/workspaces/'+p(id)+'/git-review'),
  push:(id:string,message:string)=>api<{published:boolean;repo:string;branch:string;files:string[]}>(
    '/workspaces/'+p(id)+'/git-push','POST',{approved:true,message},true),
};
