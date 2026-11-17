function parseTime(value) {
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

export function formatTime12Hour(value) {
  const minutes = parseTime(value);
  if (minutes === null) return String(value || '');

  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 || 12;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  return `${hours12}:${String(minutes % 60).padStart(2, '0')} ${period}`;
}

export function formatTimeRange(value) {
  const text = String(value || '').trim();
  const rangeMatch = text.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (!rangeMatch) return formatTime12Hour(text);
  return `${formatTime12Hour(rangeMatch[1])} - ${formatTime12Hour(rangeMatch[2])}`;
}

export function timeToMinutes(value) {
  return parseTime(value);
}

function formatSingleDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDisplayDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatSingleDate(text);
  const sharedMonthRange = text.match(/^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})$/);
  if (sharedMonthRange) {
    const [, month, startDay, endDay, year] = sharedMonthRange;
    return `${formatSingleDate(`${month} ${startDay}, ${year}`)} - ${formatSingleDate(`${month} ${endDay}, ${year}`)}`;
  }
  const rangeMatch = text.match(/^([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})$/);
  if (!rangeMatch) return formatSingleDate(text);

  const start = formatSingleDate(rangeMatch[1]);
  const end = formatSingleDate(rangeMatch[2]);
  return start && end ? `${start} - ${end}` : text;
}
