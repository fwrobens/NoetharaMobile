# Noethara Dev (Expo SDK 57)

Personal native coding companion with a soft-ivory design and Supabase backend.

## Run in Expo Go

```bash
git pull origin main
npm install
npx expo install --check
npm run typecheck
npx expo start --clear --tunnel
```

## Features and state

- Native workspace, animations, keyboard shortcuts and drawer.
- Account screen with email authentication and a GitHub OAuth button.
- Beam AI chat through an authenticated Supabase Edge Function.
- Optional free Beam fallback through Vercel AI Gateway.
- Read-only GitHub repository and file browser, with AI file context.
- Owner-scoped Supabase tables for conversations and repository selections.
- GitHub Actions workflow for SDK compatibility and typechecking.

## Required configuration

- Supabase project: `smiubazuuptrknffmouo`
- Add a Reflection API key as `REFLECTION_API_KEY` in **Supabase Edge Function Secrets**. Until this is set, Beam can't answer.
- For optional fallback set `VERCEL_AI_GATEWAY_KEY` in Supabase Secrets.
- Register a GitHub OAuth App with callback `https://smiubazuuptrknffmouo.supabase.co/auth/v1/callback`.
- Enable GitHub in Supabase Auth providers and enter GitHub OAuth app credentials there.
- Allowlist the Expo return URL shown in the app under **Settings > GitHub Integration**. Expo Go tunnel URLs can change between runs.

## Provider and development limitations

ChatGPT subscriptions are not generic API keys. Subscription sharing requires a participating app; Noethara Dev is not yet approved for it. GitHub browse is read-only and does not clone or execute a project. A separate secure Linux worker will be required to run git, edit repositories, and execute coding-agent tools.

No live chat response has been tested because provider credentials have not yet been installed. See the repository's Actions tab for compilation results.
