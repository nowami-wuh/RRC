import dotenv from 'dotenv';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const serverDirectory = fileURLToPath(new URL('.', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const frontendUrl = process.env.FRONTEND_URL;
const apiUrl = process.env.API_URL || process.env.TEST_URL || 'http://localhost:4000';
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS) || 10000;
let passes = 0;
let failures = 0;
let skipped = 0;
const groups = [];
let currentGroup = null;
const runStartedAt = Date.now();
const runDate = new Date().toLocaleString();

function startGroup(name) {
  currentGroup = { name, results: [] };
  groups.push(currentGroup);
}

function record(status, name, details = '') {
  if (!currentGroup) startGroup('General');
  currentGroup.results.push({ status, name, details });
}

function getLocalCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repositoryDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    if (error.code === 'ENOENT' || error.status === 128) return 'unavailable';
    throw error;
  }
}

function printReport() {
  const command = process.env.npm_lifecycle_event === 'test' ? 'npm test' : 'node test.js';
  console.log('RRC Booking Management System - Automated API Test Results');
  console.log(`Run date : ${runDate}`);
  console.log(`Commit   : ${getLocalCommit()} (local checkout)`);
  console.log(`Node     : ${process.version}`);
  console.log(`Command  : ${command}`);
  console.log(`Location : ${serverDirectory}`);

  for (const group of groups) {
    const executedCount = group.results.filter((result) => result.status === 'PASS' || result.status === 'FAIL').length;
    const skippedCount = group.results.filter((result) => result.status === 'SKIP').length;
    const skippedText = skippedCount ? `, ${skippedCount} skipped` : '';
    console.log(`\n== ${group.name} (${executedCount} tests${skippedText})`);
    for (const result of group.results) {
      const details = result.details ? ` -> ${result.details}` : '';
      console.log(`  [${result.status}] ${result.name}${details}`);
    }
  }

  console.log('\n== Summary');
  console.log(`ℹ tests ${passes + failures}`);
  console.log(`ℹ pass ${passes}`);
  console.log(`ℹ fail ${failures}`);
  console.log(`ℹ skipped ${skipped}`);
  console.log(`ℹ duration_ms ${Date.now() - runStartedAt}`);
}

function normalizeBaseUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http:// or https:// URL.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http:// or https://.`);
  }

  return url.toString().replace(/\/$/, '');
}

async function check(name, run) {
  try {
    const result = await run();
    passes += 1;
    record('PASS', name, result);
  } catch (error) {
    failures += 1;
    record('FAIL', name, error.message);
  }
}

function skip(name, reason) {
  skipped += 1;
  record('SKIP', name, reason);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson(url, options) {
  const response = await request(url, options);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`HTTP ${response.status}: expected JSON, received ${contentType || 'an unknown content type'}`);
  }

  return { response, data: await response.json() };
}

