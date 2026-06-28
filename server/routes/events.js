import express from 'express';
import { parseJson, query } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  query('SELECT event_date, events_json FROM events ORDER BY event_date ASC')
    .then((rows) => {
      const eventsByDate = rows.reduce((acc, row) => {
        const dateKey = new Date(row.event_date).toISOString().slice(0, 10);
        acc[dateKey] = parseJson(row.events_json, []);
        return acc;
      }, {});

      const dates = Object.keys(eventsByDate).map((date) => ({ date, events: eventsByDate[date] }));
      res.json({ dates, eventsByDate });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load events' });
    });
});

router.get('/:date', (req, res) => {
  const { date } = req.params;
  query('SELECT events_json FROM events WHERE event_date = ? LIMIT 1', [date])
    .then((rows) => {
      const events = rows[0] ? parseJson(rows[0].events_json, []) : null;
      if (!events) {
        return res.status(404).json({ error: 'No events found for that day' });
      }

      return res.json({ date, events });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message || 'Unable to load events' });
    });
});

export default router;
