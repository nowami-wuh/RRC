import express from 'express';
import { randomInt } from 'node:crypto';
import { execute, query } from '../db.js';
import { isUserOnline } from '../authMiddleware.js';
import { sendAdminEmailChangeVerificationEmail } from '../mailer.js';
import { hashPassword, verifyPassword } from '../passwords.js';

const router = express.Router();

function getAdminId(req) {
  const match = String(req.user?.id || '').match(/^ADMIN-(\d+)$/);
  return req.user?.role === 'admin' && match ? Number(match[1]) : null;
}

router.get('/', (req, res) => {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);
    query('SELECT id, username, email, email_verified, full_name, avatar FROM admins WHERE id = ? LIMIT 1', [adminId])
      .then((rows) => {
        const user = rows[0];
        if (!user) {
          return res.status(404).json({ error: 'Admin not found' });
        }
        return res.json({ user: { id: `ADMIN-${user.id}`, username: user.username, email: user.email, emailVerified: Number(user.email_verified) === 1, phone: '', fullName: user.full_name, avatar: user.avatar || null } });
      })
      .catch((error) => {
        res.status(500).json({ error: error.message || 'Unable to load admin' });
      });
    return;
  }

  query('SELECT public_id, username, email, phone, avatar FROM customers WHERE public_id = ? LIMIT 1', [userId])
    .then((rows) => {
      const user = rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user.public_id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || null,
          online: isUserOnline(user.public_id),
        },
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load user' });
    });
});

router.get('/presence', (req, res) => {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (req.user?.role === 'customer' && String(req.user.id) !== String(userId)) {
    return res.status(403).json({ error: 'You may only check your own presence.' });
  }
  res.json({ online: isUserOnline(userId) });
});

router.post('/admin-email-change/initiate', async (req, res) => {
  const adminId = getAdminId(req);
  if (!adminId) return res.status(403).json({ error: 'Administrator access required.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.', field: 'currentPassword' });
  }

  try {
    const adminRows = await query('SELECT email, email_verified, password_hash FROM admins WHERE id = ? LIMIT 1', [adminId]);
    const admin = adminRows[0];
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });
    if (!await verifyPassword(currentPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.', field: 'currentPassword' });
    }
    if (email === String(admin.email || '').trim().toLowerCase() && admin.email_verified) {
      return res.status(400).json({ error: 'This email address is already verified.' });
    }

    const [customerRows, otherAdminRows, pendingRows] = await Promise.all([
      query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [email]),
      query('SELECT 1 FROM admins WHERE email = ? AND id != ? LIMIT 1', [email, adminId]),
      query('SELECT 1 FROM admin_email_verifications WHERE email = ? AND admin_id != ? LIMIT 1', [email, adminId]),
    ]);
    if (customerRows.length || otherAdminRows.length || pendingRows.length) {
      return res.status(409).json({ error: 'Email address is already in use.', field: 'email' });
    }

    const code = String(randomInt(100000, 1000000));
    await execute(
      `INSERT INTO admin_email_verifications (admin_id, email, code, attempts)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE email = VALUES(email), code = VALUES(code), attempts = 0, created_at = CURRENT_TIMESTAMP`,
      [adminId, email, code],
    );

    try {
      await sendAdminEmailChangeVerificationEmail(email, code);
    } catch (error) {
      await execute('DELETE FROM admin_email_verifications WHERE admin_id = ?', [adminId]);
      console.error('Admin email verification delivery failed:', error);
      return res.status(500).json({ error: 'Could not send the verification code. Check the email address and try again.' });
    }

    return res.json({ success: true, message: 'Verification code sent to the new email address.' });
  } catch (error) {
    console.error('Admin email verification initiation failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to start email verification.' });
  }
});

router.post('/admin-email-change/confirm-password', async (req, res) => {
  const adminId = getAdminId(req);
  if (!adminId) return res.status(403).json({ error: 'Administrator access required.' });

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.', field: 'currentPassword' });
  }

  try {
    const rows = await query('SELECT password_hash FROM admins WHERE id = ? LIMIT 1', [adminId]);
    if (!rows[0]) return res.status(404).json({ error: 'Admin not found.' });
    if (!await verifyPassword(currentPassword, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.', field: 'currentPassword' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin email change password confirmation failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to confirm current password.' });
  }
});

