import express from 'express';
import { execute, query } from '../db.js';

const router = express.Router();

const defaultAbout = {
  description: 'RRC Professional Lights and Sounds is a service provider that caters to events such as weddings, concerts, corporate occasions, and private gatherings, providing services such as lights and sounds equipment rentals, as well as stage and truss setup, among others.',
  facebook: 'RRC Professional Lights & Sounds',
  email: 'ricson_duenas@yahoo.com',
  phone: '0955-075-4117 / (042)332-1417',
  location: 'Laylay, Boac, Marinduque',
};

// GET /api/about
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT description, facebook, email, phone, location FROM about_info WHERE id = 1 LIMIT 1');
    if (rows.length > 0) {
      return res.json({ about: rows[0] });
    }
    return res.json({ about: defaultAbout });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to fetch About Us info' });
  }
});

// PUT /api/about
router.put('/', async (req, res) => {
  const { description, facebook, email, phone, location } = req.body || {};
  if (!description || !facebook || !email || !phone || !location) {
    return res.status(400).json({ error: 'All fields (description, facebook, email, phone, location) are required.' });
  }

  try {
    await execute(
      `INSERT INTO about_info (id, description, facebook, email, phone, location)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       description = VALUES(description),
       facebook = VALUES(facebook),
       email = VALUES(email),
       phone = VALUES(phone),
       location = VALUES(location)`,
      [description.trim(), facebook.trim(), email.trim(), phone.trim(), location.trim()]
    );

    return res.json({
      success: true,
      about: {
        description: description.trim(),
        facebook: facebook.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim(),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update About Us info' });
  }
});

export default router;
