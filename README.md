# Noethara Dev — Expo SDK 57

Native soft-ivory coding workspace for Expo Go. Includes authenticated Beam/NVIDIA chat, GitHub repository reader, saved conversations, Markdown replies, a local editor, and a separate remote CLI terminal.

## Sync and run in Cosyra

```bash
git pull origin main
npm install
npx expo install --check
npm run typecheck
npx expo start --clear --tunnel
```

Restart Expo (not just hot reload) after adding native dependencies.

## What changed

- **OAuth recovery:** PKCE callback handling for both browser sessions and Expo deep links; duplicate code-exchange protection. Github OAuth token is stored with Expo SecureStore and scoped to the signed-in Supabase user's ID.
- **Verify GitHub access:** Settings -> GitHub Integration -> Verify GitHub repository access. Reconnect GitHub once after upgrading if the old short-lived token is missing.
- **GitHub context:** authenticated chat can read a bounded repository list from the existing Supabase read-only API. It can only inspect source code when you select a repository file. It cannot clone or push a repo.
- **Chat history:** conversations stored in Supabase with RLS now appear under Recent chats in the sliding drawer. Open an older chat or create a new one.
- **Message UI:** users appear in small right-aligned bubbles with no "YOU" label; AI messages render inline as Markdown (headings, bold, lists, quotes and code).
- **Swipe drawer:** finger-tracking drag from the left edge; drag past roughly one-third of the drawer to open, or slide left to close.
- **CLI separate from chat:** Terminals -> OpenCode / Codex / Claude Code opens a dedicated terminal client. These are not API chat models.
- **Local Playground:** create, edit and save files on-device, with an opt-in handoff to AI for review.

## Secure CLI runtime (optional)

A Linux terminal cannot run inside Expo Go. A separate owner-controlled Linux environment is necessary.

A basic private WebSocket bridge is included under `runtime/`:

```bash
cd runtime
npm install
# Set NOETHARA_TERMINAL_TOKEN to a cryptographically random secret (32+ characters).
# Optionally set NOETHARA_WORKSPACE to an existing writable directory.
npm start
```

It listens on `127.0.0.1:8789` and must be made accessible **only through your authenticated private TLS tunnel** as `wss://...`; do not expose the raw port publicly. Enter the `wss://` URL and runtime token in the app's Terminals settings.

This is an initial CLI input/output bridge, **not yet a production-grade terminal emulator**. Full ANSI screen-mode rendering, persistent sessions on disconnection, and robust PTY resizing require further work. The bridge also requires `script` (util-linux) and the installed `opencode`, `codex` or `claude` CLI binaries. Do not claim those CLIs run until your environment is connected.

## Supabase

Project: `smiubazuuptrknffmouo`

Backend: `https://smiubazuuptrknffmouo.supabase.co/functions/v1/noethara-api`

Configured secret variable names:

```text
NOETHARA_BEAMAI_API_KEY
NVIDIA_API_KEY
```

No Vercel AI Gateway key required.

GitHub/Google Supabase provider callback:

```text
https://smiubazuuptrknffmouo.supabase.co/auth/v1/callback
```

For Expo Go, also allowlist the dynamic return URL shown in Settings -> GitHub Integration. If Safari returns to localhost, verify the URL was allowlisted, and that the current Cosyra tunnel URL matches. Expo's standard Expo Go OAuth support is limited; for reliable stable redirect schemes, use a development build.

### Server sync note

The client code sends verified GitHub repository metadata to Beam using existing deployed GitHub API routes. A matching enhancement to the Edge Function source is committed to GitHub, but its most recent remote deployment was blocked; **do not assume that server change is active** until it is successfully deployed. The older function's authenticated Beam chat, model list and read-only GitHub routes remain deployed.

## Verification

`.github/workflows/expo-check.yml` runs Expo package validation and TypeScript checking when GitHub Actions is enabled. Confirm its actual result in Actions; a GitHub commit does not prove the native app has been tested.

**Still requires live validation:** iPhone OAuth callback, GitHub token permissions, historical chat loading, Markdown layout, swipe tracking and live terminal connection.


## Latest: project-aware AI and per-agent CLI sessions

In Files → GitHub Repositories, select a repository and tap **Use entire project with AI**. Each question now triggers a bounded code discovery pass (up to 18 folders, eight source files and around 35 KB of excerpts) using your already-authorized read-only GitHub integration. Hidden credentials and binary files are excluded. This is *not* an unlimited full-repo index and does not automatically apply or commit edits. The model should explain which files it used.

The Terminals page launches a separate **OpenCode**, **Codex**, or **Claude Code** screen, rather than switching agents within one terminal tab. The optional Linux bridge now uses separate tmux sessions for reconnection. Full-screen interactive TUI rendering still needs a true terminal emulator.

## AWS EC2 deployment assets

See [infra/aws/README.md](infra/aws/README.md) for the CloudFormation configuration and launch prerequisites. The included scripts target Ubuntu 22.04, t3.large, 50 GB encrypted gp3 EBS, Node 24 LTS, Docker/Compose, Nginx, Git, Python, PM2 and tmux in us-east-1.

The AWS instance is **not automatically provisioned**: this chat has no live AWS EC2 account connector. The `infra/aws/deploy.sh` script must be run in a trusted AWS-authenticated environment. It creates a local SSH key file (never committed to GitHub) and prints the real Elastic IP only if CloudFormation succeeds.

The mobile client cannot itself host CLI processes. The installed OpenCode/Codex/Claude binaries need their own authorized login. Do not expose the raw terminal bridge publicly. HTTPS requires a domain and certificate.
