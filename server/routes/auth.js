import express from 'express';
import bcrypt from 'bcrypt';
import { sendVerificationEmail } from '../mailer.js';
import { execute, query } from '../db.js';

const router = express.Router();

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

async function isUsernameTaken(username) {
  const [customerRows, adminRows] = await Promise.all([
    query('SELECT 1 FROM customers WHERE username = ? LIMIT 1', [username]),
    query('SELECT 1 FROM admins WHERE username = ? LIMIT 1', [username]),
  ]);

  return customerRows.length > 0 || adminRows.length > 0;
}

async function isEmailTaken(email) {
  const rows = await query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [email]);
  return rows.length > 0;
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

  const passwordHash = role === 'admin' ? user.password_hash : user.password_hash;
  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({ user: role === 'admin' ? buildAdminUser(user) : buildCustomerUser(user) });
});

router.post('/signup', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
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

  const passwordHash = await bcrypt.hash(password, 10);
  const publicId = `RRC-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;

  await execute(
    'INSERT INTO customers (public_id, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
    [publicId, username, email, contact, passwordHash],
  );

  const newUser = {
    id: publicId,
    username,
    email,
    phone: contact,
    role: 'customer',
  };

  return res.status(201).json({ user: newUser });
});

router.post('/signup-initiate', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
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

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    await execute(
      'INSERT INTO pending_registrations (email, username, phone, password_hash, code) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, phone = ?, password_hash = ?, code = ?',
      [email, username, contact, passwordHash, code, username, contact, passwordHash, code]
    );

    await sendVerificationEmail(email, code);

    return res.json({ success: true, message: 'Verification code sent to email.' });
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

    return res.status(201).json({ user: newUser });
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

    await sendVerificationEmail(email, code);

    return res.json({ success: true, message: 'Verification code sent to email.' });
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

    const passwordHash = await bcrypt.hash(password, 10);
    await execute('UPDATE customers SET password_hash = ? WHERE email = ?', [passwordHash, email]);

    await execute('DELETE FROM password_resets WHERE email = ?', [email]);

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset Verify Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
