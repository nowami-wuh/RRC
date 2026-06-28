import nodemailer from 'nodemailer';

/**
 * Creates and returns a configured Nodemailer transporter.
 * Falls back to a no-op mock when EMAIL_USER / EMAIL_PASS are not set.
 */
function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null; // mock mode
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
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

  await transporter.sendMail({
    from: `"RRC Lights & Sounds" <${process.env.EMAIL_USER}>`,
    ...mailOptions,
  });
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
