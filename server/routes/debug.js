import express from 'express';
import { sendMail } from '../mailer.js';

const router = express.Router();

router.get('/env', (req, res) => {
  res.json({
    db: {
      host: process.env.MYSQL_HOST || null,
      port: process.env.MYSQL_PORT || null,
      userSet: Boolean(process.env.MYSQL_USER),
      passwordSet: Boolean(process.env.MYSQL_PASSWORD),
      database: process.env.MYSQL_DATABASE || null,
      ssl: process.env.MYSQL_SSL || null,
    },
    email: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || null,
      secure: process.env.EMAIL_SECURE || null,
      service: process.env.EMAIL_SERVICE || null,
      userSet: Boolean(process.env.EMAIL_USER),
      passSet: Boolean(process.env.EMAIL_PASS),
      skipVerification: String(process.env.SKIP_EMAIL_VERIFICATION).toLowerCase() === 'true',
      mockMode: !process.env.EMAIL_USER || !process.env.EMAIL_PASS,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || null,
      corsOrigins: process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || null,
      apiBase: process.env.VITE_API_BASE_URL || null,
    },
  });
});

/**
 * POST /api/debug/test-email
 * Body: { "to": "recipient@example.com" }
 * Sends a test verification email from production to confirm SMTP works.
 * REMOVE THIS ENDPOINT before going to final production.
 */
router.post('/test-email', async (req, res) => {
  const to = req.body?.to || process.env.EMAIL_USER;
  if (!to) {
    return res.status(400).json({ error: 'Provide a "to" email in the request body.' });
  }

  try {
    await sendMail({
      to,
      subject: 'RRC – SMTP Test',
      text: 'This is a test email sent from the production server to confirm SMTP is working.',
      html: '<p>This is a <strong>test email</strong> from RRC production server. SMTP is working correctly.</p>',
    });
    return res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    console.error('[DEBUG] test-email failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      hint: 'Check EMAIL_USER, EMAIL_PASS (App Password), and EMAIL_SERVICE env vars in Render dashboard.',
    });
  }
});

export default router;

