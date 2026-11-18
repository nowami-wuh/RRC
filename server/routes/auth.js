import express from 'express';
import { randomBytes } from 'node:crypto';
import { sendVerificationEmail, sendSignupConfirmationEmail } from '../mailer.js';
import { execute, query } from '../db.js';
import { createSession } from '../authMiddleware.js';
import { hashPassword, verifyPassword } from '../passwords.js';

const router = express.Router();

function googleAuthError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function verifyGoogleToken(token) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw googleAuthError(503, 'Google sign-in is not configured.', 'GOOGLE_AUTH_NOT_CONFIGURED');
  }

  const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  tokenInfoUrl.searchParams.set('id_token', token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetch(tokenInfoUrl, { signal: controller.signal });
  } catch {
    throw googleAuthError(502, 'Unable to verify the Google credential. Please try again.', 'GOOGLE_VERIFICATION_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }

  let claims;
  try {
    claims = await response.json();
  } catch {
    throw googleAuthError(502, 'Google returned an invalid verification response.', 'GOOGLE_VERIFICATION_UNAVAILABLE');
  }

  if (!claims
    || typeof claims !== 'object'
    || !response.ok
    || claims.aud !== clientId
    || !claims.sub
    || !claims.email
    || ![true, 'true'].includes(claims.email_verified)) {
    return null;
  }

  return {
    email: String(claims.email).trim().toLowerCase(),
    avatar: typeof claims.picture === 'string' ? claims.picture : null,
  };
}

function buildCustomerUser(row) {
  return {
    id: row.public_id,
    username: row.username,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar || null,
    role: 'customer',
  };
}

function buildAdminUser(row) {
  return {
    id: `ADMIN-${row.id}`,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    avatar: row.avatar || null,
    role: 'admin',
  };
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password);
}

function isValidPhilippinePhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length === 11 && cleaned.startsWith('09');
}

function isValidUsername(username) {
  return typeof username === 'string'
    && username.length > 0
    && username.length <= 11
    && /^[a-zA-Z0-9_-]+$/.test(username);
}

async function isUsernameTaken(username, options = { includePending: true }) {
  const includePending = options.includePending ?? true;

  const queries = [
    query('SELECT 1 FROM customers WHERE username = ? LIMIT 1', [username]),
    query('SELECT 1 FROM admins WHERE username = ? LIMIT 1', [username]),
  ];

  if (includePending) {
    queries.push(query('SELECT 1 FROM pending_registrations WHERE username = ? LIMIT 1', [username]));
  }

  const [customerRows, adminRows, pendingRows] = await Promise.all(queries);
  return customerRows.length > 0 || adminRows.length > 0 || (includePending && pendingRows.length > 0);
}

async function isEmailTaken(email, options = { includePending: true }) {
  const includePending = options.includePending ?? true;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const queries = [
    query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [normalizedEmail]),
    query('SELECT 1 FROM admins WHERE email = ? LIMIT 1', [normalizedEmail]),
  ];

  if (includePending) {
    queries.push(query('SELECT 1 FROM pending_registrations WHERE email = ? LIMIT 1', [normalizedEmail]));
  }

  const [customerRows, adminRows, pendingRows] = await Promise.all(queries);
  return customerRows.length > 0 || adminRows.length > 0 || (includePending && pendingRows.length > 0);
}

function shouldBypassEmailVerification() {
  return String(process.env.SKIP_EMAIL_VERIFICATION).toLowerCase() === 'true';
}

