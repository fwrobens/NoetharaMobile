// Deterministic quality gates independent of whatever the AI says it did.
// The model may propose code; it cannot mark a failed build as verified.
export function inspectQuality(job,{frontend=true,vision=false,maxReviews=2}={}){
 const checks=job.checks||{};
 if(job.dirty||checks.typecheck!=='passed'||checks.build!=='passed'){
   if(job.dirty||checks.build==='failed'||checks.typecheck==='failed')
     return {stage:'verify',instruction:'Quality gate: source changed or a check failed. Inspect errors, run npm run typecheck then npm run build, and fix real failures before finishing.'};
   return {stage:'verify',instruction:'Quality gate: run npm run typecheck and npm run build, record their real results before reporting completion.'};
 }
 if(!frontend)return {stage:'ready'};
 if(checks.preview!=='ready')return {stage:'preview',instruction:'Build passed. Start the working preview with start_preview and verify the process is healthy.'};
 if(vision&&(!job.reviews||job.qualityFixRequested)){
   if(job.qualityFixRequested){
     return {stage:'refine',instruction:'Design quality gate: the last visual critic found issues. Fix the top actionable findings from the previous review, rerun typecheck/build, and request another review. Keep existing working behavior.'};
   }
   return {stage:'review',instruction:'Quality gate: call review_design on the working preview, inspect mobile and desktop screenshots, then address visual defects.'};
 }
 return {stage:'ready'};
}
export function summarizeCritique(text,shots=[],minScore=8){
 const raw=String(text||'');
 const scoreMatch=/^SCORE:\s*(\d+(?:\.\d+)?)\s*\/10/im.exec(raw);
 const score=scoreMatch?Math.min(10,Math.max(0,Number(scoreMatch[1]))):null;
 const broken=raw.match(/BROKEN:\s*([\s\S]*?)(?=^IMPROVE:|^KEEP:|$)/im)?.[1]?.trim()||'';
 const noBroken=/^(?:none|no issues|n\/a)\.?$/i.test(broken);
 const runtimeIssues=shots.some(s=>s.overflowX||s.emptyBody||(s.errors||[]).length>0);
 const needsFix=runtimeIssues||Boolean(broken&&!noBroken)||(score!==null&&score<minScore);
 return {score,broken:broken.slice(0,1400),needsFix,runtimeIssues};
}
export function refinementBudget(job,max=2){
 return Math.max(0,max-(job.refinements||0));
}
