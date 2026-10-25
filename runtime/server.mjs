// NoetharaMobile managed terminal gateway.
// Private loopback origin behind a Cloudflare Tunnel, not a public host shell API.
// Supabase user authorization is required for EVERY WebSocket session.
// Single-owner mode only until per-user isolated containers are implemented.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const wsPackage=createRequire(import.meta.url)('ws');
const WebSocket=wsPackage.WebSocket || wsPackage;
const WebSocketServer=wsPackage.WebSocketServer || wsPackage.Server;
if(typeof WebSocketServer!=='function')throw Error('Incompatible ws runtime; install the dependencies in runtime/package.json.');
import { handleWorkspaceRequest, workspaceDirectory } from './workspaces.mjs';
import { handleAgentRequest } from './agent.mjs';
import { servePreview, handlePreviewManagement, handlePreviewUpgrade } from './preview.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || '8789');
const SUPABASE_URL = (process.env.NOETHARA_SUPABASE_URL || '').replace(/\/$/,'');
const PUBLISHABLE_KEY = process.env.NOETHARA_SUPABASE_PUBLISHABLE_KEY || '';
const ALLOWED_USERS = new Set((process.env.NOETHARA_ALLOWED_USER_IDS || '')
  .split(',').map(s=>s.trim()).filter(s=>/^[a-f0-9-]{36}$/i.test(s)));
const WORKSPACE = process.env.NOETHARA_WORKSPACE || process.cwd();
const AGENTS = new Set(['opencode','codex','claude']);
// Global npm installs done as ubuntu use a per-user prefix. PM2 can have
// an older PATH than the interactive SSH shell, so normalize it here.
const EXEC_PATH = [join(homedir(),'.npm-global','bin'),join(homedir(),'.local','bin'),
  process.env.PATH||'/usr/local/bin:/usr/bin:/bin'].join(':');
