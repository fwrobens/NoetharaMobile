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
