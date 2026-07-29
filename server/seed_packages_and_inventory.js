import './loadEnv.js';
import { execute, query } from './db.js';

function safeJson(v) { return JSON.stringify(v); }

const PACKAGES = [
  // ── PACKAGE A ──
  {
    section: 'cosupplier',
    name: 'Package A',
    subtitle: 'BASIC PA',
    occasion: 'for Wedding Ceremony Only',
    note: 'for indoor/outdoor with less than 100 pax at uniform venue for program ceremony only\n3 pax staff + 1 driver',
    price: 4000,
    promo: 3500,
    color: 'blue',
    groups: [
      {
        category: 'SOUNDS',
        items: [
          { qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
          { qty: '1 pc',  name: 'Mixer (Presonus SL32)' },
          { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' },
        ],
      },
    ],
  },

  // ── PACKAGE B ──
  {
    section: 'cosupplier',
    name: 'Package B',
    subtitle: 'BASIC L&S',
    occasion: 'for Wedding & Birthday Reception',
    note: 'for indoor/outdoor with less than 200 pax\n4 pax staff + 1 driver',
    price: 8000,
    promo: 7000,
    color: 'blue',
    groups: [
      {
        category: 'SOUNDS',
        items: [
          { qty: '2 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
          { qty: '1 pc',  name: 'Sub Speaker (VRX Sub Single 18)' },
          { qty: '1 set', name: 'Mixer (Midas M32 + DL32)' },
          { qty: '2 pcs', name: 'Microphone (Shure Wireless Mic)' },
        ],
      },
      {
        category: 'LIGHTS',
        items: [
          { qty: '8 pcs',  name: 'Dimmer (Lumos Parled RGBWAU)' },
          { qty: '4 pcs',  name: 'Moving Heads (Phantom Mini Beam230)' },
          { qty: '1 pc',   name: 'Controller (Tiger Touch 2)' },
        ],
      },
    ],
  },

  // ── PACKAGE C ──
  {
    section: 'cosupplier',
    name: 'Package C',
    subtitle: 'FULL L&S',
    occasion: 'for Large Events & Concerts',
    note: 'for indoor/outdoor with up to 500 pax\n6 pax staff + 2 drivers',
    price: 20000,
    promo: 18000,
    color: 'blue',
    groups: [
      {
        category: 'SOUNDS',
        items: [
          { qty: '10 pcs', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
          { qty: '4 pcs',  name: 'Main Speaker (XLine Dual 15 Passive)' },
          { qty: '2 pcs',  name: 'Sub Speaker (VRX Sub Single 18)' },
          { qty: '4 pcs',  name: 'Sub Speaker (KV2 Dual 18 Passive)' },
          { qty: '4 pcs',  name: 'Monitor Speaker (Ad Wedge Monitor)' },
          { qty: '1 set',  name: 'Mixer (Midas M32 + DL32)' },
          { qty: '6 pcs',  name: 'Microphone (Shure Wireless Mic)' },
          { qty: '3 pcs',  name: 'Microphone (Sennheiser E835 Wired Mic)' },
        ],
      },
      {
        category: 'LIGHTS',
        items: [
          { qty: '8 pcs',  name: 'Phantom Mini Beam230 Moving Head' },
          { qty: '4 pcs',  name: 'Moving Heads (Phantom BSW 380)' },
          { qty: '8 pcs',  name: 'Dimmer (Lumos Parled RGBWAU)' },
          { qty: '8 pcs',  name: 'Dimmer (Weinas RGBW 4in1)' },
          { qty: '16 pcs', name: 'Dimmer (Phenomena RGBW)' },
          { qty: '8 pcs',  name: 'Dimmer (Lumos Ledbar)' },
          { qty: '1 pc',   name: 'Controller (Tiger Touch 2)' },
        ],
      },
    ],
  },

  // ── ADD-ON: Equipment ──
  { section: 'equipment', name: 'Acoustic Equipment',               subtitle: 'for 1 Acoustic Guitar/Keyboard, 1 Stage Monitor, 2 Microphone', occasion: 'Addon', note: '',    price: 2000,  promo: 0,     color: 'blue', groups: [] },
  { section: 'equipment', name: 'Semi-Acoustic Equipment',          subtitle: 'for Acoustic Guitar + Keyboard, 2 Stage Monitors, 2 Microphone', occasion: 'Addon', note: '',    price: 3000,  promo: 0,     color: 'blue', groups: [] },
  { section: 'equipment', name: 'Band Equipment/BackLine',          subtitle: 'Drumset, Guitar Amp, Bass Amp, Keyboard Amp & Monitors',          occasion: 'Addon', note: '',    price: 6000,  promo: 0,     color: 'blue', groups: [] },
  { section: 'equipment', name: 'Projector + Wide Screen w/ HDMI Cable', subtitle: '',                                                          occasion: 'Addon', note: '',    price: 2000,  promo: 0,     color: 'blue', groups: [] },
  { section: 'equipment', name: 'LED Wall',                         subtitle: '9x12ft or 2.5x3.5m – 35 panels (1 set)',                          occasion: 'Addon', note: '',    price: 25000, promo: 0,     color: 'blue', groups: [] },

  // ── ADD-ON: Special Effects ──
  { section: 'effects',   name: '2pcs Cold Sparkular',                    subtitle: '',  occasion: 'Addon', note: '', price: 7000,  promo: 5000,  color: 'blue', groups: [] },
  { section: 'effects',   name: '4pcs Cold Sparkular',                    subtitle: '',  occasion: 'Addon', note: '', price: 12000, promo: 10000, color: 'blue', groups: [] },
  { section: 'effects',   name: 'Fubbles (Fog + Bubbles) Machine Effects', subtitle: '', occasion: 'Addon', note: '', price: 6500,  promo: 4500,  color: 'blue', groups: [] },
  { section: 'effects',   name: 'Low Lying Fog Machine',                  subtitle: '',  occasion: 'Addon', note: '', price: 3500,  promo: 2500,  color: 'blue', groups: [] },
  { section: 'effects',   name: 'Smoke Machine',                          subtitle: '',  occasion: 'Addon', note: '', price: 1000,  promo: 0,     color: 'blue', groups: [] },

  // ── MISCELLANEOUS ──
  { section: 'misc', name: 'Booking Duration',                  subtitle: '4 hours',             occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Booking Duration Extension',        subtitle: '2,500.00 per hour',   occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Boac)',           subtitle: '1,500.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Gasan)',          subtitle: '2,000.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Mogpog)',         subtitle: '2,000.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Sta. Cruz)',      subtitle: '3,500.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Buenavista)',     subtitle: '3,000.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
  { section: 'misc', name: 'Mobilization Fee (Torrijos)',       subtitle: '5,000.00',            occasion: 'Misc', note: '', price: 0, promo: 0, color: 'blue', groups: [] },
];

const INVENTORY = [
  // Audio – Mixers
  { code: 'INV-001', category: 'Audio – Mixer',           name: 'Mixer (Presonus SL32)',               stock: 1 },
  { code: 'INV-002', category: 'Audio – Mixer',           name: 'Mixer (Midas M32 + DL32)',            stock: 1 },
  // Audio – Main Speakers
  { code: 'INV-003', category: 'Audio – Main Speaker',    name: 'Main Speaker (Kevler VRX932A Line Array Speaker)', stock: 10 },
  { code: 'INV-004', category: 'Audio – Main Speaker',    name: 'Main Speaker (Ad Flex15A)',            stock: 2  },
  { code: 'INV-005', category: 'Audio – Main Speaker',    name: 'Main Speaker (XLine Dual 15 Passive)', stock: 4  },
  // Audio – Sub Speakers
  { code: 'INV-006', category: 'Audio – Sub Speaker',     name: 'Sub Speaker (VRX Sub Single 18)',     stock: 2  },
  { code: 'INV-007', category: 'Audio – Sub Speaker',     name: 'Sub Speaker (KV2 Dual 18 Passive)',   stock: 4  },
  { code: 'INV-008', category: 'Audio – Sub Speaker',     name: 'Sub Speaker (Subscoope Single 18)',   stock: 4  },
  // Audio – Monitor Speakers
  { code: 'INV-009', category: 'Audio – Monitor',         name: 'Monitor Speaker (Ad Wedge Monitor)',  stock: 4  },
  // Audio – Microphones
  { code: 'INV-010', category: 'Audio – Microphone',      name: 'Microphone (Shure Wireless Mic)',     stock: 6  },
  { code: 'INV-011', category: 'Audio – Microphone',      name: 'Microphone (RBR Wireless Mic)',       stock: 8  },
  { code: 'INV-012', category: 'Audio – Microphone',      name: 'Microphone (Sennheiser E835 Wired Mic)', stock: 3 },
  { code: 'INV-013', category: 'Audio – Microphone',      name: 'Microphone (Ad M3 Wired Mic)',        stock: 3  },
  { code: 'INV-014', category: 'Audio – Microphone',      name: 'Microphone (Shure SM57)',             stock: 3  },
  { code: 'INV-015', category: 'Audio – Microphone',      name: 'Microphone (Shure SM81)',             stock: 4  },
  { code: 'INV-016', category: 'Audio – Microphone',      name: 'Microphone (Shure Drum Mic PG Series)', stock: 1 },
  { code: 'INV-017', category: 'Audio – Microphone',      name: 'Microphone (Shure Lapel/Headworn)',   stock: 6  },
  // Lights – Controllers
  { code: 'INV-018', category: 'Lights – Controller',     name: 'Controller (Mini Pearl)',             stock: 1  },
  { code: 'INV-019', category: 'Lights – Controller',     name: 'Controller (Tiger Touch 2)',          stock: 1  },
  // Lights – Moving Heads
  { code: 'INV-020', category: 'Lights – Moving Head',    name: 'Moving Heads (Phantom Mini Beam230)', stock: 8  },
  { code: 'INV-021', category: 'Lights – Moving Head',    name: 'Moving Heads (Phantom BSW 380)',      stock: 4  },
  { code: 'INV-022', category: 'Lights – Moving Head',    name: 'Moving Heads (Weinas Beam250)',       stock: 2  },
  { code: 'INV-023', category: 'Lights – Moving Head',    name: 'Moving Heads (Weinas Beam260)',       stock: 2  },
  { code: 'INV-024', category: 'Lights – Moving Head',    name: 'Moving Heads (Kosmo Macaura)',        stock: 4  },
  // Lights – Dimmers / Par
  { code: 'INV-025', category: 'Lights – Dimmer',         name: 'Dimmer (Lumos Parled RGBWAU)',        stock: 8  },
  { code: 'INV-026', category: 'Lights – Dimmer',         name: 'Dimmer (Weinas RGBW 4in1)',           stock: 8  },
  { code: 'INV-027', category: 'Lights – Dimmer',         name: 'Dimmer (Weinas AW)',                  stock: 8  },
  { code: 'INV-028', category: 'Lights – Dimmer',         name: 'Dimmer (Weinas RGBW)',                stock: 8  },
  { code: 'INV-029', category: 'Lights – Dimmer',         name: 'Dimmer (Phenomena RGBW)',             stock: 16 },
  { code: 'INV-030', category: 'Lights – Dimmer',         name: 'Dimmer (Bigdeeper RGB 3in1)',         stock: 8  },
  { code: 'INV-031', category: 'Lights – Dimmer',         name: 'Dimmer (Bigdeeper AW)',               stock: 4  },
  { code: 'INV-032', category: 'Lights – Dimmer',         name: 'Dimmer (Phenomena Atomic LED)',       stock: 4  },
  { code: 'INV-033', category: 'Lights – Dimmer',         name: 'Dimmer (Kosmo Stormy LED)',           stock: 4  },
  { code: 'INV-034', category: 'Lights – Dimmer',         name: 'Dimmer (Lumos Ledbar)',               stock: 8  },
  { code: 'INV-035', category: 'Lights – Dimmer',         name: 'Dimmer (Lumos Blinder 4eye)',         stock: 4  },
];

async function main() {
  console.log('🗑  Clearing existing packages…');
  await execute('DELETE FROM packages');

  console.log('📦  Seeding packages, add-ons and miscellaneous…');
  for (const pkg of PACKAGES) {
    await execute(
      'INSERT INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pkg.section, pkg.name, pkg.subtitle, pkg.occasion, pkg.note, pkg.price, pkg.promo, pkg.color, safeJson(pkg.groups)],
    );
    console.log(`  ✓ ${pkg.section.toUpperCase()} — ${pkg.name}`);
  }

  console.log('\n🗑  Clearing existing inventory items…');
  await execute('DELETE FROM inventory_items');

  console.log('🔧  Seeding full inventory…');
  for (const item of INVENTORY) {
    const units = Array.from({ length: item.stock }, (_, i) => ({
      id: `${item.code}-U${i + 1}`,
      name: `Unit ${i + 1}`,
      condition: 'Operational',
      inUse: false,
    }));
    await execute(
      'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [item.code, item.category, item.name, item.stock, 0, JSON.stringify(units)],
    );
    console.log(`  ✓ [${item.code}] ${item.name}  (${item.stock} units)`);
  }

  console.log('\n✅  All data seeded successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
