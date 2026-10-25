# NoetharaMobile managed coding workspace (owner-only rollout)

This release connects **Code chat** to an authenticated Linux workspace rather than treating Markdown as generated files. The managed runtime is the existing EC2 gateway behind the existing Cloudflare Tunnel:
`https://terminal.noethara.cloud` → `http://127.0.0.1:8789`.

## Activation on the existing Ubuntu EC2 host

Do not run this in the Cosyra mobile terminal or in Expo Metro; it belongs on the AWS Linux instance running PM2.

```bash
cd ~/NoetharaMobile
git pull --ff-only origin main
bash infra/aws/update-managed-workspaces.sh
```

The script checks syntax, tests owner-only workspace paths, loads an optional privately stored NVIDIA token, restarts only `noethara-runtime`, and verifies **both** `/status` and `/workspaces` reject unauthenticated calls with HTTP 401. If `/workspaces` returns HTTP 404, the AWS gateway hasn't actually updated even if Expo says "Bundled."

To enable the AWS coding agent, place your own NVIDIA API key only in the AWS instance's private file (never GitHub, screenshots, or chat):

```bash
mkdir -p ~/.config/noethara
chmod 700 ~/.config/noethara
umask 077
nano ~/.config/noethara/runtime.env
```

Put `NOETHARA_NVIDIA_API_KEY=...` in that restricted file, then rerun `bash infra/aws/update-managed-workspaces.sh`. The key is passed only to the owner-controlled server process, not the iOS client.

Other required private PM2 environment settings remain `NOETHARA_SUPABASE_URL`, `NOETHARA_SUPABASE_PUBLISHABLE_KEY`, and **exactly one** `NOETHARA_ALLOWED_USER_IDS` entry.

## Features

- **Files** displays `workspaces/<project>/` roots and their directories. The selected project's file explorer supports source reading and explicit edited saves.
- **Code chat** automatically creates a project when given a building request, or works on a selected project. It calls the AWS agent endpoint to search, read, write complete files and run selected npm install/build/typecheck/test commands. The agent logs tool events. Do not present text-only responses as real builds.
- **Attachments** open the native iOS Files/Photos input through a WebView and save supported files in `uploads/` within the selected workspace. A model without vision support cannot interpret image pixels. Asset upload ≠ multimodal reasoning.
- **Web preview** supports Vite projects with `"dev": "vite"` in `package.json`. A managed local Vite process is accessed through a ticket- and HttpOnly-cookie-gated `/preview/<project>/` path on the same Cloudflare Tunnel; all upstream hosts and ports are fixed by the backend. Expo Metro JSON at port 8081 is **not** the website preview.
- **Terminal** runs OpenCode/Codex/Claude CLI in the selected project. The native Enter shortcut is first in the key strip, the terminal uses nearly the whole available iPhone screen, and Vite preview WebSocket upgrades are separated from CLI terminal upgrades.

## Security and limits

This is an **owner-only** deployment, NOT ready for self-service multi-tenant usage. The gateway rejects unlisted Supabase UIDs and refuses to start without exactly one allowed UID. npm package scripts can execute code; even with limited CLI command choices this is **not** a container boundary. Before opening workspaces to additional users, provision per-user containers/VMs, CPU/memory/disk/network limits, per-user volumes, secrets isolation, cancellation, and job queues.

The AWS job queue is currently in-memory with only one active job; jobs can be lost if PM2 restarts. Production hardening needs persistent checkpoints, per-user sandbox isolation, job resumption, preview process cleanup, rate limits and full device testing. Uploads are size- and MIME-limited and scoped to each selected workspace.

## Smoke tests

1. Confirm PM2 shows `noethara-runtime` online and the unauthenticated `/workspaces` path responds 401.
2. Reload Expo Go, sign in using the exact account on `NOETHARA_ALLOWED_USER_IDS`, and check Terminals shows the refreshed workspace API.
3. Create `testapp`; verify Files → `workspaces/testapp/`.
4. Pick that workspace from Code, select an NVIDIA model, and request a simple Vite app; inspect tool activity, files and command results.
5. Open Preview and confirm you see the Vite website, **not** Expo metadata JSON. Test reload and HMR.
6. Upload a small text file and photograph. The photograph should be stored as an asset, not falsely claimed to be understood by a text-only LLM.
7. Test Enter, arrow keys and the keyboard in the full-screen terminal.
8. Check device crashes and unstable connections using Expo logs and PM2 logs; passing `expo export` doesn't prove iOS runtime stability.
