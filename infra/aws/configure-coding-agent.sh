#!/usr/bin/env bash
# One-time private NVIDIA credential setup for the owner-only AWS coding agent.
# NEVER paste API keys into GitHub, chat, terminal commands or screenshots.
set -Eeuo pipefail
umask 077
[[ "$(id -un)" == ubuntu ]] || { echo 'Run as ubuntu on the existing EC2 instance.' >&2; exit 1; }
REPO="$HOME/NoetharaMobile"
[[ -f "$REPO/infra/aws/update-managed-workspaces.sh" ]] || {
 echo 'Run git pull --ff-only origin main from ~/NoetharaMobile first.' >&2; exit 1;
}
config_dir="$HOME/.config/noethara"
mkdir -p -m 0700 "$config_dir"
chmod 700 "$config_dir"
config="$config_dir/runtime.env"
touch "$config"
chmod 600 "$config"
printf 'Enter your NVIDIA API key in this private EC2 session (hidden while typing).\n'
printf 'It must be the actual key, not the variable name NVIDIA_API_KEY.\n'
IFS= read -r -s -p 'NVIDIA key: ' key
printf '\n'
if [[ ! "$key" =~ ^[A-Za-z0-9._-]{20,512}$ ]]; then
 unset key
 echo 'Invalid key format. Nothing was updated.' >&2
 exit 1
fi
temp="$(mktemp "$config_dir/.runtime.env.XXXXXXXX")"
cleanup(){ rm -f "$temp"; }
trap cleanup EXIT
chmod 600 "$temp"
# Preserve other environment variables and remove only prior NVIDIA entries.
awk '!/^NOETHARA_NVIDIA_API_KEY=/ && !/^NVIDIA_API_KEY=/' "$config" > "$temp"
printf 'NOETHARA_NVIDIA_API_KEY=%s\n' "$key" >> "$temp"
unset key
mv -f "$temp" "$config"
trap - EXIT
echo 'Key saved in the private runtime.env file (not displayed).'
echo 'Restarting the managed gateway using its existing owner-only Supabase authorization…'
bash "$REPO/infra/aws/update-managed-workspaces.sh"
echo 'AWS model credential configured. Reopen the existing Noethara workspace chat.'
