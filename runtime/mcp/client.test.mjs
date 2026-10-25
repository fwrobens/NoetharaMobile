import test from 'node:test';
import assert from 'node:assert/strict';
import { serverReady, permittedTool, budgetFor, validateArguments, callTool } from './client.mjs';

test('MCP client does not expose 21st when credentials are absent',()=>{
 assert.equal(serverReady('21st',{}),false);
 assert.equal(serverReady('context7',{}),false);
 assert.equal(serverReady('21st',{NOETHARA_21ST_API_KEY:'fake-key'}),true);
 assert.equal(serverReady('context7',{CONTEXT7_API_KEY:'fake-key'}),true);
 assert.equal(serverReady('context7',{CONTEXT7_API_KEY:'fake-key',NOETHARA_MCP_ENABLED:'off'}),false);
});
test('MCP allowlist disallows write, publish, generate and arbitrary server tools',()=>{
 for(const [server,name] of [['21st','publish'],['21st','generate'],['21st','execute'],
 ['context7','delete_file'],['context7','query-external'],['arbitrary','search']])
   assert.equal(permittedTool(server,name),false);
 assert.equal(permittedTool('21st','search'),true);
 assert.equal(permittedTool('21st','get_component'),true);
 assert.equal(permittedTool('context7','query-docs'),true);
 assert.equal(budgetFor('21st','get_component'),2);
});
test('MCP validates bounded object arguments and rejects invalid tool without networking',async()=>{
 assert.throws(()=>validateArguments([]),/JSON object/);
 assert.throws(()=>validateArguments({payload:'x'.repeat(6000)}),/size limit/);
 await assert.rejects(callTool('21st','publish',{source:'bad'}),/not allowed/);
 await assert.rejects(callTool('context7','query-docs',[]),/JSON object/);
});
