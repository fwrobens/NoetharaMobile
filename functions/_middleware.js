// Host routing for two distinct browser origins on the same Pages deployment.
// Generated apps must never be able to load the Noethara SPA on their origin.
const APP_HOST = 'app.noethara.cloud';
const PREVIEW_HOST = 'preview.noethara.cloud';
const ORIGINAL_PAGES_HOST = 'noethara-mobile-web.pages.dev';
const PREVIEW_PATH = /^\/preview\/[A-Za-z][A-Za-z0-9_-]{0,47}(?:\/|$)/;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === ORIGINAL_PAGES_HOST) {
    // Preserve existing paths and query parameters during migration, but
    // never redirect the secret-bearing preview URL to the app origin.
    if (url.pathname.startsWith('/preview/')) {
      return new Response('Use the isolated preview hostname', { status:404 });
    }
    return Response.redirect('https://' + APP_HOST + url.pathname + url.search, 302);
  }
  if (url.hostname === PREVIEW_HOST && !PREVIEW_PATH.test(url.pathname)) {
    return new Response('Not found', { status:404, headers:{ 'cache-control':'no-store' } });
  }
  if (url.hostname === APP_HOST && url.pathname.startsWith('/preview/')) {
    return new Response('Not found', { status:404, headers:{ 'cache-control':'no-store' } });
  }
  return context.next();
}
