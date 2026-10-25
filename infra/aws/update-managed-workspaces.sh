#!/usr/bin/env bash
# Safe in-place update for the existing EC2 Noethara runtime.
# Run as ubuntu after git pull --ff-only. Does not touch Cloudflare credentials,
# unrelated PM2 apps, system services, GitHub tokens or Supabase secrets.
set -euo pipefail
if [[ "$(id -un)" != ubuntu ]]; then
  echo "Run as ubuntu on the existing Noethara EC2 instance." >&2
  exit 1
fi
cd "$HOME/NoetharaMobile"
node --check runtime/server.mjs
node --check runtime/workspaces.mjs
node --test runtime/workspaces.test.mjs
command -v pm2 >/dev/null || { echo "PM2 missing" >&2; exit 1; }
pm2 describe noethara-runtime >/dev/null || {
  echo "Existing noethara-runtime PM2 process not found. Do not create an unconfigured public shell service." >&2
  exit 1
}
pm2 restart noethara-runtime --update-env
pm2 save >/dev/null
CODE=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 8 http://127.0.0.1:8789/status)
if [[ "$CODE" != 401 ]]; then
  echo "Gateway local check failed (expected authenticated status 401, received $CODE)" >&2
  pm2 logs noethara-runtime --lines 20 --nostream || true
  exit 1
fi
echo 'Noethara runtime restarted. Private /status correctly requires authorization.'
echo 'Use the Noethara iOS app to test authenticated workspaces and the terminal.'
