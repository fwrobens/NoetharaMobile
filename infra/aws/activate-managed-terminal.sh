#!/usr/bin/env bash
# Activate the Noethara managed terminal on the EXISTING Ubuntu EC2 instance.
# Run as ubuntu over SSH, after confirming the server identity.
# Never paste Supabase access tokens, Cloudflare tunnel tokens, or SSH keys into chat.
set -Eeuo pipefail
trap 'echo "[Noethara] Setup stopped at line $LINENO. Review the error above." >&2' ERR
[[ "$(id -un)" == "ubuntu" ]] || { echo 'Run as ubuntu, not root.' >&2;exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu ]] || {echo 'Expected Ubuntu.' >&2;exit 1;}
command -v pm2 >/dev/null || { echo 'Install PM2 before setup.' >&2;exit 1;}
command -v node >/dev/null || { echo 'Install Node.js before setup.' >&2;exit 1;}
command -v tmux >/dev/null || { echo 'Install tmux before setup.' >&2;exit 1;}
if [[ -d "$HOME/NoetharaMobile/.git" ]]; then
  REPO="$HOME/NoetharaMobile"
elif [[ -d "$HOME/noetharamobile/.git" ]]; then
  REPO="$HOME/noetharamobile"
else
  echo 'Clone fwrobens/NoetharaMobile to ~/NoetharaMobile first.' >&2
  exit 1
fi

printf '\nNoethara managed Linux gateway — one-time administrator setup\n'
printf 'Only a specifically allowed Supabase account will be able to run CLI commands.\n'
read -r -p 'Your Supabase Authentication user UUID: ' OWNER_UUID
if ! [[ "$OWNER_UUID" =~ ^[a-fA-F0-9-]{36}$ ]]; then
  echo 'Invalid UUID. Find it in Supabase Authentication > Users.' >&2;exit 1
fi

cd "$REPO"
git fetch origin main
git pull --ff-only origin main
cd "$REPO/runtime"
if [[ -f package-lock.json ]]; then npm ci --omit=dev
else npm install --omit=dev
fi

printf 'Writing owner-only runtime configuration...\n'
umask 077
install -d -m 0700 "$HOME/.config/noethara"
cat > "$HOME/.config/noethara/managed.env" <<CONF
NOETHARA_SUPABASE_URL=https://smiubazuuptrknffmouo.supabase.co
NOETHARA_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ICF2HJRBUEPXuXgryB70tw_CG2Cyr-a
NOETHARA_ALLOWED_USER_IDS=$OWNER_UUID
NOETHARA_WORKSPACE=$REPO
CONF
chmod 600 "$HOME/.config/noethara/managed.env"
# Legacy credential previously shown in a screenshot must never authenticate
# the new gateway. The new server does not consume NOETHARA_TERMINAL_TOKEN.
set -a
# shellcheck source=/dev/null
source "$HOME/.config/noethara/managed.env"
set +a
unset NOETHARA_TERMINAL_TOKEN || true
pm2 stop noethara-runtime >/dev/null 2>&1 || true
pm2 delete noethara-terminal >/dev/null 2>&1 || true
pm2 start "$REPO/runtime/server.mjs" --name noethara-terminal --cwd "$REPO/runtime"
pm2 save

printf '\nChecking private gateway startup...\n'
sleep 2
pm2 describe noethara-terminal | head -n 25
curl --fail --silent --show-error --max-time 5 -o /dev/null -w 'Unauthenticated /status HTTP %{http_code} (expected 401)\n' http://127.0.0.1:8789/status
echo 'Installing Cloudflare Tunnel connector (not opening a public port)...'
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL -o /tmp/noethara-cloudflared.deb \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i /tmp/noethara-cloudflared.deb
  rm -f /tmp/noethara-cloudflared.deb
fi
printf '\nOpen Cloudflare Zero Trust -> Networks -> Tunnels -> noethara-terminal -> Install connector.\n'
printf 'The tunnel token stays on this EC2 machine, not in the Expo app.\n'
read -r -s -p 'Cloudflare Tunnel connector token (hidden): ' TUNNEL_TOKEN
printf '\n'
[[ -n "$TUNNEL_TOKEN" ]] || {echo 'Tunnel token required.' >&2;exit 1;}
if systemctl is-enabled cloudflared >/dev/null 2>&1;then
  echo 'Cloudflared service already exists; leaving its credentials unchanged.'
else
  sudo cloudflared service install "$TUNNEL_TOKEN"
fi
unset TUNNEL_TOKEN
sudo systemctl enable --now cloudflared
sudo systemctl --no-pager status cloudflared | head -n 18
printf '\nIMPORTANT: If Nginx is exposing port 8789 over public HTTP/80, disable that old proxy.\n'
if sudo nginx -T 2>/dev/null | grep -Eq 'proxy_pass[[:space:]]+http://127[.]0[.]0[.]1:8789'; then
  echo 'WARNING: Detected a public Nginx terminal reverse proxy. Restrict inbound port 80 in AWS immediately and remove that proxy.' >&2
fi
printf 'Server setup staged. Ask ChatGPT to verify the Cloudflare Tunnel is healthy before publishing DNS.\n'
