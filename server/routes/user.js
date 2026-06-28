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

router.post('/profile', (req, res) => {
  const { userId, ...update } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);
    execute(
      'UPDATE admins SET username = COALESCE(?, username), email = COALESCE(?, email), full_name = COALESCE(?, full_name), avatar = COALESCE(?, avatar) WHERE id = ?',
      [update.username || null, update.email || null, update.fullName || update.username || null, update.avatar || null, adminId],
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

  if (update.phone || update.contact) {
    const contact = update.phone || update.contact;
    const cleaned = String(contact).replace(/\D/g, '');
    if (cleaned.length !== 11 || !cleaned.startsWith('09')) {
      return res.status(400).json({ error: 'Invalid Philippine phone number. Use format 09XXXXXXXXX (11 digits).' });
    }
  }

  execute(
    'UPDATE customers SET username = COALESCE(?, username), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar) WHERE public_id = ?',
    [update.username || null, update.email || null, update.phone || update.contact || null, update.avatar || null, userId],
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
  const { userId, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  if (typeof userId === 'string' && userId.startsWith('ADMIN-')) {
    const adminId = parseInt(userId.replace('ADMIN-', ''), 10);
    await execute('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);
    res.json({ user: { id: userId } });
    return;
  }

  await execute('UPDATE customers SET password_hash = ? WHERE public_id = ?', [passwordHash, userId]);
  res.json({ user: { id: userId } });
});

export default router;
