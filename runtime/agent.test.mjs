import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalPath, recoverNestedProject } from './agent.mjs';
import { handlePreviewManagement } from './preview.mjs';

test('agent file paths remain scoped to existing workspace root',async()=>{
 const dir='/home/ubuntu/noethara-workspaces/todo-app';
 assert.equal(canonicalPath(dir,'package.json'),'package.json');
 assert.equal(canonicalPath(dir,'todo-app/package.json'),'package.json');
 assert.equal(canonicalPath(dir,dir+'/src/App.tsx'),'src/App.tsx');
 assert.equal(canonicalPath(dir,'src/App.tsx'),'src/App.tsx');
 for(const unsafe of ['/etc/passwd','../file','.env','src/../../other','todo-app/.ssh/id_rsa']){
  assert.throws(()=>canonicalPath(dir,unsafe));
 }
});

test('recovers legacy nested generated source without overwriting originals',async()=>{
 const root=await mkdtemp(join(tmpdir(),'noethara-agent-'));
 const dir=join(root,'todo-app');
 try{
  await mkdir(join(dir,'todo-app','src'),{recursive:true});
  await writeFile(join(dir,'index.html'),'existing project HTML');
  await writeFile(join(dir,'todo-app','index.html'),'generated Vite HTML');
  await writeFile(join(dir,'todo-app','package.json'),'{"name":"todo-app","scripts":{"dev":"vite"}}');
  await writeFile(join(dir,'todo-app','src','App.tsx'),'export default function App() {}');
  const change=await recoverNestedProject(dir);
  assert.deepEqual(change.moved.sort(),['package.json','src']);
  assert.deepEqual(change.skipped,['index.html']);
  assert.equal(await readFile(join(dir,'index.html'),'utf8'),'existing project HTML');
  assert.match(await readFile(join(dir,'package.json'),'utf8'),/vite/);
  assert.match(await readFile(join(dir,'src','App.tsx'),'utf8'),/App/);
  assert.deepEqual(await recoverNestedProject(dir),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('preview management recognizes start/status/stop URL segments',async()=>{
 const request={method:'GET'};
 const res={
   status:0,body:'',
   writeHead(status){this.status=status;},
   end(body){this.body=body;}
 };
 assert.equal(await handlePreviewManagement(request,res,
   new URL('http://localhost/workspaces/todo-app/preview/status'),
   'todo-app','/tmp/noethara-empty'),true);
 assert.equal(res.status,200);
 assert.deepEqual(JSON.parse(res.body),{status:'stopped'});
 const stop={...res,status:0,body:''};
 assert.equal(await handlePreviewManagement({method:'POST'},stop,
   new URL('http://localhost/workspaces/todo-app/preview/stop'),
   'todo-app','/tmp/noethara-empty'),true);
 assert.equal(stop.status,200);
 assert.deepEqual(JSON.parse(stop.body),{stopped:true});
});

test('normalizes dot, ./ and rooted model paths inside the workspace',async()=>{
 const { canonicalPath:cp }=await import('./agent.mjs');
 const dir='/home/ubuntu/noethara-workspaces/todo-app';
 assert.equal(cp(dir,'./src/App.tsx'),'src/App.tsx');
 assert.equal(cp(dir,'/src/App.tsx'),'src/App.tsx');
 assert.equal(cp(dir,'/workspace/todo-app/src/App.tsx'),'src/App.tsx');
 assert.throws(()=>cp(dir,'.'));
 assert.throws(()=>cp(dir,'/home/ubuntu/.ssh/id_rsa'));
});

test('recovers tool calls a model printed as text',async()=>{
 const { extractTextToolCalls }=await import('./agent.mjs');
 const a=extractTextToolCalls('<tool_call>{"name":"read_file","arguments":{"path":"src/App.tsx"}}</tool_call>');
 assert.equal(a[0].function.name,'read_file');
 assert.equal(JSON.parse(a[0].function.arguments).path,'src/App.tsx');
 const b=extractTextToolCalls('{"action":"list_files","paths":["."]}');
 assert.equal(b[0].function.name,'list_files');
 assert.equal(JSON.parse(b[0].function.arguments).path,'.');
 assert.equal(extractTextToolCalls('Here is the plan: build a todo app.').length,0);
});

test('agent loop scaffolds, edits, verifies and reports with a scripted model',async()=>{
 const { _generate, _newJob }=await import('./agent.mjs');
 const root=await mkdtemp(join(tmpdir(),'noethara-loop-'));
 const dir=join(root,'demo');
 await mkdir(dir);
 const script=[
  {tool_calls:[{id:'1',type:'function',function:{name:'update_plan',arguments:JSON.stringify({steps:[{title:'Scaffold',status:'active'},{title:'Build UI',status:'pending'}]})}}]},
  {content:'<tool_call>{"name":"scaffold_app","arguments":{}}</tool_call>'},
  {tool_calls:[{id:'3',type:'function',function:{name:'edit_file',arguments:JSON.stringify({path:'./src/App.tsx',find:'Your app starts here',replace:'Hello Noethara'})}}]},
  {content:'Done.'},
  {content:'**Built:** demo'},
 ];
 const seen=[];
 const realFetch=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{seen.push(JSON.parse(init.body));const m=script.shift()||{content:'end'};
  return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:m.content||'',tool_calls:m.tool_calls},finish_reason:'stop'}]}),{status:200});};
 process.env.NOETHARA_NVIDIA_API_KEY='test';
 try{
  const job=_newJob('j','demo',{messages:[{role:'user',content:'build'}]});
  await _generate(job,dir,{messages:[{role:'user',content:'build'}]});
  const app=await readFile(join(dir,'src','App.tsx'),'utf8');
  assert.match(app,/Hello Noethara/);
  const pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));
  assert.equal(pkg.name,'demo');
  assert.equal(job.plan.length,2);
  assert.ok(job.files.has('src/App.tsx'));
  // "Done." without verification triggers the verify nudge; then the second reply is accepted after 2 nudges.
  assert.ok(seen.some(b=>b.messages.some(m=>m.role==='user'&&/npm run typecheck/.test(m.content))));
  assert.ok(job.events.some(e=>e.ref==='3'&&e.status==='done'));
  assert.ok(job.answer.length>0);
 }finally{globalThis.fetch=realFetch;await rm(root,{recursive:true,force:true})}
});

test('jobs persist to disk and checkpoints restore workspace files',async()=>{
 const { checkpoint, _newJob }=await import('./agent.mjs');
 const root=await mkdtemp(join(tmpdir(),'noethara-cp-'));
 const dir=join(root,'cpdemo');
 await mkdir(dir);
 try{
  await writeFile(join(dir,'App.tsx'),'v1');
  const job=_newJob('00000000-0000-4000-8000-000000000001','cpdemo',{messages:[]});
  const sha=await checkpoint(job,dir,'before');
  assert.match(sha,/^[0-9a-f]+$/);
  await writeFile(join(dir,'App.tsx'),'v2');
  await writeFile(join(dir,'extra.ts'),'x');
  const sha2=await checkpoint(job,dir,'after');
  assert.notEqual(sha,sha2);
  assert.equal(job.checkpoints.length,2);
 }finally{await rm(root,{recursive:true,force:true})}
});
