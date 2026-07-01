import bcrypt from 'bcrypt';
import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);
    query('SELECT id, username, email, full_name, avatar FROM admins WHERE id = ? LIMIT 1', [adminId])
      .then((rows) => {
        const user = rows[0];
        if (!user) {
          return res.status(404).json({ error: 'Admin not found' });
        }
        return res.json({ user: { id: `ADMIN-${user.id}`, username: user.username, email: user.email, phone: '', fullName: user.full_name, avatar: user.avatar || null } });
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

      return res.json({ user: { id: user.public_id, username: user.username, email: user.email, phone: user.phone, avatar: user.avatar || null } });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load user' });
    });
});

router.post('/profile', async (req, res) => {
  const { userId, ...update } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);

    // Check uniqueness for username/email (exclude self)
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

    if (update.email) {
      const normalizedEmail = String(update.email).trim().toLowerCase();
      const takenCust = await query(
        'SELECT 1 FROM customers WHERE email = ? LIMIT 1',
        [normalizedEmail],
      ).catch(() => []);
      const takenAdmin = await query(
        'SELECT 1 FROM admins WHERE email = ? AND id != ? LIMIT 1',
        [normalizedEmail, adminId],
      ).catch(() => []);
      if (takenCust.length > 0 || takenAdmin.length > 0) {
        return res.status(409).json({ error: 'Email address is already in use.', field: 'email' });
      }
    }

    execute(
      'UPDATE admins SET username = COALESCE(?, username), email = COALESCE(?, email), full_name = COALESCE(?, full_name), avatar = COALESCE(?, avatar) WHERE id = ?',
      [update.username || null, update.email ? String(update.email).trim().toLowerCase() : null, update.fullName || null, update.avatar || null, adminId],
    )
      .then(async () => {
        const rows = await query('SELECT id, username, email, full_name, avatar FROM admins WHERE id = ? LIMIT 1', [adminId]);
        const admin = rows[0];
        return res.json({ user: { id: `ADMIN-${admin.id}`, username: admin.username, email: admin.email, phone: '', fullName: admin.full_name, avatar: admin.avatar || null } });
      })
      .catch((error) => {
        res.status(500).json({ error: error.message || 'Unable to update admin profile' });
      });
    return;
  }

  // Customer uniqueness checks
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
    'UPDATE customers SET username = COALESCE(?, username), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar) WHERE public_id = ?',
    [update.username || null, update.email ? String(update.email).trim().toLowerCase() : null, update.phone || update.contact || null, update.avatar || null, userId],
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
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
      const adminId = parseInt(userId.replace('ADMIN-', ''), 10);

      // Verify current password
      if (currentPassword) {
        const rows = await query('SELECT password_hash FROM admins WHERE id = ? LIMIT 1', [adminId]);
        if (!rows[0]) return res.status(404).json({ error: 'Admin not found' });
        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) {
          return res.status(401).json({ error: 'Current password is incorrect.' });
        }
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await execute('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);
      return res.json({ user: { id: userId } });
    }

    // Customer — verify current password
    if (currentPassword) {
      const rows = await query('SELECT password_hash FROM customers WHERE public_id = ? LIMIT 1', [userId]);
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await execute('UPDATE customers SET password_hash = ? WHERE public_id = ?', [passwordHash, userId]);
    return res.json({ user: { id: userId } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update password' });
  }
});

export default router;
