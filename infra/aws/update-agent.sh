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

# Headless Chromium for screenshot design reviews (optional; agent works without it).
if [ -d runtime/node_modules/playwright ]; then
  echo "Installing Chromium for design reviews"
  (cd runtime && npx playwright install chromium >/dev/null 2>&1) || echo "WARN: Chromium download failed"
  if sudo -n true 2>/dev/null; then
    (cd runtime && sudo -n env "PATH=$PATH" npx playwright install-deps chromium >/dev/null 2>&1) || echo "WARN: Chromium system libraries failed to install"
  else
    echo "NOTE: run once with sudo:  cd ~/NoetharaMobile/runtime && sudo env \"PATH=\$PATH\" npx playwright install-deps chromium"
  fi
  node --input-type=module -e "import('playwright').then(p=>p.chromium.launch({args:['--no-sandbox']})).then(b=>{console.log('Design review browser: OK');return b.close()}).catch(e=>console.log('Design review browser: unavailable -',String(e.message).split('\\n')[0]))" 2>/dev/null || true
fi

# Isolated per-project sandbox for agent shell commands (Docker).
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Building sandbox image noethara/devbox:latest (first time takes a few minutes)"
  docker build -q -t noethara/devbox:latest -f infra/aws/devbox.Dockerfile infra/aws || echo "WARN: sandbox image build failed; agent falls back to npm-only commands"
else
  echo "NOTE: Docker is not usable by $USER, so agent shell commands are disabled (npm steps still work)."
  echo "      Enable once:  sudo apt-get update && sudo apt-get install -y docker.io && sudo usermod -aG docker $USER"
  echo "      then log out, log back in, and run this script again."
fi
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
