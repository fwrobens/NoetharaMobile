// NoetharaMobile managed terminal gateway.
// Private loopback origin behind a Cloudflare Tunnel, not a public host shell API.
// Supabase user authorization is required for EVERY WebSocket session.
// Single-owner mode only until per-user isolated containers are implemented.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || '8789');
const SUPABASE_URL = (process.env.NOETHARA_SUPABASE_URL || '').replace(/\/$/,'');
const PUBLISHABLE_KEY = process.env.NOETHARA_SUPABASE_PUBLISHABLE_KEY || '';
const ALLOWED_USERS = new Set((process.env.NOETHARA_ALLOWED_USER_IDS || '')
  .split(',').map(s=>s.trim()).filter(s=>/^[a-f0-9-]{36}$/i.test(s)));
const WORKSPACE = process.env.NOETHARA_WORKSPACE || process.cwd();
const AGENTS = new Set(['opencode','codex','claude']);
// Fail closed. Never turn a valid self-signup account into full host shell access.
if (!SUPABASE_URL.startsWith('https://') || !PUBLISHABLE_KEY || !ALLOWED_USERS.size) {
  console.error('Missing NOETHARA_SUPABASE_URL, NOETHARA_SUPABASE_PUBLISHABLE_KEY, or NOETHARA_ALLOWED_USER_IDS. Refusing to start.');
  process.exit(1);
}
const server = createServer((_req,res)=>{
  res.writeHead(404,{'content-type':'text/plain','cache-control':'no-store'});
  res.end('Not found');
});
const wss = new WebSocketServer({server,maxPayload:8192,perMessageDeflate:false,clientTracking:true});
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
  let authed=false,authenticating=false,terminal=null;
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
      authed=true;clearTimeout(timer);
      // Hard-coded agent name, isolated per-agent tmux session for the single owner.
      // Do not interpolate client text into a command string.
      const cli=msg.agent;
      const tmuxName='noethara-'+cli;
      const command='tmux -L noethara -u new-session -A -s '+tmuxName+' '+cli;
      terminal=spawn('script',['-q','-f','-c',command,'/dev/null'],{
        cwd:WORKSPACE,env:{...process.env,TERM:'xterm-256color',NO_COLOR:'1'},
        stdio:['pipe','pipe','pipe'],
      });
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
