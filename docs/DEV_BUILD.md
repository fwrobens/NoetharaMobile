# Noethara development build (stable native modules + GitHub sign-in)

Expo Go can't keep a stable OAuth redirect: its `exp://<ip>:<port>` address changes every session,
and it only includes Expo Go's own native modules. A development build is your own installable
"Noethara Dev" app with scheme `noetharadev://`. GitHub sign-in always returns to
`noetharadev://auth/callback`.

## One-time setup (on your computer, in the repo)
```bash
git pull
npm install
npx expo install expo-dev-client      # picks the version that matches the Expo SDK
npx expo install --fix                 # aligns every native dependency with the SDK
npx expo-doctor                        # must report no issues before building
npm install -g eas-cli && eas login
eas init                               # links the project (writes extra.eas.projectId to app.json)
eas device:create                      # iPhone: register your device (open the link on the phone)
npm run build:dev:ios                  # cloud build, ~15 min. Install from the link/QR when done.
```

## Daily use
```bash
npm run start:dev          # or: npm run start:dev:tunnel when the phone is on another network
```
Open **Noethara Dev** on the phone (not Expo Go); it connects to the dev server. JS changes reload
instantly. Rebuild (`npm run build:dev:ios`) only after adding or upgrading a native package.

## Stable GitHub OAuth callback
1. GitHub → Settings → Developer settings → OAuth Apps → your Noethara app:
   **Authorization callback URL** = `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
   (the value of `AUTH_CALLBACK_URL` in `src/lib/noetharaBackend.ts`).
2. Supabase → Authentication → URL Configuration → **Redirect URLs**: add
   `noetharadev://auth/callback` (and `noetharadev://**` if you add more deep links).
3. Supabase → Authentication → Providers → GitHub: paste the OAuth app Client ID and secret.
4. In the dev build, Settings → Connect GitHub. The app opens GitHub, Supabase redirects to
   `noetharadev://auth/callback`, and the app finishes the code exchange.

The redirect never changes between sessions, networks or devices, unlike Expo Go.
