import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

test('register, sign in and manage items', async () => {
  const server = createApp(openDb(':memory:')).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, init: RequestInit = {}, token?: string) =>
    fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  try {
    assert.equal((await call('/health')).status, 200);
    const reg = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'a@b.co', password: 'password123' }) });
    assert.equal(reg.status, 201);
    const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.co', password: 'password123' }) });
    const { token } = (await login.json()) as { token: string };
    assert.equal((await call('/api/items')).status, 401);
    assert.equal((await call('/api/items', { method: 'POST', body: JSON.stringify({ title: 'First' }) }, token)).status, 201);
    const items = (await (await call('/api/items', {}, token)).json()) as Array<{ title: string }>;
    assert.equal(items[0]?.title, 'First');
  } finally {
    server.close();
  }
});
