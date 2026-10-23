#!/usr/bin/env bash
# Install the AI coding CLI programs on an already-running Noethara EC2 host.
# Owner-only; does not create instances or change Cloudflare, IAM or DNS.
set -Eeuo pipefail
trap 'echo "[Noethara] CLI setup failed at line $LINENO. See the error above." >&2' ERR

if [[ "$(id -un)" != "ubuntu" ]]; then
  echo 'Sign into your EC2 instance as ubuntu (not root).' >&2
  exit 1
fi
for bin in node npm pm2; do
  command -v "$bin" >/dev/null || { echo "Missing $bin; install Node.js and PM2 first." >&2; exit 1; }
done
if (( $(node -p "Number(process.versions.node.split('.')[0])") < 20 )); then
  echo 'Node.js 20+ is required; use the installed LTS Node.js version.' >&2
  exit 1
fi

# Never use sudo npm install -g. Keep installed CLIs owned by ubuntu.
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

printf '\nInstalling coding CLIs as ubuntu (no API keys required just to install)...\n'
npm install --global --no-audit --no-fund opencode-ai @openai/codex @anthropic-ai/claude-code
hash -r

printf '\nVerifying installed commands:\n'
for cli in opencode codex claude; do
  if ! command -v "$cli" >/dev/null; then
    echo "$cli was not installed in PATH. Check npm output above." >&2
    exit 1
  fi
  "$cli" --version
done

# Refresh both the checked-in gateway source and PM2 process environment.
# Auth remains restricted to NOETHARA_ALLOWED_USER_IDS; no port changes.
if ! pm2 describe noethara-terminal >/dev/null 2>&1; then
  echo 'PM2 process noethara-terminal was not found; run the managed terminal activation script first.' >&2
  exit 1
fi
pm2 restart noethara-terminal --update-env
pm2 save

STATUS=$(curl --silent --show-error --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8789/status)
printf '\nLocal unauthenticated gateway status: HTTP %s (expected 401)\n' "$STATUS"
if [[ "$STATUS" != "401" ]]; then
  echo 'Gateway security check failed. Do not make the service public.' >&2
  exit 1
fi

printf '\nCLI installation finished. Reopen OpenCode, Codex or Claude Code on your iPhone.\n'
printf 'Each CLI may separately require signing into its official provider account.\n'
printf 'Authenticate from your private EC2 Ubuntu session only; never paste tokens into chat.\n'
