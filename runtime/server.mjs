// Private Linux terminal bridge for the Noethara Dev mobile app.
// Use behind a TLS-secured private tunnel. NEVER expose this raw port to the internet.
// This deliberately starts only the three approved CLI executables, not an arbitrary shell.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import process from 'node:process';

const token = process.env.NOETHARA_TERMINAL_TOKEN || '';
if (token.length < 32) {
  console.error('Set NOETHARA_TERMINAL_TOKEN to a random secret at least 32 characters long.');
  process.exit(1);
}
const port = Number(process.env.PORT || 8789);
const host = '127.0.0.1';
const allowed = new Set(['opencode','codex','claude']);
const server = createServer((_req,res)=>{
  res.writeHead(404,{ 'content-type':'text/plain' });res.end('Not found');
});
const wss = new WebSocketServer({ server, maxPayload: 8192, perMessageDeflate: false });
const fits = (submitted) => {
  if (typeof submitted !== 'string' || submitted.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(submitted),Buffer.from(token));
};
let activeClients = 0;
wss.on('connection',(ws)=>{
  if (++activeClients > 2) {ws.close(1008,'Too many connections');activeClients--;return;}
  let authenticated=false,proc=null;
  const timeout=setTimeout(()=>{if(!authenticated)ws.close(1008,'Authentication timeout');},7000);
  const send=(data)=>{
    if(ws.readyState===1)ws.send(JSON.stringify(data));
  };
  ws.on('message',(buffer)=>{
    let data;
    try{data=JSON.parse(String(buffer));}catch{send({type:'error',message:'Invalid request'});return;}
    if(!authenticated){
      if(data?.type!=='auth'||!fits(data.token)||!allowed.has(data.agent)){
        send({type:'error',message:'Authorization failed'});ws.close(1008,'Unauthorized');return;
      }
      authenticated=true;
      clearTimeout(timeout);
      // Each selected CLI gets a dedicated tmux session. Reconnecting to the
      // same CLI reattaches its live process, instead of starting over.
      // Agent names are strict allowlist entries, not user-supplied commands.
      // "script" supplies the TTY required by interactive programs.
      const session='noethara-'+data.agent;
      const command='tmux -L noethara -u new-session -A -s '+session+' '+data.agent;
      proc=spawn('script',['-q','-f','-c',command,'/dev/null'],{
        cwd:process.env.NOETHARA_WORKSPACE||process.cwd(),
        env:{...process.env,TERM:'xterm-256color',NO_COLOR:'1'},
        stdio:['pipe','pipe','pipe'],
      });
      proc.stdout.on('data',chunk=>send({type:'output',data:chunk.toString('utf8').slice(0,24000)}));
      proc.stderr.on('data',chunk=>send({type:'output',data:chunk.toString('utf8').slice(0,12000)}));
      proc.on('error',err=>send({type:'error',message:'Could not attach CLI session: '+err.message+' (tmux and the CLI must be installed)'}));
      proc.on('exit',code=>{send({type:'exit',code});if(ws.readyState===1)ws.close();});
      send({type:'ready',agent:data.agent});
      return;
    }
    if(data?.type==='input' && typeof data.data==='string' && data.data.length<4096 && proc?.stdin?.writable){
      proc.stdin.write(data.data);
    }
  });
  ws.on('close',()=>{clearTimeout(timeout);activeClients--;if(proc&&!proc.killed)proc.kill('SIGTERM');});
});
server.listen(port,host,()=>console.log('Noethara private terminal bridge listening at '+host+':'+port));
