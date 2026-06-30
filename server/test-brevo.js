// Quick test script to verify Brevo email sending without database
import { sendVerificationEmail } from './mailer.js';
import './loadEnv.js';

const testEmail = 'nowami.labaguis@gmail.com';

console.log('\n🧪 Testing Brevo OTP Email...\n');

try {
  await sendVerificationEmail(testEmail, '123456');
  console.log('\n✅ Test complete! Check your email for the OTP.');
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
}
