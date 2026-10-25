// Provider adapter for the existing OpenAI-compatible function-calling loop.
// Beam is opt-in when configured on EC2. NVIDIA is the working default.
// Never expose credentials to the Expo client, Docker sandbox, or generated app.
export const NVIDIA_DEFAULT='nvidia/nemotron-3.5-super-vl-120b-a12b';
export const BEAM_UI_ID='Beam-1.0-501B-A23B';

export function chooseAgentProvider(selection,env=process.env){
 const desired=String(selection||env.NOETHARA_AGENT_MODEL||NVIDIA_DEFAULT);
 const nvidiaKey=env.NOETHARA_NVIDIA_API_KEY||env.NVIDIA_API_KEY;
 const beamKey=env.NOETHARA_BEAMAI_API_KEY||env.REFLECTION_API_KEY;
 if(desired===BEAM_UI_ID||desired==='Beam-501B-A23B'){
   if(beamKey)return {provider:'beam',model:env.NOETHARA_BEAM_MODEL_ID||'Beam-1.0-501B-A23B',
     endpoint:'https://api.reflection.ai/openai/v1/chat/completions',key:beamKey};
   if(nvidiaKey)return {provider:'nvidia',model:NVIDIA_DEFAULT,
     endpoint:'https://integrate.api.nvidia.com/v1/chat/completions',key:nvidiaKey,fallback:'Beam API key not configured on AWS; using tested NVIDIA coding model'};
   throw Error('No coding provider configured. Add NOETHARA_BEAMAI_API_KEY or NOETHARA_NVIDIA_API_KEY to the private AWS runtime.');
 }
 if(!/^[\w.-]{1,90}[/][\w.:-]{1,100}$/.test(desired))throw Error('Invalid coding model ID');
 if(!nvidiaKey)throw Error('NVIDIA model selected but NOETHARA_NVIDIA_API_KEY is missing');
 return {provider:'nvidia',model:desired,endpoint:'https://integrate.api.nvidia.com/v1/chat/completions',key:nvidiaKey};
}
export function completionRequest(provider,messages,tools,maxTokens){
 const payload={model:provider.model,messages,tools,tool_choice:'auto',max_tokens:maxTokens,stream:false};
 if(provider.provider==='beam')payload.reasoning_effort='medium';
 else Object.assign(payload,{temperature:0.2,top_p:0.95});
 return payload;
}