router.post('/admin-email-change/verify', async (req, res) => {
  const adminId = getAdminId(req);
  if (!adminId) return res.status(403).json({ error: 'Administrator access required.' });

  const code = String(req.body?.code || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the 6-digit verification code.', field: 'code' });
  }

  try {
    const rows = await query(
      `SELECT email, code, attempts
       FROM admin_email_verifications
       WHERE admin_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       LIMIT 1`,
      [adminId],
    );
    const verification = rows[0];
    if (!verification || verification.attempts >= 5) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    if (verification.code !== code) {
      await execute('UPDATE admin_email_verifications SET attempts = attempts + 1 WHERE admin_id = ?', [adminId]);
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const [customerRows, otherAdminRows] = await Promise.all([
      query('SELECT 1 FROM customers WHERE email = ? LIMIT 1', [verification.email]),
      query('SELECT 1 FROM admins WHERE email = ? AND id != ? LIMIT 1', [verification.email, adminId]),
    ]);
    if (customerRows.length || otherAdminRows.length) {
      await execute('DELETE FROM admin_email_verifications WHERE admin_id = ?', [adminId]);
      return res.status(409).json({ error: 'Email address is already in use.', field: 'email' });
    }

    await execute('UPDATE admins SET email = ?, email_verified = 1 WHERE id = ?', [verification.email, adminId]);
    await execute('DELETE FROM admin_email_verifications WHERE admin_id = ?', [adminId]);
    return res.json({
      success: true,
      user: {
        id: `ADMIN-${adminId}`,
        email: verification.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('Admin email verification failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to verify email address.' });
  }
});

router.post('/presence', (req, res) => {
  res.json({ ok: true });
});

router.post('/profile', async (req, res) => {
  const { userId, ...update } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);
    const removeAvatar = update.removeAvatar === true;

    if (update.email !== undefined) {
      return res.status(400).json({ error: 'Admin email changes must be verified before they can be saved.', field: 'email' });
    }

    // Check username uniqueness (exclude self)
    if (update.username) {
      const takenCust = await query(
        'SELECT 1 FROM customers WHERE username = ? LIMIT 1',
        [update.username],
      ).catch(() => []);
      const takenAdmin = await query(
        'SELECT 1 FROM admins WHERE username = ? AND id != ? LIMIT 1',
        [update.username, adminId],
      ).catch(() => []);
      if (takenCust.length > 0 || takenAdmin.length > 0) {
        return res.status(409).json({ error: 'Username is already taken.', field: 'username' });
      }
    }

    execute(
      'UPDATE admins SET username = COALESCE(?, username), email = COALESCE(?, email), full_name = COALESCE(?, full_name), avatar = IF(?, NULL, COALESCE(?, avatar)) WHERE id = ?',
      [update.username || null, update.email ? String(update.email).trim().toLowerCase() : null, update.fullName || null, removeAvatar, update.avatar || null, adminId],
    )
      .then(async () => {
        const rows = await query('SELECT id, username, email, email_verified, full_name, avatar FROM admins WHERE id = ? LIMIT 1', [adminId]);
        const admin = rows[0];
        return res.json({ user: { id: `ADMIN-${admin.id}`, username: admin.username, email: admin.email, emailVerified: Number(admin.email_verified) === 1, phone: '', fullName: admin.full_name, avatar: admin.avatar || null } });
      })
      .catch((error) => {
        res.status(500).json({ error: error.message || 'Unable to update admin profile' });
      });
    return;
  }

  // Customer uniqueness checks
  const removeAvatar = update.removeAvatar === true;
  if (update.username) {
    const takenCust = await query(
      'SELECT 1 FROM customers WHERE username = ? AND public_id != ? LIMIT 1',
      [update.username, userId],
    ).catch(() => []);
    const takenAdmin = await query(
      'SELECT 1 FROM admins WHERE username = ? LIMIT 1',
      [update.username],
    ).catch(() => []);
    if (takenCust.length > 0 || takenAdmin.length > 0) {
      return res.status(409).json({ error: 'Username is already taken.', field: 'username' });
    }
  }

  if (update.email) {
    const normalizedEmail = String(update.email).trim().toLowerCase();
    const takenCust = await query(
      'SELECT 1 FROM customers WHERE email = ? AND public_id != ? LIMIT 1',
      [normalizedEmail, userId],
    ).catch(() => []);
    const takenAdmin = await query(
      'SELECT 1 FROM admins WHERE email = ? LIMIT 1',
      [normalizedEmail],
    ).catch(() => []);
    if (takenCust.length > 0 || takenAdmin.length > 0) {
      return res.status(409).json({ error: 'Email address is already in use.', field: 'email' });
    }
  }

  if (update.phone || update.contact) {
    const contact = update.phone || update.contact;
    const cleaned = String(contact).replace(/\D/g, '');
    if (cleaned.length !== 11 || !cleaned.startsWith('09')) {
      return res.status(400).json({ error: 'Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).' });
    }
  }

  execute(
    'UPDATE customers SET username = COALESCE(?, username), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = IF(?, NULL, COALESCE(?, avatar)) WHERE public_id = ?',
    [update.username || null, update.email ? String(update.email).trim().toLowerCase() : null, update.phone || update.contact || null, removeAvatar, update.avatar || null, userId],
  )
    .then(async () => {
      const rows = await query('SELECT public_id, username, email, phone, avatar FROM customers WHERE public_id = ? LIMIT 1', [userId]);
      return res.json({ user: { id: rows[0].public_id, username: rows[0].username, email: rows[0].email, phone: rows[0].phone, avatar: rows[0].avatar || null } });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to update profile' });
    });
});

router.post('/password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
      const adminId = parseInt(userId.replace('ADMIN-', ''), 10);

      const rows = await query('SELECT password_hash FROM admins WHERE id = ? LIMIT 1', [adminId]);
      if (!rows[0]) return res.status(404).json({ error: 'Admin not found' });
      const valid = await verifyPassword(currentPassword, rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const passwordHash = await hashPassword(newPassword);
      await execute('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);
      return res.json({ user: { id: userId } });
    }

    // Customer — verify current password
    const rows = await query('SELECT password_hash FROM customers WHERE public_id = ? LIMIT 1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const valid = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await execute('UPDATE customers SET password_hash = ? WHERE public_id = ?', [passwordHash, userId]);
    return res.json({ user: { id: userId } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update password' });
  }
});

export default router;
