import { execute, parseJson, query } from './db.js';
import { hasEventEnded } from './eventStatus.js';
import { releaseEquipmentStock, parseEquipmentList } from './inventoryHelpers.js';
import {
  sendAdminPendingRequestReminderEmail,
  sendAdminRequestExpiryEmail,
  sendCustomerPendingRequestReminderEmail,
  sendRequestStatusEmail,
} from './mailer.js';

const businessDayLimit = 5;
const checkIntervalMs = 15 * 60 * 1000;
let checkInProgress = false;

export function getElapsedBusinessDays(start, now = new Date()) {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 0;

  const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let businessDays = 0;
  while (date < currentDate) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays;
}

export function hasFiveBusinessDaysElapsed(start, now = new Date()) {
  return getElapsedBusinessDays(start, now) >= businessDayLimit;
}

function parseEventDate(value) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsedDate.getFullYear() === Number(year)
      && parsedDate.getMonth() === Number(month) - 1
      && parsedDate.getDate() === Number(day)
    ) {
      return parsedDate;
    }
    return null;
  }

  const rangeMatch = text.match(/^([A-Za-z]+)\s+\d{1,2}\s*[-–]\s*(\d{1,2}),?\s+(\d{4})$/);
  const dateText = rangeMatch
    ? `${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`
    : text;
  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime())
    ? null
    : new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
}

export function hasEventDatePassed(event, now = new Date()) {
  const eventDate = parseEventDate(event?.endDate || event?.date);
  if (!eventDate) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate < today;
}

async function sendPendingRequestReminder(request, businessDays) {
  const pendingSince = request.status_updated_at || request.created_at;
  const reservation = await execute(`
    INSERT IGNORE INTO request_reminders (request_code, pending_since, business_day)
    SELECT ?, ?, ?
    FROM requests
    WHERE request_code = ? AND LOWER(status) = 'pending'
  `, [request.request_code, pendingSince, businessDays, request.request_code]);
  if (!reservation.affectedRows) return;

  const event = parseJson(request.event_json, {});
  const requestInfo = {
    id: request.request_code,
    type: request.type,
    event,
    customerName: request.customer_name,
    businessDays,
  };
  const customerMessage = `Reminder: your request ${request.request_code} has been waiting for admin review for ${businessDays} business day${businessDays === 1 ? '' : 's'}. If your event is approaching, please contact the admin through chat. Requests without admin action are automatically denied after 5 business days.`;

  try {
    await execute(
      'INSERT INTO notifications (customer_public_id, request_code, type, message) VALUES (?, ?, ?, ?)',
      [request.customer_public_id, request.request_code, 'request_reminder', customerMessage],
    );
  } catch (error) {
    console.error(`Failed to add pending reminder for ${request.request_code}:`, error.message);
  }

  if (request.customer_email) {
    try {
      await sendCustomerPendingRequestReminderEmail(request.customer_email, requestInfo);
    } catch (error) {
      console.error(`Failed to email customer pending reminder for ${request.request_code}:`, error.message);
    }
  }

  try {
    const admins = await query("SELECT email FROM admins WHERE email_verified = 1 AND email IS NOT NULL AND email <> ''");
    const adminEmails = admins.map(({ email }) => email);
    if (adminEmails.length === 0) {
      console.error(`No admin email recipient configured for pending request ${request.request_code}.`);
    }
    await Promise.all(adminEmails.map(async (email) => {
      try {
        await sendAdminPendingRequestReminderEmail(email, requestInfo);
      } catch (error) {
        console.error(`Failed to email admin pending reminder for ${request.request_code}:`, error.message);
      }
    }));
  } catch (error) {
    console.error(`Failed to load admins for pending reminder ${request.request_code}:`, error.message);
  }
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
    const admins = await query("SELECT email FROM admins WHERE email_verified = 1 AND email IS NOT NULL AND email <> ''");
    const adminEmails = admins.map(({ email }) => email);
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
      SELECT r.*, c.email AS customer_email, c.username AS customer_name, p.status AS payment_status
      FROM requests r
      LEFT JOIN customers c ON c.public_id = r.customer_public_id
      LEFT JOIN request_payments p ON p.request_code = r.request_code
      WHERE LOWER(r.status) IN ('pending', 'approved', 'awaitingpayment', 'upcoming', 'confirmed', 'paid')
    `);

    for (const request of requests) {
      const currentStatus = String(request.status || '').toLowerCase();
      if (['upcoming', 'confirmed', 'paid'].includes(currentStatus)) {
        const event = parseJson(request.event_json, {});
        if (hasEventEnded(event)) {
          await execute(
            `UPDATE requests SET status = 'completed', status_updated_at = CURRENT_TIMESTAMP
             WHERE request_code = ? AND status = ?`,
            [request.request_code, request.status],
          );
        }
      } else if (currentStatus === 'pending') {
        const event = parseJson(request.event_json, {});
        const pendingSince = request.status_updated_at || request.created_at;
        const elapsedBusinessDays = getElapsedBusinessDays(pendingSince);
        if (hasEventDatePassed(event)) {
          const reason = 'Automatically denied because the event date passed before an admin confirmed or rejected the request.';
          await expireRequest(
            request,
            reason,
            `UPDATE requests SET status = 'denied', denial_reason = ?, status_updated_at = CURRENT_TIMESTAMP
             WHERE request_code = ? AND status = ?`,
          );
        } else if (elapsedBusinessDays >= businessDayLimit) {
          const reason = 'Automatically denied because no admin action was taken within 5 business days while the request was pending.';
          await expireRequest(
            request,
            reason,
            `UPDATE requests SET status = 'denied', denial_reason = ?, status_updated_at = CURRENT_TIMESTAMP
             WHERE request_code = ? AND status = ?`,
          );
        } else if (elapsedBusinessDays > 0) {
          await sendPendingRequestReminder(request, elapsedBusinessDays);
        }
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
