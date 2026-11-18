import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import authRoutes from './auth.js';

test('Google auth endpoints return JSON validation errors when credentials are missing', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const { port } = server.address();
  for (const endpoint of ['/google', '/google-verify-reset', '/google-reset-password']) {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400, `${endpoint} should reject missing credentials`);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    const data = await response.json();
    assert.equal(typeof data.error, 'string');
    assert.ok(data.error);
  }
});
