// Noethara backend-only MCP transport. Uses the current 2026 MCP v2 client,
// not an ad-hoc JSON-RPC imitation. Never import from the Expo frontend.
// External responses are untrusted design/documentation data.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export const SERVERS=Object.freeze({
  context7: {url:'https://mcp.context7.com/mcp',key:'CONTEXT7_API_KEY'},
  '21st': {url:'https://21st.dev/api/mcp',key:'NOETHARA_21ST_API_KEY'},
});
const ALLOW={
  context7: new Set(['resolve-library-id','query-docs']),
  '21st':new Set(['search','get_component']),
};
const cache=new Map();
const now=()=>Date.now();
export function serverReady(server,env=process.env){
  if(!Object.hasOwn(SERVERS,server))return false;
  return env.NOETHARA_MCP_ENABLED!=='off' &&
    (server==='context7'||env.NOETHARA_21ST_ENABLED!=='off') &&
    Boolean(env[SERVERS[server].key]);
}
function authHeaders(server,env){
  const key=env[SERVERS[server].key];
  if(!key)throw Error(server+' MCP is not configured (missing '+SERVERS[server].key+')');
  return server==='21st'?{'x-api-key':key}:{Authorization:'Bearer '+key};
}
function publicTool(t,server){
  return {server,name:t.name,description:String(t.description||'').slice(0,300),
    inputSchema:t.inputSchema||{type:'object',properties:{}}};
}
export function permittedTool(server,name){
  return Object.hasOwn(ALLOW,server) && ALLOW[server].has(name);
}
export function budgetFor(server,name){
  if(server==='21st'&&name==='get_component')return 2;
  if(server==='21st')return 8;
  return 12;
}
export function validateArguments(args){
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('MCP arguments must be a JSON object');
  if(JSON.stringify(args).length>5000)throw Error('MCP arguments exceed the size limit');
  return args;
}
export async function withServer(server,operation,{env=process.env,timeoutMs=14000}={}){
  if(!serverReady(server,env))throw Error(server+' MCP not configured: see docs/AGENT_2.md');
  const client=new Client({name:'noethara-coding-agent',version:'2.0.0'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const transport=new StreamableHTTPClientTransport(new URL(SERVERS[server].url),{
    requestInit:{headers:authHeaders(server,env),signal:controller.signal},
  });
  try {
    await client.connect(transport);
    return await operation(client);
  }finally{
    clearTimeout(timer);
    await client.close().catch(()=>{});
  }
}
export async function discoverTools(server,options={}){
  return withServer(server,async client=>{
    const listed=await client.listTools();
    return (listed.tools||[]).filter(t=>permittedTool(server,t.name))
      .map(t=>publicTool(t,server));
  },options);
}
export async function callTool(server,name,args,{counts={},env=process.env,timeoutMs=14000}={}){
  if(!permittedTool(server,name))throw Error('MCP tool is not allowed: '+server+'/'+name);
  const parameters=validateArguments(args);
  const id=server+':'+name;
  const used=counts[id]||0;
  if(used>=budgetFor(server,name))throw Error('MCP request budget reached for '+id);
  // Cache successful lookups to avoid consuming limited third-party allowances.
  const key=id+':'+JSON.stringify(parameters);
  const cached=cache.get(key);
  if(cached&&cached.exp>now())return {cached:true,text:cached.text};
  const value=await withServer(server,async client=>{
    const tools=(await client.listTools()).tools||[];
    if(!tools.some(t=>t.name===name))throw Error('MCP server did not advertise '+name+'; call discover_mcp_tools');
    return client.callTool({name,arguments:parameters});
  },{env,timeoutMs});
  counts[id]=used+1;
  if(value?.isError)throw Error('MCP tool returned an error (see server configuration)');
  const contents=Array.isArray(value?.content)?value.content:[];
  const text=contents.map(item=>item.type==='text'?String(item.text||''):'[non-text MCP result omitted]')
    .join('\n').slice(0,12500);
  const safe=text.replace(/\b(?:sk|token|key)_[a-zA-Z0-9_-]{20,}\b/g,'[redacted]');
  cache.set(key,{text:safe,exp:now()+10*60*1000});
  if(cache.size>200)cache.delete(cache.keys().next().value);
  return {cached:false,text:safe||'(empty MCP response)'};
}
