## Update the coding agent (October 2026 upgrade)

On the EC2 instance (`noethara-server`):

```bash
bash ~/NoetharaMobile/infra/aws/update-agent.sh
```

That pulls `main`, installs runtime deps, runs the tests and restarts the `noethara-terminal` PM2 process.
What it ships: new agent prompts (`runtime/prompts/`), a verified React Native + TypeScript
template (`runtime/templates/react-native/`), plan/edit/scaffold tools, and the terminal PTY sizing fix.
Optional env (in the runtime env file, then rerun): `NOETHARA_AGENT_MODEL` (default
`nvidia/nemotron-3-super-120b-a12b`), `NOETHARA_AGENT_MAX_TOKENS` (default 16384).
Existing terminal sessions keep their old size until reconnect: `tmux -L noethara kill-server` once after updating.

# Managed Linux workspace via Cloudflare (October 2026)

**Cloudflare setup already created:** `noethara-terminal` (Tunnel ID `0e21ab61-7710-45ed-bd2f-ff7d5889751e`), configured to proxy `terminal.noethara.cloud` to `http://127.0.0.1:8789` on the EC2 host. The tunnel was verified active and the proxied DNS record published in October 2026. Check live status in Cloudflare when troubleshooting.

**Mobile behavior:** The Expo app automatically connects to `wss://terminal.noethara.cloud` using the current Supabase access token. Users do not enter an EC2 address, Linux credentials or terminal token.

**Server-side authorization:** `runtime/server.mjs` calls Supabase Auth to verify the access token and allows only UUIDs explicitly listed in the protected `NOETHARA_ALLOWED_USER_IDS` environment setting. In this initial single-owner deployment, all CLI processes run as the same Linux user. **Do not enable other users** until isolated per-user containers, storage, resource limits and permission separation are implemented.

## Activate on existing EC2 (one-time administrator task)

Use the machine's existing SSH key to connect to the **correct instance**. Previous records contain two different EC2 IP addresses; check your EC2 console rather than guessing. Don't paste private keys or tunnel tokens into chat.

From the existing repository checkout on EC2:

```bash
cd ~/NoetharaMobile
git pull --ff-only origin main
bash infra/aws/activate-managed-terminal.sh
```

If the checkout is at `~/noetharamobile`, run from that directory instead. You will need the **Supabase Authentication user UUID** (Supabase dashboard → Authentication → Users) and the Cloudflare Tunnel *connector token* (Zero Trust → Networks → Tunnels → `noethara-terminal` → install connector). The script prompts for the connector token without echoing it. Both are administrator-only setup values and must not go in your mobile app.

After starting, verify `pm2 status`, `sudo systemctl status cloudflared`, and `curl -i http://127.0.0.1:8789/status`. An unauthenticated status request **must return HTTP 401**, not terminal contents or shell access. Check the old Nginx setup: if public port 80 still forwards to the terminal, remove that route and restrict inbound rules. Rotate/revoke the old shared terminal token shown in a screenshot; the new gateway ignores it.

**After the connector is healthy and the authorized gateway verified:** create a proxied Cloudflare CNAME `terminal.noethara.cloud` pointing to `0e21ab61-7710-45ed-bd2f-ff7d5889751e.cfargotunnel.com`. Do not create this DNS record early. Then test an authenticated WebSocket from Expo Go.

The Cloudflare tunnel may be healthy even when a selected CLI immediately exits. When a mobile screen shows `command not found` or `[CLI session ended]`, install the coding agents **on EC2**, not in Cosyra:

```bash
cd ~/NoetharaMobile
git pull --ff-only origin main
bash infra/aws/install-cli-agents.sh
```

The installer sets a per-user npm prefix, installs OpenCode, Codex, and Claude Code using their official npm packages without sudo, verifies binary availability and restarts the PM2 gateway. Only your allowlisted Supabase account can open the remote CLI. Each tool requires its own supported provider sign-in to perform AI tasks. Do not place OAuth access tokens, API keys, or CLI credentials into the Expo app or screenshots. Full-screen terminal ANSI/PTY rendering is not yet at feature parity with Cosyra.

---

# Existing live EC2: noethara-server (Ohio)

**Use this section for your already-running EC2 instance. Do not deploy the separate CloudFormation stack below.**

- IP: `18.226.87.72`
- Region: `us-east-2` (Ohio)
- Instance: `noethara-server` (`t3.large`)
- SSH user: `ubuntu`
- SSH key: `my-ai-server-key.pem`, kept on the owner's trusted device/workspace (never put the private key in a GitHub repository).

### Provision your already-running server

From Cosyra or a trusted computer **where the private SSH key already exists**:

```bash
chmod 600 my-ai-server-key.pem
ssh -i my-ai-server-key.pem ubuntu@18.226.87.72
```

Once connected, run on the Ubuntu instance:

