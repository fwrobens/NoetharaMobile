import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAgentProvider, completionRequest, NVIDIA_DEFAULT } from './providers.mjs';
import { inspectQuality, summarizeCritique } from './orchestration.mjs';
import { readFile } from 'node:fs/promises';

test('Beam routes only when server has a Beam key, with explicit fallback otherwise',()=>{
  const beam=chooseAgentProvider('Beam-1.0-501B-A23B',{NOETHARA_BEAMAI_API_KEY:'fake-beam'});
  assert.equal(beam.provider,'beam');
  assert.equal(beam.model,'Beam-1.0-501B-A23B');
  assert.match(beam.endpoint,/reflection\.ai/);
  const fallback=chooseAgentProvider('Beam-1.0-501B-A23B',{NOETHARA_NVIDIA_API_KEY:'fake-nvidia'});
  assert.equal(fallback.provider,'nvidia');
  assert.equal(fallback.model,NVIDIA_DEFAULT);
  assert.match(fallback.fallback,/not configured/);
  assert.throws(()=>chooseAgentProvider('Beam-1.0-501B-A23B',{}),/No coding provider/);
});
test('NVIDIA model choice keeps selected model and enforces credentials',()=>{
  const id='nvidia/nemotron-3-ultra-550b-a55b';
  const p=chooseAgentProvider(id,{NOETHARA_NVIDIA_API_KEY:'fake'});
  assert.equal(p.model,id);
  assert.equal(completionRequest(p,[],[],1024).max_tokens,1024);
  assert.throws(()=>chooseAgentProvider(id,{}),/missing/);
});
test('quality gate enforces real verification, preview and visual reviews',()=>{
  const base={dirty:true,checks:{},reviews:0};
  assert.equal(inspectQuality(base).stage,'verify');
  base.dirty=false;base.checks.typecheck='passed';base.checks.build='passed';
  assert.equal(inspectQuality(base).stage,'preview');
  base.checks.preview='ready';
  assert.equal(inspectQuality(base).stage,'ready');
  assert.equal(inspectQuality(base,{vision:true}).stage,'review');
  base.reviews=1;base.qualityFixRequested=true;
  assert.equal(inspectQuality(base,{vision:true}).stage,'refine');
  base.qualityFixRequested=false;
  assert.equal(inspectQuality(base,{vision:true}).stage,'ready');
});
test('visual critic parses score and real browser defects',()=>{
  assert.deepEqual(summarizeCritique('SCORE: 9/10\nBROKEN: none\nIMPROVE: spacing',[]),
    {score:9,broken:'none',needsFix:false,runtimeIssues:false});
  const bad=summarizeCritique('SCORE: 6/10\nBROKEN: clipped header\nIMPROVE: buttons',[]);
  assert.equal(bad.needsFix,true);
  assert.match(bad.broken,/clipped/);
  assert.equal(summarizeCritique('SCORE: 9/10\nBROKEN: none', [{emptyBody:true}]).needsFix,true);
});
test('premium React and React Native component kits are wired into the templates',async()=>{
  const paths=['react-web/src/components/Premium.tsx','react-native/src/components/Premium.tsx'];
  for(const p of paths){
    const text=await readFile(new URL('./templates/'+p,import.meta.url),'utf8');
    for(const component of ['PremiumCard','PremiumButton','PremiumInput','PremiumBadge','PremiumSection','PremiumSheet'])
      assert.match(text,new RegExp('export function '+component));
  }
  for(const p of ['react-web/src/App.tsx','react-native/src/App.tsx']){
    const text=await readFile(new URL('./templates/'+p,import.meta.url),'utf8');
    assert.match(text,/PremiumCard/);
    assert.match(text,/PremiumButton/);
  }
});
