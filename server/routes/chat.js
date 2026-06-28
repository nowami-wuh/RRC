import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

function formatMessage(row) {
  return {
    type: row.sender_role === 'admin' ? 'received' : 'sent',
    senderRole: row.sender_role,
    senderName: row.sender_name,
    customerPublicId: row.customer_public_id,
    text: row.text,
    image: row.image,
    time: row.time_label,
    isRead: Boolean(row.is_read),
  };
}

// GET /chat  or  /chat?userId=RRC-XXXXXX  — filter to that user's thread
router.get('/', (req, res) => {
  const { userId } = req.query;
  const sql = userId
    ? 'SELECT * FROM chat_messages WHERE customer_public_id = ? ORDER BY created_at ASC, id ASC'
    : 'SELECT * FROM chat_messages ORDER BY created_at ASC, id ASC';
  const params = userId ? [userId] : [];
  query(sql, params)
    .then((rows) => { res.json({ messages: rows.map(formatMessage) }); })
    .catch((error) => { res.status(500).json({ error: error.message || 'Unable to load chat messages' }); });
});

// GET /chat/messages?userId=RRC-XXXXXX
router.get('/messages', (req, res) => {
  const { userId } = req.query;
  const sql = userId
    ? 'SELECT * FROM chat_messages WHERE customer_public_id = ? ORDER BY created_at ASC, id ASC'
    : 'SELECT * FROM chat_messages ORDER BY created_at ASC, id ASC';
  const params = userId ? [userId] : [];
  query(sql, params)
    .then((rows) => { res.json({ messages: rows.map(formatMessage) }); })
    .catch((error) => { res.status(500).json({ error: error.message || 'Unable to load chat messages' }); });
});

// POST /chat/messages — body must include customerPublicId for customer messages
router.post('/messages', (req, res) => {
  const payload = req.body || {};
  const senderRole = payload.senderRole || (payload.type === 'received' ? 'admin' : 'customer');
  const senderName = payload.senderName || (senderRole === 'admin' ? 'RRC Admin' : 'Customer');
  const customerPublicId = payload.customerPublicId || null;
  const timeLabel = payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  execute(
    'INSERT INTO chat_messages (sender_role, sender_name, customer_public_id, text, image, time_label) VALUES (?, ?, ?, ?, ?, ?)',
    [senderRole, senderName, customerPublicId, payload.text || '', payload.image || null, timeLabel],
  )
    .then(() => {
      res.status(201).json({
        message: {
          type: senderRole === 'admin' ? 'received' : 'sent',
          senderRole,
          senderName,
          customerPublicId,
          text: payload.text || '',
          image: payload.image || null,
          time: timeLabel,
        },
      });
    })
    .catch((error) => { res.status(500).json({ error: error.message || 'Unable to send message' }); });
});

export default router;
