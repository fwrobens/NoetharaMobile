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
  const timeout=setTimeout(()=>controller.abort(),path==='/workspaces/clone'?95000:15000);
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
    try{json=raw?JSON.parse(raw):{}}catch{throw Error('Unexpected workspace gateway response');}
    if(!result.ok)throw Error(json.error||('Workspace request failed ('+result.status+')'));
    return json as T;
  }finally{clearTimeout(timeout);}
}
const p=(value:string)=>encodeURIComponent(value);
export const managedWorkspace={
  list:()=>api<{workspaces:ManagedWorkspace[]}>('/workspaces'),
  create:(name:string)=>api<{workspace:ManagedWorkspace}>('/workspaces','POST',{name}),
  clone:(repo:string,name?:string)=>api<{workspace:ManagedWorkspace}>('/workspaces/clone','POST',{repo,name},true),
  listFiles:(id:string,path='')=>api<{workspace:string;path:string;entries:ManagedEntry[]}>(
    '/workspaces/'+p(id)+'/files?path='+p(path)),
  readFile:(id:string,path:string)=>api<{path:string;content:string;sha256:string}>(
    '/workspaces/'+p(id)+'/file?path='+p(path)),
  saveFile:(id:string,path:string,content:string,expectedSha256:string)=>api<{saved:boolean;path:string}>(
    '/workspaces/'+p(id)+'/file','PUT',{path,content,expectedSha256}),
  status:(id:string)=>api<{workspace:string;changes:string}>('/workspaces/'+p(id)+'/git-status'),
  review:(id:string)=>api<{status:string;diff:string;staged:string}>('/workspaces/'+p(id)+'/git-review'),
  push:(id:string,message:string)=>api<{published:boolean;repo:string;branch:string;files:string[]}>(
    '/workspaces/'+p(id)+'/git-push','POST',{approved:true,message},true),
};
