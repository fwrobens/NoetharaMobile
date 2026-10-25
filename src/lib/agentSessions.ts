import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers which AWS coding job belongs to which chat, so leaving the chat
// (or closing the app) never orphans a running automation. Reopening the chat
// reattaches to the job and saves its final answer.
export type AgentSession={workspaceId:string;jobId:string;model:string;startedAt:number};
const KEY='noethara.agentSessions.v1';
async function readAll():Promise<Record<string,AgentSession>>{
  try{const raw=await AsyncStorage.getItem(KEY);return raw?JSON.parse(raw) as Record<string,AgentSession>:{};}
  catch{return {};}
}
async function writeAll(all:Record<string,AgentSession>){
  const entries=Object.entries(all).sort((a,b)=>b[1].startedAt-a[1].startedAt).slice(0,30);
  await AsyncStorage.setItem(KEY,JSON.stringify(Object.fromEntries(entries))).catch(()=>{});
}
export async function rememberAgentSession(chatId:string,session:Omit<AgentSession,'startedAt'>&{startedAt?:number}){
  const all=await readAll();
  all[chatId]={...session,startedAt:session.startedAt??Date.now()};
  await writeAll(all);
}
export async function getAgentSession(chatId:string):Promise<AgentSession|null>{
  return (await readAll())[chatId]??null;
}
export async function clearAgentSession(chatId:string|null|undefined){
  if(!chatId)return;
  const all=await readAll();
  if(all[chatId]){delete all[chatId];await writeAll(all);}
}
export class DetachedError extends Error{constructor(){super('detached');this.name='DetachedError';}}
export const isDetached=(e:unknown)=>e instanceof DetachedError;
