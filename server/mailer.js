import nodemailer from 'nodemailer';

/**
 * Creates and returns a configured Nodemailer transporter.
 * Uses Gmail port 465 (SSL) which is more reliable on cloud platforms than 587.
 * Falls back to a no-op mock when EMAIL_USER / EMAIL_PASS are not set.
 */
function createTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailService = process.env.EMAIL_SERVICE;

  if (!emailUser || !emailPass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Production email credentials are missing: EMAIL_USER and EMAIL_PASS must be configured.');
    }
    return null; // mock mode for local development
  }

  // When EMAIL_SERVICE=gmail is set, use explicit host/port/secure
  // so we can control timeouts. Port 465 + secure:true (SSL) is more
  // reliable on Render than port 587 (STARTTLS).
  const isGmail = (emailService || '').toLowerCase() === 'gmail';
  const transportOptions = isGmail
    ? {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL — avoids STARTTLS handshake issues on Render
      }
    : emailService
      ? { service: emailService }
      : {
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: Number(process.env.EMAIL_PORT || 465),
          secure: String(process.env.EMAIL_SECURE || 'true').toLowerCase() === 'true',
        };

  return nodemailer.createTransport({
    ...transportOptions,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    // Fail fast — do not hang the request if SMTP is unreachable
    connectionTimeout: 10000,  // 10s to establish TCP connection
    greetingTimeout: 10000,    // 10s to receive SMTP greeting
    socketTimeout: 15000,      // 15s of inactivity before giving up
  });
}

/**
 * Low-level send helper. Logs to console when credentials are missing.
 * @param {object} mailOptions - Standard nodemailer mail options
 */
export async function sendMail(mailOptions) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n======================================================');
    console.log(`[EMAIL MOCK] To: ${mailOptions.to}`);
    console.log(`[EMAIL MOCK] Subject: ${mailOptions.subject}`);
    console.log(`[EMAIL MOCK] Body: ${mailOptions.text || '(html only)'}`);
    console.log('======================================================\n');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"RRC Lights & Sounds" <${process.env.EMAIL_USER}>`,
      ...mailOptions,
    });
    console.log(`[EMAIL] sent to ${mailOptions.to}: ${info.messageId || 'no-message-id'}`);
  } catch (error) {
    console.error(`[EMAIL] failed to send to ${mailOptions.to}:`, error?.message || error);
    throw error;
  }
}

/**
 * Verifies SMTP connectivity at startup. Call this once after server starts.
 * Logs success/failure to console — check Render logs to confirm.
 */
export async function verifyMailer() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('[EMAIL] Running in mock mode — no credentials set.');
    return;
  }

  const transporter = createTransporter();
  try {
    await transporter.verify();
    console.log('[EMAIL] ✅ SMTP connection verified — Gmail ready to send.');
  } catch (err) {
    console.error('[EMAIL] ❌ SMTP verification failed:', err.message);
    console.error('[EMAIL] Check EMAIL_USER, EMAIL_PASS (App Password), and EMAIL_SERVICE in Render env vars.');
  }
}

// ---------------------------------------------------------------------------
// Reusable email templates
// ---------------------------------------------------------------------------

/**
 * Sends the OTP / verification code used during signup and password reset.
 */
export async function sendVerificationEmail(email, code) {
  await sendMail({
    to: email,
    subject: 'RRC Lights & Sounds – Email Verification Code',
    text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #38629B; text-align: center;">RRC Lights &amp; Sounds</h2>
        <p>Thank you for signing up! Please verify your email address by entering the following code on the registration page:</p>
        <div style="font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 30px 0; color: #1E3F9E;">
          ${code}
        </div>
        <p>This code will expire in <strong>10 minutes</strong>. If you did not request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    `,
  });
}

export async function sendSignupConfirmationEmail(email, username = '') {
  await sendMail({
    to: email,
    subject: `RRC Lights & Sounds – Welcome to RRC, ${username || 'customer'}!`,
    text: `Welcome to RRC Lights & Sounds! Your account has been successfully created for ${email}. We look forward to serving you.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #38629B; text-align: center;">Welcome to RRC Lights &amp; Sounds</h2>
        <p>Hi ${username || 'there'},</p>
        <p>Your account has been successfully created using this email address:</p>
        <p style="font-weight: bold; word-break: break-word;">${email}</p>
        <p>We&apos;re excited to help with your next event. You can now log in anytime and submit equipment or booking requests.</p>
        <p>Thank you for choosing <strong>RRC Lights &amp; Sounds</strong>!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 24px;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    `,
  });
}

/**
 * Confirms to a customer that their service request was received.
 * @param {string} email
 * @param {object} request  - { id, type, event: { title, date, venue } }
 */
