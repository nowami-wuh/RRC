import './loadEnv.js';
import { query } from './db.js';

async function main() {
  const rows = await query('SELECT id, section, name, subtitle FROM packages');
  console.log('Packages currently in database:', rows);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
