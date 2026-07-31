import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

function formatMessage(row) {
  let replyTo = null;
  if (row.reply_to_json) {
    try { replyTo = JSON.parse(row.reply_to_json); } catch (_) {}
  }
  return {
    id: row.id,
    type: row.sender_role === 'admin' ? 'received' : 'sent',
    senderRole: row.sender_role,
    senderName: row.sender_name,
    customerPublicId: row.customer_public_id,
    text: row.text,
    image: row.image,
    originalText: row.original_text,
    editedAt: row.edited_at,
    time: row.time_label,
    createdAt: row.created_at || new Date().toISOString(),
    isRead: Boolean(row.is_read),
    replyTo: replyTo,
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
  const replyToJson = payload.replyTo ? JSON.stringify(payload.replyTo) : null;

  execute(
    'INSERT INTO chat_messages (sender_role, sender_name, customer_public_id, text, image, time_label, reply_to_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [senderRole, senderName, customerPublicId, payload.text || '', payload.image || null, timeLabel, replyToJson],
  )
    .then((result) => {
      res.status(201).json({
        message: {
          id: result.insertId,
          type: senderRole === 'admin' ? 'received' : 'sent',
          senderRole,
          senderName,
          customerPublicId,
          text: payload.text || '',
          image: payload.image || null,
          originalText: null,
          editedAt: null,
          time: timeLabel,
          createdAt: new Date().toISOString(),
          replyTo: payload.replyTo || null,
        },
      });
    })
    .catch((error) => { res.status(500).json({ error: error.message || 'Unable to send message' }); });
});

router.patch('/messages/:id', async (req, res) => {
  const messageId = Number.parseInt(req.params.id, 10);
  const { text, senderRole, customerPublicId } = req.body || {};
  if (!Number.isInteger(messageId) || !String(text || '').trim()) {
    return res.status(400).json({ error: 'A valid message ID and text are required.' });
  }

  try {
    const rows = await query('SELECT * FROM chat_messages WHERE id = ? LIMIT 1', [messageId]);
    const message = rows[0];
    if (!message) return res.status(404).json({ error: 'Message not found.' });

    const ownsMessage = message.sender_role === 'admin'
      ? senderRole === 'admin'
      : senderRole === 'customer' && message.customer_public_id === customerPublicId;
    if (!ownsMessage) return res.status(403).json({ error: 'You can only edit your own messages.' });
    if (message.image && !message.text) return res.status(400).json({ error: 'Photo messages cannot be edited.' });

    const originalText = message.original_text ?? message.text;
    await execute(
      'UPDATE chat_messages SET text = ?, original_text = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
      [String(text).trim(), originalText, messageId],
    );
    const updatedRows = await query('SELECT * FROM chat_messages WHERE id = ? LIMIT 1', [messageId]);
    res.json({ message: formatMessage(updatedRows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to edit message.' });
  }
});

export default router;
