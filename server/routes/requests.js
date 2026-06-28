import express from 'express';
import { execute, parseJson, query, safeJson } from '../db.js';
import { sendRequestConfirmationEmail } from '../mailer.js';

const router = express.Router();

function formatRequest(row) {
  return {
    id: row.request_code,
    type: row.type,
    status: row.status,
    dateRequested: row.created_at ? new Date(row.created_at).toLocaleDateString() : null,
    customerId: row.customer_public_id,
    event: parseJson(row.event_json, {}),
    package: parseJson(row.package_json, null),
    equipment: parseJson(row.equipment_json, []),
    billing: parseJson(row.billing_json, null),
    denialReason: row.denial_reason || null,
    additional: row.additional_notes,
  };
}

router.get('/inventory', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM inventory_items ORDER BY category ASC, id ASC');
    res.json({
      items: rows.map((row) => ({
        id: row.item_code,
        category: row.category,
        name: row.name,
        stock: row.stock,
        requiresAuth: Boolean(row.requires_auth),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load inventory' });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────

router.get('/notifications', async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ error: 'customerId is required' });
  try {
    const rows = await query(
      'SELECT * FROM notifications WHERE customer_public_id = ? ORDER BY created_at DESC',
      [customerId],
    );
    res.json({
      notifications: rows.map((r) => ({
        id: r.id,
        requestCode: r.request_code,
        type: r.type,
        message: r.message,
        isRead: Boolean(r.is_read),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load notifications' });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: 'customerId is required' });
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE customer_public_id = ?', [customerId]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update notifications' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update notification' });
  }
});

// ── Requests ──────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { customerId } = req.query;
  const sql = customerId
    ? 'SELECT * FROM requests WHERE customer_public_id = ? ORDER BY created_at DESC, id DESC'
    : 'SELECT * FROM requests ORDER BY created_at DESC, id DESC';

  query(sql, customerId ? [customerId] : [])
    .then((rows) => {
      res.json({ requests: rows.map(formatRequest) });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load requests' });
    });
});

// Client-side cancel (only allowed from pending / approved / awaitingpayment)
router.patch('/:requestCode/cancel', async (req, res) => {
  try {
    const { requestCode } = req.params;
    const rows = await query('SELECT * FROM requests WHERE request_code = ? LIMIT 1', [requestCode]);
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

    const current = rows[0];
    const cancellableStatuses = ['pending', 'approved', 'awaitingpayment'];
    if (!cancellableStatuses.includes(current.status)) {
      return res.status(400).json({ error: 'This request can no longer be cancelled.' });
    }

    await execute('UPDATE requests SET status = ? WHERE request_code = ?', ['cancelled', requestCode]);

    // Insert notification for the customer
    const notifMsg = `Your request ${requestCode} has been cancelled.`;
    await execute(
      'INSERT INTO notifications (customer_public_id, request_code, type, message) VALUES (?, ?, ?, ?)',
      [current.customer_public_id, requestCode, 'status_change', notifMsg],
    );

    const updated = await query('SELECT * FROM requests WHERE request_code = ? LIMIT 1', [requestCode]);
    res.json({ request: formatRequest(updated[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to cancel request' });
  }
});

router.post('/', (req, res) => {
  const payload = req.body || {};
  const customerId = payload.customerId;
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  const requestCode = payload.id || `REQ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
  const event = {
    title: payload.title,
    venue: payload.venue,
    pax: payload.pax,
    date: payload.date,
    timeStart: payload.timeStart,
    timeEnd: payload.timeEnd,
  };

  execute(
    'INSERT INTO requests (request_code, customer_public_id, type, status, event_json, package_json, equipment_json, additional_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [requestCode, customerId, payload.type || 'book', 'pending', safeJson(event), payload.package ? safeJson(payload.package) : null, safeJson(payload.equipment || []), payload.additional || null],
  )
    .then(async () => {
      const newRequest = {
        id: requestCode,
        type: payload.type || 'book',
        status: 'pending',
        dateRequested: new Date().toLocaleDateString(),
        customerId,
        event,
        package: payload.package || null,
        equipment: payload.equipment || [],
        billing: null,
        denialReason: null,
        additional: payload.additional || null,
      };

      // Insert submitted notification
      try {
        await execute(
          'INSERT INTO notifications (customer_public_id, request_code, type, message) VALUES (?, ?, ?, ?)',
          [customerId, requestCode, 'submitted', `Your request ${requestCode} has been submitted and is now pending review.`],
        );
      } catch (_) {}

      // Send confirmation email to the customer (best-effort)
      try {
        const customerRows = await query('SELECT email FROM customers WHERE public_id = ? LIMIT 1', [customerId]);
        if (customerRows[0]?.email) {
          await sendRequestConfirmationEmail(customerRows[0].email, newRequest);
        }
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr.message);
      }

      res.status(201).json({ request: newRequest });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to create request' });
    });
});

export default router;
