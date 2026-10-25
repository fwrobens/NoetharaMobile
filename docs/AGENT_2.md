# Noethara Agent 2.0 — AWS rollout

## What changed

The existing owner-authenticated AWS coding agent gains an MCP client, a
premium-design component system in both generated UI templates, staged quality
checks, a vision critic, and optional Reflection Beam provider routing.

The working terminal gateway, Docker isolation, checkpoints and Cloudflare
preview architecture stay in place. **Do not deploy before GitHub CI passes.**

## Private server credentials (never in GitHub, Expo, Cloudflare Pages)

The existing managed AWS service loads:
`/home/ubuntu/.config/noethara/runtime.env`

The backend recognizes these optional private environment variable names:

| Variable | Meaning |
| --- | --- |
| `NOETHARA_NVIDIA_API_KEY` | Existing working NVIDIA coding + vision provider |
| `NOETHARA_BEAMAI_API_KEY` | Optional Reflection Beam API key (fallback alias `REFLECTION_API_KEY`) |
| `NOETHARA_BEAM_MODEL_ID` | Optional Beam provider ID; defaults to `Beam-1.0-501B-A23B` |
| `NOETHARA_VISION_MODEL` | Optional override; default NVIDIA Nemotron 3.5 Super VL |
| `CONTEXT7_API_KEY` | Context7 server key for `https://mcp.context7.com/mcp` |
| `NOETHARA_21ST_API_KEY` | Rotated 21st.dev server key for `https://21st.dev/api/mcp` |
| `NOETHARA_21ST_ENABLED=off` | Disable 21st MCP even when key is present |
| `NOETHARA_MCP_ENABLED=off` | Disable all MCP connections |

**Important:** An earlier 21st API key was shared in chat. Rotate/revoke that
key in the provider dashboard before configuring a new one. Do not reuse
credentials pasted into conversations, build logs, terminals with shell
history, or screenshots. Restrict runtime.env permissions to the service user
(mode 0600). Never print the file's contents.

For new Context7 keys use its account dashboard. The CLI
`npx ctx7@latest setup` configures supported editor/agent clients; it does
not automatically configure Noethara's custom AWS coding process.

## Code path

- `runtime/mcp/client.mjs` uses the official MCP v2 TypeScript client over
  Streamable HTTP. Only read-only discovery, `resolve-library-id`,
  `query-docs`, `search`, and `get_component` are allowed.
- Context7 is offered automatically when configured. The Noethara workspace
  composer has a **21st toggle**; component lookups require that session's
  opt-in. 21st retrievals are capped at two per agent session (additional
  third-party account restrictions still apply).
- `runtime/providers.mjs` routes Beam to Reflection's API when its private
  credentials are present. Otherwise it reports an NVIDIA fallback. A model
  shown in a picker is not proof that an endpoint is entitled or working.
- `runtime/orchestration.mjs` requires actual passing typecheck/build
  results before preview, and requests a screenshot review when available.
  At most two visual critique rounds; final reports mark incomplete checks.
- `runtime/templates/*/src/components/Premium.tsx` supplies reusable,
  token-based components in generated React web and React Native projects.

## After CI passes: update staging EC2

    cd ~/NoetharaMobile
    git pull --ff-only origin main
    bash infra/aws/update-managed-workspaces.sh
    node --test runtime/agent-v2.test.mjs runtime/mcp/client.test.mjs
    node runtime/scripts/mcp-probe.mjs

The MCP probe reports only connection status and allowlisted tool **names**,
never secrets. No new public TCP ports or Cloudflare DNS changes are required.

The Expo web app also needs rebuilding because the client gained the 21st
opt-in toggle and true Beam selection:

    cd ~/NoetharaMobile
    npm run typecheck
    npm run build:web
    CLOUDFLARE_ACCOUNT_ID=3c074241a89eaa0cb98490b12ef2cdc4 \
      npx wrangler@latest pages deploy dist \
      --project-name=noethara-mobile-web --branch=main

## Acceptance tests

1. Existing workspace: request a small code change, verify targeted edits,
   actual typecheck/build logs, and working preview.
2. New React web workspace: generated UI imports PremiumCard/PremiumButton,
   renders at phone/desktop widths; review_design records a real screenshot
   critique and fixes a detected issue.
3. New React Native workspace: native components compile and preview in Vite.
4. With Context7 configured: discover tools, resolve React documentation,
   query the matching library version, and confirm no key is sent to client.
5. With 21st enabled in a test session: search UI references, retrieve at most
   two component sources, verify no React DOM code is copied into RN.
6. With Beam configured: run a real tool-call probe and verify a workspace
   file edit. Without Beam key: the NVIDIA fallback is **explicitly reported**.
7. Verify no secrets, third-party tool instructions, or untrusted component
   output can directly run as shell commands. Confirm checkpoint undo works.

## Rollback

If new agent features cause trouble, redeploy the previously known-good
GitHub commit using the existing managed update script. Saved workspaces,
checkpoints, and Cloudflare preview DNS do not need resetting. Use
`NOETHARA_MCP_ENABLED=off` to disable remote MCP without reverting code.
