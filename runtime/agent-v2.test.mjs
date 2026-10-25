import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAgentProvider, completionRequest, NVIDIA_DEFAULT } from './providers.mjs';
import { inspectQuality, summarizeCritique } from './orchestration.mjs';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkWebStyling } from './project-health.mjs';
import { invalidateChecks, recordCheck, reconcilePlan } from './agent-checks.mjs';
import { visionModelId, visionStatus } from './vision.mjs';
import { isManagedViteCommand, assertNoDuplicatePreview, npmTestAvailable } from './agent-shell-guards.mjs';
import { approvalTimeoutMs, _execute, _newJob } from './agent.mjs';

test('Beam routes only when server has a Beam key, with explicit fallback otherwise',()=>{
  const beam=chooseAgentProvider('Beam-1.0-501B-A23B',{NOETHARA_BEAMAI_API_KEY:'fake-beam'});
  assert.equal(beam.provider,'beam');
  assert.equal(beam.model,'Beam-501B-A23B');
  assert.match(beam.endpoint,/reflection\.ai/);
  const fallback=chooseAgentProvider('Beam-1.0-501B-A23B',{NOETHARA_NVIDIA_API_KEY:'fake-nvidia'});
  assert.equal(fallback.provider,'nvidia');
  assert.equal(fallback.model,NVIDIA_DEFAULT);
  assert.match(fallback.fallback,/not configured/);
  assert.throws(()=>chooseAgentProvider('Beam-1.0-501B-A23B',{}),/No coding provider/);
});
test('NVIDIA model choice keeps selected model and enforces credentials',()=>{
  const id='nvidia/nemotron-3-ultra-550b-a55b';
  const p=chooseAgentProvider(id,{NOETHARA_NVIDIA_API_KEY:'fake'});
  assert.equal(p.model,id);
  assert.equal(completionRequest(p,[],[],1024).max_tokens,1024);
  assert.throws(()=>chooseAgentProvider(id,{}),/missing/);
});
test('quality gate enforces real verification, preview and visual reviews',()=>{
  const base={dirty:true,checks:{},reviews:0};
  assert.equal(inspectQuality(base).stage,'verify');
  base.dirty=false;base.checks.typecheck='passed';base.checks.build='passed';
  assert.equal(inspectQuality(base).stage,'preview');
  base.checks.preview='ready';
  assert.equal(inspectQuality(base).stage,'ready');
  assert.equal(inspectQuality(base,{vision:true}).stage,'review');
  base.reviews=1;base.qualityFixRequested=true;
  assert.equal(inspectQuality(base,{vision:true}).stage,'refine');
  base.qualityFixRequested=false;
  assert.equal(inspectQuality(base,{vision:true}).stage,'ready');
});
test('visual critic parses score and real browser defects',()=>{
  assert.deepEqual(summarizeCritique('SCORE: 9/10\nBROKEN: none\nIMPROVE: spacing',[]),
    {score:9,broken:'none',needsFix:false,runtimeIssues:false});
  const bad=summarizeCritique('SCORE: 6/10\nBROKEN: clipped header\nIMPROVE: buttons',[]);
  assert.equal(bad.needsFix,true);
  assert.match(bad.broken,/clipped/);
  assert.equal(summarizeCritique('SCORE: 9/10\nBROKEN: none', [{emptyBody:true}]).needsFix,true);
});
test('premium React and React Native component kits are wired into the templates',async()=>{
  const paths=['react-web/src/components/Premium.tsx','react-native/src/components/Premium.tsx'];
  for(const p of paths){
    const text=await readFile(new URL('./templates/'+p,import.meta.url),'utf8');
    for(const component of ['PremiumCard','PremiumButton','PremiumInput','PremiumBadge','PremiumSection','PremiumSheet'])
      assert.match(text,new RegExp('export function '+component));
  }
  for(const p of ['react-web/src/App.tsx','react-native/src/App.tsx']){
    const text=await readFile(new URL('./templates/'+p,import.meta.url),'utf8');
    assert.match(text,/PremiumCard/);
    assert.match(text,/PremiumButton/);
  }
});

test('Nemotron and MiniMax reasoning are explicitly bounded to low by default',()=>{
 const nem=chooseAgentProvider(NVIDIA_DEFAULT,{NOETHARA_NVIDIA_API_KEY:'fake'});
 const n=completionRequest(nem,[],[],8192,{});
 assert.equal(n.reasoning_effort,'low');
 assert.equal(n.max_tokens,8192);
 const fast=chooseAgentProvider('minimaxai/minimax-m3.1-flash',{NOETHARA_NVIDIA_API_KEY:'fake'});
 const f=completionRequest(fast,[],[],8192,{});
 assert.equal(f.reasoning_effort,'low');
 assert.equal(f.temperature,1);
 const beam=chooseAgentProvider('Beam-1.0-501B-A23B',{NOETHARA_BEAMAI_API_KEY:'fake'});
 assert.equal(completionRequest(beam,[],[],4096,{}).reasoning_effort,'low');
});

