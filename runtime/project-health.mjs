// Inspect the shipped Vite project, not the model's claim that it looks styled.
// A build can succeed with no imported CSS and still show an unstyled website.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const read=async file=>readFile(file,'utf8').catch(()=>null);
export async function checkWebStyling(dir){
 const pkg=await read(join(dir,'package.json'));
 if(!pkg)return {ok:true,skipped:true,reason:'No package.json yet'};
 let dependencies={};
 try{const manifest=JSON.parse(pkg);dependencies={...manifest.dependencies,...manifest.devDependencies}}
 catch{return {ok:false,reason:'package.json is invalid JSON'};}
 if(!dependencies.vite||dependencies['react-native-web'])
  return {ok:true,skipped:true,reason:'Not a React web Vite project'};
 const entries=['src/main.tsx','src/main.jsx','src/App.tsx','src/App.jsx','src/main.ts','src/main.js'];
 const imports=[];
 for(const path of entries){
  const content=await read(join(dir,path));
  if(!content)continue;
  for(const match of content.matchAll(/(?:import\s+(?:[^;\n]+?\s+from\s+)?|import\s*\(\s*)['"]([^'"]+\.css)['"]/g))
   imports.push({from:path,css:match[1]});
 }
 if(!imports.length)return {ok:false,reason:'No CSS stylesheet imported in the Vite entry/App. Import ./styles.css from src/main.tsx or import a real component stylesheet before preview.'};
 const styles=await read(join(dir,'src/styles.css'));
 if(styles!==null&&styles.trim().length<90)
  return {ok:false,reason:'src/styles.css is empty or nearly empty. Define real typography, layout, responsive surfaces and colors before calling the UI complete.'};
 const assets=await readdir(join(dir,'dist','assets')).catch(()=>null);
 if(assets!==null&&!assets.some(filename=>filename.endsWith('.css')))
  return {ok:false,reason:'Production build contains no CSS asset. Verify the stylesheet import path and run npm run build again.'};
 return {ok:true,imported:imports.map(x=>x.css)};
}
