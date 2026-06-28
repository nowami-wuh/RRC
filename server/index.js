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
import { bootstrapDatabase } from './bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(express.json());
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

bootstrapDatabase().catch((error) => {
  console.warn('MySQL bootstrap skipped:', error.message);
}).finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
