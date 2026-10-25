// Vision for the coding agent: look at user images, screenshot the running preview
// at phone/tablet/desktop sizes and get a design critique from a vision-capable model.
// The main coding model can stay text-only; it receives the vision model's findings.
import { readFile, lstat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

// NVIDIA documents this endpoint as supporting images, text, coding and tool use.\nconst VISION_MODEL=()=>process.env.NOETHARA_VISION_MODEL||'nvidia/nemotron-3.5-super-vl-120b-a12b';
const ENDPOINT=()=>process.env.NOETHARA_VISION_ENDPOINT||'https://integrate.api.nvidia.com/v1/chat/completions';
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
let pw=null,browserPromise=null;
async function loadPlaywright(){
 if(pw!==null)return pw;
 try{pw=(await import('playwright')).chromium}catch{pw=false}
 return pw;
}
async function browser(){
 const chromium=await loadPlaywright();
 if(!chromium)throw Error('Screenshot review unavailable: Playwright is not installed (run infra/aws/update-agent.sh).');
 if(!browserPromise)browserPromise=chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']}).catch(e=>{browserPromise=null;throw e});
 const b=await browserPromise;
 if(!b.isConnected()){browserPromise=null;return browser()}
 return b;
}
export async function visionStatus(){
 const key=process.env.NOETHARA_NVIDIA_API_KEY||process.env.NVIDIA_API_KEY;
 const off=process.env.NOETHARA_VISION==='off';
 return {images:Boolean(key)&&!off,screenshots:Boolean(key)&&!off&&Boolean(await loadPlaywright()),model:VISION_MODEL()};
}
// Re-encode large images as a smaller JPEG so inline data URIs stay within provider limits.
async function toDataUri(buf,mime){
 if(buf.length<=160000)return 'data:'+mime+';base64,'+buf.toString('base64');
 if(!await loadPlaywright())return 'data:'+mime+';base64,'+buf.toString('base64');
 const page=await (await browser()).newPage({viewport:{width:900,height:900}});
 try{
  await page.setContent('<html><body style="margin:0;background:#fff"><img id="i" style="display:block;max-width:900px;height:auto" src="data:'+mime+';base64,'+buf.toString('base64')+'"></body></html>');
  await page.waitForFunction(()=>document.getElementById('i')?.complete,null,{timeout:8000});
  const shot=await page.locator('#i').screenshot({type:'jpeg',quality:68});
  return 'data:image/jpeg;base64,'+shot.toString('base64');
 }finally{await page.close().catch(()=>{})}
}
export async function askVision(key,prompt,images,{maxTokens=1600}={}){
 const content=[{type:'text',text:prompt}];
 for(const img of images.slice(0,4)){content.push({type:'text',text:img.label});content.push({type:'image_url',image_url:{url:img.dataUri}})}
 let last;
 for(let attempt=0;attempt<3;attempt++){
  let resp;
  try{
   resp=await fetch(ENDPOINT(),{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({model:VISION_MODEL(),messages:[{role:'user',content}],temperature:0.2,max_tokens:maxTokens,stream:false,
     chat_template_kwargs:{enable_thinking:false}}),signal:AbortSignal.timeout(120000)});
  }catch(e){last=Error('Vision model unreachable: '+(e.message||e));continue}
  if(resp.ok){
   const data=await resp.json();
   const text=String(data.choices?.[0]?.message?.content||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim();
   if(text)return text;
   last=Error('Vision model returned an empty answer');continue;
  }
  const detail=(await resp.text().catch(()=>'')).slice(0,240);
  last=Error('Vision model HTTP '+resp.status+': '+detail);
  if(![408,429,500,502,503,504].includes(resp.status))break;
  await new Promise(r=>setTimeout(r,2000*(attempt+1)));
 }
 throw last;
}
// Image files the user attached (paths inside the workspace mentioned in the message).
export function findImagePaths(text){
 const found=new Set();
 for(const m of String(text).matchAll(/uploaded to:\s*([^\n]+)/gi))
  for(const part of m[1].split(/,\s*/))if(/\.(?:png|jpe?g|webp|gif)$/i.test(part.trim().replace(/[.;]+$/,'')))found.add(part.trim().replace(/[.;]+$/,''));
 for(const m of String(text).matchAll(/(?:^|[\s,:'"(])((?:[\w.-]+\/)*[\w. -]*?[\w-]\.(?:png|jpe?g|webp|gif))\b/gi))found.add(m[1].trim());
 return [...found].slice(0,3);
}
export async function describeImages(key,dir,paths){
 const images=[];
 for(const p of paths){
  const full=resolve(dir,p);
  if(!full.startsWith(dir+sep))continue;
  try{const st=await lstat(full);if(!st.isFile()||st.isSymbolicLink()||st.size>12e6)continue}catch{continue}
  images.push({label:'Image: '+p,dataUri:await toDataUri(await readFile(full),MIME[extname(full).toLowerCase()]||'image/png')});
 }
 if(!images.length)return '';
 return await askVision(key,'The user attached these images to a coding request. For each image, describe precisely what a front-end engineer needs to reproduce or use it: '+
  'layout structure top to bottom, components, exact visible text, colors (hex estimates), typography (sizes/weights), spacing, corner radii, icons, imagery, and states. '+
  'If it is a screenshot of a bug or error, transcribe the error text exactly. Be concrete and compact.',images,{maxTokens:2000});
}
export const SIZES={phone:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},tablet:{width:820,height:1180,isMobile:true,hasTouch:true,deviceScaleFactor:1},desktop:{width:1280,height:800,deviceScaleFactor:1}};
export async function screenshotPreview(url,names=['phone','desktop']){
 const b=await browser();
 const shots=[];
 for(const name of names){
  const size=SIZES[name];
  const ctx=await b.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:size.deviceScaleFactor,isMobile:Boolean(size.isMobile),hasTouch:Boolean(size.hasTouch)});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+String(e.message).slice(0,300)));
  page.on('console',m=>{if(m.type()==='error')errors.push('console.error: '+m.text().slice(0,300))});
  page.on('requestfailed',r=>errors.push('request failed: '+r.url().slice(-120)+' '+(r.failure()?.errorText||'')));
  try{
   await page.goto(url,{waitUntil:'load',timeout:25000}).catch(e=>errors.push('load: '+String(e.message).split('\n')[0].slice(0,200)));
   // Dev servers keep an HMR socket open, so "network idle" is best effort only.
   await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
   await page.waitForTimeout(700);
   const layout=await page.evaluate(()=>({overflowX:document.documentElement.scrollWidth>window.innerWidth+1,scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,emptyBody:(document.body?.innerText||'').trim().length===0}));
   const shot=await page.screenshot({type:'jpeg',quality:62});
   shots.push({name,width:size.width,height:size.height,...layout,errors:[...new Set(errors)].slice(0,8),dataUri:'data:image/jpeg;base64,'+shot.toString('base64')});
  }finally{await ctx.close().catch(()=>{})}
 }
 return shots;
}
export const REVIEW_PROMPT=`You are a demanding senior product designer reviewing screenshots of an app or website that an AI engineer just built. Judge it against a premium standard (Linear, Stripe, Apple quality).
Return a compact review in this exact shape:
SCORE: n/10
BROKEN: bullet list of anything visibly broken (overlapping or clipped elements, text overflowing, horizontal scrolling, invisible text, misaligned grids, empty or blank areas, unstyled defaults). Write "none" if nothing.
IMPROVE: the 5 highest-impact concrete changes, most important first. Each must name the element and give exact values (e.g. "Hero title: 40px -> 32px on phone, weight 700, letter-spacing -0.02em"; "Cards: add 16px padding, 20px radius, 1px #ECECF2 border").
KEEP: one line on what already works.
Check real screenshot evidence, not just whether the page compiles. Flag illegible text, odd scale, no responsive hierarchy, excessive blank space and unsafe claims/fictional certifications presented as fact.
Do not write code. Do not invent elements that are not in the screenshots.`;
