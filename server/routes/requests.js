import express from 'express';
import { execute, parseJson, query, safeJson } from '../db.js';
import { sendRequestConfirmationEmail } from '../mailer.js';
import { parseEquipmentList, validateEquipmentStock, reserveEquipmentStock, releaseEquipmentStock } from '../inventoryHelpers.js';

const router = express.Router();

function isFutureDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    return false;
  }

  function timeToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3]?.toUpperCase();
    if (minutes > 59 || hours > 23 || (period && (hours < 1 || hours > 12))) return null;
    if (period) {
      if (hours === 12) hours = 0;
      if (period === 'PM') hours += 12;
    }
    return hours * 60 + minutes;
  }

  function formatRequestDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return value > localToday;
}

function getEventEndDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const rangeMatch = text.match(/^([A-Za-z]+)\s+\d{1,2}\s*[-–]\s*(\d{1,2}),?\s+(\d{4})$/);
  const dateText = rangeMatch
    ? `${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`
    : text;
  const parsedDate = new Date(dateText);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
}

function hasEventEnded(value) {
  const eventEndDate = getEventEndDate(value);
  if (!eventEndDate) return false;

  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return eventEndDate < localToday;
}

async function completePastEvents(rows) {
  const eligibleStatuses = new Set(['upcoming', 'confirmed', 'paid']);
  const expiredRequests = rows.filter((row) => (
    eligibleStatuses.has(String(row.status || '').toLowerCase())
    && hasEventEnded(parseJson(row.event_json, {}).date)
  ));

  await Promise.all(expiredRequests.map((row) => (
    execute('UPDATE requests SET status = ? WHERE request_code = ? AND status = ?', [
      'completed',
      row.request_code,
      row.status,
    ])
  )));

  return expiredRequests.map((row) => row.request_code);
}

function formatRequest(row) {
  return {
    id: row.request_code,
    type: row.type,
    status: row.status,
    dateRequested: row.created_at ? formatRequestDate(row.created_at) : null,
    customerId: row.customer_public_id,
    event: parseJson(row.event_json, {}),
    package: parseJson(row.package_json, null),
    equipment: parseJson(row.equipment_json, []),
    billing: parseJson(row.billing_json, null),
    denialReason: row.denial_reason || null,
    additional: row.additional_notes,
    payment: row.payment_status ? {
      status: row.payment_status,
      amount: Number(row.payment_amount) || 0,
      receiptImage: row.receipt_image || null,
      receiptMessageId: row.receipt_message_id || null,
    } : null,
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
    ? `SELECT r.*, p.status AS payment_status, p.amount AS payment_amount,
         p.receipt_image, p.receipt_message_id
       FROM requests r LEFT JOIN request_payments p ON p.request_code = r.request_code
       WHERE r.customer_public_id = ? ORDER BY r.created_at DESC, r.id DESC`
    : `SELECT r.*, p.status AS payment_status, p.amount AS payment_amount,
         p.receipt_image, p.receipt_message_id
       FROM requests r LEFT JOIN request_payments p ON p.request_code = r.request_code
       ORDER BY r.created_at DESC, r.id DESC`;

  query(sql, customerId ? [customerId] : [])
    .then(async (rows) => {
      const completedRequestCodes = await completePastEvents(rows);
      rows.forEach((row) => {
        if (completedRequestCodes.includes(row.request_code)) row.status = 'completed';
      });
      res.json({ requests: rows.map(formatRequest) });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load requests' });
    });

  });

router.post('/:requestCode/downpayment-receipt', async (req, res) => {
      try {
        const { requestCode } = req.params;
        const { customerId, image } = req.body || {};
        if (!customerId || typeof image !== 'string' || !image.startsWith('data:image/')) {
          return res.status(400).json({ error: 'A valid receipt image and customer are required.' });
        }
        if (image.length > 7 * 1024 * 1024) {
          return res.status(400).json({ error: 'Receipt image must be 5 MB or smaller.' });
        }

        const rows = await query(
          `SELECT r.*, c.username AS customer_username
           FROM requests r
           LEFT JOIN customers c ON c.public_id = r.customer_public_id
           WHERE r.request_code = ? AND r.customer_public_id = ? LIMIT 1`,
          [requestCode, customerId],
        );
        const requestRow = rows[0];
        if (!requestRow) return res.status(404).json({ error: 'Request not found.' });
        if (!['approved', 'awaitingpayment'].includes(String(requestRow.status).toLowerCase())) {
          return res.status(400).json({ error: 'A receipt can only be sent for an approved request.' });
        }

        const billing = parseJson(requestRow.billing_json, {}) || {};
        const amount = Number(billing.downpaymentAmount) || Number(billing.total || 0) * 0.2;
        const messageText = `Downpayment receipt submitted for ${requestCode}. Please review the attached invoice.`;
        const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const result = await execute(
          `INSERT INTO chat_messages
           (sender_role, sender_name, customer_public_id, text, image, time_label)
           VALUES ('customer', ?, ?, ?, ?, ?)`,
          [requestRow.customer_username || customerId, customerId, messageText, image, timeLabel],
        );

        await execute(
          `INSERT INTO request_payments
           (request_code, status, amount, payment_method, receipt_message_id, receipt_image)
           VALUES (?, 'submitted', ?, 'customer_receipt', ?, ?)
           ON DUPLICATE KEY UPDATE
             status = IF(status = 'paid', status, 'submitted'),
             amount = VALUES(amount), payment_method = VALUES(payment_method),
             receipt_message_id = VALUES(receipt_message_id), receipt_image = VALUES(receipt_image)`,
          [requestCode, amount, result.insertId, image],
        );

        const updated = await query(
          `SELECT r.*, p.status AS payment_status, p.amount AS payment_amount,
             p.receipt_image, p.receipt_message_id
           FROM requests r LEFT JOIN request_payments p ON p.request_code = r.request_code
           WHERE r.request_code = ? LIMIT 1`,
          [requestCode],
        );
        res.status(201).json({ request: formatRequest(updated[0]) });
      } catch (error) {
        res.status(500).json({ error: error.message || 'Unable to submit downpayment receipt.' });
      }
});

