#!/usr/bin/env bash
# Update the existing owner-only Noethara EC2 gateway without touching Cloudflare.
set -Eeuo pipefail
trap 'echo "[Noethara] Update failed at line $LINENO." >&2' ERR
[[ "$(id -un)" == ubuntu ]] || { echo 'Run as ubuntu on EC2.' >&2; exit 1; }
REPO="$HOME/NoetharaMobile"
cd "$REPO"
node --check runtime/server.mjs
node --check runtime/workspaces.mjs
node --check runtime/agent.mjs
node --check runtime/preview.mjs
node --test runtime/workspaces.test.mjs
command -v pm2 >/dev/null || { echo 'PM2 is missing.' >&2; exit 1; }

# Original activation wrote managed.env, not runtime.env. Load both privately.
set -a
for file in "$HOME/.config/noethara/managed.env" "$HOME/.config/noethara/runtime.env"; do
 if [[ -f "$file" ]]; then
  chmod 600 "$file"
  # shellcheck disable=SC1090
  source "$file"
 fi
done
set +a
if [[ "${NOETHARA_SUPABASE_URL:-}" != https://* ||
      -z "${NOETHARA_SUPABASE_PUBLISHABLE_KEY:-}" ||
      ! "${NOETHARA_ALLOWED_USER_IDS:-}" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$ ]]; then
 echo 'Authorization config missing or invalid. Check ~/.config/noethara/managed.env (do not share its contents).' >&2
 echo 'Need NOETHARA_SUPABASE_URL, NOETHARA_SUPABASE_PUBLISHABLE_KEY, and exactly one NOETHARA_ALLOWED_USER_IDS UUID.' >&2
 exit 1
fi
export NOETHARA_WORKSPACE="${NOETHARA_WORKSPACE:-$REPO}" PORT=8789
unset NOETHARA_TERMINAL_TOKEN || true
(
 cd "$REPO/runtime"
 if [[ -f package-lock.json ]]; then npm ci --omit=dev --no-audit --no-fund
 else npm install --omit=dev --no-audit --no-fund
 fi
)

# Older scripts created two competing PM2 process names. Only manage a process
# if it points at this project's server.mjs; never stop unrelated services.
pm2 jlist | node -e '
let s="";process.stdin.on("data",b=>s+=b);process.stdin.on("end",()=>{
for(const p of JSON.parse(s||"[]").filter(p=>["noethara-runtime","noethara-terminal"].includes(p.name))){
 const path=String(p.pm2_env?.pm_exec_path||"");
 if(!path.endsWith("/runtime/server.mjs")){
  console.error("Unexpected PM2 service path for "+p.name+": "+path);
  process.exitCode=1;
 }
}
});'
if pm2 describe noethara-runtime >/dev/null 2>&1; then
 pm2 stop noethara-runtime >/dev/null
 echo '[Noethara] Stopped legacy runtime.'
fi
if pm2 describe noethara-terminal >/dev/null 2>&1; then
 pm2 delete noethara-terminal >/dev/null
fi
pm2 start "$REPO/runtime/server.mjs" --name noethara-terminal --cwd "$REPO/runtime" --update-env
sleep 2
status_code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 8 http://127.0.0.1:8789/status) || status_code=000
workspace_code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 8 http://127.0.0.1:8789/workspaces) || workspace_code=000
printf '[Noethara] /status=%s /workspaces=%s (expected 401 and 401 without sign-in)\n' "$status_code" "$workspace_code"
if [[ "$status_code" != 401 || "$workspace_code" != 401 ]]; then
 echo 'Updated gateway did not pass security/route checks. Review these diagnostics:' >&2
 pm2 status
 pm2 logs noethara-terminal --lines 20 --nostream || true
 exit 1
fi
if pm2 describe noethara-runtime >/dev/null 2>&1; then
 pm2 delete noethara-runtime >/dev/null
fi
pm2 save >/dev/null
echo '[Noethara] Managed workspace gateway updated. Cloudflare and DNS unchanged.'
