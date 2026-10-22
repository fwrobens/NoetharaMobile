#!/usr/bin/env bash
# Run ON your EC2 VM as ubuntu, after you have authorized read-only access
# to the private repository using a GitHub deploy SSH key.
set -euo pipefail
if [[ "$(id -un)" != "ubuntu" ]]; then
  echo 'Run this as the ubuntu account, not as root.' >&2; exit 1
fi
command -v git >/dev/null
command -v tmux >/dev/null
command -v node >/dev/null
command -v pm2 >/dev/null
command -v npm >/dev/null
mkdir -p /opt/noethara/source "$HOME/.config/noethara" "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
# Private repo cloning needs a GitHub deploy key or an authorized SSH agent.
# Do not put the GitHub or AWS access key in UserData or this script.
if [[ ! -f /opt/noethara/source/package.json ]]; then
  if [[ -z "$(ls -A /opt/noethara/source)" ]]; then
    git clone --depth 1 git@github.com:fwrobens/NoetharaMobile.git /opt/noethara/source
  else
    echo 'Source directory is not empty. Clone manually, then retry.' >&2
    exit 1
  fi
fi
cd /opt/noethara/source/runtime
npm install --omit=dev
# CLI binaries are installed but require their own official account setup.
npm install -g opencode-ai @openai/codex @anthropic-ai/claude-code
if [[ ! -f "$HOME/.config/noethara/terminal.env" ]]; then
  umask 077
  echo "NOETHARA_TERMINAL_TOKEN=$(openssl rand -hex 32)" > "$HOME/.config/noethara/terminal.env"
  echo "NOETHARA_WORKSPACE=/opt/noethara/source" >> "$HOME/.config/noethara/terminal.env"
fi
set -a
# shellcheck source=/dev/null
source "$HOME/.config/noethara/terminal.env"
set +a
pm2 delete noethara-terminal >/dev/null 2>&1 || true
pm2 start /opt/noethara/source/runtime/server.mjs --name noethara-terminal
pm2 save
printf '\nRuntime installed. Status:\n'
pm2 status
printf '\nPrivate terminal credential stored locally at %s\n' "$HOME/.config/noethara/terminal.env"
printf 'Do not publish the raw port 8789. Configure an authenticated TLS reverse proxy or a private VPN first.\n'
printf 'Authenticate each CLI interactively from the SSH terminal; never paste credentials into ChatGPT.\n'
