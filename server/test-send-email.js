import './loadEnv.js';
import { sendVerificationEmail } from './mailer.js';

const email = process.argv[2] || process.env.TEST_EMAIL;
const code = process.argv[3] || Math.floor(100000 + Math.random() * 900000).toString();

if (!email) {
  console.error('Usage: node test-send-email.js recipient@example.com [code]');
  process.exit(1);
}

(async () => {
  try {
    console.log('Sending verification email to', email);
    await sendVerificationEmail(email, code);
    console.log('Send invoked successfully. Check server logs and inbox.');
    process.exit(0);
  } catch (err) {
    console.error('Email send failed:', err?.message || err);
    process.exit(2);
  }
})();
