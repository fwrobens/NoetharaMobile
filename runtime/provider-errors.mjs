// Convert NVIDIA hosted-inference failures into safe, actionable diagnostics.
// Never expose NVIDIA internal function IDs, account IDs, or provider response
// bodies in the app or probe reports.
export function classifyNvidiaError(status,raw=''){
 let body;
 try{body=JSON.parse(String(raw))}catch{}
 const detail=typeof body?.detail==='string'?body.detail:String(raw||'');
 if(status===404&&/function.{0,200}(?:not found for account|specified function in account|not found in account)/i.test(detail)){
  return {kind:'provider_access',blocked:true,
   message:'NVIDIA hosted inference returned HTTP 404: the model function is unavailable for this NVIDIA account. This is an endpoint/account provisioning issue, not a failed coding-tool action. Check NVIDIA Build account access or contact help@build.nvidia.com.'};
 }
 if(status===401||status===403){
  return {kind:'authentication',blocked:true,
   message:'NVIDIA hosted inference rejected this API key or its permissions (HTTP '+status+'). Check your NVIDIA Build API key and account access.'};
 }
 if(status===404){
  return {kind:'model_unavailable',blocked:true,
   message:'NVIDIA hosted inference returned HTTP 404 for the model endpoint. Verify the model ID and your account’s endpoint access.'};
 }
 if(status===429){
  return {kind:'rate_limited',blocked:false,
   message:'NVIDIA hosted inference is rate limited (HTTP 429). Try again later.'};
 }
 return {kind:'provider_error',blocked:status>=400&&status<500,
  message:'NVIDIA hosted inference failed with HTTP '+status+'. Check the model endpoint, quota or NVIDIA service status.'};
}
