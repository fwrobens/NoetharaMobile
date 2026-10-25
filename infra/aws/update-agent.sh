#!/usr/bin/env bash
# Pull the latest NoetharaMobile runtime on EC2, test it and restart the gateway.
# Usage (on the EC2 instance):  bash ~/NoetharaMobile/infra/aws/update-agent.sh
set -euo pipefail
REPO="${NOETHARA_REPO:-$HOME/NoetharaMobile}"
cd "$REPO"
echo '==> Pulling latest main'
git pull --ff-only origin main
echo '==> Installing runtime dependencies'
npm install --prefix runtime --no-audit --no-fund
echo '==> Syntax + unit tests'
node --check runtime/server.mjs
node --check runtime/agent.mjs
node --test runtime/agent.test.mjs runtime/workspaces.test.mjs
command -v tmux >/dev/null || { echo 'tmux missing: sudo apt-get install -y tmux' >&2; exit 1; }
echo '==> Restarting gateway'
pm2 restart noethara-terminal --update-env
pm2 save
sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8789/status || true)
echo "Gateway health (401 = running and protected): $code"
pm2 logs noethara-terminal --lines 15 --nostream || true
echo 'Done. Optional: set NOETHARA_AGENT_MODEL / NOETHARA_AGENT_MAX_TOKENS in the runtime env, then rerun.'