test('vision model is callable, not accidentally commented out or undefined',async()=>{
 assert.match(visionModelId(),/nemotron-3\.5-super-vl|[\w./-]+/);
 const old=process.env.NOETHARA_NVIDIA_API_KEY;
 const off=process.env.NOETHARA_VISION;
 try{
  process.env.NOETHARA_NVIDIA_API_KEY='test';
  delete process.env.NOETHARA_VISION;
  const status=await visionStatus();
  assert.equal(status.images,true);
  assert.ok(status.model);
  assert.equal(typeof status.screenshots,'boolean');
 }finally{
  if(old===undefined)delete process.env.NOETHARA_NVIDIA_API_KEY;
  else process.env.NOETHARA_NVIDIA_API_KEY=old;
  if(off===undefined)delete process.env.NOETHARA_VISION;
  else process.env.NOETHARA_VISION=off;
 }
});

test('source changes reopen old passing checks and plan steps',()=>{
 const job={dirty:false,checks:{typecheck:'passed',build:'passed',preview:'ready'},plan:[
   {title:'Run TypeScript typecheck and production build',status:'done'},
   {title:'Start preview',status:'done'},
 ]};
 invalidateChecks(job);
 assert.equal(job.dirty,true);
 assert.equal(job.checks.build,undefined);
 assert.equal(job.plan[0].status,'done'); // reconciled after a tool checkpoint
 reconcilePlan(job);
 assert.equal(job.plan[0].status,'pending');
 assert.equal(job.plan[1].status,'pending');
 recordCheck(job,'typecheck','passed');
 assert.equal(job.dirty,true);
 recordCheck(job,'build','passed');
 assert.equal(job.dirty,false);
 assert.equal(job.plan[0].status,'done');
 recordCheck(job,'preview','ready');
 assert.equal(job.plan[1].status,'done');
});

test('web styling check fails closed for unstyled projects and accepts real CSS',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'noethara-css-'));
 try{
  await mkdir(join(dir,'src'),{recursive:true});
  await writeFile(join(dir,'package.json'),JSON.stringify({dependencies:{vite:'^7.0.0',react:'^19.0.0'}}));
  await writeFile(join(dir,'src','main.tsx'),"import App from './App';\n");
  assert.match((await checkWebStyling(dir)).reason,/No CSS/);
  await writeFile(join(dir,'src','main.tsx'),"import './styles.css';\nimport App from './App';");
  await writeFile(join(dir,'src','styles.css'),'body { color: #fff; background: #09090b; font-family: system-ui; padding: 24px; } .card { border-radius: 24px; padding: 24px; }');
  assert.equal((await checkWebStyling(dir)).ok,true);
  await mkdir(join(dir,'dist','assets'),{recursive:true});
  await writeFile(join(dir,'dist','assets','index.css'),'body{color:white}');
  assert.equal((await checkWebStyling(dir)).ok,true);
  await rm(join(dir,'dist','assets','index.css'));
  assert.match((await checkWebStyling(dir)).reason,/no CSS asset/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('duplicate Vite commands are stopped before the model triggers a 600-second approval wait',()=>{
 const vite={scripts:{dev:'vite --host 127.0.0.1'}};
 for(const command of ['npm run dev','npx vite --host 0.0.0.0','npm run dev -- --port 5201','cd src && npm run dev']){
  assert.equal(isManagedViteCommand(command,vite),true,command);
  assert.throws(()=>assertNoDuplicatePreview(command,vite),/start_preview/);
 }
 const api={scripts:{dev:'tsx watch src/server.ts'}};
 assert.equal(isManagedViteCommand('npm run dev',api),false);
 assert.doesNotThrow(()=>assertNoDuplicatePreview('npm run dev',api));
 assert.equal(isManagedViteCommand('npm run build',vite),false);
});
test('approval requests expire promptly rather than waiting ten minutes',()=>{
 assert.equal(approvalTimeoutMs({}),60000);
 assert.equal(approvalTimeoutMs({NOETHARA_APPROVAL_TIMEOUT_MS:'45000'}),45000);
 assert.equal(approvalTimeoutMs({NOETHARA_APPROVAL_TIMEOUT_MS:'800000'}),120000);
 assert.equal(approvalTimeoutMs({NOETHARA_APPROVAL_TIMEOUT_MS:'2'}),1000);
});
test('npm test is cleanly skipped when no test script exists',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'noethara-no-tests-'));
 try{
  await writeFile(join(dir,'package.json'),JSON.stringify({name:'noethara-demo',scripts:{dev:'vite',build:'vite build'}}));
  const job=_newJob('00000000-0000-4000-8000-000000000099','noethara-demo',{messages:[]});
  const result=JSON.parse(await _execute(dir,'npm test',job));
  assert.equal(result.skipped,true);
  assert.equal(result.exitCode,0);
  assert.equal(npmTestAvailable({scripts:{test:'node --test'}}),true);
  assert.equal(npmTestAvailable({scripts:{dev:'vite'}}),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
