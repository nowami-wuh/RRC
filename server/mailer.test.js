import assert from 'node:assert/strict';
import test from 'node:test';
import { sendAdminEmailChangeVerificationEmail, sendAdminNewRequestEmail } from './mailer.js';

test('admin request email uses the current recipient and escapes request details', async () => {
  const previousApiKey = process.env.BREVO_API_KEY;
  const previousFetch = globalThis.fetch;
  let payload;
  process.env.BREVO_API_KEY = 'test-api-key';
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ messageId: 'test-message-id' }),
    };
  };

  try {
    await sendAdminNewRequestEmail('updated-admin@example.com', {
      id: 'REQ-123',
      type: 'book',
      event: { title: '<script>event</script>', date: '2099-12-31', venue: 'Main Hall' },
      customerName: 'Test Customer',
      customerEmail: 'customer@example.com',
    });

    assert.deepEqual(payload.to, [{ email: 'updated-admin@example.com' }]);
    assert.match(payload.htmlContent, /&lt;script&gt;event&lt;\/script&gt;/);
    assert.doesNotMatch(payload.htmlContent, /<script>event<\/script>/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = previousApiKey;
    }
  }
});

test('admin email change code is sent to the proposed email address', async () => {
  const previousApiKey = process.env.BREVO_API_KEY;
  const previousFetch = globalThis.fetch;
  let payload;
  process.env.BREVO_API_KEY = 'test-api-key';
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ messageId: 'test-message-id' }),
    };
  };

  try {
    await sendAdminEmailChangeVerificationEmail('new-admin@example.com', '123456');
    assert.deepEqual(payload.to, [{ email: 'new-admin@example.com' }]);
    assert.match(payload.textContent, /123456/);
    assert.match(payload.textContent, /expire in 10 minutes/i);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = previousApiKey;
    }
  }
});
