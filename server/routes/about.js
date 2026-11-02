import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

const defaultAbout = {
  description: 'RRC Professional Lights and Sounds is a service provider that caters to events such as weddings, concerts, corporate occasions, and private gatherings, providing services such as lights and sounds equipment rentals, as well as stage and truss setup, among others.',
  facebook: 'RRC Professional Lights & Sounds',
  email: 'ricson_duenas@yahoo.com',
  phone: '0955-075-4117 / (042)332-1417',
  location: 'Laylay, Boac, Marinduque',
  service_agreement: 'By submitting a booking request, I confirm that the event details I provided are accurate. I understand that this request is subject to RRC availability and admin approval; submitting it does not confirm the booking. RRC will confirm the package, price, payment schedule, and event arrangements with me. I agree to coordinate with RRC and follow the final agreed terms.',
  gcash_qr: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_name: '',
};

// GET /api/about
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT description, facebook, email, phone, location, service_agreement, gcash_qr, bank_name, bank_account_number, bank_account_name FROM about_info WHERE id = 1 LIMIT 1',
    );
    if (rows.length > 0) {
      return res.json({
        about: {
          ...defaultAbout,
          ...rows[0],
          service_agreement: rows[0].service_agreement || defaultAbout.service_agreement,
          gcash_qr: rows[0].gcash_qr || '',
          bank_name: rows[0].bank_name || '',
          bank_account_number: rows[0].bank_account_number || '',
          bank_account_name: rows[0].bank_account_name || '',
        },
      });
    }
    return res.json({ about: defaultAbout });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to fetch About Us info' });
  }
});

// PUT /api/about
router.put('/', async (req, res) => {
  const body = req.body || {};
  const { description, facebook, email, phone, location } = body;
  const serviceAgreement = typeof body.service_agreement === 'string'
    ? body.service_agreement.trim()
    : '';
  const gcashQr = typeof body.gcash_qr === 'string' ? body.gcash_qr.trim() : '';
  const bankName = typeof body.bank_name === 'string' ? body.bank_name.trim() : '';
  const bankAccountNumber = typeof body.bank_account_number === 'string' ? body.bank_account_number.trim() : '';
  const bankAccountName = typeof body.bank_account_name === 'string' ? body.bank_account_name.trim() : '';

  if (!description || !facebook || !email || !phone || !location || !serviceAgreement) {
    return res.status(400).json({ error: 'About Us details and a service agreement are required.' });
  }

  try {
    await execute(
      `INSERT INTO about_info (id, description, facebook, email, phone, location, service_agreement, gcash_qr, bank_name, bank_account_number, bank_account_name)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       description = VALUES(description),
       facebook = VALUES(facebook),
       email = VALUES(email),
       phone = VALUES(phone),
       location = VALUES(location),
       service_agreement = VALUES(service_agreement),
       gcash_qr = VALUES(gcash_qr),
       bank_name = VALUES(bank_name),
       bank_account_number = VALUES(bank_account_number),
       bank_account_name = VALUES(bank_account_name)`,
      [
        description.trim(),
        facebook.trim(),
        email.trim(),
        phone.trim(),
        location.trim(),
        serviceAgreement,
        gcashQr,
        bankName,
        bankAccountNumber,
        bankAccountName,
      ],
    );

    return res.json({
      success: true,
      about: {
        description: description.trim(),
        facebook: facebook.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim(),
        service_agreement: serviceAgreement,
        gcash_qr: gcashQr,
        bank_name: bankName,
        bank_account_number: bankAccountNumber,
        bank_account_name: bankAccountName,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update About Us info' });
  }
});

export default router;
