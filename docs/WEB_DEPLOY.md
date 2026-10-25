# Noethara web deployment (Cloudflare Pages)

Cloudflare account: NoetharaFlare
Account ID: 3c074241a89eaa0cb98490b12ef2cdc4
Pages project: noethara-mobile-web
URL after first deployment: https://noethara-mobile-web.pages.dev

This is a Direct Upload Pages project: Cloudflare returned an HTTP 401 Git
installation error when trying to connect GitHub. A Direct Upload project
cannot be switched to the native Git integration later, but can be deployed
with Wrangler or through a separate GitHub Actions workflow.

## Deploy on EC2

Run these commands on the existing NoetharaMobile EC2 machine as ubuntu:

    cd ~/NoetharaMobile
    git pull --ff-only origin main
    npx expo install react-dom react-native-web @expo/metro-runtime
    npm run typecheck
    npm run build:web

Wrangler supports OAuth device login for headless SSH sessions. Unlike
ordinary login, this does NOT redirect to unreachable localhost:

    npx wrangler@latest login --device --browser=false

Open the Cloudflare verification URL on your computer or phone. Enter the
short code and authorize access to NoetharaFlare. Do not paste any credentials
or OAuth tokens into chat or source code.

After Wrangler confirms login:

    CLOUDFLARE_ACCOUNT_ID=3c074241a89eaa0cb98490b12ef2cdc4 \
      npx wrangler@latest pages deploy dist \
        --project-name=noethara-mobile-web --branch=main

Test the resulting link in Safari: email sign-in, authorized workspace list,
create/read files, terminal connection, and web preview.

## Preserve the web dependencies

The Expo web packages were installed on EC2 and may not yet be in GitHub.
Version only the intended dependency files:

    git add package.json package-lock.json
    git diff --cached --stat
    git commit -m "Install Expo SDK 58 web packages"
    git push origin main

Do not stage untracked host config files or npm output files.

## AWS CORS

The AWS gateway must allow preflight requests from the exact production origin
https://noethara-mobile-web.pages.dev. Supabase owner authorization still
applies to every actual workspace request. For backend updates, use the
managed update script, then verify unauthenticated /status returns HTTP 401.

## Limits

- Safari frontend is a web app, not a native iOS developer build.
- Browser terminal uses a sandboxed xterm iframe and keeps the auth token in
  the parent application.
- Preview uses an iframe and provides an Open in browser fallback.
- The browser intentionally does not persist GitHub tokens to unencrypted
  storage. Reconnection after refresh may be required.
- Supabase OAuth allowed redirects must include the deployed website callback
  for GitHub and Google OAuth to function in Safari.

## Canonical app and secure preview hosts

Use https://app.noethara.cloud for the user interface. The original
https://noethara-mobile-web.pages.dev host redirects to that address.
Generated apps load from https://preview.noethara.cloud, an independent
browser origin on the same site, so HttpOnly SameSite=Strict preview cookies
work on iPhones without exposing Noethara account data to generated code.
Both custom hostnames are registered on the existing Pages project.

Always use `npm run build:web` instead of a bare Expo export before uploading
`dist` with Wrangler. The build copies Feather and MaterialCommunityIcons
font assets to `dist/fonts` and adds explicit font declarations to
`dist/index.html`; otherwise missing font assets display as empty squares.
Run `bash infra/aws/update-managed-workspaces.sh` after pulling the latest
runtime/server.mjs so the signed-in app on app.noethara.cloud can use the
AWS gateway with its exact-origin CORS policy.
