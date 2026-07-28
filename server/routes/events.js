import express from 'express';
import { parseJson, query } from '../db.js';

const router = express.Router();

function formatYMD(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/', (req, res) => {
  query('SELECT event_date, events_json FROM events ORDER BY event_date ASC')
    .then((rows) => {
      const eventsByDate = rows.reduce((acc, row) => {
        const dateKey = formatYMD(row.event_date);
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
