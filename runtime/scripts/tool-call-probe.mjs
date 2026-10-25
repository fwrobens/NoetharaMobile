#!/usr/bin/env node
// Model-specific tool-calling test for the Noethara agent.
// Sends the agent's real tool schema to each model and checks that it calls tools
// natively with valid arguments in the situations the agent loop depends on.
// Usage (on EC2): node runtime/scripts/tool-call-probe.mjs [model ...]
// Needs NOETHARA_NVIDIA_API_KEY in the environment (pm2 env or .env).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { _functions as functions, extractTextToolCalls } from '../agent.mjs';
import { ENGINEERING_PROMPT } from '../prompts/engineering.mjs';
import { classifyNvidiaError } from '../provider-errors.mjs';

const key=process.env.NOETHARA_NVIDIA_API_KEY||process.env.NVIDIA_API_KEY;
if(!key){console.error('Set NOETHARA_NVIDIA_API_KEY first (same value PM2 uses).');process.exit(1)}
const models=process.argv.slice(2).length?process.argv.slice(2):[process.env.NOETHARA_AGENT_MODEL||'nvidia/nemotron-3-super-120b-a12b'];
const sys={role:'system',content:ENGINEERING_PROMPT+'\n\n# Workspace snapshot\n(empty workspace)'};
const scenarios=[
 {name:'plans first',expect:['update_plan','scaffold_app'],messages:[sys,{role:'user',content:'Build a habit tracker mobile app with streaks.'}]},
 {name:'picks web template',expect:['scaffold_app','update_plan'],check:c=>c.function.name!=='scaffold_app'||/react-web/.test(c.function.arguments),
  messages:[sys,{role:'user',content:'Make a landing page website for my bakery.'}]},
 {name:'writes a full file',expect:['write_file'],check:c=>{try{const a=JSON.parse(c.function.arguments);return typeof a.path==='string'&&typeof a.content==='string'&&a.content.length>40}catch{return false}},
  messages:[{role:'system',content:ENGINEERING_PROMPT+'\n\n# Workspace snapshot\npackage.json\nsrc/App.tsx\nsrc/theme.ts'},
   {role:'user',content:'Create src/components/Badge.tsx: a small pill component with a label prop. Write the file now.'}]},
 {name:'fixes after a failed check',expect:['read_file','edit_file','write_file'],messages:[
  {role:'system',content:ENGINEERING_PROMPT+'\n\n# Workspace snapshot\npackage.json\nsrc/App.tsx'},
  {role:'user',content:'Add a counter to the home screen.'},
  {role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:'run_command',arguments:'{"command":"npm run typecheck"}'}}]},
  {role:'tool',tool_call_id:'call_1',content:'Error: npm run typecheck failed (exit 2): src/App.tsx(12,7): error TS2304: Cannot find name \'useState\'.'}]},
];
async function call(model,messages,{withTools=true}={}){
 const t0=Date.now();
 const request={model,messages,temperature:0.2,max_tokens:withTools?4096:64,stream:false,
  ...(withTools?{tools:functions,tool_choice:'auto'}:{})};
 const resp=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',
  headers:{authorization:'Bearer '+key,'content-type':'application/json'},
  body:JSON.stringify(request),signal:AbortSignal.timeout(150000)});
 const ms=Date.now()-t0;
 if(!resp.ok){
  const info=classifyNvidiaError(resp.status,await resp.text().catch(()=>''));
  return {ms,error:info.message,errorKind:info.kind,httpStatus:resp.status};
 }
 const msg=(await resp.json()).choices?.[0]?.message||{};
 return {ms,msg};
}
const report=[];
let providerBlocked=false;
for(const model of models){
 console.log('\n== '+model);
 let pass=0,scored=0,blocked=false;
 for(const s of scenarios){
  const r=await call(model,s.messages).catch(e=>({error:'Network/provider request failed: '+String(e.message||e).slice(0,160),errorKind:'network'}));
  if(r.errorKind==='provider_access'||r.errorKind==='model_unavailable'||r.errorKind==='authentication'){
   // A simple chat request without functions distinguishes account/endpoint
   // provisioning failures from a tool-calling-only incompatibility.
   console.log('  Tool request blocked by NVIDIA (HTTP '+r.httpStatus+'). Testing one plain chat request without tools…');
   const simple=await call(model,[{role:'user',content:'Respond with only OK.'}],{withTools:false})
     .catch(e=>({error:'Plain chat request failed: '+String(e.message||e).slice(0,160),errorKind:'network'}));
   const plainWorks=Boolean(simple.msg);
   const reason=plainWorks?'tool_endpoint_unavailable':r.errorKind;
   console.log(plainWorks?
    '  Plain chat worked but tool-enabled inference failed. Do not use this endpoint for a coding agent.':
    '  Plain chat also failed ('+(simple.httpStatus||simple.errorKind||'network')+'). NVIDIA endpoint/account access needs attention.');
   console.log('  '+r.error);
   console.log('  These are provider errors, NOT failed coding tests. Skipping remaining scenarios.');
   report.push({model,scenario:s.name,ok:null,status:'blocked',reason,ms:r.ms||null,
    httpStatus:r.httpStatus,plainChat:plainWorks?'passed':'failed'});
   blocked=true;providerBlocked=true;break;
  }
  let native=r.msg?.tool_calls||[],recovered=[];
  if(!native.length&&r.msg?.content)recovered=extractTextToolCalls(r.msg.content)||[];
  const calls=native.length?native:recovered;
  const first=calls[0];
  const argsOk=first?(()=>{try{JSON.parse(typeof first.function.arguments==='string'?first.function.arguments:JSON.stringify(first.function.arguments));return true}catch{return false}})():false;
  const ok=Boolean(first)&&s.expect.includes(first.function.name)&&argsOk&&(!s.check||s.check({function:{name:first.function.name,arguments:typeof first.function.arguments==='string'?first.function.arguments:JSON.stringify(first.function.arguments)}}));
  scored++;
  if(ok)pass++;
  const line={model,scenario:s.name,ok,mode:native.length?'native':recovered.length?'text-recovered':'none',
   tool:first?.function?.name||null,ms:r.ms||null,error:r.error||null};
  report.push(line);
  console.log((ok?'PASS':'FAIL').padEnd(5),s.name.padEnd(28),line.mode.padEnd(15),String(line.tool||'-').padEnd(14),(r.ms?r.ms+'ms':''),r.error?' '+r.error:'');
 }
 console.log(blocked?'score NOT AVAILABLE (provider rejected requests; not a model-quality result)':
   'score '+pass+'/'+scored+(pass===scenarios.length?'  (good fit for the agent)':pass>=2?'  (usable; text-call recovery may be needed)':'  (not recommended based on completed scenarios)'));
}
const dir=join(process.env.NOETHARA_STATE_DIR||join(homedir(),'.noethara'),'probes');
mkdirSync(dir,{recursive:true});
const file=join(dir,'tool-calls-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
writeFileSync(file,JSON.stringify(report,null,2));
console.log('\nSaved '+file);
if(providerBlocked)process.exitCode=2;
