import { formatDisplayDate, formatTime12Hour } from '../utils/dateTime';

export default function RequestCard({ request }) {
  return (
    <div className="request-card">
      <div className="request-card-header">
        <div>
          <div className="request-status">{request.status.toUpperCase()}</div>
          <div className="request-title">{request.event.title}</div>
        </div>
        <div className="request-id">{request.id}</div>
      </div>
      <div className="request-card-body">
        <div className="request-row"><strong>Date:</strong> {formatDisplayDate(request.event.date)}</div>
        <div className="request-row"><strong>Venue:</strong> {request.event.venue}</div>
        {request.type !== 'rent' && <div className="request-row"><strong>Guests:</strong> {request.event.pax}</div>}
        <div className="request-row"><strong>Time:</strong> {formatTime12Hour(request.event.timeStart)} - {formatTime12Hour(request.event.timeEnd)}</div>
        {request.package && <div className="request-row"><strong>Package:</strong> {request.package.name}</div>}
      </div>
    </div>
  );
}