async function createCustomerAccount({ username, email, phone, passwordHash, avatar = null }) {
  const publicId = `RRC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;

  await execute(
    'INSERT INTO customers (public_id, username, email, phone, avatar, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [publicId, username, email, phone, avatar, passwordHash],
  );

  return {
    id: publicId,
    username,
    email,
    phone,
    role: 'customer',
  };
}

// Sends verification email and surfaces errors to the caller.
// Previously used setImmediate() which silently swallowed email failures in production.
async function dispatchVerificationEmail(email, code) {
  await sendVerificationEmail(email, code);
  console.log(`Verification email sent to ${email}`);
}

// Confirmation emails are non-critical — fire-and-forget is fine here.
function queueSignupConfirmationEmail(email, username) {
  setImmediate(() => {
    void sendSignupConfirmationEmail(email, username)
      .then(() => {
        console.log(`Signup confirmation email sent to ${email}`);
      })
      .catch((error) => {
        console.error('Background signup confirmation email failed:', error);
      });
  });
}

router.get('/username-availability', async (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'Username is required', field: 'username' });
  }

  const taken = await isUsernameTaken(username);
  return res.json({ available: !taken });
});

router.post('/login', async (req, res) => {
  const { username, password, role = 'customer' } = req.body;

  const rows = await query(
    role === 'admin'
      ? 'SELECT * FROM admins WHERE username = ? OR email = ? LIMIT 1'
      : 'SELECT * FROM customers WHERE username = ? OR email = ? LIMIT 1',
    [username, username],
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const profile = role === 'admin' ? buildAdminUser(user) : buildCustomerUser(user);
  return res.json({ user: profile, token: createSession(profile) });
});

router.post('/google', async (req, res) => {
  const body = req.body || {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Google credential token is required.', field: 'token' });
  }

  try {
    const identity = await verifyGoogleToken(token);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    const customerRows = await query('SELECT * FROM customers WHERE email = ? LIMIT 1', [identity.email]);
    if (customerRows.length > 0) {
      const profile = buildCustomerUser(customerRows[0]);
      return res.json({ user: profile, token: createSession(profile) });
    }

    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: 'Username must be 1-11 characters (letters, numbers, underscore, hyphen only).',
        code: 'INVALID_USERNAME_FORMAT',
        field: 'signupUsername',
      });
    }
    if (!isValidPhilippinePhone(contact)) {
      return res.status(400).json({
        error: 'Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).',
        code: 'INVALID_PHONE_FORMAT',
        field: 'signupContact',
      });
    }
    if (await isUsernameTaken(username)) {
      return res.status(409).json({
        error: 'Username is already taken.',
        code: 'USERNAME_TAKEN',
        field: 'signupUsername',
      });
    }
    if (await isEmailTaken(identity.email)) {
      return res.status(409).json({ error: 'Email address is already registered.', code: 'EMAIL_TAKEN' });
    }

    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    const user = await createCustomerAccount({
      username,
      email: identity.email,
      phone: contact,
      avatar: identity.avatar,
      passwordHash,
    });
    const profile = { ...user, avatar: identity.avatar || null };
    return res.status(201).json({ user: profile, token: createSession(profile) });
  } catch (error) {
    console.error('Google Sign-in Error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

router.post('/signup', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const contact = String(req.body.contact || '').trim();
  const password = req.body.password || '';

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: 'Username must be 1-11 characters (letters, numbers, underscore, hyphen only).',
      code: 'INVALID_USERNAME_FORMAT',
      field: 'signupUsername',
    });
  }

  if (!isValidPhilippinePhone(contact)) {
    return res.status(400).json({
      error: 'Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).',
      code: 'INVALID_PHONE_FORMAT',
      field: 'signupContact',
    });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      error: 'Invalid email address.',
      code: 'INVALID_EMAIL',
      field: 'signupEmail',
    });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and include uppercase letters, lowercase letters, and numbers.',
      code: 'WEAK_PASSWORD',
      field: 'signupPassword',
    });
  }

  if (await isUsernameTaken(username)) {
    return res.status(409).json({
      error: 'Username is already taken.',
      code: 'USERNAME_TAKEN',
      field: 'signupUsername',
    });
  }

  if (await isEmailTaken(email)) {
    return res.status(409).json({
      error: 'Email address is already registered.',
      code: 'EMAIL_TAKEN',
      field: 'signupEmail',
    });
  }

  const passwordHash = await hashPassword(password);
  const newUser = await createCustomerAccount({ username, email, phone: contact, passwordHash });

  return res.status(201).json({ user: newUser, token: createSession(newUser) });
});

router.post('/signup-initiate', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const contact = String(req.body.contact || '').trim();
  const password = req.body.password || '';

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: 'Username must be 1-11 characters (letters, numbers, underscore, hyphen only).',
      code: 'INVALID_USERNAME_FORMAT',
      field: 'signupUsername',
    });
  }

  if (!isValidPhilippinePhone(contact)) {
    return res.status(400).json({
      error: 'Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).',
      code: 'INVALID_PHONE_FORMAT',
      field: 'signupContact',
    });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, and numbers.',
      code: 'WEAK_PASSWORD',
      field: 'signupPassword',
    });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      error: 'Invalid email address.',
      code: 'INVALID_EMAIL',
      field: 'signupEmail',
    });
  }

  try {
    const bypassVerification = shouldBypassEmailVerification();

    const usernameTaken = await isUsernameTaken(username, { includePending: !bypassVerification });
    if (usernameTaken) {
      return res.status(409).json({
        error: 'Username is already taken.',
        code: 'USERNAME_TAKEN',
        field: 'signupUsername',
      });
    }

    const emailTaken = await isEmailTaken(email, { includePending: !bypassVerification });
    if (emailTaken) {
      return res.status(409).json({
        error: 'Email address is already registered.',
        code: 'EMAIL_TAKEN',
        field: 'signupEmail',
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await hashPassword(password);

    if (bypassVerification) {
      const newUser = await createCustomerAccount({ username, email, phone: contact, passwordHash });
      await execute('DELETE FROM pending_registrations WHERE email = ?', [email]);
      queueSignupConfirmationEmail(email, username);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        user: newUser,
        token: createSession(newUser),
        bypassVerification: true,
      });
    }

    await execute(
      'INSERT INTO pending_registrations (email, username, phone, password_hash, code) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, phone = ?, password_hash = ?, code = ?',
      [email, username, contact, passwordHash, code, username, contact, passwordHash, code]
    );

    try {
      await dispatchVerificationEmail(email, code);
    } catch (emailError) {
      console.error('Signup verification email failed:', emailError);
      // Clean up the pending registration so the user can retry
      await execute('DELETE FROM pending_registrations WHERE email = ?', [email]).catch(() => {});
      return res.status(500).json({
        error: 'Failed to send verification email. Please check your email address and try again.',
        code: 'EMAIL_SEND_FAILED',
      });
    }

    return res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Signup Initiate Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/signup-verify', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const code = String(req.body.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  try {
    const rows = await query('SELECT * FROM pending_registrations WHERE email = ? LIMIT 1', [email]);
    const reg = rows[0];

    if (!reg || reg.code !== code) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const publicId = `RRC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
    await execute(
      'INSERT INTO customers (public_id, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [publicId, reg.username, reg.email, reg.phone, reg.password_hash]
    );

    await execute('DELETE FROM pending_registrations WHERE email = ?', [email]);

    const newUser = {
      id: publicId,
      username: reg.username,
      email: reg.email,
      phone: reg.phone,
      role: 'customer',
    };

    queueSignupConfirmationEmail(reg.email, reg.username);
    return res.status(201).json({ user: newUser, token: createSession(newUser) });
  } catch (error) {
    console.error('Signup Verify Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/reset-initiate', async (req, res) => {
  const email = String(req.body.email || '').trim();

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const rows = await query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'This email address is not registered as a customer.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await execute(
      'INSERT INTO password_resets (email, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE code = ?',
      [email, code, code]
    );

    try {
      await dispatchVerificationEmail(email, code);
    } catch (emailError) {
      console.error('Password reset email failed:', emailError);
      // Clean up the reset record so the user can retry
      await execute('DELETE FROM password_resets WHERE email = ?', [email]).catch(() => {});
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again.',
        code: 'EMAIL_SEND_FAILED',
      });
    }

    return res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Reset Initiate Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/reset-verify', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const code = String(req.body.code || '').trim();
  const password = req.body.password || '';

  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and include uppercase, lowercase, and numbers.' });
  }

  try {
    const rows = await query('SELECT * FROM password_resets WHERE email = ? LIMIT 1', [email]);
    const reset = rows[0];

    if (!reset || reset.code !== code) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const passwordHash = await hashPassword(password);
    await execute('UPDATE customers SET password_hash = ? WHERE email = ?', [passwordHash, email]);

    await execute('DELETE FROM password_resets WHERE email = ?', [email]);

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset Verify Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/google-verify-reset', async (req, res) => {
  const body = req.body || {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Google credential token is required.', field: 'token' });
  }

  try {
    const identity = await verifyGoogleToken(token);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    const rows = await query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [identity.email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No customer account is registered with this Google account.' });
    }

    return res.json({ success: true, email: identity.email });
  } catch (error) {
    console.error('Google Password Reset Verification Error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

router.post('/google-reset-password', async (req, res) => {
  const body = req.body || {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token || !password) {
    return res.status(400).json({ error: 'Google credential token and new password are required.' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, and numbers.',
    });
  }

  try {
    const identity = await verifyGoogleToken(token);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    const rows = await query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [identity.email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No customer account is registered with this Google account.' });
    }

    const passwordHash = await hashPassword(password);
    await execute('UPDATE customers SET password_hash = ? WHERE email = ?', [passwordHash, identity.email]);
    await execute('DELETE FROM password_resets WHERE email = ?', [identity.email]);

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Google Password Reset Error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

export default router;
