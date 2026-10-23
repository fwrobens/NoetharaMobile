#!/usr/bin/env bash
# Run over SSH as ubuntu on the EXISTING Noethara EC2 VM 18.226.87.72 (us-east-2).
# Idempotent bootstrap; DOES NOT create AWS resources or modify SSH access rules.
set -Eeuo pipefail
trap 'echo "[Noethara] Bootstrap failed at line $LINENO" >&2' ERR
export DEBIAN_FRONTEND=noninteractive
REPO_ROOT="$HOME/noetharamobile"
REPO_URL="https://github.com/fwrobens/NoetharaMobile.git"
EXPECTED_USER=ubuntu
log(){ printf '\n[Noethara] %s\n' "$*"; }
if [ "$(id -un)" != "$EXPECTED_USER" ]; then
  echo 'Run as the ubuntu user, not root. Script uses sudo where needed.' >&2
  exit 1
fi
. /etc/os-release
if [ "$ID" != ubuntu ] || [ "$VERSION_ID" != 22.04 ]; then
  echo "Expected Ubuntu 22.04, detected $PRETTY_NAME. Stopping to avoid unexpected package changes." >&2
  exit 1
fi
log 'Installing base utilities, Python 3, Git, Nginx and tmux'
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git python3 python3-pip python3-venv nginx tmux jq openssl util-linux
sudo install -d -m 0755 /etc/apt/keyrings

log 'Configuring official Docker apt repository'
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
fi
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo 'Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: jammy
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc' | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$EXPECTED_USER"

log 'Installing Node.js 24 LTS and PM2'
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  sudo chmod a+r /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main' |
    sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y nodejs
fi
sudo npm install --global pm2

log 'Pulling NoetharaMobile code'
if [ -d "$REPO_ROOT/.git" ]; then
  git -C "$REPO_ROOT" fetch --prune origin main
  git -C "$REPO_ROOT" pull --ff-only origin main
elif [ -e "$REPO_ROOT" ]; then
  echo "A non-Git folder already exists at $REPO_ROOT. No files were overwritten." >&2
  exit 1
else
  export GIT_TERMINAL_PROMPT=0
  if ! git clone --single-branch --branch main "$REPO_URL" "$REPO_ROOT"; then
    rm -rf "$REPO_ROOT"
    echo 'GitHub clone failed. If private, add a read-only GitHub deploy key to this EC2 user and clone via git@github.com:fwrobens/NoetharaMobile.git.' >&2
    exit 1
  fi
fi

log 'Installing the Noethara terminal bridge'
cd "$REPO_ROOT/runtime"
if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund
else npm install --omit=dev --no-audit --no-fund
fi

log 'Installing OpenCode, Codex and Claude CLI executables'
sudo npm install --global opencode-ai @openai/codex @anthropic-ai/claude-code

log 'Starting Noethara services (managed terminal requires one-time activation)'
if [ -f "$HOME/.config/noethara/managed.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$HOME/.config/noethara/managed.env"
  set +a
  pm2 delete noethara-terminal >/dev/null 2>&1 || true
  pm2 start "$REPO_ROOT/runtime/server.mjs" --name noethara-terminal --cwd "$REPO_ROOT/runtime"
else
  log 'Supabase-authenticated gateway not yet activated; run infra/aws/activate-managed-terminal.sh'
fi
if pm2 describe noethara-health >/dev/null 2>&1; then
  pm2 restart noethara-health --update-env
else
  pm2 start "$REPO_ROOT/runtime/health.mjs" --name noethara-health --cwd "$REPO_ROOT/runtime"
fi
pm2 save
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u ubuntu --hp /home/ubuntu

log 'Configuring a restricted Nginx reverse proxy without overwriting other sites'
sudo tee /etc/nginx/sites-available/noethara-runtime >/dev/null <<'NGINX'
server {
    listen 80;
    server_name 18.226.87.72;
    client_max_body_size 1m;
    access_log /var/log/nginx/noethara-access.log;
    error_log /var/log/nginx/noethara-error.log;

    location = /health {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass http://127.0.0.1:3000/health;
    }
    location / {
        return 503 "Noethara private terminal requires HTTPS, a domain, and access control";
    }
}
NGINX
sudo ln -sfn /etc/nginx/sites-available/noethara-runtime /etc/nginx/sites-enabled/noethara-runtime
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

log 'Installed versions and status'
node --version
npm --version
python3 --version
git --version
docker --version
docker compose version
nginx -v
pm2 --version
pm2 list
log 'Health check (local only)'
curl -fsS http://127.0.0.1:3000/health
printf '\n'
log 'Finished. Activate the owner-authorized bridge with infra/aws/activate-managed-terminal.sh.'
log 'Add a private TLS/WSS proxy, domain, and CLI login before using the mobile remote terminals.'
log 'No shared terminal token is used. Supabase authentication is required.'
