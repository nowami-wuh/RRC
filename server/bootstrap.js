import bcrypt from 'bcrypt';
import { execute, query, safeJson } from './db.js';

const defaultPassword = 'password123';

async function ensureTables() {
  await execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      public_id VARCHAR(40) NOT NULL UNIQUE,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      avatar LONGTEXT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      email VARCHAR(255) PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS password_resets (
      email VARCHAR(255) PRIMARY KEY,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      avatar LONGTEXT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_date DATE NOT NULL UNIQUE,
      events_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section VARCHAR(50) NOT NULL,
      name VARCHAR(120) NOT NULL,
      subtitle VARCHAR(120) NOT NULL,
      occasion VARCHAR(255) NOT NULL,
      note TEXT NOT NULL,
      price INT NOT NULL,
      promo INT NOT NULL,
      color VARCHAR(50) NOT NULL,
      groups_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_code VARCHAR(40) NOT NULL UNIQUE,
      customer_public_id VARCHAR(40) NOT NULL,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      event_json LONGTEXT NOT NULL,
      package_json LONGTEXT NULL,
      equipment_json LONGTEXT NULL,
      billing_json LONGTEXT NULL,
      denial_reason TEXT NULL,
      additional_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_requests_customer (customer_public_id),
      INDEX idx_requests_status (status)
    )
  `);

  // Safe migrations for existing tables
  try { await execute(`ALTER TABLE requests ADD COLUMN billing_json LONGTEXT NULL AFTER equipment_json`); } catch (_) {}
  try { await execute(`ALTER TABLE requests ADD COLUMN denial_reason TEXT NULL AFTER billing_json`); } catch (_) {}

  await execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_public_id VARCHAR(40) NOT NULL,
      request_code VARCHAR(40) NOT NULL,
      type VARCHAR(40) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_customer (customer_public_id)
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_role VARCHAR(20) NOT NULL,
      sender_name VARCHAR(150) NOT NULL,
      customer_public_id VARCHAR(40) NULL,
      text LONGTEXT NULL,
      image LONGTEXT NULL,
      time_label VARCHAR(40) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing table: add customer_public_id column if missing
  try {
    await execute(`ALTER TABLE chat_messages ADD COLUMN customer_public_id VARCHAR(40) NULL AFTER sender_name`);
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Migrate existing table: add is_read column for chat messages
  try {
    await execute(`ALTER TABLE chat_messages ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER customer_public_id`);
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Migrate existing tables: add avatar support for users and admins
  try { await execute(`ALTER TABLE customers ADD COLUMN avatar LONGTEXT NULL AFTER phone`); } catch (_) {}
  try { await execute(`ALTER TABLE admins ADD COLUMN avatar LONGTEXT NULL AFTER full_name`); } catch (_) {}

  await execute(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_code VARCHAR(40) NOT NULL UNIQUE,
      category VARCHAR(80) NOT NULL,
      name VARCHAR(200) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      requires_auth TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function seedAuthData() {
  const authPasswordHash = await bcrypt.hash(defaultPassword, 10);

  const customerRows = await query('SELECT 1 FROM customers WHERE username = ? LIMIT 1', ['testuser']);
  if (customerRows.length === 0) {
    await execute(
      'INSERT INTO customers (public_id, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      ['RRC-000001', 'testuser', 'test@example.com', '09171234567', authPasswordHash],
    );
  }

  const adminRows = await query('SELECT 1 FROM admins WHERE username = ? LIMIT 1', ['admin']);
  if (adminRows.length === 0) {
    await execute(
      'INSERT INTO admins (username, email, full_name, password_hash) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@rrc.local', 'RRC Admin', authPasswordHash],
    );
  }
}

async function seedReferenceData() {
  const packageRows = await query('SELECT COUNT(*) AS count FROM packages');
  if (packageRows[0].count === 0) {
    await execute(
      'INSERT INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'cosupplier',
        'PACKAGE A',
        'Basic PA',
        'Wedding Ceremony Only',
        'For indoor/outdoor with less than 100 pax at uniform venue for program ceremony only. 3 staff + 1 driver.',
        4000,
        3500,
        'blue',
        safeJson([{ category: 'SOUNDS', items: [{ qty: '2 pcs', name: 'Main Powered Speaker Single 15 inch' }, { qty: '1 unit', name: '6 channel Analog Audio Mixer' }, { qty: '2 pcs', name: 'Wireless Microphones' }] }]),
      ],
    );
  }

  // Only remove the known seed event dates so they can be re-inserted fresh.
  // Do NOT delete all requests — that would wipe real user bookings.
  const seedEventDates = ['2026-06-06', '2026-06-15', '2026-06-23'];
  for (const d of seedEventDates) {
    await execute('DELETE FROM events WHERE event_date = ?', [d]);
  }

  const events = [
    [
      '2026-06-06',
      [
        { time: '10:00AM - 2:00PM', title: 'Birthday Celebration', location: 'Amoingon, Boac', bookingId: 'AAA004' },
        { time: '4:00PM - 7:00PM', title: 'Wedding Reception', location: 'Bognuyan, Gasan', bookingId: 'AAA005' }
      ]
    ],
    [
      '2026-06-15',
      [
        { time: '11:00AM - 4:00PM', title: 'Christmas Party', location: 'Tanza, Boac', bookingId: 'AAA007' }
      ]
    ],
    [
      '2026-06-23',
      [
        { time: '7:00AM - 10:00AM', title: 'Birthday Party', location: 'Libas, Buenavista', bookingId: 'AAA008' },
        { time: '11:00AM - 4:00PM', title: 'Christmas Party', location: 'Libtangin, Gasan', bookingId: 'AAA010' },
        { time: '6:00PM - 10:00PM', title: 'Birthday Party', location: 'Tanza, Boac', bookingId: 'AAA012' }
      ]
    ]
  ];

  for (const [eventDate, payload] of events) {
    await execute('INSERT INTO events (event_date, events_json) VALUES (?, ?)', [eventDate, safeJson(payload)]);
  }

  const seedCustomer = 'RRC-000001';
  const requests = [
    ['AAA004', seedCustomer, 'book', 'awaitingpayment', { title: 'Birthday Celebration', date: 'June 6, 2026', timeStart: '10:00AM', timeEnd: '2:00PM', venue: 'Amoingon, Boac', pax: 80 }, { name: 'PACKAGE B' }],
    ['AAA005', seedCustomer, 'book', 'pending', { title: 'Wedding Reception', date: 'June 6, 2026', timeStart: '4:00PM', timeEnd: '7:00PM', venue: 'Bognuyan, Gasan', pax: 150 }, null],
    ['AAA007', seedCustomer, 'book', 'approved', { title: 'Christmas Party', date: 'June 15, 2026', timeStart: '11:00AM', timeEnd: '4:00PM', venue: 'Tanza, Boac', pax: 120 }, { name: 'PACKAGE A' }],
    ['AAA008', seedCustomer, 'book', 'approved', { title: 'Birthday Party', date: 'June 23, 2026', timeStart: '7:00AM', timeEnd: '10:00AM', venue: 'Libas, Buenavista', pax: 50 }, null],
    ['AAA010', seedCustomer, 'book', 'approved', { title: 'Christmas Party', date: 'June 23, 2026', timeStart: '11:00AM', timeEnd: '4:00PM', venue: 'Libtangin, Gasan', pax: 100 }, null],
    ['AAA012', seedCustomer, 'book', 'approved', { title: 'Birthday Party', date: 'June 23, 2026', timeStart: '6:00PM', timeEnd: '10:00PM', venue: 'Tanza, Boac', pax: 90 }, null],
    ['AAA003', seedCustomer, 'book', 'completed', { title: 'Wedding Ceremony', date: 'January 20, 2026', timeStart: '2:00PM', timeEnd: '7:00PM', venue: 'Capayang, Mogpog', pax: 100 }, { name: 'PACKAGE A' }],
  ];

  for (const [requestCode, customerPublicId, type, status, event, pkg] of requests) {
    await execute(
      'INSERT IGNORE INTO requests (request_code, customer_public_id, type, status, event_json, package_json, equipment_json, additional_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [requestCode, customerPublicId, type, status, safeJson(event), pkg ? safeJson(pkg) : null, safeJson([]), null],
    );
  }

  const chatRows = await query('SELECT COUNT(*) AS count FROM chat_messages');
  if (chatRows[0].count === 0) {
    const messages = [
      ['customer', 'Sample User', seedCustomer, 'Sample Message', null, '11:34 PM'],
      ['admin', 'RRC Admin', null, 'Sample Message', null, '11:35 PM'],
    ];

    for (const [senderRole, senderName, customerPublicId, text, image, timeLabel] of messages) {
      await execute(
        'INSERT INTO chat_messages (sender_role, sender_name, customer_public_id, text, image, time_label) VALUES (?, ?, ?, ?, ?, ?)',
        [senderRole, senderName, customerPublicId, text, image, timeLabel],
      );
    }
  }

  const inventoryRows = await query('SELECT COUNT(*) AS count FROM inventory_items');
  if (inventoryRows[0].count === 0) {
    const items = [
      ['INV-001', 'Audio', 'Mixer (Presonus SL32)', 2, 0, null],
      ['INV-002', 'Audio', 'Sub Speaker (VRX Sub Single 18)', 2, 1, null],
      ['INV-003', 'Lights', 'Moving Heads (Phantom Mini Beam230)', 2, 1, null],
      ['INV-004', 'Lights', 'Dimmer (Lumos Parled RGBWAU)', 2, 0, null],
    ];

    for (const [itemCode, category, name, stock, requiresAuth, notes] of items) {
      await execute(
        'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [itemCode, category, name, stock, requiresAuth, notes],
      );
    }
  }
}

export async function bootstrapDatabase() {
  await ensureTables();
  await seedAuthData();
  await seedReferenceData();
}
