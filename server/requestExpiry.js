import { execute, parseJson, query } from './db.js';
import { releaseEquipmentStock, parseEquipmentList } from './inventoryHelpers.js';
import { sendAdminRequestExpiryEmail, sendRequestStatusEmail } from './mailer.js';

const businessDayLimit = 5;
const checkIntervalMs = 15 * 60 * 1000;
let checkInProgress = false;

export function hasFiveBusinessDaysElapsed(start, now = new Date()) {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime()) || now <= startDate) return false;

  const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let businessDays = 0;
  while (date < currentDate) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays >= businessDayLimit;
}

async function notifyExpiredRequest(request, reason) {
  try {
    await execute(
      'INSERT INTO notifications (customer_public_id, request_code, type, message) VALUES (?, ?, ?, ?)',
      [request.customer_public_id, request.request_code, 'status_change', reason],
    );
  } catch (error) {
    console.error(`Failed to add expiration notification for ${request.request_code}:`, error.message);
  }

  const event = parseJson(request.event_json, {});
  const emailRequest = {
    id: request.request_code,
    type: request.type,
    status: 'denied',
    event,
    denialReason: reason,
  };
  if (request.customer_email) {
    try {
      await sendRequestStatusEmail(request.customer_email, emailRequest);
    } catch (error) {
      console.error(`Failed to email customer about expired request ${request.request_code}:`, error.message);
    }
  }

  try {
    const admins = await query('SELECT email FROM admins WHERE email IS NOT NULL AND email <> ""');
    const adminEmails = admins.map(({ email }) => email);
    if (adminEmails.length === 0 && process.env.EMAIL_USER) {
      adminEmails.push(process.env.EMAIL_USER);
    }
    if (adminEmails.length === 0) {
      console.error(`No admin email recipient configured for expired request ${request.request_code}.`);
    }
    await Promise.all(adminEmails.map(async (email) => {
      try {
        await sendAdminRequestExpiryEmail(email, emailRequest);
      } catch (error) {
        console.error(`Failed to email admin about expired request ${request.request_code}:`, error.message);
      }
    }));
  } catch (error) {
    console.error(`Failed to load admins for expired request ${request.request_code}:`, error.message);
  }
}

async function expireRequest(request, reason, guardedUpdate) {
  const result = await execute(guardedUpdate, [reason, request.request_code, request.status]);
  if (!result.affectedRows) return;

  try {
    await releaseEquipmentStock(parseEquipmentList(request.equipment_json));
  } catch (error) {
    console.error(`Failed to release inventory for expired request ${request.request_code}:`, error.message);
  }
  await notifyExpiredRequest(request, reason);
}

export async function expireStaleRequests() {
  if (checkInProgress) return;
  checkInProgress = true;
  try {
    const requests = await query(`
      SELECT r.*, c.email AS customer_email, p.status AS payment_status
      FROM requests r
      LEFT JOIN customers c ON c.public_id = r.customer_public_id
      LEFT JOIN request_payments p ON p.request_code = r.request_code
      WHERE LOWER(r.status) IN ('pending', 'approved', 'awaitingpayment')
    `);

    for (const request of requests) {
      const currentStatus = String(request.status || '').toLowerCase();
      if (currentStatus === 'pending' && hasFiveBusinessDaysElapsed(request.created_at)) {
        const reason = 'Automatically denied because it remained pending for 5 business days without admin review.';
        await expireRequest(
          request,
          reason,
          `UPDATE requests SET status = 'denied', denial_reason = ?, status_updated_at = CURRENT_TIMESTAMP
           WHERE request_code = ? AND status = ?`,
        );
      } else if (
        ['approved', 'awaitingpayment'].includes(currentStatus)
        && String(request.payment_status || '').toLowerCase() !== 'paid'
        && hasFiveBusinessDaysElapsed(request.status_updated_at || request.created_at)
      ) {
        const reason = 'Automatically denied because the downpayment was not received and recorded within 5 business days of approval.';
        await expireRequest(
          request,
          reason,
          `UPDATE requests AS r SET status = 'denied', denial_reason = ?, status_updated_at = CURRENT_TIMESTAMP
           WHERE r.request_code = ? AND r.status = ?
             AND NOT EXISTS (
               SELECT 1 FROM request_payments p
               WHERE p.request_code = r.request_code AND p.status = 'paid'
             )`,
        );
      }
    }
  } catch (error) {
    console.error('Failed to process expired requests:', error.message);
  } finally {
    checkInProgress = false;
  }
}

export function startRequestExpiryJob() {
  expireStaleRequests();
  return setInterval(expireStaleRequests, checkIntervalMs);
}