// Client-side cancel (only allowed from pending / approved / awaitingpayment)
router.patch('/:requestCode/cancel', async (req, res) => {
  try {
    const { requestCode } = req.params;
    const rows = await query('SELECT * FROM requests WHERE request_code = ? LIMIT 1', [requestCode]);
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

    const current = rows[0];
    if (req.user?.role === 'customer' && current.customer_public_id !== req.user.id) {
      return res.status(403).json({ error: 'You may only cancel your own requests.' });
    }
    const cancellableStatuses = ['pending', 'approved', 'awaitingpayment'];
    if (!cancellableStatuses.includes(current.status)) {
      return res.status(400).json({ error: 'This request can no longer be cancelled.' });
    }

    await execute('UPDATE requests SET status = ? WHERE request_code = ?', ['cancelled', requestCode]);

    // Release reserved equipment stock if request was active
    const ACTIVE_STATUSES = ['pending', 'approved', 'awaitingpayment', 'upcoming', 'confirmed', 'paid', 'completed'];
    if (ACTIVE_STATUSES.includes(String(current.status).toLowerCase())) {
      const equipmentItems = parseEquipmentList(current.equipment_json);
      await releaseEquipmentStock(equipmentItems);
    }

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

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const customerId = payload.customerId;
    const requestType = payload.type || 'book';
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    if (!['book', 'rent'].includes(requestType)) {
      return res.status(400).json({ error: 'Request type must be book or rent.' });
    }
    if (requestType === 'book' && payload.serviceAgreementAccepted !== true) {
      return res.status(400).json({ error: 'Please accept the service agreement before submitting a booking.' });
    }
    if (requestType === 'book' && !/^\d+$/.test(String(payload.pax))) {
      return res.status(400).json({ error: 'Number of guests must be a whole, non-negative number.' });
    }
    if (!isFutureDate(payload.date)) {
      return res.status(400).json({ error: 'Please choose a future event date.' });
    }
    if (requestType === 'book') {
      const startMinutes = timeToMinutes(payload.timeStart);
      const endMinutes = timeToMinutes(payload.timeEnd);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return res.status(400).json({ error: 'The booking end time must be later than the start time.' });
      }
    }
    const deliveryMethod = requestType === 'rent' && payload.deliveryMethod === 'delivery'
      ? 'delivery'
      : 'pickup';
    if (requestType === 'rent' && !String(payload.venue || '').trim()) {
      return res.status(400).json({ error: 'A location is required for rent requests.' });
    }

    const requestCode = payload.id || `REQ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
    const event = {
      title: payload.title,
      venue: payload.venue,
      ...(requestType === 'book' ? { pax: payload.pax } : {}),
      date: payload.date,
      timeStart: payload.timeStart,
      timeEnd: payload.timeEnd,
      ...(requestType === 'rent' ? { deliveryMethod } : {}),
    };

    const equipmentItems = parseEquipmentList(payload.equipment);

    // 1. Validate requested equipment quantities against current inventory
    try {
      await validateEquipmentStock(equipmentItems);
    } catch (valErr) {
      return res.status(400).json({ error: valErr.message });
    }

    // 2. Reserve inventory when request is submitted
    await reserveEquipmentStock(equipmentItems);

    try {
      await execute(
        'INSERT INTO requests (request_code, customer_public_id, type, status, event_json, package_json, equipment_json, additional_notes, service_agreement_accepted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          requestCode,
          customerId,
          requestType,
          'pending',
          safeJson(event),
          payload.package ? safeJson(payload.package) : null,
          safeJson(payload.equipment || []),
          payload.additional || null,
          requestType === 'book' ? 1 : 0,
        ],
      );
    } catch (dbErr) {
      // Rollback stock reservation if DB insert fails
      await releaseEquipmentStock(equipmentItems).catch(() => {});
      throw dbErr;
    }

    const newRequest = {
      id: requestCode,
      type: requestType,
      status: 'pending',
      dateRequested: formatRequestDate(new Date().toISOString()),
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
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create request' });
  }
});

export default router;
