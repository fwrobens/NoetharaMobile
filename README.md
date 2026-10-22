# Noethara Dev — Expo SDK 57

A native, soft-ivory mobile coding workspace. Personal-use UI + live model gateway + GitHub repository reader + local code editor.

## Start in Cosyra with Expo Go

```bash
git pull origin main
npm install
npx expo install --check
npm run typecheck
npx expo start --clear --tunnel
```

If Expo reports a dependency mismatch, run `npx expo install --fix` and restart with `--clear`.

## Working screens

- **Auth:** GitHub OAuth, Google OAuth, email/password sign-in and registration, plus a clearly labeled guest UI preview.
- **Playground:** create, edit, save and delete local code snippets. Saved on-device with AsyncStorage; users explicitly consent before sending code to AI.
- **Model picker:** searchable Beam + NVIDIA models. Signed-in accounts request the backend's current NVIDIA catalog; guest preview has a documented offline sample list (not live verified).
- **AI chat:** model selection is persisted, user messages travel through Supabase Edge Functions and responses display in chat. Messages can be saved to owner-scoped chat tables.
- **GitHub:** after OAuth configuration, browse authorized repositories and directories and attach individual text files to chat (read-only).
- **Settings:** check provider state, choose model and see endpoint URLs.

## Supabase project

Project: `smiubazuuptrknffmouo`

Backend base: `https://smiubazuuptrknffmouo.supabase.co`

Edge Function base: `https://smiubazuuptrknffmouo.supabase.co/functions/v1/noethara-api`

Available authenticated routes:

- `GET /status` — returns Boolean flags for Beam and NVIDIA secrets
- `GET /models` — merges NVIDIA's live hosted chat catalog with documented chat IDs
- `POST /chat` — selected Beam/NVIDIA model, or NVIDIA fallback if Beam is unavailable
- `GET /github/repos` — list authorized repositories
- `GET /github/contents?repo=owner/repo&path=&branch=main` — list directory or read a text file

Secrets read by Edge Functions (already named in this project):

```text
NOETHARA_BEAMAI_API_KEY
NVIDIA_API_KEY
```

Reflection's endpoint: `https://api.reflection.ai/openai/v1`.
NVIDIA's hosted chat endpoint: `https://integrate.api.nvidia.com/v1`.

**No Vercel AI Gateway account or VERCEL_AI_GATEWAY_KEY is needed.** NVIDIA is the optional error/rate-limit fallback for Beam, not an automatic paid model. NVIDIA "Free Endpoint" and API catalog availability vary; listed models aren't guaranteed to be free or enabled for your key.

## GitHub and Google OAuth setup

Register a GitHub OAuth App and configure Google OAuth in Google Cloud.

**Both** GitHub and Google, when authenticated through Supabase, use the Supabase-hosted provider callback:

```text
https://smiubazuuptrknffmouo.supabase.co/auth/v1/callback
```

Enable **GitHub** and **Google** under Supabase → Authentication → Providers and provide each provider's client ID and secret in the Supabase dashboard (never in the Expo app).

Add the mobile app's return URL to Supabase → Authentication → URL Configuration → Redirect URLs. The app shows the exact Expo Go return URL under Settings → GitHub Integration. It can change when using a new Cosyra tunnel. A standalone/development build can use `noetharadev://auth/callback` for stable deep linking.

Email/password sign-up may require email confirmation depending on Auth project settings.

## ChatGPT Plus/Pro

ChatGPT subscriptions are **not** generic OpenAI API credentials. This app is not approved to share a Plus/Pro plan via third-party app authorization; no unofficial login or token harvesting is implemented.

## Landing-page screenshot checklist

Use *actual Expo renders* of:
1. The new premium ivory auth screen.
2. Local Playground with the editable TypeScript starter file and saved status.
3. The AI model picker with Beam and NVIDIA results (note guest catalog is preview-only).
4. A **successful real** model conversation after sign-in; never present an error/preview response as real AI output.
5. GitHub repository browser **after GitHub OAuth works**.

**Not implemented:** running a Linux shell, deploying websites, cloning repositories, committing GitHub changes, or a tool-executing code agent. The Terminals UI still uses demo entries. Do not advertise those features as working.

## Verification

`.github/workflows/expo-check.yml` runs dependency and TypeScript checks on commits. Supabase Edge Function deployment and RLS configuration have been confirmed. A full native build, OAuth callback completion and successful Beam/NVIDIA inference still require live testing on the iPhone.
