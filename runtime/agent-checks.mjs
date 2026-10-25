// Trust verified tool results over optimistic language in the AI's plan.
export function invalidateChecks(job){
 job.dirty=true;
 for(const key of ['typecheck','build','preview','style'])delete job.checks[key];
 job.qualityFixRequested=false;
 job._previewNudged=false;
 job._designNudged=false;
}
export function recordCheck(job,key,status){
 job.checks[key]=status;
 if(status==='failed')job.dirty=true;
 if(key==='build'&&status==='passed'&&job.checks.typecheck==='passed')job.dirty=false;
 if(key==='typecheck'&&status==='passed'&&job.checks.build==='passed')job.dirty=false;
 reconcilePlan(job);
}
export function reconcilePlan(job){
 for(const step of job.plan||[]){
  const title=String(step.title||'').toLowerCase();
  if(!/(typecheck|typescript|\btypes\b|build|preview|screenshot|critic|visual review)/.test(title))continue;
  const conditions=[];
  if(/typecheck|typescript|\btypes\b/.test(title))conditions.push(job.checks.typecheck==='passed');
  if(/\bbuild\b/.test(title))conditions.push(job.checks.build==='passed');
  if(/preview/.test(title))conditions.push(job.checks.preview==='ready');
  if(/screenshot|critic|visual review/.test(title))conditions.push((job.reviews||0)>0);
  if(conditions.length&&conditions.every(Boolean)&&!job.dirty)step.status='done';
  else if(step.status==='done'&&(!conditions.every(Boolean)||job.dirty))step.status='pending';
 }
}
