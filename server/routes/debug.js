import express from 'express';

const router = express.Router();

router.get('/env', (req, res) => {
  res.json({
    db: {
      host: process.env.MYSQL_HOST || null,
      port: process.env.MYSQL_PORT || null,
      userSet: Boolean(process.env.MYSQL_USER),
      passwordSet: Boolean(process.env.MYSQL_PASSWORD),
      database: process.env.MYSQL_DATABASE || null,
      ssl: process.env.MYSQL_SSL || null,
    },
    email: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || null,
      secure: process.env.EMAIL_SECURE || null,
      service: process.env.EMAIL_SERVICE || null,
      userSet: Boolean(process.env.EMAIL_USER),
      passSet: Boolean(process.env.EMAIL_PASS),
    },
    app: {
      nodeEnv: process.env.NODE_ENV || null,
      corsOrigins: process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || null,
      apiBase: process.env.VITE_API_BASE_URL || null,
    },
  });
});

export default router;
