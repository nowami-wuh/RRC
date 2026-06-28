import './loadEnv.js';
import { execute } from './db.js';

const items = [
  // Audio Category
  { code: 'INV-001', category: 'Audio', name: 'Mixer (Presonus SL32)' },
  { code: 'INV-002', category: 'Audio', name: 'Mixer (Midas M32 + DL32)' },
  { code: 'INV-003', category: 'Audio', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)' },
  { code: 'INV-004', category: 'Audio', name: 'Main Speaker (Ad Flex 15A)' },
  { code: 'INV-005', category: 'Audio', name: 'Main Speaker (XLine Dual 15 Passive)' },
  { code: 'INV-006', category: 'Audio', name: 'Sub Speaker (VRX Sub Single 18)' },
  { code: 'INV-007', category: 'Audio', name: 'Sub Speaker (KV2 Dual 18 Passive)' },
  { code: 'INV-008', category: 'Audio', name: 'Sub Speaker (Subscoope Single 18)' },
  { code: 'INV-009', category: 'Audio', name: 'Monitor Speaker (Ad Wedge Monitor)' },
  { code: 'INV-010', category: 'Audio', name: 'Microphone (Shure Wireless Mic)' },
  { code: 'INV-011', category: 'Audio', name: 'Microphone (RBR Wireless Mic)' },
  { code: 'INV-012', category: 'Audio', name: 'Microphone (Sennheiser E835 Wired Mic)' },
  { code: 'INV-013', category: 'Audio', name: 'Microphone (Ad M3 Wired Mic)' },
  { code: 'INV-014', category: 'Audio', name: 'Microphone (Shure SM57)' },
  { code: 'INV-015', category: 'Audio', name: 'Microphone (Shure SM81)' },
  { code: 'INV-016', category: 'Audio', name: 'Microphone (Shure Drum Mic PG Series)' },
  { code: 'INV-017', category: 'Audio', name: 'Microphone (Shure Lapel/Headworn)' },

  // Lights Category
  { code: 'INV-018', category: 'Lights', name: 'Controller (Mini Pearl)' },
  { code: 'INV-019', category: 'Lights', name: 'Controller (Tiger Touch 2)' },
  { code: 'INV-020', category: 'Lights', name: 'Moving Heads (Phantom Mini Beam230)' },
  { code: 'INV-021', category: 'Lights', name: 'Moving Heads (Phantom BSW 380)' },
  { code: 'INV-022', category: 'Lights', name: 'Moving Heads (Weinas Beam250)' },
  { code: 'INV-023', category: 'Lights', name: 'Moving Heads (Weinas Beam260)' },
  { code: 'INV-024', category: 'Lights', name: 'Moving Heads (Kosmo Macaura Dimmer)' },
  { code: 'INV-025', category: 'Lights', name: 'Dimmer (Lumos Parled RGBWAU)' },
  { code: 'INV-026', category: 'Lights', name: 'Dimmer (Weinas RGBW 4in1)' },
  { code: 'INV-027', category: 'Lights', name: 'Dimmer (Weinas AW)' },
  { code: 'INV-028', category: 'Lights', name: 'Dimmer (Weinas RGBW)' },
  { code: 'INV-029', category: 'Lights', name: 'Dimmer (Phenomena RGBW)' },
  { code: 'INV-030', category: 'Lights', name: 'Dimmer (Bigdeeper RGB 3in1)' },
  { code: 'INV-031', category: 'Lights', name: 'Dimmer (Bigdeeper AW)' },
  { code: 'INV-032', category: 'Lights', name: 'Dimmer (Phenomena Atomic LED)' },
  { code: 'INV-033', category: 'Lights', name: 'Dimmer (Kosmo Stormy LED)' },
  { code: 'INV-034', category: 'Lights', name: 'Dimmer (Lumos Ledbar)' },
  { code: 'INV-035', category: 'Lights', name: 'Dimmer (Lumos Blinder 4eye)' }
];

async function main() {
  console.log('Truncating old inventory items...');
  await execute('DELETE FROM inventory_items');

  console.log('Seeding new inventory items...');
  for (const item of items) {
    // Generate units count: let's start with stock 2, requires special auth depending on items
    const requiresAuth = item.name.includes('*') || item.name.includes('requiresAuth') ? 1 : 0;
    
    // Create initial units serialized as JSON in notes
    const units = [
      { id: `${item.code}-U1`, name: 'SS1', condition: 'Operational', inUse: false },
      { id: `${item.code}-U2`, name: 'SS2', condition: 'Operational', inUse: false }
    ];

    await execute(
      'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [item.code, item.category, item.name, 2, requiresAuth, JSON.stringify(units)]
    );
  }
  console.log('Inventory seeded successfully!');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
