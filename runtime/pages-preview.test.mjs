import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/preview/[[path]].js';

const base = 'https://noethara-mobile-web.pages.dev';

test('Pages preview proxy rejects routes outside the scoped workspace preview', async () => {
  const result = await onRequest({ request: new Request(base + '/preview/../status') });
  assert.equal(result.status, 404);
});

test('Pages preview proxy only supports GET and HEAD', async () => {
  const result = await onRequest({ request: new Request(base + '/preview/test/', { method: 'POST' }) });
  assert.equal(result.status, 405);
});

test('Pages preview proxy preserves ticket redirect and scoped cookie, but never forwards JWT', async () => {
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(null, {
      status: 302,
      headers: {
        location: '/preview/test/',
        'set-cookie': 'nprev_test=example; HttpOnly; Secure; SameSite=Strict; Path=/preview/test/',
      },
    });
  };
  try {
    const request = new Request(base + '/preview/test/?ticket=limited-capability', {
      headers: {
        Authorization: 'Bearer must-not-leak',
        Cookie: 'other=unsafe; nprev_test=example; nprev_other=dont-forward',
        Referer: 'https://example.com/private',
      },
    });
    const result = await onRequest({ request });
    assert.equal(captured.url, 'https://terminal.noethara.cloud/preview/test/?ticket=limited-capability');
    assert.equal(captured.options.redirect, 'manual');
    assert.equal(captured.options.headers.get('authorization'), null);
    assert.equal(captured.options.headers.get('referer'), null);
    assert.equal(captured.options.headers.get('cookie'), 'nprev_test=example');
    assert.equal(result.status, 302);
    assert.equal(result.headers.get('location'), '/preview/test/');
    assert.match(result.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    // Preview project code is untrusted, even when proxied through our domain.
    // An opaque-origin sandbox must apply to top-level and iframe previews.
    const policy = result.headers.get('content-security-policy') || '';
    assert.match(policy, /sandbox allow-scripts allow-forms/);
    assert.doesNotMatch(policy, /allow-same-origin/);
    assert.match(policy, /frame-ancestors 'self'/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Pages preview proxy preserves an unauthorized response', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('Preview authentication required', { status: 403 });
  try {
    const result = await onRequest({request: new Request(base + '/preview/test/')});
    assert.equal(result.status, 403);
    assert.match(await result.text(), /authentication required/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Pages preview proxy handles bodyless 304 responses', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, {status:304});
  try {
    const result = await onRequest({request: new Request(base + '/preview/test/main.js')});
    assert.equal(result.status, 304);
  } finally {
    globalThis.fetch = realFetch;
  }
});