export async function sendRequestConfirmationEmail(email, request) {
  const { id, type, event = {} } = request;
  const typeLabel = type === 'book' ? 'Booking' : 'Inquiry';

  await sendMail({
    to: email,
    subject: `RRC Lights & Sounds – ${typeLabel} Request Received (${id})`,
    text: `
Hi there,

We have received your ${typeLabel.toLowerCase()} request (${id}).

Event Details:
  Title : ${event.title || 'N/A'}
  Date  : ${event.date || 'N/A'}
  Venue : ${event.venue || 'N/A'}

Our team will review your request and get back to you shortly.

Thank you for choosing RRC Lights & Sounds!
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #38629B; text-align: center;">RRC Lights &amp; Sounds</h2>
        <p>Hi there,</p>
        <p>We have received your <strong>${typeLabel.toLowerCase()} request</strong>. Here is a summary:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Request ID</td>
            <td style="padding: 8px 12px;">${id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Type</td>
            <td style="padding: 8px 12px;">${typeLabel}</td>
          </tr>
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Event Title</td>
            <td style="padding: 8px 12px;">${event.title || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Event Date</td>
            <td style="padding: 8px 12px;">${event.date || 'N/A'}</td>
          </tr>
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Venue</td>
            <td style="padding: 8px 12px;">${event.venue || 'N/A'}</td>
          </tr>
        </table>
        <p>Our team will review your request and get back to you shortly.</p>
        <p>Thank you for choosing <strong>RRC Lights &amp; Sounds</strong>!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 24px;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    `,
  });
}

/**
 * Notifies a customer that the status of their request has been updated.
 * @param {string} email
 * @param {object} request  - { id, type, status, event: { title, date, venue } }
 */
export async function sendRequestStatusEmail(email, request) {
  const { id, type, status, event = {}, denialReason } = request;
  const typeLabel = type === 'book' ? 'Booking' : 'Rent';

  const statusConfig = {
    approved:        { color: '#16a34a', label: 'Approved',          msg: 'Your request has been approved! Please check your billing details in My Requests and arrange your downpayment via chat with the admin.' },
    awaitingpayment: { color: '#2563eb', label: 'Approved – Awaiting Downpayment', msg: 'Your request has been approved and is now awaiting your downpayment. Please settle via chat with the admin to confirm your booking.' },
    upcoming:        { color: '#7c3aed', label: 'Upcoming',           msg: 'Your downpayment has been received. Your event is now confirmed and upcoming. We look forward to serving you!' },
    completed:       { color: '#059669', label: 'Completed',          msg: 'Your event has been completed. Thank you for choosing RRC Lights & Sounds! We hope it was a success.' },
    denied:          { color: '#dc2626', label: 'Denied',             msg: denialReason ? `We regret to inform you that your request has been denied. Reason: ${denialReason}` : 'We regret to inform you that your request has been denied. Please contact us for more information.' },
    cancelled:       { color: '#6b7280', label: 'Cancelled',          msg: 'Your request has been cancelled. You may submit a new request anytime.' },
    pending:         { color: '#d97706', label: 'Pending',            msg: 'Your request is currently pending review. We will notify you once our team evaluates it.' },
  };

  const cfg = statusConfig[status] || { color: '#38629B', label: status.charAt(0).toUpperCase() + status.slice(1), msg: 'Your request status has been updated.' };

  await sendMail({
    to: email,
    subject: `RRC Lights & Sounds – Request ${cfg.label} (${id})`,
    text: `
Hi there,

Your ${typeLabel.toLowerCase()} request (${id}) status has been updated.

Status : ${cfg.label}
Event  : ${event.title || 'N/A'} on ${event.date || 'N/A'}
Venue  : ${event.venue || 'N/A'}

${cfg.msg}

Thank you for choosing RRC Lights & Sounds!
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #38629B; text-align: center;">RRC Lights &amp; Sounds</h2>
        <p>Hi there,</p>
        <p>Your <strong>${typeLabel.toLowerCase()} request</strong> status has been updated:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; padding: 10px 28px; border-radius: 999px; background: ${cfg.color}; color: #fff; font-size: 18px; font-weight: bold; letter-spacing: 1px;">
            ${cfg.label}
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Request ID</td>
            <td style="padding: 8px 12px;">${id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Type</td>
            <td style="padding: 8px 12px;">${typeLabel}</td>
          </tr>
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Event Title</td>
            <td style="padding: 8px 12px;">${event.title || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Event Date</td>
            <td style="padding: 8px 12px;">${event.date || 'N/A'}</td>
          </tr>
          <tr style="background: #f5f7fb;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Venue</td>
            <td style="padding: 8px 12px;">${event.venue || 'N/A'}</td>
          </tr>
        </table>
        <p style="color: ${cfg.color}; font-weight: bold;">${cfg.msg}</p>
        <p>Thank you for choosing <strong>RRC Lights &amp; Sounds</strong>!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 24px;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    `,
  });
}
