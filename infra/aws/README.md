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
