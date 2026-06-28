import express from 'express';
import { execute, parseJson, query, safeJson } from '../db.js';
import { sendRequestStatusEmail } from '../mailer.js';

const router = express.Router();

function formatRequest(row) {
  return {
    id: row.request_code,
    customerId: row.customer_public_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    event: parseJson(row.event_json, {}),
    package: parseJson(row.package_json, null),
    equipment: parseJson(row.equipment_json, []),
    billing: parseJson(row.billing_json, null),
    denialReason: row.denial_reason || null,
    additional: row.additional_notes,
  };
}

function buildNotifMessage(requestCode, status, eventTitle) {
  const title = eventTitle || 'your event';
  const msgs = {
    pending:         `Your request ${requestCode} has been submitted and is pending review.`,
    approved:        `Your request ${requestCode} for "${title}" has been approved! Check billing details and arrange your downpayment via chat.`,
    awaitingpayment: `Your request ${requestCode} for "${title}" has been approved and is awaiting your downpayment. Please settle via chat.`,
    upcoming:        `Your request ${requestCode} for "${title}" is confirmed! Your downpayment has been received. Get ready for your event!`,
    completed:       `Your event "${title}" (${requestCode}) is now marked as completed. Thank you for choosing RRC Lights & Sounds!`,
    denied:          `Your request ${requestCode} for "${title}" has been denied. Please check My Requests for the reason.`,
    cancelled:       `Your request ${requestCode} for "${title}" has been cancelled.`,
  };
  return msgs[status] || `Your request ${requestCode} status has been updated to: ${status}.`;
}

