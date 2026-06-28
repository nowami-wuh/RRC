import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents, fetchRequests } from '../api/api';
import { useAuth } from '../context/AuthContext';
import '../styles/home.css';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const today = new Date();
  if (formatDate(date) === formatDate(today)) {
    return `Today, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Robustly normalizes any date string to "YYYY-MM-DD" without timezone shift.
 * Handles both ISO format ("2026-06-15") and human-readable ("June 15, 2026").
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Already in YYYY-MM-DD format — parse directly to avoid UTC midnight shift
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Human-readable format like "June 15, 2026" or "January 20, 2026"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState({});
  const [myRequestIds, setMyRequestIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch ALL requests for the public calendar view (so all users' bookings appear)
    // Also fetch only the current user's requests to know which Booking IDs belong to them
    const allRequestsFetch = fetchRequests();
    const myRequestsFetch = user?.id ? fetchRequests(user.id) : Promise.resolve({ requests: [] });

    Promise.all([fetchEvents(), allRequestsFetch, myRequestsFetch])
      .then(([eventsData, allRequestsData, myRequestsData]) => {
        // Correct key from /api/events response
        const allEvents = { ...(eventsData.eventsByDate || {}) };

        // Track which request IDs belong to the logged-in user (for clickable links)
        const myIds = new Set((myRequestsData.requests || []).map((r) => r.id));
        setMyRequestIds(myIds);

        // Merge ALL booking requests into the calendar (public view)
        const requests = allRequestsData.requests || [];
        requests.forEach((req) => {
          if (req.event && req.event.date) {
            // Skip cancelled and denied — don't show on the public calendar
            if (req.status === 'cancelled' || req.status === 'denied') return;

            const dateKey = normalizeDate(req.event.date);
            if (!dateKey) return;

            if (!allEvents[dateKey]) allEvents[dateKey] = [];

            // Avoid duplicates (in case it was already in the static events table)
            const exists = allEvents[dateKey].some((e) => e.bookingId === req.id);
            if (!exists) {
              allEvents[dateKey].push({
                bookingId: req.id,
                title: req.event.title || 'Event',
                time:
                  req.event.timeStart && req.event.timeEnd
                    ? `${req.event.timeStart} - ${req.event.timeEnd}`
                    : req.event.timeStart || req.event.timeEnd || 'All Day',
                location: req.event.venue || '',
                status: req.status,
              });
            }
          }
        });

        setEvents(allEvents);
        const todayKey = formatDate(new Date());
        if (allEvents[todayKey]) {
          setSelectedDate(new Date());
        }
      })
      .catch(() => setError('Unable to load events.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarDays = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      calendarDays.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        otherMonth: true,
      });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push({
        date: new Date(year, month, day),
        otherMonth: false,
      });
    }

    while (calendarDays.length < 35) {
      const nextDay = calendarDays.length - (firstDayIndex + daysInMonth) + 1;
      calendarDays.push({
        date: new Date(year, month + 1, nextDay),
        otherMonth: true,
      });
    }

    return calendarDays;
  }, [currentDate]);

  const selectedEvents = selectedDate ? events[formatDate(selectedDate)] || [] : [];

  const handleDateClick = (day) => {
    if (day.otherMonth) return;
    setSelectedDate(day.date);
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">EVENTS CALENDAR</h1>
        <div className="header-legend">
          <span className="legend-item">
            <span className="legend-dot today" />
            Today
          </span>
          <span className="legend-item">
            <span className="legend-dot has-event" />
            Has event
          </span>
        </div>
      </header>

      <div className="content-wrapper">
        <section className="calendar-section">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <h2 className="calendar-month">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <button className="calendar-nav-btn" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>
              <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>

          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="calendar-day-header">{label}</div>
            ))}
            {days.map((day) => {
              const dateKey = formatDate(day.date);
              const todayKey = formatDate(new Date());
              const isToday = dateKey === todayKey && !day.otherMonth;
              const isSelected = selectedDate && formatDate(selectedDate) === dateKey;
              const hasEvent = !!events[dateKey];
              return (
                <div
                  key={dateKey}
                  className={`calendar-day ${day.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEvent ? 'has-event' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  {day.date.getDate()}
                </div>
              );
            })}
          </div>
        </section>

        <section className="events-section">
          <div className="events-header" id="eventsHeader">
            <h3 className="events-date">{selectedDate ? formatDisplayDate(selectedDate) : 'Select a date'}</h3>
            <p className="events-instruction">{selectedDate ? 'Events for this day' : 'Select a date with event to view here'}</p>
          </div>

          <div className="events-list" id="eventsList">
            {loading && <div className="event-item">Loading events…</div>}
            {error && <div className="event-item">{error}</div>}
            {!loading && !selectedDate && <div className="event-item">Choose a date with a highlighted dot.</div>}
            {!loading && selectedDate && selectedEvents.length === 0 && <div className="event-item">No events scheduled for this day.</div>}
            {!loading && selectedEvents.map((event, index) => (
              <div key={index} className="event-item">
                {event.time && <div className="event-time">{event.time}</div>}
                <div className="event-title">{event.title}</div>
                {event.location && <div className="event-location">{event.location}</div>}
                {event.bookingId && (
                  <div className="event-id">
                    Booking ID:{' '}
                    {user && myRequestIds.has(event.bookingId) ? (
                      // Current user's own booking — navigate to My Requests and highlight it
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate('/my-requests', { state: { searchId: event.bookingId } })}
                        onKeyDown={(e) => e.key === 'Enter' && navigate('/my-requests', { state: { searchId: event.bookingId } })}
                        style={{ color: '#4A90E2', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {event.bookingId}
                      </span>
                    ) : (
                      // Another user's booking — plain text (privacy)
                      <span style={{ fontStyle: 'italic', color: '#888' }}>{event.bookingId}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
