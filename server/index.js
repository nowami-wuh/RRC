import './loadEnv.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import requestsRoutes from './routes/requests.js';
import packagesRoutes from './routes/packages.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import debugRoutes from './routes/debug.js';
import aboutRoutes from './routes/about.js';
import { bootstrapDatabase } from './bootstrap.js';
import { verifyMailer } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/about', aboutRoutes);

// ── ONE-TIME RESEED ENDPOINT ──────────────────────────────────────────────
// Protected by RESEED_SECRET env var. Call once, then remove this block.
// Usage: GET /api/reseed-packages?secret=YOUR_SECRET
app.get('/api/reseed-packages', async (req, res) => {
  const secret = process.env.RESEED_SECRET || 'rrc-reseed-2026';
  if (req.query.secret !== secret) {
    return res.status(403).json({ error: 'Forbidden – invalid or missing secret.' });
  }
  try {
    const { execute, safeJson } = await import('./db.js');
    const pkgSeed = [
      { section: 'cosupplier', name: 'Package A', subtitle: 'BASIC PA', occasion: 'for Wedding Ceremony Only', note: 'for indoor/outdoor with less than 100 pax at uniform venue for program ceremony only\n3 pax staff + 1 driver', price: 4000, promo: 3500, color: 'blue', groups: [{ category: 'SOUNDS', items: [{ qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' }, { qty: '1 pc', name: 'Mixer (Presonus SL32)' }, { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' }] }] },
      { section: 'cosupplier', name: 'Package B', subtitle: 'BASIC L&S', occasion: 'for Wedding & Birthday Reception', note: 'for indoor/outdoor with less than 200 pax\n4 pax staff + 1 driver', price: 8000, promo: 7000, color: 'blue', groups: [{ category: 'SOUNDS', items: [{ qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' }, { qty: '1 pc', name: 'Sub Speaker (VRX Sub Single 18)' }, { qty: '1 set', name: 'Mixer (Midas M32 + DL32)' }, { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' }] }, { category: 'LIGHTS', items: [{ qty: '8 pcs', name: 'Dimmer (Lumos Parled RGBWAU)' }, { qty: '4 pcs', name: 'Moving Heads (Phantom Mini Beam230)' }, { qty: '1 pc', name: 'Controller (Tiger Touch 2)' }] }] },
      { section: 'cosupplier', name: 'Package C', subtitle: 'FULL L&S', occasion: 'for Large Events & Concerts', note: 'for indoor/outdoor with up to 500 pax\n6 pax staff + 2 drivers', price: 20000, promo: 18000, color: 'blue', groups: [{ category: 'SOUNDS', items: [{ qty: '10 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' }, { qty: '4 pcs', name: 'Main Speaker (XLine Dual 15 Passive)' }, { qty: '2 pcs', name: 'Sub Speaker (VRX Sub Single 18)' }, { qty: '4 pcs', name: 'Sub Speaker (KV2 Dual 18 Passive)' }, { qty: '4 pcs', name: 'Monitor Speaker (Ad Wedge Monitor)' }, { qty: '1 set', name: 'Mixer (Midas M32 + DL32)' }, { qty: '6 pcs', name: 'Microphone (Shure Wireless Mic)' }, { qty: '3 pcs', name: 'Microphone (Sennheiser E835 Wired Mic)' }] }, { category: 'LIGHTS', items: [{ qty: '8 pcs', name: 'Moving Heads (Phantom Mini Beam230)' }, { qty: '4 pcs', name: 'Moving Heads (Phantom BSW 380)' }, { qty: '8 pcs', name: 'Dimmer (Lumos Parled RGBWAU)' }, { qty: '8 pcs', name: 'Dimmer (Weinas RGBW 4in1)' }, { qty: '16 pcs', name: 'Dimmer (Phenomena RGBW)' }, { qty: '8 pcs', name: 'Dimmer (Lumos Ledbar)' }, { qty: '1 pc', name: 'Controller (Tiger Touch 2)' }] }] },
      { section: 'equipment', name: 'Acoustic Equipment',                   subtitle: 'for 1 Acoustic Guitar/Keyboard, 1 Stage Monitor, 2 Microphone',    occasion: 'Addon', note: '', price: 2000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Semi-Acoustic Equipment',              subtitle: 'for Acoustic Guitar + Keyboard, 2 Stage Monitors, 2 Microphone',   occasion: 'Addon', note: '', price: 3000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Band Equipment/BackLine',              subtitle: 'Drumset, Guitar Amp, Bass Amp, Keyboard Amp & Monitors',             occasion: 'Addon', note: '', price: 6000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'Projector + Wide Screen w/ HDMI Cable', subtitle: '',                                                                 occasion: 'Addon', note: '', price: 2000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'equipment', name: 'LED Wall',                             subtitle: '9x12ft or 2.5x3.5m – 35 panels (1 set)',                             occasion: 'Addon', note: '', price: 25000, promo: 0,     color: 'blue', groups: [] },
      { section: 'effects',   name: '2pcs Cold Sparkular',                  subtitle: '', occasion: 'Addon', note: '', price: 7000,  promo: 5000,  color: 'blue', groups: [] },
      { section: 'effects',   name: '4pcs Cold Sparkular',                  subtitle: '', occasion: 'Addon', note: '', price: 12000, promo: 10000, color: 'blue', groups: [] },
      { section: 'effects',   name: 'Fubbles (Fog + Bubbles) Machine Effects', subtitle: '', occasion: 'Addon', note: '', price: 6500, promo: 4500, color: 'blue', groups: [] },
      { section: 'effects',   name: 'Low Lying Fog Machine',                subtitle: '', occasion: 'Addon', note: '', price: 3500,  promo: 2500,  color: 'blue', groups: [] },
      { section: 'effects',   name: 'Smoke Machine',                        subtitle: '', occasion: 'Addon', note: '', price: 1000,  promo: 0,     color: 'blue', groups: [] },
      { section: 'misc', name: 'Booking Duration',               subtitle: '4 hours',           occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Booking Duration Extension',     subtitle: '2,500.00 per hour', occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Boac)',        subtitle: '1,500.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Gasan)',       subtitle: '2,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Mogpog)',      subtitle: '2,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Sta. Cruz)',   subtitle: '3,500.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Buenavista)', subtitle: '3,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
      { section: 'misc', name: 'Mobilization Fee (Torrijos)',   subtitle: '5,000.00',          occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
    ];
    const inventorySeed = [
      { code: 'INV-001', category: 'Audio – Mixer',        name: 'Mixer (Presonus SL32)',                           stock: 1  },
      { code: 'INV-002', category: 'Audio – Mixer',        name: 'Mixer (Midas M32 + DL32)',                        stock: 1  },
      { code: 'INV-003', category: 'Audio – Main Speaker', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)', stock: 10 },
      { code: 'INV-004', category: 'Audio – Main Speaker', name: 'Main Speaker (Ad Flex15A)',                       stock: 2  },
      { code: 'INV-005', category: 'Audio – Main Speaker', name: 'Main Speaker (XLine Dual 15 Passive)',            stock: 4  },
      { code: 'INV-006', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (VRX Sub Single 18)',                 stock: 2  },
      { code: 'INV-007', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (KV2 Dual 18 Passive)',               stock: 4  },
      { code: 'INV-008', category: 'Audio – Sub Speaker',  name: 'Sub Speaker (Subscoope Single 18)',               stock: 4  },
      { code: 'INV-009', category: 'Audio – Monitor',      name: 'Monitor Speaker (Ad Wedge Monitor)',              stock: 4  },
      { code: 'INV-010', category: 'Audio – Microphone',   name: 'Microphone (Shure Wireless Mic)',                 stock: 6  },
      { code: 'INV-011', category: 'Audio – Microphone',   name: 'Microphone (RBR Wireless Mic)',                   stock: 8  },
      { code: 'INV-012', category: 'Audio – Microphone',   name: 'Microphone (Sennheiser E835 Wired Mic)',          stock: 3  },
      { code: 'INV-013', category: 'Audio – Microphone',   name: 'Microphone (Ad M3 Wired Mic)',                    stock: 3  },
      { code: 'INV-014', category: 'Audio – Microphone',   name: 'Microphone (Shure SM57)',                         stock: 3  },
      { code: 'INV-015', category: 'Audio – Microphone',   name: 'Microphone (Shure SM81)',                         stock: 4  },
      { code: 'INV-016', category: 'Audio – Microphone',   name: 'Microphone (Shure Drum Mic PG Series)',           stock: 1  },
      { code: 'INV-017', category: 'Audio – Microphone',   name: 'Microphone (Shure Lapel/Headworn)',               stock: 6  },
      { code: 'INV-018', category: 'Lights – Controller',  name: 'Controller (Mini Pearl)',                         stock: 1  },
      { code: 'INV-019', category: 'Lights – Controller',  name: 'Controller (Tiger Touch 2)',                      stock: 1  },
      { code: 'INV-020', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom Mini Beam230)',             stock: 8  },
      { code: 'INV-021', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom BSW 380)',                  stock: 4  },
      { code: 'INV-022', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam250)',                   stock: 2  },
      { code: 'INV-023', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam260)',                   stock: 2  },
      { code: 'INV-024', category: 'Lights – Moving Head', name: 'Moving Heads (Kosmo Macaura)',                    stock: 4  },
      { code: 'INV-025', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Parled RGBWAU)',                    stock: 8  },
      { code: 'INV-026', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas RGBW 4in1)',                       stock: 8  },
      { code: 'INV-027', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas AW)',                              stock: 8  },
      { code: 'INV-028', category: 'Lights – Dimmer',      name: 'Dimmer (Weinas RGBW)',                            stock: 8  },
      { code: 'INV-029', category: 'Lights – Dimmer',      name: 'Dimmer (Phenomena RGBW)',                         stock: 16 },
      { code: 'INV-030', category: 'Lights – Dimmer',      name: 'Dimmer (Bigdeeper RGB 3in1)',                     stock: 8  },
      { code: 'INV-031', category: 'Lights – Dimmer',      name: 'Dimmer (Bigdeeper AW)',                           stock: 4  },
      { code: 'INV-032', category: 'Lights – Dimmer',      name: 'Dimmer (Phenomena Atomic LED)',                   stock: 4  },
      { code: 'INV-033', category: 'Lights – Dimmer',      name: 'Dimmer (Kosmo Stormy LED)',                       stock: 4  },
      { code: 'INV-034', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Ledbar)',                           stock: 8  },
      { code: 'INV-035', category: 'Lights – Dimmer',      name: 'Dimmer (Lumos Blinder 4eye)',                     stock: 4  },
    ];

    await execute('DELETE FROM packages');
    for (const pkg of pkgSeed) {
      await execute(
        'INSERT INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [pkg.section, pkg.name, pkg.subtitle, pkg.occasion, pkg.note, pkg.price, pkg.promo, pkg.color, JSON.stringify(pkg.groups)],
      );
    }

    await execute('DELETE FROM inventory_items');
    for (const item of inventorySeed) {
      const units = Array.from({ length: item.stock }, (_, i) => ({
        id: `${item.code}-U${i + 1}`, name: `Unit ${i + 1}`, condition: 'Operational', inUse: false,
      }));
      await execute(
        'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [item.code, item.category, item.name, item.stock, 0, JSON.stringify(units)],
      );
    }

    res.json({ ok: true, message: `Seeded ${pkgSeed.length} packages/addons/misc and ${inventorySeed.length} inventory items.` });
  } catch (err) {
    console.error('Reseed error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ── END ONE-TIME RESEED ENDPOINT ─────────────────────────────────────────────

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ success: true, message: 'RRC API is running.' });
  });
}

console.log('Server startup environment:');
console.log('MYSQL_HOST=', process.env.MYSQL_HOST);
console.log('MYSQL_PORT=', process.env.MYSQL_PORT);
console.log('MYSQL_USER set=', Boolean(process.env.MYSQL_USER));
console.log('MYSQL_PASSWORD set=', Boolean(process.env.MYSQL_PASSWORD));
console.log('MYSQL_DATABASE=', process.env.MYSQL_DATABASE);
console.log('MYSQL_SSL=', process.env.MYSQL_SSL);
console.log('BREVO_API_KEY set=', Boolean(process.env.BREVO_API_KEY));
console.log('EMAIL_USER=', process.env.EMAIL_USER || '(not set)');
console.log('NODE_ENV=', process.env.NODE_ENV);
console.log('CORS_ORIGINS=', process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN);

bootstrapDatabase().catch((error) => {
  console.warn('MySQL bootstrap skipped:', error.message);
}).finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Verify SMTP connectivity at startup — check Render logs for ✅ or ❌
    verifyMailer().catch(() => {}); // errors already logged inside verifyMailer
  });
});