const CLI_NAMES = {opencode:'OpenCode',codex:'Codex',claude:'Claude Code'};
function isCliInstalled(name){
  if(!AGENTS.has(name))return false;
  const result=spawnSync('which',[name],{
    env:{...process.env,PATH:EXEC_PATH},encoding:'utf8',timeout:1500,
  });
  return result.status===0;
}
// Fail closed. Never turn a valid self-signup account into full host shell access.
if (!SUPABASE_URL.startsWith('https://') || !PUBLISHABLE_KEY || ALLOWED_USERS.size!==1) {
  console.error('Missing NOETHARA_SUPABASE_URL, NOETHARA_SUPABASE_PUBLISHABLE_KEY, or exactly one NOETHARA_ALLOWED_USER_IDS value. Refusing to start.');
  process.exit(1);
}
const server = createServer(async(req,res)=>{
  const url=new URL(req.url||'/', 'http://localhost');
  res.setHeader('cache-control','no-store');
  if(url.pathname.startsWith('/preview/')){
    await servePreview(req,res,url);return;
  }
  if(url.pathname==='/workspaces' || url.pathname.startsWith('/workspaces/')){
    const bearer=req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    const userId=await authenticate(bearer);
    if(url.pathname.match(/^\/workspaces\/[\w-]+\/agent(?:\/|$)/)){
      if(!userId){
        res.writeHead(401,{'content-type':'application/json'});
        res.end(JSON.stringify({error:'Not authorized'}));return;
      }
      try{
        const workspaceId=url.pathname.split('/')[2];
        const dir=await workspaceDirectory(workspaceId);
        await handleAgentRequest(req,res,url,workspaceId,dir);
      }catch(e){
        res.writeHead(400,{'content-type':'application/json'});
        res.end(JSON.stringify({error:String(e?.message||e).slice(0,250)}));
      }
      return;
    }
    if(url.pathname.match(/^\/workspaces\/[\w-]+\/preview(?:\/|$)/)){
      if(!userId){res.writeHead(401,{'content-type':'application/json'});
        res.end(JSON.stringify({error:'Not authorized'}));return;}
      try{
        const id=url.pathname.split('/')[2];
        const dir=await workspaceDirectory(id);
        if(!await handlePreviewManagement(req,res,url,id,dir)){
          res.writeHead(404,{'content-type':'application/json'});
          res.end(JSON.stringify({error:'Unknown preview endpoint'}));
        }
      }catch(e){res.writeHead(400,{'content-type':'application/json'});
        res.end(JSON.stringify({error:String(e.message||e).slice(0,240)}));}
      return;
    }
    await handleWorkspaceRequest(req,res,url,userId);
    return;
  }
  if(req.method==='GET' && url.pathname==='/status'){
    const bearer=req.headers.authorization?.startsWith('Bearer ') ?
      req.headers.authorization.slice(7) : '';
    const userId=await authenticate(bearer);
    res.writeHead(userId?200:401,{'content-type':'application/json'});
    res.end(JSON.stringify(userId?{status:'awake',gatewayVersion:2,workspaceAPI:true,previewAPI:true,awsAgentConfigured:Boolean(process.env.NOETHARA_NVIDIA_API_KEY||process.env.NVIDIA_API_KEY),workspace:'managed',agents:[...AGENTS],
      cliInstalled:Object.fromEntries([...AGENTS].map(name=>[name,isCliInstalled(name)]))}:
      {error:'Not authorized'}));
    return;
  }
  res.writeHead(404,{'content-type':'text/plain'});
  res.end('Not found');
});
const wss = new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false,clientTracking:true});
server.on('upgrade',(req,socket,head)=>{
 const path=new URL(req.url||'/', 'http://localhost').pathname;
 if(path.startsWith('/preview/')){handlePreviewUpgrade(req,socket,head);return;}
 if(path!=='/'&&path!=='/terminal'){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
// Run a fixed binary with argument arrays (never a client-built shell string).
const runQuiet=(cmd,args)=>new Promise(done=>{
  const child=spawn(cmd,args,{env:{...process.env,PATH:EXEC_PATH},stdio:['ignore','pipe','ignore']});
  let out='';child.stdout.on('data',d=>{out+=d;});
  child.on('error',()=>done(''));child.on('close',()=>done(out));
});
// Let the tmux window follow the most recent client size instead of a fixed
// manual size, and hide the host status bar so the phone sees only the agent UI.
async function tmuxConfigure(name){
  const t=args=>runQuiet('tmux',['-L','noethara',...args]);
  await t(['set-option','-g','status','off']);
  await t(['set-option','-g','window-size','latest']);
  await t(['set-window-option','-g','window-size','latest']);
  await t(['set-window-option','-g','aggressive-resize','on']);
  if(name)await t(['set-window-option','-t',name,'-u','window-size']);
}
// Resize the client PTYs; the kernel sends SIGWINCH and tmux reflows the CLI.
async function resizeSession(name,cols,rows){
  if(!name)return;
  const ttys=(await runQuiet('tmux',['-L','noethara','list-clients','-t',name,'-F','#{client_tty}']))
    .split('\n').map(v=>v.trim()).filter(v=>/^\/dev\/pts\/\d+$/.test(v));
  for(const tty of ttys)await runQuiet('stty',['-F',tty,'cols',String(cols),'rows',String(rows)]);
  for(const tty of ttys)await runQuiet('tmux',['-L','noethara','refresh-client','-t',tty]);
}
let clients = 0;
async function authenticate(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.length<20 || accessToken.length>4096) return null;
  try {
    const result = await fetch(SUPABASE_URL+'/auth/v1/user',{
      method:'GET',headers:{apikey:PUBLISHABLE_KEY,authorization:'Bearer '+accessToken},
      signal:AbortSignal.timeout(6000),cache:'no-store',
    });
    if(!result.ok)return null;
    const user=await result.json();
    return typeof user?.id==='string' && ALLOWED_USERS.has(user.id) ? user.id : null;
  }catch{return null;}
}
wss.on('connection',(socket,req)=>{
  if(++clients>3){clients--;socket.close(1008,'Connection limit');return;}
  let authed=false,authenticating=false,terminal=null,tmuxName='',activeDir=WORKSPACE;
  const reply=packet=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(packet));};
  const deny=message=>{reply({type:'error',message});socket.close(1008,'Unauthorized');};
  const timer=setTimeout(()=>{if(!authed)deny('Login validation timed out');},12000);
  const heartbeat=setInterval(()=>{
    if(socket.readyState===WebSocket.OPEN)socket.ping();
  },30000);
  socket.on('message',async raw=>{
    let msg;
    try{msg=JSON.parse(String(raw));}catch{deny('Invalid message');return;}
    if(!authed){
      if(authenticating || msg?.type!=='auth' || !AGENTS.has(msg.agent)){
        deny('Invalid CLI authorization request');return;
      }
      authenticating=true;
      const userId=await authenticate(msg.token);
      if(socket.readyState!==WebSocket.OPEN)return;
      if(!userId){deny('Account is not authorized for this Noethara workspace');return;}
      // Each workspace uses its own tmux session and working directory.
      // Authorization remains single-owner until isolated runtimes are deployed.
      try { activeDir=msg.workspace ? await workspaceDirectory(msg.workspace) : WORKSPACE; }
      catch {deny('Workspace does not exist. Refresh the project list.');return;}
      if(socket.readyState!==WebSocket.OPEN)return;
      authed=true;clearTimeout(timer);
      // Report a missing CLI clearly instead of spawning tmux and showing a
      // misleading successful connection followed by an immediate exit.
      if(!isCliInstalled(msg.agent)){
        reply({type:'error',message:CLI_NAMES[msg.agent]+' CLI is not installed on your AWS server. In the EC2 Ubuntu terminal run: bash ~/NoetharaMobile/infra/aws/install-cli-agents.sh'});
        socket.close(1008,'CLI not installed');
        return;
      }
      // Hard-coded agent name, isolated per-agent tmux session for the single owner.
      // Do not interpolate client text into a command string.
      const cli=msg.agent;
      tmuxName='noethara-'+cli+(msg.workspace?'-'+msg.workspace:'');
      const cols=Number.isInteger(msg.cols)&&msg.cols>=28&&msg.cols<=180?msg.cols:55;
      const rows=Number.isInteger(msg.rows)&&msg.rows>=10&&msg.rows<=100?msg.rows:28;
      // `script` allocates a PTY at a default size. Size the PTY itself to the phone
      // first; otherwise tmux draws its window inside a larger/smaller client and
      // fills the gap with dots (the "terminal doesn't fit" bug).
      const command='stty cols '+cols+' rows '+rows+' 2>/dev/null; exec tmux -L noethara -u new-session -A -s '+tmuxName+
        ' -x '+cols+' -y '+rows+' '+cli;
      terminal=spawn('script',['-q','-f','-c',command,'/dev/null'],{
        cwd:activeDir,env:{...process.env,PATH:EXEC_PATH,TERM:'xterm-256color',COLORTERM:'truecolor'},
        stdio:['pipe','pipe','pipe'],
      });
      // Hide the tmux host status bar, so the phone sees the agent UI only.
      const disableStatus=()=>{
        void tmuxConfigure(tmuxName).then(()=>resizeSession(tmuxName,cols,rows));
      };
      const statusTimer=setTimeout(disableStatus,500);
      terminal.stdout.on('data',chunk=>reply({type:'output',data:chunk.toString('utf8').slice(0,24000)}));
      terminal.stderr.on('data',chunk=>reply({type:'output',data:chunk.toString('utf8').slice(0,12000)}));
      terminal.on('error',e=>{reply({type:'error',message:'CLI failed to launch: '+e.message});socket.close(1011);});
      terminal.on('exit',code=>{reply({type:'exit',code});socket.close(1000);});
      reply({type:'ready',agent:cli,session:tmuxName});
      return;
    }
    if(msg?.type==='input' && typeof msg.data==='string' &&
       msg.data.length<=2048 && terminal?.stdin?.writable){
      terminal.stdin.write(msg.data);
    }else if(msg?.type==='resize' &&
      Number.isInteger(msg.cols) && Number.isInteger(msg.rows) &&
      msg.cols>=20 && msg.cols<=240 && msg.rows>=8 && msg.rows<=120 && tmuxName){
      // CLI full-screen layouts need the real device viewport dimensions.
      // Use argument arrays, never a client-controlled shell command.
      void resizeSession(tmuxName,msg.cols,msg.rows);
    }else if(msg?.type==='ping'){reply({type:'pong'});}
  });
  socket.on('close',()=>{
    clearTimeout(timer);clearInterval(heartbeat);clients=Math.max(0,clients-1);
    if(terminal && !terminal.killed)terminal.kill('SIGTERM');
  });
  socket.on('error',()=>{});
});
server.listen(PORT,HOST,()=>{
  console.log('Noethara authorized terminal gateway listening privately at '+HOST+':'+PORT);
});
