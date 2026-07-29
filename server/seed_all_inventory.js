import './loadEnv.js';
import { execute } from './db.js';

const items = [
  // Audio – Mixers
  { code: 'INV-001', category: 'Audio – Mixer', name: 'Mixer (Presonus SL32)', stock: 1 },
  { code: 'INV-002', category: 'Audio – Mixer', name: 'Mixer (Midas M32 + DL32)', stock: 1 },
  // Audio – Main Speakers
  { code: 'INV-003', category: 'Audio – Main Speaker', name: 'Main Speaker (Kevler VRX932A Line Array Speaker)', stock: 10 },
  { code: 'INV-004', category: 'Audio – Main Speaker', name: 'Main Speaker (Ad Flex15A)', stock: 2 },
  { code: 'INV-005', category: 'Audio – Main Speaker', name: 'Main Speaker (XLine Dual 15 Passive)', stock: 4 },
  // Audio – Sub Speakers
  { code: 'INV-006', category: 'Audio – Sub Speaker', name: 'Sub Speaker (VRX Sub Single 18)', stock: 2 },
  { code: 'INV-007', category: 'Audio – Sub Speaker', name: 'Sub Speaker (KV2 Dual 18 Passive)', stock: 4 },
  { code: 'INV-008', category: 'Audio – Sub Speaker', name: 'Sub Speaker (Subscoope Single 18)', stock: 4 },
  // Audio – Monitor
  { code: 'INV-009', category: 'Audio – Monitor', name: 'Monitor Speaker (Ad Wedge Monitor)', stock: 4 },
  // Audio – Microphones
  { code: 'INV-010', category: 'Audio – Microphone', name: 'Microphone (Shure Wireless Mic)', stock: 6 },
  { code: 'INV-011', category: 'Audio – Microphone', name: 'Microphone (RBR Wireless Mic)', stock: 8 },
  { code: 'INV-012', category: 'Audio – Microphone', name: 'Microphone (Sennheiser E835 Wired Mic)', stock: 3 },
  { code: 'INV-013', category: 'Audio – Microphone', name: 'Microphone (Ad M3 Wired Mic)', stock: 3 },
  { code: 'INV-014', category: 'Audio – Microphone', name: 'Microphone (Shure SM57)', stock: 3 },
  { code: 'INV-015', category: 'Audio – Microphone', name: 'Microphone (Shure SM81)', stock: 4 },
  { code: 'INV-016', category: 'Audio – Microphone', name: 'Microphone (Shure Drum Mic PG Series)', stock: 1 },
  { code: 'INV-017', category: 'Audio – Microphone', name: 'Microphone (Shure Lapel/Headworn)', stock: 6 },

  // Lights – Controllers
  { code: 'INV-018', category: 'Lights – Controller', name: 'Controller (Mini Pearl)', stock: 1 },
  { code: 'INV-019', category: 'Lights – Controller', name: 'Controller (Tiger Touch 2)', stock: 1 },
  // Lights – Moving Heads
  { code: 'INV-020', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom Mini Beam230)', stock: 8 },
  { code: 'INV-021', category: 'Lights – Moving Head', name: 'Moving Heads (Phantom BSW 380)', stock: 4 },
  { code: 'INV-022', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam250)', stock: 2 },
  { code: 'INV-023', category: 'Lights – Moving Head', name: 'Moving Heads (Weinas Beam260)', stock: 2 },
  { code: 'INV-024', category: 'Lights – Moving Head', name: 'Moving Heads (Kosmo Macaura)', stock: 4 },
  // Lights – Dimmers
  { code: 'INV-025', category: 'Lights – Dimmer', name: 'Dimmer (Lumos Parled RGBWAU)', stock: 8 },
  { code: 'INV-026', category: 'Lights – Dimmer', name: 'Dimmer (Weinas RGBW 4in1)', stock: 8 },
  { code: 'INV-027', category: 'Lights – Dimmer', name: 'Dimmer (Weinas AW)', stock: 8 },
  { code: 'INV-028', category: 'Lights – Dimmer', name: 'Dimmer (Weinas RGBW)', stock: 8 },
  { code: 'INV-029', category: 'Lights – Dimmer', name: 'Dimmer (Phenomena RGBW)', stock: 16 },
  { code: 'INV-030', category: 'Lights – Dimmer', name: 'Dimmer (Bigdeeper RGB 3in1)', stock: 8 },
  { code: 'INV-031', category: 'Lights – Dimmer', name: 'Dimmer (Bigdeeper AW)', stock: 4 },
  { code: 'INV-032', category: 'Lights – Dimmer', name: 'Dimmer (Phenomena Atomic LED)', stock: 4 },
  { code: 'INV-033', category: 'Lights – Dimmer', name: 'Dimmer (Kosmo Stormy LED)', stock: 4 },
  { code: 'INV-034', category: 'Lights – Dimmer', name: 'Dimmer (Lumos Ledbar)', stock: 8 },
  { code: 'INV-035', category: 'Lights – Dimmer', name: 'Dimmer (Lumos Blinder 4eye)', stock: 4 },
];

async function main() {
  console.log('Truncating old inventory items...');
  await execute('DELETE FROM inventory_items');

  console.log('Seeding new inventory items...');
  for (const item of items) {
    const requiresAuth = item.name.includes('*') || item.name.includes('requiresAuth') ? 1 : 0;
    const stock = Number(item.stock || 0);
    const units = Array.from({ length: stock }, (_, i) => ({
      id: `${item.code}-U${i + 1}`,
      name: `Unit ${i + 1}`,
      condition: 'Operational',
      inUse: false,
    }));

    await execute(
      'INSERT INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [item.code, item.category, item.name, stock, requiresAuth, JSON.stringify(units)]
    );
  }
  console.log('Inventory seeded successfully!');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