```bash
git clone --branch main https://github.com/fwrobens/NoetharaMobile.git ~/noetharamobile
bash ~/noetharamobile/infra/aws/provision-live-server.sh
```

If you previously cloned the repository, replace the clone step with
`git -C ~/noetharamobile pull --ff-only origin main`. If GitHub denies cloning the private repository, create a **read-only GitHub deploy key** for the VM and clone using `git@github.com:fwrobens/NoetharaMobile.git`. Do not place a GitHub personal access token in command history or in this script.

The script verifies Ubuntu **22.04**, installs Python, Git, Docker/Compose, Node.js **24 LTS**, Nginx, PM2 and tmux, retrieves the project, installs the approved CLI packages, starts a local terminal bridge on `127.0.0.1:8789` and a health endpoint on `127.0.0.1:3000`, and configures an Nginx IP-based reverse proxy on port 80. It does not overwrite SSH settings or create an EC2 instance.

**After installation, verify:**

```bash
pm2 status
docker --version
docker compose version
node --version
python3 --version
nginx -t
curl -i http://127.0.0.1:3000/health
```

The private bridge's secret is stored at
`/home/ubuntu/.config/noethara/terminal.env`, with owner-only permissions. It must not be pasted into chat, GitHub, screenshots, or your landing page.

**Still required before mobile remote-terminal access:** a domain or private authenticated network route, a valid TLS certificate exposing only `wss://` to the iPhone, and successful interactive CLI authentication on the EC2 server. Never expose port 8789 directly to the internet; the app's simple terminal UI also does not yet fully render ANSI interactive TUIs.

`NoetharaMobile` is a **React Native Expo client**, not a web server. PM2 starts the Linux backend bridge and private health service, not the Expo mobile interface.

---

# NoetharaMobile EC2 infrastructure

This folder is **deployment code only**. An EC2 instance has not been launched from this chat.

## Account and configuration

- AWS account: `234983729833`, Region: `us-east-1`.
- Instance: `t3.large`, Ubuntu Server 22.04 LTS, 50 GiB **encrypted gp3** root volume.
- Elastic IP for stable access; security group ports 22 and 3000 are restricted to the `NOETHARA_ADMIN_CIDR` you supply. Ports 80/443 are open.
- Installs Docker Engine, Docker Compose plugin, Node.js **24 LTS**, Python 3, Git, Nginx, PM2, tmux.
- Nginx serves /health via the local port 3000. **The health server deliberately reports API not ready** until application deployment.
- HTTPS **requires a domain and valid certificate**; simply opening port 443 is not HTTPS.
- The Expo frontend is not an HTTP API and should not be run as PM2's production API process.

## Launch (on a trusted machine with AWS CLI already authenticated)

From repository root:

```bash
export NOETHARA_VPC_ID=vpc-EXAMPLE
export NOETHARA_SUBNET_ID=subnet-EXAMPLE
export NOETHARA_ADMIN_CIDR=YOUR_PUBLIC_IP/32
bash infra/aws/deploy.sh
```

Replace examples with your actual account network values. The deploy script verifies the selected AWS account, **creates a local private SSH key**, and deploys the CloudFormation stack. Never place the key or AWS secret keys in source code. Do not share an AWS access key or private SSH key in chat.

AWS CloudFormation outputs the EC2 instance ID, Elastic IP, SSH command, and health URL. Check UserData logs under `/var/log/cloud-init-output.log` if installation fails.

## Project deployment

After the instance is ready, clone the private GitHub repository using a **read-only GitHub deploy key** associated with the server (or a properly authorized GitHub credential). Don't inject personal access tokens into EC2 UserData.

```bash
ssh -i ~/.ssh/noethara-mobile-ssh.pem ubuntu@YOUR_ELASTIC_IP
git clone git@github.com:fwrobens/NoetharaMobile.git /opt/noethara/source
cd /opt/noethara/source/runtime
npm install --omit=dev
```

`runtime/server.mjs` is a WebSocket terminal bridge on **localhost:8789**, not a production HTTP API. Install and configure OpenCode, Codex, and Claude Code on the VM separately using their official instructions. Use a strong random runtime token and publish the terminal bridge **only** through a private authenticated TLS connection; do not put `8789` into a public EC2 security group. A terminal client that lacks full ANSI/PTY support will not faithfully display full-screen CLIs.

The starter CloudFormation stack currently runs a health service through PM2, not the project agent, until the private repository and credentials are configured. This avoids pretending that the Expo app is a server.

## Billing and security

A t3.large is **not free**. In us-east-1, on-demand Linux compute is approximately $0.083/hr (about $60 for 30 continuous days), **plus** 50GB EBS, Elastic IPv4, bandwidth, possible CPU surplus and tax. Set an AWS Budget alert, stop the instance when unused, and remove the entire CloudFormation stack when finished.

An IP allowlist, short-lived credentials, and least-privilege IAM are better than exposing SSH and API ports to the whole internet.