router.get('/summary', async (req, res) => {
  try {
    const [requestCount, pendingCount, inquiryCount, inventoryCount, lowStockCount] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM requests'),
      query("SELECT COUNT(*) AS count FROM requests WHERE status = 'pending'"),
      query('SELECT COUNT(*) AS count FROM chat_messages'),
      query('SELECT COUNT(*) AS count FROM inventory_items'),
      query('SELECT COUNT(*) AS count FROM inventory_items WHERE stock <= 2'),
    ]);

    res.json({
      summary: {
        totalRequests: requestCount[0].count,
        pendingRequests: pendingCount[0].count,
        inquiryMessages: inquiryCount[0].count,
        inventoryItems: inventoryCount[0].count,
        lowStockItems: lowStockCount[0].count,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load summary' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const rows = await query(`
      SELECT r.*, c.username AS customer_name, c.email AS customer_email, c.phone AS customer_phone
      FROM requests r
      LEFT JOIN customers c ON c.public_id = r.customer_public_id
      ORDER BY r.created_at DESC, r.id DESC
    `);

    res.json({ requests: rows.map(formatRequest) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load requests' });
  }
});

router.patch('/requests/:requestCode', async (req, res) => {
  try {
    const { requestCode } = req.params;
    const { status, package: pkg, equipment, additional, event, billing, denialReason } = req.body;

    const updates = [];
    const params = [];
    if (status !== undefined)       { updates.push('status = ?');         params.push(status); }
    if (pkg !== undefined)          { updates.push('package_json = ?');   params.push(pkg ? safeJson(pkg) : null); }
    if (equipment !== undefined)    { updates.push('equipment_json = ?'); params.push(safeJson(equipment)); }
    if (billing !== undefined)      { updates.push('billing_json = ?');   params.push(billing ? safeJson(billing) : null); }
    if (denialReason !== undefined) { updates.push('denial_reason = ?'); params.push(denialReason || null); }
    if (additional !== undefined)   { updates.push('additional_notes = ?'); params.push(additional); }
    if (event !== undefined)        { updates.push('event_json = ?');     params.push(safeJson(event)); }

    if (updates.length > 0) {
      params.push(requestCode);
      await execute(`UPDATE requests SET ${updates.join(', ')} WHERE request_code = ?`, params);
    }

    const rows = await query(`
      SELECT r.*, c.username AS customer_name, c.email AS customer_email, c.phone AS customer_phone
      FROM requests r
      LEFT JOIN customers c ON c.public_id = r.customer_public_id
      WHERE r.request_code = ?
      LIMIT 1
    `, [requestCode]);

    const updated = rows[0] ? formatRequest(rows[0]) : null;

    // ── Auto-update Events Calendar when moving to 'upcoming' ──────────────
    if (status === 'upcoming' && updated) {
      try {
        const ev = updated.event || {};
        // Parse the event date string into a YYYY-MM-DD key
        const parsedDate = ev.date ? new Date(ev.date) : null;
        if (parsedDate && !isNaN(parsedDate)) {
          const dateKey = parsedDate.toISOString().slice(0, 10);
          const timeLabel = `${ev.timeStart || ''} - ${ev.timeEnd || ''}`;

          const existing = await query('SELECT events_json FROM events WHERE event_date = ? LIMIT 1', [dateKey]);
          if (existing.length > 0) {
            const eventsArr = parseJson(existing[0].events_json, []);
            // Remove old entry for this requestCode if exists
            const filtered = eventsArr.filter((e) => e.bookingId !== requestCode);
            filtered.push({ time: timeLabel, title: ev.title || 'Event', location: ev.venue || '', bookingId: requestCode });
            await execute('UPDATE events SET events_json = ? WHERE event_date = ?', [safeJson(filtered), dateKey]);
          } else {
            const newEntry = [{ time: timeLabel, title: ev.title || 'Event', location: ev.venue || '', bookingId: requestCode }];
            await execute('INSERT INTO events (event_date, events_json) VALUES (?, ?)', [dateKey, safeJson(newEntry)]);
          }
        }
      } catch (calErr) {
        console.error('Failed to update events calendar:', calErr.message);
      }
    }

    // ── Insert in-app notification for the customer ─────────────────────────
    if (status !== undefined && updated && rows[0]?.customer_public_id) {
      try {
        const eventTitle = updated.event?.title;
        const msg = buildNotifMessage(requestCode, status, eventTitle);
        await execute(
          'INSERT INTO notifications (customer_public_id, request_code, type, message) VALUES (?, ?, ?, ?)',
          [rows[0].customer_public_id, requestCode, 'status_change', msg],
        );
      } catch (notifErr) {
        console.error('Failed to insert notification:', notifErr.message);
      }
    }

    // ── Email notification ──────────────────────────────────────────────────
    if (status !== undefined && updated && rows[0]?.customer_email) {
      try {
        await sendRequestStatusEmail(rows[0].customer_email, updated);
      } catch (emailErr) {
        console.error('Failed to send status email:', emailErr.message);
      }
    }

    res.json({ request: updated });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update request' });
  }
});

router.get('/inquiries', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM chat_messages ORDER BY created_at ASC, id ASC');
    res.json({ messages: rows.map((row) => ({
      id: row.id,
      senderRole: row.sender_role,
      senderName: row.sender_name,
      customerPublicId: row.customer_public_id,
      type: row.sender_role === 'admin' ? 'received' : 'sent',
      text: row.text,
      image: row.image,
      time: row.time_label,
      isRead: Boolean(row.is_read),
    })) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load inquiries' });
  }
});

router.patch('/inquiries/read', async (req, res) => {
  try {
    const payload = req.body || {};
    const customerId = payload.customerId || req.query.customerId || null;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });

    await execute('UPDATE chat_messages SET is_read = 1 WHERE customer_public_id = ?', [customerId]);
    res.json({ ok: true, customerId });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to mark inquiries read' });
  }
});

// Delete all chat messages for a customer
router.delete('/inquiries/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });

    await execute('DELETE FROM chat_messages WHERE customer_public_id = ?', [customerId]);
    res.json({ ok: true, customerId });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to delete inquiries' });
  }
});

router.post('/inquiries', async (req, res) => {
  try {
    const payload = req.body || {};
    const timeLabel = payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const customerPublicId = payload.customerPublicId || null;
    await execute(
      'INSERT INTO chat_messages (sender_role, sender_name, customer_public_id, text, image, time_label) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.senderRole || 'admin', payload.senderName || 'RRC Admin', customerPublicId, payload.text || '', payload.image || null, timeLabel],
    );
    res.status(201).json({ message: { senderRole: payload.senderRole || 'admin', senderName: payload.senderName || 'RRC Admin', customerPublicId, text: payload.text || '', image: payload.image || null, time: timeLabel } });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to post reply' });
  }
});

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
        notes: row.notes,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load inventory' });
  }
});

router.patch('/inventory/:itemCode', async (req, res) => {
  try {
    const { itemCode } = req.params;
    const { stock, notes, requiresAuth, name, category } = req.body;

    const updates = [];
    const params = [];
    if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (requiresAuth !== undefined) { updates.push('requires_auth = ?'); params.push(Number(requiresAuth)); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }

    if (updates.length > 0) {
      params.push(itemCode);
      await execute(`UPDATE inventory_items SET ${updates.join(', ')} WHERE item_code = ?`, params);
    }

    const rows = await query('SELECT * FROM inventory_items WHERE item_code = ? LIMIT 1', [itemCode]);
    const row = rows[0];
    res.json({
      item: row
        ? {
            id: row.item_code,
            category: row.category,
            name: row.name,
            stock: row.stock,
            requiresAuth: Boolean(row.requires_auth),
            notes: row.notes,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update inventory item' });
  }
});

router.post('/inventory', async (req, res) => {
  try {
    const { category, name, stock, notes, requiresAuth } = req.body;
    const itemCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
    
    await execute(
      'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        itemCode, 
        category || 'Audio', 
        name || '', 
        stock !== undefined ? Number(stock) : 0, 
        requiresAuth ? 1 : 0, 
        notes || '[]'
      ]
    );

    res.status(201).json({
      item: {
        id: itemCode,
        category: category || 'Audio',
        name: name || '',
        stock: stock !== undefined ? Number(stock) : 0,
        requiresAuth: Boolean(requiresAuth),
        notes: notes || '[]'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create inventory item' });
  }
});

router.delete('/inventory/:itemCode', async (req, res) => {
  try {
    const { itemCode } = req.params;
    await execute('DELETE FROM inventory_items WHERE item_code = ?', [itemCode]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to delete inventory item' });
  }
});


router.get('/packages', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM packages ORDER BY id ASC');
    res.json({
      packages: rows.map((row) => ({
        id: row.id,
        section: row.section,
        name: row.name,
        subtitle: row.subtitle,
        occasion: row.occasion,
        note: row.note,
        price: Number(row.price),
        promo: Number(row.promo),
        color: row.color,
        groups: parseJson(row.groups_json, []),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to load packages' });
  }
});

router.post('/packages', async (req, res) => {
  try {
    const payload = req.body || {};
    await execute(
      'INSERT INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.section, payload.name, payload.subtitle, payload.occasion, payload.note, payload.price, payload.promo, payload.color, safeJson(payload.groups || [])],
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create package' });
  }
});

router.patch('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const updates = [];
    const params = [];
    if (payload.section !== undefined) { updates.push('section = ?'); params.push(payload.section); }
    if (payload.name !== undefined) { updates.push('name = ?'); params.push(payload.name); }
    if (payload.subtitle !== undefined) { updates.push('subtitle = ?'); params.push(payload.subtitle); }
    if (payload.occasion !== undefined) { updates.push('occasion = ?'); params.push(payload.occasion); }
    if (payload.note !== undefined) { updates.push('note = ?'); params.push(payload.note); }
    if (payload.price !== undefined) { updates.push('price = ?'); params.push(payload.price); }
    if (payload.promo !== undefined) { updates.push('promo = ?'); params.push(payload.promo); }
    if (payload.color !== undefined) { updates.push('color = ?'); params.push(payload.color); }
    if (payload.groups !== undefined) { updates.push('groups_json = ?'); params.push(safeJson(payload.groups)); }

    if (updates.length > 0) {
      params.push(parseInt(id, 10));
      await execute(`UPDATE packages SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update package' });
  }
});

router.delete('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('DELETE FROM packages WHERE id = ?', [parseInt(id, 10)]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to delete package' });
  }
});


export default router;