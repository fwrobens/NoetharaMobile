// Same-origin, cookie-authenticated preview gateway for the Noethara browser app.
//
// Safari blocks third-party cookies inside iframes. Proxying only /preview/:id/*
// through our own Pages origin lets the existing backend exchange a one-time
// preview ticket for a Secure, HttpOnly, SameSite=Strict first-party cookie.
// The upstream must still validate that cookie on EVERY request/WebSocket.
// This function does NOT proxy arbitrary URLs or bypass backend authentication.
const PREVIEW_PATH = /^\/preview\/[A-Za-z][A-Za-z0-9_-]{0,47}(?:\/|$)/;
const UPSTREAM = 'https://terminal.noethara.cloud';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (!PREVIEW_PATH.test(url.pathname)) {
    return new Response('Invalid preview route', { status: 404 });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const target = UPSTREAM + url.pathname + url.search;
  // Never relay browser app session tokens to a generated project's origin.
  // Only its scoped preview capability cookie is needed by the upstream.
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) {
    const segments = url.pathname.split('/');
    const id = segments[2];
    const matched = cookie.split(';').map(v => v.trim()).filter(v => v.startsWith('nprev_' + id + '='));
    if (matched.length) headers.set('cookie', matched.join('; '));
  }
  for (const name of ['accept', 'accept-encoding', 'range', 'if-none-match', 'if-modified-since',
    'sec-websocket-protocol', 'sec-websocket-version', 'sec-websocket-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const isWebSocket = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
  if (isWebSocket) headers.set('upgrade', 'websocket');
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
    });
    // WebSocket response objects must be returned intact for Cloudflare to
    // attach the live upstream socket (constructing Response(101) is invalid).
    if (response.status === 101) return response;
    // 204/205/304 are bodyless HTTP statuses; browsers may send conditional GET.
    const noBody = [204, 205, 304].includes(response.status);
    const result = new Response(noBody ? null : response.body, response);
    result.headers.set('cache-control', 'private, no-store');
    result.headers.set('x-content-type-options', 'nosniff');
    // Generated application HTML runs on the Pages origin behind this proxy.
    // Without an enforced CSP sandbox, its scripts could read the Noethara
    // SPA's same-origin storage and initiate authenticated actions.  CSP
    // sandbox (without allow-same-origin) assigns a unique opaque origin even
    // if someone opens the preview in a new top-level tab. Do not remove it.
    // Keep script execution and forms for interactive Vite previews.
    result.headers.set('content-security-policy',
      "sandbox allow-scripts allow-forms; frame-ancestors 'self'; object-src 'none'; base-uri 'none'");
    return result;
  } catch {
    return new Response('Preview proxy temporarily unavailable', {
      status: 502,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
