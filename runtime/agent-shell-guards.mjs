// Prevent the coding model from bypassing Noethara's managed Vite preview by
// launching competing dev servers inside the workspace's Docker container.
// Normal backend APIs remain allowed to use start_process.
export function isManagedViteCommand(command,manifest={}){
 const dev=String(manifest?.scripts?.dev||'').trim();
 const vite=/^(?:vite|npx\s+vite)(?:\s|$)/i.test(dev);
 if(!vite)return false;
 const c=String(command||'').trim();
 return /\bnpm\s+(?:run\s+dev|start)\b|\bnpx\s+vite\b|\b(?:pnpm\s+(?:dev|run\s+dev)|yarn\s+dev)\b|(?:^|[\s;&|])vite\s+(?:--host|--port)/i.test(c);
}
export function assertNoDuplicatePreview(command,manifest={}){
 if(isManagedViteCommand(command,manifest)){
  throw Error('Managed Vite preview already exists. Use start_preview instead of starting vite-dev/npm run dev or running curl manually. No approval is needed for start_preview after a verified build.');
 }
}
export function npmTestAvailable(manifest){
 return Boolean(manifest?.scripts&&typeof manifest.scripts.test==='string'&&manifest.scripts.test.trim());
}
