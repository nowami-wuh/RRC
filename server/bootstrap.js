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

  // Migrate existing table: add reply_to_json column for message replies
  try {
    await execute(`ALTER TABLE chat_messages ADD COLUMN reply_to_json LONGTEXT NULL AFTER time_label`);
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

  await execute(`
    CREATE TABLE IF NOT EXISTS about_info (
      id INT PRIMARY KEY DEFAULT 1,
      description TEXT NOT NULL,
      facebook VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

    const pkgSeed = [
      // ── Package A ──
      {
        section: 'cosupplier', name: 'Package A', subtitle: 'BASIC PA',
        occasion: 'for Wedding Ceremony Only',
        note: 'for indoor/outdoor with less than 100 pax at uniform venue for program ceremony only\n3 pax staff + 1 driver',
        price: 4000, promo: 3500, color: 'blue',
        groups: [
          { category: 'SOUNDS', items: [
            { qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
            { qty: '1 pc',  name: 'Mixer (Presonus SL32)' },
            { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' },
          ]},
        ],
      },
      // ── Package B ──
      {
        section: 'cosupplier', name: 'Package B', subtitle: 'BASIC L&S',
        occasion: 'for Wedding & Birthday Reception',
        note: 'for indoor/outdoor with less than 200 pax\n4 pax staff + 1 driver',
        price: 8000, promo: 7000, color: 'blue',
        groups: [
          { category: 'SOUNDS', items: [
            { qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
            { qty: '1 pc',  name: 'Sub Speaker (VRX Sub Single 18)' },
            { qty: '1 set', name: 'Mixer (Midas M32 + DL32)' },
            { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' },
          ]},
          { category: 'LIGHTS', items: [
            { qty: '8 pcs', name: 'Dimmer (Lumos Parled RGBWAU)' },
            { qty: '4 pcs', name: 'Moving Heads (Phantom Mini Beam230)' },
            { qty: '1 pc',  name: 'Controller (Tiger Touch 2)' },
          ]},
        ],
      },
      // ── Package C ──
      {
        section: 'cosupplier', name: 'Package C', subtitle: 'FULL L&S',
        occasion: 'for Large Events & Concerts',
        note: 'for indoor/outdoor with up to 500 pax\n6 pax staff + 2 drivers',
        price: 20000, promo: 18000, color: 'blue',
        groups: [
          { category: 'SOUNDS', items: [
            { qty: '10 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
            { qty: '4 pcs',  name: 'Main Speaker (XLine Dual 15 Passive)' },
            { qty: '2 pcs',  name: 'Sub Speaker (VRX Sub Single 18)' },
            { qty: '4 pcs',  name: 'Sub Speaker (KV2 Dual 18 Passive)' },
            { qty: '4 pcs',  name: 'Monitor Speaker (Ad Wedge Monitor)' },
            { qty: '1 set',  name: 'Mixer (Midas M32 + DL32)' },
            { qty: '6 pcs',  name: 'Microphone (Shure Wireless Mic)' },
            { qty: '3 pcs',  name: 'Microphone (Sennheiser E835 Wired Mic)' },
          ]},
          { category: 'LIGHTS', items: [
            { qty: '8 pcs',  name: 'Moving Heads (Phantom Mini Beam230)' },
            { qty: '4 pcs',  name: 'Moving Heads (Phantom BSW 380)' },
            { qty: '8 pcs',  name: 'Dimmer (Lumos Parled RGBWAU)' },
            { qty: '8 pcs',  name: 'Dimmer (Weinas RGBW 4in1)' },
            { qty: '16 pcs', name: 'Dimmer (Phenomena RGBW)' },
            { qty: '8 pcs',  name: 'Dimmer (Lumos Ledbar)' },
            { qty: '1 pc',   name: 'Controller (Tiger Touch 2)' },
          ]},
        ],
      },
      // ── Add-On: Equipment ──
      { section: 'equipment', name: 'Acoustic Equipment',              subtitle: 'for 1 Acoustic Guitar/Keyboard, 1 Stage Monitor, 2 Microphone', occasion: 'Addon', note: '', price: 2000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Semi-Acoustic Equipment',         subtitle: 'for Acoustic Guitar + Keyboard, 2 Stage Monitors, 2 Microphone', occasion: 'Addon', note: '', price: 3000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Band Equipment/BackLine',         subtitle: 'Drumset, Guitar Amp, Bass Amp, Keyboard Amp & Monitors',          occasion: 'Addon', note: '', price: 6000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Projector + Wide Screen w/ HDMI Cable', subtitle: '',                                                         occasion: 'Addon', note: '', price: 2000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'LED Wall',                        subtitle: '9x12ft or 2.5x3.5m – 35 panels (1 set)',                          occasion: 'Addon', note: '', price: 25000, promo: 0,     color: 'blue', groups: [] },
      // ── Add-On: Special Effects ──
      { section: 'effects',   name: '2pcs Cold Sparkular',                     subtitle: '', occasion: 'Addon', note: '', price: 7000,  promo: 5000,  color: 'blue', groups: [] },
      { section: 'effects',   name: '4pcs Cold Sparkular',                     subtitle: '', occasion: 'Addon', note: '', price: 12000, promo: 10000, color: 'blue', groups: [] },
      { section: 'effects',   name: 'Fubbles (Fog + Bubbles) Machine Effects', subtitle: '', occasion: 'Addon', note: '', price: 6500,  promo: 4500,  color: 'blue', groups: [] },
      { section: 'effects',   name: 'Low Lying Fog Machine',                   subtitle: '', occasion: 'Addon', note: '', price: 3500,  promo: 2500,  color: 'blue', groups: [] },
      { section: 'effects',   name: 'Smoke Machine',                           subtitle: '', occasion: 'Addon', note: '', price: 1000,  promo: 0,     color: 'blue', groups: [] },
      // ── Miscellaneous ──
      { section: 'misc', name: 'Booking Duration',               subtitle: '4 hours',           occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Booking Duration Extension',     subtitle: '2,500.00 per hour', occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Boac)',        subtitle: '1,500.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Gasan)',       subtitle: '2,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Mogpog)',      subtitle: '2,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Sta. Cruz)',   subtitle: '3,500.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Buenavista)', subtitle: '3,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Torrijos)',   subtitle: '5,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
    ];

    for (const pkg of pkgSeed) {
      await execute(
        'INSERT INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [pkg.section, pkg.name, pkg.subtitle, pkg.occasion, pkg.note, pkg.price, pkg.promo, pkg.color, safeJson(pkg.groups)],
      );
    }
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
    const inventorySeed = [
      // Audio – Mixers
      { code: 'INV-001', category: 'Audio – Mixer',        name: 'Mixer (Presonus SL32)',                           stock: 1  },
      { code: 'INV-002', category: 'Audio – Mixer',        name: 'Mixer (Midas M32 + DL32)',                        stock: 1  },
      // Audio – Main Speakers
      { code: 'INV-003', category: 'Audio – Main Speaker', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)', stock: 10 },
      { code: 'INV-004', category: 'Audio – Main Speaker', name: 'Main Speaker (Ad Flex15A)',                       stock: 2  },
      { code: 'INV-005', category: 'Audio – Main Speaker', name: 'Main Speaker (XLine Dual 15 Passive)',            stock: 4  },
      // Audio – Sub Speakers
      { code: 'INV-006', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (VRX Sub Single 18)',                 stock: 2  },
      { code: 'INV-007', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (KV2 Dual 18 Passive)',               stock: 4  },
      { code: 'INV-008', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (Subscoope Single 18)',               stock: 4  },
      // Audio – Monitor
      { code: 'INV-009', category: 'Audio – Monitor',      name: 'Monitor Speaker (Ad Wedge Monitor)',              stock: 4  },
      // Audio – Microphones
      { code: 'INV-010', category: 'Audio – Microphone',   name: 'Microphone (Shure Wireless Mic)',                 stock: 6  },
      { code: 'INV-011', category: 'Audio – Microphone',   name: 'Microphone (RBR Wireless Mic)',                   stock: 8  },
      { code: 'INV-012', category: 'Audio – Microphone',   name: 'Microphone (Sennheiser E835 Wired Mic)',          stock: 3  },
      { code: 'INV-013', category: 'Audio – Microphone',   name: 'Microphone (Ad M3 Wired Mic)',                    stock: 3  },
      { code: 'INV-014', category: 'Audio – Microphone',   name: 'Microphone (Shure SM57)',                         stock: 3  },
      { code: 'INV-015', category: 'Audio – Microphone',   name: 'Microphone (Shure SM81)',                         stock: 4  },
      { code: 'INV-016', category: 'Audio – Microphone',   name: 'Microphone (Shure Drum Mic PG Series)',           stock: 1  },
      { code: 'INV-017', category: 'Audio – Microphone',   name: 'Microphone (Shure Lapel/Headworn)',               stock: 6  },
      // Lights – Controllers
      { code: 'INV-018', category: 'Lights – Controller',  name: 'Controller (Mini Pearl)',                         stock: 1  },
      { code: 'INV-019', category: 'Lights – Controller',  name: 'Controller (Tiger Touch 2)',                      stock: 1  },
      // Lights – Moving Heads
      { code: 'INV-020', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom Mini Beam230)',             stock: 8  },
      { code: 'INV-021', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom BSW 380)',                  stock: 4  },
      { code: 'INV-022', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam250)',                   stock: 2  },
      { code: 'INV-023', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam260)',                   stock: 2  },
      { code: 'INV-024', category: 'Lights – Moving Head', name: 'Moving Heads (Kosmo Macaura)',                    stock: 4  },
      // Lights – Dimmers
      { code: 'INV-025', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Parled RGBWAU)',                   stock: 8  },
      { code: 'INV-026', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas RGBW 4in1)',                      stock: 8  },
      { code: 'INV-027', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas AW)',                             stock: 8  },
      { code: 'INV-028', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas RGBW)',                           stock: 8  },
      { code: 'INV-029', category: 'Lights – Dimmer',      name: 'Dimmer (Phenomena RGBW)',                        stock: 16 },
      { code: 'INV-030', category: 'Lights – Dimmer',      name: 'Dimmer (Bigdeeper RGB 3in1)',                    stock: 8  },
      { code: 'INV-031', category: 'Lights – Dimmer',      name: 'Dimmer (Bigdeeper AW)',                          stock: 4  },
      { code: 'INV-032', category: 'Lights – Dimmer',      name: 'Dimmer (Phenomena Atomic LED)',                  stock: 4  },
      { code: 'INV-033', category: 'Lights – Dimmer',      name: 'Dimmer (Kosmo Stormy LED)',                      stock: 4  },
      { code: 'INV-034', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Ledbar)',                          stock: 8  },
      { code: 'INV-035', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Blinder 4eye)',                    stock: 4  },
    ];

    for (const item of inventorySeed) {
      const units = Array.from({ length: item.stock }, (_, i) => ({
        id: `${item.code}-U${i + 1}`, name: `Unit ${i + 1}`, condition: 'Operational', inUse: false,
      }));
      await execute(
        'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [item.code, item.category, item.name, item.stock, 0, JSON.stringify(units)],
      );
    }
  }

  const aboutRows = await query('SELECT COUNT(*) AS count FROM about_info');
  if (aboutRows[0].count === 0) {
    await execute(
      'INSERT INTO about_info (id, description, facebook, email, phone, location) VALUES (1, ?, ?, ?, ?, ?)',
      [
        'RRC Professional Lights and Sounds is a service provider that caters to events such as weddings, concerts, corporate occasions, and private gatherings, providing services such as lights and sounds equipment rentals, as well as stage and truss setup, among others.',
        'RRC Professional Lights & Sounds',
        'ricson_duenas@yahoo.com',
        '0955-075-4117 / (042)332-1417',
        'Laylay, Boac, Marinduque',
      ],
    );
  }
}

export async function bootstrapDatabase() {
  await ensureTables();
  await seedAuthData();
  await seedReferenceData();
}
