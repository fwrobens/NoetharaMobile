// Smoke-test MCP connectivity from the same private AWS runtime as the agent.
// Never print keys, headers or whole third-party component contents.
import { serverReady, discoverTools } from '../mcp/client.mjs';
for(const server of ['context7','21st']){
  if(!serverReady(server)){
    console.log(server+': not configured (see docs/AGENT_2.md)');
    continue;
  }
  try{
    const tools=await discoverTools(server,{timeoutMs:12000});
    console.log(server+': connected; allowlisted tools: '+tools.map(t=>t.name).join(', '));
    if(!tools.length)process.exitCode=1;
  }catch(e){
    console.error(server+': connection failed: '+String(e.message||e).slice(0,180)
      .replace(/[a-z0-9_-]{32,}/ig,'[redacted]'));
    process.exitCode=1;
  }
}
