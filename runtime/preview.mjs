// Private owner-only Vite previews. A short-lived browser capability grants
// read-only access to ONE project's preview through the existing Cloudflare Tunnel.
// Never add user-supplied domains, ports or filesystem paths to this proxy.
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import WebSocket from 'ws';
const WebSocketServer = WebSocket.WebSocketServer || WebSocket.Server;
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const previews=new Map();
const maxActive=2;
const send=(res,status,body)=>{
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify(body));
};
function token(){return randomBytes(25).toString('hex')}
function isValidId(id){return /^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(id)}
export async function startPreview(dir,id){
 if(!isValidId(id))throw Error('Invalid preview project');
 const old=previews.get(id);
 if(old?.child && old.child.exitCode===null)return old;
 const running=[...previews.values()].filter(p=>p.child.exitCode===null).length;
 if(running>=maxActive)throw Error('Two previews are already running. Close another before starting.');
 const packageFile=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));
 const script=String(packageFile?.scripts?.dev||'');
 // Vite is the supported preview engine, not Expo Metro or an arbitrary dev command.
 if(!/^(?:vite(?:\s|$)|npx vite(?:\s|$))/.test(script))
   throw Error('Preview requires a Vite project with a package.json script: "dev": "vite". Expo bundler URLs are not website previews.');
 const port=old?.port||5200+Array.from(previews.keys()).length%70;
 const secret=token();
 const child=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort','--base','/preview/'+id+'/'],{
  cwd:dir,stdio:['ignore','pipe','pipe'],
  env:{HOME:dir,PATH:process.env.PATH||'/usr/bin:/bin',NODE_ENV:'development',
    VITE_HMR_HOST:'terminal.noethara.cloud',NO_COLOR:'1'},
 });
 const item={id,port,child,secret,created:Date.now(),output:''};
 previews.set(id,item);
 const collect=b=>{item.output=(item.output+b.toString('utf8')).slice(-4500)};
 child.stdout.on('data',collect);child.stderr.on('data',collect);
 child.on('error',e=>{item.output='Preview error: '+e.message});
 return item;
}
export async function handlePreviewManagement(req,res,url,id,dir){
 // /workspaces/:workspaceId/preview/:action — the fifth URL segment is the action.
 const segments=url.pathname.split('/').filter(Boolean);
 const action=segments[3];
 if(req.method==='POST'&&action==='start'){
  const preview=await startPreview(dir,id);
  const publicUrl='https://terminal.noethara.cloud/preview/'+encodeURIComponent(id)+'/?ticket='+preview.secret;
  send(res,200,{url:publicUrl,engine:'vite',status:'starting',message:'Vite development preview on your managed Linux workspace'});
  return true;
 }
 if(req.method==='GET'&&action==='status'){
  const preview=previews.get(id);
  send(res,200,preview?{status:preview.child.exitCode===null?'running':'stopped',output:preview.output,engine:'vite'}:{status:'stopped'});
  return true;
 }
 if(req.method==='POST'&&action==='stop'){
  const preview=previews.get(id);
  if(preview?.child?.exitCode===null)preview.child.kill('SIGTERM');
  previews.delete(id);send(res,200,{stopped:true});return true;
 }
 return false;
}
export async function servePreview(req,res,url){
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts[0]!=='preview')return false;
 const id=parts[1];
 const preview=previews.get(id);
 if(!isValidId(id)||!preview||preview.child.exitCode!==null){
  res.writeHead(404,{'content-type':'text/plain','cache-control':'no-store'});
  res.end('Preview unavailable. Start the Vite preview from Noethara.');return true;
 }
 const cookieName='nprev_'+id;
 const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim());
 const trusted=cookie.includes(cookieName+'='+preview.secret);
 const presented=url.searchParams.get('ticket');
 if(presented===preview.secret){
  url.searchParams.delete('ticket');
  res.writeHead(302,{'location':url.pathname+(url.search||''),'set-cookie':
    cookieName+'='+preview.secret+'; HttpOnly; Secure; SameSite=Strict; Path=/preview/'+id+'/',
    'cache-control':'no-store'});
  res.end();return true;
 }
 if(!trusted){
  res.writeHead(403,{'content-type':'text/plain','cache-control':'no-store'});
  res.end('Preview authentication required');return true;
 }
 const upstream=httpRequest({hostname:'127.0.0.1',port:preview.port,
  method:req.method,path:url.pathname+(url.search||''),headers:{host:'127.0.0.1:'+preview.port}},up=>{
    const headers={...up.headers,'cache-control':'no-store'};
    delete headers['set-cookie'];delete headers['access-control-allow-origin'];
    res.writeHead(up.statusCode||502,headers);up.pipe(res);
  });
 upstream.on('error',()=>{
  if(!res.headersSent)res.writeHead(502,{'content-type':'text/plain'});
  res.end('Preview is starting or no longer running.');
 });
 req.pipe(upstream);
 return true;
}

const previewSockets=new WebSocketServer({noServer:true});
export function handlePreviewUpgrade(req,socket,head){
 const url=new URL(req.url||'/', 'http://localhost');
 const fragments=url.pathname.split('/').filter(Boolean);
 const id=fragments[1];
 const preview=previews.get(id);
 if(fragments[0]!=='preview'||!isValidId(id)||!preview||preview.child.exitCode!==null){
   socket.destroy();return;
 }
 const authorized=String(req.headers.cookie||'').split(';')
   .map(value=>value.trim()).includes('nprev_'+id+'='+preview.secret);
 if(!authorized){socket.destroy();return}
 previewSockets.handleUpgrade(req,socket,head,client=>{
   const upstream=new WebSocket('ws://127.0.0.1:'+preview.port+url.pathname+url.search,{
     headers:{host:'127.0.0.1:'+preview.port}
   });
   client.on('message',(data,isBinary)=>{
     if(upstream.readyState===WebSocket.OPEN)upstream.send(data,{binary:isBinary});
   });
   upstream.on('message',(data,isBinary)=>{
     if(client.readyState===WebSocket.OPEN)client.send(data,{binary:isBinary});
   });
   client.on('close',()=>upstream.close());
   upstream.on('close',()=>client.close());
   client.on('error',()=>upstream.close());
   upstream.on('error',()=>client.close());
 });
}
