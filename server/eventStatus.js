const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function parseEventDateParts(value) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const dateMatch = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?,?\s+(\d{4})$/);
  if (!dateMatch) return null;

  const month = MONTHS.indexOf(dateMatch[1].toLowerCase()) + 1;
  return {
    year: Number(dateMatch[4]),
    month,
    day: Number(dateMatch[3] || dateMatch[2]),
  };
}

function isValidDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseTimeMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minutes > 59 || hours > 23 || (period && (hours < 1 || hours > 12))) return null;

  if (period) {
    if (hours === 12) hours = 0;
    if (period === 'PM') hours += 12;
  }
  return hours * 60 + minutes;
}

export function hasEventEnded(event, now = new Date()) {
  const date = parseEventDateParts(event?.endDate || event?.date);
  if (!date || !isValidDate(date)) return false;

  const endMinutes = parseTimeMinutes(event?.timeEnd) ?? (24 * 60);
  const eventEndUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    Math.floor(endMinutes / 60),
    endMinutes % 60,
  ) - MANILA_OFFSET_MS;

  return eventEndUtc <= now.getTime();
}