async function getJson(url, options) {
  const { response, data } = await requestJson(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return data;
}

function authOptions(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function checkApiRead(apiBase, name, path, token, validate, result) {
  await check(name, async () => {
    const data = await getJson(`${apiBase}/${path.replace(/^\//, '')}`, token ? authOptions(token) : undefined);
    validate(data);
    return typeof result === 'function' ? result(data) : result || 'HTTP 200';
  });
}

async function checkAuthRequired(apiBase, name, path) {
  await check(name, async () => {
    const response = await request(`${apiBase}${path}`);
    if (response.status !== 401) throw new Error(`Expected HTTP 401, received HTTP ${response.status}`);
    return 'HTTP 401 as expected';
  });
}

async function checkValidationResponse(apiBase, name, path, body, expectedStatus) {
  await check(name, async () => {
    const { response, data } = await requestJson(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, received HTTP ${response.status}`);
    }
    if (typeof data.error !== 'string' || !data.error) {
      throw new Error('Response did not include a validation error');
    }
    return `HTTP ${response.status}, request rejected without making changes`;
  });
}

async function loginTestAccount(apiBase, role) {
  const prefix = `TEST_${role.toUpperCase()}`;
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!username || !password) {
    skip(`${role} authenticated API checks`, `Set ${prefix}_USERNAME and ${prefix}_PASSWORD to use a test account.`);
    return null;
  }

  let session = null;
  await check(`POST /api/auth/login (${role} test account)`, async () => {
    const { response, data } = await requestJson(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!data.token || data.user?.role !== role || !data.user?.id) {
      throw new Error('Login response did not contain a valid session');
    }
    session = data;
    return 'Login succeeded';
  });
  return session;
}

async function main() {
  const apiBase = normalizeBaseUrl(apiUrl, 'API_URL');
  const siteBase = frontendUrl ? normalizeBaseUrl(frontendUrl, 'FRONTEND_URL') : null;

  startGroup('Deployment checks');
  record('INFO', 'Vercel site', siteBase || 'Set FRONTEND_URL to your deployed Vercel URL.');
  record('INFO', 'API base URL', apiBase);
  if (siteBase) {
    await check('Vercel site response', async () => {
      const response = await request(`${siteBase}/`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!(response.headers.get('content-type') || '').includes('text/html')) {
        throw new Error('Expected the deployed frontend to return HTML');
      }
      return `HTTP ${response.status}`;
    });
  } else {
    skip('Vercel site response', 'Set FRONTEND_URL to your deployed Vercel URL.');
  }

  startGroup('Backend and database connectivity');
  await check('Database connectivity and schema', async () => {
    const data = await getJson(`${apiBase}/healthz`);
    if (data.ok !== true) throw new Error('Health check did not report ok: true');
    return 'Database query succeeded; required schema is ready';
  });

  startGroup('Public API endpoints');
  let eventsData = null;
  let testEventDate = process.env.TEST_EVENT_DATE || '';
  await check('GET /api/packages', async () => {
    const data = await getJson(`${apiBase}/api/packages`);
    if (!Array.isArray(data.packages)) {
      throw new Error('Response does not contain a packages array');
    }
    return `HTTP 200, records: ${data.packages.length}`;
  });

  await check('GET /api/events', async () => {
    eventsData = await getJson(`${apiBase}/api/events`);
    if (!Array.isArray(eventsData.dates) || !eventsData.eventsByDate || typeof eventsData.eventsByDate !== 'object') {
      throw new Error('Response does not contain the expected dates and eventsByDate fields');
    }
    if (!testEventDate && eventsData.dates.length > 0) testEventDate = eventsData.dates[0].date;
    return `HTTP 200, dates: ${eventsData.dates.length}`;
  });

  await check('GET /api/events/:date', async () => {
    const date = testEventDate || '2099-12-31';
    const { response, data } = await requestJson(`${apiBase}/api/events/${encodeURIComponent(date)}`);
    if (response.status === 200 && data.date === date && Array.isArray(data.events)) {
      return `HTTP 200, events: ${data.events.length}`;
    }
    if (response.status === 404 && !testEventDate) return 'HTTP 404 for an unused test date';
    throw new Error(`Unexpected response for ${date}: HTTP ${response.status}`);
  });

  await check('GET /api/about', async () => {
    const data = await getJson(`${apiBase}/api/about`);
    if (!data.about || typeof data.about !== 'object') {
      throw new Error('Response does not contain an about object');
    }
    return 'HTTP 200, About information returned';
  });

  const availabilityUsername = `rrctest${Math.random().toString(16).slice(2, 6)}`;
  await check('GET /api/auth/username-availability', async () => {
    const data = await getJson(`${apiBase}/api/auth/username-availability?username=${encodeURIComponent(availabilityUsername)}`);
    if (typeof data.available !== 'boolean') {
      throw new Error('Response does not contain an availability result');
    }
    return 'HTTP 200, availability check returned';
  });

  const invalidUsername = `rrctest${Math.random().toString(16).slice(2, 6)}`;
  await check('POST /api/auth/login (invalid test credentials)', async () => {
    const { response, data } = await requestJson(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: invalidUsername, password: 'Invalid-Test-Password-123', role: 'customer' }),
    });
    if (response.status !== 401 || typeof data.error !== 'string') {
      throw new Error(`Expected HTTP 401 for invalid credentials, received HTTP ${response.status}`);
    }
    return 'HTTP 401 as expected; no account was changed';
  });

  await checkValidationResponse(apiBase, 'POST /api/auth/signup validation', '/api/auth/signup', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/signup-initiate validation', '/api/auth/signup-initiate', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/signup-verify validation', '/api/auth/signup-verify', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/reset-initiate validation', '/api/auth/reset-initiate', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/reset-verify validation', '/api/auth/reset-verify', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/google validation', '/api/auth/google', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/google-verify-reset validation', '/api/auth/google-verify-reset', {}, 400);
  await checkValidationResponse(apiBase, 'POST /api/auth/google-reset-password validation', '/api/auth/google-reset-password', {}, 400);

  startGroup('Authentication and protected API endpoints');
  await checkAuthRequired(apiBase, 'GET /api/requests/inventory requires login', '/api/requests/inventory');
  await checkAuthRequired(apiBase, 'GET /api/user/presence requires login', '/api/user/presence?userId=auth-check');
  await checkAuthRequired(apiBase, 'GET /api/chat/messages requires login', '/api/chat/messages');
  await checkAuthRequired(apiBase, 'GET /api/admin/summary requires login', '/api/admin/summary');

  const customerSession = await loginTestAccount(apiBase, 'customer');
  if (customerSession) {
    const customerId = encodeURIComponent(customerSession.user.id);
    const token = customerSession.token;
    await checkApiRead(
      apiBase,
      'GET /api/requests/inventory',
      '/api/requests/inventory',
      token,
      (data) => { if (!Array.isArray(data.items)) throw new Error('Response does not contain an items array'); },
      (data) => `HTTP 200, items: ${data.items.length}`,
    );
    await checkApiRead(
      apiBase,
      'GET /api/requests/notifications',
      `/api/requests/notifications?customerId=${customerId}`,
      token,
      (data) => { if (!Array.isArray(data.notifications)) throw new Error('Response does not contain a notifications array'); },
      (data) => `HTTP 200, notifications: ${data.notifications.length}`,
    );
    await checkApiRead(
      apiBase,
      'GET /api/user',
      `/api/user?userId=${customerId}`,
      token,
      (data) => { if (!data.user?.id) throw new Error('Response does not contain a user'); },
      'HTTP 200, user profile returned',
    );
    await checkApiRead(
      apiBase,
      'GET /api/user/presence',
      `/api/user/presence?userId=${customerId}`,
      token,
      (data) => { if (typeof data.online !== 'boolean') throw new Error('Response does not contain online status'); },
      'HTTP 200, presence returned',
    );
    await checkApiRead(
      apiBase,
      'GET /api/chat/messages',
      `/api/chat/messages?userId=${customerId}`,
      token,
      (data) => { if (!Array.isArray(data.messages)) throw new Error('Response does not contain a messages array'); },
      (data) => `HTTP 200, messages: ${data.messages.length}`,
    );
    await checkApiRead(
      apiBase,
      'GET /api/chat',
      `/api/chat?userId=${customerId}`,
      token,
      (data) => { if (!Array.isArray(data.messages)) throw new Error('Response does not contain a messages array'); },
      (data) => `HTTP 200, messages: ${data.messages.length}`,
    );
    await check('POST /api/user/presence', async () => {
      const { response, data } = await requestJson(`${apiBase}/api/user/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!response.ok || data.ok !== true) throw new Error(`HTTP ${response.status}`);
      return 'HTTP 200, session presence endpoint responded';
    });
  }

  const adminSession = await loginTestAccount(apiBase, 'admin');
  if (adminSession) {
    const token = adminSession.token;
    await checkApiRead(
      apiBase,
      'GET /api/admin/summary',
      '/api/admin/summary',
      token,
      (data) => { if (!data.summary || typeof data.summary !== 'object') throw new Error('Response does not contain a summary'); },
      'HTTP 200, admin summary returned',
    );
    await checkApiRead(
      apiBase,
      'GET /api/admin/inquiries',
      '/api/admin/inquiries',
      token,
      (data) => { if (!Array.isArray(data.messages)) throw new Error('Response does not contain a messages array'); },
      (data) => `HTTP 200, inquiries: ${data.messages.length}`,
    );
    await checkApiRead(
      apiBase,
      'GET /api/admin/inventory',
      '/api/admin/inventory',
      token,
      (data) => { if (!Array.isArray(data.items)) throw new Error('Response does not contain an items array'); },
      (data) => `HTTP 200, items: ${data.items.length}`,
    );
    await checkApiRead(
      apiBase,
      'GET /api/admin/packages',
      '/api/admin/packages',
      token,
      (data) => { if (!Array.isArray(data.packages)) throw new Error('Response does not contain a packages array'); },
      (data) => `HTTP 200, packages: ${data.packages.length}`,
    );
  }

  startGroup('Frontend-to-backend communication');
  if (siteBase) {
    const frontendOrigin = new URL(siteBase).origin;
    await check('CORS allows the Vercel frontend', async () => {
      const response = await request(`${apiBase}/api/packages`, {
        headers: { Origin: frontendOrigin },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const allowedOrigin = response.headers.get('access-control-allow-origin');
      if (allowedOrigin !== frontendOrigin) {
        throw new Error(`Expected ${frontendOrigin}, received ${allowedOrigin || 'no CORS header'}`);
      }
      return `Allowed origin: ${allowedOrigin}`;
    });
  } else {
    skip('CORS allows the Vercel frontend', 'Set FRONTEND_URL to check frontend/API communication.');
  }

  startGroup('Production safety exclusions');
  skip(
    'Persistent write operations',
    'Booking, account, message, inventory, package, and About create/update/delete actions were not called to avoid changing live data.',
  );
  skip(
    'Request-list endpoints',
    'GET /api/requests and GET /api/admin/requests can automatically mark past events completed, so they were not called.',
  );

  printReport();
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  startGroup('Test setup');
  failures += 1;
  record('FAIL', 'Test configuration', error.message);
  printReport();
  process.exitCode = 1;
});
