import express from 'express';
import { parseJson, query } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  query('SELECT * FROM packages ORDER BY id ASC')
    .then((rows) => {
      res.json({
        packages: rows.map((row) => ({
          id: row.id,
          section: row.section,
          name: row.name,
          subtitle: row.subtitle,
          occasion: row.occasion,
          note: row.note,
          price: Number(row.price),
          promo: Number(row.promo),
          color: row.color,
          groups: parseJson(row.groups_json, []),
        })),
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load packages' });
    });
});

export default router;
