import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { WebSocketServer } from 'ws';
import { connectViteHmrUpstream } from './preview.mjs';

test('preview HMR host is the cookie-bearing preview subdomain', async () => {
  const source = await readFile(new URL('./preview.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("VITE_HMR_HOST:'preview.noethara.cloud'"));
  assert.ok(!source.includes("VITE_HMR_HOST:'terminal.noethara.cloud'"));
});

test('preview upstream forwards the vite-hmr WebSocket subprotocol', async () => {
  const server = new WebSocketServer({
    port: 0,
    host: '127.0.0.1',
    handleProtocols(protocols) {
      return protocols.has('vite-hmr') ? 'vite-hmr' : false;
    },
  });
  let client;
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const accepted = once(server, 'connection');
    client = connectViteHmrUpstream(address.port,
      new URL('https://preview.noethara.cloud/preview/test/?token=hmr-only'));
    const [upstream, request] = await accepted;
    await once(client, 'open');
    assert.equal(client.protocol, 'vite-hmr');
    assert.equal(upstream.protocol, 'vite-hmr');
    assert.equal(request.headers['sec-websocket-protocol'], 'vite-hmr');
    assert.equal(request.url, '/preview/test/?token=hmr-only');
  } finally {
    client?.terminate();
    for (const socket of server.clients) socket.terminate();
    await new Promise(resolve => server.close(resolve));
  }
});

test('preview upstream rejects arbitrary socket URLs and port values', () => {
  const valid = new URL('https://preview.noethara.cloud/preview/test/');
  assert.throws(() => connectViteHmrUpstream(-1, valid), /port/i);
  assert.throws(() => connectViteHmrUpstream(8789, new URL('https://preview.noethara.cloud/admin')), /path/i);
});
