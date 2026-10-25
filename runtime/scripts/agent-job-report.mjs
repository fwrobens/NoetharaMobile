// Privacy-safe diagnostic summary for the persistent AWS coding jobs.
// Prints timings and error *types*, never prompts, code, credentials or model output.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root=join(process.env.NOETHARA_STATE_DIR||join(homedir(),'.noethara'),'jobs');
const workspace=process.argv[2]?.trim()||'';
const files=await readdir(root).catch(()=>[]);
const entries=[];
for(const file of files.filter(x=>x.endsWith('.json'))){
 try{
  const full=join(root,file);
  const metadata=await stat(full);
  const raw=JSON.parse(await readFile(full,'utf8'));
  if(workspace&&raw.workspaceId!==workspace)continue;
  entries.push({raw,mtime:metadata.mtimeMs});
 }catch{}
}
entries.sort((a,b)=>b.mtime-a.mtime);
if(!entries.length)console.log('No matching saved jobs. Pass a workspace id or leave blank for recent jobs.');
for(const {raw:job} of entries.slice(0,5)){
 const events=job.events||[];
 const tools=events.filter(e=>e.status==='done'&&e.tool);
 const failures=events.filter(e=>e.status==='failed'&&e.tool);
 const commands=tools.filter(e=>['run_command','run_shell','verify_project'].includes(e.tool));
 const summary={
  jobId:job.id,workspaceId:job.workspaceId,status:job.status,
  startedAt:new Date(job.created).toISOString(),rounds:job.round,
  model:job.input?.model,
  checks:job.checks,plan:(job.plan||[]).map(p=>({title:p.title,status:p.status})),
  modelSeconds:Math.round((job.metrics?.modelMs||0)/1000),
  toolSeconds:Math.round((job.metrics?.toolMs||0)/1000),
  modelRequests:job.metrics?.requests||0,
  commandDurations:commands.slice(-12).map(e=>({tool:e.tool,seconds:Math.round((e.ms||0)/1000)})),
  failedTools:failures.slice(-12).map(e=>({tool:e.tool,seconds:Math.round((e.ms||0)/1000)})),
  failureCount:failures.length,
  // Never print full error messages; only safe compiler error codes.
  typescriptErrors:[...new Set(events.flatMap(e=>String(e.message||'').match(/TS\d{4}/g)||[]))].slice(0,12),
  design:job.design?{score:job.design.score,issues:job.design.issues,reviews:job.design.reviews}:null,
 };
 console.log(JSON.stringify(summary,null,2));
}
