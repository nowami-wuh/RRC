import './loadEnv.js';
import { bootstrapDatabase } from './bootstrap.js';

bootstrapDatabase()
  .then(() => {
    console.log('Database re-seeded successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error re-seeding database:', err);
    process.exit(1);
  });
