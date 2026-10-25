// Isolated HTTPS preview proxy, served ONLY from preview.noethara.cloud.
// app.noethara.cloud and preview.noethara.cloud are separate browser origins
// but the same site, so SameSite=Strict preview capability cookies work in
// Safari iframes without exposing the Noethara app's stored authentication.
// Backend continues validating the workspace-scoped preview secret on every
// HTTP request and WebSocket upgrade. Never proxy arbitrary domains or paths.
const PREVIEW_PATH = /^\/preview\/[A-Za-z][A-Za-z0-9_-]{0,47}(?:\/|$)/;
const UPSTREAM = 'https://terminal.noethara.cloud';
const PREVIEW_HOST = 'preview.noethara.cloud';
const APP_ORIGIN = 'https://app.noethara.cloud';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (url.hostname !== PREVIEW_HOST || !PREVIEW_PATH.test(url.pathname)) {
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
  for (const name of ['accept', 'accept-encoding', 'range', 'if-none-match', 'if-modified-since']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const isWebSocket = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
  if (isWebSocket) {
    // Vite requires this exact subprotocol; do not allow arbitrary WS access.
    const offered=String(request.headers.get('sec-websocket-protocol')||'')
      .split(',').map(p=>p.trim());
    if (!offered.includes('vite-hmr')) {
      return new Response('Unsupported preview WebSocket', {status:403});
    }
    headers.set('upgrade','websocket');
    headers.set('sec-websocket-protocol','vite-hmr');
    // Cloudflare Workers creates the upstream Sec-WebSocket-Key and version
    // itself during fetch(Upgrade:websocket). Relaying browser handshake keys
    // can break that connection and trigger Vite's direct fallback/reconnect.
  }
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
    // This host is a completely different origin from the Noethara web app.
    // Do NOT use CSP sandbox here: opaque origins cause module script fetches
    // to omit the HttpOnly preview cookie, breaking Vite apps into white pages.
    // The separate hostname provides the required isolation while retaining
    // normal same-origin JS modules, cookies and HMR within each preview.
    result.headers.set('content-security-policy',
      "frame-ancestors " + APP_ORIGIN + "; object-src 'none'");
    result.headers.set('referrer-policy','no-referrer');
    return result;
  } catch {
    return new Response('Preview proxy temporarily unavailable', {
      status: 502,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
