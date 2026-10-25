import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=await mkdtemp(join(tmpdir(),'noethara-workspace-test-'));
process.env.NOETHARA_WORKSPACE_ROOT=root;
const {handleWorkspaceRequest}=await import('./workspaces.mjs');
const server=createServer((req,res)=>{
 const url=new URL(req.url||'/', 'http://localhost');
 void handleWorkspaceRequest(req,res,url,'test-owner');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const base='http://127.0.0.1:'+port;
const request=async(path,method='GET',payload)=>{
 const response=await fetch(base+path,{
  method,headers:{'content-type':'application/json'},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 return {status:response.status,body:await response.json()};
};
try {
 await test('creates owner-scoped workspace, lists files and checks edit version',async()=>{
  const created=await request('/workspaces','POST',{name:'DemoProject'});
  assert.equal(created.status,201);
  assert.equal(created.body.workspace.id,'DemoProject');
  const listed=await request('/workspaces');
  assert.equal(listed.status,200);
  assert.ok(listed.body.workspaces.some(x=>x.id==='DemoProject'));
  await writeFile(join(root,'DemoProject','hello.ts'),'console.log(1);\n');
  const tree=await request('/workspaces/DemoProject/files');
  assert.equal(tree.status,200);
  assert.deepEqual(tree.body.entries[0].path,'hello.ts');
  const original=await request('/workspaces/DemoProject/file?path=hello.ts');
  assert.equal(original.status,200);
  assert.match(original.body.content,/console\.log/);
  const conflict=await request('/workspaces/DemoProject/file','PUT',{
    path:'hello.ts',content:'console.log(2)',expectedSha256:'wrong'
  });
  assert.equal(conflict.status,400);
  const saved=await request('/workspaces/DemoProject/file','PUT',{
    path:'hello.ts',content:'console.log(2)',expectedSha256:original.body.sha256
  });
  assert.equal(saved.status,200);
  const updated=await request('/workspaces/DemoProject/file?path=hello.ts');
  assert.equal(updated.body.content,'console.log(2)');
 });
 await test('rejects path traversal, hidden credentials and malformed workspace names',async()=>{
  const name=await request('/workspaces','POST',{name:'../outside'});
  assert.equal(name.status,400);
  const outside=await request('/workspaces/DemoProject/file?path=..%2F..%2Fetc%2Fpasswd');
  assert.equal(outside.status,400);
  const hidden=await request('/workspaces/DemoProject/file?path=.env');
  assert.equal(hidden.status,400);
  const symlink=await request('/workspaces/DemoProject/file?path=.ssh%2Fid_rsa');
  assert.equal(symlink.status,400);
 });
}finally {
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
 await rm(root,{recursive:true,force:true});
}
